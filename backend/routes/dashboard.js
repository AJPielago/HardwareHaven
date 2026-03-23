const router = require('express').Router();
const auth = require('../middleware/auth');
const dashboardController = require('../controllers/dashboardController');

router.get('/stats', auth, dashboardController.getStats);

module.exports = router;
