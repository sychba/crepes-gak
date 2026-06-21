import { useState, useEffect, useRef } from 'react';
import { useQuery, useMutation } from "convex/react";
import { api } from "../../convex/_generated/api";

// Reusable icons
const HandoutIcon = () => (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" style={{ marginRight: '0.4rem' }}>
    <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/>
    <polyline points="22 4 12 14.01 9 11.01"/>
  </svg>
);

const TrashIcon = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
    <polyline points="3 6 5 6 21 6"/>
    <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/>
  </svg>
);

export default function Dashboard({ token }) {
  const orders = useQuery(api.orders.listAll, { password: token });
  const updateStatus = useMutation(api.orders.updateStatus);
  const deleteOrder = useMutation(api.orders.deleteOrder);

  const prevOrdersRef = useRef([]);
  const isFirstLoadRef = useRef(true);
  const [audioEnabled, setAudioEnabled] = useState(false);
  const [deleteConfirmOrder, setDeleteConfirmOrder] = useState(null);

  // Sync sound settings
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

  const initAudio = () => {
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
        });
      } else {
        setAudioEnabled(true);
      }
    } catch (e) {
      console.warn(e);
    }
  };

  // Sound: New order received (double bell tone)
  const playNewOrderSound = () => {
    try {
      if (!audioEnabled || !window.sharedAudioContext) return;
      const ctx = window.sharedAudioContext;
      
      const playTone = () => {
        const osc1 = ctx.createOscillator();
        const gain1 = ctx.createGain();
        osc1.type = 'sine';
        osc1.frequency.setValueAtTime(659.25, ctx.currentTime); // E5
        gain1.gain.setValueAtTime(0.1, ctx.currentTime);
        gain1.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.5);
        osc1.connect(gain1);
        gain1.connect(ctx.destination);
        osc1.start();
        osc1.stop(ctx.currentTime + 0.5);

        setTimeout(() => {
          const osc2 = ctx.createOscillator();
          const gain2 = ctx.createGain();
          osc2.type = 'sine';
          osc2.frequency.setValueAtTime(880.00, ctx.currentTime); // A5
          gain2.gain.setValueAtTime(0.12, ctx.currentTime);
          gain2.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.8);
          osc2.connect(gain2);
          gain2.connect(ctx.destination);
          osc2.start();
          osc2.stop(ctx.currentTime + 0.8);
        }, 120);
      };

      if (ctx.state === 'suspended') {
        ctx.resume().then(playTone);
      } else {
        playTone();
      }
    } catch (err) {
      console.warn(err);
    }
  };

  // Sound: Order is fully ready (celebratory ascending melody)
  const playOrderReadySound = () => {
    try {
      if (!audioEnabled || !window.sharedAudioContext) return;
      const ctx = window.sharedAudioContext;
      
      const playMelody = () => {
        const now = ctx.currentTime;
        const notes = [523.25, 659.25, 783.99, 1046.50]; // C5, E5, G5, C6
        notes.forEach((freq, idx) => {
          const osc = ctx.createOscillator();
          const gain = ctx.createGain();
          osc.type = 'sine';
          osc.frequency.setValueAtTime(freq, now + idx * 0.1);
          gain.gain.setValueAtTime(0.12, now + idx * 0.1);
          gain.gain.exponentialRampToValueAtTime(0.001, now + idx * 0.1 + 0.4);
          osc.connect(gain);
          gain.connect(ctx.destination);
          osc.start(now + idx * 0.1);
          osc.stop(now + idx * 0.1 + 0.4);
        });
      };

      if (ctx.state === 'suspended') {
        ctx.resume().then(playMelody);
      } else {
        playMelody();
      }
    } catch (err) {
      console.warn(err);
    }
  };

  // Play sounds on orders state changes
  useEffect(() => {
    if (orders === undefined) return;

    if (isFirstLoadRef.current) {
      isFirstLoadRef.current = false;
      prevOrdersRef.current = orders;
      return;
    }

    orders.forEach(order => {
      const prevOrder = prevOrdersRef.current.find(o => o.id === order.id);

      // Sound: Order becomes fully completed (Fertig)
      if (order.status === 'Fertig' && (!prevOrder || prevOrder.status !== 'Fertig')) {
        playOrderReadySound();
      }

      // Sound: A brand new order arrives
      if (order.status === 'Neu' && !prevOrdersRef.current.some(o => o.id === order.id)) {
        playNewOrderSound();
      }
    });

    prevOrdersRef.current = orders;
  }, [orders]);

  const handleHandoutOrder = async (orderId) => {
    try {
      await updateStatus({
        password: token,
        ticketCode: orderId,
        status: 'Ausgeliefert'
      });
    } catch (err) {
      console.error(err);
      alert('Fehler beim Ausgeben der Bestellung.');
    }
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

  if (orders === undefined) {
    return (
      <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: '50vh', flexDirection: 'column', gap: '1rem' }}>
        <div className="status-badge neu" style={{ animation: 'pulse 1.5s infinite' }}>Lade Gesamtübersicht...</div>
      </div>
    );
  }

  // Active orders (Neu, Zubereitung, Fertig)
  const activeOrders = orders.filter(o => o.status === 'Neu' || o.status === 'Zubereitung' || o.status === 'Fertig');

  return (
    <div onClick={initAudio}>
      
      {/* Alert banner if audio context is suspended */}
      {!audioEnabled && (
        <div 
          onClick={initAudio}
          style={{ 
            backgroundColor: 'rgba(245, 158, 11, 0.15)', 
            border: '1px solid #f59e0b', 
            borderRadius: '12px', 
            padding: '0.85rem 1.25rem', 
            marginBottom: '1.5rem', 
            textAlign: 'center', 
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: '0.75rem',
            color: '#f59e0b',
            fontWeight: 'bold',
            fontSize: '0.9rem'
          }}
        >
          <span>🔇 Sound ist inaktiv! Klicke hier, um Benachrichtigungen für fertige Bestellungen zu aktivieren.</span>
        </div>
      )}

      {/* Header Area */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '2rem' }}>
        <div>
          <h2 style={{ fontFamily: 'var(--font-display)', fontSize: '1.8rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            📊 Gesamtübersicht & Ausgabe
          </h2>
          <p style={{ color: 'var(--text-secondary)', fontSize: '0.9rem' }}>
            Aktive Bestellungen in der Warteschlange: <strong style={{ color: 'var(--accent)' }}>{activeOrders.length}</strong>
          </p>
        </div>
        <div style={{ display: 'flex', gap: '0.75rem' }}>
          <button className="btn btn-secondary" onClick={playOrderReadySound} style={{ fontSize: '0.8rem', padding: '0.4rem 0.8rem' }}>
            🔊 Test Fertig-Sound
          </button>
          <button className="btn btn-secondary" onClick={playNewOrderSound} style={{ fontSize: '0.8rem', padding: '0.4rem 0.8rem' }}>
            🔔 Test Neu-Sound
          </button>
        </div>
      </div>

      {/* Grid Layout of Active Orders */}
      {activeOrders.length > 0 ? (
        <div style={{ 
          display: 'grid', 
          gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))', 
          gap: '1.5rem' 
        }}>
          {activeOrders.map(order => {
            const minutes = getMinutesElapsed(order.createdAt);
            const isReady = order.status === 'Fertig';

            return (
              <div 
                key={order.id} 
                className="card"
                style={{ 
                  backgroundColor: 'var(--bg-secondary)', 
                  border: isReady ? '2px solid #10b981' : '1px solid var(--border-color)',
                  boxShadow: isReady ? '0 0 20px rgba(16, 185, 129, 0.25)' : 'none',
                  display: 'flex',
                  flexDirection: 'column',
                  borderRadius: '16px',
                  padding: '1.5rem',
                  position: 'relative',
                  transition: 'all var(--transition-normal)',
                  animation: isReady ? 'pulse 2s infinite' : 'none'
                }}
              >
                {/* Header Row of card */}
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
                  <span style={{ fontSize: '1.6rem', fontWeight: 900, fontFamily: 'var(--font-display)', color: 'var(--accent)' }}>
                    #{order.orderNumber || order.id.replace('C-', '')}
                  </span>
                  <div style={{ display: 'flex', gap: '0.4rem', alignItems: 'center' }}>
                    <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>
                      vor {minutes} Min.
                    </span>
                    <span className={`status-badge-mini ${order.type}`} style={{ fontSize: '0.7rem' }}>
                      {order.type}
                    </span>
                  </div>
                </div>

                {/* Customer Details */}
                <div style={{ marginBottom: '1.25rem', borderBottom: '1px solid rgba(255,255,255,0.06)', paddingBottom: '0.75rem' }}>
                  <div style={{ fontSize: '1.15rem', fontWeight: 700, color: 'var(--text-primary)' }}>
                    {order.customerName}
                  </div>
                  {order.customerClass && (
                    <div style={{ fontSize: '0.85rem', color: 'var(--text-secondary)' }}>
                      Klasse/Raum: <strong>{order.customerClass}</strong>
                    </div>
                  )}
                  {order.deliveryMethod === 'Lieferung' && (
                    <div style={{ fontSize: '0.8rem', color: 'var(--accent)', fontWeight: 'bold', marginTop: '0.15rem' }}>
                      🚗 LIEFERUNG
                    </div>
                  )}
                </div>

                {/* Individual Items Status List */}
                <div style={{ flexGrow: 1, display: 'flex', flexDirection: 'column', gap: '0.6rem', marginBottom: '1.5rem' }}>
                  {order.items.map((item, idx) => {
                    const itemDone = item.status === 'Fertig';
                    const itemPrep = item.status === 'Zubereitung';

                    return (
                      <div 
                        key={idx} 
                        style={{ 
                          display: 'flex', 
                          alignItems: 'center', 
                          justifyContent: 'space-between',
                          padding: '0.4rem 0.75rem',
                          backgroundColor: itemDone ? 'rgba(16, 185, 129, 0.08)' : 'rgba(255,255,255,0.02)',
                          border: `1px solid ${itemDone ? 'rgba(16, 185, 129, 0.15)' : 'transparent'}`,
                          borderRadius: '8px'
                        }}
                      >
                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                          <span style={{ fontSize: '1.1rem' }}>
                            {itemDone ? '✅' : itemPrep ? '🍳' : '⏳'}
                          </span>
                          <span style={{ 
                            fontSize: '0.92rem', 
                            color: itemDone ? 'var(--text-primary)' : 'var(--text-secondary)',
                            textDecoration: itemDone ? 'none' : 'none',
                            fontWeight: itemDone ? 'bold' : 'normal'
                          }}>
                            {item.productName}
                          </span>
                        </div>
                        <span style={{ 
                          fontSize: '0.72rem', 
                          fontWeight: 'bold',
                          color: itemDone ? '#10b981' : itemPrep ? '#fbbf24' : 'var(--text-muted)'
                        }}>
                          {itemDone ? 'FERTIG' : itemPrep ? 'BACKT' : 'NEU'}
                        </span>
                      </div>
                    );
                  })}
                </div>

                {/* Actions footer */}
                <div style={{ display: 'flex', gap: '0.5rem', marginTop: 'auto' }}>
                  <button 
                    className="btn-trash-icon" 
                    title="Bestellung löschen"
                    onClick={() => setDeleteConfirmOrder(order.id)}
                    style={{ 
                      padding: '0.6rem', 
                      borderRadius: '8px', 
                      border: '1px solid rgba(239, 68, 68, 0.2)', 
                      color: '#ef4444',
                      background: 'transparent',
                      cursor: 'pointer'
                    }}
                  >
                    <TrashIcon />
                  </button>

                  <button 
                    className="btn btn-primary"
                    onClick={() => handleHandoutOrder(order.id)}
                    style={{ 
                      flexGrow: 1, 
                      padding: '0.75rem', 
                      fontSize: '0.92rem', 
                      fontWeight: 800, 
                      display: 'flex', 
                      alignItems: 'center', 
                      justifyContent: 'center',
                      backgroundColor: isReady ? '#10b981' : 'var(--bg-tertiary)',
                      borderColor: isReady ? '#10b981' : 'var(--border-color)',
                      color: isReady ? '#000' : 'var(--text-primary)'
                    }}
                  >
                    <HandoutIcon /> {order.deliveryMethod === 'Lieferung' ? 'Geliefert ✓' : 'Ausgeben ✓'}
                  </button>
                </div>

              </div>
            );
          })}
        </div>
      ) : (
        <div 
          className="card" 
          style={{ 
            padding: '5rem 2rem', 
            textAlign: 'center', 
            background: 'var(--bg-secondary)', 
            border: '1px dashed var(--border-color)', 
            borderRadius: '16px' 
          }}
        >
          <span style={{ fontSize: '4.5rem', display: 'block', marginBottom: '1.5rem' }}>📊✨</span>
          <h2 style={{ fontSize: '1.8rem', fontFamily: 'var(--font-display)', marginBottom: '0.5rem' }}>
            Keine aktiven Bestellungen
          </h2>
          <p style={{ color: 'var(--text-secondary)', maxWidth: '400px', margin: '0 auto' }}>
            Es sind momentan keine Bestellungen in Bearbeitung. Perfekt gearbeitet!
          </p>
        </div>
      )}

      {/* Delete Confirmation Modal */}
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
              maxWidth: '400px', 
              margin: '0 1rem', 
              textAlign: 'center', 
              border: '1px solid rgba(239, 68, 68, 0.25)', 
              padding: '2rem',
              boxShadow: '0 10px 25px rgba(0,0,0,0.5)'
            }} 
            onClick={(e) => e.stopPropagation()}
          >
            <div style={{ fontSize: '3rem', marginBottom: '0.75rem' }}>🗑️</div>
            <h3 style={{ fontFamily: 'var(--font-display)', fontSize: '1.4rem', marginBottom: '0.75rem', color: '#ef4444' }}>
              Bestellung löschen?
            </h3>
            <p style={{ color: 'var(--text-secondary)', fontSize: '0.9rem', lineHeight: '1.5', marginBottom: '1.5rem' }}>
              Möchtest du diese Bestellung wirklich unwiderruflich aus dem System löschen?
            </p>
            <div style={{ display: 'flex', gap: '0.75rem' }}>
              <button 
                className="btn btn-secondary" 
                onClick={() => setDeleteConfirmOrder(null)}
                style={{ flex: 1, padding: '0.6rem' }}
              >
                Abbrechen
              </button>
              <button 
                className="btn btn-primary" 
                onClick={confirmDeleteOrder}
                style={{ flex: 1, padding: '0.6rem', backgroundColor: '#ef4444', borderColor: '#ef4444', color: '#fff', fontWeight: 800 }}
              >
                Löschen
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}
