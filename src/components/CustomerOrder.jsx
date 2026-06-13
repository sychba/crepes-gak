import { useState, useEffect } from 'react';

export default function CustomerOrder({ navigate }) {
  const [products, setProducts] = useState([]);
  const [cart, setCart] = useState({}); // { productId: quantity }
  const [isCartOpen, setIsCartOpen] = useState(false);
  const [customerName, setCustomerName] = useState('');
  const [customerClass, setCustomerClass] = useState('');
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState(null);

  // Fetch products on load
  useEffect(() => {
    fetch('/api/products')
      .then((res) => {
        if (!res.ok) throw new Error('Fehler beim Laden der Produkte');
        return res.json();
      })
      .then((data) => {
        setProducts(data);
        setLoading(false);
      })
      .catch((err) => {
        console.error(err);
        setError('Konnte die Produkte nicht laden. Bitte versuche es später noch einmal.');
        setLoading(false);
      });
  }, []);

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

  const getCartCount = () => {
    return Object.values(cart).reduce((sum, qty) => sum + qty, 0);
  };

  const getCartTotal = () => {
    return Object.entries(cart).reduce((sum, [productId, qty]) => {
      const prod = products.find((p) => p.id === productId);
      return sum + (prod ? prod.price * qty : 0);
    }, 0);
  };

  const handleCheckout = (e) => {
    e.preventDefault();
    if (!customerName.trim()) {
      alert('Bitte gib deinen Namen an.');
      return;
    }

    const items = Object.entries(cart).map(([productId, quantity]) => ({
      product_id: productId,
      quantity,
    }));

    if (items.length === 0) {
      alert('Dein Warenkorb ist leer.');
      return;
    }

    setSubmitting(true);

    fetch('/api/orders', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        customerName: customerName.trim(),
        customerClass: customerClass.trim(),
        type: 'online',
        items,
      }),
    })
      .then((res) => {
        if (!res.ok) throw new Error('Bestellung fehlgeschlagen');
        return res.json();
      })
      .then((order) => {
        setCart({});
        setCustomerName('');
        setCustomerClass('');
        setIsCartOpen(false);
        setSubmitting(false);
        navigate(`/order/${order.id}`);
      })
      .catch((err) => {
        console.error(err);
        alert('Fehler beim Aufgeben der Bestellung. Bitte versuche es erneut.');
        setSubmitting(false);
      });
  };

  // Group products by category
  const categories = products.reduce((acc, prod) => {
    if (!acc[prod.category]) {
      acc[prod.category] = [];
    }
    acc[prod.category].push(prod);
    return acc;
  }, {});

  if (loading) {
    return (
      <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: '60vh', flexDirection: 'column', gap: '1rem' }}>
        <div className="status-badge neu" style={{ animation: 'pulse 1.5s infinite' }}>Lade leckere Crepes...</div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="alert alert-error" style={{ maxWidth: '600px', margin: '4rem auto', textAlign: 'center' }}>
        <h3>Ups!</h3>
        <p>{error}</p>
      </div>
    );
  }

  const cartCount = getCartCount();

  return (
    <div className="main-content">
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
              return (
                <div key={product.id} className="product-card">
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
                disabled={submitting}
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
