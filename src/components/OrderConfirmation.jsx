import { useState, useEffect } from 'react';

export default function OrderConfirmation({ orderId, navigate }) {
  const [order, setOrder] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  // Poll order details
  useEffect(() => {
    let timerId;

    const fetchOrder = () => {
      fetch(`/api/orders/${orderId}`)
        .then((res) => {
          if (!res.ok) throw new Error('Bestellung nicht gefunden');
          return res.json();
        })
        .then((data) => {
          setOrder(data);
          setLoading(false);

          // Stop polling if order is delivered
          if (data.status === 'Ausgeliefert') {
            clearInterval(timerId);
          }
        })
        .catch((err) => {
          console.error(err);
          setError('Bestellung konnte nicht geladen werden.');
          setLoading(false);
        });
    };

    fetchOrder(); // Initial fetch

    // Poll every 5 seconds
    timerId = setInterval(fetchOrder, 5000);

    return () => clearInterval(timerId);
  }, [orderId]);

  if (loading) {
    return (
      <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: '60vh', flexDirection: 'column' }}>
        <div className="status-badge neu" style={{ animation: 'pulse 1.5s infinite' }}>Lade Beleg details...</div>
      </div>
    );
  }

  if (error || !order) {
    return (
      <div className="alert alert-error" style={{ maxWidth: '500px', margin: '4rem auto', textAlign: 'center' }}>
        <h3>Fehler</h3>
        <p>{error || 'Die Bestellung konnte nicht gefunden werden.'}</p>
        <button className="btn btn-secondary" onClick={() => navigate('/')} style={{ marginTop: '1.5rem' }}>
          Zurück zur Startseite
        </button>
      </div>
    );
  }

  // Determine status description and recommendations
  let statusText = order.status;
  let statusDesc = '';
  let statusClass = 'neu';

  switch (order.status) {
    case 'Neu':
      statusClass = 'neu';
      statusDesc = 'Deine Bestellung ist eingegangen und wartet darauf, von der Küche zubereitet zu werden.';
      break;
    case 'Zubereitung':
      statusClass = 'zubereitung';
      statusDesc = 'Mmh! Dein Crepe wird jetzt frisch für dich zubereitet und gebacken.';
      break;
    case 'Fertig':
      statusClass = 'fertig';
      statusDesc = '🎉 Fertig! Bitte komm jetzt zum Crepes-Stand, bezahle bar und hole deine Bestellung ab!';
      break;
    case 'Ausgeliefert':
      statusClass = 'ausgeliefert';
      statusDesc = 'Guten Appetit! Deine Bestellung wurde abgeholt/ausgeliefert und bezahlt.';
      break;
  }

  const orderTotal = order.items.reduce((sum, item) => sum + (item.quantity * item.price_at_order), 0);

  return (
    <div className="main-content">
      <div style={{ textAlign: 'center', marginBottom: '1.5rem' }}>
        <button className="btn btn-secondary" onClick={() => navigate('/')} style={{ fontSize: '0.85rem', padding: '0.4rem 1rem' }}>
          ← Neue Bestellung aufgeben
        </button>
      </div>

      <div className="receipt-container">
        <div className="receipt-header">
          <div className="receipt-logo">🥞</div>
          <h2 style={{ fontSize: '1.5rem', fontWeight: 600, color: 'var(--text-secondary)' }}>Bestellbestätigung</h2>
          <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)', marginTop: '0.25rem' }}>
            Erstellt am {new Date(order.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })} Uhr
          </div>
          <div style={{ marginTop: '1rem' }}>
            <span className="receipt-id">{order.id}</span>
          </div>
        </div>

        {/* Live Status Tracker */}
        <div className="receipt-status-section">
          <div className="receipt-status-label">Aktueller Status</div>
          <div className={`status-badge ${statusClass}`}>{statusText}</div>
          <div className="receipt-status-desc">{statusDesc}</div>
        </div>

        {/* Customer Details */}
        <div className="receipt-details">
          <div className="receipt-details-row">
            <span className="receipt-details-label">Kunde:</span>
            <span className="receipt-details-value">{order.customer_name}</span>
          </div>
          {order.customer_class && (
            <div className="receipt-details-row">
              <span className="receipt-details-label">Klasse / Ort:</span>
              <span className="receipt-details-value">{order.customer_class}</span>
            </div>
          )}
          <div className="receipt-details-row">
            <span className="receipt-details-label">Bestellart:</span>
            <span className="receipt-details-value">{order.type === 'kasse' ? 'Vor Ort (Kasse)' : 'Online Bestellung'}</span>
          </div>
        </div>

        {/* Items List */}
        <div className="receipt-items-list">
          {order.items.map((item) => (
            <div key={item.id} className="receipt-item-row">
              <span>
                <span className="receipt-item-qty">{item.quantity}x</span>
                {item.product_name}
              </span>
              <span>{(item.price_at_order * item.quantity).toFixed(2)} €</span>
            </div>
          ))}
        </div>

        {/* Total Price */}
        <div className="receipt-total-row">
          <span style={{ fontWeight: 600 }}>Gesamtsumme:</span>
          <span style={{ fontFamily: 'var(--font-display)', fontWeight: 800, color: 'var(--accent)', fontSize: '1.65rem' }}>
            {orderTotal.toFixed(2)} €
          </span>
        </div>

        {/* Simulated QR Code for proof ("Beweis") */}
        <div style={{ textAlign: 'center', marginBottom: '1.5rem' }}>
          <div className="qr-code-placeholder">
            <div className="qr-code-canvas"></div>
            <div style={{ position: 'absolute', background: '#fff', color: '#000', fontSize: '0.65rem', fontWeight: 800, padding: '0.1rem 0.3rem', borderRadius: '4px', top: '50%', left: '50%', transform: 'translate(-50%, -50%)', border: '2px solid #fff' }}>
              CREPES
            </div>
          </div>
          <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: '0.5rem' }}>
            Zeige diese "Rechnung" bei der Kasse vor, um abzuheben.
          </div>
        </div>

        <div className="receipt-actions">
          {/* Quick share instruction */}
          <button 
            className="btn btn-secondary" 
            onClick={() => {
              navigator.clipboard.writeText(window.location.href);
              alert('Link in die Zwischenablage kopiert! Speicher diesen Link als Beleg.');
            }}
            style={{ width: '100%' }}
          >
            📋 Link kopieren (Beleg speichern)
          </button>
        </div>

        <div className="receipt-tip">
          Tipp: Du kannst ein Lesezeichen setzen, um den Status jederzeit zu prüfen.
        </div>
      </div>
    </div>
  );
}
