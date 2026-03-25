import { createSlice, createAsyncThunk } from '@reduxjs/toolkit';
import {
  createUserWithEmailAndPassword,
  GoogleAuthProvider,
  sendEmailVerification,
  signInWithCredential,
  signInWithEmailAndPassword,
  signOut,
  updateProfile as updateFirebaseProfile,
} from 'firebase/auth';
import api from '../../api/config';
import { auth } from '../../services/firebase';
import { appendImageToFormData } from '../../utils/formDataUpload';

const toFallbackUserFromFirebase = (firebaseUser) => {
  const email = firebaseUser?.email || '';
  const fallbackNameFromEmail = email.includes('@') ? email.split('@')[0] : 'User';
  return {
    id: firebaseUser?.uid,
    _id: firebaseUser?.uid,
    name: firebaseUser?.displayName || fallbackNameFromEmail,
    email,
    avatar: firebaseUser?.photoURL || '',
    phone: '',
    address: '',
    secondaryAddress: '',
    provider: 'firebase',
    role: 'user',
    isActive: true,
  };
};

const mapFirebaseAuthError = (err, fallbackMessage) => {
  const code = err?.code || '';

  if (code === 'auth/configuration-not-found') {
    return 'Firebase Authentication is not configured for this project. In Firebase Console, go to Authentication -> Sign-in method and enable Email/Password (and Google if needed), then restart Expo with npx expo start -c.';
  }

  if (code === 'auth/operation-not-allowed') {
    return 'This sign-in method is disabled in Firebase Console. Enable it in Authentication -> Sign-in method.';
  }

  if (code === 'auth/invalid-credential') {
    return 'Invalid authentication credential. Check your Firebase client config and Google OAuth client IDs.';
  }

  if (code === 'auth/network-request-failed') {
    return 'Network request failed. Check your internet connection and backend API URL.';
  }

  return err?.response?.data?.message || err?.message || fallbackMessage;
};

const syncUserWithFirebaseToken = async ({ firebaseUser, syncPayload }) => {
  if (!firebaseUser) {
    throw new Error('Firebase user is missing. Please sign in again.');
  }

  const token = await firebaseUser.getIdToken(true);
  const { data } = await api.post('/auth/sync', syncPayload, {
    headers: { Authorization: `Bearer ${token}` },
  });
  return data;
};

export const login = createAsyncThunk('auth/login', async ({ email, password }, { rejectWithValue }) => {
  try {
    console.log('[Login] Attempting Firebase auth...', { email });
    const userCredential = await signInWithEmailAndPassword(auth, email, password);
    console.log('[Login] Firebase auth success, uid:', userCredential.user.uid);
    
    console.log('[Login] Calling /auth/sync...');
    const { data } = await api.post('/auth/sync', {});
    console.log('[Login] /auth/sync success:', data);
    return data;
  } catch (err) {
    console.error('[Login Error]', err.code || 'no-code', err.message, err);
    if (err.response) {
      console.error('[Login Error] API Response:', err.response.status, err.response.data);
    }
    return rejectWithValue(mapFirebaseAuthError(err, 'Login failed'));
  }
});

export const register = createAsyncThunk('auth/register', async ({ name, email, password, avatar }, { rejectWithValue }) => {
  try {
    const result = await createUserWithEmailAndPassword(auth, email, password);
    await updateFirebaseProfile(result.user, { displayName: name });
    await sendEmailVerification(result.user);

    let data;
    if (avatar) {
      const formData = new FormData();
      formData.append('name', name);
      appendImageToFormData(formData, 'avatar', avatar, { fileName: 'avatar.jpg' });
      const response = await api.post('/auth/sync', formData);
      data = response.data;
    } else {
      const response = await api.post('/auth/sync', { name });
      data = response.data;
    }

    return data;
  } catch (err) {
    console.log('[Register Error]', err.code, err.message, err.response?.status, err.response?.data);
    return rejectWithValue(mapFirebaseAuthError(err, 'Registration failed'));
  }
});

export const socialLogin = createAsyncThunk('auth/socialLogin', async (userData, { rejectWithValue }) => {
  try {
    if (userData.provider !== 'google') {
      return rejectWithValue('Only Google login is currently enabled.');
    }

    if (!userData.idToken && !userData.accessToken) {
      return rejectWithValue('Google token is missing.');
    }

    const credential = GoogleAuthProvider.credential(userData.idToken || null, userData.accessToken || null);
    const result = await signInWithCredential(auth, credential);

    const syncPayload = {
      name: userData.name || result.user.displayName || '',
      email: userData.email || result.user.email || '',
    };

    const data = await syncUserWithFirebaseToken({
      firebaseUser: result.user,
      syncPayload,
    });
    return data;
  } catch (err) {
    console.log('[Social Login Error]', err.code, err.message, err.response?.status, err.response?.data);
    return rejectWithValue(mapFirebaseAuthError(err, 'Social login failed'));
  }
});

// For web: signInWithPopup already authenticates with Firebase, just sync backend
export const webGoogleLogin = createAsyncThunk('auth/webGoogleLogin', async (userData, { rejectWithValue }) => {
  try {
    // On web, signInWithPopup already authenticated the user with Firebase
    // We just need to sync with backend
    const syncPayload = {
      name: userData.name || '',
      email: userData.email || '',
    };

    const data = await syncUserWithFirebaseToken({
      firebaseUser: auth.currentUser,
      syncPayload,
    });
    return data;
  } catch (err) {
    console.log('[Web Google Login Error]', err.code, err.message, err.response?.status, err.response?.data);
    return rejectWithValue(mapFirebaseAuthError(err, 'Google login failed'));
  }
});

export const getProfile = createAsyncThunk('auth/getProfile', async (_, { rejectWithValue }) => {
  try {
    const { data } = await api.get('/auth/profile');
    return data;
  } catch (err) {
    return rejectWithValue(err.response?.data?.message || 'Failed to get profile');
  }
});

export const updateProfile = createAsyncThunk('auth/updateProfile', async (payload, { rejectWithValue }) => {
  try {
    if (typeof FormData !== 'undefined' && payload instanceof FormData) {
      const headers = {};
      if (auth?.currentUser) {
        const token = await auth.currentUser.getIdToken();
        headers.Authorization = `Bearer ${token}`;
      }

      // Use fetch for RN multipart uploads; axios can be unreliable with native file URIs.
      const response = await fetch(`${api.defaults.baseURL}/auth/profile`, {
        method: 'PUT',
        headers,
        body: payload,
      });

      const data = await response.json();
      if (!response.ok) {
        return rejectWithValue(data?.message || 'Failed to update profile');
      }
      return data;
    }

    // Non-file updates can use axios JSON.
    const { data } = await api.put('/auth/profile', payload);
    return data;
  } catch (err) {
    return rejectWithValue(err.response?.data?.message || 'Failed to update profile');
  }
});

export const logout = createAsyncThunk('auth/logout', async () => {
  await signOut(auth);
});

export const checkAuth = createAsyncThunk('auth/checkAuth', async (_, { rejectWithValue, dispatch }) => {
  try {
    console.log('[CheckAuth] Starting auth state check...');
    const withTimeout = (promise, ms, message) =>
      Promise.race([
        promise,
        new Promise((_, reject) => setTimeout(() => reject(new Error(message)), ms)),
      ]);

    // Wait for auth state to be ready (works on both web and native)
    try {
      await withTimeout(new Promise((resolve) => {
        const unsubscribe = auth.onAuthStateChanged((user) => {
          console.log('[CheckAuth] onAuthStateChanged fired, user:', user ? 'EXISTS' : 'NULL');
          unsubscribe();
          resolve(user);
        });
      }), 15000, 'Timed out waiting for Firebase auth state');
    } catch (authStateErr) {
      // If Firebase already has a current user, proceed rather than blocking app entry.
      if (!auth.currentUser) {
        throw authStateErr;
      }
      console.warn('[CheckAuth] Auth state listener timed out, using currentUser fallback');
    }
    
    if (!auth.currentUser) {
      console.log('[CheckAuth] No Firebase user found');
      return rejectWithValue('No Firebase user');
    }

    const firebaseUser = auth.currentUser;
    const fallbackUser = toFallbackUserFromFirebase(firebaseUser);

    // Wake up the backend first (Render.com free tier sleeps after inactivity)
    console.log('[CheckAuth] Pinging backend health endpoint to wake server...');
    try {
      await withTimeout(
        api.get('/health').catch(() => {}),
        60000,
        'Backend health ping timed out'
      );
      console.log('[CheckAuth] Backend is awake');
    } catch {
      console.warn('[CheckAuth] Health ping timed out, proceeding anyway...');
    }

    console.log('[CheckAuth] Firebase user exists, calling /auth/profile...');
    try {
      const { data } = await withTimeout(
        api.get('/auth/profile'),
        60000,
        'Timed out fetching /auth/profile'
      );
      console.log('[CheckAuth] Profile fetched successfully');
      return data;
    } catch (profileErr) {
      console.warn('[CheckAuth] /auth/profile failed, trying /auth/sync and retry...', profileErr?.message);
      try {
        const syncPayload = {};
        if (firebaseUser.displayName) syncPayload.name = firebaseUser.displayName;

        await withTimeout(
          api.post('/auth/sync', syncPayload),
          30000,
          'Timed out posting /auth/sync'
        );

        const { data } = await withTimeout(
          api.get('/auth/profile'),
          30000,
          'Timed out fetching /auth/profile after sync'
        );

        console.log('[CheckAuth] Profile fetched successfully after /auth/sync');
        return data;
      } catch (syncErr) {
        // Keep users inside the app when Firebase session is valid but backend is unavailable.
        console.warn('[CheckAuth] Backend unavailable during startup, using Firebase fallback user:', syncErr?.message);

        // Background retry: once the backend wakes up, fetch the real profile
        // so the admin role (and other fields) get restored.
        const retryGetProfile = async (attempt = 1) => {
          if (attempt > 5) return;
          const delay = attempt * 5000; // 5s, 10s, 15s, 20s, 25s
          await new Promise((r) => setTimeout(r, delay));
          try {
            await dispatch(getProfile()).unwrap();
            console.log('[CheckAuth] Background profile refresh succeeded on attempt', attempt);
          } catch {
            console.warn('[CheckAuth] Background profile refresh attempt', attempt, 'failed, retrying...');
            retryGetProfile(attempt + 1);
          }
        };
        retryGetProfile();

        return fallbackUser;
      }
    }
  } catch (err) {
    console.error('[CheckAuth Error]', err);
    return rejectWithValue(err?.message || 'Auth check failed');
  }
});

const authSlice = createSlice({
  name: 'auth',
  initialState: {
    user: null,
    loading: false,
    error: null,
    isAuthenticated: false,
  },
  reducers: {
    clearError: (state) => { state.error = null; },
  },
  extraReducers: (builder) => {
    builder
      .addCase(login.pending, (state) => { state.loading = true; state.error = null; })
      .addCase(login.fulfilled, (state, action) => { state.loading = false; state.user = action.payload; state.isAuthenticated = true; })
      .addCase(login.rejected, (state, action) => { state.loading = false; state.error = action.payload; })
      .addCase(register.pending, (state) => { state.loading = true; state.error = null; })
      .addCase(register.fulfilled, (state, action) => { state.loading = false; state.user = action.payload; state.isAuthenticated = true; })
      .addCase(register.rejected, (state, action) => { state.loading = false; state.error = action.payload; })
      .addCase(socialLogin.pending, (state) => { state.loading = true; state.error = null; })
      .addCase(socialLogin.fulfilled, (state, action) => { state.loading = false; state.user = action.payload; state.isAuthenticated = true; })
      .addCase(socialLogin.rejected, (state, action) => { state.loading = false; state.error = action.payload; })
      .addCase(webGoogleLogin.pending, (state) => { state.loading = true; state.error = null; })
      .addCase(webGoogleLogin.fulfilled, (state, action) => { state.loading = false; state.user = action.payload; state.isAuthenticated = true; })
      .addCase(webGoogleLogin.rejected, (state, action) => { state.loading = false; state.error = action.payload; })
      .addCase(getProfile.fulfilled, (state, action) => { state.user = action.payload; })
      .addCase(updateProfile.fulfilled, (state, action) => { state.user = action.payload; })
      .addCase(logout.fulfilled, (state) => { state.user = null; state.isAuthenticated = false; })
      .addCase(checkAuth.fulfilled, (state, action) => { state.user = action.payload; state.isAuthenticated = true; state.loading = false; state.error = null; })
      .addCase(checkAuth.rejected, (state, action) => { state.isAuthenticated = false; state.loading = false; state.error = action.payload || null; })
      .addCase(checkAuth.pending, (state) => { state.loading = true; });
  },
});

export const { clearError } = authSlice.actions;
export default authSlice.reducer;
