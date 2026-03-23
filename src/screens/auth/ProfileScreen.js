import React, { useState, useEffect, useCallback } from 'react';
import { View, StyleSheet, ScrollView, Alert, Platform } from 'react-native';
import { TextInput, Button, Text, Avatar, IconButton, Divider, Snackbar } from 'react-native-paper';
import { useDispatch, useSelector } from 'react-redux';
import { launchImageLibraryAsync, launchCameraAsync, requestCameraPermissionsAsync } from '../../utils/imagePickerWeb';
import { updateProfile, getProfile, logout } from '../../store/slices/authSlice';
import { getImageUrl } from '../../api/config';
import { useResponsive } from '../../utils/responsive';
import { appendImageToFormData } from '../../utils/formDataUpload';

export default function ProfileScreen({ navigation }) {
  const dispatch = useDispatch();
  const { user } = useSelector((state) => state.auth);
  const { isWeb, isDesktop } = useResponsive();
  const [name, setName] = useState(user?.name || '');
  const [phone, setPhone] = useState(user?.phone || '');
  const [address, setAddress] = useState(user?.address || '');
  const [secondaryAddress, setSecondaryAddress] = useState(user?.secondaryAddress || '');
  const [showSecondaryAddress, setShowSecondaryAddress] = useState(!!user?.secondaryAddress);
  const [avatar, setAvatar] = useState(null);
  const [loading, setLoading] = useState(false);
  const [snack, setSnack] = useState({ visible: false, message: '', error: false });
  const [avatarBust, setAvatarBust] = useState(0);

  const showSnack = (message, error = false) => {
    setSnack({ visible: true, message, error });
  };

  const normalizeText = (value) => String(value ?? '').trim();
  const hasSavedSecondaryAddress = normalizeText(user?.secondaryAddress).length > 0;

  const syncFormFromServerUser = useCallback((u) => {
    if (!u) return;
    setName(u.name || '');
    setPhone(u.phone || '');
    setAddress(u.address || '');
    setSecondaryAddress(u.secondaryAddress || '');
    setShowSecondaryAddress(false);
  }, []);

  useEffect(() => {
    if (user) {
      syncFormFromServerUser(user);
    }
  }, [user, syncFormFromServerUser]);

  const pickImage = async () => {
    const result = await launchImageLibraryAsync({
      mediaTypes: ['images'],
      allowsEditing: false,
      quality: 0.7,
    });
    if (!result.canceled) setAvatar(result.assets[0]);
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
    if (!result.canceled) setAvatar(result.assets[0]);
  };

  const handleUpdate = async () => {
    setLoading(true);
    const hadAvatarUpload = Boolean(avatar);
    const previousAvatar = normalizeText(user?.avatar);
    const payload = avatar
      ? (() => {
          const formData = new FormData();
          formData.append('name', normalizeText(name));
          formData.append('phone', normalizeText(phone));
          formData.append('address', normalizeText(address));
          formData.append('secondaryAddress', normalizeText(secondaryAddress));
          appendImageToFormData(formData, 'avatar', avatar, { fileName: 'avatar.jpg' });
          return formData;
        })()
      : {
          name: normalizeText(name),
          phone: normalizeText(phone),
          address: normalizeText(address),
          secondaryAddress: normalizeText(secondaryAddress),
        };

    try {
      await dispatch(updateProfile(payload)).unwrap();
      const fresh = await dispatch(getProfile()).unwrap();
      syncFormFromServerUser(fresh);
      setAvatar(null);
      setAvatarBust((n) => n + 1);
      if (normalizeText(secondaryAddress)) {
        setShowSecondaryAddress(false);
      }
      showSnack('Profile updated successfully.', false);
    } catch (err) {
      try {
        const latest = await dispatch(getProfile()).unwrap();
        const latestAvatar = normalizeText(latest?.avatar);
        const textFieldsSaved =
          normalizeText(latest?.name) === normalizeText(name) &&
          normalizeText(latest?.phone) === normalizeText(phone) &&
          normalizeText(latest?.address) === normalizeText(address) &&
          normalizeText(latest?.secondaryAddress) === normalizeText(secondaryAddress);
        const avatarSaved = !hadAvatarUpload || (latestAvatar && latestAvatar !== previousAvatar);

        if (textFieldsSaved && avatarSaved) {
          syncFormFromServerUser(latest);
          setAvatar(null);
          setAvatarBust((n) => n + 1);
          if (normalizeText(secondaryAddress)) {
            setShowSecondaryAddress(false);
          }
          showSnack('Profile updated successfully.', false);
          return;
        }
      } catch {
        // Ignore fallback fetch errors and surface the original update error.
      }

      showSnack(String(err?.message || err || 'Failed to update profile'), true);
    } finally {
      setLoading(false);
    }
  };

  const handleLogout = () => {
    Alert.alert('Logout', 'Are you sure you want to logout?', [
      { text: 'Cancel' },
      { text: 'Logout', style: 'destructive', onPress: () => dispatch(logout()) },
    ]);
  };

  const avatarUri = avatar?.uri || getImageUrl(user?.avatar);
  const avatarImageKey = `${avatarUri || 'none'}-${avatarBust}`;

  return (
    <View style={styles.root}>
    <ScrollView style={styles.scroll} contentContainerStyle={[styles.container, isDesktop && styles.containerDesktop]}>
      <View style={[styles.card, isDesktop && styles.cardDesktop]}>
        {/* Header Section */}
        <View style={[styles.headerSection, isDesktop && styles.headerSectionDesktop]}>
          <Text variant="headlineMedium" style={styles.headerTitle}>Profile Settings</Text>
          <Text variant="bodyMedium" style={styles.headerSubtitle}>Manage your account information</Text>
        </View>

        <Divider style={{ marginBottom: 24 }} />

        {/* Avatar Section */}
        <View style={styles.avatarSection}>
          <View style={styles.avatarWrapper}>
            {avatarUri ? (
              <Avatar.Image
                key={avatarImageKey}
                size={isDesktop ? 120 : 100}
                source={{ uri: avatarUri }}
                style={styles.avatar}
              />
            ) : (
              <Avatar.Icon size={isDesktop ? 120 : 100} icon="account" style={styles.avatar} />
            )}
            <View style={styles.avatarOverlay}>
              <IconButton icon="camera" size={20} iconColor="#fff" onPress={pickImage} style={styles.cameraBtn} />
            </View>
          </View>
          <View style={styles.avatarButtons}>
            <Button mode="outlined" onPress={pickImage} compact style={[styles.avatarBtn, !isWeb && styles.avatarBtnSpacing]} textColor="#7c3aed" icon="image">Gallery</Button>
            {!isWeb && (
              <Button mode="outlined" onPress={takePhoto} compact style={styles.avatarBtn} textColor="#7c3aed" icon="camera">Camera</Button>
            )}
          </View>
          <Text style={styles.email}>{user?.email}</Text>
          {user?.role === 'admin' && (
            <View style={styles.adminBadge}>
              <Text style={styles.adminBadgeText}>ADMIN</Text>
            </View>
          )}
        </View>

        <Divider style={{ marginVertical: 20 }} />

        {/* Form Section */}
        <View style={styles.formSection}>
          <Text variant="titleMedium" style={styles.sectionTitle}>Personal Information</Text>
          
          <TextInput 
            label="Name" 
            value={name} 
            onChangeText={setName} 
            mode="outlined" 
            style={[styles.input, isDesktop && styles.inputDesktop]} 
            left={<TextInput.Icon icon="account" color="#7c3aed" />} 
            outlineColor="#e0e0e0"
            activeOutlineColor="#7c3aed"
          />
          <TextInput 
            label="Phone" 
            value={phone} 
            onChangeText={setPhone} 
            mode="outlined" 
            keyboardType="phone-pad" 
            style={[styles.input, isDesktop && styles.inputDesktop]} 
            left={<TextInput.Icon icon="phone" color="#7c3aed" />} 
            outlineColor="#e0e0e0"
            activeOutlineColor="#7c3aed"
          />
        </View>

        <View style={styles.formSection}>
          <Text variant="titleMedium" style={styles.sectionTitle}>Addresses</Text>
          
          <TextInput 
            label="Primary Address" 
            value={address} 
            onChangeText={setAddress} 
            mode="outlined" 
            multiline 
            numberOfLines={3}
            style={[styles.input, isDesktop && styles.inputDesktop]} 
            left={<TextInput.Icon icon="map-marker" color="#7c3aed" />} 
            outlineColor="#e0e0e0"
            activeOutlineColor="#7c3aed"
          />
        </View>

        {hasSavedSecondaryAddress ? (
          <TextInput
            label="Secondary Address"
            value={secondaryAddress}
            onChangeText={setSecondaryAddress}
            mode="outlined"
            multiline
            numberOfLines={3}
            style={[styles.input, isDesktop && styles.inputDesktop]}
            left={<TextInput.Icon icon="map-marker-plus" color="#7c3aed" />}
            outlineColor="#e0e0e0"
            activeOutlineColor="#7c3aed"
          />
        ) : (
          <>
            <View style={[styles.secondaryAddressHeader, isDesktop && styles.secondaryAddressHeaderDesktop]}>
              <View style={styles.secondaryAddressTextWrap}>
                <Text style={styles.secondaryAddressTitle}>Secondary Address</Text>
                <Text style={styles.secondaryAddressHint}>Add an optional backup shipping address.</Text>
              </View>
              <IconButton
                icon={showSecondaryAddress ? 'close-circle-outline' : 'plus-circle-outline'}
                onPress={() => {
                  if (showSecondaryAddress) {
                    setSecondaryAddress('');
                    setShowSecondaryAddress(false);
                    return;
                  }
                  setShowSecondaryAddress(true);
                }}
                iconColor="#7c3aed"
              />
            </View>

            {showSecondaryAddress && (
              <TextInput
                label="Secondary Address"
                value={secondaryAddress}
                onChangeText={setSecondaryAddress}
                mode="outlined"
                multiline
                numberOfLines={3}
                style={[styles.input, isDesktop && styles.inputDesktop]}
                left={<TextInput.Icon icon="map-marker-plus" color="#7c3aed" />}
                outlineColor="#e0e0e0"
                activeOutlineColor="#7c3aed"
              />
            )}
          </>
        )}

        <Divider style={{ marginVertical: 24 }} />

        <Button 
          mode="contained" 
          onPress={handleUpdate} 
          loading={loading} 
          disabled={loading} 
          style={[styles.button, isDesktop && styles.buttonDesktop]}
          buttonColor="#7c3aed"
          contentStyle={styles.buttonContent}
        >
          Update Profile
        </Button>

        <Button 
          mode="outlined" 
          onPress={handleLogout} 
          style={[styles.logoutBtn, isDesktop && styles.buttonDesktop]} 
          textColor="#ef4444"
          icon="logout"
        >
          Logout
        </Button>
      </View>
    </ScrollView>
      <Snackbar
        visible={snack.visible}
        onDismiss={() => setSnack((s) => ({ ...s, visible: false }))}
        duration={snack.error ? 5000 : 3500}
        style={snack.error ? styles.snackError : styles.snackOk}
      >
        {snack.message}
      </Snackbar>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#f5f5f5' },
  scroll: { flex: 1 },
  container: { flexGrow: 1, backgroundColor: '#f5f5f5' },
  containerDesktop: {
    backgroundColor: '#fafafa',
    paddingHorizontal: 40,
    paddingVertical: 32,
    justifyContent: 'center',
  },
  card: {
    backgroundColor: '#fff',
    borderRadius: 16,
    margin: 16,
    padding: 20,
    ...Platform.select({
      web: { boxShadow: '0 4px 12px rgba(0,0,0,0.08)' },
      default: { elevation: 4 },
    }),
  },
  cardDesktop: {
    maxWidth: 600,
    alignSelf: 'center',
    width: '100%',
    margin: 0,
    padding: 32,
    borderRadius: 20,
  },
  headerSection: { marginBottom: 16 },
  headerSectionDesktop: { textAlign: 'center', alignItems: 'center' },
  headerTitle: { fontWeight: '700', color: '#1a1a2e', textAlign: 'center' },
  headerSubtitle: { color: '#666', marginTop: 4, textAlign: 'center' },
  avatarSection: { alignItems: 'center', marginBottom: 16 },
  avatarWrapper: { position: 'relative' },
  avatar: {
    backgroundColor: '#ede9fe',
  },
  avatarOverlay: {
    position: 'absolute',
    bottom: 0,
    right: 0,
    backgroundColor: '#7c3aed',
    borderRadius: 20,
    ...Platform.select({
      web: { boxShadow: '0 2px 8px rgba(0,0,0,0.2)' },
      default: { elevation: 4 },
    }),
  },
  cameraBtn: { margin: 0 },
  avatarButtons: { flexDirection: 'row', marginTop: 16, alignItems: 'center' },
  avatarBtn: { borderColor: '#7c3aed', borderRadius: 8 },
  avatarBtnSpacing: { marginRight: 12 },
  email: { textAlign: 'center', color: '#666', marginTop: 12, fontSize: 14 },
  adminBadge: {
    backgroundColor: '#7c3aed',
    paddingHorizontal: 12,
    paddingVertical: 4,
    borderRadius: 12,
    marginTop: 8,
  },
  adminBadgeText: { color: '#fff', fontWeight: '700', fontSize: 10, letterSpacing: 1 },
  formSection: { marginBottom: 20 },
  sectionTitle: { fontWeight: '600', color: '#1a1a2e', marginBottom: 12 },
  input: { marginBottom: 16, backgroundColor: '#fff' },
  inputDesktop: { fontSize: 16 },
  secondaryAddressHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 12,
    backgroundColor: '#f9f9f9',
    padding: 12,
    borderRadius: 8,
  },
  secondaryAddressHeaderDesktop: {
    backgroundColor: '#fafafa',
  },
  secondaryAddressTextWrap: { flex: 1, paddingRight: 10 },
  secondaryAddressTitle: { fontWeight: '600', color: '#1a1a2e' },
  secondaryAddressHint: { color: '#666', fontSize: 12, marginTop: 2 },
  button: { marginTop: 8, borderRadius: 12 },
  buttonDesktop: { maxWidth: 300, alignSelf: 'center' },
  buttonContent: { paddingVertical: 6 },
  logoutBtn: { marginTop: 16, borderColor: '#ef4444', borderRadius: 12 },
  snackOk: { backgroundColor: '#1a1a2e' },
  snackError: { backgroundColor: '#b00020' },
});
