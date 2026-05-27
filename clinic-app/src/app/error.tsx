'use client';

import { useEffect } from 'react';
import { AlertTriangle, RefreshCw } from 'lucide-react';

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    // Log to monitoring service in production (e.g., Sentry)
    console.error('[Q-PULSE Global Error]', error);
  }, [error]);

  return (
    <div style={{
      minHeight: '100vh',
      display: 'grid',
      placeItems: 'center',
      background: 'linear-gradient(160deg, #f0f6ff 0%, #f8fafc 100%)',
      padding: '2rem',
    }}>
      <div style={{
        background: '#fff',
        borderRadius: 20,
        padding: '3rem 2.5rem',
        maxWidth: 460,
        width: '100%',
        textAlign: 'center',
        boxShadow: '0 8px 40px rgba(0,0,0,0.08)',
        border: '1px solid rgba(220,53,69,0.15)',
      }}>
        <div style={{
          width: 64, height: 64, borderRadius: '50%',
          background: 'rgba(220,53,69,0.08)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          margin: '0 auto 1.5rem',
        }}>
          <AlertTriangle size={30} color="#dc3545" />
        </div>
        <h2 style={{ margin: '0 0 0.75rem', fontSize: '1.4rem', color: '#1a2332', fontWeight: 800 }}>
          Something went wrong
        </h2>
        <p style={{ color: '#5a6a7e', fontSize: '0.9rem', lineHeight: 1.6, margin: '0 0 2rem' }}>
          An unexpected error occurred. Our team has been notified. Please try again.
        </p>
        {process.env.NODE_ENV === 'development' && (
          <pre style={{
            background: '#f8fafc', padding: '0.75rem', borderRadius: 8,
            fontSize: '0.72rem', color: '#dc3545', textAlign: 'left',
            overflowX: 'auto', marginBottom: '1.5rem', border: '1px solid rgba(220,53,69,0.15)',
          }}>
            {error.message}
          </pre>
        )}
        <button
          onClick={reset}
          style={{
            display: 'inline-flex', alignItems: 'center', gap: '0.5rem',
            background: 'linear-gradient(135deg, #007BFF, #0056CC)',
            color: 'white', border: 'none', borderRadius: 10,
            padding: '0.75rem 1.75rem', fontSize: '0.95rem', fontWeight: 700,
            cursor: 'pointer', fontFamily: 'inherit',
          }}
        >
          <RefreshCw size={16} /> Try Again
        </button>
      </div>
    </div>
  );
}
