'use client';

import { WifiOff, RotateCw } from 'lucide-react';

export default function OfflinePage() {
  return (
    <div style={{
      display: 'grid', placeItems: 'center', minHeight: '100vh',
      background: 'var(--bg-color)', padding: '2rem', textAlign: 'center'
    }}>
      <div className="glass-card fade-in" style={{
        maxWidth: 400, padding: '3rem 2rem',
        display: 'flex', flexDirection: 'column', alignItems: 'center'
      }}>
        <div style={{
          background: 'rgba(239, 68, 68, 0.1)',
          padding: '1.5rem', borderRadius: '50%', marginBottom: '1.5rem'
        }}>
          <WifiOff size={48} color="#ef4444" />
        </div>
        
        <h1 style={{ fontSize: '1.5rem', marginBottom: '0.5rem', color: 'var(--text-primary)' }}>
          You're Offline
        </h1>
        
        <p style={{ color: 'var(--text-secondary)', marginBottom: '2rem', lineHeight: 1.5, fontSize: '0.95rem' }}>
          It looks like you've lost your internet connection. Please reconnect to continue tracking your queue status.
        </p>

        <button 
          onClick={() => window.location.reload()} 
          className="btn btn-primary"
          style={{ width: '100%', display: 'flex', justifyContent: 'center', gap: '0.5rem' }}
        >
          <RotateCw size={18} /> Retry Connection
        </button>
      </div>
    </div>
  );
}
