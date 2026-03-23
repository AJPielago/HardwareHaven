const router = require('express').Router();
const auth = require('../middleware/auth');
const notificationsController = require('../controllers/notificationsController');

router.get('/', auth, notificationsController.getNotifications);
router.put('/:id/read', auth, notificationsController.markAsRead);
router.post('/promotion', auth, notificationsController.sendPromotion);
router.get('/:id', auth, notificationsController.getNotificationById);

module.exports = router;
