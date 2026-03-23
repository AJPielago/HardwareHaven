const express = require('express');
const cors = require('cors');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '.env') });

// Initialize SQLite database (creates tables on first run)
require('./database');

const authRoutes = require('./routes/auth');
const productRoutes = require('./routes/products');
const reviewRoutes = require('./routes/reviews');
const orderRoutes = require('./routes/orders');
const notificationRoutes = require('./routes/notifications');
const dashboardRoutes = require('./routes/dashboard');
const adminRoutes = require('./routes/admin');
const cartRoutes = require('./routes/cart');
const { connectMongo } = require('./mongo');

const app = express();

app.use(cors());
app.use(express.json());
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

app.use('/api/auth', authRoutes);
app.use('/api/products', productRoutes);
app.use('/api/reviews', reviewRoutes);
app.use('/api/orders', orderRoutes);
app.use('/api/notifications', notificationRoutes);
app.use('/api/dashboard', dashboardRoutes);
app.use('/api/admin', adminRoutes);
app.use('/api/cart', cartRoutes);

app.get('/', (req, res) => res.json({ message: 'ShopApp API running' }));
app.get('/api/health', (req, res) => res.json({ ok: true, service: 'shopapp-backend' }));

const PORT = process.env.PORT || 5000;

async function startServer() {
  try {
    await connectMongo();

    app.listen(PORT, '0.0.0.0', () => {
      console.log(`Server running on http://0.0.0.0:${PORT}`);
      const nets = require('os').networkInterfaces();
      for (const name of Object.keys(nets)) {
        for (const net of nets[name]) {
          if (net.family === 'IPv4' && !net.internal) {
            console.log(`  -> http://${net.address}:${PORT}`);
          }
        }
      }
    });
  } catch (err) {
    console.error('[Startup Error] Failed to connect MongoDB:', err.message);
    process.exit(1);
  }
}

startServer();
