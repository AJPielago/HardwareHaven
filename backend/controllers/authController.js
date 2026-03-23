const User = require('../models/User');
const PushToken = require('../models/PushToken');
const { formatUser } = require('../utils/formatters');

const getUploadedImageUrl = (file) => file?.path || file?.secure_url || file?.url || '';
const isExpoPushToken = (token) => /^ExponentPushToken\[[^\]]+\]$|^ExpoPushToken\[[^\]]+\]$/.test(String(token || ''));

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

    res.json(formatUser(user));
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

exports.savePushToken = async (req, res) => {
  try {
    const normalizedPushToken = String(req.body?.pushToken || '').trim();
    if (!normalizedPushToken) return res.status(400).json({ message: 'Push token required' });
    if (!isExpoPushToken(normalizedPushToken)) {
      return res.status(400).json({ message: 'Invalid Expo push token format' });
    }

    // Keep token ownership single-user to avoid cross-account notification leaks
    // when the same device signs into different accounts.
    await PushToken.deleteMany({ token: normalizedPushToken, userId: { $ne: req.user.id } });

    const result = await PushToken.updateOne(
      { userId: req.user.id, token: normalizedPushToken },
      { $setOnInsert: { userId: req.user.id, token: normalizedPushToken } },
      { upsert: true }
    );

    console.log(
      `[Push] Token saved for user=${req.user.id} token=${normalizedPushToken.slice(0, 22)}... upserted=${result.upsertedCount || 0} matched=${result.matchedCount || 0}`
    );

    res.json({
      message: 'Push token saved',
      created: (result.upsertedCount || 0) > 0,
    });
  } catch (err) {
    console.error('Push token save error:', err.message);
    res.status(500).json({ message: err.message });
  }
};

exports.removePushToken = async (req, res) => {
  try {
    const normalizedPushToken = String(req.body?.pushToken || '').trim();
    if (!normalizedPushToken) return res.status(400).json({ message: 'Push token required' });

    await PushToken.deleteOne({ userId: req.user.id, token: normalizedPushToken });

    res.json({ message: 'Push token removed' });
  } catch (err) {
    console.error('Push token remove error:', err.message);
    res.status(500).json({ message: err.message });
  }
};

exports.getMyPushTokens = async (req, res) => {
  try {
    const rows = await PushToken.find({ userId: req.user.id }, { token: 1, createdAt: 1, updatedAt: 1 })
      .sort({ updatedAt: -1 })
      .lean();

    res.json({
      count: rows.length,
      items: rows.map((row) => ({
        id: String(row._id),
        tokenPreview: `${String(row.token || '').slice(0, 24)}...`,
        createdAt: row.createdAt,
        updatedAt: row.updatedAt,
      })),
    });
  } catch (err) {
    console.error('Push token list error:', err.message);
    res.status(500).json({ message: err.message });
  }
};
