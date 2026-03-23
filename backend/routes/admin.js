const router = require('express').Router();
const auth = require('../middleware/auth');
const adminController = require('../controllers/adminController');

router.get('/analytics', auth, adminController.getAnalytics);
router.get('/users', auth, adminController.getUsers);
router.put('/users/:id', auth, adminController.updateUser);
router.patch('/users/:id/status', auth, adminController.setUserActiveStatus);
router.delete('/users/:id', auth, adminController.deleteUser);

router.get('/inventory', auth, adminController.getInventory);
router.patch('/products/:productId/inventory', auth, adminController.updateInventory);
router.patch('/products/:productId/status', auth, adminController.setProductActiveStatus);

router.get('/reviews', auth, adminController.getReviews);
router.delete('/reviews/:id', auth, adminController.deleteReview);

router.get('/reports/sales', auth, adminController.getSalesReport);
router.get('/reports/sales/pdf', auth, adminController.getSalesReportPdf);

module.exports = router;