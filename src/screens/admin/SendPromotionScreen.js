import React, { useState } from 'react';
import { View, StyleSheet, ScrollView, Alert } from 'react-native';
import { TextInput, Button, Title, Text } from 'react-native-paper';
import { useDispatch } from 'react-redux';
import { sendPromotion } from '../../store/slices/notificationSlice';

export default function SendPromotionScreen() {
  const dispatch = useDispatch();
  const [title, setTitle] = useState('');
  const [body, setBody] = useState('');
  const [productId, setProductId] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSend = async () => {
    if (!title || !body) {
      Alert.alert('Error', 'Title and body are required');
      return;
    }
    setLoading(true);
    try {
      await dispatch(sendPromotion({
        title,
        body,
        data: productId ? { productId, type: 'promotion' } : { type: 'promotion' },
      })).unwrap();
      Alert.alert('Success', 'Promotion notification sent to all users!');
      setTitle('');
      setBody('');
      setProductId('');
    } catch (err) {
      Alert.alert('Error', err || 'Failed to send promotion');
    }
    setLoading(false);
  };

  return (
    <ScrollView contentContainerStyle={styles.container}>
      <Title style={styles.title}>Send Promotion</Title>
      <Text style={styles.subtitle}>Send push notification to all users</Text>

      <TextInput label="Title *" value={title} onChangeText={setTitle} mode="outlined" style={styles.input} placeholder="e.g., 50% Off Sale!" />
      <TextInput label="Message *" value={body} onChangeText={setBody} mode="outlined" multiline numberOfLines={4} style={styles.input} placeholder="Describe the promotion..." />
      <TextInput label="Product ID (optional)" value={productId} onChangeText={setProductId} mode="outlined" style={styles.input} placeholder="Link to a specific product" />

      <Button mode="contained" onPress={handleSend} loading={loading} disabled={loading} style={styles.button} icon="send">
        Send Promotion
      </Button>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flexGrow: 1, padding: 20 },
  title: { fontSize: 24, textAlign: 'center', fontWeight: 'bold' },
  subtitle: { textAlign: 'center', color: '#666', marginBottom: 20 },
  input: { marginBottom: 15 },
  button: { marginTop: 10, paddingVertical: 5 },
});
