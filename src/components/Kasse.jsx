import { useState } from 'react';
import { useQuery, useMutation } from "convex/react";
import { api } from "../../convex/_generated/api";

const AVAILABLE_TOPPINGS = [
  'Puderzucker',
  'Zimt-Zucker',
  'Nutella',
  'Käse',
  'Schinken'
];

const getFriendlyErrorMessage = (rawError) => {
  if (!rawError) return 'Ein unerwarteter Fehler ist aufgetreten. Bitte versuche es erneut.';
  
  const msg = rawError.toString();
  
  if (msg.includes('gesperrt')) {
    return 'Dieses Gerät wurde für weitere Bestellungen gesperrt. Bitte wende dich an das Personal.';
  }
  if (msg.includes('Bestell-Limit erreicht') || msg.includes('2 Bestellungen pro Stunde')) {
    return 'Bestell-Limit erreicht. Du kannst maximal 2 Bestellungen pro Stunde aufgeben.';
  }
  if (msg.includes('Maximal 10 Produkte') || msg.includes('10 Produkte pro Bestellung erlaubt')) {
    return 'Maximal 10 Produkte pro Bestellung erlaubt (Wasser ist unbegrenzt).';
  }
  if (msg.includes('Validator') || msg.includes('ArgumentValidationError') || msg.includes('extra field')) {
    return 'Server-Konfigurationsfehler: Bitte stelle sicher, dass das neueste Convex-Schema deployed ist (npx convex deploy).';
  }
  
  return msg;
};

export default function Kasse({ token }) {
  const products = useQuery(api.products.list);
  const createOrder = useMutation(api.orders.create);

  const [cart, setCart] = useState([]); // Array: [{ cartId, productId, quantity, toppings }]
  const [customerName, setCustomerName] = useState('');
  const [customerClass, setCustomerClass] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [successOrder, setSuccessOrder] = useState(null);
  const [errorMessage, setErrorMessage] = useState(null);

  // Customization modal states
  const [customizingProduct, setCustomizingProduct] = useState(null);
  const [selectedToppings, setSelectedToppings] = useState([]);

  const handleAddClick = (product) => {
    // Waffles and Crepes require toppings customization
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

  const clearCart = () => {
    setCart([]);
    setCustomerName('');
    setCustomerClass('');
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
      setErrorMessage('Bitte gib einen Kundennamen ein.');
      return;
    }

    if (cart.length === 0) {
      setErrorMessage('Der Warenkorb ist leer.');
      return;
    }

    setSubmitting(true);
    setSuccessOrder(null);

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

      const order = await createOrder({
        deviceId: 'kasse_terminal',
        customerName: customerName.trim() + ' (Vor Ort)',
        customerClass: customerClass.trim(),
        type: 'kasse',
        items,
      });

      clearTimeout(watchdog);
      setSuccessOrder(order);
      clearCart();
      setSubmitting(false);
      // Clear success banner after 8 seconds
      setTimeout(() => setSuccessOrder(null), 8000);
    } catch (err) {
      clearTimeout(watchdog);
      console.error(err);
      setErrorMessage(getFriendlyErrorMessage(err.message || err));
      setSubmitting(false);
    }
  };

  if (products === undefined) {
    return (
      <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: '40vh', flexDirection: 'column', gap: '1rem' }}>
        <div className="status-badge neu" style={{ animation: 'pulse 1.5s infinite' }}>Lade Produkte...</div>
      </div>
    );
  }

  // Filter categories. Exclude products with old IDs if any remain during transition
  const validProducts = products.filter(p => p.id !== 'crepe-nutella');

  // Group products by category
  const categories = validProducts.reduce((acc, prod) => {
    if (!acc[prod.category]) {
      acc[prod.category] = [];
    }
    acc[prod.category].push(prod);
    return acc;
  }, {});

  const nonWaterCount = cart.reduce((sum, item) => {
    return item.productId !== 'drink-wasser' ? sum + item.quantity : sum;
  }, 0);

  return (
    <div>
      <h2 style={{ marginBottom: '1.5rem', fontFamily: 'var(--font-display)' }}>💰 Kasse (Vor-Ort-Bestellung)</h2>

      {successOrder && (
        <div className="alert alert-success" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '2rem' }}>
          <div>
            <strong>Bestellung erfolgreich gebucht! Ticket-ID: {successOrder.id}</strong> ({successOrder.customerName})
          </div>
          <a href={`/order/${successOrder.id}`} target="_blank" rel="noreferrer" style={{ color: '#fff', textDecoration: 'underline', fontWeight: 600 }}>
            Beleg-Link öffnen ↗
          </a>
        </div>
      )}

      <div className="kasse-layout">
        {/* Products selection list */}
        <div className="kasse-products">
          {Object.entries(categories).map(([categoryName, catProducts]) => (
            <div key={categoryName}>
              <h3 style={{ fontSize: '1.2rem', marginBottom: '1rem', borderBottom: '1px solid var(--border-color)', paddingBottom: '0.25rem' }}>
                {categoryName}
              </h3>
              <div className="products-grid" style={{ gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))', gap: '1rem' }}>
                {catProducts.map((product) => {
                  const isCustomizable = product.id === 'base-crepe' || product.id === 'base-waffel';
                  
                  // For customizable items, we show the sum of all variations in cart
                  // For non-customizable items, there is only one entry with empty toppings
                  const countInCart = cart
                    .filter(item => item.productId === product.id)
                    .reduce((sum, item) => sum + item.quantity, 0);

                  return (
                    <div 
                      key={product.id} 
                      className={`product-card ${countInCart > 0 ? 'active-item' : ''}`}
                      style={{ 
                        minHeight: '130px', 
                        padding: '1rem',
                        borderColor: countInCart > 0 ? 'var(--accent)' : 'rgba(255,255,255,0.04)',
                        backgroundColor: countInCart > 0 ? 'rgba(245, 158, 11, 0.03)' : 'var(--bg-secondary)'
                      }}
                    >
                      <div>
                        <h4 style={{ fontSize: '1.05rem', marginBottom: '0.25rem' }}>{product.name}</h4>
                        <div style={{ color: 'var(--accent)', fontWeight: 700 }}>
                          {product.price.toFixed(2)} €
                          {isCustomizable && (
                            <span style={{ fontSize: '0.7rem', color: 'var(--text-muted)', display: 'block', fontWeight: 'normal' }}>
                              + 0.50 € je Extra
                            </span>
                          )}
                        </div>
                      </div>
                      <div className="product-footer" style={{ marginTop: '1rem' }}>
                        {isCustomizable ? (
                          <button 
                            type="button" 
                            className="btn btn-secondary" 
                            style={{ width: '100%', padding: '0.4rem', fontSize: '0.85rem' }} 
                            onClick={() => handleAddClick(product)}
                          >
                            + Hinzufügen {countInCart > 0 ? `(${countInCart})` : ''}
                          </button>
                        ) : (
                          // Non-customizable products can show directly +/- quantity control
                          countInCart > 0 ? (
                            <div className="quantity-control" style={{ width: '100%', justifyContent: 'space-between' }}>
                              <button 
                                type="button" 
                                className="quantity-btn" 
                                onClick={() => updateQuantity(product.id, -1)}
                              >
                                −
                              </button>
                              <span className="quantity-display">{countInCart}</span>
                              <button 
                                type="button" 
                                className="quantity-btn" 
                                onClick={() => updateQuantity(product.id, 1)}
                              >
                                +
                              </button>
                            </div>
                          ) : (
                            <button 
                              type="button" 
                              className="btn btn-secondary" 
                              style={{ width: '100%', padding: '0.4rem', fontSize: '0.85rem' }} 
                              onClick={() => handleAddClick(product)}
                            >
                              + Hinzufügen
                            </button>
                          )
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          ))}
        </div>

        {/* Floating Quick Order Cart Panel */}
        <div className="kasse-cart-panel">
          <h3 className="kasse-cart-title">Einkaufswagen</h3>
          
          <div style={{ flex: 1, overflowY: 'auto', marginBottom: '1rem', display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
            {cart.length === 0 ? (
              <div style={{ textAlign: 'center', color: 'var(--text-muted)', padding: '2rem 0' }}>
                Warenkorb leer. Wähle Produkte aus.
              </div>
            ) : (
              cart.map((item) => {
                const product = products.find((p) => p.id === item.productId);
                if (!product) return null;
                const toppingsPrice = item.toppings.length * 0.50;
                const unitPrice = product.price + toppingsPrice;

                return (
                  <div 
                    key={item.cartId} 
                    style={{ 
                      display: 'flex', 
                      flexDirection: 'column', 
                      gap: '0.5rem', 
                      backgroundColor: 'var(--bg-tertiary)', 
                      padding: '0.65rem 0.75rem', 
                      borderRadius: '8px' 
                    }}
                  >
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <div>
                        <div style={{ fontSize: '0.9rem', fontWeight: 600 }}>{product.name}</div>
                        <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>
                          {item.quantity}x {unitPrice.toFixed(2)} €
                        </div>
                      </div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                        <button 
                          type="button" 
                          className="quantity-btn" 
                          style={{ width: '22px', height: '22px', fontSize: '0.75rem' }}
                          onClick={() => updateQuantity(item.cartId, -1)}
                        >
                          −
                        </button>
                        <span style={{ fontWeight: 'bold', minWidth: '16px', textAlign: 'center' }}>{item.quantity}</span>
                        <button 
                          type="button" 
                          className="quantity-btn" 
                          style={{ width: '22px', height: '22px', fontSize: '0.75rem' }}
                          onClick={() => updateQuantity(item.cartId, 1)}
                        >
                          +
                        </button>
                      </div>
                    </div>
                    {item.toppings.length > 0 && (
                      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.25rem' }}>
                        {item.toppings.map(t => (
                          <span 
                            key={t} 
                            style={{ 
                              fontSize: '0.7rem', 
                              padding: '0.1rem 0.35rem', 
                              borderRadius: '4px', 
                              backgroundColor: 'rgba(245, 158, 11, 0.08)', 
                              border: '1px solid rgba(245, 158, 11, 0.15)', 
                              color: 'var(--accent)' 
                            }}
                          >
                            + {t}
                          </span>
                        ))}
                      </div>
                    )}
                  </div>
                );
              })
            )}
          </div>

          <form onSubmit={handleCheckout} style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
            {/* Product Limit Warning */}
            {nonWaterCount > 10 && (
              <div className="alert alert-error" style={{ fontSize: '0.8rem', padding: '0.75rem', marginBottom: '0.5rem', lineHeight: '1.4' }}>
                ⚠️ Maximal 10 Produkte pro Bestellung erlaubt (Wasser ist unbegrenzt). 
                Aktuell: <strong>{nonWaterCount} Produkte</strong>. 
                Bitte erstelle eine neue Bestellung.
              </div>
            )}

            <div className="form-group">
              <label>Kundenname (Schülername) *</label>
              <input
                type="text"
                className="form-input"
                placeholder="z.B. Jakob F."
                value={customerName}
                onChange={(e) => setCustomerName(e.target.value)}
                required
              />
            </div>
            
            <div className="form-group">
              <label>Klasse / Zimmer</label>
              <input
                type="text"
                className="form-input"
                placeholder="z.B. Lehrerzimmer"
                value={customerClass}
                onChange={(e) => setCustomerClass(e.target.value)}
              />
            </div>

            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderTop: '1px solid var(--border-color)', paddingTop: '0.75rem', fontSize: '1.15rem' }}>
              <strong>Gesamtsumme:</strong>
              <strong style={{ color: 'var(--accent)', fontSize: '1.35rem' }}>{getCartTotal().toFixed(2)} €</strong>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.5rem' }}>
              <button 
                type="button" 
                className="btn btn-secondary" 
                onClick={clearCart}
                disabled={cart.length === 0}
              >
                Leeren
              </button>
              <button 
                type="submit" 
                className="btn btn-primary" 
                disabled={submitting || cart.length === 0 || nonWaterCount > 10}
              >
                {submitting ? 'Buchen...' : 'Buchen'}
              </button>
            </div>
          </form>
        </div>
      </div>

      {/* Toppings Customization Modal */}
      {customizingProduct && (
        <div className="cart-drawer-overlay" style={{ display: 'flex', justifyContent: 'center', alignItems: 'center' }}>
          <div className="login-container" style={{ width: '100%', maxWidth: '460px', margin: '0 1rem', textAlign: 'left', animation: 'bounce-in 0.3s ease-out' }}>
            <h3 style={{ fontFamily: 'var(--font-display)', fontSize: '1.4rem', marginBottom: '0.5rem', color: 'var(--accent)' }}>
              ✨ {customizingProduct.name} verfeinern
            </h3>
            <p style={{ color: 'var(--text-secondary)', fontSize: '0.85rem', marginBottom: '1.5rem' }}>
              Wähle die Extras aus. Jedes Topping kostet <strong>+ 0.50 €</strong>.
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
