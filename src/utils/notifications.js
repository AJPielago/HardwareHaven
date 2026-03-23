import { useEffect, useRef } from 'react';
import { Platform } from 'react-native';
import Constants from 'expo-constants';
import api from '../api/config';
import { auth } from '../services/firebase';

// Lazy-load native modules only on mobile platforms
let Notifications = null;
let Device = null;

if (Platform.OS !== 'web') {
  try {
    Notifications = require('expo-notifications');
    Device = require('expo-device');
  } catch (e) {
    console.log('Native notification modules not available');
  }
}

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

const normalizePushToken = (value) => String(value || '').trim();

const getExpoProjectId = () => {
  return (
    Constants?.easConfig?.projectId ||
    Constants?.expoConfig?.extra?.eas?.projectId ||
    Constants?.manifest2?.extra?.eas?.projectId ||
    Constants?.manifest?.extra?.eas?.projectId ||
    ''
  );
};

async function waitForFirebaseUser(timeoutMs = 10000) {
  const startedAt = Date.now();
  while (!auth.currentUser && Date.now() - startedAt < timeoutMs) {
    await sleep(250);
  }
  return auth.currentUser;
}

if (Notifications && Notifications.setNotificationHandler) {
  try {
    Notifications.setNotificationHandler({
      handleNotification: async () => ({
        shouldShowAlert: true,
        shouldShowBanner: true,
        shouldShowList: true,
        shouldPlaySound: true,
        shouldSetBadge: true,
      }),
    });
  } catch (e) {
    console.log('Notifications not supported in this environment');
  }
}

export async function registerForPushNotifications() {
  if (Platform.OS === 'web') {
    console.log('Push notifications not supported on web');
    return null;
  }

  try {
    let token;

    if (Platform.OS === 'android' && Notifications) {
      await Notifications.setNotificationChannelAsync('default', {
        name: 'default',
        importance: Notifications.AndroidImportance?.MAX || 5,
        vibrationPattern: [0, 250, 250, 250],
        lightColor: '#FF231F7C',
      });
    }

    if (Device?.isDevice) {
      const { status: existingStatus } = await Notifications.getPermissionsAsync();
      let finalStatus = existingStatus;
      if (existingStatus !== 'granted') {
        const { status } = await Notifications.requestPermissionsAsync();
        finalStatus = status;
      }
      console.log('[Push] Permission status:', finalStatus);
      if (finalStatus !== 'granted') {
        console.log('Push notification permission not granted');
        return null;
      }
      const projectId = getExpoProjectId();
      if (!projectId) {
        console.log('[Push] EAS projectId not found in Constants; attempting token request without explicit projectId');
      }

      token = (
        await Notifications.getExpoPushTokenAsync(projectId ? { projectId } : {})
      ).data;

      const normalizedToken = normalizePushToken(token);
      token = normalizedToken;
      console.log('[Push] Expo token acquired:', normalizedToken ? `${normalizedToken.slice(0, 22)}...` : '(none)');
    } else {
      console.log('Must use physical device for push notifications');
    }

    return token;
  } catch (e) {
    console.log('Push notifications not available:', e.message);
    return null;
  }
}

export async function savePushToken(pushToken) {
  const normalizedToken = normalizePushToken(pushToken);
  if (!normalizedToken) {
    console.log('[Push] savePushToken skipped: no token provided');
    return false;
  }

  const firebaseUser = await waitForFirebaseUser();
  if (!firebaseUser) {
    console.log('[Push] savePushToken failed: Firebase user is not ready');
    return false;
  }

  try {
    await api.post('/auth/push-token', { pushToken: normalizedToken });
    console.log('[Push] Token saved on backend');
    return true;
  } catch (err) {
    console.error('[Push] Failed to save push token:', err.response?.status, err.response?.data || err.message);
    return false;
  }
}

export async function ensurePushTokenSaved(maxAttempts = 3) {
  if (Platform.OS === 'web') return false;

  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    const token = await registerForPushNotifications();
    if (!token) {
      console.log(`[Push] Attempt ${attempt}/${maxAttempts} could not get token`);
    } else {
      const saved = await savePushToken(token);
      if (saved) return true;
    }

    if (attempt < maxAttempts) {
      await sleep(attempt * 1200);
    }
  }

  return false;
}

export async function removePushToken(pushToken) {
  try {
    await api.delete('/auth/push-token', { data: { pushToken } });
  } catch (err) {
    console.error('Failed to remove push token:', err);
  }
}

export function useNotificationListeners(onNotificationReceived, onNotificationTapped) {
  const notificationListener = useRef();
  const responseListener = useRef();

  useEffect(() => {
    if (Platform.OS === 'web' || !Notifications) return;

    try {
      notificationListener.current = Notifications.addNotificationReceivedListener((notification) => {
        if (onNotificationReceived) onNotificationReceived(notification);
      });

      responseListener.current = Notifications.addNotificationResponseReceivedListener((response) => {
        if (onNotificationTapped) onNotificationTapped(response);
      });
    } catch (e) {
      console.log('Notification listeners not available:', e.message);
    }

    return () => {
      if (notificationListener.current) {
        if (typeof notificationListener.current.remove === 'function') {
          notificationListener.current.remove();
        } else if (typeof Notifications.removeNotificationSubscription === 'function') {
          Notifications.removeNotificationSubscription(notificationListener.current);
        }
      }
      if (responseListener.current) {
        if (typeof responseListener.current.remove === 'function') {
          responseListener.current.remove();
        } else if (typeof Notifications.removeNotificationSubscription === 'function') {
          Notifications.removeNotificationSubscription(responseListener.current);
        }
      }
    };
  }, []);
}
