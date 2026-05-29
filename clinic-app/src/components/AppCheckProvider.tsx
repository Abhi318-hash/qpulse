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
          
          // Completely skip App Check in development to prevent 403 errors when local
          // debug tokens aren't registered in the Firebase console.
          if (process.env.NODE_ENV === 'development') {
            console.log("Firebase App Check bypassed for local development.");
            (window as any)._firebaseAppCheckInitialized = true;
            return;
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
