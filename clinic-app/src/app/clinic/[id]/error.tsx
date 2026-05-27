'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { AlertCircle, ArrowLeft, RefreshCw } from 'lucide-react';

export default function ClinicError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  const router = useRouter();
  useEffect(() => {
    console.error('[Q-PULSE Clinic Error]', error);
  }, [error]);

  const isAccessDenied = error.message?.includes('ACCESS DENIED') || error.message?.includes('not authorized');

  return (
    <div style={{
      minHeight: '100vh', display: 'grid', placeItems: 'center',
      background: 'linear-gradient(160deg, #f0f6ff 0%, #f8fafc 100%)',
      padding: '2rem',
    }}>
      <div style={{
        background: '#fff', borderRadius: 20, padding: '3rem 2.5rem',
        maxWidth: 460, width: '100%', textAlign: 'center',
        boxShadow: '0 8px 40px rgba(0,0,0,0.08)',
        border: `1px solid ${isAccessDenied ? 'rgba(220,53,69,0.2)' : 'rgba(0,123,255,0.1)'}`,
      }}>
        <div style={{
          width: 64, height: 64, borderRadius: '50%',
          background: isAccessDenied ? 'rgba(220,53,69,0.08)' : 'rgba(0,123,255,0.08)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          margin: '0 auto 1.5rem',
        }}>
          <AlertCircle size={30} color={isAccessDenied ? '#dc3545' : '#007BFF'} />
        </div>
        <h2 style={{ margin: '0 0 0.75rem', fontSize: '1.4rem', color: '#1a2332', fontWeight: 800 }}>
          {isAccessDenied ? 'Access Denied' : 'Clinic Error'}
        </h2>
        <p style={{ color: '#5a6a7e', fontSize: '0.9rem', lineHeight: 1.6, margin: '0 0 2rem' }}>
          {isAccessDenied
            ? 'Your phone number is not authorized for this clinic.'
            : 'An error occurred loading this clinic. Please try again.'}
        </p>
        <div style={{ display: 'flex', gap: '0.75rem', justifyContent: 'center' }}>
          <button
            onClick={() => router.push('/clinic/login')}
            style={{
              display: 'inline-flex', alignItems: 'center', gap: '0.5rem',
              background: '#f0f6ff', color: '#007BFF',
              border: '1px solid rgba(0,123,255,0.2)', borderRadius: 10,
              padding: '0.75rem 1.25rem', fontSize: '0.9rem', fontWeight: 600,
              cursor: 'pointer', fontFamily: 'inherit',
            }}
          >
            <ArrowLeft size={16} /> Back to Login
          </button>
          {!isAccessDenied && (
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
          )}
        </div>
      </div>
    </div>
  );
}
