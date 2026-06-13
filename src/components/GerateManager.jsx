import { useQuery, useMutation } from "convex/react";
import { api } from "../../convex/_generated/api";

export default function GerateManager({ token }) {
  const devices = useQuery(api.orders.listDevices, { password: token });
  const toggleBlock = useMutation(api.orders.toggleDeviceBlock);

  const handleToggleBlock = async (deviceId, currentBlocked) => {
    const shouldBlock = !currentBlocked;
    const confirmMessage = shouldBlock 
      ? `Möchtest du das Gerät "${deviceId}" wirklich sperren? Der Nutzer kann dann keine Bestellungen mehr aufgeben.`
      : `Möchtest du das Gerät "${deviceId}" wieder entsperren?`;

    if (!confirm(confirmMessage)) return;

    try {
      await toggleBlock({
        password: token,
        deviceId,
        blocked: shouldBlock
      });
    } catch (err) {
      console.error(err);
      alert('Fehler beim Ändern des Blockier-Status.');
    }
  };

  if (devices === undefined) {
    return (
      <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: '40vh', flexDirection: 'column', gap: '1rem' }}>
        <div className="status-badge neu" style={{ animation: 'pulse 1.5s infinite' }}>Lade Gerätedaten...</div>
      </div>
    );
  }

  return (
    <div>
      <h2 style={{ marginBottom: '1.5rem', fontFamily: 'var(--font-display)' }}>📱 Geräte-Manager (Moderation & Anti-Spam)</h2>
      <p style={{ color: 'var(--text-secondary)', marginBottom: '2rem', fontSize: '0.9rem' }}>
        Hier siehst du alle Geräte, die über diesen Browser bestellt haben. Du kannst spammer blockieren oder sperren.
      </p>

      {devices.length === 0 ? (
        <div style={{ textAlign: 'center', color: 'var(--text-muted)', padding: '3rem 0' }}>
          Keine Geräte registriert. Es wurden noch keine Bestellungen aufgegeben.
        </div>
      ) : (
        <div style={{ overflowX: 'auto', backgroundColor: 'var(--bg-secondary)', borderRadius: '16px', border: '1px solid rgba(255,255,255,0.04)', padding: '1rem' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '0.9rem' }}>
            <thead>
              <tr style={{ borderBottom: '1px solid var(--border-color)', color: 'var(--text-secondary)' }}>
                <th style={{ padding: '0.75rem 1rem' }}>Geräte-ID</th>
                <th style={{ padding: '0.75rem 1rem' }}>Kunde(n)</th>
                <th style={{ padding: '0.75rem 1rem', textAlign: 'center' }}>Bestellungen</th>
                <th style={{ padding: '0.75rem 1rem' }}>Letzte Aktivität</th>
                <th style={{ padding: '0.75rem 1rem', textAlign: 'center' }}>Status</th>
                <th style={{ padding: '0.75rem 1rem', textAlign: 'right' }}>Aktionen</th>
              </tr>
            </thead>
            <tbody>
              {devices.map((device) => {
                const formattedTime = device.lastOrderAt > 0
                  ? new Date(device.lastOrderAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) + ' Uhr'
                  : 'Nie';
                
                return (
                  <tr key={device.deviceId} style={{ borderBottom: '1px solid rgba(255,255,255,0.02)', verticalAlign: 'middle' }}>
                    <td style={{ padding: '1rem', fontFamily: 'monospace', color: 'var(--accent)' }}>
                      {device.deviceId.substring(0, 12)}...
                    </td>
                    <td style={{ padding: '1rem', color: 'var(--text-primary)', maxWidth: '250px', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                      {device.customerNames}
                    </td>
                    <td style={{ padding: '1rem', textAlign: 'center', fontWeight: 'bold' }}>
                      {device.orderCount}
                    </td>
                    <td style={{ padding: '1rem', color: 'var(--text-muted)' }}>
                      {formattedTime}
                    </td>
                    <td style={{ padding: '1rem', textAlign: 'center' }}>
                      {device.blocked ? (
                        <span className="status-badge ausgeliefert" style={{ fontSize: '0.75rem', padding: '0.15rem 0.6rem', color: '#ef4444', backgroundColor: 'rgba(239, 68, 68, 0.15)', border: '1px solid rgba(239, 68, 68, 0.2)' }}>
                          Gesperrt
                        </span>
                      ) : (
                        <span className="status-badge fertig" style={{ fontSize: '0.75rem', padding: '0.15rem 0.6rem', animation: 'none' }}>
                          Aktiv
                        </span>
                      )}
                    </td>
                    <td style={{ padding: '1rem', textAlign: 'right' }}>
                      {device.blocked ? (
                        <button 
                          className="btn btn-secondary" 
                          style={{ padding: '0.35rem 0.75rem', fontSize: '0.8rem', borderColor: 'rgba(16,185,129,0.3)', color: '#10b981' }}
                          onClick={() => handleToggleBlock(device.deviceId, true)}
                        >
                          Entsperren
                        </button>
                      ) : (
                        <button 
                          className="btn btn-danger" 
                          style={{ padding: '0.35rem 0.75rem', fontSize: '0.8rem' }}
                          onClick={() => handleToggleBlock(device.deviceId, false)}
                        >
                          Sperren
                        </button>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
