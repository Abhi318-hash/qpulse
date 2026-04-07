'use client';

import React from 'react';
import PhoneAuth from '@/components/PhoneAuth';
import { useRouter } from 'next/navigation';

export default function AdminLoginPage() {
  const router = useRouter();

  const handleSuccess = (uid: string) => {
    // Phase 1: Authentication successful.
    console.log("Authenticated Admin UID:", uid);
    router.push('/admin'); 
  };

  return (
    <div className="container" style={{ display: 'grid', placeItems: 'center', minHeight: '90vh' }}>
      <PhoneAuth 
        title="System Admin"
        subtitle="Restricted dashboard. Verify identity to proceed."
        primaryColor="#FFC107" // Premium Gold
        onSuccess={handleSuccess}
      />
    </div>
  );
}
