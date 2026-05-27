'use client';

import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { onAuthStateChanged } from 'firebase/auth';
import { auth } from '@/lib/firebase';
import { doc, setDoc, addDoc, collection, serverTimestamp } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { 
  Building, CreditCard, Stethoscope, ArrowRight, ArrowLeft, 
  Loader2, Check, Sparkles, Zap, Shield 
} from 'lucide-react';

export default function OnboardPage() {
  const router = useRouter();
  const [currentUser, setCurrentUser] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [step, setStep] = useState(1);
  
  // Step 1 State: Org Details
  const [orgName, setOrgName] = useState('');
  const [orgType, setOrgType] = useState('single_clinic'); // 'single_clinic' | 'chain' | 'hospital'
  
  // Step 2 State: Choose Plan
  const [selectedPlan, setSelectedPlan] = useState<'free' | 'basic' | 'pro'>('free');

  // Step 3 State: Payment Processing
  const [isPaying, setIsPaying] = useState(false);
  const [orgId, setOrgId] = useState('');
  
  // Step 4 State: Seed First Clinic
  const [clinicName, setClinicName] = useState('');
  const [doctorName, setDoctorName] = useState('');
  const [authorizedPhone, setAuthorizedPhone] = useState('');
  const [isSubmittingClinic, setIsSubmittingClinic] = useState(false);

  useEffect(() => {
    const unsubscribeAuth = onAuthStateChanged(auth, (user) => {
      if (!user) {
        router.push('/login?redirect=/onboard');
        return;
      }
      setCurrentUser(user);
      setLoading(false);
    });
    return () => unsubscribeAuth();
  }, [router]);

  const handleStep1Submit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!orgName.trim()) return;
    setStep(2);
  };

  const handleStep2Submit = async () => {
    setIsPaying(true);
    try {
      // 1. Create a draft Organization Document
      const newOrgRef = doc(collection(db, 'organizations'));
      const generatedOrgId = newOrgRef.id;
      setOrgId(generatedOrgId);

      const orgPayload = {
        id: generatedOrgId,
        name: orgName,
        slug: orgName.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, ''),
        owner_uid: currentUser.uid,
        owner_phone: currentUser.phoneNumber || '',
        plan: selectedPlan,
        max_clinics: selectedPlan === 'free' ? 1 : selectedPlan === 'basic' ? 3 : 10,
        max_tokens_per_day: selectedPlan === 'free' ? 50 : 99999,
        billing_status: selectedPlan === 'free' ? 'active' : 'trial', // Default to active for free, trial/pending for paid
        billing_cycle_end: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000), // 30 days out
        features: {
          sms_notifications: selectedPlan !== 'free',
          whatsapp_notifications: selectedPlan === 'pro',
          patient_records: true,
          prescription_storage: true,
          analytics_dashboard: selectedPlan !== 'free',
          custom_branding: selectedPlan === 'pro',
          api_access: selectedPlan === 'pro'
        },
        created_at: serverTimestamp(),
        updated_at: serverTimestamp()
      };

      await setDoc(newOrgRef, orgPayload);

      // 2. Add this phone number to the admins collection as org_admin
      const adminRef = doc(db, 'admins', currentUser.phoneNumber);
      await setDoc(adminRef, {
        phone: currentUser.phoneNumber,
        uid: currentUser.uid,
        name: currentUser.displayName || orgName + ' Admin',
        role: 'org_admin',
        org_id: generatedOrgId,
        is_active: true,
        added_by: 'system_onboard',
        added_at: serverTimestamp()
      }, { merge: true });

      // 3. Initiate payment or jump to next step
      if (selectedPlan === 'free') {
        setStep(4);
      } else {
        // Call backend to create Razorpay Subscription
        const res = await fetch('/api/billing/create-subscription', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ plan: selectedPlan, orgId: generatedOrgId })
        });
        
        const subData = await res.json();
        if (subData.error) throw new Error(subData.error);

        if (subData.isMock) {
          // If in mock dev mode, immediately activate
          const { updateDoc } = await import('firebase/firestore');
          await updateDoc(doc(db, 'organizations', generatedOrgId), {
            billing_status: 'active',
            razorpay_subscription_id: subData.subscription_id
          });
          setStep(4);
        } else {
          // Load Razorpay checkout script dynamically
          const loadRazorpay = () => {
            return new Promise((resolve) => {
              const script = document.createElement('script');
              script.src = 'https://checkout.razorpay.com/v1/checkout.js';
              script.onload = () => resolve(true);
              script.onerror = () => resolve(false);
              document.body.appendChild(script);
            });
          };

          const isLoaded = await loadRazorpay();
          if (!isLoaded) throw new Error('Razorpay SDK failed to load.');

          const options = {
            key: process.env.NEXT_PUBLIC_RAZORPAY_KEY_ID || 'rzp_test_mock',
            subscription_id: subData.subscription_id,
            name: 'Q-PULSE Network',
            description: `Onboarding: ${selectedPlan.toUpperCase()} Plan`,
            handler: async (response: any) => {
              // Wait a few seconds for the webhook to execute, then proceed
              alert('Payment Authorized! Transitioning to clinic setup...');
              setStep(4);
            },
            prefill: {
              contact: currentUser.phoneNumber || ''
            },
            theme: { color: '#007BFF' }
          };

          const rzp = new (window as any).Razorpay(options);
          rzp.open();
        }
      }
    } catch (err: any) {
      console.error(err);
      alert(`Onboarding step failed: ${err.message || 'Unknown error'}`);
    } finally {
      setIsPaying(false);
    }
  };

  const handleStep4Submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!clinicName || !doctorName || !authorizedPhone) return;
    setIsSubmittingClinic(true);

    try {
      const cleanPhone = authorizedPhone.replace(/[^0-9+]/g, '');
      const finalPhone = cleanPhone.startsWith('+') ? cleanPhone : `+91${cleanPhone}`;

      // Create first clinic associated with the org ID
      const clinicPayload = {
        name: clinicName,
        doctor_name: doctorName,
        location: 'Main Center',
        authorized_phone: finalPhone,
        org_id: orgId, // Bind to the newly created Organization!
        is_open: true,
        is_hidden: false,
        patient_count: 0,
        last_issued_token: 0,
        currently_serving_token: '--',
        fees: 500,
        notification_config: {
          sms_enabled: selectedPlan !== 'free',
          fcm_enabled: true,
          whatsapp_enabled: false,
          notify_at_positions_before: 2,
          notify_message_template: 'Your turn is coming up at {clinic}!'
        },
        created_at: serverTimestamp(),
        updated_at: serverTimestamp()
      };

      await addDoc(collection(db, 'clinics'), clinicPayload);
      alert('Clinic configured successfully! Welcome to Q-PULSE SaaS!');
      
      // Redirect to Organization Dashboard
      router.push('/org');
    } catch (err) {
      console.error(err);
      alert('Failed to configure your first clinic.');
    } finally {
      setIsSubmittingClinic(false);
    }
  };

  if (loading) {
    return (
      <div style={{ display: 'grid', placeItems: 'center', minHeight: '100vh' }}>
        <div style={{ textAlign: 'center' }}>
          <Loader2 size={40} className="animate-spin" style={{ color: '#007BFF', margin: '0 auto 1rem' }} />
          <p style={{ color: '#5a6a7e', fontWeight: 500 }}>Preparing onboarding portal…</p>
        </div>
      </div>
    );
  }

  return (
    <main style={{ minHeight: '90vh', display: 'grid', placeItems: 'center', padding: '2rem 1rem' }}>
      <div className="clinic-card" style={{ width: '100%', maxWidth: 540, padding: '2.5rem' }}>
        
        {/* Step Indicator Header */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '2rem', borderBottom: '1px solid #eef0f3', paddingBottom: '1rem' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.45rem' }}>
            <Sparkles size={20} color="#007BFF" />
            <span style={{ fontWeight: 800, fontSize: '1rem', color: '#1a2332' }}>SaaS Onboarding</span>
          </div>
          <span style={{ fontSize: '0.8rem', color: '#5a6a7e', fontWeight: 600 }}>Step {step} of 4</span>
        </div>

        {/* ── STEP 1: ORGANIZATION DETAILS ── */}
        {step === 1 && (
          <form onSubmit={handleStep1Submit} style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
            <h2 style={{ fontSize: '1.25rem', color: '#1a2332', fontWeight: 800 }}>Create your Healthcare Organization</h2>
            <p style={{ fontSize: '0.82rem', color: '#5a6a7e', margin: 0, marginTop: '-0.75rem' }}>
              Your organization binds clinics, medical records, billing subscriptions, and custom brand settings.
            </p>

            <div>
              <label style={{ fontSize: '0.72rem', color: '#5a6a7e', textTransform: 'uppercase', fontWeight: 700, marginBottom: '0.4rem', display: 'block' }}>Organization / Hospital Name</label>
              <input 
                type="text" required className="input-field"
                value={orgName} onChange={e => setOrgName(e.target.value)}
                placeholder="e.g. Apollo Diagnostics, City Health Group" 
              />
            </div>

            <div>
              <label style={{ fontSize: '0.72rem', color: '#5a6a7e', textTransform: 'uppercase', fontWeight: 700, marginBottom: '0.4rem', display: 'block' }}>Healthcare Type</label>
              <select className="input-field" value={orgType} onChange={e => setOrgType(e.target.value)} style={{ height: '46px' }}>
                <option value="single_clinic">Single Doctor Clinic</option>
                <option value="chain">Multi-clinic Network / Chain</option>
                <option value="hospital">Hospital Group</option>
              </select>
            </div>

            <button type="submit" className="btn btn-primary" style={{ width: '100%', marginTop: '0.5rem' }}>
              Next Step: Choose Plan <ArrowRight size={16} />
            </button>
          </form>
        )}

        {/* ── STEP 2: CHOOSE PLAN ── */}
        {step === 2 && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
            <h2 style={{ fontSize: '1.25rem', color: '#1a2332', fontWeight: 800 }}>Select subscription plan</h2>
            <p style={{ fontSize: '0.82rem', color: '#5a6a7e', margin: 0, marginTop: '-0.75rem' }}>
              Each plan supports billing limits tailored for scale.
            </p>

            {/* Plans List */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
              {[
                { id: 'free', name: 'Free Tier', price: '₹0', clinics: '1 Clinic Limit', desc: 'Basic live queue token assignment only.', icon: <Shield size={18} color="#5a6a7e" /> },
                { id: 'basic', name: 'Basic SaaS', price: '₹999/mo', clinics: '3 Clinic Limit', desc: 'Includes SMS notifications + patient medical timeline.', icon: <Zap size={18} color="#007BFF" /> },
                { id: 'pro', name: 'Pro Enterprise', price: '₹2,999/mo', clinics: '10 Clinic Limit', desc: 'WhatsApp support, full analytics, custom branding, API access.', icon: <Sparkles size={18} color="#ffb000" /> }
              ].map(plan => (
                <div 
                  key={plan.id}
                  onClick={() => setSelectedPlan(plan.id as any)}
                  style={{
                    padding: '1.25rem', border: `2px solid ${selectedPlan === plan.id ? '#007BFF' : '#eef0f3'}`,
                    borderRadius: 14, cursor: 'pointer', display: 'flex', gap: '1rem',
                    background: selectedPlan === plan.id ? 'rgba(0,123,255,0.03)' : '#fff',
                    transition: 'all 0.2s'
                  }}
                >
                  <div style={{ marginTop: '0.2rem' }}>{plan.icon}</div>
                  <div style={{ flex: 1 }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <strong style={{ fontSize: '0.92rem', color: '#1a2332' }}>{plan.name}</strong>
                      <strong style={{ fontSize: '1rem', color: '#007BFF' }}>{plan.price}</strong>
                    </div>
                    <p style={{ margin: '0.25rem 0', fontSize: '0.75rem', color: '#5a6a7e' }}>{plan.clinics}</p>
                    <p style={{ margin: 0, fontSize: '0.75rem', color: '#5a6a7e', lineHeight: 1.4 }}>{plan.desc}</p>
                  </div>
                </div>
              ))}
            </div>

            <div style={{ display: 'flex', gap: '0.75rem', marginTop: '0.5rem' }}>
              <button onClick={() => setStep(1)} className="btn btn-outline" style={{ flex: 1 }}>
                <ArrowLeft size={16} /> Back
              </button>
              <button onClick={handleStep2Submit} className="btn btn-primary" style={{ flex: 2 }} disabled={isPaying}>
                {isPaying ? <Loader2 size={16} className="animate-spin" /> : <><CreditCard size={16} /> Subscribe &amp; Pay</>}
              </button>
            </div>
          </div>
        )}

        {/* ── STEP 4: SEED FIRST CLINIC ── */}
        {step === 4 && (
          <form onSubmit={handleStep4Submit} style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
            <h2 style={{ fontSize: '1.25rem', color: '#1a2332', fontWeight: 800 }}>Configure First Clinic</h2>
            <p style={{ fontSize: '0.82rem', color: '#5a6a7e', margin: 0, marginTop: '-0.75rem' }}>
              Provide details for your initial queue room.
            </p>

            <div>
              <label style={{ fontSize: '0.72rem', color: '#5a6a7e', textTransform: 'uppercase', fontWeight: 700, marginBottom: '0.4rem', display: 'block' }}>Clinic Name</label>
              <input 
                type="text" required className="input-field"
                value={clinicName} onChange={e => setClinicName(e.target.value)}
                placeholder="e.g. Apollo Dental Center, City Clinic Room 1" 
              />
            </div>

            <div>
              <label style={{ fontSize: '0.72rem', color: '#5a6a7e', textTransform: 'uppercase', fontWeight: 700, marginBottom: '0.4rem', display: 'block' }}>Primary Doctor Name</label>
              <input 
                type="text" required className="input-field"
                value={doctorName} onChange={e => setDoctorName(e.target.value)}
                placeholder="e.g. Dr. John Smith" 
              />
            </div>

            <div>
              <label style={{ fontSize: '0.72rem', color: '#5a6a7e', textTransform: 'uppercase', fontWeight: 700, marginBottom: '0.4rem', display: 'block' }}>Authorized Staff Phone Number (for dashboard login)</label>
              <input 
                type="tel" required className="input-field"
                value={authorizedPhone} onChange={e => setAuthorizedPhone(e.target.value)}
                placeholder="e.g. +91XXXXXXXXXX" 
              />
            </div>

            <button type="submit" className="btn btn-primary" style={{ width: '100%', marginTop: '0.5rem' }} disabled={isSubmittingClinic}>
              {isSubmittingClinic ? <Loader2 size={16} className="animate-spin" /> : <><Stethoscope size={16} /> Finish Setup &amp; Launch Dashboard</>}
            </button>
          </form>
        )}

      </div>
    </main>
  );
}
