import React, { useState } from 'react';
import { View, StyleSheet, ScrollView, Alert, KeyboardAvoidingView, Platform } from 'react-native';
import { TextInput, Button, Text, Title, Card } from 'react-native-paper';
import { useDispatch, useSelector } from 'react-redux';
import { login, clearError } from '../../store/slices/authSlice';
import { useResponsive } from '../../utils/responsive';
import BrandMark from '../../components/branding/BrandMark';
import { brand } from '../../theme/brandTheme';

export default function LoginScreen({ navigation }) {
  const { isWeb, isDesktop } = useResponsive();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const dispatch = useDispatch();
  const { loading, error } = useSelector((state) => state.auth);

  const handleLogin = () => {
    if (!email || !password) {
      Alert.alert('Error', 'Please fill in all fields');
      return;
    }
    dispatch(login({ email: email.trim(), password }));
  };

  React.useEffect(() => {
    if (error) {
      Alert.alert('Login Failed', error);
      dispatch(clearError());
    }
  }, [error]);

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
              <Title style={styles.title}>Welcome Back</Title>
              <Text style={styles.subtitle}>Sign in to continue to Hardware Haven</Text>
            </View>

            <TextInput
              label="Email"
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
              label="Password"
              value={password}
              onChangeText={setPassword}
              mode="outlined"
              secureTextEntry={!showPassword}
              style={[styles.input, isDesktop && styles.inputDesktop]}
              left={<TextInput.Icon icon="lock" />}
              right={<TextInput.Icon icon={showPassword ? "eye-off" : "eye"} onPress={() => setShowPassword(!showPassword)} />}
              outlineStyle={styles.inputOutline}
            />

            <Button 
              mode="contained" 
              onPress={handleLogin} 
              loading={loading} 
              disabled={loading} 
              style={[styles.button, isDesktop && styles.buttonDesktop]}
              labelStyle={styles.buttonLabel}
            >
              Sign In
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
              Continue with Google
            </Button>

            <View style={styles.footer}>
              <Text style={styles.footerText}>Don't have an account?</Text>
              <Button 
                mode="text" 
                onPress={() => navigation.navigate('Register')} 
                style={styles.linkButton}
                labelStyle={styles.linkButtonLabel}
              >
                Create Account
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
    justifyContent: 'center',
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
    marginBottom: 26,
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
