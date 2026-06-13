import express from 'express';
import cors from 'cors';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';
import { initDb, getAllProducts, getOrders, getOrderById, createOrder, updateOrderStatus, deleteOrder } from './db.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Initialize SQLite database
initDb();

const app = express();
const PORT = process.env.PORT || 3001;
const STAFF_PASSWORD = process.env.STAFF_PASSWORD || 'crepes2026';

// Middleware
app.use(cors());
app.use(express.json());

// Auth helper middleware
const requireStaffAuth = (req, res, next) => {
  const authHeader = req.headers['authorization'];
  // We accept both direct passwords (simple) or a token string for authentication.
  // In our case, we will simply look for 'Bearer crepes2026' or just the raw password for simplicity.
  const token = authHeader && authHeader.split(' ')[1];
  
  if (token === STAFF_PASSWORD) {
    next();
  } else {
    res.status(401).json({ error: 'Nicht autorisiert. Falsches Passwort.' });
  }
};

// --- API Endpoints ---

// Auth Check
app.post('/api/auth/login', (req, res) => {
  const { password } = req.body;
  if (password === STAFF_PASSWORD) {
    res.json({ success: true, token: STAFF_PASSWORD });
  } else {
    res.status(401).json({ error: 'Falsches Passwort.' });
  }
});

// Products
app.get('/api/products', (req, res) => {
  try {
    const products = getAllProducts();
    res.json(products);
  } catch (error) {
    console.error('Error fetching products:', error);
    res.status(500).json({ error: 'Fehler beim Laden der Produkte.' });
  }
});

// Create Order (Public)
app.post('/api/orders', (req, res) => {
  const { customerName, customerClass, type, items } = req.body;

  if (!customerName || !items || !Array.isArray(items) || items.length === 0) {
    return res.status(400).json({ error: 'Ungültige Bestelldaten. Name und Produkte erforderlich.' });
  }

  try {
    const newOrder = createOrder({
      customerName,
      customerClass,
      type: type || 'online',
      items
    });
    res.status(201).json(newOrder);
  } catch (error) {
    console.error('Error creating order:', error);
    res.status(500).json({ error: 'Fehler beim Aufgeben der Bestellung.' });
  }
});

// Get single order details (Public - for confirmation/invoice page)
app.get('/api/orders/:id', (req, res) => {
  const { id } = req.params;
  try {
    const order = getOrderById(id);
    if (!order) {
      return res.status(404).json({ error: 'Bestellung nicht gefunden.' });
    }
    res.json(order);
  } catch (error) {
    console.error('Error fetching order:', error);
    res.status(500).json({ error: 'Fehler beim Laden der Bestellung.' });
  }
});

// Get all orders (Staff only)
app.get('/api/orders', requireStaffAuth, (req, res) => {
  try {
    const orders = getOrders();
    res.json(orders);
  } catch (error) {
    console.error('Error fetching orders:', error);
    res.status(500).json({ error: 'Fehler beim Laden der Bestellungen.' });
  }
});

// Update order status (Staff only)
app.put('/api/orders/:id/status', requireStaffAuth, (req, res) => {
  const { id } = req.params;
  const { status } = req.body;

  const validStatuses = ['Neu', 'Zubereitung', 'Fertig', 'Ausgeliefert'];
  if (!validStatuses.includes(status)) {
    return res.status(400).json({ error: 'Ungültiger Status.' });
  }

  try {
    const updated = updateOrderStatus(id, status);
    if (!updated) {
      return res.status(404).json({ error: 'Bestellung nicht gefunden.' });
    }
    res.json(updated);
  } catch (error) {
    console.error('Error updating order status:', error);
    res.status(500).json({ error: 'Fehler beim Aktualisieren des Status.' });
  }
});

// Delete/Cancel order (Staff only)
app.delete('/api/orders/:id', requireStaffAuth, (req, res) => {
  const { id } = req.params;
  try {
    const order = getOrderById(id);
    if (!order) {
      return res.status(404).json({ error: 'Bestellung nicht gefunden.' });
    }
    deleteOrder(id);
    res.json({ success: true, message: 'Bestellung gelöscht.' });
  } catch (error) {
    console.error('Error deleting order:', error);
    res.status(500).json({ error: 'Fehler beim Löschen der Bestellung.' });
  }
});

// --- Serving Frontend in Production ---
const distPath = path.resolve(__dirname, '../dist');
if (fs.existsSync(distPath)) {
  console.log(`Serving static files from production build: ${distPath}`);
  app.use(express.static(distPath));

  // Client routing fallback (excluding API requests)
  app.get('*', (req, res, next) => {
    if (req.path.startsWith('/api')) {
      return next();
    }
    res.sendFile(path.resolve(distPath, 'index.html'));
  });
} else {
  console.log('Static files folder (dist) not found. API mode only. Ensure client dev server is running on port 5173.');
}

// Start Server
app.listen(PORT, () => {
  console.log(`===================================================`);
  console.log(` Crepes Ordering Backend listening on port ${PORT}`);
  console.log(` Default Terminal Password: ${STAFF_PASSWORD}`);
  console.log(`===================================================`);
});
