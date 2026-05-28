import { initializeApp, getApps, getApp } from "firebase/app";
import { getAuth } from "firebase/auth";
import { getFirestore } from "firebase/firestore";
import { getStorage } from "firebase/storage";
// App Check will be imported dynamically to prevent SSR deadlocks

const firebaseConfig = {
  apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY,
  authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
  projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
  storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
  appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID,
  measurementId: process.env.NEXT_PUBLIC_FIREBASE_MEASUREMENT_ID,
};

// Initialize Firebase only once (Next.js hot-reload safe)
const app = !getApps().length ? initializeApp(firebaseConfig) : getApp();

// ── App Check (Phase 1) ────────
// App Check initialization removed for local dev because it causes Next.js Turbopack to crash.
// To use App Check in production, initialize it dynamically inside a client component instead.

export const auth = getAuth(app);
export const db = getFirestore(app);
export const storage = getStorage(app);
