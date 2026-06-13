import { useState, useEffect } from 'react';
import { useQuery, useMutation } from "convex/react";
import { api } from "../../convex/_generated/api";

export default function CustomerOrder({ navigate }) {
  const products = useQuery(api.products.list);
  const seedProducts = useMutation(api.products.seed);
  const createOrder = useMutation(api.orders.create);

  const [cart, setCart] = useState({}); // { productId: quantity }
  const [isCartOpen, setIsCartOpen] = useState(false);
  const [customerName, setCustomerName] = useState('');
  const [customerClass, setCustomerClass] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [deviceId, setDeviceId] = useState('');
  const [cooldown, setCooldown] = useState(0); // minutes remaining

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
    const interval = setInterval(checkCooldown, 20000); // refresh every 20 seconds
    return () => clearInterval(interval);
  }, []);

  // Auto-seed products if they are empty
  useEffect(() => {
    if (products && products.length === 0) {
      console.log("No products found in Convex. Seeding defaults...");
      seedProducts().catch(err => console.error("Error seeding products:", err));
    }
  }, [products, seedProducts]);

  const updateQuantity = (productId, delta) => {
    if (cooldown > 0 && delta > 0) {
      alert(`Bestell-Limit erreicht. Du kannst in ${cooldown} Minuten wieder bestellen.`);
      return;
    }
    setCart((prevCart) => {
      const currentQty = prevCart[productId] || 0;
      const newQty = Math.max(0, currentQty + delta);
      
      const updatedCart = { ...prevCart };
      if (newQty === 0) {
        delete updatedCart[productId];
      } else {
        updatedCart[productId] = newQty;
      }
      return updatedCart;
    });
  };

  const getCartCount = () => {
    return Object.values(cart).reduce((sum, qty) => sum + qty, 0);
  };

  const getCartTotal = () => {
    if (!products) return 0;
    return Object.entries(cart).reduce((sum, [productId, qty]) => {
      const prod = products.find((p) => p.id === productId);
      return sum + (prod ? prod.price * qty : 0);
    }, 0);
  };

  const handleCheckout = async (e) => {
    e.preventDefault();
    if (!customerName.trim()) {
      alert('Bitte gib deinen Namen an.');
      return;
    }

    const items = Object.entries(cart).map(([productId, quantity]) => ({
      productId,
      quantity,
    }));

    if (items.length === 0) {
      alert('Dein Warenkorb ist leer.');
      return;
    }

    setSubmitting(true);

    try {
      const order = await createOrder({
        deviceId,
        customerName: customerName.trim(),
        customerClass: customerClass.trim(),
        type: 'online',
        items,
      });

      // Update local storage order timestamps on success
      const storedTimestamps = JSON.parse(localStorage.getItem('crepes_order_timestamps') || '[]');
      storedTimestamps.push(Date.now());
      localStorage.setItem('crepes_order_timestamps', JSON.stringify(storedTimestamps));

      setCart({});
      setCustomerName('');
      setCustomerClass('');
      setIsCartOpen(false);
      setSubmitting(false);
      navigate(`/order/${order.id}`);
    } catch (err) {
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

  // Group products by category
  const categories = products.reduce((acc, prod) => {
    if (!acc[prod.category]) {
      acc[prod.category] = [];
    }
    acc[prod.category].push(prod);
    return acc;
  }, {});

  const cartCount = getCartCount();
  const nonWaterCount = Object.entries(cart).reduce((sum, [id, qty]) => {
    return id !== 'drink-wasser' ? sum + qty : sum;
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
          Frische Crepes online bestellen
        </h1>
        <p style={{ color: 'var(--text-secondary)', maxWidth: '600px', margin: '0 auto' }}>
          Wähle deine Lieblingscrepes und Getränke aus. Bezahle einfach bar bei der Abholung. Guten Appetit!
        </p>
      </div>

      {/* Categories & Products */}
      {Object.entries(categories).map(([categoryName, catProducts]) => (
        <section key={categoryName} className="category-section">
          <h2 className="category-title">{categoryName}</h2>
          <div className="products-grid">
            {catProducts.map((product) => {
              const qty = cart[product.id] || 0;
              const imageUrl = `/images/${product.id}.png`;
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
                      <div className="product-price">{product.price.toFixed(2)} €</div>
                      {qty > 0 ? (
                        <div className="quantity-control">
                          <button className="quantity-btn" onClick={() => updateQuantity(product.id, -1)}>−</button>
                          <span className="quantity-display">{qty}</span>
                          <button className="quantity-btn" onClick={() => updateQuantity(product.id, 1)}>+</button>
                        </div>
                      ) : (
                        <button className="add-btn" onClick={() => updateQuantity(product.id, 1)}>Hinzufügen</button>
                      )}
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

      {/* Cart Drawer */}
      {isCartOpen && (
        <div className="cart-drawer-overlay" onClick={() => setIsCartOpen(false)}>
          <div className="cart-drawer" onClick={(e) => e.stopPropagation()}>
            <div className="cart-header">
              <h2 style={{ fontFamily: 'var(--font-display)', fontWeight: 800 }}>Dein Warenkorb</h2>
              <button className="cart-close" onClick={() => setIsCartOpen(false)}>×</button>
            </div>

            <div className="cart-items">
              {Object.entries(cart).map(([productId, quantity]) => {
                const product = products.find((p) => p.id === productId);
                if (!product) return null;
                return (
                  <div key={productId} className="cart-item">
                    <div className="cart-item-details">
                      <h4>{product.name}</h4>
                      <div className="cart-item-price">{(product.price * quantity).toFixed(2)} €</div>
                    </div>
                    <div className="cart-item-right">
                      <div className="quantity-control">
                        <button className="quantity-btn" onClick={() => updateQuantity(productId, -1)}>−</button>
                        <span className="quantity-display">{quantity}</span>
                        <button className="quantity-btn" onClick={() => updateQuantity(productId, 1)}>+</button>
                      </div>
                    </div>
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
