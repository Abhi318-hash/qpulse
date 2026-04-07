'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { auth } from '@/lib/firebase';
import { onAuthStateChanged, signOut } from 'firebase/auth';
import { addClinic, hideClinic, unhideClinic, subscribeToAllClinicsAdmin, subscribeToAuditLogs } from '@/lib/actions';
import { EyeOff, Eye, Plus, Copy, CheckCircle, Loader2, QrCode, User, ShieldCheck, Printer, LogOut, Activity, FileText } from 'lucide-react';
import { QRCodeSVG } from 'qrcode.react';

export default function AdminPage() {
  const router = useRouter();
  const [clinics, setClinics] = useState<any[]>([]);
  const [auditLogs, setAuditLogs] = useState<any[]>([]);
  const [loadingAuth, setLoadingAuth] = useState(true);
  const [activeTab, setActiveTab] = useState<'clinics' | 'audits'>('clinics');
  
  const [newClinicName, setNewClinicName] = useState('');
  const [newDoctorName, setNewDoctorName] = useState('');
  const [newLocation, setNewLocation] = useState('');
  const [newAuthorizedPhone, setNewAuthorizedPhone] = useState('');
  const [loading, setLoading] = useState(false);
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [togglingId, setTogglingId] = useState<string | null>(null);

  useEffect(() => {
    let unsubscribeData: () => void;
    let unsubscribeLogs: () => void;

    const unsubscribeAuth = onAuthStateChanged(auth, (user) => {
      if (!user) {
        // Not logged in -> redirect to admin login
        router.push('/admin/login');
      } else {
        // Security Check: Make sure the logged-in user is an approved Administrator
        const allowedAdmins = (process.env.NEXT_PUBLIC_ADMIN_PHONE || '').split(',').map(s => s.trim());
        if (!user.phoneNumber || !allowedAdmins.includes(user.phoneNumber)) {
          alert('ACCESS DENIED: You are not an approved System Administrator.');
          signOut(auth);
          router.push('/admin/login');
          return;
        }
        setLoadingAuth(false);

        // Fetch Clinics
        unsubscribeData = subscribeToAllClinicsAdmin((data) => {
          setClinics(data);
        });

        // Fetch Audit Logs
        unsubscribeLogs = subscribeToAuditLogs((logs) => {
          setAuditLogs(logs);
        });
      }
    });

    return () => {
      unsubscribeAuth();
      if (unsubscribeData) unsubscribeData();
      if (unsubscribeLogs) unsubscribeLogs();
    };
  }, [router]);

  const handleLogout = async () => {
    await signOut(auth);
    router.push('/admin/login');
  };

  const handleAdd = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newClinicName) return;
    setLoading(true);
    try {
      const adminPhone = auth.currentUser?.phoneNumber || 'Admin';
      await addClinic(newClinicName, newDoctorName, newLocation, newAuthorizedPhone, adminPhone);
      setNewClinicName('');
      setNewDoctorName('');
      setNewLocation('');
      setNewAuthorizedPhone('');
    } catch (err) {
      console.error(err);
      alert('Failed to add clinic');
    } finally {
      setLoading(false);
    }
  };

  const handleToggleVisibility = async (clinic: any) => {
    setTogglingId(clinic.id);
    const adminPhone = auth.currentUser?.phoneNumber || 'Admin';
    try {
      if (clinic.is_hidden) {
        await unhideClinic(clinic.id, adminPhone);
      } else {
        await hideClinic(clinic.id, adminPhone);
      }
    } catch (err) {
      console.error('Toggle visibility failed:', err);
    } finally {
      setTogglingId(null);
    }
  };

  const copyLink = (id: string) => {
    const url = `${window.location.origin}/clinic/${id}`;
    navigator.clipboard.writeText(url);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 2000);
  };

  if (loadingAuth) {
    return (
      <div className="container" style={{ display: 'grid', placeItems: 'center', minHeight: '80vh' }}>
        <Loader2 className="animate-spin" size={40} style={{ color: 'var(--accent-primary)' }} />
      </div>
    );
  }

  const visibleClinics = clinics.filter(c => !c.is_hidden);
  const hiddenClinics = clinics.filter(c => c.is_hidden);

  return (
    <div className="container fade-in">
      <header className="header" style={{ textAlign: 'left', display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
        <div>
          <h1 style={{ background: 'linear-gradient(to right, #00d2ff, #ffffff)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }}>
            Q-PULSE Root
          </h1>
          <p style={{ color: 'var(--text-secondary)' }}>
            Admin UID: {auth.currentUser?.uid.substring(0, 8)}... · Authorized Phone: {auth.currentUser?.phoneNumber}
          </p>
        </div>
        <div style={{ display: 'flex', gap: '1rem' }}>
          <button type="button" onClick={() => router.push('/')} className="btn btn-outline">Exit</button>
          <button type="button" onClick={handleLogout} className="btn" style={{ background: 'rgba(255,77,77,0.1)', color: 'var(--danger)', border: '1px solid rgba(255,77,77,0.2)' }}>
            <LogOut size={18} /> Logout
          </button>
        </div>
      </header>

      {/* Tabs */}
      <div style={{ display: 'flex', gap: '1rem', marginBottom: '2rem', borderBottom: '1px solid var(--glass-border)', paddingBottom: '0.5rem' }}>
        <button 
          onClick={() => setActiveTab('clinics')}
          style={{
             background: 'none', border: 'none', color: activeTab === 'clinics' ? 'var(--accent-primary)' : 'var(--text-secondary)',
             fontSize: '1rem', fontWeight: activeTab === 'clinics' ? 700 : 400, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '0.5rem',
             borderBottom: activeTab === 'clinics' ? '2px solid var(--accent-primary)' : 'none', paddingBottom: '0.5rem', transition: 'all 0.2s'
          }}
        >
          <Activity size={18} /> Manage Clinics
        </button>
        <button 
          onClick={() => setActiveTab('audits')}
          style={{
             background: 'none', border: 'none', color: activeTab === 'audits' ? 'var(--accent-primary)' : 'var(--text-secondary)',
             fontSize: '1rem', fontWeight: activeTab === 'audits' ? 700 : 400, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '0.5rem',
             borderBottom: activeTab === 'audits' ? '2px solid var(--accent-primary)' : 'none', paddingBottom: '0.5rem', transition: 'all 0.2s'
          }}
        >
          <FileText size={18} /> System Audit Logs
        </button>
      </div>

      {activeTab === 'clinics' ? (
        <>
          {/* Add New Clinic */}
          <div className="glass-card" style={{ marginBottom: '2rem' }}>
            <h2 style={{ marginBottom: '1rem' }}>Add New Clinic</h2>
            <form onSubmit={handleAdd} style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
                <input
                  className="input-field"
                  placeholder="Clinic Name (e.g. Westside Care)"
                  value={newClinicName}
                  onChange={(e) => setNewClinicName(e.target.value)}
                  disabled={loading}
                  required
                />
                <input
                  className="input-field"
                  placeholder="Doctor Name (e.g. Dr. Smith)"
                  value={newDoctorName}
                  onChange={(e) => setNewDoctorName(e.target.value)}
                  disabled={loading}
                />
                <input
                  className="input-field"
                  placeholder="Location (e.g. Downtown)"
                  value={newLocation}
                  onChange={(e) => setNewLocation(e.target.value)}
                  disabled={loading}
                />
                <input
                  className="input-field"
                  placeholder="Authorized Staff Phone (+91...)"
                  value={newAuthorizedPhone}
                  onChange={(e) => setNewAuthorizedPhone(e.target.value)}
                  disabled={loading}
                  required
                />
              </div>
              <button type="submit" className="btn btn-primary" style={{ width: 'fit-content' }} disabled={loading}>
                {loading ? <Loader2 size={18} className="animate-spin" /> : <Plus size={18} />} Register Clinic
              </button>
            </form>
          </div>

          {/* Active Clinics */}
          <h2 style={{ marginBottom: '1rem', color: 'var(--text-secondary)', fontSize: '1rem', textTransform: 'uppercase', letterSpacing: '0.1em' }}>
            Active Clinics ({visibleClinics.length})
          </h2>
          <div className="grid-clinics" style={{ marginBottom: '2.5rem' }}>
            {visibleClinics.length === 0 && (
              <p style={{ color: 'var(--text-secondary)', gridColumn: '1/-1' }}>No active clinics.</p>
            )}
            {visibleClinics.map(clinic => (
              <ClinicCard
                key={clinic.id}
                clinic={clinic}
                copiedId={copiedId}
                togglingId={togglingId}
                onCopyLink={copyLink}
                onToggle={handleToggleVisibility}
              />
            ))}
          </div>

          {/* Hidden Clinics */}
          {hiddenClinics.length > 0 && (
            <>
              <h2 style={{ marginBottom: '1rem', color: 'var(--text-secondary)', fontSize: '1rem', textTransform: 'uppercase', letterSpacing: '0.1em' }}>
                Hidden from Users ({hiddenClinics.length})
              </h2>
              <div className="grid-clinics">
                {hiddenClinics.map(clinic => (
                  <ClinicCard
                    key={clinic.id}
                    clinic={clinic}
                    copiedId={copiedId}
                    togglingId={togglingId}
                    onCopyLink={copyLink}
                    onToggle={handleToggleVisibility}
                  />
                ))}
              </div>
            </>
          )}
        </>
      ) : (
        /* Audit Logs Tab */
        <div className="glass-card" style={{ overflow: 'hidden', padding: 0 }}>
          <div style={{ padding: '1.5rem', borderBottom: '1px solid var(--glass-border)' }}>
            <h2 style={{ margin: 0 }}>System Audit Logs</h2>
            <p style={{ margin: '0.5rem 0 0', color: 'var(--text-secondary)', fontSize: '0.85rem' }}>
              Secure tracking of all multi-admin changes to the Q-PULSE network.
            </p>
          </div>
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '0.85rem' }}>
              <thead>
                <tr style={{ background: 'rgba(255,255,255,0.03)', borderBottom: '1px solid var(--glass-border)' }}>
                  <th style={{ padding: '1rem', color: 'var(--text-secondary)', fontWeight: 600 }}>Timestamp</th>
                  <th style={{ padding: '1rem', color: 'var(--text-secondary)', fontWeight: 600 }}>Admin Identity</th>
                  <th style={{ padding: '1rem', color: 'var(--text-secondary)', fontWeight: 600 }}>Action</th>
                  <th style={{ padding: '1rem', color: 'var(--text-secondary)', fontWeight: 600 }}>Details</th>
                </tr>
              </thead>
              <tbody>
                {auditLogs.length === 0 ? (
                  <tr>
                    <td colSpan={4} style={{ padding: '2rem', textAlign: 'center', color: 'var(--text-secondary)' }}>
                      No audit logs found.
                    </td>
                  </tr>
                ) : (
                  auditLogs.map((log) => {
                    const dateObj = log.created_at?.toDate ? log.created_at.toDate() : new Date();
                    return (
                      <tr key={log.id} style={{ borderBottom: '1px solid rgba(255,255,255,0.05)' }}>
                        <td style={{ padding: '1rem', whiteSpace: 'nowrap' }}>
                           <span style={{ color: 'var(--text-primary)' }}>{dateObj.toLocaleDateString()}</span>
                           <span style={{ color: 'var(--text-secondary)', marginLeft: '0.5rem' }}>{dateObj.toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}</span>
                        </td>
                        <td style={{ padding: '1rem', fontFamily: 'monospace', color: 'var(--accent-secondary)' }}>{log.admin_phone}</td>
                        <td style={{ padding: '1rem' }}>
                           <span style={{ background: 'rgba(0, 210, 255, 0.1)', color: 'var(--accent-primary)', padding: '4px 8px', borderRadius: '4px', fontSize: '0.75rem', fontWeight: 700, letterSpacing: '0.5px' }}>
                             {log.action}
                           </span>
                        </td>
                        <td style={{ padding: '1rem', color: 'var(--text-secondary)' }}>{log.details}</td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}

function ClinicCard({ clinic, copiedId, togglingId, onCopyLink, onToggle }: any) {
  const isHidden = !!clinic.is_hidden;
  const isToggling = togglingId === clinic.id;
  const [showQR, setShowQR] = useState(false);

  const patientUrl = typeof window !== 'undefined' ? `${window.location.origin}/?addFavorite=${clinic.id}` : '';
  const staffUrl = typeof window !== 'undefined' ? `${window.location.origin}/clinic/${clinic.id}` : '';

  return (
    <div
      className="glass-card"
      style={{
        padding: '1.5rem',
        opacity: isHidden ? 0.55 : 1,
        border: isHidden ? '1px solid rgba(255,255,255,0.06)' : undefined,
        transition: 'all 0.3s ease',
        display: 'flex',
        flexDirection: 'column',
        gap: '1rem'
      }}
    >
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.3rem' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <h3 style={{ fontSize: '1.1rem', margin: 0 }}>{clinic.name}</h3>
            {isHidden && (
              <span style={{
                fontSize: '0.65rem',
                fontWeight: 700,
                padding: '2px 8px',
                borderRadius: '20px',
                background: 'rgba(255,255,255,0.08)',
                color: 'var(--text-secondary)',
                textTransform: 'uppercase',
                letterSpacing: '0.05em'
              }}>
                Hidden
              </span>
            )}
          </div>
          <p style={{ color: 'var(--text-secondary)', fontSize: '0.8rem', margin: 0 }}>
            {clinic.doctor_name} · {clinic.location}
          </p>
        </div>

        <div style={{ display: 'flex', gap: '0.5rem' }}>
          <button
            type="button"
            onClick={() => setShowQR(!showQR)}
            className="btn"
            style={{
              background: showQR ? 'rgba(0,210,255,0.1)' : 'rgba(255,255,255,0.06)',
              color: showQR ? 'var(--accent-primary)' : 'var(--text-secondary)',
              padding: '0.4rem',
              minWidth: 'auto',
              border: '1px solid ' + (showQR ? 'rgba(0,210,255,0.2)' : 'rgba(255,255,255,0.08)'),
            }}
            title="Show QR Codes"
          >
            <QrCode size={15} />
          </button>
          <button
            type="button"
            onClick={() => onToggle(clinic)}
            disabled={isToggling}
            className="btn"
            style={{
              background: isHidden ? 'rgba(0,210,255,0.1)' : 'rgba(255,255,255,0.06)',
              color: isHidden ? 'var(--accent-primary)' : 'var(--text-secondary)',
              padding: '0.4rem',
              minWidth: 'auto',
              border: '1px solid ' + (isHidden ? 'rgba(0,210,255,0.2)' : 'rgba(255,255,255,0.08)'),
            }}
            title={isHidden ? 'Show to users' : 'Hide from users'}
          >
            {isToggling
              ? <Loader2 size={15} className="animate-spin" />
              : isHidden
                ? <Eye size={15} />
                : <EyeOff size={15} />
          }
          </button>
        </div>
      </div>

      {showQR && (
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem', padding: '1rem', background: 'rgba(255,255,255,0.02)', borderRadius: '12px', border: '1px solid var(--glass-border)', animation: 'slideDown 0.3s ease-out' }}>
          <div style={{ textAlign: 'center' }}>
            <p style={{ fontSize: '0.65rem', color: 'var(--text-secondary)', textTransform: 'uppercase', margin: '0 0 0.5rem 0', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.3rem' }}>
              <User size={10} /> Patient QR
            </p>
            <div style={{ background: 'white', padding: '0.5rem', borderRadius: '8px', display: 'inline-block' }}>
              <QRCodeSVG value={patientUrl} size={80} />
            </div>
          </div>
          <div style={{ textAlign: 'center' }}>
            <p style={{ fontSize: '0.65rem', color: 'var(--text-secondary)', textTransform: 'uppercase', margin: '0 0 0.5rem 0', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.3rem' }}>
              <ShieldCheck size={10} /> Staff QR
            </p>
            <div style={{ background: 'white', padding: '0.5rem', borderRadius: '8px', display: 'inline-block' }}>
              <QRCodeSVG value={staffUrl} size={80} />
            </div>
          </div>
          <button 
            onClick={() => window.print()} 
            className="btn btn-outline" 
            style={{ gridColumn: '1 / -1', fontSize: '0.7rem', padding: '0.3rem', minHeight: 'auto', marginTop: '0.5rem' }}
          >
            <Printer size={12} /> Print Tags
          </button>
        </div>
      )}

      {/* Access link */}
      <div style={{ fontSize: '0.78rem', padding: '0.7rem', background: 'rgba(255,255,255,0.03)', borderRadius: '8px', border: '1px dashed var(--glass-border)' }}>
        <button
          type="button"
          onClick={() => onCopyLink(clinic.id)}
          className="btn btn-outline"
          style={{ width: '100%', fontSize: '0.72rem', padding: '0.4rem', minHeight: 'auto' }}
        >
          {copiedId === clinic.id ? <><CheckCircle size={12} /> SECURE LINK COPIED</> : <><Copy size={12} /> Copy Staff Access Link</>}
        </button>
      </div>
    </div>
  );
}
