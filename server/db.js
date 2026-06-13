import { DatabaseSync } from 'node:sqlite';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const dbPath = path.resolve(__dirname, '../crepes.db');
const db = new DatabaseSync(dbPath);

// Initialize DB schema
export function initDb() {
  // Create tables
  db.exec(`
    CREATE TABLE IF NOT EXISTS products (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      price REAL NOT NULL,
      category TEXT NOT NULL,
      description TEXT,
      available INTEGER DEFAULT 1
    );
  `);

  db.exec(`
    CREATE TABLE IF NOT EXISTS orders (
      id TEXT PRIMARY KEY,
      customer_name TEXT NOT NULL,
      customer_class TEXT,
      status TEXT NOT NULL,
      type TEXT NOT NULL, -- 'online' | 'kasse'
      created_at INTEGER NOT NULL,
      updated_at INTEGER NOT NULL
    );
  `);

  db.exec(`
    CREATE TABLE IF NOT EXISTS order_items (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      order_id TEXT NOT NULL,
      product_id TEXT NOT NULL,
      quantity INTEGER NOT NULL,
      price_at_order REAL NOT NULL,
      FOREIGN KEY (order_id) REFERENCES orders(id) ON DELETE CASCADE
    );
  `);

  // Seed default products if empty
  const countStmt = db.prepare('SELECT COUNT(*) as count FROM products');
  const result = countStmt.get();
  
  if (result.count === 0) {
    console.log('Seeding default products into SQLite database...');
    const insertStmt = db.prepare(`
      INSERT INTO products (id, name, price, category, description, available)
      VALUES (?, ?, ?, ?, ?, 1)
    `);

    const defaultProducts = [
      { id: 'crepe-nutella', name: 'Crepe Nutella', price: 3.00, category: 'Crepes Süß', description: 'Mit leckerem original Nutella-Aufstrich.' },
      { id: 'crepe-zimt-zucker', name: 'Crepe Zimt & Zucker', price: 2.50, category: 'Crepes Süß', description: 'Der Klassiker mit Zimt und feinem Zucker.' },
      { id: 'crepe-apfelmus', name: 'Crepe Apfelmus', price: 3.00, category: 'Crepes Süß', description: 'Mit fruchtigem Apfelmus.' },
      { id: 'crepe-banane-nutella', name: 'Crepe Banane & Nutella', price: 3.50, category: 'Crepes Süß', description: 'Süße Bananenscheiben mit viel Nutella.' },
      { id: 'crepe-kaese', name: 'Crepe Käse', price: 3.00, category: 'Crepes Herzhaft', description: 'Geschmolzener geriebener Käse.' },
      { id: 'crepe-schinken-kaese', name: 'Crepe Schinken & Käse', price: 3.50, category: 'Crepes Herzhaft', description: 'Saftiger Vorderschinken mit geschmolzenem Käse.' },
      { id: 'drink-fritz-kola', name: 'Fritz-Kola 0.33l', price: 2.00, category: 'Getränke', description: 'Eiskalte Fritz-Kola für den Koffeinkick.' },
      { id: 'drink-wasser', name: 'Wasser 0.5l', price: 1.50, category: 'Getränke', description: 'Spritziges oder stilles Mineralwasser.' }
    ];

    for (const prod of defaultProducts) {
      insertStmt.run(prod.id, prod.name, prod.price, prod.category, prod.description);
    }
  }
}

// Product helpers
export function getAllProducts() {
  const stmt = db.prepare('SELECT * FROM products ORDER BY category, name');
  return stmt.all();
}

// Order helpers
export function getOrders() {
  // We need to fetch orders and their items.
  // Neu status orders should have oldest first (ASC).
  // Others can have newest first or default order.
  // Let's return all active orders sorted by:
  // 1. Status priority (Neu -> Zubereitung -> Fertig -> Ausgeliefert)
  // 2. Within Neu: oldest first (created_at ASC)
  // 3. Within others: newest first (created_at DESC)
  const ordersStmt = db.prepare(`
    SELECT * FROM orders 
    ORDER BY 
      CASE status 
        WHEN 'Neu' THEN 1
        WHEN 'Zubereitung' THEN 2
        WHEN 'Fertig' THEN 3
        WHEN 'Ausgeliefert' THEN 4
        ELSE 5
      END ASC,
      CASE status
        WHEN 'Neu' THEN created_at -- oldest first
        ELSE -created_at -- newest first (negative timestamp acts as descending sort)
      END ASC
  `);
  
  const orders = ordersStmt.all();

  // Load items for each order
  const itemsStmt = db.prepare(`
    SELECT oi.*, p.name as product_name 
    FROM order_items oi
    JOIN products p ON oi.product_id = p.id
    WHERE oi.order_id = ?
  `);

  for (const order of orders) {
    order.items = itemsStmt.all(order.id);
  }

  return orders;
}

export function getOrderById(id) {
  const orderStmt = db.prepare('SELECT * FROM orders WHERE id = ?');
  const order = orderStmt.get(id);
  if (!order) return null;

  const itemsStmt = db.prepare(`
    SELECT oi.*, p.name as product_name 
    FROM order_items oi
    JOIN products p ON oi.product_id = p.id
    WHERE oi.order_id = ?
  `);
  order.items = itemsStmt.all(id);
  return order;
}

export function createOrder({ customerName, customerClass, type, items }) {
  // Generate short alphanumeric code (e.g. C-8Y9Z)
  const generateCode = () => {
    const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; // Avoid ambiguous chars like 1, 0, I, O
    let code = '';
    for (let i = 0; i < 4; i++) {
      code += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    return `C-${code}`;
  };

  let id = generateCode();
  // Ensure uniqueness
  const checkStmt = db.prepare('SELECT 1 FROM orders WHERE id = ?');
  while (checkStmt.get(id)) {
    id = generateCode();
  }

  const now = Date.now();
  const insertOrderStmt = db.prepare(`
    INSERT INTO orders (id, customer_name, customer_class, status, type, created_at, updated_at)
    VALUES (?, ?, ?, 'Neu', ?, ?, ?)
  `);
  
  insertOrderStmt.run(id, customerName, customerClass || '', type, now, now);

  const insertItemStmt = db.prepare(`
    INSERT INTO order_items (order_id, product_id, quantity, price_at_order)
    VALUES (?, ?, ?, ?)
  `);

  const prodPriceStmt = db.prepare('SELECT price FROM products WHERE id = ?');

  for (const item of items) {
    const prod = prodPriceStmt.get(item.product_id);
    const price = prod ? prod.price : 0.00;
    insertItemStmt.run(id, item.product_id, item.quantity, price);
  }

  return getOrderById(id);
}

export function updateOrderStatus(id, status) {
  const now = Date.now();
  const stmt = db.prepare(`
    UPDATE orders 
    SET status = ?, updated_at = ?
    WHERE id = ?
  `);
  stmt.run(status, now, id);
  return getOrderById(id);
}

export function deleteOrder(id) {
  const stmt = db.prepare('DELETE FROM orders WHERE id = ?');
  stmt.run(id);
  return true;
}
