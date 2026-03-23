import React, { useEffect, useMemo, useState } from 'react';
import { Alert, FlatList, StyleSheet, View, Image, Dimensions, TouchableOpacity, ScrollView } from 'react-native';
import { Button, Chip, Searchbar, Text, TextInput, IconButton, Portal, Modal, Title, Paragraph, Divider } from 'react-native-paper';
import { useDispatch, useSelector } from 'react-redux';
import { fetchAdminInventory, setAdminProductStatus, updateAdminInventory } from '../../store/slices/adminSlice';
import { getImageUrl } from '../../api/config';
import { useFocusEffect, useNavigation } from '@react-navigation/native';
import { useResponsive } from '../../utils/responsive';

export default function AdminInventoryScreen() {
  const dispatch = useDispatch();
  const { inventory, loading } = useSelector((state) => state.admin);
  const { width } = useResponsive();
  const [search, setSearch] = useState('');
  const [editingId, setEditingId] = useState(null);
  const [stockInput, setStockInput] = useState('');

  useEffect(() => {
    dispatch(fetchAdminInventory());
  }, [dispatch]);

  useFocusEffect(
    React.useCallback(() => {
      dispatch(fetchAdminInventory());
    }, [dispatch])
  );

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return inventory;
    return inventory.filter((p) => p.name.toLowerCase().includes(q) || p.category.toLowerCase().includes(q));
  }, [inventory, search]);

  const isNarrow = width < 420;
  const navigation = useNavigation();

  const [modalVisible, setModalVisible] = useState(false);
  const [selected, setSelected] = useState(null);
  const [busy, setBusy] = useState(false);

  const saveStock = async (productId) => {
    const stock = Number(stockInput);
    if (Number.isNaN(stock) || stock < 0) {
      Alert.alert('Invalid Stock', 'Stock must be a non-negative number');
      return;
    }

    try {
      await dispatch(updateAdminInventory({ productId, payload: { stock } })).unwrap();
      setEditingId(null);
      setStockInput('');
    } catch (err) {
      Alert.alert('Error', String(err));
    }
  };

  const openDetails = (item) => {
    setSelected(item);
    setModalVisible(true);
  };

  const closeDetails = () => {
    setModalVisible(false);
    setSelected(null);
  };

  const handleEdit = () => {
    navigation.navigate('HomeStack', { screen: 'ProductForm', params: { product: selected } });
    closeDetails();
  };

  const handleToggleStatus = (item) => {
    const nextActive = !item.isActive;
    (async () => {
      try {
        setBusy(true);
        await dispatch(setAdminProductStatus({ productId: item._id, isActive: nextActive })).unwrap();
        await dispatch(fetchAdminInventory()).unwrap();
        closeDetails();
      } catch (err) {
        Alert.alert('Error', String(err));
      } finally {
        setBusy(false);
      }
    })();
  };

  const renderRow = ({ item }) => {
    const uri = getImageUrl(item.image) || null;
    return (
      <TouchableOpacity onPress={() => openDetails(item)} activeOpacity={0.8}>
        <View style={styles.row}>
          <View style={styles.cellImage}>
            {uri ? (
              <Image source={{ uri }} style={styles.image} />
            ) : (
              <View style={[styles.image, styles.imagePlaceholder]} />
            )}
          </View>

          <View style={styles.cellMain}>
            <Text variant="titleSmall" numberOfLines={1}>{item.name}</Text>
            {!isNarrow && <Text style={styles.meta}>{item.category}</Text>}
          </View>

          <View style={styles.cellStock}>
            {item.isService ? (
              <Chip>Service</Chip>
            ) : (
              <Chip style={{ backgroundColor: item.stock <= 10 ? '#ffebee' : '#e8f5e9' }}>
                Stock: {item.stock}
              </Chip>
            )}
            {!item.isActive && (
              <Chip style={styles.inactiveChip}>Inactive</Chip>
            )}
          </View>

          <View style={styles.cellActions}>
            {!item.isService && editingId === item._id ? (
              <View style={styles.editorRow}>
                <TextInput
                  mode="outlined"
                  keyboardType="numeric"
                  style={styles.input}
                  value={stockInput}
                  onChangeText={setStockInput}
                  placeholder="New"
                  dense
                />
                <Button mode="contained" compact onPress={() => saveStock(item._id)}>Save</Button>
                <IconButton icon="close" size={20} onPress={() => setEditingId(null)} />
              </View>
            ) : (
              <Button mode="outlined" compact onPress={() => { setEditingId(item._id); setStockInput(String(item.stock)); }}>
                Edit
              </Button>
            )}
          </View>
        </View>
      </TouchableOpacity>
    );
  };

  return (
    <View style={styles.container}>
      <Searchbar
        placeholder="Search product/category"
        value={search}
        onChangeText={setSearch}
        style={styles.search}
      />
      <FlatList
        data={filtered}
        keyExtractor={(item) => item._id}
        refreshing={loading}
        onRefresh={() => dispatch(fetchAdminInventory())}
        contentContainerStyle={styles.list}
        renderItem={renderRow}
        ItemSeparatorComponent={() => <View style={styles.divider} />}
      />
      <Portal>
        <Modal visible={modalVisible} onDismiss={closeDetails} contentContainerStyle={styles.modalContainer}>
          {selected && (
            <ScrollView contentContainerStyle={styles.modalContent}>
              {selected.image ? (
                <Image source={{ uri: getImageUrl(selected.image) }} style={styles.modalImage} />
              ) : null}
              <Title style={styles.modalTitle}>{selected.name}</Title>
              <Paragraph style={styles.modalMeta}>{selected.category} • ₱{Number(selected.price || 0).toFixed(2)}</Paragraph>
              {selected.description ? <Paragraph style={styles.modalDescription}>{selected.description}</Paragraph> : null}
              {!selected.isActive ? (
                <Paragraph style={styles.deactivatedText}>Inactive: {selected.deletedReason || 'Deactivated by admin'}</Paragraph>
              ) : null}
              <Divider style={styles.modalDivider} />
              <View style={styles.modalActions}>
                <Button onPress={handleEdit} style={styles.modalActionBtn}>Edit</Button>
                <Button mode="contained" onPress={() => handleToggleStatus(selected)} loading={busy} style={styles.modalActionBtn}>
                  {selected.isActive ? 'Deactivate' : 'Restore'}
                </Button>
                <Button onPress={closeDetails} style={styles.modalActionBtn}>Close</Button>
              </View>
            </ScrollView>
          )}
        </Modal>
      </Portal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f5f5f5' },
  search: { margin: 10 },
  list: { padding: 10, paddingTop: 0 },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 10,
    backgroundColor: '#fff',
    paddingHorizontal: 10,
    borderRadius: 6,
  },
  cellImage: { width: 56, marginRight: 10 },
  image: { width: 48, height: 48, borderRadius: 6, backgroundColor: '#eee' },
  imagePlaceholder: { justifyContent: 'center', alignItems: 'center' },
  cellMain: { flex: 1, minWidth: 120 },
  meta: { color: '#666', marginTop: 2 },
  cellStock: { width: 100, alignItems: 'flex-end', marginRight: 10 },
  cellActions: { width: 110, alignItems: 'flex-end' },
  inactiveChip: { marginTop: 6, backgroundColor: '#ffebee' },
  divider: { height: 8 },
  editorRow: { flexDirection: 'row', alignItems: 'center' },
  input: { width: 70, height: 40, marginRight: 8 },
  modalContainer: {
    backgroundColor: 'white',
    width: '92%',
    maxWidth: 760,
    maxHeight: '88%',
    alignSelf: 'center',
    borderRadius: 14,
    padding: 16,
  },
  modalContent: { paddingBottom: 4 },
  modalImage: { width: '100%', height: 220, borderRadius: 10, marginBottom: 12 },
  modalTitle: { marginBottom: 2 },
  modalMeta: { color: '#555' },
  modalDescription: { marginTop: 8 },
  modalDivider: { marginVertical: 12 },
  modalActions: { flexDirection: 'row', justifyContent: 'flex-end', alignItems: 'center' },
  modalActionBtn: { marginLeft: 6 },
  deactivatedText: { color: '#b71c1c', marginTop: 6 },
});