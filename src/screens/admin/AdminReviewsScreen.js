import React, { useEffect, useState } from 'react';
import { Alert, FlatList, StyleSheet, View } from 'react-native';
import { Button, Card, Searchbar, Text } from 'react-native-paper';
import { useDispatch, useSelector } from 'react-redux';
import { deleteAdminReview, fetchAdminReviews } from '../../store/slices/adminSlice';

export default function AdminReviewsScreen() {
  const dispatch = useDispatch();
  const { reviews, loading } = useSelector((state) => state.admin);
  const [search, setSearch] = useState('');

  useEffect(() => {
    dispatch(fetchAdminReviews());
  }, [dispatch]);

  const runSearch = () => dispatch(fetchAdminReviews({ search }));

  const removeReview = (review) => {
    Alert.alert('Delete Review', 'Remove this review permanently?', [
      { text: 'Cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: async () => {
          try {
            await dispatch(deleteAdminReview(review._id)).unwrap();
          } catch (err) {
            Alert.alert('Error', String(err));
          }
        },
      },
    ]);
  };

  return (
    <View style={styles.container}>
      <Searchbar
        placeholder="Search in review comment"
        value={search}
        onChangeText={setSearch}
        onSubmitEditing={runSearch}
        style={styles.search}
      />
      <FlatList
        data={reviews}
        keyExtractor={(item) => item._id}
        refreshing={loading}
        onRefresh={() => dispatch(fetchAdminReviews({ search }))}
        contentContainerStyle={styles.list}
        renderItem={({ item }) => (
          <Card style={styles.card}>
            <Card.Content>
              <Text variant="titleSmall">{item.product?.name || 'Unknown product'}</Text>
              <Text style={styles.meta}>By: {item.user?.name || 'Unknown'} | Rating: {item.rating}/5</Text>
              <Text style={styles.comment}>{item.comment}</Text>
              <Button mode="text" textColor="#b71c1c" onPress={() => removeReview(item)}>
                Delete Review
              </Button>
            </Card.Content>
          </Card>
        )}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f5f5f5' },
  search: { margin: 10 },
  list: { padding: 10, paddingTop: 0 },
  card: { marginBottom: 10 },
  meta: { marginTop: 4, color: '#555' },
  comment: { marginTop: 8, color: '#333' },
});