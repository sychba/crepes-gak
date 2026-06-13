import { useState, useEffect, useRef } from 'react';

export default function Kueche({ token }) {
  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const prevOrdersRef = useRef([]);

  // Synthesize a pleasant "Ding" sound for new orders using Web Audio API
  const playNewOrderSound = () => {
    try {
      const AudioContext = window.AudioContext || window.webkitAudioContext;
      if (!AudioContext) return;
      
      const ctx = new AudioContext();
      
      // Tone 1 (E5)
      const osc1 = ctx.createOscillator();
      const gain1 = ctx.createGain();
      osc1.type = 'sine';
      osc1.frequency.setValueAtTime(659.25, ctx.currentTime); // E5
      gain1.gain.setValueAtTime(0.12, ctx.currentTime);
      gain1.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.5);
      osc1.connect(gain1);
      gain1.connect(ctx.destination);
      osc1.start();
      osc1.stop(ctx.currentTime + 0.5);

      // Tone 2 (A5) slightly delayed
      setTimeout(() => {
        const osc2 = ctx.createOscillator();
        const gain2 = ctx.createGain();
        osc2.type = 'sine';
        osc2.frequency.setValueAtTime(880.00, ctx.currentTime); // A5
        gain2.gain.setValueAtTime(0.15, ctx.currentTime);
        gain2.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.8);
        osc2.connect(gain2);
        gain2.connect(ctx.destination);
        osc2.start();
        osc2.stop(ctx.currentTime + 0.8);
      }, 120);
    } catch (err) {
      console.warn('Web Audio API not allowed or supported yet:', err);
    }
  };

  const fetchOrders = (isInitial = false) => {
    fetch('/api/orders', {
      headers: {
        'Authorization': `Bearer ${token}`
      }
    })
      .then((res) => {
        if (!res.ok) throw new Error('Nicht autorisiert oder Serverfehler');
        return res.json();
      })
      .then((data) => {
        setOrders(data);
        setLoading(false);

        // Check if a new order has arrived to trigger sound alert
        if (!isInitial && prevOrdersRef.current.length > 0) {
          const newOrders = data.filter(order => 
            order.status === 'Neu' && 
            !prevOrdersRef.current.some(prevOrder => prevOrder.id === order.id)
          );
          if (newOrders.length > 0) {
            playNewOrderSound();
          }
        }

        prevOrdersRef.current = data;
      })
      .catch((err) => {
        console.error(err);
        setError('Konnte Bestellungen nicht laden.');
        setLoading(false);
      });
  };

  // Poll orders every 4 seconds
  useEffect(() => {
    fetchOrders(true);
    const intervalId = setInterval(() => fetchOrders(false), 4000);
    return () => clearInterval(intervalId);
  }, [token]);

  const handleUpdateStatus = (orderId, newStatus) => {
    fetch(`/api/orders/${orderId}/status`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`
      },
      body: JSON.stringify({ status: newStatus })
    })
      .then(res => {
        if (!res.ok) throw new Error('Statusänderung fehlgeschlagen');
        return res.json();
      })
      .then(() => {
        // Optimistic local update
        setOrders(prev => prev.map(order => 
          order.id === orderId ? { ...order, status: newStatus, updated_at: Date.now() } : order
        ));
      })
      .catch(err => {
        console.error(err);
        alert('Fehler beim Aktualisieren des Status.');
      });
  };

  const handleDeleteOrder = (orderId) => {
    if (!confirm('Möchtest du diese Bestellung wirklich löschen?')) return;

    fetch(`/api/orders/${orderId}`, {
      method: 'DELETE',
      headers: {
        'Authorization': `Bearer ${token}`
      }
    })
      .then(res => {
        if (!res.ok) throw new Error('Löschen fehlgeschlagen');
        return res.json();
      })
      .then(() => {
        setOrders(prev => prev.filter(order => order.id !== orderId));
      })
      .catch(err => {
        console.error(err);
        alert('Fehler beim Löschen der Bestellung.');
      });
  };

  // Helper: Get elapsed time in minutes
  const getMinutesElapsed = (timestamp) => {
    const diffMs = Date.now() - timestamp;
    return Math.floor(diffMs / 60000);
  };

  // Helper: get next status in flow
  const getNextStatus = (currentStatus) => {
    if (currentStatus === 'Neu') return 'Zubereitung';
    if (currentStatus === 'Zubereitung') return 'Fertig';
    if (currentStatus === 'Fertig') return 'Ausgeliefert';
    return null;
  };

  // Smart feature: Summarize ingredients/products needed for "Neu" and "Zubereitung" states
  const getBatchSummary = () => {
    const counts = {};
    orders
      .filter(order => order.status === 'Neu' || order.status === 'Zubereitung')
      .forEach(order => {
        order.items.forEach(item => {
          counts[item.product_name] = (counts[item.product_name] || 0) + item.quantity;
        });
      });
    return Object.entries(counts);
  };

  if (loading) return <div>Lade Küchenboard...</div>;
  if (error) return <div className="alert alert-error">{error}</div>;

  // Filter columns
  const ordersNeu = orders.filter(o => o.status === 'Neu');
  const ordersPrep = orders.filter(o => o.status === 'Zubereitung');
  const ordersReady = orders.filter(o => o.status === 'Fertig');
  const ordersDone = orders.filter(o => o.status === 'Ausgeliefert');

  const batchSummary = getBatchSummary();

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem' }}>
        <h2 style={{ fontFamily: 'var(--font-display)' }}>🍳 Küche (Bestellungsübersicht)</h2>
        <button 
          className="btn btn-secondary" 
          onClick={() => { fetchOrders(false); playNewOrderSound(); }} 
          style={{ fontSize: '0.85rem', padding: '0.4rem 1rem' }}
        >
          🔄 Aktualisieren & Ton testen
        </button>
      </div>

      {/* Smart Ingredient / Baking Batch Summary */}
      <div className="kitchen-batch-panel">
        <h3 className="kitchen-batch-title">
          <span>📊 Back-Zusammenfassung</span>
          <span style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', fontWeight: 400 }}>
            (Produkte in Warteschlange & Zubereitung)
          </span>
        </h3>
        {batchSummary.length === 0 ? (
          <div style={{ color: 'var(--text-muted)', fontSize: '0.9rem' }}>
            Keine ausstehenden Bestellungen. Alles abgearbeitet!
          </div>
        ) : (
          <div className="kitchen-batch-grid">
            {batchSummary.map(([name, count]) => (
              <div key={name} className="kitchen-batch-card">
                <span className="kitchen-batch-card-name">{name}</span>
                <span className="kitchen-batch-card-count">{count}</span>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Kitchen Columns Kanban Board */}
      <div className="kitchen-board">
        
        {/* Column 1: Neu (Oldest first) */}
        <div className="kitchen-column neu-col">
          <div className="kitchen-column-header">
            <span className="kitchen-column-title">📥 Neu</span>
            <span className="kitchen-column-count">{ordersNeu.length}</span>
          </div>
          {ordersNeu.map(order => {
            const minutes = getMinutesElapsed(order.created_at);
            return (
              <div key={order.id} className="kitchen-order-card">
                <span className={`kitchen-order-type ${order.type}`}>{order.type}</span>
                <div className="kitchen-order-header">
                  <span className="kitchen-order-id">{order.id}</span>
                  <span 
                    className="kitchen-order-time"
                    style={{ 
                      color: minutes >= 8 ? '#f87171' : 'var(--text-secondary)',
                      fontWeight: minutes >= 8 ? 'bold' : 'normal'
                    }}
                  >
                    vor {minutes} Min.
                  </span>
                </div>
                <div>
                  <div className="kitchen-order-customer">{order.customer_name}</div>
                  {order.customer_class && <span className="kitchen-order-class">{order.customer_class}</span>}
                </div>
                <div className="kitchen-order-items">
                  {order.items.map(item => (
                    <div key={item.id} className="kitchen-order-item">
                      <span>{item.product_name}</span>
                      <span className="kitchen-order-item-qty">x{item.quantity}</span>
                    </div>
                  ))}
                </div>
                <div className="kitchen-order-footer">
                  <button 
                    className="btn btn-danger" 
                    style={{ padding: '0.35rem 0.65rem', borderRadius: '6px' }}
                    onClick={() => handleDeleteOrder(order.id)}
                  >
                    🗑️
                  </button>
                  <button 
                    className="btn btn-primary" 
                    style={{ padding: '0.35rem 1rem', fontSize: '0.85rem', color: '#000', borderRadius: '6px' }}
                    onClick={() => handleUpdateStatus(order.id, getNextStatus(order.status))}
                  >
                    Backen ➔
                  </button>
                </div>
              </div>
            );
          })}
        </div>

        {/* Column 2: Zubereitung */}
        <div className="kitchen-column prep-col">
          <div className="kitchen-column-header">
            <span className="kitchen-column-title">🍳 Zubereitung</span>
            <span className="kitchen-column-count">{ordersPrep.length}</span>
          </div>
          {ordersPrep.map(order => (
            <div key={order.id} className="kitchen-order-card">
              <span className={`kitchen-order-type ${order.type}`}>{order.type}</span>
              <div className="kitchen-order-header">
                <span className="kitchen-order-id">{order.id}</span>
                <span className="kitchen-order-time">vor {getMinutesElapsed(order.created_at)} Min.</span>
              </div>
              <div>
                <div className="kitchen-order-customer">{order.customer_name}</div>
                {order.customer_class && <span className="kitchen-order-class">{order.customer_class}</span>}
              </div>
              <div className="kitchen-order-items">
                {order.items.map(item => (
                  <div key={item.id} className="kitchen-order-item">
                    <span>{item.product_name}</span>
                    <span className="kitchen-order-item-qty">x{item.quantity}</span>
                  </div>
                ))}
              </div>
              <div className="kitchen-order-footer">
                <button 
                  className="btn btn-secondary" 
                  style={{ padding: '0.35rem 0.65rem', borderRadius: '6px' }}
                  onClick={() => handleUpdateStatus(order.id, 'Neu')}
                >
                  ↩ Zurück
                </button>
                <button 
                  className="btn btn-primary" 
                  style={{ padding: '0.35rem 1rem', fontSize: '0.85rem', color: '#000', borderRadius: '6px' }}
                  onClick={() => handleUpdateStatus(order.id, getNextStatus(order.status))}
                >
                  Fertig ➔
                </button>
              </div>
            </div>
          ))}
        </div>

        {/* Column 3: Fertig */}
        <div className="kitchen-column ready-col">
          <div className="kitchen-column-header">
            <span className="kitchen-column-title">🔔 Abholbereit</span>
            <span className="kitchen-column-count">{ordersReady.length}</span>
          </div>
          {ordersReady.map(order => (
            <div key={order.id} className="kitchen-order-card" style={{ borderColor: 'rgba(16, 185, 129, 0.3)' }}>
              <span className={`kitchen-order-type ${order.type}`}>{order.type}</span>
              <div className="kitchen-order-header">
                <span className="kitchen-order-id" style={{ color: '#10b981' }}>{order.id}</span>
                <span className="kitchen-order-time">bereit seit {getMinutesElapsed(order.updated_at)} Min.</span>
              </div>
              <div>
                <div className="kitchen-order-customer">{order.customer_name}</div>
                {order.customer_class && <span className="kitchen-order-class">{order.customer_class}</span>}
              </div>
              <div className="kitchen-order-items">
                {order.items.map(item => (
                  <div key={item.id} className="kitchen-order-item">
                    <span>{item.product_name}</span>
                    <span className="kitchen-order-item-qty">x{item.quantity}</span>
                  </div>
                ))}
              </div>
              <div className="kitchen-order-footer">
                <button 
                  className="btn btn-secondary" 
                  style={{ padding: '0.35rem 0.65rem', borderRadius: '6px' }}
                  onClick={() => handleUpdateStatus(order.id, 'Zubereitung')}
                >
                  ↩ Zurück
                </button>
                <button 
                  className="btn btn-primary" 
                  style={{ padding: '0.35rem 1rem', fontSize: '0.85rem', color: '#000', borderRadius: '6px', backgroundColor: '#10b981' }}
                  onClick={() => handleUpdateStatus(order.id, getNextStatus(order.status))}
                >
                  Ausgeben ✓
                </button>
              </div>
            </div>
          ))}
        </div>

        {/* Column 4: Ausgeliefert */}
        <div className="kitchen-column done-col">
          <div className="kitchen-column-header">
            <span className="kitchen-column-title">✅ Ausgeliefert</span>
            <span className="kitchen-column-count">{ordersDone.length}</span>
          </div>
          {ordersDone.slice(0, 15).map(order => ( // Show last 15 delivered orders to avoid clutter
            <div key={order.id} className="kitchen-order-card" style={{ opacity: 0.6 }}>
              <span className={`kitchen-order-type ${order.type}`}>{order.type}</span>
              <div className="kitchen-order-header">
                <span className="kitchen-order-id">{order.id}</span>
                <span className="kitchen-order-time">fertig</span>
              </div>
              <div>
                <div className="kitchen-order-customer">{order.customer_name}</div>
                {order.customer_class && <span className="kitchen-order-class">{order.customer_class}</span>}
              </div>
              <div className="kitchen-order-items">
                {order.items.map(item => (
                  <div key={item.id} className="kitchen-order-item">
                    <span>{item.product_name}</span>
                    <span className="kitchen-order-item-qty">x{item.quantity}</span>
                  </div>
                ))}
              </div>
              <div className="kitchen-order-footer">
                <button 
                  className="btn btn-secondary" 
                  style={{ padding: '0.35rem 0.65rem', borderRadius: '6px', fontSize: '0.85rem' }}
                  onClick={() => handleUpdateStatus(order.id, 'Fertig')}
                >
                  Reaktivieren ↩
                </button>
              </div>
            </div>
          ))}
        </div>

      </div>
    </div>
  );
}
