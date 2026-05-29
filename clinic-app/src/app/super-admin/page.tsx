'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { auth, db } from '@/lib/firebase';
import { onAuthStateChanged, signOut } from 'firebase/auth';
import {
  collection, query, where, orderBy, onSnapshot,
  doc, getDoc, updateDoc, serverTimestamp
} from 'firebase/firestore';
import { getFunctions, httpsCallable } from 'firebase/functions';
import {
  ShieldCheck, ClipboardList, Building, Hospital, FileText,
  Loader2, CheckCircle, XCircle, Trash2, PowerOff, Power,
  LogOut, AlertTriangle, ChevronDown, ChevronUp, RefreshCw, Eye
} from 'lucide-react';

type Tab = 'requests' | 'orgs' | 'hospitals' | 'audits';

export default function SuperAdminPage() {
  const router = useRouter();
  const [loadingAuth, setLoadingAuth] = useState(true);
  const [activeTab, setActiveTab] = useState<Tab>('requests');

  // Data
  const [requests, setRequests] = useState<any[]>([]);
  const [orgs, setOrgs] = useState<any[]>([]);
  const [hospitals, setHospitals] = useState<any[]>([]);
  const [auditLogs, setAuditLogs] = useState<any[]>([]);

  // Action states
  const [processingId, setProcessingId] = useState<string | null>(null);
  const [expandedRequestId, setExpandedRequestId] = useState<string | null>(null);
  const [rejectingId, setRejectingId] = useState<string | null>(null);
  const [rejectReason, setRejectReason] = useState('');
  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null);
  const [deleteConfirmName, setDeleteConfirmName] = useState('');

  const functions = getFunctions();

  useEffect(() => {
    let unsubs: (() => void)[] = [];

    const unsubscribeAuth = onAuthStateChanged(auth, async (user) => {
      if (!user) {
        router.push('/admin/login');
        return;
      }

      // Verify super_admin role
      const phone = user.phoneNumber;
      if (!phone) { router.push('/'); return; }
      const adminSnap = await getDoc(doc(db, 'admins', phone));
      if (!adminSnap.exists() || adminSnap.data().role !== 'super_admin') {
        alert('ACCESS DENIED: Super Admin privileges required.');
        await signOut(auth);
        router.push('/');
        return;
      }

      setLoadingAuth(false);

      // Subscribe to all data feeds
      const requestsQ = query(collection(db, 'org_requests'), orderBy('submitted_at', 'desc'));
      unsubs.push(onSnapshot(requestsQ, snap => setRequests(snap.docs.map(d => ({ id: d.id, ...d.data() })))));

      const orgsQ = query(collection(db, 'organizations'), orderBy('created_at', 'desc'));
      unsubs.push(onSnapshot(orgsQ, snap => setOrgs(snap.docs.map(d => ({ id: d.id, ...d.data() })))));

      const hospitalsQ = query(collection(db, 'hospitals'), orderBy('created_at', 'desc'));
      unsubs.push(onSnapshot(hospitalsQ, snap => setHospitals(snap.docs.map(d => ({ id: d.id, ...d.data() })))));

      const auditsQ = query(collection(db, 'system_audits'), orderBy('created_at', 'desc'));
      unsubs.push(onSnapshot(auditsQ, snap => setAuditLogs(snap.docs.map(d => ({ id: d.id, ...d.data() })))));
    });

    return () => {
      unsubscribeAuth();
      unsubs.forEach(u => u());
    };
  }, [router]);

  // ── APPROVE ──
  const handleApprove = async (requestId: string) => {
    setProcessingId(requestId);
    try {
      const approveOrgRequest = httpsCallable(functions, 'approveOrgRequest');
      await approveOrgRequest({ requestId });
      alert('✅ Organization approved and access granted!');
    } catch (err: any) {
      alert(`Failed: ${err.message}`);
    } finally {
      setProcessingId(null);
    }
  };

  // ── REJECT ──
  const handleReject = async (requestId: string) => {
    if (!rejectReason.trim()) { alert('Please enter a rejection reason.'); return; }
    setProcessingId(requestId);
    try {
      const rejectOrgRequest = httpsCallable(functions, 'rejectOrgRequest');
      await rejectOrgRequest({ requestId, reason: rejectReason });
      setRejectingId(null);
      setRejectReason('');
    } catch (err: any) {
      alert(`Failed: ${err.message}`);
    } finally {
      setProcessingId(null);
    }
  };

  // ── SUSPEND / REINSTATE ──
  const handleSuspend = async (orgId: string, orgName: string, currentStatus: string) => {
    const isSuspended = currentStatus === 'SUSPENDED';
    const action = isSuspended ? 'reinstate' : 'suspend';
    if (!confirm(`Are you sure you want to ${action} "${orgName}"?`)) return;
    setProcessingId(orgId);
    try {
      const suspendOrganization = httpsCallable(functions, 'suspendOrganization');
      await suspendOrganization({ orgId, reason: 'Suspended by Super Admin.' });
    } catch (err: any) {
      alert(`Failed: ${err.message}`);
    } finally {
      setProcessingId(null);
    }
  };

  // ── HARD DELETE ──
  const handleHardDelete = async (orgId: string, orgName: string) => {
    if (deleteConfirmName.trim().toLowerCase() !== orgName.trim().toLowerCase()) {
      alert('Organization name does not match. Deletion cancelled.');
      return;
    }
    setProcessingId(orgId);
    try {
      const hardDeleteOrganization = httpsCallable(functions, 'hardDeleteOrganization');
      const result: any = await hardDeleteOrganization({ orgId, confirmName: deleteConfirmName });
      const d = result.data.deleted;
      alert(`🗑️ PERMANENTLY DELETED "${orgName}".\n\nCascade: ${d.hospitals} hospitals, ${d.clinics} clinics, ${d.appointments} appointments, ${d.admins} admin records wiped.`);
      setDeleteConfirmId(null);
      setDeleteConfirmName('');
    } catch (err: any) {
      alert(`Failed: ${err.message}`);
    } finally {
      setProcessingId(null);
    }
  };

  // ── EDIT ORG ADMIN PHONE ──
  const handleEditOrgPhone = async (orgId: string, oldPhone: string) => {
    const newPhone = window.prompt(`Enter new Org Admin phone number for this workspace (e.g. +91XXXXXXXXXX):`, oldPhone);
    if (!newPhone || newPhone === oldPhone) return;

    const cleanPhone = newPhone.replace(/[^0-9+]/g, '');
    const finalPhone = cleanPhone.startsWith('+') ? cleanPhone : `+91${cleanPhone}`;

    if (!confirm(`Are you sure you want to change the owner phone from ${oldPhone} to ${finalPhone}? The old number will be locked out.`)) return;
    
    setProcessingId(orgId);
    try {
      // 1. Get old admin doc
      const oldAdminRef = doc(db, 'admins', oldPhone);
      const oldSnap = await getDoc(oldAdminRef);
      
      let adminData = { role: 'org_admin', org_id: orgId, is_active: true };
      if (oldSnap.exists()) {
        adminData = oldSnap.data() as any;
      }
      
      // 2. Batch write: Create new admin, update org owner_phone, delete old admin
      const { writeBatch } = await import('firebase/firestore');
      const batch = writeBatch(db);
      
      batch.set(doc(db, 'admins', finalPhone), { ...adminData, phone: finalPhone, updated_at: serverTimestamp() });
      batch.update(doc(db, 'organizations', orgId), { owner_phone: finalPhone, updated_at: serverTimestamp() });
      if (oldSnap.exists()) batch.delete(oldAdminRef);
      
      await batch.commit();
      alert(`✅ Successfully transferred ownership to ${finalPhone}`);
    } catch (err: any) {
      console.error(err);
      alert(`Failed: ${err.message}`);
    } finally {
      setProcessingId(null);
    }
  };

  if (loadingAuth) {
    return (
      <div style={{ display: 'grid', placeItems: 'center', minHeight: '100vh' }}>
        <div style={{ textAlign: 'center' }}>
          <Loader2 size={40} className="animate-spin" style={{ color: 'var(--accent-primary)', margin: '0 auto 1rem' }} />
          <p style={{ color: 'var(--text-secondary)', fontWeight: 500 }}>Verifying Super Admin credentials…</p>
        </div>
      </div>
    );
  }

  const pendingRequests = requests.filter(r => r.status === 'PENDING');

  const tabStyle = (tab: Tab) => ({
    background: 'none', border: 'none',
    color: activeTab === tab ? 'var(--accent-primary)' : 'var(--text-secondary)',
    fontSize: '0.9rem', fontWeight: activeTab === tab ? 700 : 400,
    cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '0.4rem',
    borderBottom: activeTab === tab ? '2px solid var(--accent-primary)' : '2px solid transparent',
    paddingBottom: '0.5rem', transition: 'all 0.2s', whiteSpace: 'nowrap' as const
  });

  return (
    <div className="container fade-in">
      {/* Header */}
      <header className="header" style={{ textAlign: 'left', display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem' }}>
        <div>
          <h1 style={{ background: 'linear-gradient(to right, #ff4e50, #ffffff)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <ShieldCheck size={28} color="#ff4e50" style={{ WebkitTextFillColor: 'initial' }} /> Q-PULSE Super Admin
          </h1>
          <p style={{ color: 'var(--text-secondary)', margin: 0, fontSize: '0.85rem' }}>God Mode Control Center — All actions are permanently audited.</p>
        </div>
        <button onClick={() => { signOut(auth); router.push('/'); }} className="btn" style={{ background: 'rgba(255,77,77,0.1)', color: 'var(--danger)', border: '1px solid rgba(255,77,77,0.2)', gap: '0.4rem' }}>
          <LogOut size={16} /> Logout
        </button>
      </header>

      {/* Stats Strip */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: '1rem', marginBottom: '2rem' }}>
        {[
          { label: 'Pending Requests', value: pendingRequests.length, color: '#f59e0b' },
          { label: 'Active Orgs', value: orgs.filter(o => o.status === 'ACTIVE').length, color: '#10b981' },
          { label: 'Suspended Orgs', value: orgs.filter(o => o.status === 'SUSPENDED').length, color: '#ef4444' },
          { label: 'Audit Events', value: auditLogs.length, color: '#6366f1' },
        ].map((s, i) => (
          <div key={i} className="glass-card" style={{ padding: '1.25rem' }}>
            <span style={{ fontSize: '0.68rem', color: 'var(--text-secondary)', textTransform: 'uppercase', fontWeight: 700, display: 'block', marginBottom: '0.3rem' }}>{s.label}</span>
            <strong style={{ fontSize: '1.8rem', color: s.color, lineHeight: 1 }}>{s.value}</strong>
          </div>
        ))}
      </div>

      {/* Tabs */}
      <div style={{ display: 'flex', gap: '1.5rem', borderBottom: '1px solid var(--glass-border)', marginBottom: '2rem', overflowX: 'auto' }}>
        <button style={tabStyle('requests')} onClick={() => setActiveTab('requests')}>
          <ClipboardList size={16} /> Pending Requests
          {pendingRequests.length > 0 && (
            <span style={{ background: '#f59e0b', color: 'white', borderRadius: '50%', width: 18, height: 18, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '0.65rem', fontWeight: 800 }}>
              {pendingRequests.length}
            </span>
          )}
        </button>
        <button style={tabStyle('orgs')} onClick={() => setActiveTab('orgs')}><Building size={16} /> Organizations ({orgs.length})</button>
        <button style={tabStyle('hospitals')} onClick={() => setActiveTab('hospitals')}><Hospital size={16} /> Hospitals ({hospitals.length})</button>
        <button style={tabStyle('audits')} onClick={() => setActiveTab('audits')}><FileText size={16} /> Audit Logs</button>
      </div>

      {/* ── PENDING REQUESTS TAB ── */}
      {activeTab === 'requests' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
          {pendingRequests.length === 0 && (
            <div className="glass-card" style={{ padding: '3rem', textAlign: 'center', color: 'var(--text-secondary)' }}>No pending applications.</div>
          )}
          {pendingRequests.map(req => {
            const isExpanded = expandedRequestId === req.id;
            const isRejecting = rejectingId === req.id;
            const isProcessing = processingId === req.id;
            const statusColors: Record<string, string> = { PENDING: '#f59e0b', APPROVED: '#10b981', REJECTED: '#ef4444' };

            return (
              <div key={req.id} className="glass-card" style={{ padding: '1.5rem' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '1rem' }}>
                  <div style={{ flex: 1 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '0.25rem' }}>
                      <h3 style={{ margin: 0, fontSize: '1rem' }}>{req.org_name}</h3>
                      <span style={{ fontSize: '0.68rem', fontWeight: 700, padding: '2px 8px', borderRadius: 20, background: `${statusColors[req.status]}20`, color: statusColors[req.status], textTransform: 'uppercase' }}>{req.status}</span>
                    </div>
                    <p style={{ margin: 0, color: 'var(--text-secondary)', fontSize: '0.8rem' }}>
                      {req.org_type?.replace('_', ' ')} · {req.city} · {req.contact_name} · {req.contact_phone}
                    </p>
                  </div>
                  <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
                    <button onClick={() => setExpandedRequestId(isExpanded ? null : req.id)} className="btn btn-outline" style={{ padding: '0.4rem 0.6rem', minHeight: 'auto', fontSize: '0.75rem' }}>
                      <Eye size={13} /> {isExpanded ? 'Less' : 'Details'}
                    </button>
                    {req.status === 'PENDING' && (
                      <>
                        <button onClick={() => handleApprove(req.id)} disabled={isProcessing} className="btn" style={{ background: 'rgba(16,185,129,0.1)', color: '#10b981', border: '1px solid rgba(16,185,129,0.25)', padding: '0.4rem 0.8rem', minHeight: 'auto', fontSize: '0.8rem', fontWeight: 700 }}>
                          {isProcessing ? <Loader2 size={14} className="animate-spin" /> : <><CheckCircle size={14} /> Approve</>}
                        </button>
                        <button onClick={() => setRejectingId(isRejecting ? null : req.id)} className="btn" style={{ background: 'rgba(239,68,68,0.08)', color: '#ef4444', border: '1px solid rgba(239,68,68,0.2)', padding: '0.4rem 0.8rem', minHeight: 'auto', fontSize: '0.8rem', fontWeight: 700 }}>
                          <XCircle size={14} /> Reject
                        </button>
                      </>
                    )}
                  </div>
                </div>

                {/* Expanded Details */}
                {isExpanded && (
                  <div style={{ marginTop: '1rem', padding: '1rem', background: 'rgba(255,255,255,0.03)', borderRadius: 10, border: '1px solid var(--glass-border)', display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.6rem', fontSize: '0.82rem' }}>
                    <div><span style={{ color: 'var(--text-secondary)' }}>First Clinic:</span> <strong>{req.first_clinic_name}</strong></div>
                    <div><span style={{ color: 'var(--text-secondary)' }}>Doctor:</span> <strong>{req.first_doctor_name}</strong></div>
                    <div><span style={{ color: 'var(--text-secondary)' }}>Specialization:</span> <strong>{req.first_specialization}</strong></div>
                    <div><span style={{ color: 'var(--text-secondary)' }}>Address:</span> <strong>{req.first_clinic_address || '—'}</strong></div>
                    <div><span style={{ color: 'var(--text-secondary)' }}>Email:</span> <strong>{req.contact_email || '—'}</strong></div>
                    <div><span style={{ color: 'var(--text-secondary)' }}>Ref ID:</span> <code style={{ fontSize: '0.72rem', color: 'var(--accent-secondary)' }}>{req.id}</code></div>
                    {req.description && (
                      <div style={{ gridColumn: '1/-1' }}><span style={{ color: 'var(--text-secondary)' }}>Description:</span> <span>{req.description}</span></div>
                    )}
                    {req.rejection_reason && (
                      <div style={{ gridColumn: '1/-1', color: '#ef4444' }}><strong>Rejection Reason:</strong> {req.rejection_reason}</div>
                    )}
                  </div>
                )}

                {/* Reject reason input */}
                {isRejecting && req.status === 'PENDING' && (
                  <div style={{ marginTop: '1rem', display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
                    <input className="input-field" style={{ flex: 1, padding: '0.5rem 0.75rem' }}
                      placeholder="Enter rejection reason (required)…"
                      value={rejectReason} onChange={e => setRejectReason(e.target.value)} />
                    <button onClick={() => handleReject(req.id)} disabled={isProcessing} className="btn" style={{ background: '#ef4444', color: 'white', padding: '0.5rem 0.85rem', minHeight: 'auto', fontWeight: 700 }}>
                      {isProcessing ? <Loader2 size={14} className="animate-spin" /> : 'Confirm Reject'}
                    </button>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* ── ORGANIZATIONS TAB ── */}
      {activeTab === 'orgs' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
          {orgs.length === 0 && (
            <div className="glass-card" style={{ padding: '3rem', textAlign: 'center', color: 'var(--text-secondary)' }}>No organizations exist yet.</div>
          )}
          {orgs.map(org => {
            const isSuspended = org.status === 'SUSPENDED';
            const isDeleting = deleteConfirmId === org.id;
            const isProcessing = processingId === org.id;

            return (
              <div key={org.id} className="glass-card" style={{ padding: '1.5rem', borderLeft: `3px solid ${isSuspended ? '#ef4444' : '#10b981'}` }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '1rem' }}>
                  <div>
                    <h3 style={{ margin: '0 0 0.25rem', fontSize: '1rem' }}>{org.name}</h3>
                    <p style={{ margin: 0, fontSize: '0.78rem', color: 'var(--text-secondary)' }}>
                      {org.owner_phone} · {org.city || '—'} · Plan: <strong>{org.plan?.toUpperCase()}</strong> ·{' '}
                      <span style={{ color: isSuspended ? '#ef4444' : '#10b981', fontWeight: 700 }}>{org.status}</span>
                    </p>
                  </div>
                  <div style={{ display: 'flex', gap: '0.5rem', flexShrink: 0, flexWrap: 'wrap' }}>
                    <button onClick={() => router.push(`/org?impersonate=${org.id}`)} disabled={isProcessing || isSuspended} className="btn" style={{ background: 'rgba(99,102,241,0.1)', color: '#6366f1', border: '1px solid rgba(99,102,241,0.2)', padding: '0.4rem 0.75rem', minHeight: 'auto', fontSize: '0.78rem', fontWeight: 700 }}>
                      <Eye size={13} /> Manage Workspace
                    </button>
                    <button onClick={() => handleEditOrgPhone(org.id, org.owner_phone)} disabled={isProcessing} className="btn" style={{ background: 'rgba(255,255,255,0.05)', color: 'var(--text-primary)', border: '1px solid var(--glass-border)', padding: '0.4rem 0.75rem', minHeight: 'auto', fontSize: '0.78rem', fontWeight: 700 }}>
                      Change Phone
                    </button>
                    <button onClick={() => handleSuspend(org.id, org.name, org.status)} disabled={isProcessing} className="btn" style={{ background: isSuspended ? 'rgba(16,185,129,0.1)' : 'rgba(251,191,36,0.1)', color: isSuspended ? '#10b981' : '#f59e0b', border: `1px solid ${isSuspended ? 'rgba(16,185,129,0.2)' : 'rgba(251,191,36,0.2)'}`, padding: '0.4rem 0.75rem', minHeight: 'auto', fontSize: '0.78rem', fontWeight: 700 }}>
                      {isProcessing ? <Loader2 size={13} className="animate-spin" /> : isSuspended ? <><Power size={13} /> Reinstate</> : <><PowerOff size={13} /> Suspend</>}
                    </button>
                    <button onClick={() => { setDeleteConfirmId(isDeleting ? null : org.id); setDeleteConfirmName(''); }} className="btn" style={{ background: 'rgba(239,68,68,0.08)', color: '#ef4444', border: '1px solid rgba(239,68,68,0.2)', padding: '0.4rem 0.75rem', minHeight: 'auto', fontSize: '0.78rem', fontWeight: 700 }}>
                      <Trash2 size={13} /> Hard Delete
                    </button>
                  </div>
                </div>

                {/* Hard Delete Confirm Dialog */}
                {isDeleting && (
                  <div style={{ marginTop: '1rem', padding: '1rem', background: 'rgba(239,68,68,0.06)', border: '1px solid rgba(239,68,68,0.25)', borderRadius: 10 }}>
                    <p style={{ margin: '0 0 0.75rem', fontSize: '0.82rem', color: '#ef4444', fontWeight: 700 }}>
                      ⚠️ IRREVERSIBLE ACTION: This will permanently delete &quot;{org.name}&quot; along with all its hospitals, clinics, appointments, and admin accounts.
                    </p>
                    <p style={{ margin: '0 0 0.5rem', fontSize: '0.8rem', color: 'var(--text-secondary)' }}>
                      Type the organization name exactly to confirm:
                    </p>
                    <div style={{ display: 'flex', gap: '0.5rem' }}>
                      <input className="input-field" style={{ flex: 1, padding: '0.5rem 0.75rem', borderColor: 'rgba(239,68,68,0.4)' }}
                        placeholder={`Type "${org.name}" to confirm`}
                        value={deleteConfirmName} onChange={e => setDeleteConfirmName(e.target.value)} />
                      <button onClick={() => handleHardDelete(org.id, org.name)} disabled={isProcessing} className="btn" style={{ background: '#ef4444', color: 'white', padding: '0.5rem 0.85rem', minHeight: 'auto', fontWeight: 700 }}>
                        {isProcessing ? <Loader2 size={14} className="animate-spin" /> : '🗑️ DESTROY'}
                      </button>
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* ── HOSPITALS TAB ── */}
      {activeTab === 'hospitals' && (
        <div className="glass-card" style={{ padding: '1.5rem' }}>
          <h2 style={{ margin: '0 0 1.5rem', fontSize: '0.95rem', color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.08em' }}>
            All Hospitals ({hospitals.length})
          </h2>
          {hospitals.length === 0 ? (
            <p style={{ textAlign: 'center', color: 'var(--text-secondary)', padding: '2rem 0' }}>No hospitals registered yet.</p>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
              {hospitals.map(h => (
                <div key={h.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '0.75rem 1rem', background: 'rgba(255,255,255,0.03)', borderRadius: 10, border: '1px solid var(--glass-border)' }}>
                  <div>
                    <div style={{ fontWeight: 700, fontSize: '0.9rem' }}>{h.name}</div>
                    <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>{h.city} · Org: {h.org_id?.substring(0, 8)}…</div>
                  </div>
                  <span style={{ fontSize: '0.72rem', fontWeight: 700, padding: '2px 8px', borderRadius: 20, background: h.status === 'ACTIVE' ? 'rgba(16,185,129,0.1)' : 'rgba(239,68,68,0.1)', color: h.status === 'ACTIVE' ? '#10b981' : '#ef4444' }}>
                    {h.status || 'ACTIVE'}
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* ── AUDIT LOGS TAB ── */}
      {activeTab === 'audits' && (
        <div className="glass-card" style={{ overflow: 'hidden', padding: 0 }}>
          <div style={{ padding: '1.5rem', borderBottom: '1px solid var(--glass-border)' }}>
            <h2 style={{ margin: 0, fontSize: '1rem' }}>System Audit Logs</h2>
            <p style={{ margin: '0.25rem 0 0', fontSize: '0.8rem', color: 'var(--text-secondary)' }}>
              Immutable record of all admin, staff, and doctor actions across the platform.
            </p>
          </div>
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '0.82rem' }}>
              <thead>
                <tr style={{ background: 'rgba(255,255,255,0.03)', borderBottom: '1px solid var(--glass-border)' }}>
                  <th style={{ padding: '0.85rem 1rem', color: 'var(--text-secondary)', fontWeight: 600 }}>Timestamp</th>
                  <th style={{ padding: '0.85rem 1rem', color: 'var(--text-secondary)', fontWeight: 600 }}>Actor</th>
                  <th style={{ padding: '0.85rem 1rem', color: 'var(--text-secondary)', fontWeight: 600 }}>Role</th>
                  <th style={{ padding: '0.85rem 1rem', color: 'var(--text-secondary)', fontWeight: 600 }}>Action</th>
                  <th style={{ padding: '0.85rem 1rem', color: 'var(--text-secondary)', fontWeight: 600 }}>Details</th>
                </tr>
              </thead>
              <tbody>
                {auditLogs.length === 0 ? (
                  <tr><td colSpan={5} style={{ padding: '2rem', textAlign: 'center', color: 'var(--text-secondary)' }}>No audit events yet.</td></tr>
                ) : (
                  auditLogs.map(log => {
                    const dateObj = log.created_at?.toDate ? log.created_at.toDate() : new Date();
                    return (
                      <tr key={log.id} style={{ borderBottom: '1px solid rgba(255,255,255,0.04)' }}>
                        <td style={{ padding: '0.85rem 1rem', whiteSpace: 'nowrap' }}>
                          <span style={{ color: 'var(--text-primary)' }}>{dateObj.toLocaleDateString()}</span>
                          <span style={{ color: 'var(--text-secondary)', marginLeft: '0.4rem', fontSize: '0.75rem' }}>{dateObj.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                        </td>
                        <td style={{ padding: '0.85rem 1rem', fontFamily: 'monospace', color: 'var(--accent-secondary)', fontSize: '0.78rem' }}>{log.actor_phone}</td>
                        <td style={{ padding: '0.85rem 1rem' }}>
                          <span style={{ background: 'rgba(99,102,241,0.1)', color: '#6366f1', padding: '2px 8px', borderRadius: 20, fontSize: '0.7rem', fontWeight: 700 }}>{log.actor_role}</span>
                        </td>
                        <td style={{ padding: '0.85rem 1rem' }}>
                          <span style={{ background: 'rgba(0,210,255,0.08)', color: 'var(--accent-primary)', padding: '3px 8px', borderRadius: 6, fontSize: '0.72rem', fontWeight: 700, letterSpacing: '0.03em' }}>{log.action}</span>
                        </td>
                        <td style={{ padding: '0.85rem 1rem', color: 'var(--text-secondary)', maxWidth: 400, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{log.details}</td>
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
