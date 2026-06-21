import { useState, useEffect } from 'react';
import Kasse from './Kasse';
import Kueche from './Kueche';
import GerateManager from './GerateManager';
import LoyaltyScanner from './LoyaltyScanner';
import Stationen from './Stationen';
import Dashboard from './Dashboard';

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

const GiftIcon = () => (
  <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
    <polyline points="20 12 20 22 4 22 4 12"/>
    <rect x="2" y="7" width="20" height="5"/>
    <line x1="12" y1="22" x2="12" y2="7"/>
    <path d="M12 7H7.5a2.5 2.5 0 0 1 0-5C11 2 12 7 12 7z"/>
    <path d="M12 7h4.5a2.5 2.5 0 0 0 0-5C13 2 12 7 12 7z"/>
  </svg>
);

const StationIcon = () => (
  <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
    <rect x="3" y="3" width="18" height="18" rx="2" ry="2"/>
    <line x1="9" y1="3" x2="9" y2="21"/>
    <line x1="15" y1="3" x2="15" y2="21"/>
    <line x1="3" y1="9" x2="21" y2="9"/>
    <line x1="3" y1="15" x2="21" y2="15"/>
  </svg>
);

const OverviewIcon = () => (
  <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
    <rect x="3" y="3" width="7" height="9"/>
    <rect x="14" y="3" width="7" height="5"/>
    <rect x="14" y="12" width="7" height="9"/>
    <rect x="3" y="16" width="7" height="5"/>
  </svg>
);


export default function Terminal({ navigate }) {
  const [token, setToken] = useState(null);

  // Load token on mount to avoid Next.js server-side rendering errors
  useEffect(() => {
    if (typeof window !== "undefined") {
      const savedToken = localStorage.getItem("crepes_staff_token");
      if (savedToken) {
        setToken(savedToken);
      }
    }
  }, []);

  const [password, setPassword] = useState('');
  const [loginError, setLoginError] = useState(null);
  const [activeTab, setActiveTab] = useState('stationen'); // default to stationen view
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
            className={`terminal-tab-btn ${activeTab === 'stationen' ? 'active' : ''}`}
            onClick={() => setActiveTab('stationen')}
          >
            <StationIcon />
            <span>Stationen</span>
          </button>
          <button
            className={`terminal-tab-btn ${activeTab === 'dashboard' ? 'active' : ''}`}
            onClick={() => setActiveTab('dashboard')}
          >
            <OverviewIcon />
            <span>Übersicht</span>
          </button>
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
          <button
            className={`terminal-tab-btn ${activeTab === 'loyalty' ? 'active' : ''}`}
            onClick={() => setActiveTab('loyalty')}
          >
            <GiftIcon />
            <span>Treuekarten</span>
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
        {activeTab === 'stationen' && <Stationen token={token} />}
        {activeTab === 'dashboard' && <Dashboard token={token} />}
        {activeTab === 'kueche' && <Kueche token={token} />}
        {activeTab === 'kasse' && <Kasse token={token} />}
        {activeTab === 'gerate' && <GerateManager token={token} />}
        {activeTab === 'loyalty' && <LoyaltyScanner token={token} />}
      </main>
    </div>
  );
}
