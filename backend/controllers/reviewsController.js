const Review = require('../models/Review');
const Order = require('../models/Order');
const Product = require('../models/Product');
const mongoose = require('mongoose');
const { toId } = require('../utils/formatters');

const PROFANITY_PATTERNS = [
  /\b(f+u+c+k+|s+h+i+t+|b+i+t+c+h+|a+s+s+h*o+l+e+|m+o+t+h+e+r*f+u+c+k+e*r+|d+i+c+k+|c+u+n+t+|b+a+s+t+a+r+d+)\b/i,
  /\b(p+u+t+a+|p+u+t+a+n+g+i+n+a+|t+a+n+g+i+n+a+|g+a+g+o+|u+l+o+l+|b+w+i+s+i+t+|t+a+r+a+n+t+a+d+o+|l+e+c+h+e+|p+u+n+y+e+t+a+)\b/i,
];

const normalizeProfanityText = (text) => String(text || '')
  .toLowerCase()
  .replace(/[@4]/g, 'a')
  .replace(/[!1|]/g, 'i')
  .replace(/[0]/g, 'o')
  .replace(/[3]/g, 'e')
  .replace(/[$5]/g, 's')
  .replace(/[^a-z\s]/g, ' ')
  .replace(/\s+/g, ' ')
  .trim();

const containsProfanity = (text) => {
  const normalized = normalizeProfanityText(text);
  const compact = normalized.replace(/\s+/g, '');
  return PROFANITY_PATTERNS.some((pattern) => pattern.test(normalized) || pattern.test(compact));
};

const isDeliveredOrderStatus = (status) => String(status || '').toLowerCase() === 'delivered';
const toObjectId = (value) => {
  if (!mongoose.Types.ObjectId.isValid(String(value || ''))) return null;
  return new mongoose.Types.ObjectId(String(value));
};

const updateProductRating = async (productId) => {
  const stats = await Review.aggregate([
    { $match: { productId: toObjectId(productId) } },
    {
      $group: {
        _id: '$productId',
        numReviews: { $sum: 1 },
        averageRating: { $avg: '$rating' },
      },
    },
  ]);

  const numReviews = stats[0]?.numReviews || 0;
  const averageRating = stats[0]?.averageRating || 0;
  await Product.findByIdAndUpdate(productId, {
    $set: {
      numReviews,
      averageRating: Math.round(averageRating * 10) / 10,
    },
  });
};

exports.getProductReviews = async (req, res) => {
  try {
    const reviews = await Review.find({ productId: req.params.productId })
      .populate('userId', 'name avatar')
      .sort({ createdAt: -1 })
      .lean();

    const shaped = reviews.map((review) => ({
      _id: toId(review._id),
      rating: review.rating,
      comment: review.comment,
      product: toId(review.productId),
      order: toId(review.orderId),
      user: {
        _id: toId(review.userId?._id || review.userId),
        name: review.userId?.name,
        avatar: review.userId?.avatar,
      },
      createdAt: review.createdAt,
      updatedAt: review.updatedAt,
    }));

    res.json(shaped);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

exports.createReview = async (req, res) => {
  try {
    const { productId, orderId, rating, comment } = req.body;
    const normalizedProductId = String(productId || '').trim();
    const productObjectId = toObjectId(normalizedProductId);

    if (!normalizedProductId || !productObjectId) return res.status(400).json({ message: 'Product is required' });
    if (!comment || !String(comment).trim()) return res.status(400).json({ message: 'Comment is required' });
    if (containsProfanity(comment)) {
      return res.status(400).json({ message: 'Review contains prohibited language. Please revise your comment.' });
    }

    const numericRating = Number(rating);
    if (Number.isNaN(numericRating) || numericRating < 1 || numericRating > 5) {
      return res.status(400).json({ message: 'Rating must be between 1 and 5' });
    }

    const existingByProduct = await Review.findOne({ userId: req.user.id, productId: productObjectId }).lean();
    if (existingByProduct) {
      return res.status(409).json({
        message: 'You already reviewed this product. Please edit your existing review.',
        reviewId: toId(existingByProduct._id),
      });
    }

    let verifiedOrder = null;
    if (orderId) {
      const selectedOrderId = toObjectId(orderId);
      if (!selectedOrderId) {
        return res.status(400).json({ message: 'You can only review products from delivered orders' });
      }

      const selectedOrder = await Order.findOne({
        _id: selectedOrderId,
        userId: req.user.id,
      }).lean();

      if (!selectedOrder || !isDeliveredOrderStatus(selectedOrder.status)) {
        return res.status(400).json({ message: 'You can only review products from delivered orders' });
      }

      const selectedOrderItem = (selectedOrder.items || []).find(
        (item) => toId(item.productId) === normalizedProductId
      );
      if (!selectedOrderItem) {
        return res.status(400).json({ message: 'Selected order does not contain this product' });
      }

      verifiedOrder = selectedOrder;
    } else {
      const candidateOrder = await Order.findOne({
        userId: req.user.id,
        status: 'delivered',
        'items.productId': productObjectId,
      })
        .sort({ createdAt: -1 })
        .lean();

      if (!candidateOrder?._id) {
        return res.status(400).json({ message: 'You can only review products from delivered orders' });
      }

      verifiedOrder = candidateOrder;
    }

    const created = await Review.create({
      userId: req.user.id,
      productId: productObjectId,
      orderId: verifiedOrder._id,
      rating: numericRating,
      comment: String(comment).trim(),
    });
    await updateProductRating(created.productId);

    const review = await Review.findById(created._id).populate('userId', 'name avatar').lean();
    res.status(201).json({
      _id: toId(review._id),
      rating: review.rating,
      comment: review.comment,
      product: toId(review.productId),
      order: toId(review.orderId),
      user: {
        _id: toId(review.userId?._id || review.userId),
        name: review.userId?.name,
        avatar: review.userId?.avatar,
      },
      createdAt: review.createdAt,
      updatedAt: review.updatedAt,
    });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

exports.updateReview = async (req, res) => {
  try {
    const review = await Review.findById(req.params.id);
    if (!review) return res.status(404).json({ message: 'Review not found' });
    if (toId(review.userId) !== req.user.id) {
      return res.status(403).json({ message: 'You can only update your own reviews' });
    }

    const newRating = Object.prototype.hasOwnProperty.call(req.body, 'rating') ? Number(req.body.rating) : review.rating;
    const newComment = Object.prototype.hasOwnProperty.call(req.body, 'comment') ? String(req.body.comment || '').trim() : review.comment;

    if (Number.isNaN(newRating) || newRating < 1 || newRating > 5) {
      return res.status(400).json({ message: 'Rating must be between 1 and 5' });
    }
    if (!newComment) {
      return res.status(400).json({ message: 'Comment is required' });
    }
    if (containsProfanity(newComment)) {
      return res.status(400).json({ message: 'Review contains prohibited language. Please revise your comment.' });
    }

    const eligibleOrder = await Order.findOne({
      _id: review.orderId,
      userId: req.user.id,
      status: 'delivered',
      'items.productId': review.productId,
    }).lean();

    if (!eligibleOrder?._id) {
      return res.status(403).json({ message: 'Review can only be edited for delivered-order purchases' });
    }

    review.rating = newRating;
    review.comment = newComment;
    await review.save();
    await updateProductRating(review.productId);

    const updated = await Review.findById(req.params.id).populate('userId', 'name avatar').lean();
    res.json({
      _id: toId(updated._id),
      rating: updated.rating,
      comment: updated.comment,
      product: toId(updated.productId),
      order: toId(updated.orderId),
      user: {
        _id: toId(updated.userId?._id || updated.userId),
        name: updated.userId?.name,
        avatar: updated.userId?.avatar,
      },
      createdAt: updated.createdAt,
      updatedAt: updated.updatedAt,
    });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

exports.deleteReview = async (req, res) => {
  try {
    const review = await Review.findById(req.params.id);
    if (!review) return res.status(404).json({ message: 'Review not found' });
    if (toId(review.userId) !== req.user.id) {
      return res.status(403).json({ message: 'You can only delete your own reviews' });
    }

    await Review.findByIdAndDelete(req.params.id);
    await updateProductRating(review.productId);
    res.json({ message: 'Review deleted' });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

exports.getMyReviews = async (req, res) => {
  try {
    const reviews = await Review.find({ userId: req.user.id })
      .populate('productId', 'name image')
      .sort({ createdAt: -1 })
      .lean();

    const shaped = reviews.map((review) => ({
      _id: toId(review._id),
      rating: review.rating,
      comment: review.comment,
      product: review.productId
        ? {
            _id: toId(review.productId?._id || review.productId),
            name: review.productId?.name,
            image: review.productId?.image || '',
          }
        : {
            _id: String(review.productId || ''),
            name: undefined,
            image: '',
          },
      order: toId(review.orderId),
      user: toId(review.userId),
      createdAt: review.createdAt,
      updatedAt: review.updatedAt,
    }));

    res.json(shaped);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};
