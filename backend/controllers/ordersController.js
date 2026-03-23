const { v4: uuidv4 } = require('uuid');
const { Expo } = require('expo-server-sdk');
const db = require('../database');
const Notification = require('../models/Notification');
const PushToken = require('../models/PushToken');

const { sendMail } = require('../utils/mailer');

const expo = new Expo();

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
        if (
          receipt?.status === 'error' &&
          receipt?.details?.error === 'DeviceNotRegistered' &&
          token
        ) {
          db.prepare('DELETE FROM push_tokens WHERE userId = ? AND token = ?').run(userId, token);
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
    const sqliteTokens = db.prepare('SELECT token FROM push_tokens WHERE userId = ?').all(userId);

    let mongoTokens = [];
    try {
      mongoTokens = await PushToken.find({ userId }, { token: 1, _id: 0 }).lean();
    } catch (mongoErr) {
      console.error('Push token Mongo read error:', mongoErr.message);
    }

    const tokenSet = new Set([
      ...sqliteTokens.map((t) => t.token),
      ...mongoTokens.map((t) => t.token),
    ]);
    if (!tokenSet.size) {
      console.log(
        `[Push] No tokens found for user: ${userId} (sqlite=${sqliteTokens.length}, mongo=${mongoTokens.length})`
      );
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
            db.prepare('DELETE FROM push_tokens WHERE userId = ? AND token = ?').run(userId, token);
            try {
              await PushToken.deleteOne({ userId, token });
            } catch (mongoErr) {
              console.error('Push token Mongo cleanup error:', mongoErr.message);
            }
          }
        }
        messageOffset += chunk.length;
      } catch (error) {
        console.error('Push notification error:', error);
      }
    }

    // Tickets only mean Expo accepted the request. Receipts contain final provider/device status.
    setTimeout(() => {
      logPushReceiptStatuses(ticketToTokenMap, userId);
    }, 4000);
  } catch (err) {
    console.error('Send notification error:', err);
  }
};

function formatOrder(order) {
  return {
    _id: order.id,
    user: order.userId,
    items: (order.items || []).map((item) => ({
      _id: item.id,
      product: item.productId ? {
        _id: item.productId,
        name: item.productName || item.name,
        image: item.productImage || item.image,
        price: item.productPrice || item.price,
      } : null,
      name: item.name,
      price: item.price,
      quantity: item.quantity,
      image: item.image,
    })),
    totalAmount: order.totalAmount,
    status: order.status,
    shippingAddress: order.shippingAddress,
    paymentMethod: order.paymentMethod,
    statusHistory: (order.statusHistory || []).map((history) => ({
      status: history.status,
      date: history.date,
      note: history.note,
    })),
    createdAt: order.createdAt,
    updatedAt: order.updatedAt,
  };
}

exports.createOrder = async (req, res) => {
  try {
    const { items, totalAmount, shippingAddress, paymentMethod } = req.body;
    if (!items || !items.length) return res.status(400).json({ message: 'Order must have items' });

    for (const item of items) {
      const productId = item.productId || item.product;
      if (!productId || productId === 'undefined') {
        return res.status(400).json({ message: 'Invalid product in cart. Please clear your cart and re-add items.' });
      }
    }

    const orderId = uuidv4();

    const insertOrder = db.prepare(`
      INSERT INTO orders (id, userId, totalAmount, shippingAddress, paymentMethod)
      VALUES (?, ?, ?, ?, ?)
    `);

    const insertItem = db.prepare(`
      INSERT INTO order_items (orderId, productId, name, price, quantity, image)
      VALUES (?, ?, ?, ?, ?, ?)
    `);

    const insertHistory = db.prepare(`
      INSERT INTO order_status_history (orderId, status, note) VALUES (?, ?, ?)
    `);

    const transaction = db.transaction(() => {
      insertOrder.run(orderId, req.user.id, totalAmount, shippingAddress, paymentMethod || 'cod');
      for (const item of items) {
        insertItem.run(orderId, item.productId || item.product, item.name, item.price, item.quantity, item.image || '');
      }
      insertHistory.run(orderId, 'pending', 'Order placed');
    });
    transaction();

    const notifId = uuidv4();
    const notifBody = `Your order #${orderId.slice(-8)} has been placed successfully!`;
    db.prepare(
      'INSERT INTO notifications (id, userId, title, body, data, type) VALUES (?, ?, ?, ?, ?, ?)'
    ).run(notifId, req.user.id, 'Order Placed', notifBody, JSON.stringify({ orderId, type: 'order_update' }), 'order_update');

    try {
      await Notification.create({
        userId: req.user.id,
        title: 'Order Placed',
        body: notifBody,
        data: { orderId, type: 'order_update' },
        type: 'order_update',
        isRead: false,
        isBroadcast: false,
      });
    } catch (mongoNotifErr) {
      console.error('Order placed notification (Mongo) error:', mongoNotifErr.message);
    }

    sendPushNotification(req.user.id, 'Order Placed', notifBody, { orderId, type: 'order_update' });

    try {
      const user = db.prepare('SELECT email, name FROM users WHERE id = ?').get(req.user.id);
      if (user && user.email) {
        const subject = `Order Placed - ${orderId.slice(-8)}`;
        const text = `Hi ${user.name || 'Customer'},\n\n${notifBody}\n\nOrder ID: ${orderId}\nPayment: ${paymentMethod || 'cod'}\nTotal: ${totalAmount}`;
        await sendMail({ to: user.email, subject, text });
      } else {
        console.log('[Mail] Order placed email skipped: user has no email on file. userId=', req.user.id);
      }
    } catch (err) {
      console.error('Order placed email error:', err.message);
    }

    const order = db.prepare('SELECT * FROM orders WHERE id = ?').get(orderId);
    order.items = db.prepare('SELECT * FROM order_items WHERE orderId = ?').all(orderId);
    order.statusHistory = db.prepare('SELECT * FROM order_status_history WHERE orderId = ? ORDER BY date').all(orderId);

    res.status(201).json(formatOrder(order));
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

exports.getMyOrders = (req, res) => {
  try {
    const orders = db.prepare('SELECT * FROM orders WHERE userId = ? ORDER BY createdAt DESC').all(req.user.id);
    res.json(orders.map((order) => {
      order.items = db.prepare(`
        SELECT oi.*, p.name as productName, p.image as productImage, p.price as productPrice
        FROM order_items oi
        LEFT JOIN products p ON oi.productId = p.id
        WHERE oi.orderId = ?
      `).all(order.id);
      order.statusHistory = db.prepare('SELECT * FROM order_status_history WHERE orderId = ? ORDER BY date').all(order.id);
      return formatOrder(order);
    }));
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

exports.getOrderById = (req, res) => {
  try {
    const order = db.prepare('SELECT * FROM orders WHERE id = ?').get(req.params.id);
    if (!order) return res.status(404).json({ message: 'Order not found' });
    if (order.userId !== req.user.id && req.user.role !== 'admin') {
      return res.status(403).json({ message: 'Not authorized' });
    }

    order.items = db.prepare(`
      SELECT oi.*, p.name as productName, p.image as productImage, p.price as productPrice
      FROM order_items oi
      LEFT JOIN products p ON oi.productId = p.id
      WHERE oi.orderId = ?
    `).all(order.id);
    order.statusHistory = db.prepare('SELECT * FROM order_status_history WHERE orderId = ? ORDER BY date').all(order.id);

    res.json(formatOrder(order));
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

exports.updateOrderStatus = async (req, res) => {
  try {
    if (req.user.role !== 'admin') return res.status(403).json({ message: 'Admin only' });

    const { status, note } = req.body;
    const order = db.prepare('SELECT * FROM orders WHERE id = ?').get(req.params.id);
    if (!order) return res.status(404).json({ message: 'Order not found' });

    db.prepare("UPDATE orders SET status = ?, updatedAt = datetime('now') WHERE id = ?").run(status, req.params.id);
    db.prepare('INSERT INTO order_status_history (orderId, status, note) VALUES (?, ?, ?)').run(req.params.id, status, note || `Status updated to ${status}`);

    const statusMessages = {
      confirmed: 'Your order has been confirmed!',
      processing: 'Your order is being processed.',
      shipped: 'Your order has been shipped!',
      delivered: 'Your order has been delivered!',
      cancelled: 'Your order has been cancelled.',
    };

    const notifBody = statusMessages[status] || `Order status updated to ${status}`;
    const notifId = uuidv4();
    db.prepare(
      'INSERT INTO notifications (id, userId, title, body, data, type) VALUES (?, ?, ?, ?, ?, ?)'
    ).run(notifId, order.userId, 'Order Update', notifBody, JSON.stringify({ orderId: order.id, type: 'order_update' }), 'order_update');

    try {
      await Notification.create({
        userId: order.userId,
        title: 'Order Update',
        body: notifBody,
        data: { orderId: order.id, type: 'order_update' },
        type: 'order_update',
        isRead: false,
        isBroadcast: false,
      });
    } catch (mongoNotifErr) {
      console.error('Order update notification (Mongo) error:', mongoNotifErr.message);
    }

    sendPushNotification(order.userId, 'Order Update', notifBody, { orderId: order.id, type: 'order_update' });

    try {
      const user = db.prepare('SELECT email, name FROM users WHERE id = ?').get(order.userId);
      if (user && user.email) {
        const subject = `Order Update - ${order.id.slice(-8)}`;
        const text = `${notifBody}\n\nOrder ID: ${order.id}\nStatus: ${status}${note ? `\nNote: ${note}` : ''}`;
        await sendMail({ to: user.email, subject, text });
      }
    } catch (err) {
      console.error('Order status email error:', err);
    }

    const updated = db.prepare('SELECT * FROM orders WHERE id = ?').get(req.params.id);
    updated.items = db.prepare('SELECT * FROM order_items WHERE orderId = ?').all(req.params.id);
    updated.statusHistory = db.prepare('SELECT * FROM order_status_history WHERE orderId = ? ORDER BY date').all(req.params.id);

    res.json(formatOrder(updated));
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

exports.getAllOrders = (req, res) => {
  try {
    if (req.user.role !== 'admin') return res.status(403).json({ message: 'Admin only' });

    const orders = db.prepare(`
      SELECT o.*, u.name as userName, u.email as userEmail
      FROM orders o
      JOIN users u ON o.userId = u.id
      ORDER BY o.createdAt DESC
    `).all();

    res.json(orders.map((order) => {
      order.items = db.prepare(`
        SELECT oi.*, p.name as productName, p.image as productImage, p.price as productPrice
        FROM order_items oi
        LEFT JOIN products p ON oi.productId = p.id
        WHERE oi.orderId = ?
      `).all(order.id);
      order.statusHistory = db.prepare('SELECT * FROM order_status_history WHERE orderId = ? ORDER BY date').all(order.id);
      const formatted = formatOrder(order);
      formatted.user = { _id: order.userId, name: order.userName, email: order.userEmail };
      return formatted;
    }));
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};
