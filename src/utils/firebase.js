import { initializeApp } from "firebase/app";
import {
  getAuth,
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  sendPasswordResetEmail,
  signOut,
  RecaptchaVerifier,
  signInWithPhoneNumber,
  onAuthStateChanged,
} from "firebase/auth";
import { getFirestore } from "firebase/firestore";

const firebaseConfig = {
  apiKey: "AIzaSyBonXmW-JFGLQwulDCwdlMadggq6oarVJs",
  authDomain: "cseaiml-lms.firebaseapp.com",
  projectId: "cseaiml-lms",
  storageBucket: "cseaiml-lms.firebasestorage.app",
  messagingSenderId: "379189685523",
  appId: "1:379189685523:web:4dce82417f29efa8373ee6",
  measurementId: "G-MMP2XB4J75"
};

const app  = initializeApp(firebaseConfig);
const auth = getAuth(app);
export const db = getFirestore(app);

// ── Email Auth ────────────────────────────────────────────────
export async function firebaseLogin(email, password) {
  const result = await signInWithEmailAndPassword(auth, email, password);
  const token  = await result.user.getIdToken();
  return { user: result.user, token };
}

export async function firebaseRegister(email, password) {
  const result = await createUserWithEmailAndPassword(auth, email, password);
  const token  = await result.user.getIdToken();
  return { user: result.user, token };
}

export async function firebaseForgotPassword(email) {
  await sendPasswordResetEmail(auth, email);
  return { success: true };
}

export async function firebaseLogout() {
  await signOut(auth);
}

// ── Phone OTP ─────────────────────────────────────────────────
export function setupRecaptcha(elementId) {
  if (window.recaptchaVerifier) {
    window.recaptchaVerifier.clear();
    window.recaptchaVerifier = null;
  }
  window.recaptchaVerifier = new RecaptchaVerifier(auth, elementId, {
    size: "invisible",
    callback: () => {},
    "expired-callback": () => {
      window.recaptchaVerifier = null;
    },
  });
  return window.recaptchaVerifier;
}

export async function sendOTP(phoneNumber) {
  const appVerifier = window.recaptchaVerifier;
  const confirmation = await signInWithPhoneNumber(auth, phoneNumber, appVerifier);
  window.confirmationResult = confirmation;
  return confirmation;
}

export async function verifyOTP(otp) {
  const result = await window.confirmationResult.confirm(otp);
  const token  = await result.user.getIdToken();
  return { user: result.user, token };
}

// ── Auth State Listener ───────────────────────────────────────
export function onAuthChange(callback) {
  return onAuthStateChanged(auth, callback);
}

export { auth };


console.log("Firebase Connected");
console.log(auth);