import { initializeApp, getApps, getApp } from 'firebase/app';
import {
  getAuth,
  GoogleAuthProvider,
  signInWithPopup,
  signOut,
  onAuthStateChanged,
  User,
} from 'firebase/auth';

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

// Google Authentication Provider
const googleProvider = new GoogleAuthProvider();
googleProvider.setCustomParameters({
  prompt: 'select_account',
});

/**
 * Sign in with Google Account (SSO Popup)
 */
export async function signInWithGoogle(): Promise<User> {
  try {
    const result = await signInWithPopup(auth, googleProvider);
    return result.user;
  } catch (error: any) {
    console.error('Firebase Google Sign-In Error:', error);
    if (error.code === 'auth/configuration-not-found' || error.code === 'auth/invalid-api-key') {
      throw new Error(
        'Firebase 프로젝트 설정이 필요합니다. .env 파일에 올바른 VITE_FIREBASE_* 설정값들을 지정해 주세요.'
      );
    }
    throw new Error(error.message || 'Google 계정 로그인 중 오류가 발생했습니다.');
  }
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
