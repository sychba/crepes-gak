import { useState, useEffect } from 'react';
import Kasse from './Kasse';
import Kueche from './Kueche';

export default function Terminal({ navigate }) {
  const [token, setToken] = useState(localStorage.getItem('crepes_staff_token') || null);
  const [password, setPassword] = useState('');
  const [loginError, setLoginError] = useState(null);
  const [activeTab, setActiveTab] = useState('kueche'); // 'kasse' or 'kueche'
  const [submitting, setSubmitting] = useState(false);

  const handleLogin = (e) => {
    e.preventDefault();
    setLoginError(null);
    setSubmitting(true);

    fetch('/api/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ password }),
    })
      .then((res) => {
        if (!res.ok) throw new Error('Falsches Passwort.');
        return res.json();
      })
      .then((data) => {
        localStorage.setItem('crepes_staff_token', data.token);
        setToken(data.token);
        setSubmitting(false);
        setPassword('');
      })
      .catch((err) => {
        console.error(err);
        setLoginError('Ungültiges Passwort. Bitte versuche es erneut.');
        setSubmitting(false);
      });
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
            <span className="logo-icon">🥞</span>
            <span className="logo-text">Crepes GAK</span>
          </a>
          <span className="terminal-badge">Terminal</span>
        </div>

        {/* Tab switching */}
        <div className="terminal-tabs">
          <button
            className={`terminal-tab-btn ${activeTab === 'kueche' ? 'active' : ''}`}
            onClick={() => setActiveTab('kueche')}
          >
            🍳 Küche
          </button>
          <button
            className={`terminal-tab-btn ${activeTab === 'kasse' ? 'active' : ''}`}
            onClick={() => setActiveTab('kasse')}
          >
            💰 Kasse
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
        {activeTab === 'kueche' ? (
          <Kueche token={token} />
        ) : (
          <Kasse token={token} />
        )}
      </main>
    </div>
  );
}
