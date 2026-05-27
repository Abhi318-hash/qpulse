import React from 'react';
import { Loader2 } from 'lucide-react';

export default function ProfileLoading() {
  return (
    <div style={{
      display: 'grid',
      placeItems: 'center',
      height: '80vh',
      width: '100%'
    }}>
      <div style={{ textAlign: 'center' }}>
        <Loader2 className="animate-spin" size={40} style={{ color: '#007BFF', margin: '0 auto 1rem' }} />
        <p style={{ color: '#5a6a7e', fontWeight: 500 }}>Loading patient profile…</p>
      </div>
    </div>
  );
}
