const bcrypt = require('bcryptjs');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '.env') });
const { connectMongo } = require('./mongo');
const User = require('./models/User');
const Product = require('./models/Product');
const Order = require('./models/Order');
const Review = require('./models/Review');
const Notification = require('./models/Notification');
const PushToken = require('./models/PushToken');

async function runSeed() {
  try {
    await connectMongo();

    await Promise.all([
      Review.deleteMany({}),
      Notification.deleteMany({}),
      PushToken.deleteMany({}),
      Order.deleteMany({}),
      Product.deleteMany({}),
      User.deleteMany({}),
    ]);

    const adminPassword = await bcrypt.hash('admin123', 10);
    const userPassword = await bcrypt.hash('user123', 10);

    const admin = await User.create({
      name: 'Admin User',
      email: 'admin@shopapp.com',
      password: adminPassword,
      role: 'admin',
      provider: 'local',
    });

    await User.create({
      name: 'John Doe',
      email: 'john@example.com',
      password: userPassword,
      role: 'user',
      phone: '09171234567',
      address: '123 Main St, Manila',
      provider: 'local',
    });

    console.log('Users created');
    console.log('  Admin: admin@shopapp.com / admin123');
    console.log('  User:  john@example.com / user123');

    const products = [
      { name: 'Wireless Earbuds', description: 'High-quality Bluetooth earbuds with noise cancellation and 24-hour battery life.', price: 49.99, category: 'Electronics', stock: 50 },
      { name: 'Smart Watch', description: 'Fitness tracker with heart rate monitor, GPS, and water resistance.', price: 129.99, category: 'Electronics', stock: 30 },
      { name: 'Laptop Stand', description: 'Ergonomic aluminum laptop stand for better posture and cooling.', price: 34.99, category: 'Accessories', stock: 100 },
      { name: 'USB-C Hub', description: '7-in-1 USB-C hub with HDMI, USB 3.0, SD card reader.', price: 29.99, category: 'Electronics', stock: 75 },
      { name: 'Mechanical Keyboard', description: 'RGB mechanical keyboard with Cherry MX switches.', price: 89.99, category: 'Electronics', stock: 40 },
      { name: 'Phone Case', description: 'Shockproof protective case for iPhone/Android.', price: 14.99, category: 'Accessories', stock: 200 },
      { name: 'Portable Charger', description: '20000mAh power bank with fast charging support.', price: 24.99, category: 'Electronics', stock: 60 },
      { name: 'Backpack', description: 'Water-resistant laptop backpack with USB charging port.', price: 39.99, category: 'Bags', stock: 45 },
      { name: 'Desk Lamp', description: 'LED desk lamp with adjustable brightness and color temperature.', price: 22.99, category: 'Home', stock: 80 },
      { name: 'Web Development Course', description: 'Complete web development bootcamp covering HTML, CSS, JS, React, Node.js.', price: 19.99, category: 'Services', stock: 0, isService: true },
      { name: 'Graphic Design Package', description: 'Professional logo and brand identity design service.', price: 99.99, category: 'Services', stock: 0, isService: true },
      { name: 'Yoga Mat', description: 'Non-slip exercise yoga mat, 6mm thick.', price: 18.99, category: 'Fitness', stock: 120 },
      { name: 'Water Bottle', description: 'Insulated stainless steel water bottle, 750ml.', price: 16.99, category: 'Fitness', stock: 90 },
      { name: 'Wireless Mouse', description: 'Ergonomic wireless mouse with adjustable DPI.', price: 19.99, category: 'Electronics', stock: 55 },
      { name: 'Notebook Set', description: 'Set of 3 premium notebooks, lined pages.', price: 12.99, category: 'Stationery', stock: 150 },
    ];

    await Product.insertMany(products.map((p) => ({ ...p, createdBy: admin._id })));

    console.log(`${products.length} products created`);
    console.log('\nSeed completed successfully!');
    process.exit(0);
  } catch (err) {
    console.error('Seed error:', err);
    process.exit(1);
  }
}

runSeed();
