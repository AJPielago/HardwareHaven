const router = require('express').Router();
const auth = require('../middleware/auth');
const reviewsController = require('../controllers/reviewsController');

router.get('/product/:productId', reviewsController.getProductReviews);
router.post('/', auth, reviewsController.createReview);
router.put('/:id', auth, reviewsController.updateReview);
router.delete('/:id', auth, reviewsController.deleteReview);
router.get('/my-reviews', auth, reviewsController.getMyReviews);

module.exports = router;
