const User = require('../models/User');

const normalizeItem = (item) => ({
  productId: String(item?.productId || ''),
  name: String(item?.name || ''),
  price: Number(item?.price || 0),
  quantity: Math.max(1, Number(item?.quantity || 1)),
  image: String(item?.image || ''),
  stock: Number(item?.stock || 0),
});

const sanitizeCart = (items) =>
  (Array.isArray(items) ? items : [])
    .map(normalizeItem)
    .filter((item) => Boolean(item.productId));

exports.getCart = async (req, res) => {
  try {
    const user = await User.findById(req.user.id).select('cartItems').lean();
    if (!user) return res.status(404).json({ message: 'User not found' });
    res.json(sanitizeCart(user.cartItems));
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

exports.addToCart = async (req, res) => {
  try {
    const incoming = normalizeItem(req.body || {});
    if (!incoming.productId) return res.status(400).json({ message: 'productId is required' });

    const user = await User.findById(req.user.id);
    if (!user) return res.status(404).json({ message: 'User not found' });

    const current = sanitizeCart(user.cartItems);
    const idx = current.findIndex((i) => i.productId === incoming.productId);

    if (idx >= 0) {
      current[idx].quantity += 1;
      current[idx].price = incoming.price || current[idx].price;
      current[idx].name = incoming.name || current[idx].name;
      current[idx].image = incoming.image || current[idx].image;
      current[idx].stock = incoming.stock || current[idx].stock;
    } else {
      current.push(incoming);
    }

    user.cartItems = current;
    await user.save();
    res.json(current);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

exports.updateCartQuantity = async (req, res) => {
  try {
    const productId = String(req.params.productId || '');
    const quantity = Number(req.body?.quantity);

    if (!productId) return res.status(400).json({ message: 'productId is required' });
    if (!Number.isFinite(quantity)) return res.status(400).json({ message: 'quantity is required' });

    const user = await User.findById(req.user.id);
    if (!user) return res.status(404).json({ message: 'User not found' });

    const current = sanitizeCart(user.cartItems);
    const idx = current.findIndex((i) => i.productId === productId);
    if (idx === -1) return res.json(current);

    if (quantity <= 0) {
      current.splice(idx, 1);
    } else {
      current[idx].quantity = Math.max(1, Math.floor(quantity));
    }

    user.cartItems = current;
    await user.save();
    res.json(current);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

exports.removeFromCart = async (req, res) => {
  try {
    const productId = String(req.params.productId || '');
    if (!productId) return res.status(400).json({ message: 'productId is required' });

    const user = await User.findById(req.user.id);
    if (!user) return res.status(404).json({ message: 'User not found' });

    user.cartItems = sanitizeCart(user.cartItems).filter((item) => item.productId !== productId);
    await user.save();
    res.json(user.cartItems);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

exports.clearCart = async (req, res) => {
  try {
    const user = await User.findById(req.user.id);
    if (!user) return res.status(404).json({ message: 'User not found' });

    user.cartItems = [];
    await user.save();
    res.json([]);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};
