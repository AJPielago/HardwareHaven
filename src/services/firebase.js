import { initializeApp, getApps, getApp } from 'firebase/app';
import { initializeAuth, getAuth, getReactNativePersistence } from 'firebase/auth';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Platform } from 'react-native';
import Constants from 'expo-constants';

const cleanConfigValue = (value) => {
  if (value == null) return '';
  return String(value).trim().replace(/^['\"]|['\"]$/g, '');
};

const getConfigValue = (key) => {
  const envValue = cleanConfigValue(process.env[key]);
  if (envValue) return envValue;
  return cleanConfigValue(Constants.expoConfig?.extra?.[key]);
};

const firebaseConfig = {
  apiKey: getConfigValue('EXPO_PUBLIC_FIREBASE_API_KEY'),
  authDomain: getConfigValue('EXPO_PUBLIC_FIREBASE_AUTH_DOMAIN'),
  projectId: getConfigValue('EXPO_PUBLIC_FIREBASE_PROJECT_ID'),
  storageBucket: getConfigValue('EXPO_PUBLIC_FIREBASE_STORAGE_BUCKET'),
  messagingSenderId: getConfigValue('EXPO_PUBLIC_FIREBASE_MESSAGING_SENDER_ID'),
  appId: getConfigValue('EXPO_PUBLIC_FIREBASE_APP_ID'),
};

const requiredFirebaseKeys = [
  'apiKey',
  'authDomain',
  'projectId',
  'storageBucket',
  'messagingSenderId',
  'appId',
];

const missingFirebaseKeys = requiredFirebaseKeys.filter((key) => !firebaseConfig[key]);
if (missingFirebaseKeys.length) {
  throw new Error(
    `Missing Firebase client config: ${missingFirebaseKeys.join(', ')}. ` +
    'Add EXPO_PUBLIC_FIREBASE_* keys to your app root .env or .env.local and restart Expo with cache clear (npx expo start -c).'
  );
}

if (!firebaseConfig.apiKey.startsWith('AIza')) {
  throw new Error(
    'Invalid EXPO_PUBLIC_FIREBASE_API_KEY format. Use the Web API key from Firebase Console -> Project settings -> Your apps (Web app config).'
  );
}

const app = getApps().length ? getApp() : initializeApp(firebaseConfig);

let auth;
if (Platform.OS === 'web') {
  auth = getAuth(app);
} else {
  try {
    auth = initializeAuth(app, {
      persistence: getReactNativePersistence(AsyncStorage),
    });
  } catch (err) {
    auth = getAuth(app);
  }
}

export { app, auth };
