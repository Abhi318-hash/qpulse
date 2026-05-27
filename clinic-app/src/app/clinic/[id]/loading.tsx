export default function ClinicLoading() {
  return (
    <div style={{
      minHeight: '100vh', display: 'grid', placeItems: 'center',
      background: 'linear-gradient(160deg, #f0f6ff 0%, #f8fafc 100%)',
    }}>
      <div style={{ textAlign: 'center' }}>
        {/* Animated pulse rings */}
        <div style={{ position: 'relative', width: 72, height: 72, margin: '0 auto 1.5rem' }}>
          <div style={{
            position: 'absolute', inset: 0, borderRadius: '50%',
            border: '3px solid rgba(0,123,255,0.2)',
            animation: 'pulse-ring 1.4s ease-out infinite',
          }} />
          <div style={{
            position: 'absolute', inset: '12px', borderRadius: '50%',
            background: 'linear-gradient(135deg, #007BFF, #0056CC)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
          }}>
            <div style={{
              width: 20, height: 20, border: '2.5px solid rgba(255,255,255,0.3)',
              borderTopColor: '#fff', borderRadius: '50%',
              animation: 'spin 0.75s linear infinite',
            }} />
          </div>
        </div>
        <p style={{ color: '#5a6a7e', fontSize: '0.9rem', fontWeight: 500 }}>
          Loading clinic dashboard…
        </p>
        <style>{`
          @keyframes pulse-ring {
            0% { transform: scale(0.8); opacity: 1; }
            80%, 100% { transform: scale(1.8); opacity: 0; }
          }
          @keyframes spin { to { transform: rotate(360deg); } }
        `}</style>
      </div>
    </div>
  );
}
