let auth = null;
let provider = null;
let isFirebaseConfigured = false;

// Simulated Sign-In Helper for local development testing without Firebase
const simulateGoogleSignIn = (email, name) => {
  const payload = { email, name };
  const base64Payload = btoa(unescape(encodeURIComponent(JSON.stringify(payload))));
  return `mock_google_token_${base64Payload}`;
};

const signInWithPopup = async () => {
  throw new Error('Google Sign-in via Firebase is disabled.');
};

export {
  auth,
  provider,
  signInWithPopup,
  isFirebaseConfigured,
  simulateGoogleSignIn
};
