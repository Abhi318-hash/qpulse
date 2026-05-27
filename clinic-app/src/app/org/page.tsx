'use client';

import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { onAuthStateChanged, signOut } from 'firebase/auth';
import { auth } from '@/lib/firebase';
import { 
  collection, query, where, getDocs, doc, 
  getDoc, addDoc, updateDoc, serverTimestamp,
  onSnapshot
} from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { 
  Building, Stethoscope, Users, CreditCard, Plus, 
  ArrowUpRight, Loader2, LogOut, Settings, HelpCircle, 
  Power, PowerOff, Shield, AlertTriangle, CheckCircle, X
} from 'lucide-react';
import Link from 'next/link';

export default function OrgDashboard() {
  const router = useRouter();
  const [currentUser, setCurrentUser] = useState<any>(null);
  const [adminRecord, setAdminRecord] = useState<any>(null);
  const [org, setOrg] = useState<any>(null);
  const [clinics, setClinics] = useState<any[]>([]);
  
  const [loading, setLoading] = useState(true);
  const [addingClinic, setAddingClinic] = useState(false);
  const [showAddModal, setShowAddModal] = useState(false);

  // New clinic form state
  const [newClinicName, setNewClinicName] = useState('');
  const [newDoctorName, setNewDoctorName] = useState('');
  const [newDoctorDegree, setNewDoctorDegree] = useState('');
  const [newSpecialization, setNewSpecialization] = useState('');
  const [newLocation, setNewLocation] = useState('');
  const [newFees, setNewFees] = useState('500');
  const [newAuthPhone, setNewAuthPhone] = useState('');

  useEffect(() => {
    let unsubscribeClinics: () => void;
    let unsubscribeOrg: () => void;

    const unsubscribeAuth = onAuthStateChanged(auth, async (user) => {
      if (!user) {
        router.push('/login?redirect=/org');
        return;
      }
      setCurrentUser(user);

      try {
        // 1. Get the admin record by phone number
        const phone = user.phoneNumber;
        if (!phone) {
          alert('Phone number authentication is required for SaaS Workspace.');
          router.push('/');
          return;
        }

        const adminRef = doc(db, 'admins', phone);
        const adminSnap = await getDoc(adminRef);

        if (!adminSnap.exists() || adminSnap.data().role !== 'org_admin') {
          console.warn('Unauthorized access attempt to org dashboard by:', phone);
          router.push('/onboard'); // Redirect to onboard if not an org admin yet
          return;
        }
        
        const admData = adminSnap.data();
        setAdminRecord(admData);

        const orgId = admData.org_id;
        if (!orgId) {
          router.push('/onboard');
          return;
        }

        // 2. Subscribe to Organization document
        unsubscribeOrg = onSnapshot(doc(db, 'organizations', orgId), (orgSnap) => {
          if (orgSnap.exists()) {
            setOrg({ id: orgSnap.id, ...orgSnap.data() });
          }
        });

        // 3. Subscribe to Clinics belonging to this organization (Multi-Tenancy)
        const clinicsQuery = query(
          collection(db, 'clinics'),
          where('org_id', '==', orgId)
        );
        
        unsubscribeClinics = onSnapshot(clinicsQuery, (snapshot) => {
          const clinicsList = snapshot.docs.map(d => ({ id: d.id, ...d.data() }));
          setClinics(clinicsList);
          setLoading(false);
        });

      } catch (err) {
        console.error('Failed to load org dashboard:', err);
        setLoading(false);
      }
    });

    return () => {
      unsubscribeAuth();
      if (unsubscribeClinics) unsubscribeClinics();
      if (unsubscribeOrg) unsubscribeOrg();
    };
  }, [router]);

  const handleAddClinicSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!org || !newClinicName || !newDoctorName || !newAuthPhone) return;

    // Enforce Plan Limits
    const maxClinics = org.max_clinics || 1;
    if (clinics.length >= maxClinics) {
      alert(`Plan limit exceeded! Your current ${org.plan.toUpperCase()} plan supports a maximum of ${maxClinics} clinic(s). Please upgrade your plan under the Billing tab.`);
      return;
    }

    setAddingClinic(true);
    try {
      const cleanPhone = newAuthPhone.replace(/[^0-9+]/g, '');
      const finalPhone = cleanPhone.startsWith('+') ? cleanPhone : `+91${cleanPhone}`;

      const clinicPayload = {
        name: newClinicName,
        doctor_name: newDoctorName,
        dr_degree: newDoctorDegree || 'MBBS',
        specialization: newSpecialization || 'General Physician',
        location: newLocation || 'Main Center',
        fees: parseFloat(newFees) || 500,
        authorized_phone: finalPhone,
        org_id: org.id, // Multi-tenant binding
        is_open: true,
        is_hidden: false,
        patient_count: 0,
        last_issued_token: 0,
        currently_serving_token: '--',
        notification_config: {
          sms_enabled: org.plan !== 'free',
          fcm_enabled: true,
          whatsapp_enabled: false,
          notify_at_positions_before: 2,
          notify_message_template: 'Your turn is coming up at {clinic}!'
        },
        created_at: serverTimestamp(),
        updated_at: serverTimestamp()
      };

      await addDoc(collection(db, 'clinics'), clinicPayload);
      
      // Reset form
      setShowAddModal(false);
      setNewClinicName('');
      setNewDoctorName('');
      setNewDoctorDegree('');
      setNewSpecialization('');
      setNewLocation('');
      setNewFees('500');
      setNewAuthPhone('');
      alert('New clinic configured successfully!');
    } catch (err) {
      console.error(err);
      alert('Failed to configure clinic.');
    } finally {
      setAddingClinic(false);
    }
  };

  const handleToggleClinic = async (clinicId: string, currentOpen: boolean) => {
    try {
      await updateDoc(doc(db, 'clinics', clinicId), {
        is_open: !currentOpen,
        updated_at: serverTimestamp()
      });
    } catch (err) {
      console.error(err);
      alert('Failed to update clinic status.');
    }
  };

  if (loading) {
    return (
      <div style={{ display: 'grid', placeItems: 'center', minHeight: '100vh' }}>
        <div style={{ textAlign: 'center' }}>
          <Loader2 size={40} className="animate-spin" style={{ color: '#007BFF', margin: '0 auto 1rem' }} />
          <p style={{ color: '#5a6a7e', fontWeight: 500 }}>Loading SaaS Workspace…</p>
        </div>
      </div>
    );
  }

  const isSuspended = org?.billing_status === 'suspended';

  return (
    <main style={{ minHeight: '100vh', background: '#f8fafc', color: '#1a2332' }}>
      
      {/* Header Banner */}
      <header style={{
        background: '#ffffff', borderBottom: '1px solid #eef0f3',
        padding: '1rem 2rem', display: 'flex', justifyContent: 'space-between',
        alignItems: 'center', flexWrap: 'wrap', gap: '1rem'
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
          <div style={{
            width: 44, height: 44, borderRadius: 10,
            background: 'linear-gradient(135deg,#007BFF,#0056CC)',
            display: 'flex', alignItems: 'center', justifyContent: 'center'
          }}>
            <Building size={22} color="white" />
          </div>
          <div>
            <h1 style={{ fontSize: '1.15rem', margin: 0, fontWeight: 800 }}>{org?.name}</h1>
            <p style={{ margin: 0, fontSize: '0.75rem', color: '#5a6a7e', display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
              <Shield size={12} color="#007BFF" /> SaaS Admin Portal · Plan: <strong>{org?.plan?.toUpperCase()}</strong>
            </p>
          </div>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
          <Link href="/billing" className="btn btn-outline" style={{ fontSize: '0.82rem', padding: '0.5rem 0.9rem' }}>
            <CreditCard size={14} /> Plan &amp; Billing
          </Link>
          <button 
            onClick={() => { signOut(auth); router.push('/'); }}
            className="btn btn-outline" 
            style={{ fontSize: '0.82rem', padding: '0.5rem 0.9rem', color: '#dc3545', borderColor: 'rgba(220,53,69,0.2)' }}
          >
            <LogOut size={14} /> Logout
          </button>
        </div>
      </header>

      {/* Main Body Grid */}
      <div className="container" style={{ maxWidth: 1080, paddingTop: '1.5rem' }}>
        
        {/* Suspended Alert Banner */}
        {isSuspended && (
          <div style={{
            background: 'rgba(220,53,69,0.06)', border: '1px solid rgba(220,53,69,0.22)',
            borderRadius: 12, padding: '1rem 1.25rem', marginBottom: '1.5rem',
            display: 'flex', alignItems: 'center', gap: '0.75rem', color: '#dc3545'
          }}>
            <AlertTriangle size={20} />
            <div style={{ flex: 1 }}>
              <p style={{ margin: 0, fontSize: '0.85rem', fontWeight: 700 }}>WORKSPACE SUSPENDED</p>
              <p style={{ margin: 0, fontSize: '0.78rem', color: '#5a6a7e' }}>Your billing cycle expired or payment failed. Patients cannot book tokens until plan is renewed.</p>
            </div>
            <Link href="/billing" className="btn" style={{ background: '#dc3545', color: 'white', fontSize: '0.75rem', padding: '0.4rem 0.8rem' }}>Pay Now</Link>
          </div>
        )}

        {/* Aggregate Stats Strip */}
        <div style={{
          display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))',
          gap: '1rem', marginBottom: '2rem'
        }}>
          {[
            { label: 'Active Clinics', value: clinics.length, desc: `Plan limit: ${org?.max_clinics || 1}`, color: '#007BFF' },
            { label: 'Total Serving Now', value: clinics.reduce((acc, c) => acc + (c.patient_count || 0), 0), desc: 'Waiting in all clinic rooms', color: '#28a745' },
            { label: 'SaaS Status', value: org?.billing_status?.toUpperCase(), desc: `Renewal: ${org?.billing_cycle_end?.toDate ? org.billing_cycle_end.toDate().toLocaleDateString() : '—'}`, color: org?.billing_status === 'active' ? '#28a745' : '#dc3545' }
          ].map((stat, i) => (
            <div key={i} className="clinic-card" style={{ padding: '1.25rem' }}>
              <span style={{ fontSize: '0.72rem', color: '#5a6a7e', fontWeight: 700, textTransform: 'uppercase', display: 'block', marginBottom: '0.4rem' }}>{stat.label}</span>
              <strong style={{ fontSize: '1.6rem', color: stat.color, display: 'block', lineHeight: 1.2 }}>{stat.value}</strong>
              <span style={{ fontSize: '0.7rem', color: '#5a6a7e', marginTop: '0.2rem', display: 'block' }}>{stat.desc}</span>
            </div>
          ))}
        </div>

        {/* Clinics Listing & Header */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.25rem' }}>
          <h2 style={{ fontSize: '1.05rem', fontWeight: 700, display: 'flex', alignItems: 'center', gap: '0.45rem' }}>
            <Stethoscope size={18} color="#007BFF" /> Clinic Management
          </h2>
          
          <button 
            onClick={() => setShowAddModal(true)}
            className="btn btn-primary" 
            style={{ fontSize: '0.85rem', padding: '0.5rem 0.9rem' }}
            disabled={isSuspended}
          >
            <Plus size={14} /> Add New Clinic
          </button>
        </div>

        <div className="grid-clinics">
          {clinics.length === 0 ? (
            <div style={{ gridColumn: '1/-1', textAlign: 'center', padding: '4rem', background: '#fff', borderRadius: 16, border: '1px solid #eef0f3' }}>
              <Stethoscope size={36} style={{ color: '#5a6a7e', margin: '0 auto 1rem' }} />
              <p style={{ color: '#5a6a7e', fontWeight: 500 }}>No clinics set up yet. Click Add New Clinic to launch your workspace.</p>
            </div>
          ) : (
            clinics.map(clinic => (
              <div 
                key={clinic.id} 
                className="clinic-card" 
                style={{ 
                  display: 'flex', flexDirection: 'column', padding: '1.5rem', 
                  borderTop: `4px solid ${clinic.is_open ? '#28a745' : '#dc3545'}` 
                }}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '1rem' }}>
                  <div>
                    <h3 style={{ margin: 0, fontSize: '1.1rem', fontWeight: 800 }}>{clinic.name}</h3>
                    <p style={{ margin: 0, fontSize: '0.78rem', color: '#5a6a7e' }}>Dr. {clinic.doctor_name} · {clinic.specialization}</p>
                  </div>
                  <button 
                    onClick={() => handleToggleClinic(clinic.id, clinic.is_open)}
                    className="btn" 
                    style={{
                      padding: '0.35rem 0.75rem', fontSize: '0.75rem', fontWeight: 700,
                      background: clinic.is_open ? 'rgba(40,167,69,0.1)' : 'rgba(220,53,69,0.1)',
                      color: clinic.is_open ? '#28a745' : '#dc3545',
                      border: `1px solid ${clinic.is_open ? 'rgba(40,167,69,0.2)' : 'rgba(220,53,69,0.2)'}`
                    }}
                  >
                    {clinic.is_open ? 'Open' : 'Closed'}
                  </button>
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem', padding: '0.75rem', background: '#f8fafc', borderRadius: 10, border: '1px solid #eef0f3', marginBottom: '1.25rem' }}>
                  <div>
                    <span style={{ fontSize: '0.62rem', color: '#5a6a7e', textTransform: 'uppercase', display: 'block' }}>Waiting Desk</span>
                    <strong style={{ fontSize: '1.15rem', color: '#007BFF' }}>{clinic.patient_count} Patients</strong>
                  </div>
                  <div>
                    <span style={{ fontSize: '0.62rem', color: '#5a6a7e', textTransform: 'uppercase', display: 'block' }}>Authorized Staff</span>
                    <span style={{ fontSize: '0.78rem', color: '#1a2332', fontWeight: 600 }}>{clinic.authorized_phone}</span>
                  </div>
                </div>

                {/* Dashboard Action Links */}
                <div style={{ display: 'flex', gap: '0.5rem', marginTop: 'auto' }}>
                  <Link 
                    href={`/clinic/${clinic.id}`} 
                    target="_blank"
                    className="btn btn-primary" 
                    style={{ flex: 1, padding: '0.45rem', fontSize: '0.8rem' }}
                  >
                    Staff Dashboard <ArrowUpRight size={14} />
                  </Link>
                </div>
              </div>
            ))
          )}
        </div>

      </div>

      {/* ── ADD NEW CLINIC MODAL ── */}
      {showAddModal && (
        <div style={{
          position: 'fixed', top: 0, left: 0, width: '100%', height: '100%',
          background: 'rgba(10,20,40,0.55)', backdropFilter: 'blur(8px)',
          zIndex: 9999, display: 'flex', justifyContent: 'center', alignItems: 'center', padding: '1rem'
        }} onClick={(e) => e.target === e.currentTarget && setShowAddModal(false)}>
          <div className="clinic-card" style={{ width: '100%', maxWidth: 480, padding: 0, overflow: 'hidden', boxShadow: '0 24px 80px rgba(0,0,0,0.2)' }}>
            <div style={{ padding: '1.25rem 1.5rem', borderBottom: '1px solid #eef0f3', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <h3 style={{ margin: 0, fontSize: '1rem', color: '#1a2332' }}>Configure New Clinic Room</h3>
              <button onClick={() => setShowAddModal(false)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#5a6a7e' }}><X size={20} /></button>
            </div>

            <form onSubmit={handleAddClinicSubmit} style={{ padding: '1.5rem', display: 'flex', flexDirection: 'column', gap: '1rem' }}>
              <div>
                <label style={{ fontSize: '0.72rem', color: '#5a6a7e', textTransform: 'uppercase', fontWeight: 700, marginBottom: '0.4rem', display: 'block' }}>Clinic / Department Name</label>
                <input 
                  type="text" required className="input-field"
                  value={newClinicName} onChange={e => setNewClinicName(e.target.value)}
                  placeholder="e.g. Apollo Dental Suite, Orthopedics Room 2" 
                />
              </div>

              <div>
                <label style={{ fontSize: '0.72rem', color: '#5a6a7e', textTransform: 'uppercase', fontWeight: 700, marginBottom: '0.4rem', display: 'block' }}>Primary Doctor Name</label>
                <input 
                  type="text" required className="input-field"
                  value={newDoctorName} onChange={e => setNewDoctorName(e.target.value)}
                  placeholder="Dr. John Smith" 
                />
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.8rem' }}>
                <div>
                  <label style={{ fontSize: '0.72rem', color: '#5a6a7e', textTransform: 'uppercase', fontWeight: 700, marginBottom: '0.4rem', display: 'block' }}>Degrees</label>
                  <input 
                    type="text" className="input-field"
                    value={newDoctorDegree} onChange={e => setNewDoctorDegree(e.target.value)}
                    placeholder="MBBS, MD" 
                  />
                </div>
                <div>
                  <label style={{ fontSize: '0.72rem', color: '#5a6a7e', textTransform: 'uppercase', fontWeight: 700, marginBottom: '0.4rem', display: 'block' }}>Specialization</label>
                  <input 
                    type="text" className="input-field"
                    value={newSpecialization} onChange={e => setNewSpecialization(e.target.value)}
                    placeholder="Cardiologist" 
                  />
                </div>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: '0.8rem' }}>
                <div>
                  <label style={{ fontSize: '0.72rem', color: '#5a6a7e', textTransform: 'uppercase', fontWeight: 700, marginBottom: '0.4rem', display: 'block' }}>Room / Location Details</label>
                  <input 
                    type="text" className="input-field"
                    value={newLocation} onChange={e => setNewLocation(e.target.value)}
                    placeholder="2nd Floor, Room 204" 
                  />
                </div>
                <div>
                  <label style={{ fontSize: '0.72rem', color: '#5a6a7e', textTransform: 'uppercase', fontWeight: 700, marginBottom: '0.4rem', display: 'block' }}>Fees (₹)</label>
                  <input 
                    type="number" className="input-field"
                    value={newFees} onChange={e => setNewFees(e.target.value)}
                    placeholder="500" 
                  />
                </div>
              </div>

              <div>
                <label style={{ fontSize: '0.72rem', color: '#5a6a7e', textTransform: 'uppercase', fontWeight: 700, marginBottom: '0.4rem', display: 'block' }}>Authorized Staff Phone (dashboard access phone)</label>
                <input 
                  type="tel" required className="input-field"
                  value={newAuthPhone} onChange={e => setNewAuthPhone(e.target.value)}
                  placeholder="e.g. +91XXXXXXXXXX" 
                />
              </div>

              <button type="submit" className="btn btn-primary" style={{ width: '100%', marginTop: '0.5rem' }} disabled={addingClinic}>
                {addingClinic ? <Loader2 size={16} className="animate-spin" /> : 'Launch Clinic Room'}
              </button>
            </form>
          </div>
        </div>
      )}

    </main>
  );
}
