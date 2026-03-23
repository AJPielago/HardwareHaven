const router = require('express').Router();
const auth = require('../middleware/auth');
const ordersController = require('../controllers/ordersController');

router.post('/', auth, ordersController.createOrder);
router.get('/my-orders', auth, ordersController.getMyOrders);
router.get('/:id', auth, ordersController.getOrderById);
router.put('/:id/status', auth, ordersController.updateOrderStatus);
router.get('/', auth, ordersController.getAllOrders);

module.exports = router;
