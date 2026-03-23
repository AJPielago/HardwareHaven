const router = require('express').Router();
const auth = require('../middleware/auth');
const upload = require('../middleware/upload');
const authController = require('../controllers/authController');

router.post('/sync', auth, upload.single('avatar'), authController.syncUser);
router.post('/register', authController.register);
router.post('/login', authController.login);
router.post('/social-login', authController.socialLogin);
router.post('/refresh-token', authController.refreshToken);
router.get('/profile', auth, authController.getProfile);
router.put('/profile', auth, upload.single('avatar'), authController.updateProfile);
router.get('/push-token', auth, authController.getMyPushTokens);
router.post('/push-token', auth, authController.savePushToken);
router.delete('/push-token', auth, authController.removePushToken);

module.exports = router;
