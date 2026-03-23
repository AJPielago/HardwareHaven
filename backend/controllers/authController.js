const User = require('../models/User');
const PushToken = require('../models/PushToken');
const db = require('../database');
const { formatUser } = require('../utils/formatters');

const getUploadedImageUrl = (file) => file?.path || file?.secure_url || file?.url || '';

/** Keep SQLite users row aligned with Mongo (auth middleware also does this on each request). */
function mirrorUserToSqlite(user) {
  if (!user) return;
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
    user.name || '',
    user.email || '',
    user.avatar || '',
    user.phone || '',
    user.address || '',
    user.provider || 'firebase',
    user.firebaseUid || '',
    user.role || 'user',
    user.isActive === false ? 0 : 1,
    user.deactivatedAt ? new Date(user.deactivatedAt).toISOString() : null,
    user.deactivationReason || ''
  );
}

exports.syncUser = async (req, res) => {
  try {
    const update = {};
    const normalizedEmail = req.firebaseUser?.email ? String(req.firebaseUser.email).toLowerCase() : '';

    if (req.body.name) update.name = req.body.name;
    if (normalizedEmail) update.email = normalizedEmail;
    if (req.body.phone) update.phone = req.body.phone;
    if (req.body.address) update.address = req.body.address;
    if (req.body.secondaryAddress) update.secondaryAddress = req.body.secondaryAddress;
    if (req.file) update.avatar = getUploadedImageUrl(req.file);

    await User.findByIdAndUpdate(req.user.id, { $set: update });
    const user = await User.findById(req.user.id).lean();
    try {
      mirrorUserToSqlite(user);
    } catch (e) {
      console.error('[syncUser] SQLite mirror failed:', e.message);
    }

    res.json(formatUser(user));
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

exports.register = (req, res) => {
  res.status(410).json({ message: 'Use Firebase createUserWithEmailAndPassword on the client, then call /auth/sync.' });
};

exports.login = (req, res) => {
  res.status(410).json({ message: 'Use Firebase signInWithEmailAndPassword on the client.' });
};

exports.socialLogin = (req, res) => {
  res.status(410).json({ message: 'Use Firebase Auth providers for social login.' });
};

exports.refreshToken = (req, res) => {
  res.status(410).json({ message: 'JWT refresh flow is disabled. Use Firebase ID token refresh.' });
};

exports.getProfile = async (req, res) => {
  try {
    const user = await User.findById(req.user.id).lean();
    if (!user) return res.status(404).json({ message: 'User not found' });
    res.json(formatUser(user));
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

exports.updateProfile = async (req, res) => {
  try {
    const update = {};
    if (Object.prototype.hasOwnProperty.call(req.body, 'name')) {
      const normalizedName = String(req.body.name ?? '').trim();
      if (normalizedName) update.name = normalizedName;
    }
    if (Object.prototype.hasOwnProperty.call(req.body, 'phone')) {
      update.phone = String(req.body.phone ?? '').trim();
    }
    if (Object.prototype.hasOwnProperty.call(req.body, 'address')) {
      update.address = String(req.body.address ?? '').trim();
    }
    if (Object.prototype.hasOwnProperty.call(req.body, 'secondaryAddress')) {
      update.secondaryAddress = String(req.body.secondaryAddress ?? '').trim();
    }
    if (req.file) update.avatar = getUploadedImageUrl(req.file);

    if (Object.keys(update).length > 0) {
      await User.findByIdAndUpdate(req.user.id, { $set: update });
    }

    const user = await User.findById(req.user.id).lean();
    if (!user) return res.status(404).json({ message: 'User not found' });

    try {
      mirrorUserToSqlite(user);
    } catch (e) {
      console.error('[updateProfile] SQLite mirror failed:', e.message);
    }

    res.json(formatUser(user));
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

exports.savePushToken = async (req, res) => {
  try {
    const normalizedPushToken = String(req.body?.pushToken || '').trim();
    if (!normalizedPushToken) return res.status(400).json({ message: 'Push token required' });

    db.prepare('INSERT OR IGNORE INTO push_tokens (userId, token) VALUES (?, ?)').run(req.user.id, normalizedPushToken);
    const sqliteCount = db.prepare('SELECT COUNT(1) as count FROM push_tokens WHERE userId = ?').get(req.user.id)?.count || 0;

    try {
      await PushToken.updateOne(
        { userId: req.user.id, token: normalizedPushToken },
        { $setOnInsert: { userId: req.user.id, token: normalizedPushToken } },
        { upsert: true }
      );
    } catch (mongoErr) {
      console.error('Push token Mongo save error:', mongoErr.message);
    }

    console.log(
      `[Push] Token saved for user=${req.user.id} token=${normalizedPushToken.slice(0, 22)}... sqliteCount=${sqliteCount}`
    );

    res.json({ message: 'Push token saved' });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

exports.removePushToken = async (req, res) => {
  try {
    const normalizedPushToken = String(req.body?.pushToken || '').trim();
    if (!normalizedPushToken) return res.status(400).json({ message: 'Push token required' });

    db.prepare('DELETE FROM push_tokens WHERE userId = ? AND token = ?').run(req.user.id, normalizedPushToken);

    try {
      await PushToken.deleteOne({ userId: req.user.id, token: normalizedPushToken });
    } catch (mongoErr) {
      console.error('Push token Mongo remove error:', mongoErr.message);
    }

    res.json({ message: 'Push token removed' });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};
