const User = require('../models/User');
const Product = require('../models/Product');
const Order = require('../models/Order');

exports.getStats = async (req, res) => {
  try {
    if (req.user.role !== 'admin') return res.status(403).json({ message: 'Admin only' });

    const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);

    const [
      totalUsers,
      totalProducts,
      totalOrders,
      pendingOrders,
      newUsersThisWeek,
      revenueAgg,
      ordersByStatus,
      recentOrdersRaw,
      topProducts,
      lowStock,
      dailyOrders,
    ] = await Promise.all([
      User.countDocuments({ role: 'user' }),
      Product.countDocuments({}),
      Order.countDocuments({}),
      Order.countDocuments({ status: 'pending' }),
      User.countDocuments({ role: 'user', createdAt: { $gte: sevenDaysAgo } }),
      Order.aggregate([
        { $match: { status: { $ne: 'cancelled' } } },
        { $group: { _id: null, total: { $sum: '$totalAmount' } } },
      ]),
      Order.aggregate([
        { $group: { _id: '$status', count: { $sum: 1 } } },
        { $project: { _id: 0, status: '$_id', count: 1 } },
      ]),
      Order.find({})
        .sort({ createdAt: -1 })
        .limit(5)
        .populate('userId', 'name email')
        .lean(),
      Order.aggregate([
        { $match: { status: { $ne: 'cancelled' } } },
        { $unwind: '$items' },
        {
          $group: {
            _id: '$items.productId',
            name: { $first: '$items.name' },
            totalSold: { $sum: '$items.quantity' },
            totalRevenue: { $sum: { $multiply: ['$items.price', '$items.quantity'] } },
          },
        },
        { $sort: { totalSold: -1 } },
        { $limit: 5 },
        { $project: { _id: 0, productId: '$_id', name: 1, totalSold: 1, totalRevenue: 1 } },
      ]),
      Product.find({ isService: false, stock: { $lte: 10 } }, { name: 1, stock: 1, category: 1 })
        .sort({ stock: 1 })
        .limit(5)
        .lean(),
      Order.aggregate([
        { $match: { createdAt: { $gte: sevenDaysAgo } } },
        {
          $group: {
            _id: {
              y: { $year: '$createdAt' },
              m: { $month: '$createdAt' },
              d: { $dayOfMonth: '$createdAt' },
            },
            count: { $sum: 1 },
            revenue: { $sum: '$totalAmount' },
          },
        },
        { $sort: { '_id.y': -1, '_id.m': -1, '_id.d': -1 } },
      ]),
    ]);

    const totalRevenue = revenueAgg[0]?.total || 0;

    const recentOrders = recentOrdersRaw.map((order) => ({
      _id: String(order._id),
      user: {
        name: order.userId?.name,
        email: order.userId?.email,
      },
      totalAmount: order.totalAmount,
      status: order.status,
      itemCount: (order.items || []).length,
      createdAt: order.createdAt,
    }));

    const normalizedLowStock = lowStock.map((item) => ({
      _id: String(item._id),
      name: item.name,
      stock: item.stock,
      category: item.category,
    }));

    const normalizedDailyOrders = dailyOrders.map((entry) => ({
      date: `${entry._id.y}-${String(entry._id.m).padStart(2, '0')}-${String(entry._id.d).padStart(2, '0')}`,
      count: entry.count,
      revenue: entry.revenue,
    }));

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
      lowStock: normalizedLowStock,
      dailyOrders: normalizedDailyOrders,
    });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};
