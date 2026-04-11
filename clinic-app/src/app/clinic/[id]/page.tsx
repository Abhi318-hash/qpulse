'use client';

import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { auth } from '@/lib/firebase';
import { onAuthStateChanged, signOut } from 'firebase/auth';
import { 
  addPatientToken, 
  subscribeToClinicRoster, 
  advanceTokenQueue, 
  toggleClinicStatus, 
  subscribeToSingleClinic, 
  updateDoctorName,
  updateClinicProfile,
  getClinicHistory
} from '@/lib/actions';
import { Plus, Power, PowerOff, UserCog, Check, X, MapPin, Stethoscope, Edit2, Loader2, LogOut, FileText, UserPlus, Zap, History, Search, Phone, Clock, GraduationCap, IndianRupee } from 'lucide-react';
import Link from 'next/link';

export default function ClinicRecipientPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = React.use(params);
  const router = useRouter();
  
  const [clinic, setClinic] = useState<any>(null);
  const [roster, setRoster] = useState<any[]>([]);
  const [loadingConfig, setLoadingConfig] = useState(true);
  const [loadingConfig2, setLoadingConfig2] = useState(true);
  const [loadingAuth, setLoadingAuth] = useState(true);
  const [error, setError] = useState('');

  // Edit Full Profile Modal State
  const [showEditProfile, setShowEditProfile] = useState(false);
  const [savingProfile, setSavingProfile] = useState(false);
  
  const [editData, setEditData] = useState({
    doctor_name: '', dr_degree: '', specialization: '',
    fees: '', phone_number: '', operating_hours: ''
  });

  // New Walk-in Patient Form
  const [patientName, setPatientName] = useState('');
  const [patientAge, setPatientAge] = useState('');
  const [fees, setFees] = useState('');
  const [disease, setDisease] = useState('');
  const [addingToken, setAddingToken] = useState(false);

  // Advancing Queue
  const [advancingId, setAdvancingId] = useState<string | null>(null);

  // History Modal State
  const [showHistory, setShowHistory] = useState(false);
  const [historyTab, setHistoryTab] = useState<'LOG' | 'ANALYTICS'>('LOG');
  const [historyData, setHistoryData] = useState<any[]>([]);
  const [loadingHistory, setLoadingHistory] = useState(false);
  const [historySearch, setHistorySearch] = useState('');

  const exportToExcel = () => {
    if (!historyData || historyData.length === 0) {
      alert("No data available to export.");
      return;
    }
    
    const headers = ["Date", "Time", "Patient Name", "Phone Number", "Age", "Medical Issue", "Fees Paid (INR)", "Token Ref"];
    
    const rows = historyData.map(record => {
      const dateObj = record.created_at?.toDate ? record.created_at.toDate() : new Date();
      return [
        dateObj.toLocaleDateString(),
        dateObj.toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'}),
        `"${(record.patient_name || '').replace(/"/g, '""')}"`,
        `"${record.user_phone ? record.user_phone : 'Walk-In'}"`,
        record.age || '',
        `"${(record.disease || '').replace(/"/g, '""')}"`,
        record.fees || '0',
        record.token_number || ''
      ].join(',');
    });
    
    const csvContent = "data:text/csv;charset=utf-8," + [headers.join(','), ...rows].join('\n');
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute("download", `QPULSE_Export_${clinic?.name?.replace(/\s+/g, '_')}_${new Date().toLocaleDateString().replace(/\//g, '-')}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  useEffect(() => {
    let unsubscribeData: () => void;
    let unsubscribeRoster: () => void;

    const unsubscribeAuth = onAuthStateChanged(auth, (user) => {
      if (!user) {
        router.push('/clinic/login');
      } else {
        setLoadingAuth(false);
        
        // Subscribe to Clinic Config
        unsubscribeData = subscribeToSingleClinic(id, (data) => {
          if (!data) {
             setError('Clinic not found.');
          } else if (data.authorized_phone && data.authorized_phone !== user.phoneNumber && process.env.NEXT_PUBLIC_ADMIN_PHONE !== user.phoneNumber) {
             setError('ACCESS DENIED: Your phone number is not authorized to manage this clinic.');
          } else {
             setClinic(data);
             setError('');
          }
          setLoadingConfig(false);
        });

        // Subscribe to Live Roster list
        unsubscribeRoster = subscribeToClinicRoster(id, (apps) => {
          setRoster(apps);
          setLoadingConfig2(false);
        });
      }
    });

    return () => {
      unsubscribeAuth();
      if (unsubscribeData) unsubscribeData();
      if (unsubscribeRoster) unsubscribeRoster();
    };
  }, [id, router]);

  const handleToggleStatus = async () => {
    if (!clinic) return;
    try {
      await toggleClinicStatus(id, clinic.is_open);
    } catch {
      alert('Failed to update status.');
    }
  };

  const handleOpenEditProfile = () => {
    setEditData({
      doctor_name: clinic.doctor_name || '',
      dr_degree: clinic.dr_degree || '',
      specialization: clinic.specialization || '',
      fees: clinic.fees || '',
      phone_number: clinic.phone_number || '',
      operating_hours: clinic.operating_hours || ''
    });
    setShowEditProfile(true);
  };

  const handleSaveProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    setSavingProfile(true);
    try {
      await updateClinicProfile(id, editData, auth.currentUser?.phoneNumber || 'Staff');
      setShowEditProfile(false);
    } catch {
      alert('Failed to update clinic profile.');
    } finally {
      setSavingProfile(false);
    }
  };

  const handleAddWalkIn = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!patientName || !clinic) return;
    
    setAddingToken(true);
    try {
      await addPatientToken(
        id, 
        patientName, 
        parseInt(patientAge) || 0, 
        parseFloat(fees) || 0, 
        disease || 'General'
      );
      
      // reset form
      setPatientName('');
      setPatientAge('');
      setFees('');
      setDisease('');
    } catch (err) {
      console.error(err);
      alert('Failed to generate token.');
    } finally {
      setAddingToken(false);
    }
  };

  const handleCallNext = async (appointmentId: string, finalFee: number) => {
    setAdvancingId(appointmentId);
    try {
      await advanceTokenQueue(id, appointmentId, finalFee);
    } catch (err) {
      console.error("Failed to advance queue", err);
    } finally {
      setAdvancingId(null);
    }
  };

  const openHistory = async () => {
    setShowHistory(true);
    setHistoryTab('LOG');
    setLoadingHistory(true);
    try {
      const data = await getClinicHistory(id, 5000); // Pull up to 5000 records for robust exports/analytics
      setHistoryData(data);
    } catch (err) {
      console.error("Failed to fetch history", err);
      // Fallback if index error
      alert("Failed to fetch history. Make sure Firebase Index is built.");
    } finally {
      setLoadingHistory(false);
    }
  };

  const handleLogout = async () => {
    await signOut(auth);
    router.push('/clinic/login');
  };

  if (loadingAuth || loadingConfig || loadingConfig2) {
    return (
      <div className="container" style={{ display: 'grid', placeItems: 'center', minHeight: '80vh' }}>
        <Loader2 size={40} className="animate-spin" style={{ color: 'var(--accent-primary)' }} />
      </div>
    );
  }

  if (error) {
    return (
      <div className="container" style={{ display: 'grid', placeItems: 'center', minHeight: '80vh' }}>
        <div className="glass-card" style={{ width: '100%', maxWidth: '400px', textAlign: 'center' }}>
          <p style={{ color: 'var(--danger)', marginBottom: '1rem' }}>{error}</p>
          <button onClick={() => router.push('/')} className="btn btn-outline" style={{ width: '100%' }}>Back to Directory</button>
        </div>
      </div>
    );
  }

  const isOpen = !!clinic.is_open;
  const currentServing = roster.length > 0 ? roster[0] : null;

  const filteredHistory = historyData.filter(app => 
    (app.patient_name || '').toLowerCase().includes(historySearch.toLowerCase()) ||
    (app.disease || '').toLowerCase().includes(historySearch.toLowerCase()) ||
    (app.token_number?.toString().includes(historySearch))
  );

  return (
    <>
      <div className="container fade-in" style={{ maxWidth: '1000px', width: '100%' }}>
        {/* Header */}
        <header className="header" style={{ textAlign: 'left', paddingBottom: '1.5rem' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '1rem' }}>
            <div>
              <h1 style={{ fontSize: '2rem', background: 'linear-gradient(to right, #00d2ff, #ffffff)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent', margin: 0 }}>
                {clinic.name}
              </h1>
              <p style={{ color: 'var(--text-secondary)', fontSize: '0.85rem', marginTop: '0.25rem' }}>
                Q-PULSE Medical Terminal
              </p>
            </div>
            <div style={{ display: 'flex', gap: '0.75rem', alignItems: 'center' }}>
              <button
                type="button"
                onClick={openHistory}
                className="btn btn-outline"
                style={{ fontSize: '0.85rem', display: 'flex', gap: '0.4rem', border: '1px solid var(--glass-border)' }}
              >
                <History size={15} /> Logs & Analytics
              </button>
              <button
                type="button"
                onClick={handleToggleStatus}
                className="btn"
                style={{
                  background: isOpen ? 'rgba(0, 230, 118, 0.1)' : 'rgba(255, 77, 77, 0.1)',
                  border: `1px solid ${isOpen ? 'rgba(0, 230, 118, 0.3)' : 'rgba(255, 77, 77, 0.3)'}`,
                  color: isOpen ? 'var(--success)' : 'var(--danger)',
                  fontWeight: 700,
                  fontSize: '0.85rem',
                }}
              >
                {isOpen ? <><Power size={15} /> Open</> : <><PowerOff size={15} /> Closed</>}
              </button>
              <button onClick={handleLogout} className="btn btn-outline" style={{ display: 'flex', gap: '0.4rem', fontSize: '0.85rem', color: 'var(--danger)', borderColor: 'rgba(255,77,77,0.3)' }}>
                <LogOut size={16} /> Logout
              </button>
            </div>
          </div>
        </header>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: '1.5rem', marginBottom: '2rem' }}>
          
          {/* Left Column: Info & Current Token */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
            
            <div className="glass-card" style={{ padding: '1.5rem' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
                <h3 style={{ margin: 0, fontSize: '0.9rem', textTransform: 'uppercase', letterSpacing: '0.1em', color: 'var(--text-secondary)' }}>
                  Clinic Info
                </h3>
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.9rem' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                  <div style={{ width: '32px', height: '32px', borderRadius: '8px', background: 'rgba(0,210,255,0.08)', border: '1px solid rgba(0,210,255,0.15)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    <MapPin size={14} color="var(--accent-primary)" />
                  </div>
                  <div>
                    <p style={{ margin: 0, fontSize: '0.7rem', color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Location</p>
                    <p style={{ margin: 0, fontWeight: 600 }}>{clinic.location || 'Not set'}</p>
                  </div>
                </div>

                <div style={{ display: 'flex', alignItems: 'flex-start', gap: '0.75rem' }}>
                  <div style={{ width: '32px', height: '32px', borderRadius: '8px', background: 'rgba(0,210,255,0.08)', border: '1px solid rgba(0,210,255,0.15)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                    <Stethoscope size={14} color="var(--accent-primary)" />
                  </div>
                  <div style={{ flex: 1 }}>
                    <p style={{ margin: 0, fontSize: '0.7rem', color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                      Primary Doctor
                    </p>
                    <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: '0.5rem' }}>
                      <div>
                        <p style={{ margin: 0, fontWeight: 700, color: 'var(--text-primary)' }}>{clinic.doctor_name || 'Not set'}</p>
                        <p style={{ margin: 0, fontSize: '0.8rem', color: 'var(--accent-primary)' }}>{clinic.dr_degree || 'MBBS, MD'}</p>
                        <p style={{ margin: 0, fontSize: '0.75rem', color: 'var(--text-secondary)' }}>{clinic.specialization || 'General Physician'}</p>
                      </div>
                      <button type="button" onClick={handleOpenEditProfile} className="btn btn-outline" style={{ fontSize: '0.7rem', padding: '0.3rem 0.5rem', minHeight: 'auto', display: 'flex', gap: '0.3rem' }}>
                        <Edit2 size={12} /> Edit Profile
                      </button>
                    </div>
                  </div>
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.5rem', marginTop: '0.5rem', fontSize: '0.8rem', color: 'var(--text-secondary)', background: 'rgba(255,255,255,0.02)', padding: '0.8rem', borderRadius: '8px', border: '1px dashed var(--glass-border)' }}>
                   <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}><IndianRupee size={12} color="var(--success)"/> {clinic.fees || '500'}</div>
                   <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}><Clock size={12} color="var(--accent-secondary)"/> {clinic.operating_hours || '10:00 AM - 6:00 PM'}</div>
                   <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', gridColumn: '1/-1' }}><Phone size={12} /> {clinic.phone_number || 'Not set'}</div>
                </div>
              </div>
            </div>

            <div className="glass-card" style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', padding: '3rem 2rem', border: '1px solid var(--accent-primary)' }}>
              <h2 style={{ color: 'var(--text-secondary)', textTransform: 'uppercase', marginBottom: '1rem', letterSpacing: '4px', fontSize: '0.85rem' }}>
                Currently Serving
              </h2>
              
              {currentServing ? (
                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', width: '100%' }}>
                  <span style={{ fontSize: '1.2rem', color: 'var(--accent-primary)', fontWeight: 700, marginBottom: '1rem' }}>
                    TOKEN #{currentServing.token_number}
                  </span>
                  
                  <div style={{ fontSize: '3rem', fontWeight: 'bold', textAlign: 'center', lineHeight: 1, textShadow: '0 0 40px rgba(0, 210, 255, 0.4)', color: 'var(--text-primary)', marginBottom: '0.5rem' }}>
                    {currentServing.patient_name}
                  </div>
                  <div style={{ color: 'var(--text-secondary)', marginBottom: '1.5rem' }}>
                    {currentServing.age} yrs · {currentServing.disease}
                  </div>

                  <div style={{ width: '100%', marginBottom: '1.5rem' }}>
                    <label style={{ fontSize: '0.7rem', color: 'var(--text-secondary)', textTransform: 'uppercase', marginBottom: '0.3rem', display: 'block' }}>Consultation Fee Charged (₹)</label>
                    <input
                      type="number"
                      className="input-field"
                      placeholder="e.g. 500"
                      onChange={(e) => {
                        (window as any)._tempFee = parseFloat(e.target.value) || 0;
                      }}
                      defaultValue={currentServing.fees || ''}
                      style={{ textAlign: 'center', fontSize: '1.2rem', padding: '0.8rem' }}
                    />
                  </div>

                  <button 
                    onClick={() => {
                        const fee = (window as any)._tempFee ?? currentServing.fees ?? 0;
                        handleCallNext(currentServing.id, fee);
                        (window as any)._tempFee = 0; // reset
                    }}
                    disabled={advancingId === currentServing.id || !isOpen}
                    className="btn btn-primary"
                    style={{ width: '100%', padding: '1rem', fontSize: '1.1rem', fontWeight: 700, display: 'flex', justifyContent: 'center', alignItems: 'center', gap: '0.5rem' }}
                  >
                    {advancingId === currentServing.id ? <Loader2 size={24} className="animate-spin" /> : <><Check size={24} /> Finish & Call Next</>}
                  </button>
                </div>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', padding: '2rem 0', opacity: 0.5 }}>
                  <Zap size={48} color="var(--text-secondary)" style={{ marginBottom: '1rem' }} />
                  <span style={{ fontSize: '1.2rem', color: 'var(--text-secondary)' }}>Queue Empty</span>
                </div>
              )}
            </div>
          </div>

          {/* Right Column: Walk-in Desk & Roster */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
            
            {/* Walk in Desk */}
            <div className="glass-card" style={{ padding: '1.5rem' }}>
              <h3 style={{ margin: '0 0 1rem 0', fontSize: '1rem', display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
                <UserPlus size={18} color="var(--accent-primary)" /> Generate Walk-In Token
              </h3>
              
              <form onSubmit={handleAddWalkIn} style={{ display: 'flex', flexDirection: 'column', gap: '0.8rem' }}>
                <input 
                  type="text" 
                  className="input-field" 
                  placeholder="Patient Full Name" 
                  value={patientName} 
                  onChange={e => setPatientName(e.target.value)} 
                  required 
                  disabled={!isOpen || addingToken}
                />
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.8rem' }}>
                  <input 
                    type="number" 
                    className="input-field" 
                    placeholder="Age" 
                    value={patientAge} 
                    onChange={e => setPatientAge(e.target.value)} 
                    disabled={!isOpen || addingToken}
                  />
                  <input 
                    type="number" 
                    className="input-field" 
                    placeholder="Fees Paid (₹)" 
                    value={fees} 
                    onChange={e => setFees(e.target.value)} 
                    disabled={!isOpen || addingToken}
                  />
                </div>
                <input 
                  type="text" 
                  className="input-field" 
                  placeholder="Medical Issue / Disease" 
                  value={disease} 
                  onChange={e => setDisease(e.target.value)} 
                  disabled={!isOpen || addingToken}
                />
                <button 
                  type="submit" 
                  className="btn btn-outline" 
                  style={{ marginTop: '0.5rem' }}
                  disabled={!isOpen || addingToken || !patientName}
                >
                  {addingToken ? <Loader2 size={16} className="animate-spin" /> : <><FileText size={16} /> Print Token</>}
                </button>
              </form>
            </div>

            {/* Roster */}
            <div className="glass-card" style={{ padding: '1.5rem', flex: 1 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
                <h3 style={{ margin: 0, fontSize: '1rem', textTransform: 'uppercase', letterSpacing: '0.1em' }}>
                  Live Roster
                </h3>
                <span className="badge badge-live" style={{ background: 'rgba(0,210,255,0.1)', color: 'var(--accent-primary)' }}>
                  {roster.length} Waiting
                </span>
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.6rem', maxHeight: '400px', overflowY: 'auto', paddingRight: '0.5rem' }}>
                {roster.length === 0 ? (
                  <div style={{ padding: '2rem 0', textAlign: 'center', color: 'var(--text-secondary)', fontSize: '0.85rem' }}>
                    No appointments running.
                  </div>
                ) : (
                  roster.map((app, index) => {
                    const isNext = index === 0;
                    return (
                      <div 
                        key={app.id} 
                        style={{ 
                          padding: '1rem', 
                          background: isNext ? 'rgba(0, 210, 255, 0.08)' : 'rgba(255,255,255,0.03)', 
                          borderRadius: '8px',
                          borderLeft: isNext ? '4px solid var(--accent-primary)' : '4px solid transparent',
                          display: 'flex',
                          justifyContent: 'space-between',
                          alignItems: 'center'
                        }}
                      >
                        <div>
                          <h4 style={{ margin: '0 0 0.25rem 0', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                            {app.patient_name} 
                            {isNext && <span style={{ fontSize: '0.6rem', background: 'var(--accent-primary)', color: 'black', padding: '2px 6px', borderRadius: '12px', fontWeight: 800 }}>SERVING</span>}
                          </h4>
                          <span style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>{app.age}yrs · {app.disease}</span>
                        </div>
                        <div style={{ fontSize: '1.2rem', fontWeight: 800, color: 'var(--text-secondary)' }}>
                          #{app.token_number}
                        </div>
                      </div>
                    );
                  })
                )}
              </div>
            </div>

          </div>
        </div>
      </div>

      {/* History Modal Overlay */}
      {showHistory && (
        <div style={{
          position: 'fixed', top: 0, left: 0, width: '100%', height: '100%',
          background: 'rgba(0,0,0,0.85)', backdropFilter: 'blur(10px)',
          zIndex: 9999, display: 'flex', justifyContent: 'center', alignItems: 'center', padding: '1rem'
        }}>
          <div className="glass-card fade-in" style={{ width: '100%', maxWidth: '800px', maxHeight: '90vh', display: 'flex', flexDirection: 'column', padding: 0, overflow: 'hidden' }}>
            
            {/* Modal Header & Tabs */}
            <div style={{ padding: '1.5rem', borderBottom: '1px solid var(--glass-border)' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
                <h2 style={{ margin: 0, fontSize: '1.2rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                  <History size={20} color="var(--accent-primary)" /> Clinic Logs & Analytics
                </h2>
                <div style={{ display: 'flex', gap: '0.5rem' }}>
                  <button onClick={exportToExcel} className="btn btn-outline" style={{ padding: '0.4rem 0.8rem', fontSize: '0.8rem', color: 'var(--success)', borderColor: 'var(--success)' }}>
                    Download .CSV
                  </button>
                  <button onClick={() => setShowHistory(false)} className="btn btn-outline" style={{ padding: '0.4rem', minWidth: 'auto', border: 'none', color: 'var(--text-secondary)' }}>
                    <X size={20} />
                  </button>
                </div>
              </div>
              
              <div style={{ display: 'flex', gap: '1rem' }}>
                 <button 
                   onClick={() => setHistoryTab('LOG')}
                   style={{ background: 'none', border: 'none', padding: '0.5rem 0', color: historyTab === 'LOG' ? 'var(--accent-primary)' : 'var(--text-secondary)', fontWeight: 700, borderBottom: historyTab === 'LOG' ? '2px solid var(--accent-primary)' : '2px solid transparent', cursor: 'pointer', transition: 'all 0.2s' }}
                 >
                   Patient Log
                 </button>
                 <button 
                   onClick={() => setHistoryTab('ANALYTICS')}
                   style={{ background: 'none', border: 'none', padding: '0.5rem 0', color: historyTab === 'ANALYTICS' ? 'var(--accent-primary)' : 'var(--text-secondary)', fontWeight: 700, borderBottom: historyTab === 'ANALYTICS' ? '2px solid var(--accent-primary)' : '2px solid transparent', cursor: 'pointer', transition: 'all 0.2s' }}
                 >
                   Financial Analytics
                 </button>
              </div>
            </div>

            {/* Modal Body */}
            <div style={{ padding: '1.5rem', flex: 1, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
              
              {loadingHistory ? (
                <div style={{ textAlign: 'center', padding: '3rem' }}>
                  <Loader2 size={30} className="animate-spin" style={{ color: 'var(--accent-primary)', margin: '0 auto 1rem' }} />
                  <p style={{ color: 'var(--text-secondary)' }}>Securely fetching clinic data...</p>
                </div>
              ) : historyTab === 'LOG' ? (
                // PATIENT LOG TAB
                <>
                  <div style={{ position: 'relative' }}>
                    <Search style={{ position: 'absolute', left: '1rem', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-secondary)' }} size={18} />
                    <input 
                      type="text" className="input-field"
                      placeholder="Search previous patients by name, token, or disease..."
                      value={historySearch} onChange={(e) => setHistorySearch(e.target.value)}
                      style={{ paddingLeft: '2.8rem' }}
                    />
                  </div>

                  {filteredHistory.length === 0 ? (
                    <div style={{ textAlign: 'center', padding: '3rem', color: 'var(--text-secondary)' }}>
                      No historical records found for this criteria.
                    </div>
                  ) : (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                      {filteredHistory.map(record => {
                        const dateObj = record.created_at?.toDate ? record.created_at.toDate() : new Date();
                        return (
                          <div key={record.id} style={{ 
                            display: 'grid', gridTemplateColumns: '1fr 2fr 1fr', gap: '1rem', padding: '1rem', 
                            background: 'var(--glass-base)', borderRadius: '8px', border: '1px solid var(--glass-border)', alignItems: 'center'
                          }}>
                            <div>
                              <p style={{ margin: 0, fontWeight: 700, color: 'var(--text-primary)' }}>{record.patient_name}</p>
                              <p style={{ margin: 0, fontSize: '0.75rem', color: 'var(--text-secondary)' }}>{record.disease} · {record.age}yrs</p>
                            </div>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '2rem', fontSize: '0.85rem' }}>
                               <div>
                                 <span style={{ color: 'var(--text-secondary)', display: 'block', fontSize: '0.7rem', textTransform: 'uppercase' }}>Token Ref</span>
                                 #{record.token_number}
                               </div>
                               <div>
                                 <span style={{ color: 'var(--text-secondary)', display: 'block', fontSize: '0.7rem', textTransform: 'uppercase' }}>Fees Paid</span>
                                 ₹{record.fees || '0'}
                               </div>
                            </div>
                            <div style={{ textAlign: 'right', fontSize: '0.8rem', color: 'var(--text-secondary)' }}>
                               <p style={{ margin: '0 0 0.2rem 0' }}>{dateObj.toLocaleDateString()}</p>
                               <p style={{ margin: 0 }}>{dateObj.toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}</p>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </>
              ) : (
                // ANALYTICS TAB
                <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
                  
                  {/* Metric Cards */}
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
                     <div style={{ background: 'var(--glass-base)', padding: '1.5rem', borderRadius: '12px', border: '1px solid var(--glass-border)' }}>
                        <p style={{ margin: '0 0 0.5rem 0', color: 'var(--text-secondary)', fontSize: '0.85rem', textTransform: 'uppercase', fontWeight: 600 }}>Total Revenue (All Time)</p>
                        <h3 style={{ margin: 0, fontSize: '2rem', color: 'var(--success)' }}>
                           ₹{historyData.reduce((sum, r) => sum + (Number(r.fees) || 0), 0).toLocaleString()}
                        </h3>
                     </div>
                     <div style={{ background: 'var(--glass-base)', padding: '1.5rem', borderRadius: '12px', border: '1px solid var(--glass-border)' }}>
                        <p style={{ margin: '0 0 0.5rem 0', color: 'var(--text-secondary)', fontSize: '0.85rem', textTransform: 'uppercase', fontWeight: 600 }}>Total Patients Served</p>
                        <h3 style={{ margin: 0, fontSize: '2rem', color: 'var(--accent-primary)' }}>
                           {historyData.length}
                        </h3>
                     </div>
                  </div>

                  {/* Recent 7 Days Chart */}
                  <div style={{ background: 'var(--glass-base)', padding: '1.5rem', borderRadius: '12px', border: '1px solid var(--glass-border)' }}>
                     <h3 style={{ margin: '0 0 1rem 0', fontSize: '1rem', color: 'var(--text-primary)' }}>7-Day Patient Volume</h3>
                     <div style={{ display: 'flex', alignItems: 'flex-end', gap: '0.5rem', height: '150px', marginTop: '1rem' }}>
                        {(() => {
                           const last7Days = Array.from({length: 7}).map((_, i) => {
                             const d = new Date(); d.setDate(d.getDate() - i); return d.toLocaleDateString();
                           }).reverse();
                           
                           const volumes = last7Days.map(dateStr => {
                             const count = historyData.filter(r => {
                               const d = r.created_at?.toDate ? r.created_at.toDate() : new Date();
                               return d.toLocaleDateString() === dateStr;
                             }).length;
                             return { date: dateStr.split('/')[0] + '/' + dateStr.split('/')[1], count }; 
                           });
                           const maxVol = Math.max(...volumes.map(v => v.count), 1);
                           
                           return volumes.map((vol, idx) => (
                             <div key={idx} style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '0.5rem' }}>
                                <div style={{ fontSize: '0.75rem', color: 'var(--accent-primary)', fontWeight: 700 }}>{vol.count > 0 ? vol.count : ''}</div>
                                <div style={{ width: '100%', maxWidth: '30px', background: vol.count > 0 ? 'var(--accent-primary)' : 'rgba(255,255,255,0.05)', height: `${(vol.count / maxVol) * 100}%`, minHeight: '4px', borderRadius: '4px 4px 0 0', transition: 'height 0.5s ease' }}></div>
                                <div style={{ fontSize: '0.65rem', color: 'var(--text-secondary)' }}>{vol.date}</div>
                             </div>
                           ));
                        })()}
                     </div>
                  </div>

                </div>
              )}
            </div>

          </div>
        </div>
      )}

      {/* Edit Profile Modal Overlay */}
      {showEditProfile && (
        <div style={{
          position: 'fixed', top: 0, left: 0, width: '100%', height: '100%',
          background: 'rgba(0,0,0,0.85)', backdropFilter: 'blur(10px)',
          zIndex: 9999, display: 'flex', justifyContent: 'center', alignItems: 'center', padding: '1rem'
        }}>
          <div className="glass-card fade-in" style={{ width: '100%', maxWidth: '500px', display: 'flex', flexDirection: 'column', padding: 0, overflow: 'hidden' }}>
            
            <div style={{ padding: '1.5rem', borderBottom: '1px solid var(--glass-border)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <h2 style={{ margin: 0, fontSize: '1.2rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <Edit2 size={20} color="var(--accent-primary)" /> Edit Clinic Profile
              </h2>
              <button 
                onClick={() => setShowEditProfile(false)} 
                className="btn btn-outline" 
                style={{ padding: '0.5rem', minWidth: 'auto', border: 'none', color: 'var(--text-secondary)' }}
              >
                <X size={24} />
              </button>
            </div>

            <form onSubmit={handleSaveProfile} style={{ padding: '1.5rem', display: 'flex', flexDirection: 'column', gap: '1rem' }}>
              
              <div>
                <label style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', textTransform: 'uppercase', marginBottom: '0.3rem', display: 'block' }}>Primary Doctor Name</label>
                <input 
                  type="text" className="input-field" required
                  value={editData.doctor_name} onChange={e => setEditData({...editData, doctor_name: e.target.value})}
                  placeholder="e.g. Dr. John Smith"
                />
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
                <div>
                  <label style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', textTransform: 'uppercase', marginBottom: '0.3rem', display: 'block' }}>Degrees Prefix</label>
                  <input 
                    type="text" className="input-field" 
                    value={editData.dr_degree} onChange={e => setEditData({...editData, dr_degree: e.target.value})}
                    placeholder="e.g. MBBS, MD"
                  />
                </div>
                <div>
                  <label style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', textTransform: 'uppercase', marginBottom: '0.3rem', display: 'block' }}>Specialization</label>
                  <input 
                    type="text" className="input-field" 
                    value={editData.specialization} onChange={e => setEditData({...editData, specialization: e.target.value})}
                    placeholder="e.g. Cardiologist"
                  />
                </div>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
                <div>
                  <label style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', textTransform: 'uppercase', marginBottom: '0.3rem', display: 'block' }}>Contact Phone</label>
                  <input 
                    type="text" className="input-field" 
                    value={editData.phone_number} onChange={e => setEditData({...editData, phone_number: e.target.value})}
                    placeholder="+91..."
                  />
                </div>
                <div>
                  <label style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', textTransform: 'uppercase', marginBottom: '0.3rem', display: 'block' }}>Consultation Fee (₹)</label>
                  <input 
                    type="number" className="input-field" 
                    value={editData.fees} onChange={e => setEditData({...editData, fees: e.target.value})}
                    placeholder="500"
                  />
                </div>
              </div>

              <div>
                <label style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', textTransform: 'uppercase', marginBottom: '0.3rem', display: 'block' }}>Operating Schedule</label>
                <input 
                  type="text" className="input-field" 
                  value={editData.operating_hours} onChange={e => setEditData({...editData, operating_hours: e.target.value})}
                  placeholder="e.g. Mon-Sat: 10:00 AM - 6:00 PM"
                />
              </div>

              <button type="submit" className="btn btn-primary" disabled={savingProfile} style={{ marginTop: '1rem', padding: '1rem' }}>
                {savingProfile ? <Loader2 size={18} className="animate-spin" /> : 'Save Profile Changes'}
              </button>

            </form>
          </div>
        </div>
      )}
    </>
  );
}
