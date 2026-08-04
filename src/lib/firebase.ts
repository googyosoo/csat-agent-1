import { initializeApp, getApps, getApp } from 'firebase/app';
import {
  getAuth,
  GoogleAuthProvider,
  signInWithPopup,
  signInWithRedirect,
  signOut,
  onAuthStateChanged,
  User,
} from 'firebase/auth';
import { getFirestore } from 'firebase/firestore';

// Firebase configuration using Vite environment variables with fallback
const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY || 'AIzaSyDemoDummyApiKeyForCSATPlatform12345',
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN || 'csat-agent-platform.firebaseapp.com',
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID || 'csat-agent-platform',
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET || 'csat-agent-platform.appspot.com',
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID || '123456789012',
  appId: import.meta.env.VITE_FIREBASE_APP_ID || '1:123456789012:web:abcdef1234567890',
};

// Initialize Firebase App singleton
const app = getApps().length > 0 ? getApp() : initializeApp(firebaseConfig);
export const auth = getAuth(app);
export const db = getFirestore(app);

// Google Authentication Provider
const googleProvider = new GoogleAuthProvider();
googleProvider.setCustomParameters({
  prompt: 'select_account',
});

/**
 * Sign in with Google Account (SSO Popup with Redirect Fallback)
 */
export async function signInWithGoogle(): Promise<User> {
  try {
    const result = await signInWithPopup(auth, googleProvider);
    return result.user;
  } catch (error: any) {
    console.warn('[Firebase Google Sign-In Warning]:', error);
    if (error.code === 'auth/popup-blocked' || error.code === 'auth/popup-closed-by-user') {
      try {
        await signInWithRedirect(auth, googleProvider);
        throw new Error('REDIRECT_STARTED');
      } catch (redirectErr) {
        console.warn('[Firebase Redirect Error]:', redirectErr);
      }
    }
    throw error;
  }
}

/**
 * Mock / Fallback Google User Session Generator for testing and domain-restricted environments
 */
export function createMockGoogleUser(emailInput: string, nameInput?: string): User {
  const cleanEmail = emailInput.trim().toLowerCase();
  const cleanName = nameInput && nameInput.trim().length > 0 ? nameInput.trim() : cleanEmail.split('@')[0];

  return {
    uid: `google-user-${cleanEmail.replace(/[^a-zA-Z0-9]/g, '_')}`,
    email: cleanEmail,
    displayName: cleanName,
    photoURL: `https://api.dicebear.com/7.x/avataaars/svg?seed=${cleanEmail}`,
    emailVerified: true,
    isAnonymous: false,
    metadata: {},
    providerData: [],
    refreshToken: '',
    tenantId: null,
    delete: async () => {},
    getIdToken: async () => 'mock-token',
    getIdTokenResult: async () => ({} as any),
    reload: async () => {},
    toJSON: () => ({}),
  } as unknown as User;
}

/**
 * Sign out current user
 */
export async function logout(): Promise<void> {
  try {
    await signOut(auth);
  } catch (error: any) {
    console.error('Firebase Logout Error:', error);
    throw new Error('로그아웃 중 오류가 발생했습니다.');
  }
}

/**
 * Subscribe to Firebase Auth state changes
 */
export function subscribeToAuth(callback: (user: User | null) => void) {
  return onAuthStateChanged(auth, callback);
}

export type { User };
