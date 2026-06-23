import { useState, useEffect, useRef } from 'react';
import { useQuery, useMutation } from "convex/react";
import { api } from "../../convex/_generated/api";

const DeliveryIcon = () => (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" style={{ marginRight: '0.4rem' }}>
    <rect x="1" y="3" width="15" height="13" />
    <polygon points="16 8 20 8 23 11 23 16 16 16" />
    <circle cx="5.5" cy="18.5" r="2.5" />
    <circle cx="18.5" cy="18.5" r="2.5" />
  </svg>
);

const CheckIcon = () => (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" style={{ marginRight: '0.4rem' }}>
    <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14" />
    <polyline points="22 4 12 14.01 9 11.01" />
  </svg>
);

export default function Lieferungen({ token }) {
  const orders = useQuery(api.orders.listAll, { password: token });
  const updateStatus = useMutation(api.orders.updateStatus);

  const prevOrdersRef = useRef([]);
  const isFirstLoadRef = useRef(true);
  const [audioEnabled, setAudioEnabled] = useState(false);

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

  // Sound: Delivery order is fully ready (bright, dual-pitch chime)
  const playDeliveryReadySound = () => {
    try {
      if (!audioEnabled || !window.sharedAudioContext) return;
      const ctx = window.sharedAudioContext;
      
      const playTone = () => {
        const now = ctx.currentTime;
        // High pitch bells: E6 then A6
        const osc1 = ctx.createOscillator();
        const gain1 = ctx.createGain();
        osc1.type = 'sine';
        osc1.frequency.setValueAtTime(1318.51, now); // E6
        gain1.gain.setValueAtTime(0.08, now);
        gain1.gain.exponentialRampToValueAtTime(0.001, now + 0.6);
        osc1.connect(gain1);
        gain1.connect(ctx.destination);
        osc1.start();
        osc1.stop(now + 0.6);

        setTimeout(() => {
          const osc2 = ctx.createOscillator();
          const gain2 = ctx.createGain();
          osc2.type = 'sine';
          osc2.frequency.setValueAtTime(1760.00, ctx.currentTime); // A6
          gain2.gain.setValueAtTime(0.1, ctx.currentTime);
          gain2.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.9);
          osc2.connect(gain2);
          gain2.connect(ctx.destination);
          osc2.start();
          osc2.stop(ctx.currentTime + 0.9);
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

  // Sound trigger when a delivery order transitions to "Fertig"
  useEffect(() => {
    if (orders === undefined) return;

    if (isFirstLoadRef.current) {
      isFirstLoadRef.current = false;
      prevOrdersRef.current = orders;
      return;
    }

    orders.forEach(order => {
      const prevOrder = prevOrdersRef.current.find(o => o.id === order.id);

      // Only check delivery orders
      if (order.deliveryMethod === 'Lieferung') {
        // Sound: delivery order status becomes 'Fertig'
        if (order.status === 'Fertig' && (!prevOrder || prevOrder.status !== 'Fertig')) {
          playDeliveryReadySound();
        }
      }
    });

    prevOrdersRef.current = orders;
  }, [orders, audioEnabled]);

  const handleMarkAsDelivered = async (orderId) => {
    try {
      await updateStatus({
        password: token,
        ticketCode: orderId,
        status: 'Ausgeliefert'
      });
    } catch (err) {
      console.error(err);
      alert('Fehler beim Aktualisieren des Status.');
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
        <div className="status-badge neu" style={{ animation: 'pulse 1.5s infinite' }}>Lade Lieferungs-Board...</div>
      </div>
    );
  }

  // Filter only delivery orders from the last 3 hours to keep the view clean
  const threeHoursAgo = Date.now() - 3 * 60 * 60 * 1000;
  const deliveryOrders = orders.filter(o => o.deliveryMethod === 'Lieferung' && o.createdAt >= threeHoursAgo);

  // Categorize delivery orders
  const readyDeliveries = deliveryOrders.filter(o => o.status === 'Fertig');
  const preparingDeliveries = deliveryOrders.filter(o => o.status === 'Neu' || o.status === 'Zubereitung');

  return (
    <div onClick={initAudio} style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
      
      {/* Alert banner if audio context is suspended */}
      {!audioEnabled && (
        <div 
          onClick={initAudio}
          style={{ 
            backgroundColor: 'rgba(245, 158, 11, 0.15)', 
            border: '1px solid #f59e0b', 
            borderRadius: '12px', 
            padding: '0.85rem 1.25rem', 
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
          <span>🔇 Sound ist inaktiv! Klicke hier, um Audio-Benachrichtigungen für fertige Lieferungen zu aktivieren.</span>
        </div>
      )}

      {/* Header Area */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div>
          <h2 style={{ fontFamily: 'var(--font-display)', fontSize: '1.8rem', display: 'flex', alignItems: 'center', gap: '0.5rem', margin: 0 }}>
            🚚 Lieferungen-Board
          </h2>
          <p style={{ color: 'var(--text-secondary)', fontSize: '0.9rem', margin: '0.25rem 0 0 0' }}>
            Fokus-Ansicht für Liefer-Runner. Auszuliefernde Bestellungen: <strong style={{ color: 'var(--accent)' }}>{readyDeliveries.length} bereit</strong> / {preparingDeliveries.length} in Zubereitung.
          </p>
        </div>
        <div>
          <button className="btn btn-secondary" onClick={playDeliveryReadySound} style={{ fontSize: '0.8rem', padding: '0.4rem 0.8rem' }}>
            🔊 Test Liefer-Chime
          </button>
        </div>
      </div>

      {/* Columns Grid */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: '1fr 1fr',
        gap: '2rem',
        alignItems: 'start'
      }}>
        
        {/* Column 1: Ready for Delivery (Fertig) */}
        <div style={{
          backgroundColor: 'rgba(255, 255, 255, 0.02)',
          border: '1px solid rgba(255, 255, 255, 0.05)',
          borderRadius: '20px',
          padding: '1.5rem',
          minHeight: '60vh',
          display: 'flex',
          flexDirection: 'column',
          gap: '1.25rem'
        }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid rgba(255, 255, 255, 0.06)', paddingBottom: '0.75rem', marginBottom: '0.5rem' }}>
            <h3 style={{ margin: 0, fontSize: '1.2rem', color: '#10b981', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <span style={{ fontSize: '1.4rem' }}>🟢</span> Bereit zur Auslieferung ({readyDeliveries.length})
            </h3>
          </div>

          {readyDeliveries.length > 0 ? (
            readyDeliveries.map(order => (
              <div
                key={order.id}
                className="card"
                style={{
                  backgroundColor: 'var(--bg-secondary)',
                  border: '2px solid #10b981',
                  boxShadow: '0 0 20px rgba(16, 185, 129, 0.2)',
                  borderRadius: '16px',
                  padding: '1.5rem',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '1rem',
                  animation: 'pulse 2.5s infinite'
                }}
              >
                {/* Large Room highlight */}
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'start' }}>
                  <div>
                    <span style={{ 
                      fontSize: '2rem', 
                      fontWeight: 900, 
                      color: '#10b981', 
                      fontFamily: 'var(--font-display)',
                      display: 'block',
                      lineHeight: 1
                    }}>
                      {order.customerClass || "Abholung"}
                    </span>
                    <span style={{ fontSize: '1.1rem', fontWeight: 600, color: 'var(--text-primary)', marginTop: '0.25rem', display: 'block' }}>
                      {order.customerName}
                    </span>
                  </div>
                  <div style={{ textAlign: 'right' }}>
                    <span style={{ fontSize: '1.4rem', fontWeight: 800, color: 'var(--accent)', fontFamily: 'var(--font-display)' }}>
                      #{order.orderNumber || order.id.replace('C-', '')}
                    </span>
                    <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)', display: 'block' }}>
                      vor {getMinutesElapsed(order.createdAt)} Min.
                    </span>
                  </div>
                </div>

                {/* Items List */}
                <div style={{
                  backgroundColor: 'rgba(16, 185, 129, 0.06)',
                  border: '1px solid rgba(16, 185, 129, 0.15)',
                  borderRadius: '8px',
                  padding: '0.75rem 1rem',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '0.5rem'
                }}>
                  {order.items.map((item, idx) => (
                    <div key={idx} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <span style={{ color: 'var(--text-primary)', fontSize: '0.95rem', fontWeight: 'bold' }}>
                        ✓ {item.productName}
                      </span>
                      <span style={{ fontSize: '0.75rem', color: '#10b981', fontWeight: 'bold' }}>FERTIG</span>
                    </div>
                  ))}
                </div>

                {/* Big Deliver Button */}
                <button
                  className="btn btn-primary"
                  onClick={() => handleMarkAsDelivered(order.id)}
                  style={{
                    width: '100%',
                    padding: '1rem',
                    fontSize: '1.1rem',
                    fontWeight: 800,
                    backgroundColor: '#10b981',
                    borderColor: '#10b981',
                    color: '#000',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: '0.5rem',
                    borderRadius: '12px',
                    cursor: 'pointer',
                    transition: 'transform 0.1s'
                  }}
                  onMouseDown={(e) => e.currentTarget.style.transform = 'scale(0.98)'}
                  onMouseUp={(e) => e.currentTarget.style.transform = 'none'}
                >
                  <CheckIcon /> Als Geliefert markieren ✓
                </button>
              </div>
            ))
          ) : (
            <div style={{
              display: 'flex',
              flexDirection: 'column',
              justifyContent: 'center',
              alignItems: 'center',
              flexGrow: 1,
              color: 'var(--text-muted)',
              border: '2px dashed rgba(255, 255, 255, 0.05)',
              borderRadius: '16px',
              padding: '2rem',
              textAlign: 'center'
            }}>
              <span style={{ fontSize: '2.5rem', marginBottom: '0.5rem' }}>📭</span>
              <span>Momentan keine fertigen Lieferungen.</span>
            </div>
          )}
        </div>

        {/* Column 2: In Preparation (Neu / Zubereitung) */}
        <div style={{
          backgroundColor: 'rgba(255, 255, 255, 0.02)',
          border: '1px solid rgba(255, 255, 255, 0.05)',
          borderRadius: '20px',
          padding: '1.5rem',
          minHeight: '60vh',
          display: 'flex',
          flexDirection: 'column',
          gap: '1.25rem'
        }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid rgba(255, 255, 255, 0.06)', paddingBottom: '0.75rem', marginBottom: '0.5rem' }}>
            <h3 style={{ margin: 0, fontSize: '1.2rem', color: 'var(--text-secondary)', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <span style={{ fontSize: '1.4rem' }}>⏳</span> In Zubereitung ({preparingDeliveries.length})
            </h3>
          </div>

          {preparingDeliveries.length > 0 ? (
            preparingDeliveries.map(order => {
              const isZubereitung = order.status === 'Zubereitung';
              return (
                <div
                  key={order.id}
                  className="card"
                  style={{
                    backgroundColor: 'var(--bg-secondary)',
                    border: `1px solid ${isZubereitung ? 'var(--status-zubereitung)' : 'var(--border-color)'}`,
                    borderRadius: '16px',
                    padding: '1.25rem',
                    display: 'flex',
                    flexDirection: 'column',
                    gap: '0.75rem',
                    opacity: 0.85
                  }}
                >
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'start' }}>
                    <div>
                      <span style={{ 
                        fontSize: '1.3rem', 
                        fontWeight: 800, 
                        color: 'var(--text-primary)',
                        fontFamily: 'var(--font-display)' 
                      }}>
                        {order.customerClass || "Abholung"}
                      </span>
                      <span style={{ fontSize: '0.9rem', color: 'var(--text-secondary)', display: 'block' }}>
                        {order.customerName}
                      </span>
                    </div>
                    <div style={{ textAlign: 'right' }}>
                      <span style={{ fontSize: '1.1rem', fontWeight: 700, color: 'var(--accent)', fontFamily: 'var(--font-display)' }}>
                        #{order.orderNumber || order.id.replace('C-', '')}
                      </span>
                      <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)', display: 'block' }}>
                        vor {getMinutesElapsed(order.createdAt)} Min.
                      </span>
                    </div>
                  </div>

                  {/* Items breakdown */}
                  <div style={{
                    display: 'flex',
                    flexDirection: 'column',
                    gap: '0.4rem',
                    fontSize: '0.85rem'
                  }}>
                    {order.items.map((item, idx) => {
                      const isItemDone = item.status === 'Fertig';
                      const isItemPrep = item.status === 'Zubereitung';
                      return (
                        <div key={idx} style={{ 
                          display: 'flex', 
                          justifyContent: 'space-between', 
                          padding: '0.25rem 0.5rem',
                          backgroundColor: 'rgba(255,255,255,0.02)',
                          borderRadius: '6px'
                        }}>
                          <span style={{ 
                            color: isItemDone ? 'var(--text-muted)' : 'var(--text-secondary)',
                            textDecoration: isItemDone ? 'line-through' : 'none'
                          }}>
                            {isItemDone ? '✓' : '•'} {item.productName}
                          </span>
                          <span style={{ 
                            fontWeight: 'bold',
                            color: isItemDone ? '#10b981' : isItemPrep ? '#fbbf24' : 'var(--text-muted)'
                          }}>
                            {isItemDone ? 'FERTIG' : isItemPrep ? 'BACKT' : 'NEU'}
                          </span>
                        </div>
                      );
                    })}
                  </div>

                  {/* Bottom badge */}
                  <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: '0.25rem' }}>
                    <span className={`status-badge-mini ${order.status.toLowerCase()}`} style={{ fontSize: '0.7rem' }}>
                      {order.status === 'Zubereitung' ? '🍳 IN ZUBEREITUNG' : '⏳ WARTET'}
                    </span>
                  </div>
                </div>
              );
            })
          ) : (
            <div style={{
              display: 'flex',
              flexDirection: 'column',
              justifyContent: 'center',
              alignItems: 'center',
              flexGrow: 1,
              color: 'var(--text-muted)',
              border: '2px dashed rgba(255, 255, 255, 0.05)',
              borderRadius: '16px',
              padding: '2rem',
              textAlign: 'center'
            }}>
              <span>Keine Lieferungen in der Zubereitung.</span>
            </div>
          )}
        </div>

      </div>

    </div>
  );
}
