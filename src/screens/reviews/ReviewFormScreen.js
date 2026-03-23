import React, { useState, useEffect } from 'react';
import { View, StyleSheet, ScrollView, Alert } from 'react-native';
import { TextInput, Button, Text, Title } from 'react-native-paper';
import { useDispatch, useSelector } from 'react-redux';
import { createReview, updateReview } from '../../store/slices/reviewSlice';
import { fetchMyOrders } from '../../store/slices/orderSlice';

const PROFANITY_REGEX = [
  /\b(f+u+c+k+|s+h+i+t+|b+i+t+c+h+|a+s+s+h*o+l+e+|d+i+c+k+|c+u+n+t+|b+a+s+t+a+r+d+)\b/i,
  /\b(p+u+t+a+|p+u+t+a+n+g+i+n+a+|t+a+n+g+i+n+a+|g+a+g+o+|u+l+o+l+|b+w+i+s+i+t+|t+a+r+a+n+t+a+d+o+|p+u+n+y+e+t+a+|l+e+c+h+e+)\b/i,
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

const hasProfanity = (text) => {
  const normalized = normalizeProfanityText(text);
  const compact = normalized.replace(/\s+/g, '');
  return PROFANITY_REGEX.some((regex) => regex.test(normalized) || regex.test(compact));
};

export default function ReviewFormScreen({ route, navigation }) {
  const { productId, review, orderId } = route.params || {};
  const isEdit = !!review;
  const dispatch = useDispatch();
  const { items: orders } = useSelector((state) => state.orders);

  useEffect(() => {
    dispatch(fetchMyOrders());
  }, [dispatch]);

  const [rating, setRating] = useState(review?.rating || 5);
  const [comment, setComment] = useState(review?.comment || '');
  const [selectedOrder, setSelectedOrder] = useState(review?.order || orderId || '');
  const [loading, setLoading] = useState(false);

  // Only delivered orders are valid for creating reviews.
  const deliveredOrders = orders.filter(
    (o) => String(o.status || '').toLowerCase() === 'delivered'
      && o.items.some((item) => item.product === productId || item.product?._id === productId)
  );

  const handleSubmit = async () => {
    if (!comment.trim()) {
      Alert.alert('Error', 'Please write a comment');
      return;
    }
    if (hasProfanity(comment)) {
      Alert.alert('Error', 'Please avoid profanity in your review (English/Tagalog).');
      return;
    }
    if (!isEdit && !selectedOrder) {
      Alert.alert('Error', 'Please select an order to verify your purchase');
      return;
    }

    setLoading(true);
    try {
      if (isEdit) {
        await dispatch(updateReview({ id: review._id, rating, comment })).unwrap();
        Alert.alert('Success', 'Review updated!');
      } else {
        await dispatch(createReview({ productId, orderId: selectedOrder, rating, comment })).unwrap();
        Alert.alert('Success', 'Review submitted!');
      }
      navigation.goBack();
    } catch (err) {
      Alert.alert('Error', err || 'Failed to submit review');
    }
    setLoading(false);
  };

  const renderStars = () => (
    <View style={styles.starsRow}>
      {[1, 2, 3, 4, 5].map((star) => (
        <Text
          key={star}
          style={[styles.star, star <= rating && styles.starActive]}
          onPress={() => setRating(star)}
        >
          ★
        </Text>
      ))}
      <Text style={styles.ratingText}>{rating}/5</Text>
    </View>
  );

  return (
    <ScrollView contentContainerStyle={styles.container}>
      <Title style={styles.title}>{isEdit ? 'Edit Review' : 'Write a Review'}</Title>

      <Text variant="labelLarge" style={styles.label}>Rating</Text>
      {renderStars()}

      {!isEdit && (
        <>
          <Text variant="labelLarge" style={styles.label}>Select Order (Verified Purchase)</Text>
          {deliveredOrders.length === 0 ? (
            <Text style={styles.noOrders}>
              You need a delivered order containing this product to write a review.
            </Text>
          ) : (
            deliveredOrders.map((order) => (
              <Button
                key={order._id}
                mode={selectedOrder === order._id ? 'contained' : 'outlined'}
                onPress={() => setSelectedOrder(order._id)}
                style={styles.orderBtn}
                compact
              >
                Order #{order._id.slice(-8)} - {new Date(order.createdAt).toLocaleDateString()}
              </Button>
            ))
          )}
        </>
      )}

      <Text variant="labelLarge" style={styles.label}>Comment</Text>
      <TextInput
        value={comment}
        onChangeText={setComment}
        mode="outlined"
        multiline
        numberOfLines={4}
        placeholder="Share your experience with this product..."
        style={styles.input}
      />

      <Button mode="contained" onPress={handleSubmit} loading={loading} disabled={loading || (!isEdit && deliveredOrders.length === 0)} style={styles.button}>
        {isEdit ? 'Update Review' : 'Submit Review'}
      </Button>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flexGrow: 1, padding: 20 },
  title: { fontSize: 24, fontWeight: 'bold', textAlign: 'center', marginBottom: 20 },
  label: { marginBottom: 8, marginTop: 15 },
  starsRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 10 },
  star: { fontSize: 36, color: '#ddd', marginRight: 5 },
  starActive: { color: '#ff9800' },
  ratingText: { marginLeft: 10, fontSize: 18, fontWeight: 'bold' },
  input: { marginBottom: 15 },
  button: { marginTop: 10, paddingVertical: 5 },
  orderBtn: { marginBottom: 8 },
  noOrders: { color: '#999', fontStyle: 'italic', marginBottom: 10 },
});
