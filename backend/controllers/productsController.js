const { v4: uuidv4 } = require('uuid');
const db = require('../database');

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

function formatProduct(product) {
  return { ...product, _id: product.id };
}

exports.getProducts = (req, res) => {
  try {
    const { search, category, minPrice, maxPrice, sort, page = 1, limit = 20 } = req.query;
    const conditions = ['isActive = 1'];
    const params = [];

    if (search) {
      conditions.push('(name LIKE ? OR description LIKE ?)');
      params.push(`%${search}%`, `%${search}%`);
    }
    if (category) {
      conditions.push('category = ? COLLATE NOCASE');
      params.push(category);
    }
    if (minPrice) {
      conditions.push('price >= ?');
      params.push(Number(minPrice));
    }
    if (maxPrice) {
      conditions.push('price <= ?');
      params.push(Number(maxPrice));
    }

    const where = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';

    let orderBy = 'ORDER BY createdAt DESC';
    if (sort === 'price_asc') orderBy = 'ORDER BY price ASC';
    if (sort === 'price_desc') orderBy = 'ORDER BY price DESC';
    if (sort === 'rating') orderBy = 'ORDER BY averageRating DESC';
    if (sort === 'name') orderBy = 'ORDER BY name ASC';

    const offset = (Number(page) - 1) * Number(limit);

    const products = db.prepare(`SELECT * FROM products ${where} ${orderBy} LIMIT ? OFFSET ?`).all(...params, Number(limit), offset);
    const total = db.prepare(`SELECT COUNT(*) as count FROM products ${where}`).get(...params).count;

    const shaped = products.map((p) => {
      // normalize images stored as JSON array or single string
      let images = [];
      try {
        if (p.image) {
          const parsed = JSON.parse(p.image);
          if (Array.isArray(parsed)) images = parsed.filter(Boolean);
          else if (typeof parsed === 'string' && parsed) images = [parsed];
        }
      } catch (e) {
        if (p.image) images = [p.image];
      }
      return { ...formatProduct(p), images, image: images[0] || '' };
    });

    res.json({ products: shaped, total, page: Number(page), pages: Math.ceil(total / Number(limit)) });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

exports.getCategories = (req, res) => {
  try {
    const rows = db.prepare('SELECT DISTINCT category FROM products WHERE isActive = 1 ORDER BY category').all();
    res.json(rows.map((row) => row.category));
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

exports.getProductById = (req, res) => {
  try {
    const product = db.prepare(`
      SELECT p.*, u.name as createdByName
      FROM products p
      LEFT JOIN users u ON p.createdBy = u.id
      WHERE p.id = ? AND p.isActive = 1
    `).get(req.params.id);
    if (!product) return res.status(404).json({ message: 'Product not found' });

    product.createdBy = product.createdBy ? { _id: product.createdBy, name: product.createdByName } : null;
    delete product.createdByName;

    // normalize images
    let images = [];
    try {
      if (product.image) {
        const parsed = JSON.parse(product.image);
        if (Array.isArray(parsed)) images = parsed.filter(Boolean);
        else if (typeof parsed === 'string' && parsed) images = [parsed];
      }
    } catch (e) {
      if (product.image) images = [product.image];
    }
    const formatted = formatProduct(product);
    formatted.images = images;
    formatted.image = images[0] || '';
    res.json(formatted);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

exports.createProduct = (req, res) => {
  try {
    if (req.user.role !== 'admin') return res.status(403).json({ message: 'Admin only' });

    const { name, description, price, category, stock, isService } = req.body;
    const normalizedCategory = normalizeCategory(category);
    const numericPrice = Number(price);
    const numericStock = Number(stock);
    const serviceMode = isService === 'true';

    if (!String(name || '').trim()) return res.status(400).json({ message: 'Name is required' });
    if (!String(description || '').trim()) return res.status(400).json({ message: 'Description is required' });
    if (!normalizedCategory) {
      return res.status(400).json({ message: 'Invalid category selected' });
    }
    if (!Number.isFinite(numericPrice) || numericPrice < 0) {
      return res.status(400).json({ message: 'Price must be a valid non-negative number' });
    }
    if (!serviceMode) {
      if (!Number.isFinite(numericStock) || numericStock < 0 || !Number.isInteger(numericStock)) {
        return res.status(400).json({ message: 'Stock must be a valid non-negative whole number' });
      }
    }

    const id = uuidv4();
    let files = req.files || [];
    // multer.fields returns an object { fieldname: [files] }, while .array returns an array
    if (!Array.isArray(files) && typeof files === 'object') {
      files = Object.values(files).flat();
    }
    const images = (files || []).map(getUploadedImageUrl).filter(Boolean);
    const imageToStore = JSON.stringify(images);

    db.prepare(`
      INSERT INTO products (id, name, description, price, category, stock, isService, image, createdBy)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      id,
      String(name).trim(),
      String(description).trim(),
      numericPrice,
      normalizedCategory,
      serviceMode ? 0 : numericStock,
      serviceMode ? 1 : 0,
      imageToStore,
      req.user.id
    );

    const product = db.prepare('SELECT * FROM products WHERE id = ?').get(id);
    // shape images for response
    let imgs = [];
    try { imgs = JSON.parse(product.image || '[]'); } catch (e) { if (product.image) imgs = [product.image]; }
    const formatted = formatProduct(product);
    formatted.images = imgs;
    formatted.image = imgs[0] || '';
    res.status(201).json(formatted);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

exports.updateProduct = (req, res) => {
  try {
    if (req.user.role !== 'admin') return res.status(403).json({ message: 'Admin only' });

    const sets = [];
    const params = [];
    if (req.body.name) {
      const nextName = String(req.body.name).trim();
      if (!nextName) return res.status(400).json({ message: 'Name cannot be empty' });
      sets.push('name = ?');
      params.push(nextName);
    }
    if (req.body.description) {
      const nextDescription = String(req.body.description).trim();
      if (!nextDescription) return res.status(400).json({ message: 'Description cannot be empty' });
      sets.push('description = ?');
      params.push(nextDescription);
    }
    if (req.body.price !== undefined) {
      const nextPrice = Number(req.body.price);
      if (!Number.isFinite(nextPrice) || nextPrice < 0) {
        return res.status(400).json({ message: 'Price must be a valid non-negative number' });
      }
      sets.push('price = ?');
      params.push(nextPrice);
    }
    if (req.body.category) {
      const nextCategory = normalizeCategory(req.body.category);
      if (!nextCategory) return res.status(400).json({ message: 'Invalid category selected' });
      sets.push('category = ?');
      params.push(nextCategory);
    }
    if (req.body.stock !== undefined) {
      const nextStock = Number(req.body.stock);
      if (!Number.isFinite(nextStock) || nextStock < 0 || !Number.isInteger(nextStock)) {
        return res.status(400).json({ message: 'Stock must be a valid non-negative whole number' });
      }
      sets.push('stock = ?');
      params.push(nextStock);
    }
    if (req.files) {
      let incoming = req.files;
      if (!Array.isArray(incoming) && typeof incoming === 'object') incoming = Object.values(incoming).flat();
      if (incoming && incoming.length) {
        sets.push('image = ?');
        params.push(JSON.stringify(incoming.map(getUploadedImageUrl).filter(Boolean)));
      }
    }
    sets.push("updatedAt = datetime('now')");
    params.push(req.params.id);

    if (sets.length === 1) return res.status(400).json({ message: 'No fields to update' });

    db.prepare(`UPDATE products SET ${sets.join(', ')} WHERE id = ?`).run(...params);

    const product = db.prepare('SELECT * FROM products WHERE id = ?').get(req.params.id);
    if (!product) return res.status(404).json({ message: 'Product not found' });
    let imgs = [];
    try { imgs = JSON.parse(product.image || '[]'); } catch (e) { if (product.image) imgs = [product.image]; }
    const formatted = formatProduct(product);
    formatted.images = imgs;
    formatted.image = imgs[0] || '';
    res.json(formatted);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

exports.deleteProduct = (req, res) => {
  try {
    if (req.user.role !== 'admin') return res.status(403).json({ message: 'Admin only' });

    const result = db.prepare('DELETE FROM products WHERE id = ?').run(req.params.id);
    if (result.changes === 0) return res.status(404).json({ message: 'Product not found' });
    res.json({ message: 'Product deleted' });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};
