'use client';

import React, { useState, useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { onAuthStateChanged, signOut } from 'firebase/auth';
import { auth } from '@/lib/firebase';
import { 
  getPatientProfile, 
  updatePatientProfile, 
  saveFcmToken,
  ensurePatientProfile
} from '@/lib/actions';
import { 
  getPatientMedicalRecords, 
  getPatientPrescriptions, 
  uploadFileToStorage, 
  addPatientPrescriptionDocument, 
  exportPatientData, 
  deletePatientAccount 
} from '@/lib/patientActions';
import { 
  User, Activity, ShieldAlert, History, FileText, Settings, 
  Loader2, LogOut, ArrowLeft, Heart, Smartphone, Upload, Plus, 
  X, Calendar, Phone, Clock, FilePlus, Download, Trash2, ArrowUpRight 
} from 'lucide-react';
import { QRCodeSVG } from 'qrcode.react';

export default function ProfilePage() {
  const router = useRouter();
  const [currentUser, setCurrentUser] = useState<any>(null);
  const [patient, setPatient] = useState<any>(null);
  const [records, setRecords] = useState<any[]>([]);
  const [prescriptions, setPrescriptions] = useState<any[]>([]);
  
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<'CARD' | 'HISTORY' | 'DOCS' | 'ACCOUNT'>('CARD');
  
  // New document upload form state
  const [uploadingDoc, setUploadingDoc] = useState(false);
  const [showUploadModal, setShowUploadModal] = useState(false);
  const [docFile, setDocFile] = useState<File | null>(null);
  const [docDoctorName, setDocDoctorName] = useState('');
  const [docClinicId, setDocClinicId] = useState('');
  const [docNotes, setDocNotes] = useState('');
  
  // DPDP modal states
  const [exporting, setExporting] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);

  // Auto-fill edits in Account tab
  const [editProfile, setEditProfile] = useState<any>({
    full_name: '',
    date_of_birth: '',
    gender: 'male',
    blood_group: 'O+',
    recovery_phone: '',
    chronic_conditions: '',
    allergies: '',
    emergency_contact: { name: '', phone: '', relation: '' }
  });
  const [savingProfile, setSavingProfile] = useState(false);

  useEffect(() => {
    const unsubscribeAuth = onAuthStateChanged(auth, async (user) => {
      if (!user) {
        router.push('/login');
        return;
      }
      setCurrentUser(user);

      try {
        if (user.phoneNumber) {
          await ensurePatientProfile(user.uid, user.phoneNumber);
        }
        // Fetch patient profile using UID and phoneNumber (for recovery resolution)
        const pProfile = (await getPatientProfile(user.uid, user.phoneNumber || undefined)) as any;
        if (pProfile) {
          setPatient(pProfile);
          setEditProfile({
            full_name: pProfile.full_name || '',
            date_of_birth: pProfile.date_of_birth || '',
            gender: pProfile.gender || 'male',
            blood_group: pProfile.blood_group || 'O+',
            recovery_phone: pProfile.recovery_phone || '',
            chronic_conditions: pProfile.medical_background?.chronic_conditions?.join(', ') || '',
            allergies: pProfile.medical_background?.allergies?.join(', ') || '',
            emergency_contact: pProfile.emergency_contact || { name: '', phone: '', relation: '' }
          });
        }

        // Fetch sub-collections using the true patient ID (in case of recovery login)
        const truePatientId = pProfile ? pProfile.id : user.uid;
        const [medRecords, docs] = await Promise.all([
          getPatientMedicalRecords(truePatientId),
          getPatientPrescriptions(truePatientId)
        ]);
        setRecords(medRecords);
        setPrescriptions(docs);
      } catch (err) {
        console.error('Failed to load profile data:', err);
      } finally {
        setLoading(false);
      }
    });

    return () => unsubscribeAuth();
  }, [router]);

  const handleUpdateProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!currentUser) return;
    setSavingProfile(true);

    try {
      const formattedData = {
        full_name: editProfile.full_name,
        date_of_birth: editProfile.date_of_birth,
        gender: editProfile.gender,
        blood_group: editProfile.blood_group,
        recovery_phone: editProfile.recovery_phone || null,
        medical_background: {
          chronic_conditions: editProfile.chronic_conditions
            .split(',')
            .map((c: string) => c.trim())
            .filter((c: string) => c !== ''),
          allergies: editProfile.allergies
            .split(',')
            .map((a: string) => a.trim())
            .filter((a: string) => a !== ''),
          current_medications: patient?.medical_background?.current_medications || [],
          surgeries: patient?.medical_background?.surgeries || [],
          family_history: patient?.medical_background?.family_history || []
        },
        emergency_contact: editProfile.emergency_contact
      };

      await updatePatientProfile(currentUser.uid, formattedData, currentUser.phoneNumber);
      
      // Update local state
      const updated = (await getPatientProfile(currentUser.uid, currentUser.phoneNumber)) as any;
      setPatient(updated);
      alert('Profile updated successfully!');
    } catch (err) {
      console.error(err);
      alert('Failed to update profile.');
    } finally {
      setSavingProfile(false);
    }
  };

  const handleDocUpload = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!currentUser || !docFile || !patient) return;
    setUploadingDoc(true);

    try {
      // 1. Upload to storage
      const { downloadUrl, storagePath } = await uploadFileToStorage(
        patient.id,
        docFile,
        'prescriptions'
      );

      // 2. Add Firestore document
      await addPatientPrescriptionDocument(patient.id, {
        fileUrl: downloadUrl,
        storagePath,
        fileName: docFile.name,
        fileSizeBytes: docFile.size,
        mimeType: docFile.type,
        clinicId: docClinicId || 'General',
        doctorName: docDoctorName,
        notes: docNotes
      });

      // 3. Refresh list
      const docs = await getPatientPrescriptions(patient.id);
      setPrescriptions(docs);

      // Reset form
      setShowUploadModal(false);
      setDocFile(null);
      setDocDoctorName('');
      setDocClinicId('');
      setDocNotes('');
      alert('Document uploaded successfully!');
    } catch (err) {
      console.error(err);
      alert('Failed to upload document.');
    } finally {
      setUploadingDoc(false);
    }
  };

  const handleExportData = async () => {
    if (!currentUser || !patient) return;
    setExporting(true);
    try {
      const dataStr = await exportPatientData(patient.id);
      const dataUri = 'data:application/json;charset=utf-8,'+ encodeURIComponent(dataStr);
      
      const exportFileDefaultName = `qpulse_patient_data_${currentUser.phoneNumber}.json`;
      
      const linkElement = document.createElement('a');
      linkElement.setAttribute('href', dataUri);
      linkElement.setAttribute('download', exportFileDefaultName);
      linkElement.click();
    } catch (err) {
      console.error(err);
      alert('Failed to export data.');
    } finally {
      setExporting(false);
    }
  };

  const handleDeleteAccount = async () => {
    if (!currentUser || !patient) return;
    setDeleting(true);
    try {
      await deletePatientAccount(patient.id, currentUser.phoneNumber);
      await signOut(auth);
      alert('Your account and all associated medical records have been permanently deleted.');
      router.push('/');
    } catch (err) {
      console.error(err);
      alert('Failed to delete account. Try logging out and logging in again.');
    } finally {
      setDeleting(false);
    }
  };

  if (loading) {
    return (
      <div style={{ display: 'grid', placeItems: 'center', minHeight: '100vh' }}>
        <div style={{ textAlign: 'center' }}>
          <Loader2 size={40} className="animate-spin" style={{ color: '#007BFF', margin: '0 auto 1rem' }} />
          <p style={{ color: '#5a6a7e', fontWeight: 500 }}>Loading profile details…</p>
        </div>
      </div>
    );
  }

  // Construct patient data for QR card
  const patientQRValue = JSON.stringify({
    n: patient?.full_name || 'Patient',
    p: currentUser?.phoneNumber || '',
    b: patient?.blood_group || 'Not specified',
    a: patient?.medical_background?.allergies?.slice(0,3) || [],
    e: patient?.emergency_contact?.phone || ''
  });

  return (
    <main style={{ minHeight: '100vh', padding: '2rem 1rem' }}>
      <div style={{ maxWidth: 960, margin: '0 auto' }}>
        
        {/* Back Link */}
        <button 
          onClick={() => router.push('/')}
          style={{
            background: 'none', border: 'none', color: '#007BFF', 
            fontSize: '0.85rem', display: 'inline-flex', alignItems: 'center', 
            gap: '0.4rem', cursor: 'pointer', marginBottom: '1.5rem', fontWeight: 600
          }}
        >
          <ArrowLeft size={16} /> Back to Directory
        </button>

        {/* Profile Header */}
        <div style={{
          display: 'flex', flexWrap: 'wrap', justifyContent: 'space-between',
          alignItems: 'center', gap: '1.5rem', marginBottom: '2rem',
          background: 'var(--glass-bg)', backdropFilter: 'blur(12px)',
          border: '1px solid var(--glass-border)', padding: '2rem',
          borderRadius: 20, boxShadow: 'var(--card-shadow)'
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
            <div style={{
              width: 60, height: 60, borderRadius: '50%',
              background: 'linear-gradient(135deg,#007BFF,#0056CC)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              boxShadow: '0 4px 12px rgba(0,123,255,0.3)'
            }}>
              <User size={30} color="white" />
            </div>
            <div>
              <h1 style={{ fontSize: '1.35rem', margin: 0, fontWeight: 800 }}>
                {patient?.full_name || 'Setup Profile'}
              </h1>
              <p style={{ margin: 0, fontSize: '0.85rem', color: 'var(--text-secondary)' }}>
                {currentUser?.phoneNumber}
              </p>
            </div>
          </div>
          <div style={{ display: 'flex', gap: '0.75rem', alignItems: 'center' }}>
            <button 
              onClick={() => setActiveTab('ACCOUNT')}
              className="btn btn-outline" 
              style={{ fontSize: '0.85rem', color: '#007BFF', borderColor: 'rgba(0,123,255,0.2)' }}
            >
              <Settings size={16} /> Edit Profile
            </button>
            <button 
              onClick={() => { signOut(auth); router.push('/'); }}
              className="btn btn-outline" 
              style={{ fontSize: '0.85rem', color: 'var(--danger)', borderColor: 'rgba(220,53,69,0.2)' }}
            >
              <LogOut size={16} /> Logout
            </button>
          </div>
        </div>

        {/* 4-Tab Navigation */}
        <div style={{
          display: 'flex', borderBottom: '1px solid var(--glass-border)',
          marginBottom: '1.5rem', overflowX: 'auto', gap: '1.5rem',
          paddingBottom: '2px'
        }}>
          {[
            { id: 'CARD', label: 'Health Card', icon: <Heart size={16} /> },
            { id: 'HISTORY', label: 'Visit History', icon: <History size={16} /> },
            { id: 'DOCS', label: 'My Documents', icon: <FileText size={16} /> },
            { id: 'ACCOUNT', label: 'Account / DPDP', icon: <Settings size={16} /> }
          ].map(tab => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id as any)}
              style={{
                background: 'none', border: 'none', cursor: 'pointer',
                display: 'flex', alignItems: 'center', gap: '0.45rem',
                color: activeTab === tab.id ? '#007BFF' : 'var(--text-secondary)',
                fontWeight: activeTab === tab.id ? 700 : 500,
                borderBottom: activeTab === tab.id ? '2px solid #007BFF' : '2px solid transparent',
                padding: '0.75rem 0.25rem', fontFamily: 'inherit', fontSize: '0.9rem',
                whiteSpace: 'nowrap', transition: 'all 0.2s'
              }}
            >
              {tab.icon}
              {tab.label}
            </button>
          ))}
        </div>

        {/* ── TAB CONTENT ── */}
        
        {/* 1. HEALTH CARD */}
        {activeTab === 'CARD' && (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: '1.5rem' }}>
            
            {/* The Digital Card UI */}
            <div style={{
              background: 'linear-gradient(135deg, #1e293b 0%, #0f172a 100%)',
              border: '1px solid rgba(255,255,255,0.08)', borderRadius: 20,
              padding: '1.75rem', color: 'white', position: 'relative',
              boxShadow: 'var(--card-shadow)', overflow: 'hidden'
            }}>
              {/* Card branding */}
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                  <Activity size={18} color="#00d2ff" />
                  <span style={{ fontWeight: 800, fontSize: '0.85rem', letterSpacing: '1px' }}>Q-PULSE HEALTH</span>
                </div>
                <span style={{
                  fontSize: '0.62rem', background: 'rgba(0,210,255,0.12)',
                  color: '#00d2ff', padding: '3px 8px', borderRadius: 12, fontWeight: 700,
                  border: '1px solid rgba(0,210,255,0.2)'
                }}>DPDP COMPLIANT</span>
              </div>

              {/* Patient info */}
              <h2 style={{ fontSize: '1.3rem', fontWeight: 800, margin: '0 0 0.25rem 0' }}>
                {patient?.full_name || 'Setup Profile Name'}
              </h2>
              <p style={{ fontSize: '0.8rem', color: '#94a3b8', margin: '0 0 1.5rem 0' }}>
                Phone: {currentUser?.phoneNumber}
              </p>

              {/* Vitals overview grid */}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem', borderTop: '1px solid rgba(255,255,255,0.1)', paddingTop: '1rem' }}>
                <div>
                  <span style={{ display: 'block', fontSize: '0.62rem', color: '#94a3b8', textTransform: 'uppercase', fontWeight: 700 }}>Blood Group</span>
                  <strong style={{ fontSize: '1.15rem', color: '#00d2ff' }}>{patient?.blood_group || 'Not Set'}</strong>
                </div>
                <div>
                  <span style={{ display: 'block', fontSize: '0.62rem', color: '#94a3b8', textTransform: 'uppercase', fontWeight: 700 }}>Allergies</span>
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: '4px', marginTop: '0.2rem' }}>
                    {patient?.medical_background?.allergies?.length > 0 ? (
                      patient.medical_background.allergies.map((allergy: string, i: number) => (
                        <span key={i} style={{ fontSize: '0.62rem', padding: '1px 6px', background: 'rgba(255,77,77,0.15)', color: '#ff4d4d', borderRadius: 4, fontWeight: 600 }}>
                          {allergy}
                        </span>
                      ))
                    ) : (
                      <span style={{ fontSize: '0.7rem', color: '#64748b' }}>None Reported</span>
                    )}
                  </div>
                </div>
              </div>
            </div>

            {/* Emergency QR Code and contacts */}
            <div className="clinic-card" style={{ padding: '1.75rem', display: 'flex', flexDirection: 'column', gap: '1rem' }}>
              <h3 style={{ margin: 0, fontSize: '0.98rem', fontWeight: 700 }}>Emergency Contact Info</h3>
              
              {patient?.emergency_contact?.name ? (
                <div style={{ padding: '1rem', background: '#f8fafc', border: '1px solid #eef0f3', borderRadius: 12 }}>
                  <p style={{ margin: '0 0 0.2rem 0', fontSize: '0.85rem', fontWeight: 700 }}>{patient.emergency_contact.name}</p>
                  <p style={{ margin: '0 0 0.2rem 0', fontSize: '0.82rem', color: '#5a6a7e' }}>Relation: {patient.emergency_contact.relation}</p>
                  <a href={`tel:${patient.emergency_contact.phone}`} style={{ fontSize: '0.82rem', color: '#007BFF', display: 'flex', alignItems: 'center', gap: '0.35rem', textDecoration: 'none', fontWeight: 600 }}>
                    <Phone size={12} /> {patient.emergency_contact.phone}
                  </a>
                </div>
              ) : (
                <p style={{ margin: 0, fontSize: '0.82rem', color: '#5a6a7e' }}>No emergency contact set. Please update in Account preferences.</p>
              )}

              {/* Card QR Code */}
              <div style={{ textAlign: 'center', marginTop: 'auto', paddingTop: '1rem', borderTop: '1px solid #eef0f3' }}>
                <p style={{ fontSize: '0.72rem', color: '#5a6a7e', marginBottom: '0.5rem', fontWeight: 500 }}>Emergency QR — Scan for primary medical vitals</p>
                <div style={{ background: 'white', padding: '0.5rem', borderRadius: 8, display: 'inline-block', border: '1px solid #eef0f3' }}>
                  <QRCodeSVG value={patientQRValue} size={110} />
                </div>
              </div>
            </div>

          </div>
        )}

        {/* 2. VISIT HISTORY TIMELINE */}
        {activeTab === 'HISTORY' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
            {records.length === 0 ? (
              <div style={{ textAlign: 'center', padding: '4rem 2rem', background: '#fff', borderRadius: 16, border: '1px solid #eef0f3' }}>
                <History size={36} style={{ color: '#5a6a7e', margin: '0 auto 1rem' }} />
                <p style={{ color: '#5a6a7e', fontWeight: 500 }}>No completed clinic visits recorded yet.</p>
              </div>
            ) : (
              records.map((record) => {
                const dateObj = record.visit_date?.toDate ? record.visit_date.toDate() : new Date();
                return (
                  <div key={record.id} className="clinic-card" style={{ padding: '1.75rem', position: 'relative' }}>
                    <div style={{ display: 'flex', flexWrap: 'wrap', justifyContent: 'space-between', gap: '0.5rem', marginBottom: '1rem', borderBottom: '1px solid #eef0f3', paddingBottom: '0.75rem' }}>
                      <div>
                        <h3 style={{ margin: 0, fontSize: '1.05rem', color: '#1a2332' }}>{record.doctor_name}</h3>
                        <p style={{ margin: 0, fontSize: '0.8rem', color: '#007BFF', fontWeight: 600 }}>{record.specialization}</p>
                      </div>
                      <div style={{ textAlign: 'right', fontSize: '0.8rem', color: '#5a6a7e' }}>
                        <p style={{ margin: 0, fontWeight: 700 }}>{dateObj.toLocaleDateString()}</p>
                        <p style={{ margin: 0 }}>{dateObj.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</p>
                      </div>
                    </div>

                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '1.25rem', marginBottom: '1rem' }}>
                      <div>
                        <span style={{ display: 'block', fontSize: '0.65rem', color: '#5a6a7e', textTransform: 'uppercase', fontWeight: 700, marginBottom: '0.2rem' }}>Chief Complaint</span>
                        <p style={{ margin: 0, fontSize: '0.88rem', color: '#1a2332' }}>{record.chief_complaint || 'General Checkup'}</p>
                      </div>
                      <div>
                        <span style={{ display: 'block', fontSize: '0.65rem', color: '#5a6a7e', textTransform: 'uppercase', fontWeight: 700, marginBottom: '0.2rem' }}>Diagnosis</span>
                        <p style={{ margin: 0, fontSize: '0.88rem', color: '#1a2332', fontWeight: 600 }}>{record.diagnosis}</p>
                      </div>
                    </div>

                    {/* Vitals sub-display */}
                    {record.vitals && Object.keys(record.vitals).length > 0 && (
                      <div style={{ background: '#f8fafc', padding: '0.75rem 1rem', borderRadius: 10, display: 'flex', flexWrap: 'wrap', gap: '1.25rem', fontSize: '0.78rem', color: '#5a6a7e', marginBottom: '1rem', border: '1px solid #eef0f3' }}>
                        {record.vitals.bp_systolic && <span>BP: <strong>{record.vitals.bp_systolic}/{record.vitals.bp_diastolic} mmHg</strong></span>}
                        {record.vitals.heart_rate && <span>HR: <strong>{record.vitals.heart_rate} bpm</strong></span>}
                        {record.vitals.temperature && <span>Temp: <strong>{record.vitals.temperature}°C</strong></span>}
                        {record.vitals.spo2 && <span>SpO2: <strong>{record.vitals.spo2}%</strong></span>}
                        {record.vitals.weight_kg && <span>Weight: <strong>{record.vitals.weight_kg} kg</strong></span>}
                      </div>
                    )}

                    {/* Prescribed Medications */}
                    {record.medications_prescribed?.length > 0 && (
                      <div style={{ marginBottom: '1rem' }}>
                        <span style={{ display: 'block', fontSize: '0.65rem', color: '#5a6a7e', textTransform: 'uppercase', fontWeight: 700, marginBottom: '0.4rem' }}>Medications Prescribed</span>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem' }}>
                          {record.medications_prescribed.map((med: any, idx: number) => (
                            <div key={idx} style={{ display: 'flex', justifyContent: 'space-between', padding: '0.4rem 0.75rem', background: '#f8fafc', borderRadius: 8, border: '1px solid #eef0f3', fontSize: '0.82rem' }}>
                              <span><strong>{med.name}</strong> ({med.dosage})</span>
                              <span style={{ color: '#5a6a7e' }}>{med.duration} · {med.instructions}</span>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}

                    {/* Prescription file links */}
                    {record.prescription_image_urls?.length > 0 && (
                      <div style={{ display: 'flex', gap: '0.5rem', marginTop: '1rem' }}>
                        {record.prescription_image_urls.map((url: string, index: number) => (
                          <a 
                            key={index} 
                            href={url} 
                            target="_blank" 
                            rel="noopener noreferrer"
                            className="btn btn-outline" 
                            style={{ padding: '0.4rem 0.8rem', fontSize: '0.75rem', height: 'auto', minHeight: 'unset' }}
                          >
                            <FileText size={12} /> View Prescription Pad {record.prescription_image_urls.length > 1 ? `#${index+1}` : ''} <ArrowUpRight size={10} />
                          </a>
                        ))}
                      </div>
                    )}
                  </div>
                );
              })
            )}
          </div>
        )}

        {/* 3. DOCUMENTS */}
        {activeTab === 'DOCS' && (
          <div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.25rem' }}>
              <h3 style={{ margin: 0, fontSize: '1rem', color: '#1a2332' }}>Uploaded Health Documents</h3>
              <button 
                onClick={() => setShowUploadModal(true)}
                className="btn btn-primary" 
                style={{ fontSize: '0.85rem', padding: '0.5rem 0.9rem' }}
              >
                <Upload size={14} /> Upload Prescription
              </button>
            </div>

            {prescriptions.length === 0 ? (
              <div style={{ textAlign: 'center', padding: '4rem 2rem', background: '#fff', borderRadius: 16, border: '1px solid #eef0f3' }}>
                <FileText size={36} style={{ color: '#5a6a7e', margin: '0 auto 1rem' }} />
                <p style={{ color: '#5a6a7e', fontWeight: 500 }}>No document uploads found.</p>
              </div>
            ) : (
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))', gap: '1.25rem' }}>
                {prescriptions.map((docItem) => (
                  <div key={docItem.id} className="clinic-card" style={{ display: 'flex', flexDirection: 'column', padding: '1.25rem', height: '100%' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.75rem' }}>
                      <div style={{ padding: '0.4rem', background: 'rgba(0,123,255,0.08)', borderRadius: 8 }}>
                        <FileText size={18} color="#007BFF" />
                      </div>
                      <span style={{ fontSize: '0.62rem', padding: '2px 7px', background: 'rgba(0,123,255,0.1)', color: '#007BFF', borderRadius: 20, fontWeight: 700, textTransform: 'uppercase' }}>
                        {docItem.file_type}
                      </span>
                    </div>

                    <h4 style={{ fontSize: '0.85rem', fontWeight: 700, margin: '0 0 0.25rem 0', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                      {docItem.file_name}
                    </h4>
                    <p style={{ fontSize: '0.72rem', color: '#5a6a7e', margin: '0 0 0.5rem 0' }}>
                      Dr. {docItem.doctor_name || 'General Doctor'} · {docItem.clinic_name}
                    </p>
                    
                    {docItem.notes && (
                      <p style={{ fontSize: '0.75rem', color: '#5a6a7e', background: '#f8fafc', padding: '0.4rem', borderRadius: 6, margin: '0 0 1rem 0', border: '1px solid #eef0f3' }}>
                        Note: {docItem.notes}
                      </p>
                    )}

                    <a 
                      href={docItem.file_url} 
                      target="_blank" 
                      rel="noopener noreferrer"
                      className="btn btn-outline" 
                      style={{ width: '100%', padding: '0.45rem', fontSize: '0.8rem', marginTop: 'auto' }}
                    >
                      View File <ArrowUpRight size={12} />
                    </a>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* 4. ACCOUNT SETTINGS AND DPDP ACT CONTROLS */}
        {activeTab === 'ACCOUNT' && (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: '1.5rem' }}>
            
            {/* Account Settings Form */}
            <div className="clinic-card" style={{ padding: '1.75rem' }}>
              <h3 style={{ margin: '0 0 1.25rem 0', fontSize: '1rem', color: '#1a2332' }}>Profile Details</h3>
              
              <form onSubmit={handleUpdateProfile} style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                <div>
                  <label style={{ fontSize: '0.72rem', color: '#5a6a7e', textTransform: 'uppercase', fontWeight: 700, marginBottom: '0.4rem', display: 'block' }}>Full Name</label>
                  <input 
                    type="text" className="input-field" required
                    value={editProfile.full_name} 
                    onChange={e => setEditProfile({...editProfile, full_name: e.target.value})} 
                    placeholder="Abhishek Sen" 
                  />
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.8rem' }}>
                  <div>
                    <label style={{ fontSize: '0.72rem', color: '#5a6a7e', textTransform: 'uppercase', fontWeight: 700, marginBottom: '0.4rem', display: 'block' }}>Date of Birth</label>
                    <input 
                      type="date" className="input-field"
                      value={editProfile.date_of_birth} 
                      onChange={e => setEditProfile({...editProfile, date_of_birth: e.target.value})} 
                    />
                  </div>
                  <div>
                    <label style={{ fontSize: '0.72rem', color: '#5a6a7e', textTransform: 'uppercase', fontWeight: 700, marginBottom: '0.4rem', display: 'block' }}>Gender</label>
                    <select 
                      className="input-field"
                      value={editProfile.gender}
                      onChange={e => setEditProfile({...editProfile, gender: e.target.value})}
                      style={{ height: '46px' }}
                    >
                      <option value="male">Male</option>
                      <option value="female">Female</option>
                      <option value="other">Other</option>
                    </select>
                  </div>
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.8rem' }}>
                  <div>
                    <label style={{ fontSize: '0.72rem', color: '#5a6a7e', textTransform: 'uppercase', fontWeight: 700, marginBottom: '0.4rem', display: 'block' }}>Blood Group</label>
                    <select 
                      className="input-field"
                      value={editProfile.blood_group}
                      onChange={e => setEditProfile({...editProfile, blood_group: e.target.value})}
                      style={{ height: '46px' }}
                    >
                      {['A+', 'A-', 'B+', 'B-', 'O+', 'O-', 'AB+', 'AB-'].map(bg => (
                        <option key={bg} value={bg}>{bg}</option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label style={{ fontSize: '0.72rem', color: '#5a6a7e', textTransform: 'uppercase', fontWeight: 700, marginBottom: '0.4rem', display: 'block' }}>Recovery Login Phone</label>
                    <input 
                      type="tel" className="input-field"
                      value={editProfile.recovery_phone} 
                      onChange={e => setEditProfile({...editProfile, recovery_phone: e.target.value})} 
                      placeholder="+91..." 
                    />
                  </div>
                </div>

                <div>
                  <label style={{ fontSize: '0.72rem', color: '#5a6a7e', textTransform: 'uppercase', fontWeight: 700, marginBottom: '0.4rem', display: 'block' }}>Chronic Conditions (comma separated)</label>
                  <input 
                    type="text" className="input-field"
                    value={editProfile.chronic_conditions} 
                    onChange={e => setEditProfile({...editProfile, chronic_conditions: e.target.value})} 
                    placeholder="e.g. Hypertension, Diabetes" 
                  />
                </div>

                <div>
                  <label style={{ fontSize: '0.72rem', color: '#5a6a7e', textTransform: 'uppercase', fontWeight: 700, marginBottom: '0.4rem', display: 'block' }}>Allergies (comma separated)</label>
                  <input 
                    type="text" className="input-field"
                    value={editProfile.allergies} 
                    onChange={e => setEditProfile({...editProfile, allergies: e.target.value})} 
                    placeholder="e.g. Penicillin, Peanuts" 
                  />
                </div>

                <div style={{ borderTop: '1px solid #eef0f3', paddingTop: '1rem', marginTop: '0.5rem' }}>
                  <label style={{ fontSize: '0.72rem', color: '#5a6a7e', textTransform: 'uppercase', fontWeight: 700, marginBottom: '0.4rem', display: 'block' }}>Emergency Contact Name</label>
                  <input 
                    type="text" className="input-field"
                    value={editProfile.emergency_contact.name} 
                    onChange={e => setEditProfile({...editProfile, emergency_contact: {...editProfile.emergency_contact, name: e.target.value}})} 
                    placeholder="Name" 
                  />
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.8rem' }}>
                  <div>
                    <label style={{ fontSize: '0.72rem', color: '#5a6a7e', textTransform: 'uppercase', fontWeight: 700, marginBottom: '0.4rem', display: 'block' }}>Emergency Phone</label>
                    <input 
                      type="tel" className="input-field"
                      value={editProfile.emergency_contact.phone} 
                      onChange={e => setEditProfile({...editProfile, emergency_contact: {...editProfile.emergency_contact, phone: e.target.value}})} 
                      placeholder="+91..." 
                    />
                  </div>
                  <div>
                    <label style={{ fontSize: '0.72rem', color: '#5a6a7e', textTransform: 'uppercase', fontWeight: 700, marginBottom: '0.4rem', display: 'block' }}>Relation</label>
                    <input 
                      type="text" className="input-field"
                      value={editProfile.emergency_contact.relation} 
                      onChange={e => setEditProfile({...editProfile, emergency_contact: {...editProfile.emergency_contact, relation: e.target.value}})} 
                      placeholder="e.g. Spouse" 
                    />
                  </div>
                </div>

                <button 
                  type="submit" 
                  className="btn btn-primary" 
                  style={{ width: '100%', marginTop: '0.5rem' }}
                  disabled={savingProfile}
                >
                  {savingProfile ? <Loader2 size={16} className="animate-spin" /> : 'Save Profile Details'}
                </button>
              </form>
            </div>

            {/* DPDP Act 2023 Security / Consent Panel */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
              <div className="clinic-card" style={{ padding: '1.75rem', border: '1px solid rgba(0,123,255,0.2)' }}>
                <h3 style={{ margin: '0 0 0.5rem 0', fontSize: '1rem', color: '#1a2332', display: 'flex', alignItems: 'center', gap: '0.45rem' }}>
                  <Activity size={18} color="#007BFF" /> DPDP Act 2023 Compliance
                </h3>
                <p style={{ fontSize: '0.78rem', color: '#5a6a7e', lineHeight: 1.6, marginBottom: '1.25rem' }}>
                  Under the Digital Personal Data Protection (DPDP) Act 2023, you retain absolute authority over your medical history, diagnosis files, and data privacy.
                </p>

                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.8rem' }}>
                  <button 
                    onClick={handleExportData}
                    className="btn btn-outline" 
                    style={{ width: '100%', justifyContent: 'flex-start', fontSize: '0.85rem' }}
                    disabled={exporting}
                  >
                    {exporting ? <Loader2 size={16} className="animate-spin" /> : <><Download size={16} /> Download My Data (JSON)</>}
                  </button>

                  <button 
                    onClick={() => setShowDeleteConfirm(true)}
                    className="btn" 
                    style={{ 
                      width: '100%', justifyContent: 'flex-start', fontSize: '0.85rem',
                      background: 'rgba(220,53,69,0.06)', color: '#dc3545',
                      border: '1px solid rgba(220,53,69,0.18)' 
                    }}
                  >
                    <Trash2 size={16} /> Delete Account &amp; Medical History
                  </button>
                </div>
              </div>

              {/* Privacy Summary Info */}
              <div className="clinic-card" style={{ padding: '1.5rem', background: '#f8fafc' }}>
                <h4 style={{ fontSize: '0.82rem', fontWeight: 700, margin: '0 0 0.5rem 0', display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
                  <ShieldAlert size={14} color="#007BFF" /> Privacy &amp; Data Security
                </h4>
                <ul style={{ margin: 0, paddingLeft: '1.1rem', fontSize: '0.78rem', color: '#5a6a7e', display: 'flex', flexDirection: 'column', gap: '0.4rem' }}>
                  <li>All medical uploads and prescriptions are fully encrypted at rest.</li>
                  <li>Doctors and clinic staff can only access medical files during active queue consultations.</li>
                  <li>Account deletion permanently purges storage files and sanitizes clinic appointment history.</li>
                </ul>
              </div>
            </div>

          </div>
        )}

      </div>

      {/* ── UPLOAD DOCUMENT MODAL ── */}
      {showUploadModal && (
        <div style={{
          position: 'fixed', top: 0, left: 0, width: '100%', height: '100%',
          background: 'rgba(10,20,40,0.55)', backdropFilter: 'blur(8px)',
          zIndex: 9999, display: 'flex', justifyContent: 'center', alignItems: 'center', padding: '1rem'
        }} onClick={(e) => e.target === e.currentTarget && setShowUploadModal(false)}>
          <div className="clinic-card" style={{ width: '100%', maxWidth: 440, padding: 0, overflow: 'hidden', boxShadow: '0 24px 80px rgba(0,0,0,0.2)' }}>
            <div style={{ padding: '1.25rem 1.5rem', borderBottom: '1px solid #eef0f3', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <h3 style={{ margin: 0, fontSize: '1rem', color: '#1a2332' }}>Upload Prescription Pad</h3>
              <button onClick={() => setShowUploadModal(false)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#5a6a7e' }}><X size={20} /></button>
            </div>
            
            <form onSubmit={handleDocUpload} style={{ padding: '1.5rem', display: 'flex', flexDirection: 'column', gap: '1rem' }}>
              <div>
                <label style={{ fontSize: '0.72rem', color: '#5a6a7e', textTransform: 'uppercase', fontWeight: 700, marginBottom: '0.4rem', display: 'block' }}>Choose File (Image/PDF)</label>
                <input 
                  type="file" required accept="image/*,application/pdf"
                  onChange={e => setDocFile(e.target.files?.[0] || null)}
                  style={{ fontSize: '0.85rem' }} 
                />
              </div>

              <div>
                <label style={{ fontSize: '0.72rem', color: '#5a6a7e', textTransform: 'uppercase', fontWeight: 700, marginBottom: '0.4rem', display: 'block' }}>Upload Date</label>
                <input 
                  type="text" className="input-field" readOnly
                  value={new Date().toLocaleDateString()}
                  style={{ background: '#f8fafc', color: '#5a6a7e', cursor: 'not-allowed' }}
                />
              </div>

              <div>
                <label style={{ fontSize: '0.72rem', color: '#5a6a7e', textTransform: 'uppercase', fontWeight: 700, marginBottom: '0.4rem', display: 'block' }}>Doctor Name</label>
                <input 
                  type="text" required className="input-field"
                  value={docDoctorName} onChange={e => setDocDoctorName(e.target.value)}
                  placeholder="e.g. Dr. John Smith" 
                />
              </div>

              <div>
                <label style={{ fontSize: '0.72rem', color: '#5a6a7e', textTransform: 'uppercase', fontWeight: 700, marginBottom: '0.4rem', display: 'block' }}>Short Note (optional)</label>
                <textarea 
                  className="input-field" rows={2}
                  value={docNotes} onChange={e => setDocNotes(e.target.value)}
                  placeholder="e.g. Follow-up prescription for fever" 
                  style={{ resize: 'none' }}
                />
              </div>

              <button 
                type="submit" 
                className="btn btn-primary" 
                style={{ width: '100%', marginTop: '0.5rem' }}
                disabled={uploadingDoc || !docFile}
              >
                {uploadingDoc ? <Loader2 size={16} className="animate-spin" /> : <><Upload size={16} /> Upload document</>}
              </button>
            </form>
          </div>
        </div>
      )}

      {/* ── DPDP ACCOUNT PURGE CONFIRM MODAL ── */}
      {showDeleteConfirm && (
        <div style={{
          position: 'fixed', top: 0, left: 0, width: '100%', height: '100%',
          background: 'rgba(10,20,40,0.55)', backdropFilter: 'blur(8px)',
          zIndex: 9999, display: 'flex', justifyContent: 'center', alignItems: 'center', padding: '1rem'
        }}>
          <div className="clinic-card" style={{ width: '100%', maxWidth: 420, padding: '2rem', textAlign: 'center' }}>
            <ShieldAlert size={48} color="#dc3545" style={{ margin: '0 auto 1rem' }} />
            <h3 style={{ margin: '0 0 0.5rem 0', color: '#1a2332', fontSize: '1.25rem', fontWeight: 800 }}>Confirm Permanent Purge</h3>
            <p style={{ fontSize: '0.85rem', color: '#5a6a7e', lineHeight: 1.6, marginBottom: '1.5rem' }}>
              Are you absolutely sure you want to delete your profile and medical history? This action is permanent and cannot be undone per DPDP Act regulations. All prescription images will be immediately wiped from servers.
            </p>

            <div style={{ display: 'flex', gap: '0.75rem' }}>
              <button 
                onClick={() => setShowDeleteConfirm(false)}
                className="btn btn-outline" 
                style={{ flex: 1 }}
                disabled={deleting}
              >
                Cancel
              </button>
              <button 
                onClick={handleDeleteAccount}
                className="btn" 
                style={{ flex: 1, background: '#dc3545', color: 'white' }}
                disabled={deleting}
              >
                {deleting ? <Loader2 size={16} className="animate-spin" /> : 'Yes, Delete Everything'}
              </button>
            </div>
          </div>
        </div>
      )}

    </main>
  );
}
