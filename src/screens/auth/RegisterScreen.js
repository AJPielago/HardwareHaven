import React, { useState } from 'react';
import { View, StyleSheet, ScrollView, Alert, Image, KeyboardAvoidingView, Platform } from 'react-native';
import { TextInput, Button, Text, Title, Card, Avatar } from 'react-native-paper';
import { useDispatch, useSelector } from 'react-redux';
import { launchImageLibraryAsync, launchCameraAsync, requestCameraPermissionsAsync } from '../../utils/imagePickerWeb';
import { register, clearError } from '../../store/slices/authSlice';
import { useResponsive } from '../../utils/responsive';
import BrandMark from '../../components/branding/BrandMark';
import { brand } from '../../theme/brandTheme';

export default function RegisterScreen({ navigation }) {
  const { isWeb, isDesktop } = useResponsive();
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [avatar, setAvatar] = useState(null);
  const [showPassword, setShowPassword] = useState(false);
  const dispatch = useDispatch();
  const { loading, error } = useSelector((state) => state.auth);

  React.useEffect(() => {
    if (error) {
      Alert.alert('Registration Failed', error);
      dispatch(clearError());
    }
  }, [error]);

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

  const handleRegister = () => {
    if (!name || !email || !password) {
      Alert.alert('Error', 'Please fill in all required fields');
      return;
    }
    if (password !== confirmPassword) {
      Alert.alert('Error', 'Passwords do not match');
      return;
    }
    if (password.length < 6) {
      Alert.alert('Error', 'Password must be at least 6 characters');
      return;
    }

    dispatch(register({
      name,
      email: email.trim(),
      password,
      avatar,
    }));
  };

  return (
    <KeyboardAvoidingView 
      style={[styles.container, isDesktop && styles.containerDesktop]} 
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
    >
      <ScrollView 
        contentContainerStyle={[styles.scrollContent, isDesktop && styles.scrollContentDesktop]}
        keyboardShouldPersistTaps="handled"
      >
        <Card style={[styles.card, isDesktop && styles.cardDesktop]}>
          <Card.Content style={styles.cardContent}>
            {/* Back Button for Web */}
            {isWeb && (
              <Button
                icon="arrow-left"
                mode="text"
                onPress={() => navigation.navigate('Landing')}
                style={styles.backButton}
                labelStyle={styles.backButtonLabel}
              >
                Back
              </Button>
            )}
            
            <View style={styles.headerContainer}>
              <BrandMark compact />
              <Title style={styles.title}>Create Account</Title>
              <Text style={styles.subtitle}>Join Hardware Haven today</Text>
            </View>

            {/* Avatar Section */}
            <View style={[styles.avatarContainer, isDesktop && styles.avatarContainerDesktop]}>
              {avatar ? (
                <Image source={{ uri: avatar.uri }} style={[styles.avatar, isDesktop && styles.avatarDesktop]} />
              ) : (
                <View style={[styles.avatarPlaceholder, isDesktop && styles.avatarPlaceholderDesktop]}>
                  <Avatar.Icon size={isDesktop ? 64 : 50} icon="account" style={{ backgroundColor: 'transparent' }} color="#999" />
                </View>
              )}
              <View style={[styles.avatarButtons, isDesktop && styles.avatarButtonsDesktop]}>
                <Button 
                  mode="outlined" 
                  onPress={pickImage} 
                  compact 
                  style={styles.avatarBtn}
                  icon="image"
                >
                  {isDesktop ? 'Upload Photo' : 'Gallery'}
                </Button>
                {!isWeb && (
                  <Button 
                    mode="outlined" 
                    onPress={takePhoto} 
                    compact 
                    style={styles.avatarBtn}
                    icon="camera"
                  >
                    Camera
                  </Button>
                )}
              </View>
            </View>

            <TextInput 
              label="Full Name *" 
              value={name} 
              onChangeText={setName} 
              mode="outlined" 
              style={[styles.input, isDesktop && styles.inputDesktop]} 
              left={<TextInput.Icon icon="account" />}
              outlineStyle={styles.inputOutline}
            />
            <TextInput 
              label="Email *" 
              value={email} 
              onChangeText={setEmail} 
              mode="outlined" 
              keyboardType="email-address" 
              autoCapitalize="none" 
              style={[styles.input, isDesktop && styles.inputDesktop]} 
              left={<TextInput.Icon icon="email" />}
              outlineStyle={styles.inputOutline}
            />
            <TextInput 
              label="Password *" 
              value={password} 
              onChangeText={setPassword} 
              mode="outlined" 
              secureTextEntry={!showPassword} 
              style={[styles.input, isDesktop && styles.inputDesktop]} 
              left={<TextInput.Icon icon="lock" />} 
              right={<TextInput.Icon icon={showPassword ? "eye-off" : "eye"} onPress={() => setShowPassword(!showPassword)} />}
              outlineStyle={styles.inputOutline}
            />
            <TextInput 
              label="Confirm Password *" 
              value={confirmPassword} 
              onChangeText={setConfirmPassword} 
              mode="outlined" 
              secureTextEntry={!showPassword} 
              style={[styles.input, isDesktop && styles.inputDesktop]} 
              left={<TextInput.Icon icon="lock-check" />}
              outlineStyle={styles.inputOutline}
            />

            <Button 
              mode="contained" 
              onPress={handleRegister} 
              loading={loading} 
              disabled={loading} 
              style={[styles.button, isDesktop && styles.buttonDesktop]}
              labelStyle={styles.buttonLabel}
            >
              Create Account
            </Button>

            <View style={styles.dividerContainer}>
              <View style={styles.divider} />
              <Text style={styles.dividerText}>or</Text>
              <View style={styles.divider} />
            </View>

            <Button
              mode="outlined"
              icon="google"
              onPress={() => navigation.navigate('SocialLogin', { provider: 'google' })}
              disabled={loading}
              style={[styles.socialButton, isDesktop && styles.socialButtonDesktop]}
              labelStyle={styles.socialButtonLabel}
              contentStyle={styles.socialButtonContent}
            >
              Sign up with Google
            </Button>

            <View style={styles.footer}>
              <Text style={styles.footerText}>Already have an account?</Text>
              <Button 
                mode="text" 
                onPress={() => navigation.navigate('Login')} 
                style={styles.linkButton}
                labelStyle={styles.linkButtonLabel}
              >
                Sign In
              </Button>
            </View>
          </Card.Content>
        </Card>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#EAF0FC',
  },
  containerDesktop: {
    backgroundColor: brand.colors.navy,
  },
  scrollContent: {
    flexGrow: 1,
    padding: 20,
  },
  scrollContentDesktop: {
    padding: 40,
    alignItems: 'center',
  },
  card: {
    backgroundColor: '#fff',
    elevation: 0,
    shadowOpacity: 0,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: '#D8E3F5',
  },
  cardDesktop: {
    width: '100%',
    maxWidth: 480,
    borderRadius: 16,
    elevation: 8,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15,
    shadowRadius: 12,
  },
  cardContent: {
    padding: Platform.OS === 'web' ? 0 : 8,
  },
  backButton: {
    alignSelf: 'flex-start',
    marginBottom: 16,
    marginLeft: -8,
  },
  backButtonLabel: {
    fontSize: 14,
  },
  headerContainer: {
    alignItems: 'center',
    marginBottom: 20,
  },
  title: {
    fontSize: 30,
    fontWeight: 'bold',
    color: brand.colors.navy,
    marginBottom: 6,
    marginTop: 14,
  },
  subtitle: {
    fontSize: 14,
    color: brand.colors.textMuted,
    textAlign: 'center',
  },
  // Avatar styles
  avatarContainer: {
    alignItems: 'center',
    marginBottom: 24,
  },
  avatarContainerDesktop: {
    marginBottom: 32,
  },
  avatar: {
    width: 100,
    height: 100,
    borderRadius: 50,
  },
  avatarDesktop: {
    width: 120,
    height: 120,
    borderRadius: 60,
  },
  avatarPlaceholder: {
    width: 100,
    height: 100,
    borderRadius: 50,
    backgroundColor: '#f0f0f0',
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 2,
    borderColor: '#CFDBEF',
    borderStyle: 'dashed',
  },
  avatarPlaceholderDesktop: {
    width: 120,
    height: 120,
    borderRadius: 60,
  },
  avatarButtons: {
    flexDirection: 'row',
    marginTop: 12,
    gap: 8,
  },
  avatarButtonsDesktop: {
    marginTop: 16,
  },
  avatarBtn: {
    borderRadius: 8,
  },
  // Input styles
  input: {
    marginBottom: 16,
    backgroundColor: '#fff',
  },
  inputDesktop: {
    marginBottom: 20,
  },
  inputOutline: {
    borderRadius: 8,
  },
  // Button styles
  button: {
    marginTop: 8,
    borderRadius: 12,
    paddingVertical: 6,
    backgroundColor: brand.colors.primary,
  },
  buttonDesktop: {
    paddingVertical: 8,
  },
  buttonLabel: {
    fontSize: 16,
    fontWeight: '600',
    letterSpacing: 0.5,
  },
  dividerContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginVertical: 24,
  },
  divider: {
    flex: 1,
    height: 1,
    backgroundColor: '#e0e0e0',
  },
  dividerText: {
    marginHorizontal: 16,
    color: brand.colors.textMuted,
    fontSize: 14,
  },
  socialButton: {
    borderRadius: 12,
    borderWidth: 1.5,
    borderColor: '#CFDBEF',
    backgroundColor: '#F7FAFF',
  },
  socialButtonDesktop: {
    paddingVertical: 4,
  },
  socialButtonLabel: {
    fontSize: 15,
    fontWeight: '600',
    color: brand.colors.navy,
  },
  socialButtonContent: {
    height: 44,
  },
  // Footer
  footer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 24,
  },
  footerText: {
    color: brand.colors.textMuted,
    fontSize: 14,
  },
  linkButton: {
    marginLeft: 4,
  },
  linkButtonLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: brand.colors.primary,
  },
});
