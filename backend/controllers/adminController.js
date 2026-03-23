const mongoose = require('mongoose');
const User = require('../models/User');
const Product = require('../models/Product');
const Order = require('../models/Order');
const Review = require('../models/Review');
const PushToken = require('../models/PushToken');
const { sendMail } = require('../utils/mailer');

const ALLOWED_DEACTIVATION_REASONS = [
  'Fraudulent activity',
  'Repeated policy violations',
  'Harassment or abusive behavior',
  'Spam or fake transactions',
  'Security risk',
  'Requested by user',
];

const SHOP_NAME = 'Hardware Haven';

const requireAdmin = (req, res) => {
  if (req.user?.role !== 'admin') {
    res.status(403).json({ message: 'Admin only' });
    return false;
  }
  return true;
};

const toId = (value) => {
  if (!value) return null;
  if (typeof value === 'string') return value;
  if (value._id) return String(value._id);
  return String(value);
};

const toRangeStartDate = (range) => {
  const now = Date.now();
  if (range === '7d') return new Date(now - 7 * 24 * 60 * 60 * 1000);
  if (range === '30d') return new Date(now - 30 * 24 * 60 * 60 * 1000);
  if (range === '90d') return new Date(now - 90 * 24 * 60 * 60 * 1000);
  return null;
};

const toRangeLabel = (range) => {
  if (range === '7d') return 'Last 7 Days';
  if (range === '30d') return 'Last 30 Days';
  if (range === '90d') return 'Last 90 Days';
  return 'All Time';
};

const normalizeInventoryProduct = (p) => ({
  _id: String(p._id),
  name: p.name,
  category: p.category,
  stock: Number(p.stock || 0),
  isService: !!p.isService,
  isActive: p.isActive !== false,
  deletedAt: p.deletedAt || null,
  deletedReason: p.deletedReason || '',
  price: Number(p.price || 0),
  image: p.image || '',
  images: p.image ? [p.image] : [],
  description: p.description || '',
  updatedAt: p.updatedAt,
});

const recalcProductRating = async (productId) => {
  if (!productId) return;
  const matchProductId = mongoose.Types.ObjectId.isValid(String(productId))
    ? new mongoose.Types.ObjectId(String(productId))
    : productId;

  const stats = await Review.aggregate([
    { $match: { productId: matchProductId } },
    {
      $group: {
        _id: '$productId',
        numReviews: { $sum: 1 },
        averageRating: { $avg: '$rating' },
      },
    },
  ]);

  const numReviews = stats[0]?.numReviews || 0;
  const averageRating = stats[0]?.averageRating || 0;
  await Product.findByIdAndUpdate(productId, {
    $set: {
      numReviews,
      averageRating: Math.round(averageRating * 10) / 10,
    },
  });
};

const getSalesData = async (range = '30d') => {
  const since = toRangeStartDate(range);
  const label = toRangeLabel(range);

  const orderMatch = { status: { $ne: 'cancelled' } };
  if (since) orderMatch.createdAt = { $gte: since };

  const [summaryAgg, topProductsAgg, orderStatusAgg, categorySalesAgg, dailySalesAgg] = await Promise.all([
    Order.aggregate([
      { $match: orderMatch },
      {
        $group: {
          _id: null,
          totalOrders: { $sum: 1 },
          uniqueUsers: { $addToSet: '$userId' },
          revenue: { $sum: '$totalAmount' },
          averageOrderValue: { $avg: '$totalAmount' },
        },
      },
      {
        $project: {
          _id: 0,
          totalOrders: 1,
          uniqueCustomers: { $size: '$uniqueUsers' },
          revenue: 1,
          averageOrderValue: 1,
        },
      },
    ]),
    Order.aggregate([
      { $match: orderMatch },
      { $unwind: '$items' },
      {
        $group: {
          _id: '$items.productId',
          name: { $first: '$items.name' },
          quantitySold: { $sum: '$items.quantity' },
          revenue: { $sum: { $multiply: ['$items.price', '$items.quantity'] } },
        },
      },
      { $sort: { quantitySold: -1 } },
      { $limit: 20 },
    ]),
    Order.aggregate([
      {
        $match: since
          ? { createdAt: { $gte: since } }
          : {},
      },
      {
        $group: {
          _id: {
            $cond: [
              {
                $or: [
                  { $eq: ['$status', null] },
                  { $eq: [{ $trim: { input: '$status' } }, ''] },
                ],
              },
              'unknown',
              { $toLower: { $trim: { input: '$status' } } },
            ],
          },
          count: { $sum: 1 },
        },
      },
      { $sort: { count: -1 } },
      { $project: { _id: 0, status: '$_id', count: 1 } },
    ]),
    Order.aggregate([
      { $match: orderMatch },
      { $unwind: '$items' },
      {
        $lookup: {
          from: 'products',
          localField: 'items.productId',
          foreignField: '_id',
          as: 'productRef',
        },
      },
      {
        $project: {
          quantity: '$items.quantity',
          itemRevenue: { $multiply: ['$items.price', '$items.quantity'] },
          category: {
            $ifNull: [
              { $arrayElemAt: ['$productRef.category', 0] },
              'Uncategorized',
            ],
          },
        },
      },
      {
        $group: {
          _id: '$category',
          quantitySold: { $sum: '$quantity' },
          revenue: { $sum: '$itemRevenue' },
        },
      },
      { $sort: { revenue: -1 } },
      { $limit: 20 },
      { $project: { _id: 0, category: '$_id', quantitySold: 1, revenue: 1 } },
    ]),
    Order.aggregate([
      { $match: orderMatch },
      {
        $group: {
          _id: {
            y: { $year: '$createdAt' },
            m: { $month: '$createdAt' },
            d: { $dayOfMonth: '$createdAt' },
          },
          orderCount: { $sum: 1 },
          revenue: { $sum: '$totalAmount' },
        },
      },
      { $sort: { '_id.y': 1, '_id.m': 1, '_id.d': 1 } },
    ]),
  ]);

  const summary = summaryAgg[0] || {
    totalOrders: 0,
    uniqueCustomers: 0,
    revenue: 0,
    averageOrderValue: 0,
  };

  const topProducts = topProductsAgg.map((row) => ({
    productId: toId(row._id),
    name: String(row.name || 'Unknown Product').trim() || 'Unknown Product',
    quantitySold: Number(row.quantitySold || 0),
    revenue: Number(row.revenue || 0),
  }));

  const orderStatus = orderStatusAgg.map((row) => ({
    status: String(row.status || 'unknown').trim() || 'unknown',
    count: Number(row.count || 0),
  }));

  const categorySales = categorySalesAgg.map((row) => ({
    category: String(row.category || 'Uncategorized').trim() || 'Uncategorized',
    quantitySold: Number(row.quantitySold || 0),
    revenue: Number(row.revenue || 0),
  }));

  const dailySales = dailySalesAgg.map((row) => ({
    day: `${row._id.y}-${String(row._id.m).padStart(2, '0')}-${String(row._id.d).padStart(2, '0')}`,
    orderCount: Number(row.orderCount || 0),
    revenue: Number(row.revenue || 0),
  }));

  return {
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
    dailySales,
  };
};

exports.getAnalytics = async (req, res) => {
  try {
    if (!requireAdmin(req, res)) return;

    const [
      totalUsers,
      totalProducts,
      totalOrders,
      pendingOrders,
      lowStockCount,
      revenueAgg,
      orderStatus,
      monthlyRevenue,
      categorySales,
    ] = await Promise.all([
      User.countDocuments({ role: 'user' }),
      Product.countDocuments({}),
      Order.countDocuments({}),
      Order.countDocuments({ status: 'pending' }),
      Product.countDocuments({ isService: false, stock: { $lte: 10 } }),
      Order.aggregate([
        { $match: { status: { $ne: 'cancelled' } } },
        { $group: { _id: null, total: { $sum: '$totalAmount' } } },
      ]),
      Order.aggregate([
        { $group: { _id: '$status', count: { $sum: 1 } } },
        { $sort: { count: -1 } },
        { $project: { _id: 0, status: '$_id', count: 1 } },
      ]),
      Order.aggregate([
        {
          $match: {
            status: { $ne: 'cancelled' },
            createdAt: { $gte: new Date(Date.now() - 183 * 24 * 60 * 60 * 1000) },
          },
        },
        {
          $group: {
            _id: {
              y: { $year: '$createdAt' },
              m: { $month: '$createdAt' },
            },
            revenue: { $sum: '$totalAmount' },
          },
        },
        { $sort: { '_id.y': 1, '_id.m': 1 } },
      ]),
      Order.aggregate([
        { $match: { status: { $ne: 'cancelled' } } },
        { $unwind: '$items' },
        {
          $lookup: {
            from: 'products',
            localField: 'items.productId',
            foreignField: '_id',
            as: 'productRef',
          },
        },
        {
          $project: {
            category: {
              $ifNull: [
                { $arrayElemAt: ['$productRef.category', 0] },
                'Uncategorized',
              ],
            },
            sold: '$items.quantity',
            revenue: { $multiply: ['$items.quantity', '$items.price'] },
          },
        },
        {
          $group: {
            _id: '$category',
            sold: { $sum: '$sold' },
            revenue: { $sum: '$revenue' },
          },
        },
        { $sort: { revenue: -1 } },
        { $project: { _id: 0, category: '$_id', sold: 1, revenue: 1 } },
      ]),
    ]);

    res.json({
      totalUsers,
      totalProducts,
      totalOrders,
      totalRevenue: Number(revenueAgg[0]?.total || 0),
      pendingOrders,
      lowStockCount,
      orderStatus,
      monthlyRevenue: monthlyRevenue.map((row) => ({
        month: `${row._id.y}-${String(row._id.m).padStart(2, '0')}`,
        revenue: Number(row.revenue || 0),
      })),
      categorySales: categorySales.map((row) => ({
        category: row.category,
        sold: Number(row.sold || 0),
        revenue: Number(row.revenue || 0),
      })),
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

    await PushToken.deleteMany({ userId: req.params.id });

    res.json({ message: 'User deleted' });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

exports.getInventory = async (req, res) => {
  try {
    if (!requireAdmin(req, res)) return;

    const products = await Product.find({})
      .sort({ isService: 1, stock: 1, name: 1 })
      .lean();

    res.json(products.map(normalizeInventoryProduct));
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

exports.setProductActiveStatus = async (req, res) => {
  try {
    if (!requireAdmin(req, res)) return;

    const { isActive, reason = '' } = req.body;
    if (typeof isActive !== 'boolean') {
      return res.status(400).json({ message: 'isActive must be true or false' });
    }

    const trimmedReason = String(reason || '').trim();

    const updated = await Product.findByIdAndUpdate(
      req.params.productId,
      {
        $set: {
          isActive,
          deletedAt: isActive ? null : new Date(),
          deletedReason: isActive ? '' : (trimmedReason || 'Deactivated by admin'),
        },
      },
      { new: true }
    ).lean();

    if (!updated) {
      return res.status(404).json({ message: 'Product not found' });
    }

    res.json(normalizeInventoryProduct(updated));
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

exports.updateInventory = async (req, res) => {
  try {
    if (!requireAdmin(req, res)) return;

    const product = await Product.findById(req.params.productId).lean();
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

    const updated = await Product.findByIdAndUpdate(
      req.params.productId,
      { $set: { stock: nextStock } },
      { new: true }
    ).lean();

    res.json({
      ...normalizeInventoryProduct(updated),
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
      .populate('productId', 'name')
      .sort({ createdAt: -1 })
      .lean();

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
      product: review.productId ? {
        _id: String(review.productId._id),
        name: review.productId.name,
      } : null,
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

    await recalcProductRating(deleted.productId);

    res.json({ message: 'Review deleted' });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

exports.getSalesReport = async (req, res) => {
  try {
    if (!requireAdmin(req, res)) return;

    const { range = '30d' } = req.query;
    const report = await getSalesData(range);

    const rowsOrEmpty = (rowsHtml, colSpan) => rowsHtml || `<tr><td colspan="${colSpan}" style="text-align:center;color:#777;">No data available</td></tr>`;

    const printableHtml = `<!doctype html>
<html>
<head>
  <meta charset="utf-8" />
  <title>${SHOP_NAME} Sales Report</title>
  <style>
    body { font-family: Arial, sans-serif; padding: 24px; color: #222; }
    h1, h2 { margin: 0 0 8px; }
    .meta { color: #666; margin-bottom: 18px; }
    .stats { display: flex; gap: 14px; margin-bottom: 20px; }
    .card { border: 1px solid #ddd; border-radius: 8px; padding: 10px 14px; min-width: 180px; }
    table { width: 100%; border-collapse: collapse; margin-top: 10px; }
    th, td { border: 1px solid #ddd; padding: 8px; text-align: left; font-size: 12px; }
    th { background: #f5f5f5; }
  </style>
</head>
<body>
  <h1>${SHOP_NAME} Sales Report</h1>
  <div class="meta">Range: ${report.label} | Generated: ${new Date().toLocaleString()}</div>
  <div class="stats">
    <div class="card"><div>Total Orders</div><strong>${report.summary.totalOrders}</strong></div>
    <div class="card"><div>Customers</div><strong>${report.summary.uniqueCustomers}</strong></div>
    <div class="card"><div>Revenue</div><strong>PHP ${Number(report.summary.revenue || 0).toFixed(2)}</strong></div>
    <div class="card"><div>Avg Order Value</div><strong>PHP ${Number(report.summary.averageOrderValue || 0).toFixed(2)}</strong></div>
  </div>
  <h2>Top Products</h2>
  <table>
    <thead><tr><th>Product</th><th>Quantity Sold</th><th>Revenue (PHP)</th></tr></thead>
    <tbody>
      ${rowsOrEmpty(report.topProducts.map((p) => `<tr><td>${String(p.name || '').replace(/</g, '&lt;')}</td><td>${p.quantitySold}</td><td>${Number(p.revenue || 0).toFixed(2)}</td></tr>`).join(''), 3)}
    </tbody>
  </table>
</body>
</html>`;

    res.json({ ...report, printableHtml });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

exports.getSalesReportPdf = async (req, res) => {
  try {
    if (!requireAdmin(req, res)) return;

    const { PDFDocument, StandardFonts } = require('pdf-lib');
    const { range = '30d' } = req.query;
    const report = await getSalesData(range);

    const pdf = await PDFDocument.create();
    const page = pdf.addPage([595, 842]);
    const font = await pdf.embedFont(StandardFonts.Helvetica);
    const bold = await pdf.embedFont(StandardFonts.HelveticaBold);

    let y = 800;
    const drawLine = (text, options = {}) => {
      page.drawText(String(text), {
        x: options.x || 40,
        y,
        size: options.size || 11,
        font: options.bold ? bold : font,
      });
      y -= options.gap || 16;
    };

    drawLine(`${SHOP_NAME} Sales Report`, { bold: true, size: 18, gap: 24 });
    drawLine(`Range: ${report.label}`);
    drawLine(`Generated: ${new Date().toLocaleString()}`, { gap: 24 });

    drawLine(`Total Orders: ${report.summary.totalOrders}`);
    drawLine(`Unique Customers: ${report.summary.uniqueCustomers}`);
    drawLine(`Revenue: PHP ${Number(report.summary.revenue || 0).toFixed(2)}`);
    drawLine(`Avg Order Value: PHP ${Number(report.summary.averageOrderValue || 0).toFixed(2)}`, { gap: 24 });

    drawLine('Top Products', { bold: true, gap: 18 });
    for (const p of report.topProducts.slice(0, 20)) {
      drawLine(`- ${p.name}: ${p.quantitySold} sold, PHP ${Number(p.revenue || 0).toFixed(2)}`);
      if (y < 60) break;
    }

    const bytes = await pdf.save();
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="sales-report-${range}.pdf"`);
    res.send(Buffer.from(bytes));
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};
