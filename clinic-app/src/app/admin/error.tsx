'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { ShieldOff, ArrowLeft, RefreshCw } from 'lucide-react';

export default function AdminError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  const router = useRouter();
  useEffect(() => {
    console.error('[Q-PULSE Admin Error]', error);
  }, [error]);

  return (
    <div style={{
      minHeight: '100vh', display: 'grid', placeItems: 'center',
      background: 'linear-gradient(160deg, #0a0f1c 0%, #141b2d 100%)',
      padding: '2rem',
    }}>
      <div style={{
        background: 'rgba(255,255,255,0.05)',
        border: '1px solid rgba(220,53,69,0.3)',
        backdropFilter: 'blur(16px)',
        borderRadius: 20, padding: '3rem 2.5rem',
        maxWidth: 480, width: '100%', textAlign: 'center',
      }}>
        <div style={{
          width: 64, height: 64, borderRadius: '50%',
          background: 'rgba(220,53,69,0.12)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          margin: '0 auto 1.5rem',
        }}>
          <ShieldOff size={30} color="#ff4d6a" />
        </div>
        <h2 style={{ margin: '0 0 0.75rem', fontSize: '1.4rem', color: '#fff', fontWeight: 800 }}>
          Admin Panel Error
        </h2>
        <p style={{ color: 'rgba(255,255,255,0.55)', fontSize: '0.9rem', lineHeight: 1.6, margin: '0 0 2rem' }}>
          {error.message?.includes('ACCESS DENIED')
            ? 'You are not authorized to access the admin panel.'
            : 'An error occurred in the admin panel. Please try again.'}
        </p>
        {process.env.NODE_ENV === 'development' && (
          <pre style={{
            background: 'rgba(0,0,0,0.3)', padding: '0.75rem', borderRadius: 8,
            fontSize: '0.72rem', color: '#ff4d6a', textAlign: 'left',
            overflowX: 'auto', marginBottom: '1.5rem', border: '1px solid rgba(220,53,69,0.2)',
          }}>
            {error.message}
          </pre>
        )}
        <div style={{ display: 'flex', gap: '0.75rem', justifyContent: 'center' }}>
          <button
            onClick={() => router.push('/admin/login')}
            style={{
              display: 'inline-flex', alignItems: 'center', gap: '0.5rem',
              background: 'rgba(255,255,255,0.08)', color: '#fff',
              border: '1px solid rgba(255,255,255,0.15)', borderRadius: 10,
              padding: '0.75rem 1.25rem', fontSize: '0.9rem', fontWeight: 600,
              cursor: 'pointer', fontFamily: 'inherit',
            }}
          >
            <ArrowLeft size={16} /> Back to Login
          </button>
          <button
            onClick={reset}
            style={{
              display: 'inline-flex', alignItems: 'center', gap: '0.5rem',
              background: 'linear-gradient(135deg, #007BFF, #0056CC)',
              color: 'white', border: 'none', borderRadius: 10,
              padding: '0.75rem 1.25rem', fontSize: '0.9rem', fontWeight: 600,
              cursor: 'pointer', fontFamily: 'inherit',
            }}
          >
            <RefreshCw size={16} /> Retry
          </button>
        </div>
      </div>
    </div>
  );
}
