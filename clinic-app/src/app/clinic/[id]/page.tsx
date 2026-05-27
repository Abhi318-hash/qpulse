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
  updateClinicProfile,
  getClinicHistory
} from '@/lib/actions';
import { checkIsAdmin } from '@/lib/adminAuth';
import { 
  findOrCreatePatientByPhone, 
  createMedicalRecord, 
  uploadFileToStorage 
} from '@/lib/patientActions';
import { 
  Plus, Power, PowerOff, Check, X, MapPin, Stethoscope,
  Edit2, Loader2, LogOut, FileText, UserPlus, Zap, History,
  Search, Phone, Clock, IndianRupee, Printer, GraduationCap,
  ChevronRight, Users, TrendingUp
} from 'lucide-react';
import { QRCodeSVG } from 'qrcode.react';
import Link from 'next/link';
import DoctorAvatar from '@/components/DoctorAvatar';

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

  // Walk-in Patient Form (Phase 2: added walkInPhone for SMS notifications)
  const [patientName, setPatientName] = useState('');
  const [patientAge, setPatientAge] = useState('');
  const [fees, setFees] = useState('');
  const [disease, setDisease] = useState('');
  const [walkInPhone, setWalkInPhone] = useState(''); // Phase 2: optional SMS
  const [addingToken, setAddingToken] = useState(false);
  const [isAdminUser, setIsAdminUser] = useState(false);

  // Complete Visit (EHR) Modal State
  const [showCompleteModal, setShowCompleteModal] = useState(false);
  const [modalDiagnosis, setModalDiagnosis] = useState('');
  const [modalChiefComplaint, setModalChiefComplaint] = useState('');
  const [modalBpSystolic, setModalBpSystolic] = useState('');
  const [modalBpDiastolic, setModalBpDiastolic] = useState('');
  const [modalHeartRate, setModalHeartRate] = useState('');
  const [modalTemp, setModalTemp] = useState('');
  const [modalWeight, setModalWeight] = useState('');
  const [modalSpo2, setModalSpo2] = useState('');
  const [modalMedications, setModalMedications] = useState<{ name: string; dosage: string; duration: string; instructions: string }[]>([{ name: '', dosage: '', duration: '', instructions: '' }]);
  const [modalTests, setModalTests] = useState('');
  const [modalFollowUp, setModalFollowUp] = useState('');
  const [modalNotes, setModalNotes] = useState('');
  const [modalFee, setModalFee] = useState('');
  const [modalPaymentMode, setModalPaymentMode] = useState('cash');
  const [modalPrescriptionFile, setModalPrescriptionFile] = useState<File | null>(null);
  const [isCompleting, setIsCompleting] = useState(false);

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
      alert('No data available to export.');
      return;
    }
    const headers = ['Date', 'Time', 'Patient Name', 'Phone Number', 'Age', 'Medical Issue', 'Fees Paid (INR)', 'Token Ref'];
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
    const csvContent = 'data:text/csv;charset=utf-8,' + [headers.join(','), ...rows].join('\n');
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute('download', `QPULSE_Export_${clinic?.name?.replace(/\s+/g, '_')}_${new Date().toLocaleDateString().replace(/\//g, '-')}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  useEffect(() => {
    let unsubscribeData: () => void;
    let unsubscribeRoster: () => void;
    const unsubscribeAuth = onAuthStateChanged(auth, async (user) => {
      if (!user) {
        router.push('/clinic/login');
        return;
      }
      setLoadingAuth(false);

      // Check admin status (for override access)
      const adminStatus = await checkIsAdmin(user.phoneNumber);
      setIsAdminUser(adminStatus);

      unsubscribeData = subscribeToSingleClinic(id, (data) => {
        if (!data) {
          setError('Clinic not found.');
        } else if (
          data.authorized_phone &&
          data.authorized_phone !== user.phoneNumber &&
          !adminStatus
        ) {
          setError('ACCESS DENIED: Your phone number is not authorized to manage this clinic.');
        } else {
          setClinic(data);
          setError('');
        }
        setLoadingConfig(false);
      });
      unsubscribeRoster = subscribeToClinicRoster(id, (apps) => {
        setRoster(apps);
        setLoadingConfig2(false);
      });
    });
    return () => {
      unsubscribeAuth();
      if (unsubscribeData) unsubscribeData();
      if (unsubscribeRoster) unsubscribeRoster();
    };
  }, [id, router]);

  const handleToggleStatus = async () => {
    if (!clinic) return;
    try { await toggleClinicStatus(id, clinic.is_open); }
    catch { alert('Failed to update status.'); }
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
      // Clean & format optional walk-in phone for SMS notifications (Phase 2)
      let cleanPhone = '';
      if (walkInPhone) {
        const stripped = walkInPhone.replace(/[^0-9+]/g, '');
        cleanPhone = stripped.startsWith('+') ? stripped : `+91${stripped}`;
      }
      await addPatientToken(
        id,
        patientName,
        parseInt(patientAge) || 0,
        parseFloat(fees) || 0,
        disease || 'General',
        cleanPhone,
        'staff'
      );
      setPatientName(''); setPatientAge(''); setFees(''); setDisease(''); setWalkInPhone('');
    } catch (err) {
      console.error(err);
      alert('Failed to generate token.');
    } finally {
      setAddingToken(false);
    }
  };

  const handleCompleteVisitSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!currentServing || !clinic) return;
    setIsCompleting(true);

    try {
      // 1. Get patient ID via phone or generate anonymous
      const patientId = await findOrCreatePatientByPhone(
        currentServing.user_phone,
        currentServing.patient_name
      );

      // 2. Upload prescription file if present
      const prescriptionUrls: string[] = [];
      if (modalPrescriptionFile) {
        const { downloadUrl } = await uploadFileToStorage(
          patientId,
          modalPrescriptionFile,
          'prescriptions'
        );
        prescriptionUrls.push(downloadUrl);
      }

      // 3. Construct record data
      const recordData = {
        doctorName: clinic.doctor_name || 'Doctor',
        specialization: clinic.specialization || 'General Physician',
        chiefComplaint: modalChiefComplaint || currentServing.disease || 'General Checkup',
        diagnosis: modalDiagnosis || 'Healthy checkup',
        vitals: {
          ...(modalBpSystolic ? { bpSystolic: parseInt(modalBpSystolic) } : {}),
          ...(modalBpDiastolic ? { bpDiastolic: parseInt(modalBpDiastolic) } : {}),
          ...(modalHeartRate ? { heartRate: parseInt(modalHeartRate) } : {}),
          ...(modalTemp ? { temperature: parseFloat(modalTemp) } : {}),
          ...(modalWeight ? { weightKg: parseFloat(modalWeight) } : {}),
          ...(modalSpo2 ? { spo2: parseInt(modalSpo2) } : {}),
        },
        medications: modalMedications.filter(m => m.name.trim() !== ''),
        testsOrdered: modalTests ? modalTests.split(',').map(t => t.trim()).filter(t => t !== '') : [],
        followUpDate: modalFollowUp,
        doctorNotes: modalNotes,
        consultationFee: parseFloat(modalFee) || clinic.fees || 0,
        paymentMode: modalPaymentMode,
        prescriptionImageUrls: prescriptionUrls,
      };

      // 4. Create medical record
      await createMedicalRecord(patientId, currentServing.id, id, recordData);

      // 5. Advance token queue
      await advanceTokenQueue(id, currentServing.id, recordData.consultationFee);

      // Reset states
      setShowCompleteModal(false);
      setModalDiagnosis('');
      setModalChiefComplaint('');
      setModalBpSystolic('');
      setModalBpDiastolic('');
      setModalHeartRate('');
      setModalTemp('');
      setModalWeight('');
      setModalSpo2('');
      setModalMedications([{ name: '', dosage: '', duration: '', instructions: '' }]);
      setModalTests('');
      setModalFollowUp('');
      setModalNotes('');
      setModalFee('');
      setModalPrescriptionFile(null);

      alert('Visit completed and medical record generated successfully!');
    } catch (err: any) {
      console.error(err);
      alert(`Failed to complete visit: ${err.message || 'Unknown error'}`);
    } finally {
      setIsCompleting(false);
    }
  };

  const openHistory = async () => {
    setShowHistory(true); setHistoryTab('LOG'); setLoadingHistory(true);
    try {
      const data = await getClinicHistory(id, 5000);
      setHistoryData(data);
    } catch (err) {
      console.error('Failed to fetch history', err);
      alert('Failed to fetch history. Make sure Firebase Index is built.');
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
      <div className="portal-clinical" style={{ display: 'grid', placeItems: 'center', minHeight: '100vh' }}>
        <div style={{ textAlign: 'center' }}>
          <Loader2 size={40} className="animate-spin" style={{ color: '#007BFF', margin: '0 auto 1rem' }} />
          <p style={{ color: '#5a6a7e', fontWeight: 500 }}>Loading your clinic…</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="portal-clinical" style={{ display: 'grid', placeItems: 'center', minHeight: '100vh' }}>
        <div className="clinic-card" style={{ width: '100%', maxWidth: '400px', textAlign: 'center', padding: '2.5rem' }}>
          <p style={{ color: '#dc3545', marginBottom: '1.5rem', fontWeight: 600 }}>{error}</p>
          <button onClick={() => router.push('/')} className="btn btn-primary" style={{ width: '100%' }}>Back to Directory</button>
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

  // ─── RENDER ───────────────────────────────────────────────────────────────
  return (
    <>
      <div className="portal-clinical no-print fade-in" style={{ minHeight: '100vh' }}>
        
        {/* ── TOP NAV BAR ─────────────────────────────────────────── */}
        <header style={{
          background: 'rgba(255,255,255,0.96)',
          backdropFilter: 'blur(12px)',
          borderBottom: '1px solid rgba(0,0,0,0.08)',
          padding: '0 2rem',
          position: 'sticky', top: 0, zIndex: 100,
          boxShadow: '0 1px 8px rgba(0,0,0,0.06)',
        }}>
          <div style={{
            maxWidth: 1100, margin: '0 auto',
            display: 'flex', alignItems: 'center',
            justifyContent: 'space-between',
            height: 64, gap: '1rem'
          }}>
            {/* Left: Clinic name + breadcrumb */}
            <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
              <Link href="/clinic" style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', color: '#5a6a7e', fontSize: '0.85rem' }}>
                <Stethoscope size={16} color="#007BFF" />
                <span>My Clinics</span>
              </Link>
              <ChevronRight size={14} color="#ccc" />
              <span style={{ fontWeight: 700, color: '#1a2332', fontSize: '0.95rem' }}>{clinic.name}</span>
            </div>

            {/* Right: action buttons */}
            <div style={{ display: 'flex', gap: '0.6rem', alignItems: 'center' }}>
              <button type="button" onClick={() => window.print()} className="btn btn-outline"
                style={{ fontSize: '0.8rem', padding: '0.5rem 0.9rem', color: '#5a6a7e' }}>
                <Printer size={14} /> QR Print
              </button>
              <button type="button" onClick={openHistory} className="btn btn-outline"
                style={{ fontSize: '0.8rem', padding: '0.5rem 0.9rem', color: '#5a6a7e' }}>
                <History size={14} /> Logs
              </button>
              <button onClick={handleToggleStatus} className="btn" style={{
                fontSize: '0.8rem', padding: '0.5rem 1rem', fontWeight: 700,
                background: isOpen ? 'rgba(40,167,69,0.1)' : 'rgba(220,53,69,0.1)',
                color: isOpen ? '#28a745' : '#dc3545',
                border: `1px solid ${isOpen ? 'rgba(40,167,69,0.3)' : 'rgba(220,53,69,0.3)'}`,
              }}>
                {isOpen ? <><Power size={14} /> Open</> : <><PowerOff size={14} /> Closed</>}
              </button>
              <button onClick={handleLogout} className="btn btn-outline"
                style={{ fontSize: '0.8rem', padding: '0.5rem 0.9rem', color: '#dc3545', borderColor: 'rgba(220,53,69,0.3)' }}>
                <LogOut size={14} />
              </button>
            </div>
          </div>
        </header>

        {/* ── PAGE BODY ────────────────────────────────────────────── */}
        <div className="container" style={{ maxWidth: 1080, paddingTop: '2rem' }}>
          
          {/* Stats strip */}
          <div style={{
            display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))',
            gap: '1rem', marginBottom: '2rem'
          }}>
            {[
              { label: 'Patients Waiting', value: roster.length, icon: <Users size={18} color="#007BFF" />, color: '#007BFF' },
              { label: 'Serving Token', value: currentServing ? `#${currentServing.token_number}` : '—', icon: <Stethoscope size={18} color="#28a745" />, color: '#28a745' },
              { label: 'Total Issued Today', value: clinic.last_issued_token || 0, icon: <TrendingUp size={18} color="#6f42c1" />, color: '#6f42c1' },
              { label: 'Queue Status', value: isOpen ? 'Open' : 'Closed', icon: isOpen ? <Power size={18} color="#28a745" /> : <PowerOff size={18} color="#dc3545" />, color: isOpen ? '#28a745' : '#dc3545' },
            ].map((stat, i) => (
              <div key={i} className="clinic-card" style={{ padding: '1.25rem 1.5rem' }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '0.5rem' }}>
                  <span style={{ fontSize: '0.78rem', color: '#5a6a7e', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em' }}>{stat.label}</span>
                  <div style={{ padding: '0.4rem', background: `${stat.color}12`, borderRadius: '8px' }}>{stat.icon}</div>
                </div>
                <p style={{ margin: 0, fontSize: '1.6rem', fontWeight: 800, color: stat.color, lineHeight: 1 }}>{stat.value}</p>
              </div>
            ))}
          </div>

          {/* Main 2-column grid */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: '1.5rem' }}>

            {/* ── LEFT COLUMN ─────────────────────────────────────── */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>

              {/* Doctor Profile Card */}
              <div className="clinic-card" style={{ padding: '2rem' }}>
                {/* Avatar + doctor info */}
                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', textAlign: 'center', marginBottom: '1.5rem' }}>
                  <DoctorAvatar
                    clinicId={id}
                    imageUrl={clinic.doctor_image_url}
                    doctorName={clinic.doctor_name || 'Doctor'}
                    editable={true}
                    size={110}
                  />
                  <div style={{ marginTop: '1rem' }}>
                    <h2 style={{ margin: '0 0 0.25rem 0', fontSize: '1.25rem', color: '#1a2332', fontWeight: 700 }}>
                      {clinic.doctor_name || 'Doctor Name'}
                    </h2>
                    <p style={{ margin: '0 0 0.2rem 0', fontSize: '0.85rem', color: '#007BFF', fontWeight: 600 }}>
                      {clinic.dr_degree || 'MBBS, MD'}
                    </p>
                    <p style={{ margin: 0, fontSize: '0.8rem', color: '#5a6a7e' }}>
                      {clinic.specialization || 'General Physician'}
                    </p>
                  </div>
                </div>

                {/* Clinic details grid */}
                <div style={{
                  display: 'grid', gridTemplateColumns: '1fr 1fr',
                  gap: '0.75rem', marginBottom: '1.25rem'
                }}>
                  {[
                    { icon: <MapPin size={13} color="#007BFF" />, label: 'Location', value: clinic.location || 'Not set' },
                    { icon: <Phone size={13} color="#007BFF" />, label: 'Phone', value: clinic.phone_number || 'Not set' },
                    { icon: <Clock size={13} color="#007BFF" />, label: 'Hours', value: clinic.operating_hours || '10 AM – 6 PM' },
                    { icon: <IndianRupee size={13} color="#28a745" />, label: 'Fees', value: `₹${clinic.fees || '500'}` },
                  ].map((item, i) => (
                    <div key={i} style={{
                      padding: '0.75rem', background: '#f8fafc',
                      borderRadius: '10px', border: '1px solid #eef0f3'
                    }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.35rem', marginBottom: '0.3rem' }}>
                        {item.icon}
                        <span style={{ fontSize: '0.65rem', color: '#5a6a7e', textTransform: 'uppercase', letterSpacing: '0.05em', fontWeight: 700 }}>{item.label}</span>
                      </div>
                      <p style={{ margin: 0, fontSize: '0.82rem', fontWeight: 600, color: '#1a2332' }}>{item.value}</p>
                    </div>
                  ))}
                </div>

                <button onClick={handleOpenEditProfile} className="btn btn-outline" style={{
                  width: '100%', fontSize: '0.85rem', color: '#007BFF',
                  borderColor: 'rgba(0,123,255,0.3)',
                }}>
                  <Edit2 size={14} /> Edit Clinic Profile
                </button>
              </div>

              {/* Currently Serving */}
              <div className="clinic-card" style={{
                padding: '2rem', textAlign: 'center',
                borderTop: '3px solid #007BFF',
              }}>
                <p className="section-label" style={{ color: '#007BFF', marginBottom: '1.5rem' }}>
                  Currently Serving
                </p>

                {currentServing ? (
                  <div>
                    <div style={{
                      display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
                      width: 64, height: 64, borderRadius: '50%',
                      background: 'linear-gradient(135deg, #007BFF, #0056CC)',
                      color: 'white', fontSize: '1.3rem', fontWeight: 800,
                      marginBottom: '0.75rem', boxShadow: '0 4px 16px rgba(0,123,255,0.35)'
                    }}>
                      #{currentServing.token_number}
                    </div>
                    <h3 style={{ margin: '0 0 0.3rem 0', fontSize: '1.5rem', color: '#1a2332', fontWeight: 800 }}>
                      {currentServing.patient_name}
                    </h3>
                    <p style={{ margin: '0 0 1.5rem 0', color: '#5a6a7e', fontSize: '0.9rem' }}>
                      {currentServing.age} yrs &nbsp;·&nbsp; {currentServing.disease}
                    </p>

                    <button
                      onClick={() => {
                        setModalFee(currentServing.fees || clinic.fees || '500');
                        setModalChiefComplaint(currentServing.disease || '');
                        setShowCompleteModal(true);
                      }}
                      disabled={!isOpen}
                      className="btn btn-primary"
                      style={{ width: '100%', padding: '0.9rem', fontSize: '1rem', fontWeight: 700 }}
                    >
                      <Check size={20} /> Complete Visit (EHR)
                    </button>
                  </div>
                ) : (
                  <div style={{ padding: '2rem 0', opacity: 0.45 }}>
                    <Zap size={44} color="#5a6a7e" style={{ marginBottom: '0.75rem' }} />
                    <p style={{ color: '#5a6a7e', fontSize: '1rem' }}>Queue is Empty</p>
                  </div>
                )}
              </div>
            </div>

            {/* ── RIGHT COLUMN ────────────────────────────────────── */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>

              {/* Walk-in Token Desk */}
              <div className="clinic-card" style={{ padding: '1.75rem' }}>
                <h3 style={{ margin: '0 0 1.25rem 0', fontSize: '1rem', display: 'flex', gap: '0.5rem', alignItems: 'center', color: '#1a2332' }}>
                  <div style={{ padding: '0.5rem', background: 'rgba(0,123,255,0.1)', borderRadius: '8px' }}>
                    <UserPlus size={18} color="#007BFF" />
                  </div>
                  Generate Walk-In Token
                </h3>

                <form onSubmit={handleAddWalkIn} style={{ display: 'flex', flexDirection: 'column', gap: '0.8rem' }}>
                  <input type="text" className="input-field"
                    placeholder="Patient Full Name"
                    value={patientName} onChange={e => setPatientName(e.target.value)}
                    required disabled={!isOpen || addingToken}
                  />
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.8rem' }}>
                    <input type="number" className="input-field"
                      placeholder="Age"
                      value={patientAge} onChange={e => setPatientAge(e.target.value)}
                      disabled={!isOpen || addingToken}
                    />
                    <input type="number" className="input-field"
                      placeholder="Fees Paid (₹)"
                      value={fees} onChange={e => setFees(e.target.value)}
                      disabled={!isOpen || addingToken}
                    />
                  </div>
                  <input type="text" className="input-field"
                    placeholder="Medical Issue / Disease"
                    value={disease} onChange={e => setDisease(e.target.value)}
                    disabled={!isOpen || addingToken}
                  />
                  <input type="tel" className="input-field"
                    placeholder="Patient Phone (optional — for SMS alerts)"
                    value={walkInPhone} onChange={e => setWalkInPhone(e.target.value)}
                    disabled={!isOpen || addingToken}
                    style={{ fontSize: '0.88rem' }}
                  />
                  <button type="submit" className="btn btn-primary"
                    disabled={!isOpen || addingToken || !patientName}
                    style={{ marginTop: '0.3rem' }}
                  >
                    {addingToken
                      ? <Loader2 size={16} className="animate-spin" />
                      : <><FileText size={16} /> Issue Token</>}
                  </button>
                  {!isOpen && (
                    <p style={{ textAlign: 'center', color: '#dc3545', fontSize: '0.8rem', fontWeight: 600 }}>
                      Clinic is closed — open it to issue tokens.
                    </p>
                  )}
                </form>
              </div>

              {/* Live Roster */}
              <div className="clinic-card" style={{ padding: '1.75rem', flex: 1 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.25rem' }}>
                  <h3 style={{ margin: 0, fontSize: '1rem', color: '#1a2332', display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
                    <div style={{ padding: '0.5rem', background: 'rgba(0,123,255,0.1)', borderRadius: '8px' }}>
                      <Users size={18} color="#007BFF" />
                    </div>
                    Live Roster
                  </h3>
                  <span style={{
                    background: 'rgba(0,123,255,0.1)', color: '#007BFF',
                    padding: '0.3rem 0.8rem', borderRadius: '20px',
                    fontSize: '0.78rem', fontWeight: 700
                  }}>
                    {roster.length} waiting
                  </span>
                </div>

                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.6rem', maxHeight: 380, overflowY: 'auto' }}>
                  {roster.length === 0 ? (
                    <div style={{ padding: '2.5rem 0', textAlign: 'center', color: '#5a6a7e', fontSize: '0.9rem' }}>
                      No patients in queue.
                    </div>
                  ) : (
                    roster.map((app, index) => {
                      const isNext = index === 0;
                      return (
                        <div key={app.id} style={{
                          padding: '0.9rem 1rem',
                          background: isNext ? '#f0f7ff' : '#f8fafc',
                          borderRadius: '10px',
                          border: isNext ? '1.5px solid #007BFF' : '1px solid #eef0f3',
                          display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                          transition: 'all 0.2s'
                        }}>
                          <div>
                            <h4 style={{ margin: '0 0 0.2rem 0', fontSize: '0.95rem', color: '#1a2332', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                              {app.patient_name}
                              {isNext && (
                                <span style={{
                                  fontSize: '0.6rem', background: '#007BFF', color: 'white',
                                  padding: '2px 7px', borderRadius: '12px', fontWeight: 800, letterSpacing: '0.05em'
                                }}>SERVING</span>
                              )}
                            </h4>
                            <span style={{ fontSize: '0.75rem', color: '#5a6a7e' }}>
                              {app.age} yrs &nbsp;·&nbsp; {app.disease}
                            </span>
                          </div>
                          <div style={{
                            fontSize: '1.3rem', fontWeight: 800,
                            color: isNext ? '#007BFF' : '#5a6a7e',
                            minWidth: 40, textAlign: 'right'
                          }}>
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
      </div>

      {/* ══════════════════════════════════════════════════
          HISTORY MODAL
      ══════════════════════════════════════════════════ */}
      {showHistory && (
        <div style={{
          position: 'fixed', top: 0, left: 0, width: '100%', height: '100%',
          background: 'rgba(10,20,40,0.55)', backdropFilter: 'blur(8px)',
          zIndex: 9999, display: 'flex', justifyContent: 'center', alignItems: 'center', padding: '1rem'
        }} onClick={(e) => e.target === e.currentTarget && setShowHistory(false)}>
          <div className="clinic-card fade-in" style={{
            width: '100%', maxWidth: 820, maxHeight: '90vh',
            display: 'flex', flexDirection: 'column', padding: 0, overflow: 'hidden',
            boxShadow: '0 24px 80px rgba(0,0,0,0.2)'
          }}>
            {/* Modal Header */}
            <div style={{ padding: '1.5rem', borderBottom: '1px solid #eef0f3' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
                <h2 style={{ margin: 0, fontSize: '1.2rem', color: '#1a2332', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                  <History size={20} color="#007BFF" /> Clinic Logs &amp; Analytics
                </h2>
                <div style={{ display: 'flex', gap: '0.5rem' }}>
                  <button onClick={exportToExcel} className="btn" style={{
                    padding: '0.4rem 0.9rem', fontSize: '0.8rem',
                    background: 'rgba(40,167,69,0.1)', color: '#28a745',
                    border: '1px solid rgba(40,167,69,0.3)', borderRadius: '8px'
                  }}>Download CSV</button>
                  <button onClick={() => setShowHistory(false)} className="btn btn-outline"
                    style={{ padding: '0.4rem 0.6rem', border: 'none', color: '#5a6a7e' }}>
                    <X size={20} />
                  </button>
                </div>
              </div>
              <div style={{ display: 'flex', gap: '1.5rem', borderBottom: '1px solid #eef0f3' }}>
                {(['LOG', 'ANALYTICS'] as const).map(tab => (
                  <button key={tab} onClick={() => setHistoryTab(tab)} style={{
                    background: 'none', border: 'none',
                    padding: '0.5rem 0', marginBottom: -1,
                    color: historyTab === tab ? '#007BFF' : '#5a6a7e',
                    fontWeight: historyTab === tab ? 700 : 500,
                    borderBottom: historyTab === tab ? '2px solid #007BFF' : '2px solid transparent',
                    cursor: 'pointer', transition: 'all 0.2s', fontFamily: 'inherit', fontSize: '0.9rem'
                  }}>
                    {tab === 'LOG' ? 'Patient Log' : 'Financial Analytics'}
                  </button>
                ))}
              </div>
            </div>

            {/* Modal Body */}
            <div style={{ padding: '1.5rem', flex: 1, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '1rem' }}>
              {loadingHistory ? (
                <div style={{ textAlign: 'center', padding: '3rem' }}>
                  <Loader2 size={30} className="animate-spin" style={{ color: '#007BFF', margin: '0 auto 1rem' }} />
                  <p style={{ color: '#5a6a7e' }}>Fetching clinic records…</p>
                </div>
              ) : historyTab === 'LOG' ? (
                <>
                  <div style={{ position: 'relative' }}>
                    <Search style={{ position: 'absolute', left: '1rem', top: '50%', transform: 'translateY(-50%)', color: '#5a6a7e' }} size={17} />
                    <input type="text" className="input-field"
                      placeholder="Search by patient name, token, or diagnosis…"
                      value={historySearch} onChange={(e) => setHistorySearch(e.target.value)}
                      style={{ paddingLeft: '2.75rem' }}
                    />
                  </div>
                  {filteredHistory.length === 0 ? (
                    <div style={{ textAlign: 'center', padding: '3rem', color: '#5a6a7e' }}>No records found.</div>
                  ) : (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                      {filteredHistory.map(record => {
                        const dateObj = record.created_at?.toDate ? record.created_at.toDate() : new Date();
                        return (
                          <div key={record.id} style={{
                            display: 'grid', gridTemplateColumns: '1fr 2fr 1fr', gap: '1rem',
                            padding: '1rem 1.25rem', background: '#f8fafc',
                            borderRadius: '10px', border: '1px solid #eef0f3', alignItems: 'center'
                          }}>
                            <div>
                              <p style={{ margin: 0, fontWeight: 700, color: '#1a2332', fontSize: '0.9rem' }}>{record.patient_name}</p>
                              <p style={{ margin: 0, fontSize: '0.75rem', color: '#5a6a7e' }}>{record.disease} · {record.age}yrs</p>
                            </div>
                            <div style={{ display: 'flex', gap: '2rem', fontSize: '0.85rem' }}>
                              <div>
                                <span style={{ color: '#5a6a7e', display: 'block', fontSize: '0.68rem', textTransform: 'uppercase', fontWeight: 700 }}>Token</span>
                                <span style={{ fontWeight: 700, color: '#007BFF' }}>#{record.token_number}</span>
                              </div>
                              <div>
                                <span style={{ color: '#5a6a7e', display: 'block', fontSize: '0.68rem', textTransform: 'uppercase', fontWeight: 700 }}>Fees</span>
                                <span style={{ fontWeight: 700, color: '#28a745' }}>₹{record.fees || '0'}</span>
                              </div>
                            </div>
                            <div style={{ textAlign: 'right', fontSize: '0.8rem', color: '#5a6a7e' }}>
                              <p style={{ margin: '0 0 0.2rem 0', fontWeight: 600 }}>{dateObj.toLocaleDateString()}</p>
                              <p style={{ margin: 0 }}>{dateObj.toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}</p>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
                    <div style={{ background: '#f0fff4', padding: '1.5rem', borderRadius: '12px', border: '1px solid rgba(40,167,69,0.2)' }}>
                      <p style={{ margin: '0 0 0.5rem 0', color: '#5a6a7e', fontSize: '0.82rem', textTransform: 'uppercase', fontWeight: 700 }}>Total Revenue</p>
                      <h3 style={{ margin: 0, fontSize: '2rem', color: '#28a745', fontWeight: 800 }}>
                        ₹{historyData.reduce((sum, r) => sum + (Number(r.fees) || 0), 0).toLocaleString()}
                      </h3>
                    </div>
                    <div style={{ background: '#f0f7ff', padding: '1.5rem', borderRadius: '12px', border: '1px solid rgba(0,123,255,0.2)' }}>
                      <p style={{ margin: '0 0 0.5rem 0', color: '#5a6a7e', fontSize: '0.82rem', textTransform: 'uppercase', fontWeight: 700 }}>Patients Served</p>
                      <h3 style={{ margin: 0, fontSize: '2rem', color: '#007BFF', fontWeight: 800 }}>{historyData.length}</h3>
                    </div>
                  </div>
                  {/* 7-day bar chart */}
                  <div style={{ background: '#f8fafc', padding: '1.5rem', borderRadius: '12px', border: '1px solid #eef0f3' }}>
                    <h3 style={{ margin: '0 0 1.25rem 0', fontSize: '0.95rem', color: '#1a2332', fontWeight: 700 }}>7-Day Patient Volume</h3>
                    <div style={{ display: 'flex', alignItems: 'flex-end', gap: '0.5rem', height: 140 }}>
                      {(() => {
                        const last7 = Array.from({length:7}).map((_,i) => { const d = new Date(); d.setDate(d.getDate()-i); return d.toLocaleDateString(); }).reverse();
                        const vols = last7.map(ds => ({
                          date: ds.split('/')[0]+'/'+ds.split('/')[1],
                          count: historyData.filter(r => { const d = r.created_at?.toDate ? r.created_at.toDate() : new Date(); return d.toLocaleDateString()===ds; }).length
                        }));
                        const max = Math.max(...vols.map(v=>v.count), 1);
                        return vols.map((vol,idx)=>(
                          <div key={idx} style={{ flex:1, display:'flex', flexDirection:'column', alignItems:'center', gap:'0.4rem' }}>
                            <div style={{ fontSize:'0.75rem', color:'#007BFF', fontWeight:700 }}>{vol.count>0?vol.count:''}</div>
                            <div style={{
                              width:'100%', maxWidth:28,
                              background: vol.count>0 ? 'linear-gradient(180deg,#007BFF,#0056CC)' : '#eef0f3',
                              height:`${(vol.count/max)*100}%`, minHeight:4,
                              borderRadius:'4px 4px 0 0', transition:'height 0.5s ease',
                              boxShadow: vol.count>0 ? '0 2px 8px rgba(0,123,255,0.25)' : 'none'
                            }} />
                            <div style={{ fontSize:'0.65rem', color:'#5a6a7e' }}>{vol.date}</div>
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

      {/* ══════════════════════════════════════════════════
          EDIT PROFILE MODAL
      ══════════════════════════════════════════════════ */}
      {showEditProfile && (
        <div style={{
          position: 'fixed', top: 0, left: 0, width: '100%', height: '100%',
          background: 'rgba(10,20,40,0.55)', backdropFilter: 'blur(8px)',
          zIndex: 9999, display: 'flex', justifyContent: 'center', alignItems: 'center', padding: '1rem'
        }} onClick={(e) => e.target === e.currentTarget && setShowEditProfile(false)}>
          <div className="clinic-card fade-in" style={{
            width: '100%', maxWidth: 520, padding: 0, overflow: 'hidden',
            boxShadow: '0 24px 80px rgba(0,0,0,0.2)'
          }}>
            {/* Modal header */}
            <div style={{ padding: '1.5rem', borderBottom: '1px solid #eef0f3', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <h2 style={{ margin: 0, fontSize: '1.15rem', color: '#1a2332', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <Edit2 size={18} color="#007BFF" /> Edit Clinic Profile
              </h2>
              <button onClick={() => setShowEditProfile(false)} className="btn btn-outline"
                style={{ padding: '0.4rem', border: 'none', color: '#5a6a7e' }}>
                <X size={22} />
              </button>
            </div>

            <form onSubmit={handleSaveProfile} style={{ padding: '1.75rem', display: 'flex', flexDirection: 'column', gap: '1rem' }}>
              {/* Doctor image upload inside modal too */}
              <div style={{ display: 'flex', justifyContent: 'center', marginBottom: '0.5rem' }}>
                <DoctorAvatar
                  clinicId={id}
                  imageUrl={clinic.doctor_image_url}
                  doctorName={editData.doctor_name || clinic.doctor_name}
                  editable={true}
                  size={90}
                />
              </div>
              <p style={{ textAlign: 'center', fontSize: '0.75rem', color: '#5a6a7e', marginTop: '-0.5rem', marginBottom: '0.5rem' }}>
                Click the camera icon to update the doctor&apos;s photo
              </p>

              <div>
                <label style={{ fontSize: '0.72rem', color: '#5a6a7e', textTransform: 'uppercase', fontWeight: 700, marginBottom: '0.4rem', display: 'block' }}>Primary Doctor Name</label>
                <input type="text" className="input-field" required
                  value={editData.doctor_name} onChange={e => setEditData({...editData, doctor_name: e.target.value})}
                  placeholder="e.g. Dr. John Smith"
                />
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
                <div>
                  <label style={{ fontSize: '0.72rem', color: '#5a6a7e', textTransform: 'uppercase', fontWeight: 700, marginBottom: '0.4rem', display: 'block' }}>Degrees</label>
                  <input type="text" className="input-field"
                    value={editData.dr_degree} onChange={e => setEditData({...editData, dr_degree: e.target.value})}
                    placeholder="MBBS, MD"
                  />
                </div>
                <div>
                  <label style={{ fontSize: '0.72rem', color: '#5a6a7e', textTransform: 'uppercase', fontWeight: 700, marginBottom: '0.4rem', display: 'block' }}>Specialization</label>
                  <input type="text" className="input-field"
                    value={editData.specialization} onChange={e => setEditData({...editData, specialization: e.target.value})}
                    placeholder="e.g. Cardiologist"
                  />
                </div>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
                <div>
                  <label style={{ fontSize: '0.72rem', color: '#5a6a7e', textTransform: 'uppercase', fontWeight: 700, marginBottom: '0.4rem', display: 'block' }}>Contact Phone</label>
                  <input type="text" className="input-field"
                    value={editData.phone_number} onChange={e => setEditData({...editData, phone_number: e.target.value})}
                    placeholder="+91..."
                  />
                </div>
                <div>
                  <label style={{ fontSize: '0.72rem', color: '#5a6a7e', textTransform: 'uppercase', fontWeight: 700, marginBottom: '0.4rem', display: 'block' }}>Consultation Fee (₹)</label>
                  <input type="number" className="input-field"
                    value={editData.fees} onChange={e => setEditData({...editData, fees: e.target.value})}
                    placeholder="500"
                  />
                </div>
              </div>

              <div>
                <label style={{ fontSize: '0.72rem', color: '#5a6a7e', textTransform: 'uppercase', fontWeight: 700, marginBottom: '0.4rem', display: 'block' }}>Operating Schedule</label>
                <input type="text" className="input-field"
                  value={editData.operating_hours} onChange={e => setEditData({...editData, operating_hours: e.target.value})}
                  placeholder="Mon-Sat: 10:00 AM – 6:00 PM"
                />
              </div>

              <button type="submit" className="btn btn-primary" disabled={savingProfile} style={{ marginTop: '0.5rem', padding: '0.9rem', fontSize: '1rem' }}>
                {savingProfile ? <Loader2 size={18} className="animate-spin" /> : 'Save Profile Changes'}
              </button>
            </form>
          </div>
        </div>
      )}

      {/* ── COMPLETE VISIT (EHR) MODAL ── */}
      {showCompleteModal && currentServing && (
        <div style={{
          position: 'fixed', top: 0, left: 0, width: '100%', height: '100%',
          background: 'rgba(10,20,40,0.55)', backdropFilter: 'blur(8px)',
          zIndex: 9999, display: 'flex', justifyContent: 'center', alignItems: 'center', padding: '1rem'
        }} onClick={(e) => e.target === e.currentTarget && setShowCompleteModal(false)}>
          <div className="clinic-card" style={{ width: '100%', maxWidth: 640, maxHeight: '90vh', padding: 0, overflow: 'hidden', display: 'flex', flexDirection: 'column', boxShadow: '0 24px 80px rgba(0,0,0,0.2)' }}>
            <div style={{ padding: '1.25rem 1.5rem', borderBottom: '1px solid #eef0f3', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <h3 style={{ margin: 0, fontSize: '1.1rem', color: '#1a2332' }}>Complete Visit &amp; Record Vitals — #{currentServing.token_number}</h3>
              <button onClick={() => setShowCompleteModal(false)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#5a6a7e' }}><X size={20} /></button>
            </div>
            
            <form onSubmit={handleCompleteVisitSubmit} style={{ padding: '1.5rem', display: 'flex', flexDirection: 'column', gap: '1.25rem', overflowY: 'auto' }}>
              
              {/* Vitals Section */}
              <div>
                <h4 style={{ fontSize: '0.75rem', color: '#5a6a7e', textTransform: 'uppercase', fontWeight: 700, marginBottom: '0.75rem', borderBottom: '1px solid #eef0f3', paddingBottom: '0.25rem' }}>Patient Vitals (Optional)</h4>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(130px, 1fr))', gap: '0.75rem' }}>
                  <div>
                    <label style={{ fontSize: '0.65rem', color: '#5a6a7e', textTransform: 'uppercase', display: 'block', marginBottom: '0.25rem' }}>BP Systolic</label>
                    <input type="number" className="input-field" placeholder="120" value={modalBpSystolic} onChange={e => setModalBpSystolic(e.target.value)} style={{ padding: '0.5rem' }} />
                  </div>
                  <div>
                    <label style={{ fontSize: '0.65rem', color: '#5a6a7e', textTransform: 'uppercase', display: 'block', marginBottom: '0.25rem' }}>BP Diastolic</label>
                    <input type="number" className="input-field" placeholder="80" value={modalBpDiastolic} onChange={e => setModalBpDiastolic(e.target.value)} style={{ padding: '0.5rem' }} />
                  </div>
                  <div>
                    <label style={{ fontSize: '0.65rem', color: '#5a6a7e', textTransform: 'uppercase', display: 'block', marginBottom: '0.25rem' }}>Heart Rate</label>
                    <input type="number" className="input-field" placeholder="72" value={modalHeartRate} onChange={e => setModalHeartRate(e.target.value)} style={{ padding: '0.5rem' }} />
                  </div>
                  <div>
                    <label style={{ fontSize: '0.65rem', color: '#5a6a7e', textTransform: 'uppercase', display: 'block', marginBottom: '0.25rem' }}>Temp (°C)</label>
                    <input type="number" step="0.1" className="input-field" placeholder="37" value={modalTemp} onChange={e => setModalTemp(e.target.value)} style={{ padding: '0.5rem' }} />
                  </div>
                  <div>
                    <label style={{ fontSize: '0.65rem', color: '#5a6a7e', textTransform: 'uppercase', display: 'block', marginBottom: '0.25rem' }}>Weight (kg)</label>
                    <input type="number" step="0.1" className="input-field" placeholder="70" value={modalWeight} onChange={e => setModalWeight(e.target.value)} style={{ padding: '0.5rem' }} />
                  </div>
                  <div>
                    <label style={{ fontSize: '0.65rem', color: '#5a6a7e', textTransform: 'uppercase', display: 'block', marginBottom: '0.25rem' }}>SpO2 (%)</label>
                    <input type="number" className="input-field" placeholder="98" value={modalSpo2} onChange={e => setModalSpo2(e.target.value)} style={{ padding: '0.5rem' }} />
                  </div>
                </div>
              </div>

              {/* Chief Complaint & Diagnosis */}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
                <div>
                  <label style={{ fontSize: '0.72rem', color: '#5a6a7e', textTransform: 'uppercase', fontWeight: 700, marginBottom: '0.4rem', display: 'block' }}>Chief Complaint</label>
                  <input type="text" required className="input-field" value={modalChiefComplaint} onChange={e => setModalChiefComplaint(e.target.value)} placeholder="e.g. Fever, Sore Throat" />
                </div>
                <div>
                  <label style={{ fontSize: '0.72rem', color: '#5a6a7e', textTransform: 'uppercase', fontWeight: 700, marginBottom: '0.4rem', display: 'block' }}>Diagnosis</label>
                  <input type="text" required className="input-field" value={modalDiagnosis} onChange={e => setModalDiagnosis(e.target.value)} placeholder="e.g. Acute Pharyngitis" />
                </div>
              </div>

              {/* Medications Table */}
              <div>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.5rem' }}>
                  <h4 style={{ fontSize: '0.75rem', color: '#5a6a7e', textTransform: 'uppercase', fontWeight: 700 }}>Prescribed Medications</h4>
                  <button type="button" className="btn btn-outline" style={{ padding: '0.2rem 0.5rem', fontSize: '0.7rem', minHeight: 'unset' }}
                    onClick={() => setModalMedications([...modalMedications, { name: '', dosage: '', duration: '', instructions: '' }])}>
                    <Plus size={10} /> Add Medication
                  </button>
                </div>
                
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                  {modalMedications.map((med, index) => (
                    <div key={index} style={{ display: 'grid', gridTemplateColumns: '2fr 1fr 1fr 1.5fr auto', gap: '0.4rem', alignItems: 'center' }}>
                      <input type="text" className="input-field" placeholder="Medication" value={med.name} onChange={e => {
                        const updated = [...modalMedications];
                        updated[index].name = e.target.value;
                        setModalMedications(updated);
                      }} style={{ padding: '0.4rem' }} required={index === 0} />
                      
                      <input type="text" className="input-field" placeholder="Dosage" value={med.dosage} onChange={e => {
                        const updated = [...modalMedications];
                        updated[index].dosage = e.target.value;
                        setModalMedications(updated);
                      }} style={{ padding: '0.4rem' }} />
                      
                      <input type="text" className="input-field" placeholder="Duration" value={med.duration} onChange={e => {
                        const updated = [...modalMedications];
                        updated[index].duration = e.target.value;
                        setModalMedications(updated);
                      }} style={{ padding: '0.4rem' }} />
                      
                      <input type="text" className="input-field" placeholder="Instructions" value={med.instructions} onChange={e => {
                        const updated = [...modalMedications];
                        updated[index].instructions = e.target.value;
                        setModalMedications(updated);
                      }} style={{ padding: '0.4rem' }} />

                      {modalMedications.length > 1 && (
                        <button type="button" onClick={() => setModalMedications(modalMedications.filter((_, i) => i !== index))}
                          style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#dc3545', display: 'flex' }}>
                          <X size={16} />
                        </button>
                      )}
                    </div>
                  ))}
                </div>
              </div>

              {/* Tests & Notes & Follow Up */}
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '1rem' }}>
                <div>
                  <label style={{ fontSize: '0.72rem', color: '#5a6a7e', textTransform: 'uppercase', fontWeight: 700, marginBottom: '0.4rem', display: 'block' }}>Ordered Tests (comma separated)</label>
                  <input type="text" className="input-field" value={modalTests} onChange={e => setModalTests(e.target.value)} placeholder="e.g. CBC, Lipid Profile" />
                </div>
                <div>
                  <label style={{ fontSize: '0.72rem', color: '#5a6a7e', textTransform: 'uppercase', fontWeight: 700, marginBottom: '0.4rem', display: 'block' }}>Follow-up Date</label>
                  <input type="date" className="input-field" value={modalFollowUp} onChange={e => setModalFollowUp(e.target.value)} />
                </div>
              </div>

              <div>
                <label style={{ fontSize: '0.72rem', color: '#5a6a7e', textTransform: 'uppercase', fontWeight: 700, marginBottom: '0.4rem', display: 'block' }}>Consultation Fee Charged (₹)</label>
                <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: '1rem' }}>
                  <input type="number" required className="input-field" value={modalFee} onChange={e => setModalFee(e.target.value)} placeholder="e.g. 500" />
                  <select className="input-field" value={modalPaymentMode} onChange={e => setModalPaymentMode(e.target.value)} style={{ height: '46px' }}>
                    <option value="cash">Cash</option>
                    <option value="upi">UPI / Online</option>
                    <option value="card">Card</option>
                  </select>
                </div>
              </div>

              <div>
                <label style={{ fontSize: '0.72rem', color: '#5a6a7e', textTransform: 'uppercase', fontWeight: 700, marginBottom: '0.4rem', display: 'block' }}>Doctor Notes</label>
                <textarea className="input-field" rows={2} value={modalNotes} onChange={e => setModalNotes(e.target.value)} placeholder="Additional clinical notes..." style={{ resize: 'none' }} />
              </div>

              <div>
                <label style={{ fontSize: '0.72rem', color: '#5a6a7e', textTransform: 'uppercase', fontWeight: 700, marginBottom: '0.4rem', display: 'block' }}>Upload Prescription Photo (optional)</label>
                <input type="file" accept="image/*,application/pdf" onChange={e => setModalPrescriptionFile(e.target.files?.[0] || null)} style={{ fontSize: '0.85rem' }} />
              </div>

              <button type="submit" className="btn btn-primary" style={{ width: '100%', padding: '0.9rem', fontSize: '1rem', fontWeight: 700 }} disabled={isCompleting}>
                {isCompleting ? <Loader2 size={20} className="animate-spin" /> : 'Finalize and Call Next Patient'}
              </button>
            </form>
          </div>
        </div>
      )}

      {/* ── PRINT LAYOUT ──────────────────────────────────────────── */}
      <div className="print-only">
        <div style={{ textAlign: 'center', marginBottom: '3rem' }}>
          <h1 style={{ fontSize: '3rem', margin: '0 0 0.5rem 0', fontWeight: 900 }}>{clinic.name}</h1>
          <p style={{ fontSize: '1.2rem', color: '#555', margin: 0 }}>📍 {clinic.location || 'General Site'}</p>
        </div>
        <div style={{ padding: '2rem', border: '4px solid black', borderRadius: '16px', marginBottom: '2rem' }}>
          <QRCodeSVG value={`https://qpluse.vercel.app/?clinic=${clinic.id}`} size={350} level="H" includeMargin={false} />
        </div>
        <div style={{ textAlign: 'center' }}>
          <h2 style={{ fontSize: '1.8rem', margin: '0 0 0.5rem 0', fontWeight: 800 }}>Scan QR to Queue Up</h2>
          <p style={{ fontSize: '1.5rem', color: '#444' }}>Or visit: <strong>qpluse.vercel.app</strong></p>
        </div>
      </div>
    </>
  );
}
