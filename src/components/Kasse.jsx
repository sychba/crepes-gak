import { useState } from 'react';
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
  if (msg.includes('Bestell-Limit erreicht') || msg.includes('2 Bestellungen pro Stunde')) {
    return 'Bestell-Limit erreicht. Du kannst maximal 2 Bestellungen pro Stunde aufgeben.';
  }
  if (msg.includes('Maximal 10 Produkte') || msg.includes('10 Produkte pro Bestellung erlaubt')) {
    return 'Maximal 10 Produkte pro Bestellung erlaubt.';
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
  const [deliveryMethod, setDeliveryMethod] = useState('Abholung');
  const [submitting, setSubmitting] = useState(false);
  const [successOrder, setSuccessOrder] = useState(null);
  const [errorMessage, setErrorMessage] = useState(null);

  // Customization modal states
  const [customizingProduct, setCustomizingProduct] = useState(null);
  const [selectedToppings, setSelectedToppings] = useState([]);

  // Map database items and base crepes in cart back to their UI card product IDs
  const getProductCountInCart = (productId) => {
    return cart.reduce((sum, item) => {
      // Direct product matches (Drinks, Sandwiches)
      if (item.productId === productId) {
        return sum + item.quantity;
      }
      
      // Base Crepes in cart mapped to their preset UI products
      if (item.productId === 'base-crepe') {
        const hasNutella = item.toppings.includes('Nutella');
        const hasZimt = item.toppings.includes('Zimt-Zucker');
        const hasPuder = item.toppings.includes('Puderzucker');
        const hasCheese = item.toppings.includes('Käse');
        const hasHam = item.toppings.includes('Schinken');
        const hasApfelmus = item.toppings.includes('Apfelmus');
        
        if (productId === 'crepe-plain' && item.toppings.length === 0) return sum + item.quantity;
        if (productId === 'crepe-nutella' && hasNutella && !hasCheese && !hasHam && !hasApfelmus) return sum + item.quantity;
        if (productId === 'crepe-zimt-zucker' && hasZimt) return sum + item.quantity;
        if (productId === 'crepe-puderzucker' && hasPuder) return sum + item.quantity;
        if (productId === 'crepe-kaese-schinken' && hasCheese && hasHam) return sum + item.quantity;
        if (productId === 'crepe-apfelmus' && hasApfelmus && !hasCheese && !hasHam && !hasNutella) return sum + item.quantity;
      }
      
      // Base Waffeln in cart mapped to their preset UI products
      if (item.productId === 'base-waffel') {
        const hasNutella = item.toppings.includes('Nutella');
        const hasZimt = item.toppings.includes('Zimt-Zucker');
        const hasPuder = item.toppings.includes('Puderzucker');
        const hasApfelmus = item.toppings.includes('Apfelmus');
        
        if (productId === 'waffel-plain' && item.toppings.length === 0) return sum + item.quantity;
        if (productId === 'waffel-nutella' && hasNutella && !hasApfelmus) return sum + item.quantity;
        if (productId === 'waffel-zimt-zucker' && hasZimt) return sum + item.quantity;
        if (productId === 'waffel-puderzucker' && hasPuder) return sum + item.quantity;
        if (productId === 'waffel-apfelmus' && hasApfelmus && !hasNutella) return sum + item.quantity;
      }
      
      return sum;
    }, 0);
  };

  // Tap action: Instant add standard product to cart
  const handleCardTap = (product) => {
    if (product.category === 'Crepes') {
      const defaultToppings = getDefaultToppingsForProduct(product.id);
      addToCart('base-crepe', defaultToppings);
    } else if (product.category === 'Waffeln') {
      const defaultToppings = getDefaultToppingsForProduct(product.id);
      addToCart('base-waffel', defaultToppings);
    } else {
      addToCart(product.id, []);
    }
  };

  // Open customize toppings modal
  const handleCustomizeClick = (e, product) => {
    e.stopPropagation(); // Avoid triggering standard card tap add
    setCustomizingProduct(product);
    setSelectedToppings(getDefaultToppingsForProduct(product.id));
  };

  const addToCart = (productId, toppings) => {
    setCart((prevCart) => {
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

  const clearCart = () => {
    setCart([]);
    setCustomerName('');
    setCustomerClass('');
    setDeliveryMethod('Abholung');
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
    if (cart.length === 0) {
      setErrorMessage('Der Warenkorb ist leer.');
      return;
    }

    setSubmitting(true);
    setSuccessOrder(null);

    const watchdog = setTimeout(() => {
      setErrorMessage('Die Verbindung zum Server dauert ungewöhnlich lange. Bitte vergewissere dich, dass der Server läuft.');
      setSubmitting(false);
    }, 8000);

    try {
      const items = cart.map(item => ({
        productId: item.productId,
        quantity: item.quantity,
        toppings: item.toppings
      }));

      const finalName = customerName.trim() || 'Kunde';

      const order = await createOrder({
        deviceId: 'kasse_terminal',
        customerName: finalName + ' (Vor Ort)',
        customerClass: customerClass.trim(),
        type: 'kasse',
        deliveryMethod,
        items,
      });

      clearTimeout(watchdog);
      setSuccessOrder(order);
      clearCart();
      setSubmitting(false);
      
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
        <div className="status-badge neu" style={{ animation: 'pulse 1.5s infinite' }}>Lade Kassenprodukte...</div>
      </div>
    );
  }

  // Filter out system helper items and display the sale catalog
  const saleProducts = products.filter(p => p.category !== 'System');

  // Define a logical ordering of categories for standard POS layout
  const categoryOrder = ['Crepes', 'Waffeln', 'Sandwiches', 'Getränke'];
  
  // Sort products so they flow in order of category, then by ID/price
  const sortedProducts = [...saleProducts].sort((a, b) => {
    const idxA = categoryOrder.indexOf(a.category);
    const idxB = categoryOrder.indexOf(b.category);
    if (idxA !== idxB) return idxA - idxB;
    return a.id.localeCompare(b.id);
  });

  return (
    <div>
      <h2 style={{ marginBottom: '1.5rem', fontFamily: 'var(--font-display)' }}>Kasse (Vor-Ort-Bestellung)</h2>

      {successOrder && (
        <div className="alert alert-success" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '2rem' }}>
          <div>
            <strong>Bestellung gebucht! Bestellnummer: #{successOrder.orderNumber || successOrder.id}</strong> ({successOrder.customerName})
          </div>
          <a href={`/order/${successOrder.id}`} target="_blank" rel="noreferrer" style={{ color: '#fff', textDecoration: 'underline', fontWeight: 600 }}>
            Beleg öffnen ↗
          </a>
        </div>
      )}

      <div className="kasse-layout">
        
        {/* Products Grid (POS Rapid Tapping Grid) */}
        <div className="pos-products-grid">
          {sortedProducts.map((product) => {
            const count = getProductCountInCart(product.id);
            const isCustomizableCategory = product.category === 'Crepes' || product.category === 'Waffeln';

            return (
              <div 
                key={product.id} 
                className={`pos-product-card ${count > 0 ? 'active-item' : ''}`}
                onClick={() => handleCardTap(product)}
              >
                {/* Quantity Badge in top-left */}
                {count > 0 && (
                  <span className="pos-product-qty-badge">{count}x</span>
                )}

                <div className="pos-product-header">
                  <span className="pos-product-name">{product.name}</span>
                  <span className="pos-product-price">{product.price.toFixed(2)} €</span>
                </div>

                {/* Customize button (Pencil Icon) for Crepes/Waffeln */}
                {isCustomizableCategory && (
                  <button 
                    type="button" 
                    className="pos-customize-btn" 
                    title="Toppings anpassen"
                    onClick={(e) => handleCustomizeClick(e, product)}
                  >
                    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" />
                      <path d="M18.5 2.5a2.121 2.121 0 1 1 3 3L12 15l-4 1 1-4z" />
                    </svg>
                  </button>
                )}
              </div>
            );
          })}
        </div>

        {/* Sticky Shopping Cart Column */}
        <div className="kasse-cart-panel">
          <h3 className="kasse-cart-title">Einkaufswagen</h3>
          
          <div style={{ flex: 1, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
            {cart.length === 0 ? (
              <div style={{ textAlign: 'center', color: 'var(--text-muted)', padding: '2.5rem 0', fontSize: '0.9rem' }}>
                Warenkorb leer.
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
                      gap: '0.35rem', 
                      backgroundColor: 'var(--bg-tertiary)', 
                      padding: '0.5rem 0.65rem', 
                      borderRadius: '8px' 
                    }}
                  >
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <div style={{ maxWidth: '65%' }}>
                        <div style={{ fontSize: '0.85rem', fontWeight: 700, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                          {product.id === 'base-crepe' ? 'Crepe' : product.id === 'base-waffel' ? 'Waffel' : product.name}
                        </div>
                        <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>
                          {(unitPrice * item.quantity).toFixed(2)} €
                        </div>
                      </div>
                      
                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                        <button 
                          type="button" 
                          className="quantity-btn" 
                          style={{ width: '22px', height: '22px', fontSize: '0.75rem' }}
                          onClick={() => updateQuantity(item.cartId, -1)}
                        >
                          −
                        </button>
                        <span style={{ fontWeight: 'bold', fontSize: '0.85rem', minWidth: '16px', textAlign: 'center' }}>{item.quantity}</span>
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
                              fontSize: '0.65rem', 
                              padding: '0.08rem 0.3rem', 
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

          <form onSubmit={handleCheckout} style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
            <div className="form-group">
              <label>Kundenname</label>
              <input
                type="text"
                className="form-input"
                placeholder="z.B. Jakob F. (optional)"
                value={customerName}
                onChange={(e) => setCustomerName(e.target.value)}
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

            <div className="form-group">
              <label>Lieferart</label>
              <div style={{ display: 'flex', gap: '0.5rem', marginTop: '0.25rem', marginBottom: '0.25rem' }}>
                <button
                  type="button"
                  className={`btn ${deliveryMethod === 'Abholung' ? 'btn-primary' : 'btn-secondary'}`}
                  style={{ flex: 1, padding: '0.5rem', fontSize: '0.8rem', fontWeight: 'bold' }}
                  onClick={() => setDeliveryMethod('Abholung')}
                >
                  🚶 Abholung
                </button>
                <button
                  type="button"
                  className={`btn ${deliveryMethod === 'Lieferung' ? 'btn-primary' : 'btn-secondary'}`}
                  style={{ flex: 1, padding: '0.5rem', fontSize: '0.8rem', fontWeight: 'bold' }}
                  onClick={() => setDeliveryMethod('Lieferung')}
                >
                  🚗 Lieferung
                </button>
              </div>
            </div>

            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderTop: '1px solid var(--border-color)', paddingTop: '0.5rem', fontSize: '1.05rem' }}>
              <strong>Summe:</strong>
              <strong style={{ color: 'var(--accent)', fontSize: '1.2rem' }}>{getCartTotal().toFixed(2)} €</strong>
            </div>

            <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
              {cart.length > 0 && (
                <button 
                  type="button" 
                  className="btn-trash-icon" 
                  title="Warenkorb leeren"
                  onClick={clearCart}
                  style={{ padding: '0.75rem' }}
                >
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                    <polyline points="3 6 5 6 21 6"/>
                    <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/>
                  </svg>
                </button>
              )}
              <button 
                type="submit" 
                className="btn btn-primary" 
                disabled={submitting || cart.length === 0}
                style={{ flex: 1, padding: '0.75rem', fontSize: '0.95rem', fontWeight: 800 }}
              >
                {submitting ? 'Buchen...' : 'Buchen'}
              </button>
            </div>
          </form>
        </div>
      </div>

      {/* Toppings Customization Modal */}
      {customizingProduct && (
        <div className="cart-drawer-overlay" style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', zIndex: 1000 }}>
          <div className="login-container" style={{ width: '100%', maxWidth: '440px', margin: '0 1rem', textAlign: 'left', animation: 'bounce-in 0.3s ease-out' }}>
            <h3 style={{ fontFamily: 'var(--font-display)', fontSize: '1.3rem', marginBottom: '0.5rem', color: 'var(--accent)' }}>
              ✨ Toppings anpassen: {customizingProduct.name}
            </h3>
            <p style={{ color: 'var(--text-secondary)', fontSize: '0.85rem', marginBottom: '1.25rem' }}>
              Wähle Extras. Jedes Extra kostet <strong>+ 0.50 €</strong>.
            </p>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem', marginBottom: '1.5rem' }}>
              {(customizingProduct.category === 'Waffeln' 
                ? ['Puderzucker', 'Zimt-Zucker', 'Nutella', 'Apfelmus'] 
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
                      padding: '0.65rem 0.85rem', 
                      borderRadius: '8px', 
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
                        width: '16px', 
                        height: '16px', 
                        accentColor: 'var(--accent)',
                        cursor: 'pointer'
                      }}
                    />
                    <span style={{ fontWeight: 600, fontSize: '0.9rem', color: isSelected ? 'var(--text-primary)' : 'var(--text-secondary)' }}>
                      {topping} (+ 0.50 €)
                    </span>
                  </label>
                );
              })}
            </div>

            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderTop: '1px solid var(--border-color)', paddingTop: '0.75rem', marginBottom: '1.25rem' }}>
              <span style={{ color: 'var(--text-secondary)', fontSize: '0.9rem' }}>Preis pro Stück:</span>
              <strong style={{ fontSize: '1.2rem', color: 'var(--accent)', fontFamily: 'var(--font-display)' }}>
                {(2.00 + selectedToppings.length * 0.50).toFixed(2)} €
              </strong>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem' }}>
              <button className="btn btn-secondary" onClick={() => setCustomizingProduct(null)} style={{ padding: '0.6rem' }}>
                Abbrechen
              </button>
              <button className="btn btn-primary" onClick={submitCustomization} style={{ padding: '0.6rem' }}>
                Übernehmen
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Error Modal */}
      {errorMessage && (
        <div className="cart-drawer-overlay" style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', zIndex: 1100 }} onClick={() => setErrorMessage(null)}>
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
