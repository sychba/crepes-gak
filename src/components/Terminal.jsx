import { useState } from 'react';
import Kasse from './Kasse';
import Kueche from './Kueche';
import GerateManager from './GerateManager';

// Premium Inline SVGs for Navigation Tabs
const CookIcon = () => (
  <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
    <path d="M6 18h12V9c0-3.3-2.7-6-6-6S6 5.7 6 9v9z"/>
    <path d="M3 21h18"/>
  </svg>
);

const CreditCardIcon = () => (
  <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
    <rect x="1" y="4" width="22" height="16" rx="2" ry="2"/>
    <line x1="1" y1="10" x2="23" y2="10"/>
  </svg>
);

const DeviceIcon = () => (
  <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
    <rect x="5" y="2" width="14" height="20" rx="2" ry="2"/>
    <line x1="12" y1="18" x2="12.01" y2="18"/>
  </svg>
);

export default function Terminal({ navigate }) {
  const [token, setToken] = useState(localStorage.getItem('crepes_staff_token') || null);
  const [password, setPassword] = useState('');
  const [loginError, setLoginError] = useState(null);
  const [activeTab, setActiveTab] = useState('kueche'); // 'kasse' or 'kueche'
  const [submitting, setSubmitting] = useState(false);

  const handleLogin = (e) => {
    e.preventDefault();
    setLoginError(null);

    if (password === 'crepes2026') {
      localStorage.setItem('crepes_staff_token', password);
      setToken(password);
      setPassword('');
    } else {
      setLoginError('Ungültiges Passwort. Bitte versuche es erneut.');
    }
  };

  const handleLogout = () => {
    localStorage.removeItem('crepes_staff_token');
    setToken(null);
  };

  // Login Screen
  if (!token) {
    return (
      <div className="login-container">
        <div className="login-icon">🔑</div>
        <h2 className="login-title">Kassen- & Küchenterminal</h2>
        <p style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', marginBottom: '1.5rem' }}>
          Bitte gib das Staff-Passwort ein, um fortzufahren.
        </p>

        {loginError && <div className="alert alert-error">{loginError}</div>}

        <form onSubmit={handleLogin} className="login-form">
          <div className="form-group" style={{ textAlign: 'left' }}>
            <label htmlFor="staff-pw">Passwort</label>
            <input
              id="staff-pw"
              type="password"
              className="form-input"
              placeholder="Passwort eingeben"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              autoFocus
            />
          </div>
          <button type="submit" className="btn btn-primary" style={{ width: '100%' }} disabled={submitting}>
            {submitting ? 'Anmelden...' : 'Anmelden'}
          </button>
        </form>

        <button 
          className="btn btn-secondary" 
          onClick={() => navigate('/')} 
          style={{ marginTop: '1.5rem', width: '100%', fontSize: '0.85rem' }}
        >
          Zurück zum Kundenbestellsystem
        </button>
      </div>
    );
  }

  // Logged-in Staff Dashboard
  return (
    <div className="app-container">
      {/* Staff Header */}
      <header className="terminal-header">
        <div className="terminal-title-area">
          <a href="#" onClick={(e) => { e.preventDefault(); navigate('/'); }} className="logo-container">
            <span className="logo-text">🥞 Crepes GAK</span>
          </a>
          <span className="terminal-badge">Terminal</span>
        </div>

        {/* Tab switching */}
        <div className="terminal-tabs">
          <button
            className={`terminal-tab-btn ${activeTab === 'kueche' ? 'active' : ''}`}
            onClick={() => setActiveTab('kueche')}
          >
            <CookIcon />
            <span>Küche</span>
          </button>
          <button
            className={`terminal-tab-btn ${activeTab === 'kasse' ? 'active' : ''}`}
            onClick={() => setActiveTab('kasse')}
          >
            <CreditCardIcon />
            <span>Kasse</span>
          </button>
          <button
            className={`terminal-tab-btn ${activeTab === 'gerate' ? 'active' : ''}`}
            onClick={() => setActiveTab('gerate')}
          >
            <DeviceIcon />
            <span>Geräte</span>
          </button>
        </div>

        <div>
          <button className="terminal-logout-btn" onClick={handleLogout}>
            Abmelden ➔
          </button>
        </div>
      </header>

      {/* Main Terminal View Content */}
      <main className="main-content" style={{ padding: '1.5rem' }}>
        {activeTab === 'kueche' && <Kueche token={token} />}
        {activeTab === 'kasse' && <Kasse token={token} />}
        {activeTab === 'gerate' && <GerateManager token={token} />}
      </main>
    </div>
  );
}
