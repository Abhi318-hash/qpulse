'use client';

import { useEffect } from 'react';
import { getApp } from 'firebase/app';
import { initializeAppCheck, ReCaptchaEnterpriseProvider } from 'firebase/app-check';

export default function AppCheckProvider({ children }: { children: React.ReactNode }) {
  useEffect(() => {
    // Only initialize in browser environment
    if (typeof window !== 'undefined') {
      try {
        const app = getApp();
        
        // Prevent double initialization which throws an error in React StrictMode
        if (!(window as any)._firebaseAppCheckInitialized) {
          
          // In local development, reCAPTCHA will reject localhost because it's not registered
          // in the production Cloud Console allowed domains. To test App Check locally, we tell
          // Firebase to generate a local "debug token" instead. This token is printed in the 
          // browser console and you must paste it into the Firebase Console -> App Check -> Apps -> Manage Debug Tokens.
          // In production on Vercel, NODE_ENV is 'production', so this is skipped.
          if (process.env.NODE_ENV === 'development') {
            (self as any).FIREBASE_APPCHECK_DEBUG_TOKEN = true;
          }

          if (process.env.NEXT_PUBLIC_RECAPTCHA_SITE_KEY) {
            initializeAppCheck(app, {
              provider: new ReCaptchaEnterpriseProvider(process.env.NEXT_PUBLIC_RECAPTCHA_SITE_KEY),
              isTokenAutoRefreshEnabled: true
            });
            (window as any)._firebaseAppCheckInitialized = true;
            console.log("Firebase App Check initialized successfully.");
          } else {
            console.warn("NEXT_PUBLIC_RECAPTCHA_SITE_KEY is missing. App Check bypassed.");
          }
        }
      } catch (err) {
        console.warn('Firebase App Check initialization error:', err);
      }
    }
  }, []);

  return <>{children}</>;
}
