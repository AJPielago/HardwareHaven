function toId(value) {
  if (!value) return null;
  if (typeof value === 'string') return value;
  if (value._id) return String(value._id);
  return String(value);
}

function formatUser(user) {
  if (!user) return null;
  return {
    id: toId(user._id || user.id),
    _id: toId(user._id || user.id),
    name: user.name,
    email: user.email,
    avatar: user.avatar || '',
    phone: user.phone || '',
    address: user.address || '',
    secondaryAddress: user.secondaryAddress || '',
    provider: user.provider || 'local',
    role: user.role || 'user',
    isActive: user.isActive !== false,
    deactivatedAt: user.deactivatedAt || null,
    deactivationReason: user.deactivationReason || '',
    createdAt: user.createdAt,
    updatedAt: user.updatedAt,
  };
}

function formatProduct(product) {
  if (!product) return null;
  const createdBy = product.createdBy && typeof product.createdBy === 'object'
    ? { _id: toId(product.createdBy._id || product.createdBy), name: product.createdBy.name }
    : product.createdBy
      ? { _id: toId(product.createdBy), name: undefined }
      : null;

  return {
    _id: toId(product._id || product.id),
    name: product.name,
    description: product.description,
    price: Number(product.price || 0),
    category: product.category,
    image: product.image || '',
    stock: Number(product.stock || 0),
    isService: !!product.isService,
    averageRating: Number(product.averageRating || 0),
    numReviews: Number(product.numReviews || 0),
    createdBy,
    createdAt: product.createdAt,
    updatedAt: product.updatedAt,
  };
}

function formatNotification(notification) {
  if (!notification) return null;
  return {
    _id: toId(notification._id || notification.id),
    user: notification.userId ? toId(notification.userId._id || notification.userId) : null,
    title: notification.title,
    body: notification.body,
    data: notification.data || {},
    type: notification.type || 'general',
    isRead: !!notification.isRead,
    isBroadcast: !!notification.isBroadcast,
    createdAt: notification.createdAt,
    updatedAt: notification.updatedAt,
  };
}

function formatOrder(order, { withAdminUser = false } = {}) {
  if (!order) return null;
  const user = order.userId;

  const payload = {
    _id: toId(order._id || order.id),
    user: toId(user?._id || user),
    items: (order.items || []).map((item) => {
      const populatedProduct = item.productId && typeof item.productId === 'object' ? item.productId : null;
      return {
        _id: toId(item._id || item.id),
        product: item.productId
          ? {
              _id: toId(populatedProduct?._id || item.productId),
              name: populatedProduct?.name || item.name,
              image: populatedProduct?.image || item.image,
              price: populatedProduct?.price ?? item.price,
            }
          : null,
        name: item.name,
        price: Number(item.price || 0),
        quantity: Number(item.quantity || 0),
        image: item.image || '',
      };
    }),
    totalAmount: Number(order.totalAmount || 0),
    status: order.status,
    shippingAddress: order.shippingAddress,
    paymentMethod: order.paymentMethod,
    statusHistory: (order.statusHistory || []).map((history) => ({
      status: history.status,
      date: history.date,
      note: history.note,
    })),
    createdAt: order.createdAt,
    updatedAt: order.updatedAt,
  };

  if (withAdminUser) {
    payload.user = {
      _id: toId(user?._id || user),
      name: user?.name,
      email: user?.email,
    };
  }

  return payload;
}

module.exports = {
  toId,
  formatUser,
  formatProduct,
  formatNotification,
  formatOrder,
};
