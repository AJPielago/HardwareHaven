const { Expo } = require('expo-server-sdk');
const { sendMail } = require('../utils/mailer');
const Notification = require('../models/Notification');
const PushToken = require('../models/PushToken');
const User = require('../models/User');
const { toId, formatNotification } = require('../utils/formatters');

const expo = new Expo();

exports.getNotifications = async (req, res) => {
  try {
    const mongoNotifications = await Notification.find({
      $or: [{ userId: req.user.id }, { isBroadcast: true }],
    })
      .sort({ createdAt: -1 })
      .limit(50)
      .lean();

    res.json(mongoNotifications.map(formatNotification));
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

exports.markAsRead = async (req, res) => {
  try {
    const notification = await Notification.findById(req.params.id).lean();
    if (!notification) return res.status(404).json({ message: 'Notification not found' });

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
