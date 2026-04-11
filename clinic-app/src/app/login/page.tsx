'use client';

import React from 'react';
import PhoneAuth from '@/components/PhoneAuth';
import { useRouter } from 'next/navigation';

export default function UserLoginPage() {
  const router = useRouter();

  React.useEffect(() => {
    const unsubscribe = import('@/lib/firebase').then(({ auth }) => {
      import('firebase/auth').then(({ onAuthStateChanged }) => {
        return onAuthStateChanged(auth, (user) => {
          if (user) {
            router.push('/');
          }
        });
      });
    });
  }, [router]);

  const handleSuccess = (uid: string) => {
    // Phase 1: Authentication successful.
    // In Phase 2, we will hit a backend route to set an HTTP-Only cookie and log them in completely.
    console.log("Authenticated User UID:", uid);
    router.push('/');
  };

  return (
    <div className="container" style={{ display: 'grid', placeItems: 'center', minHeight: '90vh' }}>
      <PhoneAuth 
        title="Q-PULSE Portal"
        subtitle="Sign in securely to track clinics and book appointments."
        primaryColor="#00e676" // Success Green
        onSuccess={handleSuccess}
      />
    </div>
  );
}
