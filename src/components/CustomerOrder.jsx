import { useState, useEffect } from 'react';
import { useQuery, useMutation } from "convex/react";
import { api } from "../../convex/_generated/api";

const AVAILABLE_TOPPINGS = [
  'Puderzucker',
  'Zimt-Zucker',
  'Nutella',
  'Käse',
  'Schinken'
];

export default function CustomerOrder({ navigate }) {
  const products = useQuery(api.products.list);
  const seedProducts = useMutation(api.products.seed);
  const createOrder = useMutation(api.orders.create);

  const [cart, setCart] = useState([]); // Array: [{ cartId, productId, quantity, toppings }]
  const [isCartOpen, setIsCartOpen] = useState(false);
  const [customerName, setCustomerName] = useState('');
  const [customerClass, setCustomerClass] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [deviceId, setDeviceId] = useState('');
  const [cooldown, setCooldown] = useState(0); // minutes remaining

  // Customization modal states
  const [customizingProduct, setCustomizingProduct] = useState(null);
  const [selectedToppings, setSelectedToppings] = useState([]);

  // 1. Get or generate device ID & check cooldown
  useEffect(() => {
    let devId = localStorage.getItem('crepes_device_id');
    if (!devId) {
      devId = 'dev_' + Math.random().toString(36).substring(2, 15) + Math.random().toString(36).substring(2, 15);
      localStorage.setItem('crepes_device_id', devId);
    }
    setDeviceId(devId);

    const checkCooldown = () => {
      const storedTimestamps = JSON.parse(localStorage.getItem('crepes_order_timestamps') || '[]');
      const oneHourAgo = Date.now() - 60 * 60 * 1000;
      const recentTimestamps = storedTimestamps.filter(t => t > oneHourAgo);
      
      localStorage.setItem('crepes_order_timestamps', JSON.stringify(recentTimestamps));

      if (recentTimestamps.length >= 2) {
        const oldestOrder = recentTimestamps[0];
        const nextAllowed = oldestOrder + 60 * 60 * 1000;
        const remainingMs = nextAllowed - Date.now();
        if (remainingMs > 0) {
          setCooldown(Math.ceil(remainingMs / 60000));
        } else {
          setCooldown(0);
        }
      } else {
        setCooldown(0);
      }
    };

    checkCooldown();
    const interval = setInterval(checkCooldown, 20000);
    return () => clearInterval(interval);
  }, []);

  // Auto-seed/migrate products if empty or old schema
  useEffect(() => {
    if (products) {
      const hasOldProducts = products.some(p => p.id === 'crepe-nutella');
      if (products.length === 0 || hasOldProducts) {
        console.log("Old or missing products detected in Convex. Seeding new catalog...");
        seedProducts().catch(err => console.error("Error seeding products:", err));
      }
    }
  }, [products, seedProducts]);

  const handleAddClick = (product) => {
    if (cooldown > 0) {
      alert(`Bestell-Limit erreicht. Du kannst in ${cooldown} Minuten wieder bestellen.`);
      return;
    }

    // Waffles and Crepes require customization
    if (product.id === 'base-crepe' || product.id === 'base-waffel') {
      setCustomizingProduct(product);
      setSelectedToppings([]);
    } else {
      // Direct add for sandwiches / drinks
      addToCart(product.id, []);
    }
  };

  const addToCart = (productId, toppings) => {
    setCart((prevCart) => {
      // Sort toppings to ensure same combination gets same cartId
      const sortedToppings = [...toppings].sort();
      const cartId = productId + (sortedToppings.length > 0 ? '_' + sortedToppings.join('-') : '');
      
      const existingItemIdx = prevCart.findIndex(item => item.cartId === cartId);
      const newCart = [...prevCart];

      if (existingItemIdx > -1) {
        newCart[existingItemIdx] = {
          ...newCart[existingItemIdx],
          quantity: newCart[existingItemIdx].quantity + 1
        };
      } else {
        newCart.push({
          cartId,
          productId,
          quantity: 1,
          toppings: sortedToppings
        });
      }
      return newCart;
    });
  };

  const updateQuantity = (cartId, delta) => {
    setCart((prevCart) => {
      const idx = prevCart.findIndex(item => item.cartId === cartId);
      if (idx === -1) return prevCart;

      const newQty = prevCart[idx].quantity + delta;
      const newCart = [...prevCart];

      if (newQty <= 0) {
        newCart.splice(idx, 1);
      } else {
        newCart[idx] = {
          ...newCart[idx],
          quantity: newQty
        };
      }
      return newCart;
    });
  };

  const handleToppingToggle = (topping) => {
    setSelectedToppings(prev => {
      if (prev.includes(topping)) {
        return prev.filter(t => t !== topping);
      } else {
        return [...prev, topping];
      }
    });
  };

  const submitCustomization = () => {
    if (!customizingProduct) return;
    addToCart(customizingProduct.id, selectedToppings);
    setCustomizingProduct(null);
    setSelectedToppings([]);
  };

  const getCartCount = () => {
    return cart.reduce((sum, item) => sum + item.quantity, 0);
  };

  const getCartTotal = () => {
    if (!products) return 0;
    return cart.reduce((sum, item) => {
      const prod = products.find((p) => p.id === item.productId);
      if (!prod) return sum;
      const itemBasePrice = prod.price;
      const toppingsPrice = item.toppings.length * 0.50;
      return sum + (itemBasePrice + toppingsPrice) * item.quantity;
    }, 0);
  };

  const handleCheckout = async (e) => {
    e.preventDefault();
    if (!customerName.trim()) {
      alert('Bitte gib deinen Namen an.');
      return;
    }

    if (cart.length === 0) {
      alert('Dein Warenkorb ist leer.');
      return;
    }

    setSubmitting(true);

    // Watchdog timer to prevent UI lockup if the server or connection is offline/slow
    const watchdog = setTimeout(() => {
      alert('Die Verbindung zum Server dauert ungewöhnlich lange. Bitte stelle sicher, dass eine aktive Internetverbindung besteht und der Server erreichbar ist.');
      setSubmitting(false);
    }, 8000);

    try {
      const items = cart.map(item => ({
        productId: item.productId,
        quantity: item.quantity,
        toppings: item.toppings
      }));

      const order = await createOrder({
        deviceId,
        customerName: customerName.trim(),
        customerClass: customerClass.trim(),
        type: 'online',
        items,
      });
      
      clearTimeout(watchdog);

      // Update local storage order timestamps on success
      const storedTimestamps = JSON.parse(localStorage.getItem('crepes_order_timestamps') || '[]');
      storedTimestamps.push(Date.now());
      localStorage.setItem('crepes_order_timestamps', JSON.stringify(storedTimestamps));

      setCart([]);
      setCustomerName('');
      setCustomerClass('');
      setIsCartOpen(false);
      setSubmitting(false);
      navigate(`/order/${order.id}`);
    } catch (err) {
      clearTimeout(watchdog);
      console.error(err);
      alert(err.message || 'Fehler beim Aufgeben der Bestellung. Bitte versuche es erneut.');
      setSubmitting(false);
    }
  };

  // Loading state
  if (products === undefined) {
    return (
      <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: '60vh', flexDirection: 'column', gap: '1rem' }}>
        <div className="status-badge neu" style={{ animation: 'pulse 1.5s infinite' }}>Lade leckere Crepes...</div>
      </div>
    );
  }

  // Filter categories. Exclude products with old IDs if any remain during transition
  const validProducts = products.filter(p => p.id !== 'crepe-nutella');

  const categories = validProducts.reduce((acc, prod) => {
    if (!acc[prod.category]) {
      acc[prod.category] = [];
    }
    acc[prod.category].push(prod);
    return acc;
  }, {});

  const cartCount = getCartCount();
  const nonWaterCount = cart.reduce((sum, item) => {
    return item.productId !== 'drink-wasser' ? sum + item.quantity : sum;
  }, 0);

  return (
    <div className="main-content">
      {/* Cooldown Alert Banner */}
      {cooldown > 0 && (
        <div className="alert alert-error" style={{ position: 'sticky', top: '5.5rem', zIndex: 80, display: 'flex', flexDirection: 'column', gap: '0.25rem', textAlign: 'center', boxShadow: '0 4px 12px rgba(0,0,0,0.3)', marginBottom: '2rem' }}>
          <strong>Bestellsperre aktiv (Anti-Spam)</strong>
          <span>Du hast bereits 2 Bestellungen aufgegeben. Du kannst in <strong>{cooldown} Minuten</strong> wieder bestellen.</span>
        </div>
      )}

      {/* Welcome Banner */}
      <div style={{ textAlign: 'center', marginBottom: '3rem' }}>
        <h1 style={{ fontSize: '2.5rem', marginBottom: '0.5rem', background: 'linear-gradient(135deg, #fff 40%, var(--accent) 100%)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }}>
          Frische Crepes & Waffeln bestellen
        </h1>
        <p style={{ color: 'var(--text-secondary)', maxWidth: '600px', margin: '0 auto' }}>
          Wähle dein Lieblingsprodukt und verfeinere es mit leckeren Toppings. Bezahle bar bei der Abholung.
        </p>
      </div>

      {/* Categories & Products */}
      {Object.entries(categories).map(([categoryName, catProducts]) => (
        <section key={categoryName} className="category-section">
          <h2 className="category-title">{categoryName}</h2>
          <div className="products-grid">
            {catProducts.map((product) => {
              const imageUrl = `/images/${product.id}.png`;
              
              // Find total count of this base product in the cart
              const countInCart = cart
                .filter(item => item.productId === product.id)
                .reduce((sum, item) => sum + item.quantity, 0);

              return (
                <div key={product.id} className="product-card">
                  <div className="product-image-container">
                    <img
                      src={imageUrl}
                      alt={product.name}
                      className="product-image"
                      onError={(e) => {
                        e.target.style.display = 'none';
                      }}
                    />
                  </div>
                  <div className="product-card-body">
                    <div className="product-info">
                      <h3>{product.name}</h3>
                      <p className="product-desc">{product.description}</p>
                    </div>
                    <div className="product-footer">
                      <div className="product-price">
                        {product.price.toFixed(2)} €
                        {(product.id === 'base-crepe' || product.id === 'base-waffel') && (
                          <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)', display: 'block', fontWeight: 'normal' }}>
                            + 0.50 € je Extra
                          </span>
                        )}
                      </div>
                      <button className="add-btn" onClick={() => handleAddClick(product)}>
                        {countInCart > 0 ? `Hinzufügen (${countInCart})` : 'Hinzufügen'}
                      </button>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </section>
      ))}

      {/* Floating Cart Trigger */}
      {cartCount > 0 && (
        <button className="cart-floating-trigger" onClick={() => setIsCartOpen(true)}>
          <span>Warenkorb ansehen</span>
          <span className="cart-count">{cartCount}</span>
          <span style={{ marginLeft: '0.5rem', fontWeight: 600 }}>({getCartTotal().toFixed(2)} €)</span>
        </button>
      )}

      {/* Toppings Customization Modal */}
      {customizingProduct && (
        <div className="cart-drawer-overlay" style={{ display: 'flex', justifyContent: 'center', alignItems: 'center' }}>
          <div className="login-container" style={{ width: '100%', maxWidth: '460px', margin: '0 1rem', textAlign: 'left', animation: 'bounce-in 0.3s ease-out' }}>
            <h3 style={{ fontFamily: 'var(--font-display)', fontSize: '1.4rem', marginBottom: '0.5rem', color: 'var(--accent)' }}>
              ✨ {customizingProduct.name} verfeinern
            </h3>
            <p style={{ color: 'var(--text-secondary)', fontSize: '0.85rem', marginBottom: '1.5rem' }}>
              Wähle deine Extras aus. Jedes Topping kostet <strong>+ 0.50 €</strong>.
            </p>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.85rem', marginBottom: '2rem' }}>
              {AVAILABLE_TOPPINGS.map(topping => {
                const isSelected = selectedToppings.includes(topping);
                return (
                  <label 
                    key={topping} 
                    style={{ 
                      display: 'flex', 
                      alignItems: 'center', 
                      gap: '0.75rem', 
                      padding: '0.75rem 1rem', 
                      borderRadius: '10px', 
                      backgroundColor: isSelected ? 'rgba(245, 158, 11, 0.06)' : 'var(--bg-tertiary)',
                      border: `1px solid ${isSelected ? 'var(--accent)' : 'rgba(255,255,255,0.04)'}`,
                      cursor: 'pointer',
                      transition: 'var(--transition-fast)'
                    }}
                  >
                    <input
                      type="checkbox"
                      checked={isSelected}
                      onChange={() => handleToppingToggle(topping)}
                      style={{ 
                        width: '18px', 
                        height: '18px', 
                        accentColor: 'var(--accent)',
                        cursor: 'pointer'
                      }}
                    />
                    <span style={{ fontWeight: 600, fontSize: '0.95rem', color: isSelected ? 'var(--text-primary)' : 'var(--text-secondary)' }}>
                      {topping} (+ 0.50 €)
                    </span>
                  </label>
                );
              })}
            </div>

            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderTop: '1px solid var(--border-color)', paddingTop: '1rem', marginBottom: '1.5rem' }}>
              <span style={{ color: 'var(--text-secondary)' }}>Preis pro Stück:</span>
              <strong style={{ fontSize: '1.35rem', color: 'var(--accent)', fontFamily: 'var(--font-display)' }}>
                {(customizingProduct.price + selectedToppings.length * 0.50).toFixed(2)} €
              </strong>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem' }}>
              <button className="btn btn-secondary" onClick={() => setCustomizingProduct(null)}>
                Abbrechen
              </button>
              <button className="btn btn-primary" onClick={submitCustomization}>
                Hinzufügen
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Cart Drawer */}
      {isCartOpen && (
        <div className="cart-drawer-overlay" onClick={() => setIsCartOpen(false)}>
          <div className="cart-drawer" onClick={(e) => e.stopPropagation()}>
            <div className="cart-header">
              <h2 style={{ fontFamily: 'var(--font-display)', fontWeight: 800 }}>Dein Warenkorb</h2>
              <button className="cart-close" onClick={() => setIsCartOpen(false)}>×</button>
            </div>

            <div className="cart-items">
              {cart.map((item) => {
                const product = products.find((p) => p.id === item.productId);
                if (!product) return null;
                const toppingsPrice = item.toppings.length * 0.50;
                const unitPrice = product.price + toppingsPrice;
                
                return (
                  <div key={item.cartId} className="cart-item" style={{ flexDirection: 'column', alignItems: 'stretch', gap: '0.5rem' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <div className="cart-item-details">
                        <h4 style={{ fontSize: '1.05rem' }}>{product.name}</h4>
                        <div className="cart-item-price">{(unitPrice * item.quantity).toFixed(2)} €</div>
                      </div>
                      <div className="cart-item-right">
                        <div className="quantity-control">
                          <button className="quantity-btn" onClick={() => updateQuantity(item.cartId, -1)}>−</button>
                          <span className="quantity-display">{item.quantity}</span>
                          <button className="quantity-btn" onClick={() => updateQuantity(item.cartId, 1)}>+</button>
                        </div>
                      </div>
                    </div>
                    {item.toppings.length > 0 && (
                      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.25rem', marginTop: '0.25rem' }}>
                        {item.toppings.map(t => (
                          <span key={t} style={{ fontSize: '0.7rem', padding: '0.15rem 0.4rem', borderRadius: '4px', backgroundColor: 'var(--bg-secondary)', border: '1px solid rgba(255,255,255,0.04)', color: 'var(--accent)' }}>
                            + {t}
                          </span>
                        ))}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>

            <form onSubmit={handleCheckout} className="cart-checkout-form">
              {/* Product Limit Warning */}
              {nonWaterCount > 10 && (
                <div className="alert alert-error" style={{ fontSize: '0.8rem', padding: '0.75rem', marginBottom: '0.5rem', lineHeight: '1.4' }}>
                  ⚠️ Maximal 10 Produkte pro Bestellung erlaubt (Wasser ist unbegrenzt). 
                  Aktuell: <strong>{nonWaterCount} Produkte</strong>. 
                  Bitte erstelle eine neue Bestellung oder bestelle von einem anderen Gerät.
                </div>
              )}

              <div className="form-group">
                <label htmlFor="cust-name">Dein Name *</label>
                <input
                  id="cust-name"
                  type="text"
                  className="form-input"
                  placeholder="z.B. Max Mustermann"
                  value={customerName}
                  onChange={(e) => setCustomerName(e.target.value)}
                  required
                />
              </div>

              <div className="form-group">
                <label htmlFor="cust-class">Klasse / Ort</label>
                <input
                  id="cust-class"
                  type="text"
                  className="form-input"
                  placeholder="z.B. 10b oder Lehrerzimmer"
                  value={customerClass}
                  onChange={(e) => setCustomerClass(e.target.value)}
                />
              </div>

              <div className="cart-summary">
                <span className="cart-total-label">Gesamtsumme:</span>
                <span className="cart-total-value">{getCartTotal().toFixed(2)} €</span>
              </div>

              <button
                type="submit"
                className="btn btn-primary"
                disabled={submitting || nonWaterCount > 10 || cooldown > 0}
                style={{ width: '100%', padding: '1rem', marginTop: '0.5rem' }}
              >
                {submitting ? 'Bestellung wird gesendet...' : 'Kostenpflichtig bestellen'}
              </button>
              
              <div style={{ textAlign: 'center', fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                * Bezahlt wird bar bei Abholung / Lieferung.
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
