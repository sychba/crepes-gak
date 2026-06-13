import { useEffect, useRef } from 'react';
import { useQuery, useMutation } from "convex/react";
import { api } from "../../convex/_generated/api";

export default function Kueche({ token }) {
  const orders = useQuery(api.orders.listAll, { password: token });
  const updateStatus = useMutation(api.orders.updateStatus);
  const deleteOrder = useMutation(api.orders.deleteOrder);
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

  // Sound trigger on new orders in queue
  useEffect(() => {
    if (orders === undefined) return;
    
    if (prevOrdersRef.current.length > 0) {
      const newOrders = orders.filter(order => 
        order.status === 'Neu' && 
        !prevOrdersRef.current.some(prevOrder => prevOrder.id === order.id)
      );
      if (newOrders.length > 0) {
        playNewOrderSound();
      }
    }
    prevOrdersRef.current = orders;
  }, [orders]);

  const handleUpdateStatus = async (orderId, newStatus) => {
    try {
      await updateStatus({
        password: token,
        ticketCode: orderId,
        status: newStatus
      });
    } catch (err) {
      console.error(err);
      alert('Fehler beim Aktualisieren des Status.');
    }
  };

  const handleDeleteOrder = async (orderId) => {
    if (!confirm('Möchtest du diese Bestellung wirklich löschen?')) return;

    try {
      await deleteOrder({
        password: token,
        ticketCode: orderId
      });
    } catch (err) {
      console.error(err);
      alert('Fehler beim Löschen der Bestellung.');
    }
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
    if (!orders) return [];
    const counts = {};
    orders
      .filter(order => order.status === 'Neu' || order.status === 'Zubereitung')
      .forEach(order => {
        order.items.forEach(item => {
          counts[item.productName] = (counts[item.productName] || 0) + item.quantity;
        });
      });
    return Object.entries(counts);
  };

  if (orders === undefined) {
    return (
      <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: '50vh', flexDirection: 'column', gap: '1rem' }}>
        <div className="status-badge neu" style={{ animation: 'pulse 1.5s infinite' }}>Lade Küchenboard...</div>
      </div>
    );
  }

  // Filter columns
  const ordersNeu = orders.filter(o => o.status === 'Neu');
  const ordersPrep = orders.filter(o => o.status === 'Zubereitung');
  const ordersReady = orders.filter(o => o.status === 'Fertig');
  const ordersDone = orders.filter(o => o.status === 'Ausgeliefert');

  const batchSummary = getBatchSummary();

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem' }}>
        <h2 style={{ fontFamily: 'var(--font-display)' }}>🍳 Küche (Bestellungsübersicht - Echtzeit)</h2>
        <button 
          className="btn btn-secondary" 
          onClick={playNewOrderSound} 
          style={{ fontSize: '0.85rem', padding: '0.4rem 1rem' }}
        >
          🔊 Ton testen
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
            const minutes = getMinutesElapsed(order.createdAt);
            return (
              <div key={order.id} className="kitchen-order-card">
                <div className="kitchen-order-header">
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                    <span className="kitchen-order-id">{order.id}</span>
                    <span className={`kitchen-order-type-badge ${order.type}`}>{order.type}</span>
                  </div>
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
                  <div className="kitchen-order-customer">{order.customerName}</div>
                  {order.customerClass && <span className="kitchen-order-class">{order.customerClass}</span>}
                </div>
                <div className="kitchen-order-items">
                  {order.items.map((item, idx) => (
                    <div key={idx} className="kitchen-order-item">
                      <span>{item.productName}</span>
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
              <div className="kitchen-order-header">
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                  <span className="kitchen-order-id">{order.id}</span>
                  <span className={`kitchen-order-type-badge ${order.type}`}>{order.type}</span>
                </div>
                <span className="kitchen-order-time">vor {getMinutesElapsed(order.createdAt)} Min.</span>
              </div>
              <div>
                <div className="kitchen-order-customer">{order.customerName}</div>
                {order.customerClass && <span className="kitchen-order-class">{order.customerClass}</span>}
              </div>
              <div className="kitchen-order-items">
                {order.items.map((item, idx) => (
                  <div key={idx} className="kitchen-order-item">
                    <span>{item.productName}</span>
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
              <div className="kitchen-order-header">
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                  <span className="kitchen-order-id" style={{ color: '#10b981' }}>{order.id}</span>
                  <span className={`kitchen-order-type-badge ${order.type}`}>{order.type}</span>
                </div>
                <span className="kitchen-order-time">bereit seit {getMinutesElapsed(order.updatedAt)} Min.</span>
              </div>
              <div>
                <div className="kitchen-order-customer">{order.customerName}</div>
                {order.customerClass && <span className="kitchen-order-class">{order.customerClass}</span>}
              </div>
              <div className="kitchen-order-items">
                {order.items.map((item, idx) => (
                  <div key={idx} className="kitchen-order-item">
                    <span>{item.productName}</span>
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
              <div className="kitchen-order-header">
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                  <span className="kitchen-order-id">{order.id}</span>
                  <span className={`kitchen-order-type-badge ${order.type}`}>{order.type}</span>
                </div>
                <span className="kitchen-order-time">fertig</span>
              </div>
              <div>
                <div className="kitchen-order-customer">{order.customerName}</div>
                {order.customerClass && <span className="kitchen-order-class">{order.customerClass}</span>}
              </div>
              <div className="kitchen-order-items">
                {order.items.map((item, idx) => (
                  <div key={idx} className="kitchen-order-item">
                    <span>{item.productName}</span>
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
