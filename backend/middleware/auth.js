const User = require('../models/User');
const { verifyFirebaseToken } = require('../utils/firebaseAdmin');

const decodeJwtPayload = (token) => {
  try {
    const parts = String(token || '').split('.');
    if (parts.length < 2) return null;
    const json = Buffer.from(parts[1], 'base64').toString('utf8');
    return JSON.parse(json);
  } catch {
    return null;
  }
};

module.exports = async (req, res, next) => {
  const authHeader = req.header('Authorization');
  if (!authHeader) return res.status(401).json({ message: 'No token, authorization denied' });

  const token = authHeader.startsWith('Bearer ') ? authHeader.slice(7) : authHeader;

  try {
    const decoded = await verifyFirebaseToken(token, false);
    const normalizedEmail = decoded.email?.toLowerCase();

    if (!normalizedEmail) {
      return res.status(401).json({ message: 'Firebase token must contain an email' });
    }

    const userByUid = await User.findOne({ firebaseUid: decoded.uid });
    const userByEmail = await User.findOne({ email: normalizedEmail });

    let user = userByUid || userByEmail;

    if (!user) {
      user = await User.create({
        firebaseUid: decoded.uid,
        name: decoded.name || normalizedEmail.split('@')[0] || 'User',
        email: normalizedEmail,
        avatar: decoded.picture || '',
        provider: 'firebase',
        role: 'user',
      });
    } else {
      let shouldSave = false;

      // Connect existing account to Firebase UID when logging in via Google.
      if (!user.firebaseUid || user.firebaseUid !== decoded.uid) {
        user.firebaseUid = decoded.uid;
        shouldSave = true;
      }

      if (user.email !== normalizedEmail) {
        user.email = normalizedEmail;
        shouldSave = true;
      }

      if (!user.name && decoded.name) {
        user.name = decoded.name;
        shouldSave = true;
      }

      if ((!user.avatar || user.avatar.trim() === '') && decoded.picture) {
        user.avatar = decoded.picture;
        shouldSave = true;
      }

      if (user.provider !== 'firebase') {
        user.provider = 'firebase';
        shouldSave = true;
      }

      if (shouldSave) {
        await user.save();
      }
    }

    if (user.isActive === false) {
      return res.status(403).json({
        message: 'Your account has been deactivated. Please contact support.',
        reason: user.deactivationReason || '',
      });
    }

    req.firebaseUser = decoded;
    req.user = {
      id: String(user._id),
      email: user.email,
      role: user.role,
      isActive: user.isActive !== false,
      name: user.name,
      firebaseUid: user.firebaseUid,
    };

    next();
  } catch (err) {
    console.error('[Auth Middleware] Firebase token verification failed:', err?.code, err?.message);

    const tokenClaims = decodeJwtPayload(token);
    const payload = {
      message: 'Firebase token is not valid',
      reason: err?.code || err?.message,
      expectedProjectId: process.env.FIREBASE_PROJECT_ID || null,
      tokenAud: tokenClaims?.aud || null,
      tokenIss: tokenClaims?.iss || null,
    };

    res.status(401).json(payload);
  }
};
