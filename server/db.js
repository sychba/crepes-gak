import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const dbPath = path.resolve(__dirname, '../db.json');

const defaultProducts = [
  { id: 'crepe-nutella', name: 'Crepe Nutella', price: 3.00, category: 'Crepes Süß', description: 'Mit leckerem original Nutella-Aufstrich.', available: 1 },
  { id: 'crepe-zimt-zucker', name: 'Crepe Zimt & Zucker', price: 2.50, category: 'Crepes Süß', description: 'Der Klassiker mit Zimt und feinem Zucker.', available: 1 },
  { id: 'crepe-apfelmus', name: 'Crepe Apfelmus', price: 3.00, category: 'Crepes Süß', description: 'Mit fruchtigem Apfelmus.', available: 1 },
  { id: 'crepe-banane-nutella', name: 'Crepe Banane & Nutella', price: 3.50, category: 'Crepes Süß', description: 'Süße Bananenscheiben mit viel Nutella.', available: 1 },
  { id: 'crepe-kaese', name: 'Crepe Käse', price: 3.00, category: 'Crepes Herzhaft', description: 'Geschmolzener geriebener Käse.', available: 1 },
  { id: 'crepe-schinken-kaese', name: 'Crepe Schinken & Käse', price: 3.50, category: 'Crepes Herzhaft', description: 'Saftiger Vorderschinken mit geschmolzenem Käse.', available: 1 },
  { id: 'drink-fritz-kola', name: 'Fritz-Kola 0.33l', price: 2.00, category: 'Getränke', description: 'Eiskalte Fritz-Kola für den Koffeinkick.', available: 1 },
  { id: 'drink-wasser', name: 'Wasser 0.5l', price: 1.50, category: 'Getränke', description: 'Spritziges oder stilles Mineralwasser.', available: 1 }
];

// Helper: Read from JSON file database
function readDb() {
  try {
    if (!fs.existsSync(dbPath)) {
      const initialData = { products: defaultProducts, orders: [] };
      fs.writeFileSync(dbPath, JSON.stringify(initialData, null, 2), 'utf-8');
      return initialData;
    }
    const data = fs.readFileSync(dbPath, 'utf-8');
    return JSON.parse(data);
  } catch (err) {
    console.error('Error reading JSON database:', err);
    return { products: defaultProducts, orders: [] };
  }
}

// Helper: Write to JSON file database (atomic write)
function writeDb(data) {
  try {
    const tempPath = dbPath + '.tmp';
    fs.writeFileSync(tempPath, JSON.stringify(data, null, 2), 'utf-8');
    fs.renameSync(tempPath, dbPath);
  } catch (err) {
    console.error('Error writing to JSON database:', err);
  }
}

// Initialize DB schema (No-op in JSON database since readDb handles creation)
export function initDb() {
  readDb();
  console.log('JSON database initialized successfully at:', dbPath);
}

// Product helpers
export function getAllProducts() {
  const dbData = readDb();
  return dbData.products || [];
}

// Order helpers
export function getOrders() {
  const dbData = readDb();
  const orders = dbData.orders || [];

  // Sort orders:
  // 1. Status priority (Neu -> Zubereitung -> Fertig -> Ausgeliefert)
  // 2. Within Neu: oldest first (created_at ASC)
  // 3. Within others: newest first (created_at DESC)
  return orders.sort((a, b) => {
    const statusPriority = {
      'Neu': 1,
      'Zubereitung': 2,
      'Fertig': 3,
      'Ausgeliefert': 4
    };

    const priorityA = statusPriority[a.status] || 5;
    const priorityB = statusPriority[b.status] || 5;

    if (priorityA !== priorityB) {
      return priorityA - priorityB;
    }

    if (a.status === 'Neu') {
      return a.created_at - b.created_at; // oldest first
    } else {
      return b.created_at - a.created_at; // newest first
    }
  });
}

export function getOrderById(id) {
  const dbData = readDb();
  const orders = dbData.orders || [];
  return orders.find(order => order.id === id) || null;
}

export function createOrder({ customerName, customerClass, type, items }) {
  const dbData = readDb();
  const orders = dbData.orders || [];
  const products = dbData.products || [];

  // Generate short alphanumeric code (e.g. C-8Y9Z)
  const generateCode = () => {
    const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; // Avoid ambiguous chars
    let code = '';
    for (let i = 0; i < 4; i++) {
      code += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    return `C-${code}`;
  };

  let id = generateCode();
  // Ensure uniqueness
  while (orders.some(order => order.id === id)) {
    id = generateCode();
  }

  const now = Date.now();

  // Map input items to database items with product names and prices at order time
  const orderItems = items.map((item, index) => {
    const product = products.find(p => p.id === item.product_id);
    return {
      id: now + index, // unique numeric ID for the order item
      order_id: id,
      product_id: item.product_id,
      quantity: item.quantity,
      price_at_order: product ? product.price : 0.00,
      product_name: product ? product.name : 'Unbekanntes Produkt'
    };
  });

  const newOrder = {
    id,
    customer_name: customerName,
    customer_class: customerClass || '',
    status: 'Neu',
    type,
    created_at: now,
    updated_at: now,
    items: orderItems
  };

  orders.push(newOrder);
  dbData.orders = orders;
  writeDb(dbData);

  return newOrder;
}

export function updateOrderStatus(id, status) {
  const dbData = readDb();
  const orders = dbData.orders || [];
  const orderIndex = orders.findIndex(order => order.id === id);

  if (orderIndex === -1) return null;

  orders[orderIndex].status = status;
  orders[orderIndex].updated_at = Date.now();

  dbData.orders = orders;
  writeDb(dbData);

  return orders[orderIndex];
}

export function deleteOrder(id) {
  const dbData = readDb();
  const orders = dbData.orders || [];
  const filteredOrders = orders.filter(order => order.id !== id);

  if (orders.length === filteredOrders.length) return false;

  dbData.orders = filteredOrders;
  writeDb(dbData);
  return true;
}
