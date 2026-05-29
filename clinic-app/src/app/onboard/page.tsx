'use client';

import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { onAuthStateChanged } from 'firebase/auth';
import { auth, db } from '@/lib/firebase';
import { doc, addDoc, getDoc, collection, serverTimestamp } from 'firebase/firestore';
import {
  Building, Stethoscope, ArrowRight, ArrowLeft,
  Loader2, CheckCircle, Clock, XCircle, Sparkles, MapPin, Phone, Mail, Copy
} from 'lucide-react';

export default function OnboardPage() {
  const router = useRouter();
  const [currentUser, setCurrentUser] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [step, setStep] = useState(1); // 1=OrgDetails, 2=ClinicDetails, 3=Submitted/Status
  const [submitting, setSubmitting] = useState(false);
  const [existingRequest, setExistingRequest] = useState<any>(null);

  // Step 1 fields
  const [orgName, setOrgName] = useState('');
  const [orgType, setOrgType] = useState('single_clinic');
  const [city, setCity] = useState('');
  const [contactName, setContactName] = useState('');
  const [contactPhone, setContactPhone] = useState('');
  const [contactEmail, setContactEmail] = useState('');

  // Step 2 fields
  const [clinicName, setClinicName] = useState('');
  const [doctorName, setDoctorName] = useState('');
  const [specialization, setSpecialization] = useState('');
  const [clinicAddress, setClinicAddress] = useState('');
  const [description, setDescription] = useState('');

  useEffect(() => {
    const unsubscribeAuth = onAuthStateChanged(auth, async (user) => {
      if (!user) {
        router.push('/login?redirect=/onboard');
        return;
      }

      setCurrentUser(user);
      if (!contactPhone && user.phoneNumber) {
        setContactPhone(user.phoneNumber);
      }

      // Check if user already has an org (org_admin role)
      const phone = user.phoneNumber;
      if (phone) {
        const adminSnap = await getDoc(doc(db, 'admins', phone));
        if (adminSnap.exists() && adminSnap.data().role === 'org_admin' && adminSnap.data().org_id) {
          router.push('/org');
          return;
        }
      }

      // Check if user already has a pending/rejected request
      // We query by phone since the UID might not be set yet
      // For simplicity, store request ID in localStorage after first submit
      const savedRequestId = localStorage.getItem('qpulse_request_id');
      if (savedRequestId) {
        try {
          const reqSnap = await getDoc(doc(db, 'org_requests', savedRequestId));
          if (reqSnap.exists()) {
            setExistingRequest({ id: reqSnap.id, ...reqSnap.data() });
            setStep(3);
          }
        } catch (e) {
          // Request might not exist or permission denied — continue to form
        }
      }

      setLoading(false);
    });
    return () => unsubscribeAuth();
  }, [router]);

  const handleStep1Next = (e: React.FormEvent) => {
    e.preventDefault();
    if (!orgName.trim() || !city.trim() || !contactName.trim()) return;
    setStep(2);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!clinicName || !doctorName) return;
    setSubmitting(true);

    try {
      const requestPayload = {
        // Organization details
        org_name: orgName.trim(),
        org_type: orgType,
        city: city.trim(),
        // Contact
        contact_name: contactName.trim(),
        contact_phone: contactPhone.trim(),
        contact_email: contactEmail.trim(),
        submitter_uid: currentUser.uid,
        // First clinic details
        first_clinic_name: clinicName.trim(),
        first_doctor_name: doctorName.trim(),
        first_specialization: specialization.trim() || 'General Physician',
        first_clinic_address: clinicAddress.trim(),
        description: description.trim(),
        // Status
        status: 'PENDING',
        submitted_at: serverTimestamp(),
      };

      const docRef = await addDoc(collection(db, 'org_requests'), requestPayload);

      // Save locally so we can show status on return visits
      localStorage.setItem('qpulse_request_id', docRef.id);

      setExistingRequest({ id: docRef.id, ...requestPayload, status: 'PENDING' });
      setStep(3);
    } catch (err: any) {
      console.error(err);
      alert(`Submission failed: ${err.message || 'Unknown error'}`);
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return (
      <div style={{ display: 'grid', placeItems: 'center', minHeight: '100vh' }}>
        <Loader2 size={40} className="animate-spin" style={{ color: '#007BFF' }} />
      </div>
    );
  }

  return (
    <main style={{ minHeight: '90vh', display: 'grid', placeItems: 'center', padding: '2rem 1rem' }}>
      <div className="clinic-card" style={{ width: '100%', maxWidth: 560, padding: '2.5rem' }}>

        {/* Header */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '2rem', borderBottom: '1px solid #eef0f3', paddingBottom: '1rem' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.45rem' }}>
            <Sparkles size={20} color="#007BFF" />
            <span style={{ fontWeight: 800, fontSize: '1rem', color: '#1a2332' }}>Join Q-PULSE</span>
          </div>
          {step < 3 && (
            <span style={{ fontSize: '0.8rem', color: '#5a6a7e', fontWeight: 600 }}>Step {step} of 2</span>
          )}
        </div>

        {/* ── STEP 1: ORGANIZATION DETAILS ── */}
        {step === 1 && (
          <form onSubmit={handleStep1Next} style={{ display: 'flex', flexDirection: 'column', gap: '1.1rem' }}>
            <div>
              <h2 style={{ fontSize: '1.2rem', color: '#1a2332', fontWeight: 800, margin: 0 }}>About Your Organization</h2>
              <p style={{ fontSize: '0.82rem', color: '#5a6a7e', margin: '0.4rem 0 0' }}>
                Tell us about your hospital or clinic network. Your application will be reviewed by our team.
              </p>
            </div>

            <div>
              <label style={{ fontSize: '0.72rem', color: '#5a6a7e', textTransform: 'uppercase', fontWeight: 700, marginBottom: '0.4rem', display: 'block' }}>Organization / Hospital Name *</label>
              <input
                type="text" required className="input-field"
                value={orgName} onChange={e => setOrgName(e.target.value)}
                placeholder="e.g. City Health Group, Apollo Clinic"
              />
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.8rem' }}>
              <div>
                <label style={{ fontSize: '0.72rem', color: '#5a6a7e', textTransform: 'uppercase', fontWeight: 700, marginBottom: '0.4rem', display: 'block' }}>Organization Type *</label>
                <select className="input-field" value={orgType} onChange={e => setOrgType(e.target.value)} style={{ height: '46px' }}>
                  <option value="single_clinic">Single Doctor Clinic</option>
                  <option value="multi_clinic">Multi-Clinic Network</option>
                  <option value="hospital">Hospital Group</option>
                  <option value="diagnostic_center">Diagnostic Center</option>
                </select>
              </div>
              <div>
                <label style={{ fontSize: '0.72rem', color: '#5a6a7e', textTransform: 'uppercase', fontWeight: 700, marginBottom: '0.4rem', display: 'block' }}>City *</label>
                <div style={{ position: 'relative' }}>
                  <MapPin size={14} style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)', color: '#5a6a7e' }} />
                  <input type="text" required className="input-field" style={{ paddingLeft: '2rem' }}
                    value={city} onChange={e => setCity(e.target.value)} placeholder="e.g. Mumbai" />
                </div>
              </div>
            </div>

            <div>
              <label style={{ fontSize: '0.72rem', color: '#5a6a7e', textTransform: 'uppercase', fontWeight: 700, marginBottom: '0.4rem', display: 'block' }}>Your Full Name (Point of Contact) *</label>
              <input type="text" required className="input-field"
                value={contactName} onChange={e => setContactName(e.target.value)} placeholder="e.g. Dr. Rajan Sharma" />
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.8rem' }}>
              <div>
                <label style={{ fontSize: '0.72rem', color: '#5a6a7e', textTransform: 'uppercase', fontWeight: 700, marginBottom: '0.4rem', display: 'block' }}>Contact Phone *</label>
                <div style={{ position: 'relative' }}>
                  <Phone size={14} style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)', color: '#5a6a7e' }} />
                  <input type="tel" required className="input-field" style={{ paddingLeft: '2rem' }}
                    value={contactPhone} onChange={e => setContactPhone(e.target.value)} placeholder="+91 9999999999" />
                </div>
              </div>
              <div>
                <label style={{ fontSize: '0.72rem', color: '#5a6a7e', textTransform: 'uppercase', fontWeight: 700, marginBottom: '0.4rem', display: 'block' }}>Contact Email</label>
                <div style={{ position: 'relative' }}>
                  <Mail size={14} style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)', color: '#5a6a7e' }} />
                  <input type="email" className="input-field" style={{ paddingLeft: '2rem' }}
                    value={contactEmail} onChange={e => setContactEmail(e.target.value)} placeholder="admin@yourclinic.com" />
                </div>
              </div>
            </div>

            <button type="submit" className="btn btn-primary" style={{ width: '100%', marginTop: '0.5rem' }}>
              Next: Clinic Details <ArrowRight size={16} />
            </button>
          </form>
        )}

        {/* ── STEP 2: FIRST CLINIC DETAILS ── */}
        {step === 2 && (
          <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '1.1rem' }}>
            <div>
              <h2 style={{ fontSize: '1.2rem', color: '#1a2332', fontWeight: 800, margin: 0 }}>Your First Clinic Room</h2>
              <p style={{ fontSize: '0.82rem', color: '#5a6a7e', margin: '0.4rem 0 0' }}>
                Provide details for your primary clinic. You can add more after approval.
              </p>
            </div>

            <div>
              <label style={{ fontSize: '0.72rem', color: '#5a6a7e', textTransform: 'uppercase', fontWeight: 700, marginBottom: '0.4rem', display: 'block' }}>Clinic Name *</label>
              <input type="text" required className="input-field"
                value={clinicName} onChange={e => setClinicName(e.target.value)} placeholder="e.g. General OPD, Cardiology Suite" />
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.8rem' }}>
              <div>
                <label style={{ fontSize: '0.72rem', color: '#5a6a7e', textTransform: 'uppercase', fontWeight: 700, marginBottom: '0.4rem', display: 'block' }}>Primary Doctor *</label>
                <input type="text" required className="input-field"
                  value={doctorName} onChange={e => setDoctorName(e.target.value)} placeholder="Dr. Full Name" />
              </div>
              <div>
                <label style={{ fontSize: '0.72rem', color: '#5a6a7e', textTransform: 'uppercase', fontWeight: 700, marginBottom: '0.4rem', display: 'block' }}>Specialization</label>
                <input type="text" className="input-field"
                  value={specialization} onChange={e => setSpecialization(e.target.value)} placeholder="General Physician" />
              </div>
            </div>

            <div>
              <label style={{ fontSize: '0.72rem', color: '#5a6a7e', textTransform: 'uppercase', fontWeight: 700, marginBottom: '0.4rem', display: 'block' }}>Clinic Address / Location</label>
              <input type="text" className="input-field"
                value={clinicAddress} onChange={e => setClinicAddress(e.target.value)} placeholder="e.g. 2nd Floor, City Mall, Bandra" />
            </div>

            <div>
              <label style={{ fontSize: '0.72rem', color: '#5a6a7e', textTransform: 'uppercase', fontWeight: 700, marginBottom: '0.4rem', display: 'block' }}>
                Brief Description <span style={{ fontWeight: 400 }}>(optional)</span>
              </label>
              <textarea className="input-field" style={{ height: 80, resize: 'none' }}
                value={description} onChange={e => setDescription(e.target.value)}
                placeholder="Tell us briefly about your practice or clinic (services, patient volume, etc.)" />
            </div>

            <div style={{ display: 'flex', gap: '0.75rem', marginTop: '0.25rem' }}>
              <button type="button" onClick={() => setStep(1)} className="btn btn-outline" style={{ flex: 1 }}>
                <ArrowLeft size={16} /> Back
              </button>
              <button type="submit" className="btn btn-primary" style={{ flex: 2 }} disabled={submitting}>
                {submitting ? <Loader2 size={16} className="animate-spin" /> : <><Stethoscope size={16} /> Submit Application</>}
              </button>
            </div>
          </form>
        )}

        {/* ── STEP 3: STATUS SCREEN ── */}
        {step === 3 && existingRequest && (
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '1.5rem', textAlign: 'center', padding: '1rem 0' }}>
            {existingRequest.status === 'PENDING' && (
              <>
                <div style={{ width: 72, height: 72, borderRadius: '50%', background: 'rgba(251,191,36,0.1)', border: '2px solid rgba(251,191,36,0.3)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <Clock size={34} color="#f59e0b" />
                </div>
                <div>
                  <h2 style={{ fontSize: '1.25rem', fontWeight: 800, color: '#1a2332', margin: 0 }}>Application Submitted!</h2>
                  <p style={{ fontSize: '0.85rem', color: '#5a6a7e', marginTop: '0.5rem', lineHeight: 1.6 }}>
                    Your application for <strong>{existingRequest.org_name}</strong> is under review.<br />
                    You will receive access once approved by our team.
                  </p>
                </div>
                <div style={{ background: '#f8fafc', border: '1px solid #eef0f3', borderRadius: 12, padding: '1rem 1.5rem', width: '100%', textAlign: 'left' }}>
                  <div style={{ fontSize: '0.72rem', color: '#5a6a7e', textTransform: 'uppercase', fontWeight: 700, marginBottom: '0.75rem' }}>Submission Summary</div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem', fontSize: '0.82rem' }}>
                    <div><span style={{ color: '#5a6a7e' }}>Organization:</span> <strong>{existingRequest.org_name}</strong></div>
                    <div><span style={{ color: '#5a6a7e' }}>First Clinic:</span> <strong>{existingRequest.first_clinic_name}</strong></div>
                    <div><span style={{ color: '#5a6a7e' }}>Doctor:</span> <strong>{existingRequest.first_doctor_name}</strong></div>
                    <div><span style={{ color: '#5a6a7e' }}>City:</span> <strong>{existingRequest.city}</strong></div>
                  </div>
                </div>
                <div style={{ fontSize: '0.78rem', color: '#94a3b8', margin: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.5rem' }}>
                  Reference ID: <code style={{ background: '#f1f5f9', padding: '2px 6px', borderRadius: 4, fontSize: '0.72rem' }}>{existingRequest.id}</code>
                  <button onClick={() => {
                    navigator.clipboard.writeText(existingRequest.id);
                    alert('Reference ID copied to clipboard!');
                  }} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#007BFF', display: 'flex', alignItems: 'center' }} title="Copy Reference ID">
                    <Copy size={14} />
                  </button>
                </div>
              </>
            )}

            {existingRequest.status === 'APPROVED' && (
              <>
                <div style={{ width: 72, height: 72, borderRadius: '50%', background: 'rgba(16,185,129,0.1)', border: '2px solid rgba(16,185,129,0.3)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <CheckCircle size={34} color="#10b981" />
                </div>
                <div>
                  <h2 style={{ fontSize: '1.25rem', fontWeight: 800, color: '#1a2332', margin: 0 }}>Application Approved!</h2>
                  <p style={{ fontSize: '0.85rem', color: '#5a6a7e', marginTop: '0.5rem' }}>
                    Your organization has been activated. Click below to access your dashboard.
                  </p>
                </div>
                <button className="btn btn-primary" style={{ width: '100%' }} onClick={() => router.push('/org')}>
                  Go to Org Dashboard <ArrowRight size={16} />
                </button>
              </>
            )}

            {existingRequest.status === 'REJECTED' && (
              <>
                <div style={{ width: 72, height: 72, borderRadius: '50%', background: 'rgba(239,68,68,0.1)', border: '2px solid rgba(239,68,68,0.3)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <XCircle size={34} color="#ef4444" />
                </div>
                <div>
                  <h2 style={{ fontSize: '1.25rem', fontWeight: 800, color: '#1a2332', margin: 0 }}>Application Not Approved</h2>
                  {existingRequest.rejection_reason && (
                    <div style={{ background: 'rgba(239,68,68,0.05)', border: '1px solid rgba(239,68,68,0.2)', borderRadius: 10, padding: '0.75rem 1rem', marginTop: '0.75rem', fontSize: '0.82rem', color: '#5a6a7e', textAlign: 'left' }}>
                      <strong style={{ color: '#ef4444' }}>Reason: </strong>{existingRequest.rejection_reason}
                    </div>
                  )}
                </div>
                <button className="btn btn-outline" style={{ width: '100%' }} onClick={() => {
                  localStorage.removeItem('qpulse_request_id');
                  setExistingRequest(null);
                  setStep(1);
                }}>
                  Submit a New Application
                </button>
              </>
            )}
          </div>
        )}

      </div>
    </main>
  );
}
