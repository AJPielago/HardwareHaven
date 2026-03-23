import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { View, StyleSheet, Alert, ActivityIndicator, Platform } from 'react-native';
import { Text } from 'react-native-paper';
import { useDispatch } from 'react-redux';
import Constants from 'expo-constants';
import { makeRedirectUri } from 'expo-auth-session';
import { useIdTokenAuthRequest } from 'expo-auth-session/providers/google';
import { socialLogin, webGoogleLogin } from '../../store/slices/authSlice';

// Lazy imports for web Firebase auth
let GoogleAuthProvider = null;
let signInWithPopup = null;

const loadWebFirebaseAuth = async () => {
  if (Platform.OS === 'web' && !GoogleAuthProvider) {
    const firebaseAuth = await import('firebase/auth');
    GoogleAuthProvider = firebaseAuth.GoogleAuthProvider;
    signInWithPopup = firebaseAuth.signInWithPopup;
  }
};

const cleanConfigValue = (value) => {
  if (value == null) return '';
  return String(value).trim().replace(/^['"]|['"]$/g, '');
};

const getConfigValue = (key) => {
  const envValue = cleanConfigValue(process.env[key]);
  if (envValue) return envValue;
  return cleanConfigValue(Constants.expoConfig?.extra?.[key]);
};

const getGoogleReverseScheme = (clientId) => {
  const cleaned = cleanConfigValue(clientId);
  if (!cleaned.endsWith('.apps.googleusercontent.com')) return '';
  return `com.googleusercontent.apps.${cleaned.replace('.apps.googleusercontent.com', '')}`;
};

function NativeGoogleSignIn({ androidClientId, iosClientId, webClientId, exitSocialLogin }) {
  const dispatch = useDispatch();
  const promptedRef = useRef(false);
  const handledRef = useRef(false);

  const requestConfig = useMemo(() => {
    const c = {};
    if (Platform.OS === 'android') c.androidClientId = androidClientId;
    if (Platform.OS === 'ios') c.iosClientId = iosClientId;
    if (webClientId) c.webClientId = webClientId;
    return c;
  }, [androidClientId, iosClientId, webClientId]);

  // Google native OAuth works most reliably with the reverse-client-id scheme.
  const schemeRaw = Constants.expoConfig?.scheme;
  const configuredSchemes = (Array.isArray(schemeRaw) ? schemeRaw : [schemeRaw])
    .filter(Boolean)
    .map(cleanConfigValue);
  const googleScheme =
    Platform.OS === 'ios'
      ? getGoogleReverseScheme(iosClientId)
      : getGoogleReverseScheme(androidClientId);
  const appScheme =
    googleScheme && configuredSchemes.includes(googleScheme)
      ? googleScheme
      : configuredSchemes[0] || googleScheme || '';

  const redirectUri = useMemo(
    () =>
      makeRedirectUri({
        native: appScheme ? `${appScheme}:/oauthredirect` : undefined,
      }),
    [appScheme]
  );

  const [request, response, promptAsync] = useIdTokenAuthRequest({
    ...requestConfig,
    redirectUri,
  });

  useEffect(() => {
    if (!request || promptedRef.current) return;
    promptedRef.current = true;
    promptAsync().catch((err) => {
      console.error('[Google Native]', err);
      Alert.alert('Error', err?.message || 'Could not open Google sign-in');
      exitSocialLogin();
    });
  }, [request, promptAsync, exitSocialLogin]);

  useEffect(() => {
    if (!response || handledRef.current) return;

    if (response.type === 'success') {
      const idToken = response.params?.id_token;
      const accessToken =
        response.params?.access_token || response.authentication?.accessToken || undefined;
      if (!idToken) {
        return;
      }
      handledRef.current = true;
      (async () => {
        try {
          const action = await dispatch(
            socialLogin({
              provider: 'google',
              idToken,
              accessToken,
            })
          );
          if (!socialLogin.fulfilled.match(action)) {
            throw new Error(action.payload || 'Google login failed');
          }
        } catch (err) {
          Alert.alert('Error', err?.message || 'Google login failed');
          exitSocialLogin();
        }
      })();
      return;
    }

    if (response.type === 'error') {
      handledRef.current = true;
      const msg =
        response.error?.message ||
        response.params?.error_description ||
        response.params?.error ||
        'Google sign-in failed';
      Alert.alert('Error', String(msg));
      exitSocialLogin();
      return;
    }

    if (response.type === 'cancel' || response.type === 'dismiss') {
      handledRef.current = true;
      exitSocialLogin();
    }
  }, [response, dispatch, exitSocialLogin]);

  return (
    <View style={styles.container}>
      <ActivityIndicator size="large" />
      <Text style={styles.text}>Signing in with Google...</Text>
    </View>
  );
}

function WebGoogleLogin({ exitSocialLogin }) {
  const dispatch = useDispatch();

  const handleWebGoogleLogin = async () => {
    try {
      await loadWebFirebaseAuth();
      const { auth } = await import('../../services/firebase');
      const googleProvider = new GoogleAuthProvider();
      googleProvider.addScope('profile');
      googleProvider.addScope('email');

      const result = await signInWithPopup(auth, googleProvider);

      const action = await dispatch(
        webGoogleLogin({
          name: result.user.displayName,
        })
      );

      if (webGoogleLogin.fulfilled.match(action)) {
        return;
      }
      throw new Error(action.payload || 'Google login failed');
    } catch (err) {
      console.error('[Web Google Login Error]', err);
      Alert.alert('Error', err?.message || 'Failed to sign in with Google');
      exitSocialLogin();
    }
  };

  // eslint-disable-next-line react-hooks/exhaustive-deps -- Google web sign-in once on mount
  useEffect(() => {
    handleWebGoogleLogin();
  }, []);

  return (
    <View style={styles.container}>
      <ActivityIndicator size="large" />
      <Text style={styles.text}>Signing in with Google...</Text>
    </View>
  );
}

export default function SocialLoginScreen({ route, navigation }) {
  const { provider } = route.params;

  const GOOGLE_ANDROID_CLIENT_ID = getConfigValue('EXPO_PUBLIC_GOOGLE_ANDROID_CLIENT_ID');
  const GOOGLE_IOS_CLIENT_ID = getConfigValue('EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID');
  const GOOGLE_WEB_CLIENT_ID = getConfigValue('EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID');

  const exitSocialLogin = useCallback(() => {
    if (navigation.canGoBack()) {
      navigation.goBack();
      return;
    }
    navigation.reset({
      index: 0,
      routes: [{ name: 'Login' }],
    });
  }, [navigation]);

  useEffect(() => {
    if (provider !== 'google') {
      Alert.alert('Not available', 'Only Google login is currently enabled.');
      exitSocialLogin();
      return;
    }
    if (Platform.OS === 'web') return;
    if (Platform.OS === 'android' && !GOOGLE_ANDROID_CLIENT_ID) {
      Alert.alert(
        'Google login not configured',
        'Set EXPO_PUBLIC_GOOGLE_ANDROID_CLIENT_ID in .env.local'
      );
      exitSocialLogin();
      return;
    }
    if (Platform.OS === 'ios' && !GOOGLE_IOS_CLIENT_ID) {
      Alert.alert(
        'Google login not configured',
        'Set EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID in .env.local'
      );
      exitSocialLogin();
    }
  }, [provider, GOOGLE_ANDROID_CLIENT_ID, GOOGLE_IOS_CLIENT_ID, exitSocialLogin]);

  if (provider !== 'google') {
    return (
      <View style={styles.container}>
        <ActivityIndicator size="large" />
      </View>
    );
  }

  if (Platform.OS === 'web') {
    return <WebGoogleLogin exitSocialLogin={exitSocialLogin} />;
  }

  if (Platform.OS === 'android' && !GOOGLE_ANDROID_CLIENT_ID) {
    return (
      <View style={styles.container}>
        <ActivityIndicator size="large" />
      </View>
    );
  }

  if (Platform.OS === 'ios' && !GOOGLE_IOS_CLIENT_ID) {
    return (
      <View style={styles.container}>
        <ActivityIndicator size="large" />
      </View>
    );
  }

  return (
    <NativeGoogleSignIn
      androidClientId={GOOGLE_ANDROID_CLIENT_ID}
      iosClientId={GOOGLE_IOS_CLIENT_ID}
      webClientId={GOOGLE_WEB_CLIENT_ID || undefined}
      exitSocialLogin={exitSocialLogin}
    />
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  text: { marginTop: 20, fontSize: 16, color: '#666' },
});
