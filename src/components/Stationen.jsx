import { useState, useEffect, useRef } from 'react';
import { useQuery, useMutation } from "convex/react";
import { api } from "../../convex/_generated/api";

// Reusable icons
const ArrowLeftIcon = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" style={{ marginRight: '0.35rem' }}>
    <line x1="19" y1="12" x2="5" y2="12"/>
    <polyline points="12 19 5 12 12 5"/>
  </svg>
);

const PlayIcon = () => (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" style={{ marginRight: '0.5rem' }}>
    <polygon points="5 3 19 12 5 21 5 3"/>
  </svg>
);

const CheckCircleIcon = () => (
  <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" style={{ marginRight: '0.5rem' }}>
    <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/>
    <polyline points="22 4 12 14.01 9 11.01"/>
  </svg>
);

export default function Stationen({ token }) {
  const [selectedStation, setSelectedStation] = useState(null); // 'crepes', 'waffeln', 'sandwiches', 'getraenke'
  const [deviceId, setDeviceId] = useState(null);

  const orders = useQuery(api.orders.listAll, { password: token });
  const products = useQuery(api.products.list);
  const updateItemStatus = useMutation(api.orders.updateOrderItemStatus);
  const claimOrderItem = useMutation(api.orders.claimOrderItem);

  const prevTasksCountRef = useRef(0);
  const [audioEnabled, setAudioEnabled] = useState(false);
  const isClaimingRef = useRef(false);

  // Initialize unique device identifier for this tablet/browser window
  useEffect(() => {
    if (typeof window !== "undefined") {
      let id = localStorage.getItem("crepes_station_device_id");
      if (!id) {
        id = "station-" + Math.random().toString(36).substring(2, 9);
        localStorage.setItem("crepes_station_device_id", id);
      }
      setDeviceId(id);
    }
  }, []);

  // Sync sound setting and enable Web Audio context
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

  // Sound: Task done (pleasant rising double-chime)
  const playTaskDoneSound = () => {
    try {
      if (!audioEnabled || !window.sharedAudioContext) return;
      const ctx = window.sharedAudioContext;
      
      const playChime = () => {
        const now = ctx.currentTime;
        // Tone 1 (G5)
        const osc1 = ctx.createOscillator();
        const gain1 = ctx.createGain();
        osc1.type = 'sine';
        osc1.frequency.setValueAtTime(783.99, now); // G5
        gain1.gain.setValueAtTime(0.1, now);
        gain1.gain.exponentialRampToValueAtTime(0.001, now + 0.3);
        osc1.connect(gain1);
        gain1.connect(ctx.destination);
        osc1.start();
        osc1.stop(now + 0.3);

        // Tone 2 (C6) slightly delayed
        setTimeout(() => {
          const osc2 = ctx.createOscillator();
          const gain2 = ctx.createGain();
          osc2.type = 'sine';
          osc2.frequency.setValueAtTime(1046.50, ctx.currentTime); // C6
          gain2.gain.setValueAtTime(0.12, ctx.currentTime);
          gain2.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.4);
          osc2.connect(gain2);
          gain2.connect(ctx.destination);
          osc2.start();
          osc2.stop(ctx.currentTime + 0.4);
        }, 80);
      };

      if (ctx.state === 'suspended') {
        ctx.resume().then(playChime);
      } else {
        playChime();
      }
    } catch (e) {
      console.warn(e);
    }
  };

  // Sound: New task arrived (subtle soft notification)
  const playNewTaskSound = () => {
    try {
      if (!audioEnabled || !window.sharedAudioContext) return;
      const ctx = window.sharedAudioContext;
      
      const playTone = () => {
        const now = ctx.currentTime;
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.type = 'sine';
        osc.frequency.setValueAtTime(523.25, now); // C5
        gain.gain.setValueAtTime(0.08, now);
        gain.gain.exponentialRampToValueAtTime(0.001, now + 0.4);
        osc.connect(gain);
        gain.connect(ctx.destination);
        osc.start();
        osc.stop(now + 0.4);
      };

      if (ctx.state === 'suspended') {
        ctx.resume().then(playTone);
      } else {
        playTone();
      }
    } catch (e) {
      console.warn(e);
    }
  };

  // Extract ALL tasks matching the selected station
  const getTasks = () => {
    if (!orders || !products || !selectedStation) return [];

    const activeOrders = orders.filter(o => o.status !== "Ausgeliefert");
    const list = [];

    for (const order of activeOrders) {
      order.items.forEach((item, index) => {
        const prod = products.find(p => p.id === item.productId);
        const category = prod ? prod.category : "";

        let matches = false;
        if (selectedStation === 'crepes' && category === 'Crepes') matches = true;
        if (selectedStation === 'waffeln' && category === 'Waffeln') matches = true;
        if (selectedStation === 'sandwiches' && category === 'Sandwiches') matches = true;
        if (selectedStation === 'getraenke' && category === 'Getränke') matches = true;

        if (matches && item.status !== 'Fertig') {
          list.push({
            orderId: order.id,
            orderNumber: order.orderNumber,
            customerName: order.customerName,
            customerClass: order.customerClass,
            createdAt: order.createdAt,
            itemIndex: index,
            productId: item.productId,
            productName: item.productName,
            toppings: item.toppings || [],
            status: item.status || "Neu",
            assignedTo: item.assignedTo,
          });
        }
      });
    }

    // Sort tasks oldest first (by order creation time)
    return list.sort((a, b) => a.createdAt - b.createdAt);
  };

  const allTasks = getTasks();

  // Find task assigned to this device, if any
  const currentTask = allTasks.find(t => t.assignedTo === deviceId);

  // Unassigned tasks (available for claiming)
  const unassignedTasks = allTasks.filter(t => !t.assignedTo);

  // Upcoming queue preview (all items that are not assigned to me)
  const upcomingTasks = allTasks.filter(t => t.assignedTo !== deviceId);

  // Play sound when new tasks are added to the station
  useEffect(() => {
    if (selectedStation && allTasks.length > prevTasksCountRef.current) {
      playNewTaskSound();
    }
    prevTasksCountRef.current = allTasks.length;
  }, [allTasks.length, selectedStation]);

  // AUTO-CLAIMING LOGIC: Claim the oldest unassigned task when idle
  useEffect(() => {
    if (!selectedStation || !deviceId || !orders || !products) return;

    // If we already have an active task, we don't claim another one
    if (currentTask) {
      isClaimingRef.current = false;
      return;
    }

    // If we are idle, claim the oldest unassigned task
    if (!isClaimingRef.current && unassignedTasks.length > 0) {
      const oldestUnassigned = unassignedTasks[0];
      isClaimingRef.current = true;

      claimOrderItem({
        password: token,
        ticketCode: oldestUnassigned.orderId,
        itemIndex: oldestUnassigned.itemIndex,
        deviceId: deviceId
      })
      .catch(err => {
        console.warn("Could not claim task:", err);
      })
      .finally(() => {
        isClaimingRef.current = false;
      });
    }
  }, [allTasks, deviceId, selectedStation, orders, products, currentTask, unassignedTasks]);

  const handleUpdateItemStatus = async (task, newStatus) => {
    try {
      await updateItemStatus({
        password: token,
        ticketCode: task.orderId,
        itemIndex: task.itemIndex,
        status: newStatus
      });
      if (newStatus === "Fertig") {
        playTaskDoneSound();
      }
    } catch (err) {
      console.error(err);
      alert("Fehler beim Aktualisieren der Stationstask.");
    }
  };

  // 1. Station Selector UI
  if (!selectedStation) {
    return (
      <div style={{ maxWidth: '800px', margin: '2rem auto' }} onClick={initAudio}>
        <div style={{ textAlign: 'center', marginBottom: '2.5rem' }}>
          <h2 style={{ fontSize: '2.2rem', fontFamily: 'var(--font-display)', marginBottom: '0.5rem' }}>
            🖥️ Station auswählen
          </h2>
          <p style={{ color: 'var(--text-secondary)' }}>
            Wähle dein Waffeleisen / Arbeitsplatz aus, um die zugehörigen Aufgaben einzeln zu sehen.
          </p>
        </div>

        <div style={{ 
          display: 'grid', 
          gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', 
          gap: '1.25rem' 
        }}>
          <button 
            className="card" 
            onClick={() => setSelectedStation('crepes')}
            style={{ 
              display: 'flex', 
              flexDirection: 'column', 
              alignItems: 'center', 
              gap: '1rem', 
              padding: '2.5rem', 
              cursor: 'pointer',
              border: '1px solid var(--border-color)',
              background: 'var(--bg-secondary)',
              textAlign: 'center'
            }}
          >
            <span style={{ fontSize: '3.5rem' }}>🥞</span>
            <h3 style={{ fontFamily: 'var(--font-display)', fontSize: '1.4rem' }}>Crêpes-Eisen</h3>
            <span className="status-badge zubereitung" style={{ fontSize: '0.8rem' }}>
              Crepe-Kategorie
            </span>
          </button>

          <button 
            className="card" 
            onClick={() => setSelectedStation('waffeln')}
            style={{ 
              display: 'flex', 
              flexDirection: 'column', 
              alignItems: 'center', 
              gap: '1rem', 
              padding: '2.5rem', 
              cursor: 'pointer',
              border: '1px solid var(--border-color)',
              background: 'var(--bg-secondary)',
              textAlign: 'center'
            }}
          >
            <span style={{ fontSize: '3.5rem' }}>🧇</span>
            <h3 style={{ fontFamily: 'var(--font-display)', fontSize: '1.4rem' }}>Waffel-Eisen</h3>
            <span className="status-badge zubereitung" style={{ fontSize: '0.8rem' }}>
              Waffel-Kategorie
            </span>
          </button>

          <button 
            className="card" 
            onClick={() => setSelectedStation('sandwiches')}
            style={{ 
              display: 'flex', 
              flexDirection: 'column', 
              alignItems: 'center', 
              gap: '1rem', 
              padding: '2.5rem', 
              cursor: 'pointer',
              border: '1px solid var(--border-color)',
              background: 'var(--bg-secondary)',
              textAlign: 'center'
            }}
          >
            <span style={{ fontSize: '3.5rem' }}>🥪</span>
            <h3 style={{ fontFamily: 'var(--font-display)', fontSize: '1.4rem' }}>Sandwich-Toast</h3>
            <span className="status-badge zubereitung" style={{ fontSize: '0.8rem' }}>
              Sandwich-Kategorie
            </span>
          </button>

          <button 
            className="card" 
            onClick={() => setSelectedStation('getraenke')}
            style={{ 
              display: 'flex', 
              flexDirection: 'column', 
              alignItems: 'center', 
              gap: '1rem', 
              padding: '2.5rem', 
              cursor: 'pointer',
              border: '1px solid var(--border-color)',
              background: 'var(--bg-secondary)',
              textAlign: 'center'
            }}
          >
            <span style={{ fontSize: '3.5rem' }}>🥤</span>
            <h3 style={{ fontFamily: 'var(--font-display)', fontSize: '1.4rem' }}>Getränke</h3>
            <span className="status-badge zubereitung" style={{ fontSize: '0.8rem' }}>
              Getränke-Kategorie
            </span>
          </button>
        </div>
      </div>
    );
  }

  const getStationLabel = () => {
    if (selectedStation === 'crepes') return '🥞 Crêpes-Eisen';
    if (selectedStation === 'waffeln') return '🧇 Waffel-Eisen';
    if (selectedStation === 'sandwiches') return '🥪 Sandwich-Toast';
    return '🥤 Getränke-Ausgabe';
  };

  return (
    <div style={{ maxWidth: '750px', margin: '0 auto' }} onClick={initAudio}>
      
      {/* Audio Setup Banner */}
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
          <span>🔇 Sound ist inaktiv! Klicke hier, um akustische Signale bei neuen Tasks zu aktivieren.</span>
        </div>
      )}

      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '2rem' }}>
        <div>
          <h2 style={{ fontFamily: 'var(--font-display)', fontSize: '1.8rem', display: 'flex', alignItems: 'center' }}>
            {getStationLabel()}
          </h2>
          <p style={{ color: 'var(--text-secondary)', fontSize: '0.9rem' }}>
            Deine ID: <code style={{ color: 'var(--accent)' }}>{deviceId ? deviceId.replace('station-', '') : ''}</code> | Station-Tasks: <strong style={{ color: 'var(--accent)' }}>{unassignedTasks.length} offen</strong> (+ {allTasks.length - unassignedTasks.length} in Arbeit)
          </p>
        </div>
        <button 
          className="btn btn-secondary" 
          onClick={() => setSelectedStation(null)}
          style={{ fontSize: '0.85rem', padding: '0.5rem 1rem' }}
        >
          <ArrowLeftIcon /> Station wechseln
        </button>
      </div>

      {/* 2. Main Active Task Card */}
      {currentTask ? (
        <div 
          className="card" 
          style={{ 
            padding: '2.5rem', 
            background: 'var(--bg-secondary)', 
            border: currentTask.status === 'Zubereitung' ? '2px solid var(--accent)' : '1px solid var(--border-color)',
            boxShadow: currentTask.status === 'Zubereitung' ? '0 0 20px var(--accent-glow)' : 'none',
            borderRadius: '16px',
            marginBottom: '2rem',
            transition: 'all var(--transition-normal)',
            position: 'relative'
          }}
        >
          {/* Top Status */}
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem' }}>
            <span style={{ fontSize: '0.9rem', color: 'var(--text-muted)', fontWeight: 600 }}>
              DEINE RESERVIERTE AUFGABE
            </span>
            <span className="status-badge zubereitung" style={{ fontWeight: 'bold' }}>
              🔥 In Zubereitung
            </span>
          </div>

          {/* Customer Metadata info */}
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', borderBottom: '1px solid rgba(255,255,255,0.06)', paddingBottom: '1rem', marginBottom: '1.5rem' }}>
            <div>
              <div style={{ fontSize: '1.6rem', fontWeight: 800, fontFamily: 'var(--font-display)' }}>
                {currentTask.customerName}
              </div>
              {currentTask.customerClass && (
                <div style={{ color: 'var(--text-secondary)', fontSize: '0.95rem', marginTop: '0.15rem' }}>
                  Klasse/Ort: <strong>{currentTask.customerClass}</strong>
                </div>
              )}
            </div>
            
            <div style={{ textAlign: 'right' }}>
              <div style={{ fontSize: '1.8rem', fontWeight: 900, color: 'var(--accent)', fontFamily: 'var(--font-display)' }}>
                Bestell-Nr. #{currentTask.orderNumber || currentTask.orderId.replace('C-', '')}
              </div>
            </div>
          </div>

          {/* Product and Toppings details */}
          <div style={{ marginBottom: '2.5rem' }}>
            <h1 style={{ fontSize: '2.8rem', lineHeight: '1.2', fontWeight: 800, color: 'var(--text-primary)', marginBottom: '0.75rem', fontFamily: 'var(--font-display)' }}>
              {currentTask.productName.split('(')[0].trim()}
            </h1>

            {/* Toppings pills */}
            {currentTask.toppings && currentTask.toppings.length > 0 ? (
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.5rem', marginTop: '1rem' }}>
                {currentTask.toppings.map((top, tIdx) => (
                  <span 
                    key={tIdx} 
                    style={{ 
                      backgroundColor: 'var(--bg-tertiary)', 
                      color: 'var(--accent)', 
                      border: '1px solid rgba(245, 158, 11, 0.3)',
                      padding: '0.4rem 0.85rem', 
                      borderRadius: '30px', 
                      fontSize: '0.95rem',
                      fontWeight: 700,
                      letterSpacing: '0.02em'
                    }}
                  >
                    + {top}
                  </span>
                ))}
              </div>
            ) : (
              <div style={{ color: 'var(--text-muted)', fontSize: '0.95rem', fontStyle: 'italic', marginTop: '0.5rem' }}>
                Keine extra Toppings
              </div>
            )}
          </div>

          {/* Interaction Buttons */}
          <div style={{ display: 'flex', gap: '1rem', marginTop: '1.5rem' }}>
            <button 
              className="btn btn-secondary" 
              onClick={() => handleUpdateItemStatus(currentTask, 'Neu')}
              style={{ flex: 1, padding: '1.2rem', fontSize: '1.1rem', fontWeight: 700 }}
            >
              ↩ Abgeben (Freigeben)
            </button>
            <button 
              className="btn btn-primary" 
              onClick={() => handleUpdateItemStatus(currentTask, 'Fertig')}
              style={{ 
                flex: 2, 
                padding: '1.2rem', 
                fontSize: '1.2rem', 
                fontWeight: 900, 
                display: 'flex', 
                alignItems: 'center', 
                justifyContent: 'center', 
                backgroundColor: '#10b981', 
                borderColor: '#10b981',
                animation: 'pulse 1.5s infinite' 
              }}
            >
              <CheckCircleIcon /> FERTIG & NÄCHSTES
            </button>
          </div>

        </div>
      ) : (
        /* 3. Empty Queue state */
        <div 
          className="card" 
          style={{ 
            padding: '4rem 2rem', 
            textAlign: 'center', 
            background: 'var(--bg-secondary)', 
            border: '1px dashed var(--border-color)', 
            borderRadius: '16px' 
          }}
        >
          <span style={{ fontSize: '4.5rem', display: 'block', marginBottom: '1.5rem' }}>🥞✨</span>
          <h2 style={{ fontSize: '1.8rem', fontFamily: 'var(--font-display)', marginBottom: '0.5rem' }}>
            Alles erledigt!
          </h2>
          <p style={{ color: 'var(--text-secondary)', maxWidth: '400px', margin: '0 auto' }}>
            Es gibt aktuell keine unverteilten Aufgaben für diese Station. Entspanne dich kurz!
          </p>
        </div>
      )}

      {/* 4. Upcoming Queue Preview */}
      {upcomingTasks.length > 0 && (
        <div style={{ marginTop: '2.5rem' }}>
          <h3 style={{ fontFamily: 'var(--font-display)', fontSize: '1.2rem', color: 'var(--text-secondary)', marginBottom: '1rem' }}>
            Warteschlange dieser Station ({upcomingTasks.length})
          </h3>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
            {upcomingTasks.slice(0, 5).map((task, idx) => {
              const isAssignedToOther = task.assignedTo && task.assignedTo !== deviceId;
              
              return (
                <div 
                  key={idx} 
                  style={{ 
                    display: 'flex', 
                    justifyContent: 'space-between', 
                    alignItems: 'center', 
                    padding: '1rem 1.25rem', 
                    backgroundColor: 'var(--bg-secondary)', 
                    border: isAssignedToOther ? '1px solid rgba(255,255,255,0.03)' : '1px solid var(--border-color)', 
                    borderRadius: '10px',
                    opacity: isAssignedToOther ? 0.5 : 1
                  }}
                >
                  <div>
                    <strong style={{ color: 'var(--text-primary)', fontSize: '1.05rem' }}>
                      {task.productName.split('(')[0].trim()}
                    </strong>
                    {task.toppings && task.toppings.length > 0 && (
                      <span style={{ color: 'var(--accent)', fontSize: '0.85rem', marginLeft: '0.5rem', fontWeight: 600 }}>
                        (+ {task.toppings.join(', ')})
                      </span>
                    )}
                    <div style={{ color: 'var(--text-secondary)', fontSize: '0.8rem', marginTop: '0.15rem' }}>
                      Kunde: {task.customerName} {task.customerClass ? `| Ort: ${task.customerClass}` : ''}
                    </div>
                  </div>
                  <div style={{ textAlign: 'right' }}>
                    <span style={{ fontWeight: 800, color: 'var(--text-muted)', fontSize: '0.95rem' }}>
                      #{task.orderNumber || task.orderId.replace('C-', '')}
                    </span>
                    <div style={{ 
                      fontSize: '0.75rem', 
                      color: isAssignedToOther ? 'var(--status-zubereitung)' : 'var(--text-muted)', 
                      fontWeight: 'bold' 
                    }}>
                      {isAssignedToOther ? '🔥 Backt an anderem Eisen' : '⏳ Wartet'}
                    </div>
                  </div>
                </div>
              );
            })}
            {upcomingTasks.length > 5 && (
              <div style={{ textAlign: 'center', color: 'var(--text-muted)', fontSize: '0.85rem', marginTop: '0.25rem' }}>
                ...und {upcomingTasks.length - 5} weitere Aufgaben
              </div>
            )}
          </div>
        </div>
      )}

    </div>
  );
}
