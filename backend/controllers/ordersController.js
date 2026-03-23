const { Expo } = require('expo-server-sdk');
const mongoose = require('mongoose');
const Notification = require('../models/Notification');
const PushToken = require('../models/PushToken');
const Order = require('../models/Order');
const User = require('../models/User');
const Product = require('../models/Product');
const { formatOrder } = require('../utils/formatters');
const { sendMail } = require('../utils/mailer');

const expo = new Expo();

const STATUS_MESSAGES = {
  confirmed: 'Your order has been confirmed!',
  processing: 'Your order is being processed.',
  shipped: 'Your order has been shipped!',
  delivered: 'Your order has been delivered!',
  cancelled: 'Your order has been cancelled.',
};

const isValidObjectId = (value) => mongoose.Types.ObjectId.isValid(String(value || ''));

const logPushReceiptStatuses = async (ticketToTokenMap, userId) => {
  const ticketIds = Object.keys(ticketToTokenMap || {});
  if (!ticketIds.length) return;

  try {
    const receiptIdChunks = expo.chunkPushNotificationReceiptIds(ticketIds);
    for (const receiptIdChunk of receiptIdChunks) {
      const receipts = await expo.getPushNotificationReceiptsAsync(receiptIdChunk);
      const values = Object.values(receipts || {});
      if (values.length) {
        console.log('[Push] Receipt details:', JSON.stringify(values));
      }

      for (const receiptId of Object.keys(receipts || {})) {
        const receipt = receipts[receiptId];
        const token = ticketToTokenMap[receiptId];
        if (receipt?.status === 'error' && receipt?.details?.error === 'DeviceNotRegistered' && token) {
          try {
            await PushToken.deleteOne({ userId, token });
          } catch (mongoErr) {
            console.error('Push token Mongo cleanup error:', mongoErr.message);
          }
        }
      }
    }
  } catch (err) {
    console.error('[Push] Failed to fetch receipt details:', err.message);
  }
};

const sendPushNotification = async (userId, title, body, data = {}) => {
  try {
    const mongoTokens = await PushToken.find({ userId }, { token: 1, _id: 0 }).lean();
    const tokenSet = new Set(mongoTokens.map((t) => t.token));
    if (!tokenSet.size) {
      console.log(`[Push] No tokens found for user: ${userId} (mongo=${mongoTokens.length})`);
      return;
    }

    const messages = [];
    const validTokens = [];

    for (const token of tokenSet) {
      if (Expo.isExpoPushToken(token)) {
        validTokens.push(token);
        messages.push({
          to: token,
          sound: 'default',
          title,
          body,
          data,
          channelId: 'default',
          priority: 'high',
        });
      }
    }

    if (messages.length === 0) {
      console.log('[Push] Tokens found but none are valid Expo tokens for user:', userId);
      return;
    }

    console.log('[Push] Sending', messages.length, 'messages for user:', userId, 'title:', title);

    const chunks = expo.chunkPushNotifications(messages);
    const ticketToTokenMap = {};
    let messageOffset = 0;

    for (const chunk of chunks) {
      try {
        const tickets = await expo.sendPushNotificationsAsync(chunk);
        console.log('[Push] Tickets:', JSON.stringify(tickets));
        for (let i = 0; i < tickets.length; i++) {
          const tokenIndex = messageOffset + i;
          const token = validTokens[tokenIndex];
          if (tickets[i].id && token) ticketToTokenMap[tickets[i].id] = token;
          if (tickets[i].status === 'error' && tickets[i].details?.error === 'DeviceNotRegistered' && token) {
            try {
              await PushToken.deleteOne({ userId, token });
            } catch (mongoErr) {
              console.error('Push token Mongo cleanup error:', mongoErr.message);
            }
          }
        }
        messageOffset += chunk.length;
      } catch (error) {
        console.error('Push notification error:', error.message);
      }
    }

    setTimeout(() => {
      logPushReceiptStatuses(ticketToTokenMap, userId);
    }, 4000);
  } catch (err) {
    console.error('Send notification error:', err.message);
  }
};

const enrichItemsFromProducts = async (items) => {
  const productIds = items
    .map((item) => String(item.productId || item.product || '').trim())
    .filter((id) => isValidObjectId(id));

  if (!productIds.length) {
    return items.map((item) => ({
      productId: null,
      name: String(item.name || '').trim(),
      price: Number(item.price || 0),
      quantity: Number(item.quantity || 1),
      image: String(item.image || '').trim(),
    }));
  }

  const products = await Product.find({ _id: { $in: productIds } }, { _id: 1, name: 1, price: 1, image: 1 }).lean();
  const productMap = new Map(products.map((p) => [String(p._id), p]));

  return items.map((item) => {
    const rawId = String(item.productId || item.product || '').trim();
    const product = productMap.get(rawId);
    return {
      productId: product ? product._id : null,
      name: String(item.name || product?.name || '').trim(),
      price: Number(item.price ?? product?.price ?? 0),
      quantity: Number(item.quantity || 1),
      image: String(item.image || product?.image || '').trim(),
    };
  });
};

exports.createOrder = async (req, res) => {
  try {
    const { items, totalAmount, shippingAddress, paymentMethod } = req.body;
    if (!Array.isArray(items) || !items.length) {
      return res.status(400).json({ message: 'Order must have items' });
    }

    for (const item of items) {
      const productId = String(item.productId || item.product || '').trim();
      if (!productId || productId === 'undefined' || !isValidObjectId(productId)) {
        return res.status(400).json({ message: 'Invalid product in cart. Please clear your cart and re-add items.' });
      }
      const qty = Number(item.quantity || 0);
      if (!Number.isInteger(qty) || qty <= 0) {
        return res.status(400).json({ message: 'Invalid item quantity in cart.' });
      }
    }

    const normalizedItems = await enrichItemsFromProducts(items);

    const createdOrder = await Order.create({
      userId: req.user.id,
      totalAmount: Number(totalAmount || 0),
      shippingAddress: String(shippingAddress || '').trim(),
      paymentMethod: String(paymentMethod || 'cod').trim() || 'cod',
      status: 'pending',
      items: normalizedItems,
      statusHistory: [{ status: 'pending', note: 'Order placed' }],
    });

    const notifBody = `Your order #${String(createdOrder._id).slice(-8)} has been placed successfully!`;

    try {
      await Notification.create({
        userId: req.user.id,
        title: 'Order Placed',
        body: notifBody,
        data: { orderId: String(createdOrder._id), type: 'order_update' },
        type: 'order_update',
        isRead: false,
        isBroadcast: false,
      });
    } catch (mongoNotifErr) {
      console.error('Order placed notification (Mongo) error:', mongoNotifErr.message);
    }

    sendPushNotification(req.user.id, 'Order Placed', notifBody, {
      orderId: String(createdOrder._id),
      type: 'order_update',
    });

    try {
      const user = await User.findById(req.user.id, { email: 1, name: 1 }).lean();
      if (user?.email) {
        const subject = `Order Placed - ${String(createdOrder._id).slice(-8)}`;
        const text = `Hi ${user.name || 'Customer'},\n\n${notifBody}\n\nOrder ID: ${createdOrder._id}\nPayment: ${paymentMethod || 'cod'}\nTotal: ${totalAmount}`;
        await sendMail({ to: user.email, subject, text });
      } else {
        console.log('[Mail] Order placed email skipped: user has no email on file. userId=', req.user.id);
      }
    } catch (err) {
      console.error('Order placed email error:', err.message);
    }

    const order = await Order.findById(createdOrder._id)
      .populate('items.productId', 'name image price')
      .lean();

    res.status(201).json(formatOrder(order));
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

exports.getMyOrders = async (req, res) => {
  try {
    const orders = await Order.find({ userId: req.user.id })
      .sort({ createdAt: -1 })
      .populate('items.productId', 'name image price')
      .lean();

    res.json(orders.map((order) => formatOrder(order)));
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

exports.getOrderById = async (req, res) => {
  try {
    const order = await Order.findById(req.params.id)
      .populate('items.productId', 'name image price')
      .populate('userId', 'name email')
      .lean();

    if (!order) return res.status(404).json({ message: 'Order not found' });

    const ownerId = String(order.userId?._id || order.userId);
    if (ownerId !== req.user.id && req.user.role !== 'admin') {
      return res.status(403).json({ message: 'Not authorized' });
    }

    res.json(formatOrder(order));
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

exports.updateOrderStatus = async (req, res) => {
  try {
    if (req.user.role !== 'admin') return res.status(403).json({ message: 'Admin only' });

    const { status, note } = req.body;
    const order = await Order.findById(req.params.id).populate('userId', 'email name').lean();
    if (!order) return res.status(404).json({ message: 'Order not found' });

    await Order.updateOne(
      { _id: req.params.id },
      {
        $set: { status },
        $push: { statusHistory: { status, note: note || `Status updated to ${status}`, date: new Date() } },
      }
    );

    const notifBody = STATUS_MESSAGES[status] || `Order status updated to ${status}`;

    try {
      await Notification.create({
        userId: order.userId?._id || order.userId,
        title: 'Order Update',
        body: notifBody,
        data: { orderId: String(order._id), type: 'order_update' },
        type: 'order_update',
        isRead: false,
        isBroadcast: false,
      });
    } catch (mongoNotifErr) {
      console.error('Order update notification (Mongo) error:', mongoNotifErr.message);
    }

    const orderUserId = String(order.userId?._id || order.userId);
    sendPushNotification(orderUserId, 'Order Update', notifBody, {
      orderId: String(order._id),
      type: 'order_update',
    });

    try {
      if (order.userId?.email) {
        const subject = `Order Update - ${String(order._id).slice(-8)}`;
        const text = `${notifBody}\n\nOrder ID: ${order._id}\nStatus: ${status}${note ? `\nNote: ${note}` : ''}`;
        await sendMail({ to: order.userId.email, subject, text });
      }
    } catch (err) {
      console.error('Order status email error:', err.message);
    }

    const updated = await Order.findById(req.params.id)
      .populate('items.productId', 'name image price')
      .populate('userId', 'name email')
      .lean();

    res.json(formatOrder(updated));
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

exports.getAllOrders = async (req, res) => {
  try {
    if (req.user.role !== 'admin') return res.status(403).json({ message: 'Admin only' });

    const orders = await Order.find({})
      .sort({ createdAt: -1 })
      .populate('items.productId', 'name image price')
      .populate('userId', 'name email')
      .lean();

    res.json(orders.map((order) => formatOrder(order, { withAdminUser: true })));
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};
