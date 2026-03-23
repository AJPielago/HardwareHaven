const Product = require('../models/Product');
const { formatProduct } = require('../utils/formatters');

const ALLOWED_CATEGORIES = [
  'Hand Tools',
  'Power Tools',
  'Fasteners',
  'Electrical Supplies',
  'Plumbing Supplies',
  'Paint and Adhesives',
  'Measuring Tools',
  'Safety Equipment',
  'Gardening Tools',
  'Building Materials',
];

const normalizeCategory = (value) => {
  const input = String(value || '').trim().toLowerCase();
  return ALLOWED_CATEGORIES.find((cat) => cat.toLowerCase() === input) || null;
};

const getUploadedImageUrl = (file) => file?.path || file?.secure_url || file?.url || '';

const toSort = (sort) => {
  if (sort === 'price_asc') return { price: 1 };
  if (sort === 'price_desc') return { price: -1 };
  if (sort === 'rating') return { averageRating: -1 };
  if (sort === 'name') return { name: 1 };
  return { createdAt: -1 };
};

const toProductPayload = (productDoc) => {
  const formatted = formatProduct(productDoc);
  const image = formatted.image || '';
  return {
    ...formatted,
    images: image ? [image] : [],
    image,
  };
};

exports.getProducts = async (req, res) => {
  try {
    const { search, category, minPrice, maxPrice, sort, page = 1, limit = 20 } = req.query;
    const query = { isActive: true };

    if (search) {
      query.$or = [
        { name: { $regex: String(search), $options: 'i' } },
        { description: { $regex: String(search), $options: 'i' } },
      ];
    }

    if (category) {
      query.category = { $regex: `^${String(category).replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}$`, $options: 'i' };
    }

    if (minPrice !== undefined || maxPrice !== undefined) {
      query.price = {};
      if (minPrice !== undefined) query.price.$gte = Number(minPrice);
      if (maxPrice !== undefined) query.price.$lte = Number(maxPrice);
    }

    const pageNum = Math.max(Number(page) || 1, 1);
    const limitNum = Math.max(Number(limit) || 20, 1);
    const skip = (pageNum - 1) * limitNum;

    const [products, total] = await Promise.all([
      Product.find(query)
        .sort(toSort(sort))
        .skip(skip)
        .limit(limitNum)
        .populate('createdBy', 'name')
        .lean(),
      Product.countDocuments(query),
    ]);

    res.json({
      products: products.map(toProductPayload),
      total,
      page: pageNum,
      pages: Math.ceil(total / limitNum),
    });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

exports.getCategories = async (_req, res) => {
  try {
    const categories = await Product.distinct('category');
    categories.sort((a, b) => String(a).localeCompare(String(b)));
    res.json(categories);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

exports.getProductById = async (req, res) => {
  try {
    const product = await Product.findOne({ _id: req.params.id, isActive: true }).populate('createdBy', 'name').lean();
    if (!product) return res.status(404).json({ message: 'Product not found' });

    res.json(toProductPayload(product));
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

exports.createProduct = async (req, res) => {
  try {
    if (req.user.role !== 'admin') return res.status(403).json({ message: 'Admin only' });

    const { name, description, price, category, stock, isService } = req.body;
    const normalizedCategory = normalizeCategory(category);
    const numericPrice = Number(price);
    const numericStock = Number(stock);
    const serviceMode = isService === true || isService === 'true';

    if (!String(name || '').trim()) return res.status(400).json({ message: 'Name is required' });
    if (!String(description || '').trim()) return res.status(400).json({ message: 'Description is required' });
    if (!normalizedCategory) return res.status(400).json({ message: 'Invalid category selected' });
    if (!Number.isFinite(numericPrice) || numericPrice < 0) {
      return res.status(400).json({ message: 'Price must be a valid non-negative number' });
    }
    if (!serviceMode) {
      if (!Number.isFinite(numericStock) || numericStock < 0 || !Number.isInteger(numericStock)) {
        return res.status(400).json({ message: 'Stock must be a valid non-negative whole number' });
      }
    }

    let files = req.files || [];
    if (!Array.isArray(files) && typeof files === 'object') {
      files = Object.values(files).flat();
    }
    const images = (files || []).map(getUploadedImageUrl).filter(Boolean);

    const created = await Product.create({
      name: String(name).trim(),
      description: String(description).trim(),
      price: numericPrice,
      category: normalizedCategory,
      stock: serviceMode ? 0 : numericStock,
      isService: serviceMode,
      image: images[0] || '',
      createdBy: req.user.id,
    });

    const product = await Product.findById(created._id).populate('createdBy', 'name').lean();
    res.status(201).json(toProductPayload(product));
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

exports.updateProduct = async (req, res) => {
  try {
    if (req.user.role !== 'admin') return res.status(403).json({ message: 'Admin only' });

    const update = {};

    if (req.body.name !== undefined) {
      const nextName = String(req.body.name).trim();
      if (!nextName) return res.status(400).json({ message: 'Name cannot be empty' });
      update.name = nextName;
    }

    if (req.body.description !== undefined) {
      const nextDescription = String(req.body.description).trim();
      if (!nextDescription) return res.status(400).json({ message: 'Description cannot be empty' });
      update.description = nextDescription;
    }

    if (req.body.price !== undefined) {
      const nextPrice = Number(req.body.price);
      if (!Number.isFinite(nextPrice) || nextPrice < 0) {
        return res.status(400).json({ message: 'Price must be a valid non-negative number' });
      }
      update.price = nextPrice;
    }

    if (req.body.category !== undefined) {
      const nextCategory = normalizeCategory(req.body.category);
      if (!nextCategory) return res.status(400).json({ message: 'Invalid category selected' });
      update.category = nextCategory;
    }

    if (req.body.stock !== undefined) {
      const nextStock = Number(req.body.stock);
      if (!Number.isFinite(nextStock) || nextStock < 0 || !Number.isInteger(nextStock)) {
        return res.status(400).json({ message: 'Stock must be a valid non-negative whole number' });
      }
      update.stock = nextStock;
    }

    if (req.body.isService !== undefined) {
      update.isService = req.body.isService === true || req.body.isService === 'true';
      if (update.isService) update.stock = 0;
    }

    if (req.files) {
      let incoming = req.files;
      if (!Array.isArray(incoming) && typeof incoming === 'object') incoming = Object.values(incoming).flat();
      const images = (incoming || []).map(getUploadedImageUrl).filter(Boolean);
      if (images.length > 0) {
        update.image = images[0];
      }
    }

    if (!Object.keys(update).length) return res.status(400).json({ message: 'No fields to update' });

    const product = await Product.findByIdAndUpdate(req.params.id, { $set: update }, { new: true })
      .populate('createdBy', 'name')
      .lean();

    if (!product) return res.status(404).json({ message: 'Product not found' });

    res.json(toProductPayload(product));
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

exports.deleteProduct = async (req, res) => {
  try {
    if (req.user.role !== 'admin') return res.status(403).json({ message: 'Admin only' });

    const deleted = await Product.findByIdAndDelete(req.params.id).lean();
    if (!deleted) return res.status(404).json({ message: 'Product not found' });

    res.json({ message: 'Product deleted' });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};
