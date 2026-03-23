const router = require('express').Router();
const auth = require('../middleware/auth');
const cartController = require('../controllers/cartController');

router.get('/', auth, cartController.getCart);
router.post('/', auth, cartController.addToCart);
router.put('/:productId', auth, cartController.updateCartQuantity);
router.delete('/:productId', auth, cartController.removeFromCart);
router.delete('/', auth, cartController.clearCart);

module.exports = router;
