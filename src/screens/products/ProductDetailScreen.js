import React, { useEffect, useState, useRef } from 'react';
import { View, ScrollView, StyleSheet, Alert, Image, Dimensions, TouchableOpacity, Platform } from 'react-native';
import { Text, Button, Chip, Divider, Card, IconButton } from 'react-native-paper';
import { useFocusEffect } from '@react-navigation/native';
import { useDispatch, useSelector } from 'react-redux';
import { fetchProduct, deleteProduct } from '../../store/slices/productSlice';
import { addToCart } from '../../store/slices/cartSlice';
import { fetchProductReviews, deleteReview } from '../../store/slices/reviewSlice';
import { fetchMyOrders } from '../../store/slices/orderSlice';
import { getImageUrl } from '../../api/config';
import { useResponsive } from '../../utils/responsive';

export default function ProductDetailScreen({ route, navigation }) {
  const { id } = route.params;
  const dispatch = useDispatch();
  const { currentProduct: product, loading } = useSelector((state) => state.products);
  const { items: reviews } = useSelector((state) => state.reviews);
  const { items: myOrders } = useSelector((state) => state.orders);
  const { user } = useSelector((state) => state.auth);
  const { isWeb, isDesktop } = useResponsive();

  useEffect(() => {
    dispatch(fetchProduct(id));
    dispatch(fetchProductReviews(id));
    if (user) {
      dispatch(fetchMyOrders());
    }
  }, [dispatch, id, user]);

  useFocusEffect(
    React.useCallback(() => {
      dispatch(fetchProduct(id));
      dispatch(fetchProductReviews(id));
      if (user) {
        dispatch(fetchMyOrders());
      }
    }, [dispatch, id, user])
  );

  const [activeIndex, setActiveIndex] = useState(0);
  const mainScrollRef = useRef(null);
  const screenWidth = Dimensions.get('window').width;

  const myReview = reviews.find((review) => review.user?._id === user?._id || review.user?.id === user?.id) || null;
  const canWriteReview = !!myOrders.find(
    (order) => ['delivered', 'completed'].includes(String(order.status || '').toLowerCase())
      && (order.items || []).some((item) => item.product === product?._id || item.product?._id === product?._id)
  );

  const handleAddToCart = () => {
    if (!product) return;
    dispatch(addToCart({
      productId: product._id,
      name: product.name,
      price: product.price,
      image: product.image,
      stock: product.stock,
    }));
    Alert.alert('Added to Cart', `${product.name} has been added to your cart`);
  };

  const handleDelete = () => {
    Alert.alert('Delete Product', 'Are you sure?', [
      { text: 'Cancel' },
      {
        text: 'Delete', style: 'destructive', onPress: async () => {
          await dispatch(deleteProduct(id)).unwrap();
          navigation.goBack();
        }
      },
    ]);
  };

  const handleDeleteReview = (reviewId) => {
    Alert.alert('Delete Review', 'Are you sure you want to delete your review?', [
      { text: 'Cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: async () => {
          try {
            await dispatch(deleteReview(reviewId)).unwrap();
            await dispatch(fetchProductReviews(id));
            await dispatch(fetchProduct(id));
            Alert.alert('Success', 'Review deleted');
          } catch (err) {
            Alert.alert('Error', err || 'Failed to delete review');
          }
        },
      },
    ]);
  };

  if (!product) return <View style={styles.center}><Text>Loading...</Text></View>;

  return (
    <ScrollView style={[styles.container, isDesktop && styles.containerDesktop]}>
      <View style={[styles.mainContent, isDesktop && styles.mainContentDesktop]}>
        {/* Left side - Images */}
        <View style={[styles.imageSection, isDesktop && styles.imageSectionDesktop]}>
          {product.images && product.images.length ? (
            <>
              <ScrollView
                ref={mainScrollRef}
                horizontal
                pagingEnabled
                showsHorizontalScrollIndicator={false}
                style={[styles.imageScroll, isDesktop && styles.imageScrollDesktop]}
                onScroll={({ nativeEvent }) => {
                  const index = Math.round(nativeEvent.contentOffset.x / screenWidth);
                  setActiveIndex(index);
                }}
                scrollEventThrottle={16}
              >
                {product.images.map((img, idx) => (
                  <Image key={idx} source={{ uri: getImageUrl(img) }} style={[styles.image, isDesktop && styles.imageDesktop]} resizeMode="cover" />
                ))}
              </ScrollView>

              <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.thumbRow} contentContainerStyle={styles.thumbRowContent}>
                {product.images.map((img, idx) => (
                  <TouchableOpacity key={idx} onPress={() => mainScrollRef.current?.scrollTo({ x: idx * screenWidth, animated: true })}>
                    <Image source={{ uri: getImageUrl(img) }} style={[styles.thumb, activeIndex === idx ? styles.thumbActive : null]} />
                  </TouchableOpacity>
                ))}
              </ScrollView>
            </>
          ) : (
            <View style={[styles.placeholderImage, isDesktop && styles.placeholderImageDesktop]}>
              <IconButton icon="image-off" size={48} iconColor="#ccc" />
              <Text style={{ color: '#999' }}>No Image Available</Text>
            </View>
          )}
        </View>

        {/* Right side - Details */}
        <View style={[styles.content, isDesktop && styles.contentDesktop]}>
          <View style={styles.titleRow}>
            <Text variant="headlineMedium" style={styles.name}>{product.name}</Text>
            {user?.role === 'admin' && (
              <View style={{ flexDirection: 'row' }}>
                <IconButton icon="pencil" onPress={() => navigation.navigate('ProductForm', { product })} iconColor="#7c3aed" />
                <IconButton icon="delete" onPress={handleDelete} iconColor="#ef4444" />
              </View>
            )}
          </View>

          <Text variant="headlineSmall" style={styles.price}>₱{product.price.toFixed(2)}</Text>

          <View style={styles.metaRow}>
            <Chip icon="tag" style={styles.metaChip}>{product.category}</Chip>
            <Chip icon="star" style={[styles.metaChip, { marginLeft: 10 }]}>
              {product.averageRating.toFixed(1)} ({product.numReviews} reviews)
            </Chip>
          </View>

          {!product.isService && (
            <Text style={[styles.stock, product.stock > 0 ? styles.inStock : styles.outOfStock]}>
              {product.stock > 0 ? `✓ In Stock (${product.stock} available)` : '✗ Out of Stock'}
            </Text>
          )}

          <Divider style={{ marginVertical: 20 }} />

          <Text variant="titleMedium" style={styles.sectionTitle}>Description</Text>
          <Text style={styles.description}>{product.description}</Text>

          <Button
            mode="contained"
            onPress={handleAddToCart}
            icon="cart-plus"
            style={[styles.cartButton, isDesktop && styles.cartButtonDesktop]}
            buttonColor="#7c3aed"
            contentStyle={styles.cartButtonContent}
            disabled={!product.isService && product.stock === 0}
          >
            Add to Cart
          </Button>
        </View>
      </View>

      {/* Reviews Section */}
      <View style={[styles.reviewsSection, isDesktop && styles.reviewsSectionDesktop]}>
        <Divider style={{ marginBottom: 20 }} />

        <View style={styles.reviewHeader}>
          <Text variant="headlineSmall" style={styles.sectionTitle}>Reviews ({reviews.length})</Text>
          {user ? (
            <Button
              mode="outlined"
              compact
              disabled={!myReview && !canWriteReview}
              onPress={() => navigation.navigate('ReviewForm', { productId: product._id, review: myReview || undefined })}
              textColor="#7c3aed"
              style={{ borderColor: '#7c3aed' }}
            >
              {myReview ? 'Edit Review' : 'Write Review'}
            </Button>
          ) : null}
        </View>

        {user && !myReview && !canWriteReview ? (
          <Text style={styles.noReviews}>Only users with completed orders of this product can write a review.</Text>
        ) : null}

        {reviews.map((review) => (
          <Card key={review._id} style={[styles.reviewCard, isDesktop && styles.reviewCardDesktop]}>
            <Card.Content>
              <View style={styles.reviewTop}>
                <View style={styles.reviewUser}>
                  <IconButton icon="account-circle" size={32} iconColor="#7c3aed" style={{ margin: 0 }} />
                  <Text variant="titleMedium" style={{ fontWeight: '600' }}>{review.user?.name || 'User'}</Text>
                </View>
                <Text style={styles.reviewRating}>{'★'.repeat(review.rating)}{'☆'.repeat(5 - review.rating)}</Text>
              </View>
              <Text style={styles.reviewComment}>{review.comment}</Text>
              <Text style={styles.reviewDate}>{new Date(review.createdAt).toLocaleDateString()}</Text>
              {review.user?._id === user?._id || review.user?.id === user?.id ? (
                <View style={styles.reviewActions}>
                  <Button
                    mode="text"
                    compact
                    onPress={() => navigation.navigate('ReviewForm', { productId: product._id, review })}
                    textColor="#7c3aed"
                  >
                    Edit Review
                  </Button>
                  <Button
                    mode="text"
                    compact
                    onPress={() => handleDeleteReview(review._id)}
                    textColor="#ef4444"
                  >
                    Delete Review
                  </Button>
                </View>
              ) : null}
            </Card.Content>
          </Card>
        ))}

        {reviews.length === 0 && (
          <View style={styles.noReviewsContainer}>
            <IconButton icon="comment-off-outline" size={48} iconColor="#ccc" />
            <Text style={styles.noReviews}>No reviews yet</Text>
          </View>
        )}
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#fff' },
  containerDesktop: {
    backgroundColor: '#fafafa',
  },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  mainContent: {},
  mainContentDesktop: {
    flexDirection: 'row',
    maxWidth: 1200,
    alignSelf: 'center',
    width: '100%',
    paddingHorizontal: 40,
    paddingTop: 32,
  },
  imageSection: {},
  imageSectionDesktop: {
    flex: 1,
    marginRight: 40,
  },
  image: { width: Dimensions.get('window').width, height: 300 },
  imageDesktop: { width: 500, height: 400, borderRadius: 16 },
  placeholderImage: { width: '100%', height: 300, backgroundColor: '#f5f5f5', justifyContent: 'center', alignItems: 'center' },
  placeholderImageDesktop: { width: 500, height: 400, borderRadius: 16 },
  imageScroll: { width: '100%', height: 300, backgroundColor: '#000' },
  imageScrollDesktop: { width: 500, height: 400, borderRadius: 16, backgroundColor: '#f0f0f0' },
  thumbRow: { marginTop: 8, paddingHorizontal: 10 },
  thumbRowContent: { alignItems: 'center' },
  thumb: { width: 80, height: 60, borderRadius: 8, marginRight: 8, backgroundColor: '#eee' },
  thumbActive: { borderWidth: 2, borderColor: '#7c3aed' },
  content: { padding: 15 },
  contentDesktop: {
    flex: 1,
    padding: 0,
  },
  titleRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' },
  name: { flex: 1, fontWeight: '700', color: '#1a1a2e' },
  price: { color: '#7c3aed', fontWeight: '700', marginVertical: 8 },
  metaRow: { flexDirection: 'row', marginVertical: 12 },
  metaChip: { backgroundColor: '#f5f5f5' },
  stock: { marginTop: 8, fontWeight: '600', fontSize: 14 },
  inStock: { color: '#22c55e' },
  outOfStock: { color: '#ef4444' },
  sectionTitle: { fontWeight: '600', color: '#1a1a2e', marginBottom: 8 },
  description: { marginTop: 8, color: '#555', lineHeight: 24, fontSize: 15 },
  cartButton: { marginTop: 20, paddingVertical: 8, borderRadius: 12 },
  cartButtonDesktop: { marginTop: 24, maxWidth: 300 },
  cartButtonContent: { paddingVertical: 8 },
  reviewsSection: { padding: 15 },
  reviewsSectionDesktop: {
    maxWidth: 1200,
    alignSelf: 'center',
    width: '100%',
    paddingHorizontal: 40,
    paddingBottom: 40,
  },
  reviewHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 },
  reviewCard: { marginBottom: 12, borderRadius: 12, overflow: 'hidden' },
  reviewCardDesktop: {
    ...Platform.select({
      web: { boxShadow: '0 2px 8px rgba(0,0,0,0.08)' },
      default: { elevation: 2 },
    }),
  },
  reviewTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  reviewUser: { flexDirection: 'row', alignItems: 'center' },
  reviewRating: { color: '#f59e0b', fontSize: 16 },
  reviewComment: { marginTop: 12, color: '#555', lineHeight: 22 },
  reviewDate: { marginTop: 8, color: '#999', fontSize: 12 },
  reviewActions: { flexDirection: 'row', marginTop: 6 },
  noReviewsContainer: { alignItems: 'center', paddingVertical: 32 },
  noReviews: { textAlign: 'center', color: '#999', marginTop: 8 },
});
