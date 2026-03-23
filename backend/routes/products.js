const router = require('express').Router();
const auth = require('../middleware/auth');
const upload = require('../middleware/upload');
const productsController = require('../controllers/productsController');

router.get('/', productsController.getProducts);
router.get('/categories', productsController.getCategories);
router.get('/:id', productsController.getProductById);
// accept both 'images' (new) and 'image' (legacy) field names
// accept both 'images' and legacy 'image' field names, plus bracketed variants from some clients
router.post('/', auth, upload.fields([
	{ name: 'images', maxCount: 5 },
	{ name: 'images[]', maxCount: 5 },
	{ name: 'image', maxCount: 5 },
	{ name: 'image[]', maxCount: 5 },
]), productsController.createProduct);
router.put('/:id', auth, upload.fields([
	{ name: 'images', maxCount: 5 },
	{ name: 'images[]', maxCount: 5 },
	{ name: 'image', maxCount: 5 },
	{ name: 'image[]', maxCount: 5 },
]), productsController.updateProduct);
router.delete('/:id', auth, productsController.deleteProduct);

module.exports = router;
