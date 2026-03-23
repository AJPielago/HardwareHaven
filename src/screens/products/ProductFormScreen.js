import React, { useState, useEffect } from 'react';
import { View, StyleSheet, ScrollView, Alert, Image } from 'react-native';
import { TextInput, Button, Text, Title, Switch, Menu } from 'react-native-paper';
import { useDispatch } from 'react-redux';
import { launchImageLibraryAsync, launchCameraAsync, requestCameraPermissionsAsync } from '../../utils/imagePickerWeb';
import { createProduct, updateProduct } from '../../store/slices/productSlice';
import { getImageUrl } from '../../api/config';
import { appendImageToFormData, imageExtensionFromAsset } from '../../utils/formDataUpload';

const HARDWARE_CATEGORIES = [
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

const DECIMAL_PATTERN = /^\d+(?:\.\d{1,2})?$/;
const INTEGER_PATTERN = /^\d+$/;

const sanitizeDecimalInput = (value) => {
  const stripped = String(value || '').replace(/[^0-9.]/g, '');
  const parts = stripped.split('.');
  if (parts.length <= 1) return stripped;
  return `${parts[0]}.${parts.slice(1).join('').slice(0, 2)}`;
};

const sanitizeIntegerInput = (value) => String(value || '').replace(/\D/g, '');

export default function ProductFormScreen({ route, navigation }) {
  const product = route.params?.product;
  const isEdit = !!product;
  const dispatch = useDispatch();

  const [name, setName] = useState(product?.name || '');
  const [description, setDescription] = useState(product?.description || '');
  const [price, setPrice] = useState(product?.price?.toString() || '');
  const [category, setCategory] = useState(product?.category || '');
  const [categoryMenuVisible, setCategoryMenuVisible] = useState(false);
  const [stock, setStock] = useState(product?.stock != null ? String(product.stock) : '');
  const [isService, setIsService] = useState(product?.isService || false);
  const [images, setImages] = useState([]);
  const [loading, setLoading] = useState(false);

  const pickImage = async () => {
    const result = await launchImageLibraryAsync({
      mediaTypes: ['images'],
      allowsEditing: false,
      allowsMultipleSelection: true,
      quality: 0.7,
    });
    if (!result.canceled) {
      const picked = result.assets || [];
      setImages((prev) => [...prev, ...picked]);
    }
  };

  const takePhoto = async () => {
    const { status } = await requestCameraPermissionsAsync();
    if (status !== 'granted') {
      Alert.alert('Permission needed', 'Camera permission is required');
      return;
    }
    const result = await launchCameraAsync({
      allowsEditing: false,
      quality: 0.7,
    });
    if (!result.canceled) setImages((prev) => [...prev, result.assets[0]]);
  };

  const handleSubmit = async () => {
    if (!name || !description || !price || !category) {
      Alert.alert('Error', 'Please fill in all required fields');
      return;
    }
    if (!HARDWARE_CATEGORIES.includes(category)) {
      Alert.alert('Error', 'Please select a valid product category');
      return;
    }
    if (!DECIMAL_PATTERN.test(price) || Number(price) < 0) {
      Alert.alert('Error', 'Price must be a valid number with up to 2 decimal places');
      return;
    }
    if (!isService && !INTEGER_PATTERN.test(stock || '')) {
      Alert.alert('Error', 'Stock must contain numbers only');
      return;
    }
    if (!isService && Number(stock) < 0) {
      Alert.alert('Error', 'Stock cannot be negative');
      return;
    }

    setLoading(true);
    const formData = new FormData();
    formData.append('name', name);
    formData.append('description', description);
    formData.append('price', price);
    formData.append('category', category);
    formData.append('stock', isService ? '0' : stock || '0');
    formData.append('isService', isService.toString());
    // append selected images (multiple) as 'images' fields
    if (images && images.length) {
      images.forEach((img, idx) => {
        const ext = imageExtensionFromAsset(img);
        appendImageToFormData(formData, 'images', img, { fileName: `product_${idx}.${ext}` });
      });
    } else if (product?.image) {
      // keep existing images if no new ones selected
      // backend will not update image field if no files provided
    }

    try {
      if (isEdit) {
        await dispatch(updateProduct({ id: product._id, formData })).unwrap();
        Alert.alert('Success', 'Product updated successfully');
      } else {
        await dispatch(createProduct(formData)).unwrap();
        Alert.alert('Success', 'Product created successfully');
      }
      navigation.goBack();
    } catch (err) {
      Alert.alert('Error', err || 'Failed to save product');
    }
    setLoading(false);
  };

  return (
    <ScrollView contentContainerStyle={styles.container}>
      <Title style={styles.title}>{isEdit ? 'Edit Product' : 'Add Product'}</Title>

      <View style={styles.imageContainer}>
        {images && images.length ? (
          <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.previewRow}>
            {images.map((img, idx) => (
              <View key={idx} style={styles.previewItem}>
                <Image source={{ uri: img.uri }} style={styles.imageThumb} />
                <Button compact onPress={() => setImages((prev) => prev.filter((_, i) => i !== idx))} style={styles.removeBtn}>Remove</Button>
              </View>
            ))}
          </ScrollView>
        ) : product?.images && product.images.length ? (
          <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.previewRow}>
            {product.images.map((uri, idx) => (
              <Image key={idx} source={{ uri: getImageUrl(uri) }} style={styles.imageThumb} />
            ))}
          </ScrollView>
        ) : (
          <View style={styles.imagePlaceholder}><Text>No Image</Text></View>
        )}
        <View style={styles.imageButtons}>
          <Button mode="outlined" onPress={pickImage} compact>Gallery</Button>
          <Button mode="outlined" onPress={takePhoto} compact style={{ marginLeft: 10 }}>Camera</Button>
        </View>
      </View>

      <TextInput label="Product Name *" value={name} onChangeText={setName} mode="outlined" style={styles.input} />
      <TextInput label="Description *" value={description} onChangeText={setDescription} mode="outlined" multiline numberOfLines={3} style={styles.input} />
      <TextInput
        label="Price *"
        value={price}
        onChangeText={(value) => setPrice(sanitizeDecimalInput(value))}
        mode="outlined"
        keyboardType="decimal-pad"
        style={styles.input}
        left={<TextInput.Icon icon="currency-php" />}
        placeholder="0.00"
      />

      <Text style={styles.categoryLabel}>Category *</Text>
      <Menu
        visible={categoryMenuVisible}
        onDismiss={() => setCategoryMenuVisible(false)}
        anchor={(
          <Button
            mode="outlined"
            onPress={() => setCategoryMenuVisible(true)}
            style={styles.categoryDropdown}
            contentStyle={styles.categoryDropdownContent}
            icon="chevron-down"
          >
            {category || 'Select category'}
          </Button>
        )}
      >
        {HARDWARE_CATEGORIES.map((cat) => (
          <Menu.Item
            key={cat}
            title={cat}
            onPress={() => {
              setCategory(cat);
              setCategoryMenuVisible(false);
            }}
          />
        ))}
      </Menu>

      <View style={styles.switchRow}>
        <Text>This is a service (no stock tracking)</Text>
        <Switch value={isService} onValueChange={setIsService} />
      </View>

      {!isService && (
        <TextInput
          label="Stock"
          value={stock}
          onChangeText={(value) => setStock(sanitizeIntegerInput(value))}
          mode="outlined"
          keyboardType="numeric"
          style={styles.input}
          placeholder="Enter stock quantity"
        />
      )}

      <Button mode="contained" onPress={handleSubmit} loading={loading} disabled={loading} style={styles.button}>
        {isEdit ? 'Update Product' : 'Create Product'}
      </Button>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flexGrow: 1, padding: 20 },
  title: { fontSize: 24, fontWeight: 'bold', textAlign: 'center', marginBottom: 20 },
  input: { marginBottom: 15 },
  categoryLabel: { marginBottom: 8, marginTop: 4, fontWeight: '600' },
  categoryDropdown: { marginBottom: 12, justifyContent: 'flex-start' },
  categoryDropdownContent: { justifyContent: 'space-between' },
  button: { marginTop: 10, paddingVertical: 5 },
  imageContainer: { alignItems: 'center', marginBottom: 20 },
  imagePreview: { width: 200, height: 150, borderRadius: 10 },
  imagePlaceholder: { width: 200, height: 150, borderRadius: 10, backgroundColor: '#eee', justifyContent: 'center', alignItems: 'center' },
  imageButtons: { flexDirection: 'row', marginTop: 10 },
  previewRow: { flexDirection: 'row', marginBottom: 8 },
  previewItem: { marginRight: 8, alignItems: 'center' },
  imageThumb: { width: 100, height: 80, borderRadius: 6, backgroundColor: '#eee' },
  removeBtn: { marginTop: 4, paddingHorizontal: 6, paddingVertical: 2 },
  switchRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 15, paddingHorizontal: 5 },
});
