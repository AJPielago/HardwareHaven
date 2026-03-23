const Database = require('better-sqlite3');
const fs = require('fs');
const path = require('path');

const dbPath = process.env.SQLITE_PATH || path.join(__dirname, 'shopapp.db');
const dbDir = path.dirname(dbPath);
if (!fs.existsSync(dbDir)) {
  fs.mkdirSync(dbDir, { recursive: true });
}
const db = new Database(dbPath);

// Enable WAL mode for better concurrent read performance
db.pragma('journal_mode = WAL');
db.pragma('foreign_keys = ON');

// Create tables
db.exec(`
  CREATE TABLE IF NOT EXISTS users (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    email TEXT NOT NULL UNIQUE COLLATE NOCASE,
    password TEXT,
    avatar TEXT DEFAULT '',
    phone TEXT DEFAULT '',
    address TEXT DEFAULT '',
    provider TEXT DEFAULT 'local',
    providerId TEXT,
    role TEXT DEFAULT 'user',
    isActive INTEGER DEFAULT 1,
    deactivatedAt TEXT,
    deactivationReason TEXT DEFAULT '',
    createdAt TEXT DEFAULT (datetime('now')),
    updatedAt TEXT DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS push_tokens (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    userId TEXT NOT NULL,
    token TEXT NOT NULL,
    UNIQUE(userId, token),
    FOREIGN KEY (userId) REFERENCES users(id) ON DELETE CASCADE
  );

  CREATE TABLE IF NOT EXISTS products (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    description TEXT NOT NULL,
    price REAL NOT NULL,
    category TEXT NOT NULL,
    image TEXT DEFAULT '',
    stock INTEGER DEFAULT 0,
    isService INTEGER DEFAULT 0,
    isActive INTEGER DEFAULT 1,
    deletedAt TEXT,
    deletedReason TEXT DEFAULT '',
    averageRating REAL DEFAULT 0,
    numReviews INTEGER DEFAULT 0,
    createdBy TEXT,
    createdAt TEXT DEFAULT (datetime('now')),
    updatedAt TEXT DEFAULT (datetime('now')),
    FOREIGN KEY (createdBy) REFERENCES users(id)
  );

  CREATE TABLE IF NOT EXISTS reviews (
    id TEXT PRIMARY KEY,
    userId TEXT NOT NULL,
    productId TEXT NOT NULL,
    orderId TEXT NOT NULL,
    rating INTEGER NOT NULL,
    comment TEXT NOT NULL,
    createdAt TEXT DEFAULT (datetime('now')),
    updatedAt TEXT DEFAULT (datetime('now')),
    UNIQUE(userId, productId, orderId),
    FOREIGN KEY (userId) REFERENCES users(id),
    FOREIGN KEY (productId) REFERENCES products(id),
    FOREIGN KEY (orderId) REFERENCES orders(id)
  );

  CREATE TABLE IF NOT EXISTS orders (
    id TEXT PRIMARY KEY,
    userId TEXT NOT NULL,
    totalAmount REAL NOT NULL,
    status TEXT DEFAULT 'pending',
    shippingAddress TEXT NOT NULL,
    paymentMethod TEXT DEFAULT 'cod',
    createdAt TEXT DEFAULT (datetime('now')),
    updatedAt TEXT DEFAULT (datetime('now')),
    FOREIGN KEY (userId) REFERENCES users(id)
  );

  CREATE TABLE IF NOT EXISTS order_items (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    orderId TEXT NOT NULL,
    productId TEXT,
    name TEXT,
    price REAL,
    quantity INTEGER NOT NULL DEFAULT 1,
    image TEXT,
    FOREIGN KEY (orderId) REFERENCES orders(id) ON DELETE CASCADE
  );

  CREATE TABLE IF NOT EXISTS order_status_history (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    orderId TEXT NOT NULL,
    status TEXT NOT NULL,
    note TEXT,
    date TEXT DEFAULT (datetime('now')),
    FOREIGN KEY (orderId) REFERENCES orders(id) ON DELETE CASCADE
  );

  CREATE TABLE IF NOT EXISTS notifications (
    id TEXT PRIMARY KEY,
    userId TEXT,
    title TEXT NOT NULL,
    body TEXT NOT NULL,
    data TEXT,
    type TEXT DEFAULT 'general',
    isRead INTEGER DEFAULT 0,
    isBroadcast INTEGER DEFAULT 0,
    createdAt TEXT DEFAULT (datetime('now')),
    updatedAt TEXT DEFAULT (datetime('now')),
    FOREIGN KEY (userId) REFERENCES users(id)
  );
`);

// Add missing columns for old databases.
const sqliteHasColumn = (tableName, columnName) => {
  const rows = db.prepare(`PRAGMA table_info(${tableName})`).all();
  return rows.some((row) => row.name === columnName);
};

if (!sqliteHasColumn('users', 'isActive')) {
  db.exec("ALTER TABLE users ADD COLUMN isActive INTEGER DEFAULT 1");
}
if (!sqliteHasColumn('users', 'deactivatedAt')) {
  db.exec('ALTER TABLE users ADD COLUMN deactivatedAt TEXT');
}
if (!sqliteHasColumn('users', 'deactivationReason')) {
  db.exec("ALTER TABLE users ADD COLUMN deactivationReason TEXT DEFAULT ''");
}
if (!sqliteHasColumn('products', 'isActive')) {
  db.exec("ALTER TABLE products ADD COLUMN isActive INTEGER DEFAULT 1");
}
if (!sqliteHasColumn('products', 'deletedAt')) {
  db.exec('ALTER TABLE products ADD COLUMN deletedAt TEXT');
}
if (!sqliteHasColumn('products', 'deletedReason')) {
  db.exec("ALTER TABLE products ADD COLUMN deletedReason TEXT DEFAULT ''");
}

// Migrate order_items: remove FK constraint on productId if present
try {
  const tableInfo = db.prepare("SELECT sql FROM sqlite_master WHERE type='table' AND name='order_items'").get();
  if (tableInfo && tableInfo.sql.includes('REFERENCES products')) {
    db.pragma('foreign_keys = OFF');
    db.exec(`
      CREATE TABLE IF NOT EXISTS order_items_new (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        orderId TEXT NOT NULL,
        productId TEXT,
        name TEXT,
        price REAL,
        quantity INTEGER NOT NULL DEFAULT 1,
        image TEXT,
        FOREIGN KEY (orderId) REFERENCES orders(id) ON DELETE CASCADE
      );
      INSERT INTO order_items_new SELECT * FROM order_items;
      DROP TABLE order_items;
      ALTER TABLE order_items_new RENAME TO order_items;
    `);
    db.pragma('foreign_keys = ON');
  }
} catch (e) {
  console.error('Migration note:', e.message);
}

console.log('SQLite database initialized');

module.exports = db;
