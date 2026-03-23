const { Expo } = require('expo-server-sdk');
const { sendMail } = require('../utils/mailer');
const Notification = require('../models/Notification');
const PushToken = require('../models/PushToken');
const User = require('../models/User');
const { toId, formatNotification } = require('../utils/formatters');
const db = require('../database');

const expo = new Expo();

exports.getNotifications = async (req, res) => {
  try {
    const mongoNotifications = await Notification.find({
      $or: [{ userId: req.user.id }, { isBroadcast: true }],
    })
      .sort({ createdAt: -1 })
      .limit(50)
      .lean();

    const sqliteRows = db.prepare(
      'SELECT id, userId, title, body, data, type, isRead, isBroadcast, createdAt, updatedAt FROM notifications WHERE userId = ? OR isBroadcast = 1 ORDER BY createdAt DESC LIMIT 50'
    ).all(req.user.id);

    const sqliteNotifications = sqliteRows.map((row) => {
      let parsedData = {};
      try {
        parsedData = row.data ? JSON.parse(row.data) : {};
      } catch (_) {
        parsedData = {};
      }

      return {
        _id: String(row.id),
        user: row.userId ? String(row.userId) : null,
        title: row.title,
        body: row.body,
        data: parsedData,
        type: row.type || 'general',
        isRead: !!row.isRead,
        isBroadcast: !!row.isBroadcast,
        createdAt: row.createdAt,
        updatedAt: row.updatedAt,
      };
    });

    const mergedById = new Map();
    for (const n of mongoNotifications.map(formatNotification)) mergedById.set(String(n._id), n);
    for (const n of sqliteNotifications) {
      if (!mergedById.has(String(n._id))) mergedById.set(String(n._id), n);
    }

    const merged = Array.from(mergedById.values()).sort(
      (a, b) => new Date(b.createdAt || 0) - new Date(a.createdAt || 0)
    );

    res.json(merged.slice(0, 50));
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

exports.markAsRead = async (req, res) => {
  try {
    const notification = await Notification.findById(req.params.id).lean();
    if (!notification) {
      const sqliteNotification = db
        .prepare('SELECT id, userId, isBroadcast, isRead, title, body, data, type, createdAt, updatedAt FROM notifications WHERE id = ?')
        .get(req.params.id);

      if (!sqliteNotification) return res.status(404).json({ message: 'Notification not found' });

      const isOwnerSqlite = String(sqliteNotification.userId || '') === req.user.id;
      const isBroadcastSqlite = !!sqliteNotification.isBroadcast;
      if (!isOwnerSqlite && !isBroadcastSqlite) {
        return res.status(403).json({ message: 'Not authorized' });
      }

      db.prepare("UPDATE notifications SET isRead = 1, updatedAt = datetime('now') WHERE id = ?").run(req.params.id);
      const updatedSqlite = db
        .prepare('SELECT id, userId, title, body, data, type, isRead, isBroadcast, createdAt, updatedAt FROM notifications WHERE id = ?')
        .get(req.params.id);

      let parsedData = {};
      try {
        parsedData = updatedSqlite.data ? JSON.parse(updatedSqlite.data) : {};
      } catch (_) {
        parsedData = {};
      }

      return res.json({
        _id: String(updatedSqlite.id),
        user: updatedSqlite.userId ? String(updatedSqlite.userId) : null,
        title: updatedSqlite.title,
        body: updatedSqlite.body,
        data: parsedData,
        type: updatedSqlite.type || 'general',
        isRead: !!updatedSqlite.isRead,
        isBroadcast: !!updatedSqlite.isBroadcast,
        createdAt: updatedSqlite.createdAt,
        updatedAt: updatedSqlite.updatedAt,
      });
    }

    const isOwner = toId(notification.userId) === req.user.id;
    const isBroadcast = !!notification.isBroadcast;
    if (!isOwner && !isBroadcast) {
      return res.status(403).json({ message: 'Not authorized' });
    }

    const updated = await Notification.findByIdAndUpdate(
      req.params.id,
      { $set: { isRead: true } },
      { returnDocument: 'after' }
    ).lean();

    res.json(formatNotification(updated));
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

exports.sendPromotion = async (req, res) => {
  try {
    if (req.user.role !== 'admin') return res.status(403).json({ message: 'Admin only' });

    const { title, body, data } = req.body;

    const notification = await Notification.create({
      title,
      body,
      data: data || {},
      type: 'promotion',
      isBroadcast: true,
      isRead: false,
      userId: null,
    });

    const tokens = await PushToken.find({}, { token: 1, _id: 0 }).lean();
    const messages = [];
    for (const { token } of tokens) {
      if (Expo.isExpoPushToken(token)) {
        messages.push({
          to: token,
          sound: 'default',
          title,
          body,
          data: { ...data, notificationId: toId(notification._id), type: 'promotion' },
        });
      }
    }

    if (messages.length > 0) {
      const chunks = expo.chunkPushNotifications(messages);
      for (const chunk of chunks) {
        try {
          await expo.sendPushNotificationsAsync(chunk);
        } catch (error) {
          console.error('Push error:', error);
        }
      }
    }

    const users = await User.find({ role: 'user', email: { $ne: '' } }, { email: 1, name: 1 }).lean();
    await Promise.allSettled(
      users.map((user) =>
        sendMail({
          to: user.email,
          subject: title,
          text: `Hi ${user.name || 'Customer'},\n\n${body}`,
        })
      )
    );

    res.status(201).json({ message: 'Promotion sent', notification: formatNotification(notification) });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

exports.getNotificationById = async (req, res) => {
  try {
    const notification = await Notification.findById(req.params.id).lean();
    if (!notification) return res.status(404).json({ message: 'Notification not found' });

    const isOwner = toId(notification.userId) === req.user.id;
    const isBroadcast = !!notification.isBroadcast;
    if (!isOwner && !isBroadcast) {
      return res.status(403).json({ message: 'Not authorized' });
    }

    res.json(formatNotification(notification));
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};
