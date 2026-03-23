import axios from 'axios';
import Constants from 'expo-constants';
import { Platform } from 'react-native';
import * as Device from 'expo-device';
import { auth } from '../services/firebase';

const normalizeApiUrl = (value) => {
  if (!value) return '';
  const trimmed = String(value).trim().replace(/\/$/, '');
  if (!trimmed) return '';
  return trimmed.endsWith('/api') ? trimmed : `${trimmed}/api`;
};

const isLikelyLocalHost = (host) => {
  if (!host) return false;
  if (host === 'localhost' || host === '127.0.0.1' || host === '10.0.2.2') return true;
  return /^(10\.|192\.168\.|172\.(1[6-9]|2\d|3[0-1])\.)/.test(host);
};

const remapToAndroidEmulatorHost = (apiUrl) => {
  try {
    const parsed = new URL(apiUrl);
    if (isLikelyLocalHost(parsed.hostname) && parsed.hostname !== '10.0.2.2') {
      parsed.hostname = '10.0.2.2';
      return parsed.toString().replace(/\/$/, '');
    }
  } catch {
    // Ignore malformed urls and keep caller fallback behavior.
  }
  return apiUrl;
};

const getApiUrl = () => {
  const envApiUrl = normalizeApiUrl(process.env.EXPO_PUBLIC_API_URL);
  const executionEnvironment = Constants.executionEnvironment;
  const isStandaloneLike =
    executionEnvironment === 'standalone' ||
    executionEnvironment === 'bare' ||
    (!__DEV__ && Device.isDevice);

  // Android emulator cannot reach localhost/LAN hosts directly. If user sets
  // EXPO_PUBLIC_API_URL to a local host, transparently remap to 10.0.2.2.
  if (Platform.OS === 'android' && Device.isDevice === false) {
    if (envApiUrl) {
      const mapped = remapToAndroidEmulatorHost(envApiUrl);
      if (mapped !== envApiUrl) {
        console.log('[API] Remapped EXPO_PUBLIC_API_URL for emulator:', mapped);
      } else {
        console.log('[API] Using EXPO_PUBLIC_API_URL on emulator:', envApiUrl);
      }
      return mapped;
    }
    return 'http://10.0.2.2:5000/api';
  }

  if (envApiUrl) {
    console.log('[API] Using EXPO_PUBLIC_API_URL:', envApiUrl);
    return envApiUrl;
  }

  if (isStandaloneLike) {
    console.error(
      '[API] EXPO_PUBLIC_API_URL is missing in a standalone/release build. Configure it in EAS env before building.'
    );
    return 'https://invalid.local/api';
  }

  const hostSource =
    Constants.expoConfig?.hostUri ||
    Constants.manifest?.hostUri ||
    Constants.manifest?.debuggerHost ||
    Constants.manifest2?.extra?.expoGo?.debuggerHost;

  if (hostSource) {
    const host = String(hostSource).replace(/^https?:\/\//, '').split(':')[0].split('/')[0];
    if (isLikelyLocalHost(host)) {
      console.log('[API] Using detected local host:', host);
      return `http://${host}:5000/api`;
    }
    console.log('[API] Ignoring non-local detected host:', host);
  }

  if (Platform.OS === 'android') {
    return 'http://10.0.2.2:5000/api';
  }

  if (Platform.OS === 'web') {
    return 'http://localhost:5000/api';
  }

  return 'http://localhost:5000/api';
};

const API_URL = getApiUrl();
console.log('[API] Final URL:', API_URL);
export { API_URL };

const api = axios.create({
  baseURL: API_URL,
  timeout: 120000,
});

api.interceptors.request.use(async (config) => {
  if (auth.currentUser) {
    const token = await auth.currentUser.getIdToken();
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

api.interceptors.response.use(
  (response) => response,
  async (error) => {
    if (error.code === 'ERR_NETWORK') {
      console.log('[API Network Error] baseURL:', API_URL, 'url:', error.config?.url);
    }

    const originalRequest = error.config;
    if (error.response?.status === 401 && originalRequest && !originalRequest._retry) {
      originalRequest._retry = true;
      try {
        if (auth.currentUser) {
          const refreshedToken = await auth.currentUser.getIdToken(true);
          originalRequest.headers.Authorization = `Bearer ${refreshedToken}`;
          return api(originalRequest);
        }
      } catch (refreshError) {
        // Let Redux auth state handling decide how to route after auth failures.
      }
    }
    return Promise.reject(error);
  }
);

export const getImageUrl = (path) => {
  if (!path) return null;
  const raw = String(path).trim();
  if (!raw || raw.toLowerCase() === 'null' || raw.toLowerCase() === 'undefined') return null;
  if (/^https?:\/\//i.test(raw)) return raw;

  const normalized = raw.replace(/\\/g, '/');
  const withLeadingSlash = normalized.startsWith('/') ? normalized : `/${normalized}`;
  return `${API_URL.replace('/api', '')}${withLeadingSlash}`;
};

export default api;
