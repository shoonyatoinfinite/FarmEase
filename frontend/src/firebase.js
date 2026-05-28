import { initializeApp } from 'firebase/app';
import { getAuth, GoogleAuthProvider, signInWithPopup } from 'firebase/auth';

const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
  appId: import.meta.env.VITE_FIREBASE_APP_ID
};

let auth = null;
let provider = null;
let isFirebaseConfigured = false;

if (firebaseConfig.apiKey && firebaseConfig.apiKey !== 'YOUR_FIREBASE_API_KEY' && firebaseConfig.apiKey !== '') {
  try {
    const app = initializeApp(firebaseConfig);
    auth = getAuth(app);
    provider = new GoogleAuthProvider();
    isFirebaseConfigured = true;
    console.log('🚀 Firebase initialized successfully.');
  } catch (err) {
    console.error('Error initializing Firebase:', err);
  }
} else {
  console.warn('⚠️ Firebase API key missing. Operating in Developer Simulation Mode.');
}

// Simulated Sign-In Helper for local development testing without Firebase
const simulateGoogleSignIn = (email, name) => {
  const payload = { email, name };
  const base64Payload = btoa(unescape(encodeURIComponent(JSON.stringify(payload))));
  return `mock_google_token_${base64Payload}`;
};

export {
  auth,
  provider,
  signInWithPopup,
  isFirebaseConfigured,
  simulateGoogleSignIn
};
