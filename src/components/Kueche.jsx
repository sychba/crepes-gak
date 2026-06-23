import { useState, useEffect, useRef } from 'react';
import { useQuery, useMutation } from "convex/react";
import { api } from "../../convex/_generated/api";

// Premium Inline SVGs
const InboxIcon = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" style={{ marginRight: '0.35rem' }}>
    <polyline points="22 12 16 12 14 15 10 15 8 12 2 12"/>
    <path d="M5.45 5.11L2 12v6a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2v-6l-3.45-6.89A2 2 0 0 0 16.76 4H7.24a2 2 0 0 0-1.79 1.11z"/>
  </svg>
);

const ChefIcon = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" style={{ marginRight: '0.35rem' }}>
    <path d="M6 18h12V9c0-3.3-2.7-6-6-6S6 5.7 6 9v9z"/>
    <path d="M3 21h18"/>
  </svg>
);

const BellIcon = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" style={{ marginRight: '0.35rem' }}>
    <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"/>
    <path d="M13.73 21a2 2 0 0 1-3.46 0"/>
  </svg>
);

const CheckIcon = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" style={{ marginRight: '0.35rem' }}>
    <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/>
    <polyline points="22 4 12 14.01 9 11.01"/>
  </svg>
);

export default function Kueche({ token }) {
  const orders = useQuery(api.orders.listAll, { password: token });
  const updateStatus = useMutation(api.orders.updateStatus);
  const deleteOrder = useMutation(api.orders.deleteOrder);
  
  const prevOrdersRef = useRef([]);
  const isFirstLoadRef = useRef(true);
  const [audioEnabled, setAudioEnabled] = useState(false);
  const [deleteConfirmOrder, setDeleteConfirmOrder] = useState(null);

  // Periodically verify the audio context state
  useEffect(() => {
    const checkState = () => {
      if (window.sharedAudioContext && window.sharedAudioContext.state === 'running') {
        setAudioEnabled(true);
      } else {
        setAudioEnabled(false);
      }
    };
    
    checkState();
    const interval = setInterval(checkState, 1000);
    return () => clearInterval(interval);
  }, []);

  // Initialize and auto-resume audio context on user gesture
  useEffect(() => {
    const handleGesture = () => {
      try {
        const AudioContext = window.AudioContext || window.webkitAudioContext;
        if (!AudioContext) return;
        if (!window.sharedAudioContext) {
          window.sharedAudioContext = new AudioContext();
        }
        if (window.sharedAudioContext.state === 'suspended') {
          window.sharedAudioContext.resume().then(() => {
            setAudioEnabled(true);
          });
        } else {
          setAudioEnabled(true);
        }
      } catch (e) {
        console.warn(e);
      }
    };

    window.addEventListener('click', handleGesture);
    window.addEventListener('keydown', handleGesture);
    return () => {
      window.removeEventListener('click', handleGesture);
      window.removeEventListener('keydown', handleGesture);
    };
  }, []);

  // Enable audio explicitly (via banner click)
  const enableAudio = () => {
    try {
      const AudioContext = window.AudioContext || window.webkitAudioContext;
      if (!AudioContext) return;
      if (!window.sharedAudioContext) {
        window.sharedAudioContext = new AudioContext();
      }
      const ctx = window.sharedAudioContext;
      if (ctx.state === 'suspended') {
        ctx.resume().then(() => {
          setAudioEnabled(true);
          playNewOrderSound();
        }).catch(err => {
          console.warn('Fehler beim Aktivieren des Audio-Contexts:', err);
        });
      } else {
        setAudioEnabled(true);
        playNewOrderSound();
      }
    } catch (e) {
      console.warn(e);
    }
  };

  // Synthesize a pleasant "Ding" sound for new orders using Web Audio API
  const playNewOrderSound = () => {
    try {
      const AudioContext = window.AudioContext || window.webkitAudioContext;
      if (!AudioContext) return;
      
      if (!window.sharedAudioContext) {
        window.sharedAudioContext = new AudioContext();
      }
      const ctx = window.sharedAudioContext;
      
      const playTone = () => {
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
      };

      if (ctx.state === 'suspended') {
        ctx.resume().then(() => {
          playTone();
        });
      } else {
        playTone();
      }
    } catch (err) {
      console.warn('Web Audio API not allowed or supported yet:', err);
    }
  };

  // Sound trigger on new orders in queue
  useEffect(() => {
    if (orders === undefined) return;
    
    if (isFirstLoadRef.current) {
      isFirstLoadRef.current = false;
      prevOrdersRef.current = orders;
      return;
    }

    const newOrders = orders.filter(order => 
      order.status === 'Neu' && 
      !prevOrdersRef.current.some(prevOrder => prevOrder.id === order.id)
    );
    if (newOrders.length > 0) {
      playNewOrderSound();
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

  const handleDeleteOrder = (orderId) => {
    setDeleteConfirmOrder(orderId);
  };

  const confirmDeleteOrder = async () => {
    if (!deleteConfirmOrder) return;
    const orderId = deleteConfirmOrder;
    setDeleteConfirmOrder(null);
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

  if (orders === undefined) {
    return (
      <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: '50vh', flexDirection: 'column', gap: '1rem' }}>
        <div className="status-badge neu" style={{ animation: 'pulse 1.5s infinite' }}>Lade Küchenboard...</div>
      </div>
    );
  }

  // Filter columns (only show orders from the last 45 minutes to keep the kitchen board clean and exclude stale test orders)
  const fortyFiveMinutesAgo = Date.now() - 45 * 60 * 1000;
  const recentOrders = orders.filter(o => o.createdAt >= fortyFiveMinutesAgo);

  const ordersNeu = recentOrders.filter(o => o.status === 'Neu');
  const ordersPrep = recentOrders.filter(o => o.status === 'Zubereitung');
  const ordersReady = recentOrders.filter(o => o.status === 'Fertig');
  const ordersDone = recentOrders.filter(o => o.status === 'Ausgeliefert');

  return (
    <div>
      {/* Alert banner if audio context is suspended */}
      {!audioEnabled && (
        <div 
          onClick={enableAudio}
          style={{ 
            backgroundColor: 'rgba(245, 158, 11, 0.15)', 
            border: '1px solid #f59e0b', 
            borderRadius: '12px', 
            padding: '0.85rem 1.25rem', 
            marginBottom: '1.5rem', 
            textAlign: 'center', 
            cursor: 'pointer',
            animation: 'pulse 2s infinite',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: '0.75rem',
            color: '#f59e0b',
            fontWeight: 'bold'
          }}
        >
          <span>🔇 Sound ist inaktiv! Klicke hier, um den Benachrichtigungston bei neuen Bestellungen zu aktivieren.</span>
          <button 
            className="btn btn-primary" 
            style={{ 
              fontSize: '0.75rem', 
              padding: '0.25rem 0.75rem', 
              backgroundColor: '#f59e0b', 
              borderColor: '#f59e0b', 
              color: '#000', 
              borderRadius: '6px',
              fontWeight: 800
            }}
          >
            Aktivieren
          </button>
        </div>
      )}

      {/* Küche Header Area */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem' }}>
        <h2 style={{ fontFamily: 'var(--font-display)', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
          🍳 Küche (Bestellungsübersicht)
        </h2>
        <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
          <span 
            style={{ 
              fontSize: '0.8rem', 
              color: audioEnabled ? 'var(--status-fertig)' : '#ef4444',
              backgroundColor: audioEnabled ? 'var(--status-fertig-bg)' : 'rgba(239, 68, 68, 0.12)',
              border: `1px solid ${audioEnabled ? 'rgba(16, 185, 129, 0.2)' : 'rgba(239, 68, 68, 0.2)'}`,
              padding: '0.3rem 0.75rem',
              borderRadius: '6px',
              fontWeight: 'bold',
              display: 'flex',
              alignItems: 'center',
              gap: '0.35rem'
            }}
          >
            {audioEnabled ? '🔊 Sound aktiv' : '🔇 Sound inaktiv'}
          </span>
          <button 
            className="btn btn-secondary" 
            onClick={playNewOrderSound} 
            style={{ fontSize: '0.85rem', padding: '0.4rem 1rem' }}
          >
            🔊 Ton testen
          </button>
        </div>
      </div>

      {/* Kitchen Columns Kanban Board */}
      <div className="kitchen-board">
        
        {/* Column 1: Neu */}
        <div className="kitchen-column neu-col">
          <div className="kitchen-column-header">
            <span className="kitchen-column-title">
              <InboxIcon />
              <span>Neu</span>
            </span>
            <span className="kitchen-column-count">{ordersNeu.length}</span>
          </div>
          {ordersNeu.map(order => {
            const minutes = getMinutesElapsed(order.createdAt);
            return (
              <div 
                key={order.id} 
                className={`kitchen-order-card ${order.deliveryMethod === 'Lieferung' ? 'delivery-order' : ''}`}
              >
                <div className="card-top-row">
                  <span className={`elapsed-time ${minutes >= 8 ? 'critical' : minutes >= 4 ? 'warning' : ''}`}>
                    vor {minutes} Min.
                  </span>
                  <div className="card-badges">
                    {order.deliveryMethod === 'Lieferung' && (
                      <span className="delivery-badge-mini">🚗 LIEFERUNG</span>
                    )}
                    <span className={`type-badge-mini ${order.type}`}>{order.type}</span>
                  </div>
                </div>

                <div className="card-items-compact">
                  {order.items.map((item, idx) => (
                    <div key={idx} className="card-item-row">
                      <span className="item-name-qty">
                        <strong className="item-qty">{item.quantity}x</strong> {item.productName}
                      </span>
                    </div>
                  ))}
                </div>

                <div className="card-footer-info">
                  <div className="customer-row">
                    <span className="customer-name">{order.customerName}</span>
                    <span className="ticket-code">#{order.id.replace('C-', '')}</span>
                  </div>
                  {order.customerClass && (
                    <div className={`destination-label ${order.deliveryMethod === 'Lieferung' ? 'delivery-dest' : ''}`}>
                      {order.deliveryMethod === 'Lieferung' ? `📍 Raum: ${order.customerClass}` : `Klasse/Ort: ${order.customerClass}`}
                    </div>
                  )}
                </div>

                <div className="card-actions">
                  <button 
                    className="btn-trash-icon" 
                    title="Bestellung löschen"
                    onClick={() => handleDeleteOrder(order.id)}
                  >
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                      <polyline points="3 6 5 6 21 6"/>
                      <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/>
                    </svg>
                  </button>
                  <button 
                    className="btn-action-primary" 
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
            <span className="kitchen-column-title">
              <ChefIcon />
              <span>Zubereitung</span>
            </span>
            <span className="kitchen-column-count">{ordersPrep.length}</span>
          </div>
          {ordersPrep.map(order => {
            const minutes = getMinutesElapsed(order.createdAt);
            return (
              <div 
                key={order.id} 
                className={`kitchen-order-card ${order.deliveryMethod === 'Lieferung' ? 'delivery-order' : ''}`}
              >
                <div className="card-top-row">
                  <span className={`elapsed-time ${minutes >= 8 ? 'critical' : minutes >= 4 ? 'warning' : ''}`}>
                    vor {minutes} Min.
                  </span>
                  <div className="card-badges">
                    {order.deliveryMethod === 'Lieferung' && (
                      <span className="delivery-badge-mini">🚗 LIEFERUNG</span>
                    )}
                    <span className={`type-badge-mini ${order.type}`}>{order.type}</span>
                  </div>
                </div>

                <div className="card-items-compact">
                  {order.items.map((item, idx) => (
                    <div key={idx} className="card-item-row">
                      <span className="item-name-qty">
                        <strong className="item-qty">{item.quantity}x</strong> {item.productName}
                      </span>
                    </div>
                  ))}
                </div>

                <div className="card-footer-info">
                  <div className="customer-row">
                    <span className="customer-name">{order.customerName}</span>
                    <span className="ticket-code">#{order.id.replace('C-', '')}</span>
                  </div>
                  {order.customerClass && (
                    <div className={`destination-label ${order.deliveryMethod === 'Lieferung' ? 'delivery-dest' : ''}`}>
                      {order.deliveryMethod === 'Lieferung' ? `📍 Raum: ${order.customerClass}` : `Klasse/Ort: ${order.customerClass}`}
                    </div>
                  )}
                </div>

                <div className="card-actions">
                  <button 
                    className="btn-trash-icon" 
                    title="Bestellung löschen"
                    onClick={() => handleDeleteOrder(order.id)}
                  >
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                      <polyline points="3 6 5 6 21 6"/>
                      <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/>
                    </svg>
                  </button>
                  <button 
                    className="btn-action-back" 
                    title="Zurück zu Neu"
                    onClick={() => handleUpdateStatus(order.id, 'Neu')}
                  >
                    ↩ Zurück
                  </button>
                  <button 
                    className="btn-action-primary" 
                    onClick={() => handleUpdateStatus(order.id, getNextStatus(order.status))}
                  >
                    Fertig ➔
                  </button>
                </div>
              </div>
            );
          })}
        </div>

        {/* Column 3: Abholbereit */}
        <div className="kitchen-column ready-col">
          <div className="kitchen-column-header">
            <span className="kitchen-column-title">
              <BellIcon />
              <span>Abholbereit</span>
            </span>
            <span className="kitchen-column-count">{ordersReady.length}</span>
          </div>
          {ordersReady.map(order => {
            const minutes = getMinutesElapsed(order.updatedAt);
            return (
              <div 
                key={order.id} 
                className={`kitchen-order-card ${order.deliveryMethod === 'Lieferung' ? 'delivery-order' : ''}`}
              >
                <div className="card-top-row">
                  <span className="elapsed-time">
                    bereit: {minutes} Min.
                  </span>
                  <div className="card-badges">
                    {order.deliveryMethod === 'Lieferung' && (
                      <span className="delivery-badge-mini">🚗 LIEFERUNG</span>
                    )}
                    <span className={`type-badge-mini ${order.type}`}>{order.type}</span>
                  </div>
                </div>

                <div className="card-items-compact">
                  {order.items.map((item, idx) => (
                    <div key={idx} className="card-item-row">
                      <span className="item-name-qty">
                        <strong className="item-qty">{item.quantity}x</strong> {item.productName}
                      </span>
                    </div>
                  ))}
                </div>

                <div className="card-footer-info">
                  <div className="customer-row">
                    <span className="customer-name">{order.customerName}</span>
                    <span className="ticket-code">#{order.id.replace('C-', '')}</span>
                  </div>
                  {order.customerClass && (
                    <div className={`destination-label ${order.deliveryMethod === 'Lieferung' ? 'delivery-dest' : ''}`}>
                      {order.deliveryMethod === 'Lieferung' ? `📍 Raum: ${order.customerClass}` : `Klasse/Ort: ${order.customerClass}`}
                    </div>
                  )}
                </div>

                <div className="card-actions">
                  <button 
                    className="btn-trash-icon" 
                    title="Bestellung löschen"
                    onClick={() => handleDeleteOrder(order.id)}
                  >
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                      <polyline points="3 6 5 6 21 6"/>
                      <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/>
                    </svg>
                  </button>
                  <button 
                    className="btn-action-back" 
                    title="Zurück zu Zubereitung"
                    onClick={() => handleUpdateStatus(order.id, 'Zubereitung')}
                  >
                    ↩ Zurück
                  </button>
                  <button 
                    className="btn-action-primary" 
                    style={{ backgroundColor: '#10b981' }}
                    onClick={() => handleUpdateStatus(order.id, getNextStatus(order.status))}
                  >
                    {order.deliveryMethod === 'Lieferung' ? 'Geliefert ✓' : 'Ausgeben ✓'}
                  </button>
                </div>
              </div>
            );
          })}
        </div>

        {/* Column 4: Ausgeliefert */}
        <div className="kitchen-column done-col">
          <div className="kitchen-column-header">
            <span className="kitchen-column-title">
              <CheckIcon />
              <span>Ausgeliefert</span>
            </span>
            <span className="kitchen-column-count">{ordersDone.length}</span>
          </div>
          {ordersDone.slice(0, 15).map(order => (
            <div key={order.id} className="kitchen-order-card" style={{ opacity: 0.65 }}>
              <div className="card-top-row">
                <span className="elapsed-time" style={{ color: 'var(--text-muted)' }}>
                  Erledigt
                </span>
                <div className="card-badges">
                  {order.deliveryMethod === 'Lieferung' && (
                    <span className="delivery-badge-mini" style={{ opacity: 0.6 }}>🚗 LIEFERUNG</span>
                  )}
                  <span className={`type-badge-mini ${order.type}`} style={{ opacity: 0.6 }}>{order.type}</span>
                </div>
              </div>

              <div className="card-items-compact">
                {order.items.map((item, idx) => (
                  <div key={idx} className="card-item-row" style={{ color: 'var(--text-secondary)' }}>
                    <span className="item-name-qty">
                      <strong className="item-qty" style={{ opacity: 0.6 }}>{item.quantity}x</strong> {item.productName}
                    </span>
                  </div>
                ))}
              </div>

              <div className="card-footer-info">
                <div className="customer-row">
                  <span className="customer-name" style={{ color: 'var(--text-muted)' }}>{order.customerName}</span>
                  <span className="ticket-code">#{order.id.replace('C-', '')}</span>
                </div>
                {order.customerClass && (
                  <div className="destination-label" style={{ fontSize: '0.75rem', opacity: 0.7 }}>
                    {order.deliveryMethod === 'Lieferung' ? `📍 Raum: ${order.customerClass}` : `Klasse/Ort: ${order.customerClass}`}
                  </div>
                )}
              </div>

              <div className="card-actions">
                <button 
                  className="btn-action-back" 
                  style={{ width: '100%' }}
                  onClick={() => handleUpdateStatus(order.id, 'Fertig')}
                >
                  Reaktivieren ↩
                </button>
              </div>
            </div>
          ))}
        </div>

      </div>

      {/* Custom, premium confirmation modal for deleting orders */}
      {deleteConfirmOrder && (
        <div 
          className="cart-drawer-overlay" 
          style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', zIndex: 1000 }}
          onClick={() => setDeleteConfirmOrder(null)}
        >
          <div 
            className="login-container" 
            style={{ 
              width: '100%', 
              maxWidth: '440px', 
              margin: '0 1rem', 
              textAlign: 'center', 
              border: '1px solid rgba(239, 68, 68, 0.25)', 
              animation: 'bounce-in 0.2s ease-out',
              padding: '2rem',
              boxShadow: '0 10px 25px rgba(0,0,0,0.5)'
            }} 
            onClick={(e) => e.stopPropagation()}
          >
            <div style={{ fontSize: '3rem', marginBottom: '0.75rem' }}>🗑️</div>
            <h3 style={{ fontFamily: 'var(--font-display)', fontSize: '1.5rem', marginBottom: '0.75rem', color: '#ef4444' }}>
              Bestellung löschen?
            </h3>
            <p style={{ color: 'var(--text-secondary)', fontSize: '0.95rem', lineHeight: '1.5', marginBottom: '1.75rem' }}>
              Möchtest du die Bestellung <strong style={{ color: 'var(--text-primary)' }}>{deleteConfirmOrder}</strong> wirklich löschen?
            </p>
            <div style={{ display: 'flex', gap: '0.75rem' }}>
              <button 
                className="btn btn-secondary" 
                onClick={() => setDeleteConfirmOrder(null)}
                style={{ flex: 1, padding: '0.75rem', fontSize: '0.95rem', fontWeight: 600 }}
              >
                Abbrechen
              </button>
              <button 
                className="btn btn-primary" 
                onClick={confirmDeleteOrder}
                style={{ flex: 1, padding: '0.75rem', fontSize: '0.95rem', fontWeight: 800, backgroundColor: '#ef4444', borderColor: '#ef4444', color: '#fff' }}
              >
                Ja, löschen
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}
