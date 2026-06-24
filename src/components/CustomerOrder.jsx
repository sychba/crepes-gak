import { useState, useEffect } from 'react';
import { useQuery, useMutation } from "convex/react";
import { api } from "../../convex/_generated/api";

const AVAILABLE_TOPPINGS = [
  'Puderzucker',
  'Zimt-Zucker',
  'Nutella',
  'Apfelmus',
  'Käse',
  'Schinken'
];

const getDefaultToppingsForProduct = (productId) => {
  if (productId.includes('nutella')) return ['Nutella'];
  if (productId.includes('zimt-zucker')) return ['Zimt-Zucker'];
  if (productId.includes('puderzucker')) return ['Puderzucker'];
  if (productId.includes('apfelmus')) return ['Apfelmus'];
  if (productId.includes('kaese-schinken')) return ['Käse', 'Schinken'];
  return [];
};

const getFriendlyErrorMessage = (rawError) => {
  if (!rawError) return 'Ein unerwarteter Fehler ist aufgetreten. Bitte versuche es erneut.';
  
  const msg = rawError.toString();
  
  if (msg.includes('gesperrt')) {
    return 'Dieses Gerät wurde für weitere Bestellungen gesperrt. Bitte wende dich an das Personal.';
  }
  if (msg.includes('Bestell-Limit erreicht') || msg.includes('bereits online bestellt')) {
    return 'Du hast bereits online bestellt. Für weitere Bestellungen bestelle bitte direkt vor Ort an der Kasse (Limit: 1 Online-Bestellung pro Stunde).';
  }
  if (msg.includes('Maximal 10 Produkte') || msg.includes('10 Produkte pro Bestellung erlaubt') || msg.includes('über 10 Produkte')) {
    return 'Maximal 10 Produkte pro Online-Bestellung erlaubt. Für größere Bestellungen bestelle bitte direkt vor Ort an der Kasse.';
  }
  if (msg.includes('Validator') || msg.includes('ArgumentValidationError') || msg.includes('extra field')) {
    return 'Server-Konfigurationsfehler: Bitte stelle sicher, dass das neueste Convex-Schema deployed ist (npx convex deploy).';
  }
  
  return msg;
};

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
  const [errorMessage, setErrorMessage] = useState(null);
  const [deliveryMethod, setDeliveryMethod] = useState('Abholung');
  const [loyaltyCardId, setLoyaltyCardId] = useState(null);

  // Load loyalty card ID from localStorage on mount
  useEffect(() => {
    if (typeof window !== "undefined") {
      setLoyaltyCardId(localStorage.getItem("crepes_loyalty_card_id"));
    }
  }, []);

  const loyaltyCard = useQuery(
    api.loyalty.getCard,
    loyaltyCardId ? { cardId: loyaltyCardId } : "skip"
  );

  // Customization modal states
  const [customizingProduct, setCustomizingProduct] = useState(null);
  const [selectedToppings, setSelectedToppings] = useState([]);

  // Fetch online order limit status from Convex
  const orderStatus = useQuery(api.orders.checkActiveOrRecentOrder, { deviceId: deviceId || "" });
  const activeOrderTicket = orderStatus?.status === 'active' ? orderStatus.ticketCode : null;
  const activeOrderStatus = orderStatus?.status === 'active' ? orderStatus.orderStatus : null;
  const cooldown = orderStatus?.status === 'cooldown' ? orderStatus.remainingMinutes : 0;

  // Get or generate device ID
  useEffect(() => {
    let devId = localStorage.getItem('crepes_device_id');
    if (!devId) {
      devId = 'dev_' + Math.random().toString(36).substring(2, 15) + Math.random().toString(36).substring(2, 15);
      localStorage.setItem('crepes_device_id', devId);
    }
    setDeviceId(devId);
  }, []);

  // Auto-seed/migrate products if empty or old schema
  useEffect(() => {
    if (products) {
      const isMissingNewProducts = !products.some(p => p.id === 'sandwich-cheese');
      const isOldDescription = products.some(p => p.id === 'crepe-plain' && !p.description.includes('selbst Gestalten'));
      if (products.length === 0 || isMissingNewProducts || isOldDescription) {
        console.log("Old or missing products detected in Convex. Seeding new catalog...");
        seedProducts().catch(err => console.error("Error seeding products:", err));
      }
    }
  }, [products, seedProducts]);

  const handleAddClick = (product) => {
    if (activeOrderTicket) {
      setErrorMessage(`Du hast bereits eine offene Bestellung (${activeOrderTicket}). Bitte hole diese erst ab oder bestelle weitere Portionen direkt vor Ort an der Kasse.`);
      return;
    }
    if (cooldown > 0) {
      setErrorMessage(`Du hast bereits online bestellt. Für weitere Portionen komm bitte direkt vor Ort an die Kasse (neue Online-Bestellungen sind in ${cooldown} Minuten wieder möglich).`);
      return;
    }

    // If product category is Crepes or Waffeln, it's customizable
    if (product.category === 'Crepes' || product.category === 'Waffeln') {
      setCustomizingProduct(product);
      setSelectedToppings(getDefaultToppingsForProduct(product.id));
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
    const baseId = customizingProduct.category === 'Crepes' ? 'base-crepe' : 'base-waffel';
    addToCart(baseId, selectedToppings);
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

  const getLoyaltyDiscount = () => {
    if (!loyaltyCard || !products) return 0;
    const crepeCount = cart.reduce((sum, item) => {
      const prod = products.find((p) => p.id === item.productId);
      if (prod && prod.category === "Crepes") {
        return sum + item.quantity;
      }
      return sum;
    }, 0);
    
    const totalStamps = loyaltyCard.stamps + crepeCount;
    const freeCrepesEarned = Math.floor(totalStamps / 5);
    if (freeCrepesEarned === 0) return 0;
    
    // Flatten all crepes in cart to get their individual prices
    const crepePrices = [];
    cart.forEach((item) => {
      const prod = products.find((p) => p.id === item.productId);
      if (prod && prod.category === "Crepes") {
        const itemBasePrice = prod.price;
        const toppingsPrice = item.toppings.length * 0.50;
        const unitPrice = itemBasePrice + toppingsPrice;
        for (let i = 0; i < item.quantity; i++) {
          crepePrices.push(unitPrice);
        }
      }
    });
    
    // Sort descending
    crepePrices.sort((a, b) => b - a);
    
    // Take the sum of the free ones
    let discount = 0;
    for (let i = 0; i < Math.min(freeCrepesEarned, crepePrices.length); i++) {
      discount += crepePrices[i];
    }
    return discount;
  };

  const handleCheckout = async (e) => {
    e.preventDefault();
    if (!customerName.trim()) {
      setErrorMessage('Bitte gib deinen Namen an.');
      return;
    }

    if (cart.length === 0) {
      setErrorMessage('Dein Warenkorb ist leer.');
      return;
    }

    setSubmitting(true);

    // Watchdog timer to prevent UI lockup if the server or connection is offline/slow
    const watchdog = setTimeout(() => {
      setErrorMessage('Die Verbindung zum Server dauert ungewöhnlich lange. Bitte stelle sicher, dass eine aktive Internetverbindung besteht und der Server erreichbar ist.');
      setSubmitting(false);
    }, 8000);

    try {
      const items = cart.map(item => ({
        productId: item.productId,
        quantity: item.quantity,
        toppings: item.toppings
      }));

      const loyaltyCardId = localStorage.getItem("crepes_loyalty_card_id") || undefined;

      const order = await createOrder({
        deviceId,
        loyaltyCardId,
        customerName: customerName.trim(),
        customerClass: customerClass.trim(),
        type: 'online',
        deliveryMethod,
        items,
      });
      
      clearTimeout(watchdog);

      // Trigger automatic Apple Wallet push update
      if (order.pushTokens && order.pushTokens.length > 0) {
        fetch("/api/passes/push", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ pushTokens: order.pushTokens }),
        }).catch((err) => console.error("Fehler beim Senden des Wallet-Pushs:", err));
      }

      setCart([]);
      setCustomerName('');
      setCustomerClass('');
      setIsCartOpen(false);
      setSubmitting(false);
      navigate(`/order/${order.id}`);
    } catch (err) {
      clearTimeout(watchdog);
      console.error(err);
      setErrorMessage(getFriendlyErrorMessage(err.message || err));
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

  // Filter categories. Exclude system base products from the storefront
  const validProducts = products.filter(p => p.category !== 'System');

  const categories = validProducts.reduce((acc, prod) => {
    if (!acc[prod.category]) {
      acc[prod.category] = [];
    }
    acc[prod.category].push(prod);
    return acc;
  }, {});

  const cartCount = getCartCount();
  const isShopClosed = true;

  if (isShopClosed) {
    return (
      <div className="main-content" style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: '60vh', padding: '2rem' }}>
        <div className="login-container" style={{ 
          maxWidth: '500px', 
          width: '100%', 
          textAlign: 'center', 
          padding: '3rem 2rem', 
          borderRadius: '24px', 
          border: '1px solid var(--border-color)',
          background: 'rgba(255, 255, 255, 0.03)',
          backdropFilter: 'blur(10px)',
          boxShadow: '0 20px 40px rgba(0,0,0,0.3)',
          animation: 'bounce-in 0.4s ease-out'
        }}>
          <span style={{ fontSize: '4.5rem', display: 'block', marginBottom: '1.5rem', filter: 'drop-shadow(0 0 10px rgba(245, 158, 11, 0.2))' }}>🥞✨</span>
          <h2 style={{ fontFamily: 'var(--font-display)', fontSize: '2rem', fontWeight: 800, marginBottom: '1rem', color: 'var(--text-primary)' }}>
            Online-Shop geschlossen
          </h2>
          <p style={{ color: 'var(--text-secondary)', fontSize: '1.1rem', lineHeight: '1.6', marginBottom: '2rem' }}>
            Bestellungen über die Website sind zurzeit deaktiviert. Bitte bestelle direkt vor Ort an der Kasse.
          </p>
          <div style={{ fontSize: '0.85rem', color: 'var(--text-muted)', borderTop: '1px solid var(--border-color)', paddingTop: '1.5rem' }}>
            Vielen Dank für deinen Besuch! ➔ 🥞🧇
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="main-content">
      {/* Active Order Alert Banner */}
      {activeOrderTicket && (
        <div className="alert alert-error" style={{ position: 'sticky', top: '5.5rem', zIndex: 80, display: 'flex', flexDirection: 'column', gap: '0.5rem', textAlign: 'center', boxShadow: '0 4px 12px rgba(0,0,0,0.3)', marginBottom: '2rem' }}>
          <strong>Laufende Bestellung aktiv ({activeOrderTicket})</strong>
          <span>Du hast bereits eine offene Online-Bestellung (Status: <strong>{activeOrderStatus}</strong>). Weitere Bestellungen bitte <strong>vor Ort an der Kasse</strong> aufgeben.</span>
          <button 
            type="button" 
            className="btn btn-secondary" 
            style={{ alignSelf: 'center', padding: '0.35rem 1rem', fontSize: '0.8rem', marginTop: '0.25rem' }}
            onClick={() => navigate(`/order/${activeOrderTicket}`)}
          >
            Zur Live-Verfolgung ➔
          </button>
        </div>
      )}

      {/* Cooldown Alert Banner */}
      {!activeOrderTicket && cooldown > 0 && (
        <div className="alert alert-error" style={{ position: 'sticky', top: '5.5rem', zIndex: 80, display: 'flex', flexDirection: 'column', gap: '0.25rem', textAlign: 'center', boxShadow: '0 4px 12px rgba(0,0,0,0.3)', marginBottom: '2rem' }}>
          <strong>Online-Bestell-Limit erreicht</strong>
          <span>Du hast bereits online bestellt. Für weitere Bestellungen komm bitte <strong>direkt vor Ort an die Kasse</strong>. (Neue Online-Bestellung in {cooldown} Min. möglich).</span>
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
              {(customizingProduct.category === 'Waffeln' 
                ? ['Puderzucker', 'Zimt-Zucker', 'Nutella'] 
                : AVAILABLE_TOPPINGS
              ).map(topping => {
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
                {(2.00 + selectedToppings.length * 0.50).toFixed(2)} €
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
                        <h4 style={{ fontSize: '1.05rem' }}>
                          {product.id === 'base-crepe' ? 'Crepe' : product.id === 'base-waffel' ? 'Waffel' : product.name}
                        </h4>
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
              {cartCount > 10 && (
                <div className="alert alert-error" style={{ fontSize: '0.85rem', padding: '0.75rem', marginBottom: '0.5rem', lineHeight: '1.4' }}>
                  ⚠️ Für Bestellungen über 10 Produkte bestelle bitte direkt vor Ort an der Kasse.
                  (Aktuell im Warenkorb: <strong>{cartCount} Produkte</strong>).
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
                <label htmlFor="cust-class">
                  Klasse / Ort (optional)
                </label>
                <input
                  id="cust-class"
                  type="text"
                  className="form-input"
                  placeholder="z.B. 10b oder Lehrerzimmer"
                  value={customerClass}
                  onChange={(e) => setCustomerClass(e.target.value)}
                  required={false}
                />
              </div>

              <div className="cart-summary" style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem', alignItems: 'stretch', width: '100%' }}>
                {loyaltyCard && (
                  <div style={{ background: "rgba(212, 175, 55, 0.08)", border: "1px solid rgba(212, 175, 55, 0.2)", padding: "0.5rem 0.75rem", borderRadius: "8px", color: "white", fontSize: "0.75rem", marginBottom: "0.5rem", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                    <span>🥞 Stempelkarte aktiv ({loyaltyCard.stamps}/5)</span>
                    {cart.reduce((sum, item) => {
                      const prod = products.find((p) => p.id === item.productId);
                      return prod && prod.category === "Crepes" ? sum + item.quantity : sum;
                    }, 0) > 0 && (
                      <span style={{ color: "var(--accent)", fontWeight: "600" }}>
                        + {cart.reduce((sum, item) => {
                          const prod = products.find((p) => p.id === item.productId);
                          return prod && prod.category === "Crepes" ? sum + item.quantity : sum;
                        }, 0)} Stempel
                      </span>
                    )}
                  </div>
                )}
                {getLoyaltyDiscount() > 0 && (
                  <>
                    <div style={{ display: "flex", justifyContent: "space-between", color: "rgba(255,255,255,0.7)", fontSize: "0.85rem" }}>
                      <span>Zwischensumme:</span>
                      <span>{getCartTotal().toFixed(2)} €</span>
                    </div>
                    <div style={{ display: "flex", justifyContent: "space-between", color: "var(--success)", fontSize: "0.85rem", fontWeight: "600" }}>
                      <span>Treue-Rabatt (Gratis-Crêpe! 🎁):</span>
                      <span>-{getLoyaltyDiscount().toFixed(2)} €</span>
                    </div>
                  </>
                )}
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", borderTop: "1px solid var(--border)", paddingTop: "0.5rem", marginTop: "0.25rem" }}>
                  <span className="cart-total-label" style={{ padding: 0 }}>Gesamtsumme:</span>
                  <span className="cart-total-value">{(getCartTotal() - getLoyaltyDiscount()).toFixed(2)} €</span>
                </div>
              </div>

              <button
                type="submit"
                className="btn btn-primary"
                disabled={submitting || cartCount > 10 || cooldown > 0 || !!activeOrderTicket}
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

      {/* Error Modal */}
      {errorMessage && (
        <div className="cart-drawer-overlay" style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', zIndex: 300 }} onClick={() => setErrorMessage(null)}>
          <div className="login-container" style={{ width: '100%', maxWidth: '420px', margin: '0 1rem', textAlign: 'center', border: '1px solid rgba(239, 68, 68, 0.2)', animation: 'bounce-in 0.3s ease-out' }} onClick={(e) => e.stopPropagation()}>
            <span style={{ fontSize: '3rem', display: 'block', marginBottom: '1rem' }}>⚠️</span>
            <h3 style={{ fontFamily: 'var(--font-display)', fontSize: '1.3rem', marginBottom: '0.75rem', color: '#ef4444' }}>
              Hinweis
            </h3>
            <p style={{ color: 'var(--text-secondary)', fontSize: '0.9rem', lineHeight: '1.5', marginBottom: '1.5rem' }}>
              {errorMessage}
            </p>
            <button className="btn btn-primary" onClick={() => setErrorMessage(null)} style={{ width: '100%', backgroundColor: '#ef4444', borderColor: '#ef4444' }}>
              Schließen
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
