const db = require('../database');
const User = require('../models/User');
const Review = require('../models/Review');
const { sendMail } = require('../utils/mailer');
const fs = require('fs');
const path = require('path');

// Load shop logo as base64 data URI once at startup
let shopLogoDataUri = '';
try {
  const logoPath = path.resolve(__dirname, '../../assets/shop_logo.png');
  const logoBuffer = fs.readFileSync(logoPath);
  // Detect JPEG vs PNG by magic bytes
  const isJpeg = logoBuffer[0] === 0xFF && logoBuffer[1] === 0xD8;
  const mime = isJpeg ? 'image/jpeg' : 'image/png';
  shopLogoDataUri = `data:${mime};base64,${logoBuffer.toString('base64')}`;
} catch {
  // Logo not found — reports will render without it
}

const requireAdmin = (req, res) => {
  if (req.user?.role !== 'admin') {
    res.status(403).json({ message: 'Admin only' });
    return false;
  }
  return true;
};

const escapeHtml = (value) => String(value ?? '')
  .replace(/&/g, '&amp;')
  .replace(/</g, '&lt;')
  .replace(/>/g, '&gt;')
  .replace(/"/g, '&quot;')
  .replace(/'/g, '&#039;');

const ALLOWED_DEACTIVATION_REASONS = [
  'Fraudulent activity',
  'Repeated policy violations',
  'Harassment or abusive behavior',
  'Spam or fake transactions',
  'Security risk',
  'Requested by user',
];

exports.getAnalytics = (req, res) => {
  try {
    if (!requireAdmin(req, res)) return;

    const totalUsers = db.prepare('SELECT COUNT(*) as count FROM users WHERE role = ?').get('user').count;
    const totalProducts = db.prepare('SELECT COUNT(*) as count FROM products').get().count;
    const totalOrders = db.prepare('SELECT COUNT(*) as count FROM orders').get().count;
    const totalRevenue = db.prepare("SELECT COALESCE(SUM(totalAmount), 0) as total FROM orders WHERE status != 'cancelled'").get().total;
    const pendingOrders = db.prepare("SELECT COUNT(*) as count FROM orders WHERE status = 'pending'").get().count;

    const lowStockCount = db.prepare('SELECT COUNT(*) as count FROM products WHERE isService = 0 AND stock <= 10').get().count;
    const orderStatus = db.prepare('SELECT status, COUNT(*) as count FROM orders GROUP BY status ORDER BY count DESC').all();

    const monthlyRevenue = db.prepare(`
      SELECT strftime('%Y-%m', createdAt) as month, COALESCE(SUM(totalAmount), 0) as revenue
      FROM orders
      WHERE status != 'cancelled' AND createdAt >= datetime('now', '-6 months')
      GROUP BY strftime('%Y-%m', createdAt)
      ORDER BY month ASC
    `).all();

    const categorySales = db.prepare(`
      SELECT p.category, SUM(oi.quantity) as sold, COALESCE(SUM(oi.quantity * oi.price), 0) as revenue
      FROM order_items oi
      JOIN products p ON p.id = oi.productId
      JOIN orders o ON o.id = oi.orderId
      WHERE o.status != 'cancelled'
      GROUP BY p.category
      ORDER BY revenue DESC
    `).all();

    res.json({
      totalUsers,
      totalProducts,
      totalOrders,
      totalRevenue,
      pendingOrders,
      lowStockCount,
      orderStatus,
      monthlyRevenue,
      categorySales,
    });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

exports.getUsers = async (req, res) => {
  try {
    if (!requireAdmin(req, res)) return;

    const { search = '', role = '' } = req.query;
    const query = {};
    if (role) query.role = role;
    if (search) {
      query.$or = [
        { name: { $regex: search, $options: 'i' } },
        { email: { $regex: search, $options: 'i' } },
      ];
    }

    const users = await User.find(query)
      .select('name email role provider phone address createdAt updatedAt avatar isActive deactivatedAt deactivationReason')
      .sort({ createdAt: -1 })
      .lean();

    res.json(users.map((u) => ({
      _id: String(u._id),
      name: u.name,
      email: u.email,
      role: u.role,
      provider: u.provider,
      isActive: u.isActive !== false,
      deactivatedAt: u.deactivatedAt || null,
      deactivationReason: u.deactivationReason || '',
      phone: u.phone || '',
      address: u.address || '',
      avatar: u.avatar || '',
      createdAt: u.createdAt,
      updatedAt: u.updatedAt,
    })));
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

exports.updateUser = async (req, res) => {
  try {
    if (!requireAdmin(req, res)) return;

    const update = {};
    if (Object.prototype.hasOwnProperty.call(req.body, 'name')) update.name = String(req.body.name || '').trim();
    if (Object.prototype.hasOwnProperty.call(req.body, 'phone')) update.phone = String(req.body.phone || '').trim();
    if (Object.prototype.hasOwnProperty.call(req.body, 'address')) update.address = String(req.body.address || '').trim();
    if (Object.prototype.hasOwnProperty.call(req.body, 'role')) {
      const role = String(req.body.role || '').trim();
      if (!['admin', 'user'].includes(role)) return res.status(400).json({ message: 'Invalid role' });
      update.role = role;
    }

    const user = await User.findByIdAndUpdate(req.params.id, { $set: update }, { returnDocument: 'after' }).lean();
    if (!user) return res.status(404).json({ message: 'User not found' });

    db.prepare(`
      INSERT INTO users (id, name, email, avatar, phone, address, provider, providerId, role, isActive, deactivatedAt, deactivationReason)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      ON CONFLICT(id) DO UPDATE SET
        name = excluded.name,
        email = excluded.email,
        avatar = excluded.avatar,
        phone = excluded.phone,
        address = excluded.address,
        provider = excluded.provider,
        providerId = excluded.providerId,
        role = excluded.role,
        isActive = excluded.isActive,
        deactivatedAt = excluded.deactivatedAt,
        deactivationReason = excluded.deactivationReason,
        updatedAt = datetime('now')
    `).run(
      String(user._id),
      user.name,
      user.email,
      user.avatar || '',
      user.phone || '',
      user.address || '',
      user.provider || 'local',
      user.firebaseUid || user.providerId || '',
      user.role || 'user',
      user.isActive === false ? 0 : 1,
      user.deactivatedAt ? new Date(user.deactivatedAt).toISOString() : null,
      user.deactivationReason || ''
    );

    res.json({
      _id: String(user._id),
      name: user.name,
      email: user.email,
      role: user.role,
      provider: user.provider,
      isActive: user.isActive !== false,
      deactivatedAt: user.deactivatedAt || null,
      deactivationReason: user.deactivationReason || '',
      phone: user.phone || '',
      address: user.address || '',
      avatar: user.avatar || '',
      createdAt: user.createdAt,
      updatedAt: user.updatedAt,
    });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

exports.setUserActiveStatus = async (req, res) => {
  try {
    if (!requireAdmin(req, res)) return;

    const { isActive, reason = '' } = req.body;
    if (typeof isActive !== 'boolean') {
      return res.status(400).json({ message: 'isActive must be true or false' });
    }

    if (req.user.id === req.params.id && !isActive) {
      return res.status(400).json({ message: 'You cannot deactivate your own account' });
    }

    const trimmedReason = String(reason || '').trim();
    if (!isActive && !trimmedReason) {
      return res.status(400).json({ message: 'Deactivation reason is required' });
    }
    if (!isActive && !ALLOWED_DEACTIVATION_REASONS.includes(trimmedReason)) {
      return res.status(400).json({ message: 'Invalid deactivation reason selected' });
    }

    const update = {
      isActive,
      deactivatedAt: isActive ? null : new Date(),
      deactivationReason: isActive ? '' : trimmedReason,
    };

    const user = await User.findByIdAndUpdate(req.params.id, { $set: update }, { returnDocument: 'after' }).lean();
    if (!user) return res.status(404).json({ message: 'User not found' });

    db.prepare(`
      INSERT INTO users (id, name, email, avatar, phone, address, provider, providerId, role, isActive, deactivatedAt, deactivationReason)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      ON CONFLICT(id) DO UPDATE SET
        name = excluded.name,
        email = excluded.email,
        avatar = excluded.avatar,
        phone = excluded.phone,
        address = excluded.address,
        provider = excluded.provider,
        providerId = excluded.providerId,
        role = excluded.role,
        isActive = excluded.isActive,
        deactivatedAt = excluded.deactivatedAt,
        deactivationReason = excluded.deactivationReason,
        updatedAt = datetime('now')
    `).run(
      String(user._id),
      user.name,
      user.email,
      user.avatar || '',
      user.phone || '',
      user.address || '',
      user.provider || 'local',
      user.firebaseUid || user.providerId || '',
      user.role || 'user',
      user.isActive === false ? 0 : 1,
      user.deactivatedAt ? new Date(user.deactivatedAt).toISOString() : null,
      user.deactivationReason || ''
    );

    if (!isActive && user.email) {
      const subject = 'Your ShopApp account was deactivated';
      const text = `Hi ${user.name || 'User'},\n\nYour account has been deactivated by an administrator.\n\nReason: ${trimmedReason}\n\nIf you believe this is a mistake, please contact support.`;
      try {
        await sendMail({ to: user.email, subject, text });
      } catch (mailErr) {
        console.error('[Admin] Deactivation email failed:', mailErr.message);
      }
    }

    res.json({
      _id: String(user._id),
      name: user.name,
      email: user.email,
      role: user.role,
      provider: user.provider,
      isActive: user.isActive !== false,
      deactivatedAt: user.deactivatedAt || null,
      deactivationReason: user.deactivationReason || '',
      phone: user.phone || '',
      address: user.address || '',
      avatar: user.avatar || '',
      createdAt: user.createdAt,
      updatedAt: user.updatedAt,
    });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

exports.deleteUser = async (req, res) => {
  try {
    if (!requireAdmin(req, res)) return;
    if (req.user.id === req.params.id) return res.status(400).json({ message: 'You cannot delete your own account' });

    const user = await User.findByIdAndDelete(req.params.id).lean();
    if (!user) return res.status(404).json({ message: 'User not found' });

    db.prepare('DELETE FROM users WHERE id = ?').run(req.params.id);
    db.prepare('DELETE FROM push_tokens WHERE userId = ?').run(req.params.id);

    res.json({ message: 'User deleted' });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

exports.getInventory = (req, res) => {
  try {
    if (!requireAdmin(req, res)) return;

    const items = db.prepare(`
      SELECT id as _id, name, category, stock, isService, isActive, deletedAt, deletedReason, price, image, description, updatedAt
      FROM products
      ORDER BY isService ASC, stock ASC, name ASC
    `).all().map((p) => {
      let imgs = [];
      try { imgs = JSON.parse(p.image || '[]'); } catch (e) { if (p.image) imgs = [p.image]; }
      return {
        ...p,
        stock: Number(p.stock || 0),
        price: Number(p.price || 0),
        isService: !!p.isService,
        isActive: p.isActive !== 0,
        deletedAt: p.deletedAt || null,
        deletedReason: p.deletedReason || '',
        images: imgs,
        image: imgs[0] || '',
        description: p.description || '',
      };
    });

    res.json(items);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

exports.setProductActiveStatus = (req, res) => {
  try {
    if (!requireAdmin(req, res)) return;

    const { isActive, reason = '' } = req.body;
    if (typeof isActive !== 'boolean') {
      return res.status(400).json({ message: 'isActive must be true or false' });
    }

    const trimmedReason = String(reason || '').trim();

    const changes = db.prepare(`
      UPDATE products
      SET isActive = ?,
          deletedAt = ?,
          deletedReason = ?,
          updatedAt = datetime('now')
      WHERE id = ?
    `).run(
      isActive ? 1 : 0,
      isActive ? null : new Date().toISOString(),
      isActive ? '' : (trimmedReason || 'Deactivated by admin'),
      req.params.productId
    );

    if (!changes.changes) {
      return res.status(404).json({ message: 'Product not found' });
    }

    const updated = db.prepare(`
      SELECT id as _id, name, category, stock, isService, isActive, deletedAt, deletedReason, price, image, description, updatedAt
      FROM products
      WHERE id = ?
    `).get(req.params.productId);

    let imgs = [];
    try { imgs = JSON.parse(updated.image || '[]'); } catch (e) { if (updated.image) imgs = [updated.image]; }

    res.json({
      ...updated,
      stock: Number(updated.stock || 0),
      price: Number(updated.price || 0),
      isService: !!updated.isService,
      isActive: updated.isActive !== 0,
      deletedAt: updated.deletedAt || null,
      deletedReason: updated.deletedReason || '',
      images: imgs,
      image: imgs[0] || '',
      description: updated.description || '',
    });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

exports.updateInventory = (req, res) => {
  try {
    if (!requireAdmin(req, res)) return;

    const product = db.prepare('SELECT id, stock, isService FROM products WHERE id = ?').get(req.params.productId);
    if (!product) return res.status(404).json({ message: 'Product not found' });

    let nextStock;
    if (Object.prototype.hasOwnProperty.call(req.body, 'stock')) {
      nextStock = Math.max(0, Number(req.body.stock));
    } else if (Object.prototype.hasOwnProperty.call(req.body, 'adjustment')) {
      nextStock = Math.max(0, Number(product.stock || 0) + Number(req.body.adjustment));
    } else {
      return res.status(400).json({ message: 'Provide stock or adjustment' });
    }

    if (product.isService) {
      return res.status(400).json({ message: 'Service products do not use stock inventory' });
    }

    db.prepare("UPDATE products SET stock = ?, updatedAt = datetime('now') WHERE id = ?").run(nextStock, req.params.productId);

    const updated = db.prepare(`
      SELECT id as _id, name, category, stock, isService, price, image, description, updatedAt
      FROM products WHERE id = ?
    `).get(req.params.productId);

    res.json({
      ...updated,
      stock: Number(updated.stock || 0),
      price: Number(updated.price || 0),
      isService: !!updated.isService,
      note: req.body.reason ? String(req.body.reason) : null,
    });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

exports.getReviews = async (req, res) => {
  try {
    if (!requireAdmin(req, res)) return;

    const { search = '' } = req.query;
    const reviews = await Review.find(search ? { comment: { $regex: search, $options: 'i' } } : {})
      .populate('userId', 'name email')
      .sort({ createdAt: -1 })
      .lean();

    const productIds = [...new Set(reviews.map((r) => String(r.productId || '')).filter(Boolean))];
    const productMap = new Map();
    if (productIds.length) {
      const placeholders = productIds.map(() => '?').join(', ');
      const products = db.prepare(`SELECT id, name FROM products WHERE id IN (${placeholders})`).all(...productIds);
      for (const product of products) {
        productMap.set(String(product.id), {
          _id: String(product.id),
          name: product.name,
        });
      }
    }

    res.json(reviews.map((review) => ({
      _id: String(review._id),
      rating: review.rating,
      comment: review.comment,
      createdAt: review.createdAt,
      updatedAt: review.updatedAt,
      user: review.userId ? {
        _id: String(review.userId._id),
        name: review.userId.name,
        email: review.userId.email,
      } : null,
      product: productMap.get(String(review.productId)) || null,
      order: review.orderId ? String(review.orderId) : null,
    })));
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

exports.deleteReview = async (req, res) => {
  try {
    if (!requireAdmin(req, res)) return;

    const deleted = await Review.findByIdAndDelete(req.params.id).lean();
    if (!deleted) return res.status(404).json({ message: 'Review not found' });

    res.json({ message: 'Review deleted' });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

exports.getSalesReport = (req, res) => {
  try {
    if (!requireAdmin(req, res)) return;

    const SHOP_NAME = 'Hardware Haven';

    const { range = '30d' } = req.query;
    let sinceSql = '';
    let label = 'All Time';
    if (range === '7d') {
      sinceSql = "AND o.createdAt >= datetime('now', '-7 days')";
      label = 'Last 7 Days';
    }
    if (range === '30d') {
      sinceSql = "AND o.createdAt >= datetime('now', '-30 days')";
      label = 'Last 30 Days';
    }
    if (range === '90d') {
      sinceSql = "AND o.createdAt >= datetime('now', '-90 days')";
      label = 'Last 90 Days';
    }

    const summary = db.prepare(`
      SELECT
        COUNT(DISTINCT o.id) as totalOrders,
        COUNT(DISTINCT o.userId) as uniqueCustomers,
        COALESCE(SUM(o.totalAmount), 0) as revenue,
        COALESCE(AVG(o.totalAmount), 0) as averageOrderValue
      FROM orders o
      WHERE o.status != 'cancelled' ${sinceSql}
    `).get();

    const topProductsRaw = db.prepare(`
      SELECT oi.productId, oi.name, SUM(oi.quantity) as quantitySold, COALESCE(SUM(oi.quantity * oi.price), 0) as revenue
      FROM order_items oi
      JOIN orders o ON o.id = oi.orderId
      WHERE o.status != 'cancelled' ${sinceSql.replace(/o\.createdAt/g, 'o.createdAt')}
      GROUP BY oi.productId, oi.name
      ORDER BY quantitySold DESC
      LIMIT 20
    `).all();

    const orderStatusRaw = db.prepare(`
      SELECT
        CASE
          WHEN TRIM(COALESCE(o.status, '')) = '' THEN 'unknown'
          ELSE LOWER(TRIM(o.status))
        END as status,
        COUNT(*) as count
      FROM orders o
      WHERE 1 = 1 ${sinceSql}
      GROUP BY status
      ORDER BY count DESC
    `).all();

    const categorySalesRaw = db.prepare(`
      SELECT
        CASE
          WHEN TRIM(COALESCE(p.category, '')) = '' THEN 'Uncategorized'
          ELSE p.category
        END as category,
        SUM(oi.quantity) as quantitySold,
        COALESCE(SUM(oi.quantity * oi.price), 0) as revenue
      FROM order_items oi
      JOIN orders o ON o.id = oi.orderId
      LEFT JOIN products p ON CAST(p.id AS TEXT) = CAST(oi.productId AS TEXT)
      WHERE o.status != 'cancelled' ${sinceSql}
      GROUP BY category
      ORDER BY revenue DESC
      LIMIT 20
    `).all();

    const dailySales = db.prepare(`
      SELECT DATE(o.createdAt) as day, COUNT(*) as orderCount, COALESCE(SUM(o.totalAmount), 0) as revenue
      FROM orders o
      WHERE o.status != 'cancelled' ${sinceSql}
      GROUP BY DATE(o.createdAt)
      ORDER BY day ASC
    `).all();

    const topProducts = topProductsRaw.map((row) => ({
      productId: row.productId,
      name: String(row.name || 'Unknown Product').trim() || 'Unknown Product',
      quantitySold: Number(row.quantitySold || 0),
      revenue: Number(row.revenue || 0),
    }));

    const orderStatus = orderStatusRaw.map((row) => ({
      status: String(row.status || 'unknown').trim() || 'unknown',
      count: Number(row.count || 0),
    }));

    const categorySales = categorySalesRaw.map((row) => ({
      category: String(row.category || 'Uncategorized').trim() || 'Uncategorized',
      quantitySold: Number(row.quantitySold || 0),
      revenue: Number(row.revenue || 0),
    }));

    const dailySalesNormalized = dailySales.map((row) => ({
      day: row.day,
      orderCount: Number(row.orderCount || 0),
      revenue: Number(row.revenue || 0),
    }));

    const rowsOrEmpty = (rowsHtml, colSpan) => rowsHtml || `<tr><td colspan="${colSpan}" style="text-align:center;color:#777;">No data available</td></tr>`;

    const printableHtml = `<!doctype html>
<html>
<head>
  <meta charset="utf-8" />
  <title>${escapeHtml(SHOP_NAME)} Sales Report</title>
  <style>
    body { font-family: Arial, sans-serif; padding: 24px; color: #222; }
    h1, h2 { margin: 0 0 8px; }
    .report-header { display: flex; align-items: center; gap: 16px; margin-bottom: 8px; }
    .report-header img { width: 60px; height: 60px; object-fit: contain; }
    .meta { color: #666; margin-bottom: 18px; }
    .stats { display: flex; gap: 14px; margin-bottom: 20px; }
    .card { border: 1px solid #ddd; border-radius: 8px; padding: 10px 14px; min-width: 180px; }
    table { width: 100%; border-collapse: collapse; margin-top: 10px; }
    th, td { border: 1px solid #ddd; padding: 8px; text-align: left; font-size: 12px; }
    th { background: #f5f5f5; }
    @media print { .no-print { display: none; } }
  </style>
</head>
<body>
  <div class="report-header">
    ${shopLogoDataUri ? `<img src="${shopLogoDataUri}" alt="Shop Logo" />` : ''}
    <h1>${escapeHtml(SHOP_NAME)} Sales Report</h1>
  </div>
  <div class="meta">Range: ${escapeHtml(label)} | Generated: ${escapeHtml(new Date().toLocaleString())}</div>
  <div class="stats">
    <div class="card"><div>Total Orders</div><strong>${summary.totalOrders}</strong></div>
    <div class="card"><div>Customers</div><strong>${summary.uniqueCustomers}</strong></div>
    <div class="card"><div>Revenue</div><strong>PHP ${Number(summary.revenue || 0).toFixed(2)}</strong></div>
    <div class="card"><div>Avg Order Value</div><strong>PHP ${Number(summary.averageOrderValue || 0).toFixed(2)}</strong></div>
  </div>
  <h2>Top Products</h2>
  <table>
    <thead><tr><th>Product</th><th>Quantity Sold</th><th>Revenue (PHP)</th></tr></thead>
    <tbody>
      ${rowsOrEmpty(topProducts.map((p) => `<tr><td>${escapeHtml(p.name)}</td><td>${p.quantitySold}</td><td>${Number(p.revenue || 0).toFixed(2)}</td></tr>`).join(''), 3)}
    </tbody>
  </table>
  <h2 style="margin-top:20px;">Order Status Breakdown</h2>
  <table>
    <thead><tr><th>Status</th><th>Count</th></tr></thead>
    <tbody>
      ${rowsOrEmpty(orderStatus.map((row) => `<tr><td>${escapeHtml(row.status)}</td><td>${Number(row.count || 0)}</td></tr>`).join(''), 2)}
    </tbody>
  </table>
  <h2 style="margin-top:20px;">Category Performance</h2>
  <table>
    <thead><tr><th>Category</th><th>Quantity Sold</th><th>Revenue (PHP)</th></tr></thead>
    <tbody>
      ${rowsOrEmpty(categorySales.map((row) => `<tr><td>${escapeHtml(row.category || 'Uncategorized')}</td><td>${Number(row.quantitySold || 0)}</td><td>${Number(row.revenue || 0).toFixed(2)}</td></tr>`).join(''), 3)}
    </tbody>
  </table>
  <h2 style="margin-top:20px;">Daily Sales</h2>
  <table>
    <thead><tr><th>Date</th><th>Orders</th><th>Revenue (PHP)</th></tr></thead>
    <tbody>
      ${rowsOrEmpty(dailySalesNormalized.map((d) => `<tr><td>${escapeHtml(d.day)}</td><td>${Number(d.orderCount || 0)}</td><td>${Number(d.revenue || 0).toFixed(2)}</td></tr>`).join(''), 3)}
    </tbody>
  </table>
</body>
</html>`;

    res.json({
      shopName: SHOP_NAME,
      range,
      label,
      generatedAt: new Date().toISOString(),
      summary: {
        totalOrders: Number(summary.totalOrders || 0),
        uniqueCustomers: Number(summary.uniqueCustomers || 0),
        revenue: Number(summary.revenue || 0),
        averageOrderValue: Number(summary.averageOrderValue || 0),
      },
      topProducts,
      orderStatus,
      categorySales,
      dailySales: dailySalesNormalized,
      printableHtml,
    });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

exports.getSalesReportPdf = async (req, res) => {
  try {
    if (!requireAdmin(req, res)) return;

    const { PDFDocument, StandardFonts, rgb } = require('pdf-lib');

    const SHOP_NAME = 'Hardware Haven';
    const PAGE_WIDTH = 595;
    const PAGE_HEIGHT = 842;
    const PAGE_MARGIN = 40;
    const ROW_HEIGHT = 18;

    const BRAND_PRIMARY = rgb(5 / 255, 25 / 255, 84 / 255);
    const BRAND_LIGHT = rgb(234 / 255, 240 / 255, 252 / 255);
    const TABLE_BORDER = rgb(220 / 255, 224 / 255, 232 / 255);
    const TABLE_ALT = rgb(248 / 255, 250 / 255, 255 / 255);

    const safeText = (value) => {
      const raw = String(value ?? '');
      return raw.normalize('NFKD').replace(/[\u0300-\u036f]/g, '').replace(/[^\x20-\x7E\n\r\t]/g, '?');
    };
    const formatMoney = (value) => `PHP ${Number(value || 0).toFixed(2)}`;

    // --- Query data (same as getSalesReport) ---
    const { range = '30d' } = req.query;
    let sinceSql = '';
    let label = 'All Time';
    if (range === '7d') { sinceSql = "AND o.createdAt >= datetime('now', '-7 days')"; label = 'Last 7 Days'; }
    if (range === '30d') { sinceSql = "AND o.createdAt >= datetime('now', '-30 days')"; label = 'Last 30 Days'; }
    if (range === '90d') { sinceSql = "AND o.createdAt >= datetime('now', '-90 days')"; label = 'Last 90 Days'; }

    const summary = db.prepare(`
      SELECT COUNT(DISTINCT o.id) as totalOrders, COUNT(DISTINCT o.userId) as uniqueCustomers,
             COALESCE(SUM(o.totalAmount), 0) as revenue, COALESCE(AVG(o.totalAmount), 0) as averageOrderValue
      FROM orders o WHERE o.status != 'cancelled' ${sinceSql}
    `).get();

    const topProducts = db.prepare(`
      SELECT oi.productId, oi.name, SUM(oi.quantity) as quantitySold, COALESCE(SUM(oi.quantity * oi.price), 0) as revenue
      FROM order_items oi JOIN orders o ON o.id = oi.orderId
      WHERE o.status != 'cancelled' ${sinceSql.replace(/o\.createdAt/g, 'o.createdAt')}
      GROUP BY oi.productId, oi.name ORDER BY quantitySold DESC LIMIT 20
    `).all().map(r => ({ name: String(r.name || 'Unknown Product').trim() || 'Unknown Product', quantitySold: Number(r.quantitySold || 0), revenue: Number(r.revenue || 0) }));

    const orderStatus = db.prepare(`
      SELECT CASE WHEN TRIM(COALESCE(o.status, '')) = '' THEN 'unknown' ELSE LOWER(TRIM(o.status)) END as status, COUNT(*) as count
      FROM orders o WHERE 1 = 1 ${sinceSql} GROUP BY status ORDER BY count DESC
    `).all().map(r => ({ status: String(r.status || 'unknown').trim() || 'unknown', count: Number(r.count || 0) }));

    const categorySales = db.prepare(`
      SELECT CASE WHEN TRIM(COALESCE(p.category, '')) = '' THEN 'Uncategorized' ELSE p.category END as category,
             SUM(oi.quantity) as quantitySold, COALESCE(SUM(oi.quantity * oi.price), 0) as revenue
      FROM order_items oi JOIN orders o ON o.id = oi.orderId
      LEFT JOIN products p ON CAST(p.id AS TEXT) = CAST(oi.productId AS TEXT)
      WHERE o.status != 'cancelled' ${sinceSql} GROUP BY category ORDER BY revenue DESC LIMIT 20
    `).all().map(r => ({ category: String(r.category || 'Uncategorized').trim() || 'Uncategorized', quantitySold: Number(r.quantitySold || 0), revenue: Number(r.revenue || 0) }));

    const dailySales = db.prepare(`
      SELECT DATE(o.createdAt) as day, COUNT(*) as orderCount, COALESCE(SUM(o.totalAmount), 0) as revenue
      FROM orders o WHERE o.status != 'cancelled' ${sinceSql} GROUP BY DATE(o.createdAt) ORDER BY day ASC
    `).all().map(r => ({ day: r.day, orderCount: Number(r.orderCount || 0), revenue: Number(r.revenue || 0) }));

    // --- Build PDF ---
    const pdfDoc = await PDFDocument.create();
    const font = await pdfDoc.embedFont(StandardFonts.Helvetica);
    const fontBold = await pdfDoc.embedFont(StandardFonts.HelveticaBold);

    // Embed logo
    let logo = null;
    if (shopLogoDataUri) {
      try {
        const logoPath = path.resolve(__dirname, '../../assets/shop_logo.png');
        const logoBytes = fs.readFileSync(logoPath);
        const isJpeg = logoBytes[0] === 0xFF && logoBytes[1] === 0xD8;
        logo = isJpeg ? await pdfDoc.embedJpg(logoBytes) : await pdfDoc.embedPng(logoBytes);
      } catch {}
    }

    const rangeLabel = safeText(label);
    const generatedAt = new Date().toLocaleString('en-PH');

    function drawReportHeader(page) {
      page.drawRectangle({ x: 0, y: PAGE_HEIGHT - 108, width: PAGE_WIDTH, height: 108, color: BRAND_LIGHT });
      const titleY = PAGE_HEIGHT - PAGE_MARGIN;
      let textX = PAGE_MARGIN;
      if (logo) {
        page.drawImage(logo, { x: PAGE_MARGIN, y: titleY - 42 + 6, width: 42, height: 42 });
        textX += 54;
      }
      page.drawText(safeText(SHOP_NAME), { x: textX, y: titleY, size: 16, font: fontBold, color: BRAND_PRIMARY });
      page.drawText('Sales Report', { x: textX, y: titleY - 18, size: 11, font });
      page.drawText(safeText(`Range: ${rangeLabel}`), { x: textX, y: titleY - 32, size: 10, font });
      page.drawText(safeText(`Generated: ${generatedAt}`), { x: textX, y: titleY - 45, size: 10, font });
      page.drawLine({ start: { x: PAGE_MARGIN, y: PAGE_HEIGHT - 110 }, end: { x: PAGE_WIDTH - PAGE_MARGIN, y: PAGE_HEIGHT - 110 }, thickness: 1, color: TABLE_BORDER });
    }

    function ensureSpace(state, neededHeight) {
      if (state.y - neededHeight >= PAGE_MARGIN) return state;
      const page = pdfDoc.addPage([PAGE_WIDTH, PAGE_HEIGHT]);
      drawReportHeader(page);
      return { ...state, page, y: PAGE_HEIGHT - PAGE_MARGIN - 88 };
    }

    function drawSectionTitle(state, title) {
      const next = ensureSpace(state, 24);
      next.page.drawText(title, { x: PAGE_MARGIN, y: next.y, size: 13, font: fontBold });
      return { ...next, y: next.y - 20 };
    }

    function drawTextLine(state, text, isBold = false) {
      const next = ensureSpace(state, 16);
      next.page.drawText(safeText(text), { x: PAGE_MARGIN, y: next.y, size: 10, font: isBold ? fontBold : font });
      return { ...next, y: next.y - 14 };
    }

    function drawTable(state, headers, rows) {
      let next = ensureSpace(state, 22);
      const tableWidth = PAGE_WIDTH - PAGE_MARGIN * 2;
      const colWidths = headers.length === 3
        ? [tableWidth * 0.46, tableWidth * 0.24, tableWidth * 0.30]
        : headers.length === 2
          ? [tableWidth * 0.65, tableWidth * 0.35]
          : new Array(headers.length).fill(tableWidth / headers.length);
      const normalizedRows = rows.length ? rows : [['No data available', ...new Array(Math.max(0, headers.length - 1)).fill('-')]];

      const headerTop = next.y + 3;
      next.page.drawRectangle({ x: PAGE_MARGIN, y: headerTop - ROW_HEIGHT + 4, width: tableWidth, height: ROW_HEIGHT, color: BRAND_LIGHT, borderColor: TABLE_BORDER, borderWidth: 0.5 });
      headers.forEach((header, i) => {
        const xOff = colWidths.slice(0, i).reduce((s, w) => s + w, 0);
        next.page.drawText(safeText(header), { x: PAGE_MARGIN + xOff + 4, y: next.y, size: 10, font: fontBold, color: BRAND_PRIMARY });
      });
      next.y -= ROW_HEIGHT;

      normalizedRows.forEach((row, ri) => {
        next = ensureSpace(next, ROW_HEIGHT);
        if (ri % 2 === 1) next.page.drawRectangle({ x: PAGE_MARGIN, y: next.y - 3, width: tableWidth, height: ROW_HEIGHT, color: TABLE_ALT });
        row.forEach((cell, i) => {
          const xOff = colWidths.slice(0, i).reduce((s, w) => s + w, 0);
          const text = safeText(cell);
          const clipped = text.length > 44 ? `${text.slice(0, 41)}...` : text;
          next.page.drawText(clipped, { x: PAGE_MARGIN + xOff + 4, y: next.y, size: 10, font });
        });
        next.y -= ROW_HEIGHT;
      });
      return { ...next, y: next.y - 6 };
    }

    // --- Compose pages ---
    let page = pdfDoc.addPage([PAGE_WIDTH, PAGE_HEIGHT]);
    drawReportHeader(page);
    let state = { page, y: PAGE_HEIGHT - PAGE_MARGIN - 88 };

    state = drawSectionTitle(state, 'Summary');
    state = drawTextLine(state, `Range: ${rangeLabel}`);
    state = drawTextLine(state, `Total Orders: ${summary.totalOrders || 0}`);
    state = drawTextLine(state, `Revenue: ${formatMoney(summary.revenue)}`);
    state = drawTextLine(state, `Unique Customers: ${summary.uniqueCustomers || 0}`);
    state = drawTextLine(state, `Average Order Value: ${formatMoney(summary.averageOrderValue)}`);

    state = drawSectionTitle(state, 'Top Products');
    state = drawTable(state, ['Product', 'Quantity Sold', 'Revenue'],
      topProducts.map(p => [safeText(p.name), String(p.quantitySold), formatMoney(p.revenue)]));

    state = drawSectionTitle(state, 'Order Status Breakdown');
    state = drawTable(state, ['Status', 'Count'],
      orderStatus.map(r => [safeText(r.status), String(r.count)]));

    state = drawSectionTitle(state, 'Category Performance');
    state = drawTable(state, ['Category', 'Qty Sold', 'Revenue'],
      categorySales.map(r => [safeText(r.category), String(r.quantitySold), formatMoney(r.revenue)]));

    state = drawSectionTitle(state, 'Daily Sales');
    state = drawTable(state, ['Date', 'Orders', 'Revenue'],
      dailySales.map(r => [safeText(r.day), String(r.orderCount), formatMoney(r.revenue)]));

    const pdfBytes = await pdfDoc.save();
    const stamp = new Date().toISOString().slice(0, 10);

    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="sales-report-${range}-${stamp}.pdf"`);
    res.setHeader('Content-Length', pdfBytes.length);
    res.end(Buffer.from(pdfBytes));
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};