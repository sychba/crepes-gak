import { useState, useEffect } from 'react';
import CustomerOrder from './components/CustomerOrder';
import OrderConfirmation from './components/OrderConfirmation';
import Terminal from './components/Terminal';

function App() {
  const [path, setPath] = useState(window.location.pathname);

  // Sync state with back/forward history buttons
  useEffect(() => {
    const handlePopState = () => {
      setPath(window.location.pathname);
    };
    window.addEventListener('popstate', handlePopState);
    return () => window.removeEventListener('popstate', handlePopState);
  }, []);

  // Custom navigation handler
  const navigate = (to) => {
    window.history.pushState({}, '', to);
    setPath(to);
  };

  // Route matching
  const renderView = () => {
    // Match /order/:id
    const orderMatch = path.match(/^\/order\/([^/]+)$/);
    if (orderMatch) {
      return <OrderConfirmation orderId={orderMatch[1]} navigate={navigate} />;
    }

    // Match /terminal
    if (path === '/terminal') {
      return <Terminal navigate={navigate} />;
    }

    // Default: Customer order screen
    return <CustomerOrder navigate={navigate} />;
  };

  // Hide general header on /terminal to give full workspace to staff
  const isTerminal = path === '/terminal';

  return (
    <div className="app-container">
      {!isTerminal && (
        <header className="header">
          <a
            href="/"
            onClick={(e) => {
              e.preventDefault();
              navigate('/');
            }}
            className="logo-container"
          >
            <span className="logo-icon">🥞</span>
            <span className="logo-text">Crepes GAK</span>
          </a>
          <nav className="nav-links">
            <a
              href="/"
              onClick={(e) => {
                e.preventDefault();
                navigate('/');
              }}
              className={`nav-link ${path === '/' ? 'active' : ''}`}
            >
              🥞 Bestellen
            </a>
            <a
              href="/terminal"
              onClick={(e) => {
                e.preventDefault();
                navigate('/terminal');
              }}
              className="nav-link"
            >
              🔑 Staff Terminal
            </a>
          </nav>
        </header>
      )}

      {renderView()}
    </div>
  );
}

export default App;
