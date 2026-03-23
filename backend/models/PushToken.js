const mongoose = require('mongoose');

const normalizeToken = (value) => String(value || '').trim();
const isExpoPushToken = (value) => /^ExponentPushToken\[[^\]]+\]$|^ExpoPushToken\[[^\]]+\]$/.test(normalizeToken(value));

const pushTokenSchema = new mongoose.Schema(
  {
    userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    token: {
      type: String,
      required: true,
      trim: true,
      set: normalizeToken,
      validate: {
        validator: isExpoPushToken,
        message: 'Invalid Expo push token format',
      },
    },
  },
  { timestamps: true }
);

pushTokenSchema.index({ userId: 1 });
pushTokenSchema.index({ token: 1 }, { unique: true });
pushTokenSchema.index({ userId: 1, token: 1 }, { unique: true });

module.exports = mongoose.model('PushToken', pushTokenSchema);
