'use client';

import React from 'react';
import PhoneAuth from '@/components/PhoneAuth';
import { useRouter } from 'next/navigation';

export default function StaffLoginPage() {
  const router = useRouter();

  React.useEffect(() => {
    const unsubscribe = import('@/lib/firebase').then(({ auth }) => {
      import('firebase/auth').then(({ onAuthStateChanged }) => {
        return onAuthStateChanged(auth, (user) => {
          if (user) {
            router.push('/clinic');
          }
        });
      });
    });
  }, [router]);

  const handleSuccess = (uid: string) => {
    // Phase 1: Authentication successful.
    console.log("Authenticated Staff UID:", uid);
    router.push('/clinic'); // We will build the new /clinic dashboard later
  };

  return (
    <div className="container" style={{ display: 'grid', placeItems: 'center', minHeight: '90vh' }}>
      <PhoneAuth 
        title="Staff Access"
        subtitle="Authenticate to manage your clinic queue."
        primaryColor="#00d2ff" // Accent Cyan
        onSuccess={handleSuccess}
      />
    </div>
  );
}
