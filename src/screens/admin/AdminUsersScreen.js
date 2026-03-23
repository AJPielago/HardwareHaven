import React, { useEffect, useState } from 'react';
import { Alert, FlatList, ScrollView, StyleSheet, View } from 'react-native';
import { Button, Card, Chip, Menu, Modal, Portal, Searchbar, Text } from 'react-native-paper';
import { useDispatch, useSelector } from 'react-redux';
import { fetchAdminUsers, setAdminUserStatus, updateAdminUser } from '../../store/slices/adminSlice';

const DEACTIVATION_REASONS = [
  'Fraudulent activity',
  'Repeated policy violations',
  'Harassment or abusive behavior',
  'Spam or fake transactions',
  'Security risk',
  'Requested by user',
];

export default function AdminUsersScreen() {
  const dispatch = useDispatch();
  const { users, loading } = useSelector((state) => state.admin);
  const [search, setSearch] = useState('');
  const [reasonModalVisible, setReasonModalVisible] = useState(false);
  const [selectedUser, setSelectedUser] = useState(null);
  const [deactivationReason, setDeactivationReason] = useState('');
  const [reasonMenuVisible, setReasonMenuVisible] = useState(false);

  useEffect(() => {
    dispatch(fetchAdminUsers());
  }, [dispatch]);

  const runSearch = () => dispatch(fetchAdminUsers({ search }));

  const changeRole = async (user, role) => {
    try {
      await dispatch(updateAdminUser({ id: user._id, payload: { role } })).unwrap();
    } catch (err) {
      Alert.alert('Error', String(err));
    }
  };

  const openDeactivateModal = (user) => {
    setSelectedUser(user);
    setDeactivationReason('');
    setReasonModalVisible(true);
  };

  const deactivateUser = async () => {
    if (!selectedUser) return;
    if (!deactivationReason.trim()) {
      Alert.alert('Reason required', 'Please provide a deactivation reason.');
      return;
    }

    try {
      await dispatch(setAdminUserStatus({
        id: selectedUser._id,
        isActive: false,
        reason: deactivationReason.trim(),
      })).unwrap();
      setReasonModalVisible(false);
      setSelectedUser(null);
      setDeactivationReason('');
      Alert.alert('Success', 'User has been deactivated and notified via email.');
    } catch (err) {
      Alert.alert('Error', String(err));
    }
  };

  const reactivateUser = async (user) => {
    try {
      await dispatch(setAdminUserStatus({ id: user._id, isActive: true })).unwrap();
      Alert.alert('Success', 'User has been reactivated.');
    } catch (err) {
      Alert.alert('Error', String(err));
    }
  };

  return (
    <View style={styles.container}>
      <Searchbar
        placeholder="Search users by name/email"
        value={search}
        onChangeText={setSearch}
        onSubmitEditing={runSearch}
        style={styles.search}
      />
      <FlatList
        data={users}
        keyExtractor={(item) => item._id}
        refreshing={loading}
        onRefresh={() => dispatch(fetchAdminUsers({ search }))}
        contentContainerStyle={styles.list}
        renderItem={({ item }) => (
          <Card style={styles.card}>
            <Card.Content>
              <View style={styles.row}>
                <View style={{ flex: 1 }}>
                  <Text variant="titleSmall">{item.name}</Text>
                  <Text style={styles.email}>{item.email}</Text>
                  {item.isActive === false && (
                    <Text style={styles.deactivatedText}>Deactivated: {item.deactivationReason || 'No reason provided'}</Text>
                  )}
                </View>
                <Chip>{item.isActive === false ? 'inactive' : item.role}</Chip>
              </View>
              <View style={styles.actions}>
                {item.role === 'user' ? (
                  <Button compact mode="outlined" onPress={() => changeRole(item, 'admin')}>Promote</Button>
                ) : (
                  <Button compact mode="outlined" onPress={() => changeRole(item, 'user')}>Demote</Button>
                )}
                {item.isActive === false ? (
                  <Button compact mode="text" textColor="#1b5e20" onPress={() => reactivateUser(item)}>Reactivate</Button>
                ) : (
                  <Button compact mode="text" textColor="#b71c1c" onPress={() => openDeactivateModal(item)}>Deactivate</Button>
                )}
              </View>
            </Card.Content>
          </Card>
        )}
      />

      <Portal>
        <Modal visible={reasonModalVisible} onDismiss={() => setReasonModalVisible(false)} contentContainerStyle={styles.modalContainer}>
          <ScrollView contentContainerStyle={styles.modalContent}>
            <Text variant="titleMedium">Deactivate User</Text>
            <Text style={styles.modalSubtitle}>
              {selectedUser ? `Reason for deactivating ${selectedUser.name}` : 'Provide a reason'}
            </Text>
            <Menu
              visible={reasonMenuVisible}
              onDismiss={() => setReasonMenuVisible(false)}
              anchor={
                <Button
                  mode="outlined"
                  onPress={() => setReasonMenuVisible(true)}
                  style={styles.reasonDropdown}
                  contentStyle={styles.reasonDropdownContent}
                  icon="chevron-down"
                >
                  {deactivationReason || 'Select deactivation reason'}
                </Button>
              }
            >
              {DEACTIVATION_REASONS.map((reason) => (
                <Menu.Item
                  key={reason}
                  title={reason}
                  onPress={() => {
                    setDeactivationReason(reason);
                    setReasonMenuVisible(false);
                  }}
                />
              ))}
            </Menu>
            <View style={styles.modalActions}>
              <Button onPress={() => setReasonModalVisible(false)}>Cancel</Button>
              <Button mode="contained" onPress={deactivateUser} style={styles.modalPrimaryBtn}>Deactivate</Button>
            </View>
          </ScrollView>
        </Modal>
      </Portal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f5f5f5' },
  search: { margin: 10 },
  list: { padding: 10, paddingTop: 0 },
  card: { marginBottom: 10 },
  row: { flexDirection: 'row', alignItems: 'center' },
  email: { color: '#666', marginTop: 2 },
  deactivatedText: { color: '#b71c1c', marginTop: 4, fontSize: 12 },
  actions: { flexDirection: 'row', justifyContent: 'flex-end', marginTop: 8 },
  modalContainer: {
    backgroundColor: '#fff',
    width: '92%',
    maxWidth: 640,
    maxHeight: '86%',
    alignSelf: 'center',
    padding: 16,
    borderRadius: 12,
  },
  modalContent: { paddingBottom: 4 },
  modalSubtitle: { color: '#666', marginTop: 6 },
  reasonDropdown: { marginTop: 12, justifyContent: 'flex-start' },
  reasonDropdownContent: { justifyContent: 'space-between', minHeight: 46 },
  modalActions: { flexDirection: 'row', justifyContent: 'flex-end', marginTop: 12 },
  modalPrimaryBtn: { marginLeft: 8 },
});