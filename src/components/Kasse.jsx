import { useState } from 'react';
import { useQuery, useMutation } from "convex/react";
import { api } from "../../convex/_generated/api";

export default function Kasse({ token }) {
  const products = useQuery(api.products.list);
  const createOrder = useMutation(api.orders.create);

  const [cart, setCart] = useState({}); // { productId: quantity }
  const [customerName, setCustomerName] = useState('');
  const [customerClass, setCustomerClass] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [successOrder, setSuccessOrder] = useState(null);

  const updateQuantity = (productId, delta) => {
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

  const clearCart = () => {
    setCart({});
    setCustomerName('');
    setCustomerClass('');
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
      alert('Bitte gib einen Kundennamen ein.');
      return;
    }

    const items = Object.entries(cart).map(([productId, quantity]) => ({
      productId,
      quantity,
    }));

    if (items.length === 0) {
      alert('Der Warenkorb ist leer.');
      return;
    }

    setSubmitting(true);
    setSuccessOrder(null);

    try {
      const order = await createOrder({
        deviceId: 'kasse_terminal',
        customerName: customerName.trim() + ' (Vor Ort)',
        customerClass: customerClass.trim(),
        type: 'kasse',
        items,
      });

      setSuccessOrder(order);
      clearCart();
      setSubmitting(false);
      // Clear success banner after 8 seconds
      setTimeout(() => setSuccessOrder(null), 8000);
    } catch (err) {
      console.error(err);
      alert('Fehler beim Buchen der Bestellung.');
      setSubmitting(false);
    }
  };

  // Loading state
  if (products === undefined) return <div>Lade Produkte...</div>;

  // Group products by category
  const categories = products.reduce((acc, prod) => {
    if (!acc[prod.category]) {
      acc[prod.category] = [];
    }
    acc[prod.category].push(prod);
    return acc;
  }, {});

  return (
    <div>
      <h2 style={{ marginBottom: '1.5rem', fontFamily: 'var(--font-display)' }}>💰 Kasse (Vor-Ort-Bestellung)</h2>

      {successOrder && (
        <div className="alert alert-success" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
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
                  const qty = cart[product.id] || 0;
                  return (
                    <div 
                      key={product.id} 
                      className={`product-card ${qty > 0 ? 'active-item' : ''}`}
                      style={{ 
                        minHeight: '130px', 
                        padding: '1rem',
                        borderColor: qty > 0 ? 'var(--accent)' : 'rgba(255,255,255,0.04)',
                        backgroundColor: qty > 0 ? 'rgba(245, 158, 11, 0.03)' : 'var(--bg-secondary)'
                      }}
                    >
                      <div>
                        <h4 style={{ fontSize: '1.05rem', marginBottom: '0.25rem' }}>{product.name}</h4>
                        <div style={{ color: 'var(--accent)', fontWeight: 700 }}>{product.price.toFixed(2)} €</div>
                      </div>
                      <div className="product-footer" style={{ marginTop: '1rem' }}>
                        {qty > 0 ? (
                          <div className="quantity-control" style={{ width: '100%', justifyContent: 'space-between' }}>
                            <button type="button" className="quantity-btn" onClick={() => updateQuantity(product.id, -1)}>−</button>
                            <span className="quantity-display">{qty}</span>
                            <button type="button" className="quantity-btn" onClick={() => updateQuantity(product.id, 1)}>+</button>
                          </div>
                        ) : (
                          <button 
                            type="button" 
                            className="btn btn-secondary" 
                            style={{ width: '100%', padding: '0.4rem', fontSize: '0.85rem' }} 
                            onClick={() => updateQuantity(product.id, 1)}
                          >
                            + Hinzufügen
                          </button>
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
            {Object.keys(cart).length === 0 ? (
              <div style={{ textAlign: 'center', color: 'var(--text-muted)', padding: '2rem 0' }}>
                Warenkorb leer. Wähle Produkte aus.
              </div>
            ) : (
              Object.entries(cart).map(([productId, quantity]) => {
                const product = products.find((p) => p.id === productId);
                if (!product) return null;
                return (
                  <div key={productId} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', backgroundColor: 'var(--bg-tertiary)', padding: '0.5rem 0.75rem', borderRadius: '8px' }}>
                    <div>
                      <div style={{ fontSize: '0.9rem', fontWeight: 600 }}>{product.name}</div>
                      <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>{quantity}x {product.price.toFixed(2)} €</div>
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                      <button 
                        type="button" 
                        className="quantity-btn" 
                        style={{ width: '22px', height: '22px', fontSize: '0.75rem' }}
                        onClick={() => updateQuantity(productId, -1)}
                      >
                        −
                      </button>
                      <span style={{ fontWeight: 'bold', minWidth: '16px', textAlign: 'center' }}>{quantity}</span>
                      <button 
                        type="button" 
                        className="quantity-btn" 
                        style={{ width: '22px', height: '22px', fontSize: '0.75rem' }}
                        onClick={() => updateQuantity(productId, 1)}
                      >
                        +
                      </button>
                    </div>
                  </div>
                );
              })
            )}
          </div>

          <form onSubmit={handleCheckout} style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
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
                disabled={Object.keys(cart).length === 0}
              >
                Leeren
              </button>
              <button 
                type="submit" 
                className="btn btn-primary" 
                disabled={submitting || Object.keys(cart).length === 0}
              >
                Buchen
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}
