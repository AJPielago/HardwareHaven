const db = require('../database');

exports.getStats = (req, res) => {
  try {
    if (req.user.role !== 'admin') return res.status(403).json({ message: 'Admin only' });

    const totalUsers = db.prepare('SELECT COUNT(*) as count FROM users WHERE role = ?').get('user').count;
    const totalProducts = db.prepare('SELECT COUNT(*) as count FROM products').get().count;
    const totalOrders = db.prepare('SELECT COUNT(*) as count FROM orders').get().count;

    const revenueResult = db.prepare("SELECT COALESCE(SUM(totalAmount), 0) as total FROM orders WHERE status != 'cancelled'").get();
    const totalRevenue = revenueResult.total;

    const ordersByStatus = db.prepare(`
      SELECT status, COUNT(*) as count FROM orders GROUP BY status
    `).all();

    const recentOrders = db.prepare(`
      SELECT o.*, u.name as userName, u.email as userEmail
      FROM orders o
      JOIN users u ON o.userId = u.id
      ORDER BY o.createdAt DESC LIMIT 5
    `).all().map((order) => {
      const itemCount = db.prepare('SELECT COUNT(*) as count FROM order_items WHERE orderId = ?').get(order.id).count;
      return {
        _id: order.id,
        user: { name: order.userName, email: order.userEmail },
        totalAmount: order.totalAmount,
        status: order.status,
        itemCount,
        createdAt: order.createdAt,
      };
    });

    const topProducts = db.prepare(`
      SELECT oi.productId, oi.name, SUM(oi.quantity) as totalSold, SUM(oi.price * oi.quantity) as totalRevenue
      FROM order_items oi
      JOIN orders o ON oi.orderId = o.id
      WHERE o.status != 'cancelled'
      GROUP BY oi.productId
      ORDER BY totalSold DESC
      LIMIT 5
    `).all();

    const lowStock = db.prepare(`
      SELECT id as _id, name, stock, category FROM products
      WHERE isService = 0 AND stock <= 10
      ORDER BY stock ASC LIMIT 5
    `).all();

    const dailyOrders = db.prepare(`
      SELECT DATE(createdAt) as date, COUNT(*) as count, COALESCE(SUM(totalAmount), 0) as revenue
      FROM orders
      WHERE createdAt >= datetime('now', '-7 days')
      GROUP BY DATE(createdAt)
      ORDER BY date DESC
    `).all();

    const newUsersThisWeek = db.prepare(`
      SELECT COUNT(*) as count FROM users
      WHERE createdAt >= datetime('now', '-7 days') AND role = 'user'
    `).get().count;

    const pendingOrders = db.prepare("SELECT COUNT(*) as count FROM orders WHERE status = 'pending'").get().count;

    res.json({
      totalUsers,
      totalProducts,
      totalOrders,
      totalRevenue,
      pendingOrders,
      newUsersThisWeek,
      ordersByStatus,
      recentOrders,
      topProducts,
      lowStock,
      dailyOrders,
    });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};
