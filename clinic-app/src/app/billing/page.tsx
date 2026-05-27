'use client';

import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { onAuthStateChanged } from 'firebase/auth';
import { auth } from '@/lib/firebase';
import { doc, getDoc, updateDoc, serverTimestamp, onSnapshot } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { 
  CreditCard, ShieldCheck, HelpCircle, Loader2, 
  ArrowLeft, Check, AlertTriangle, Sparkles, Zap, Building 
} from 'lucide-react';

export default function BillingPage() {
  const router = useRouter();
  const [currentUser, setCurrentUser] = useState<any>(null);
  const [org, setOrg] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [isUpdating, setIsUpdating] = useState(false);

  useEffect(() => {
    let unsubscribeOrg: () => void;
    
    const unsubscribeAuth = onAuthStateChanged(auth, async (user) => {
      if (!user) {
        router.push('/login?redirect=/billing');
        return;
      }
      setCurrentUser(user);

      try {
        const phone = user.phoneNumber;
        if (!phone) {
          router.push('/');
          return;
        }

        const adminSnap = await getDoc(doc(db, 'admins', phone));
        if (!adminSnap.exists()) {
          router.push('/onboard');
          return;
        }

        const orgId = adminSnap.data().org_id;
        if (!orgId) {
          router.push('/onboard');
          return;
        }

        // Subscribe to Org changes
        unsubscribeOrg = onSnapshot(doc(db, 'organizations', orgId), (snapshot) => {
          if (snapshot.exists()) {
            setOrg({ id: snapshot.id, ...snapshot.data() });
          }
          setLoading(false);
        });

      } catch (err) {
        console.error(err);
        setLoading(false);
      }
    });

    return () => {
      unsubscribeAuth();
      if (unsubscribeOrg) unsubscribeOrg();
    };
  }, [router]);

  const handlePlanChange = async (plan: 'free' | 'basic' | 'pro') => {
    if (!org) return;
    if (org.plan === plan) {
      alert('You are already subscribed to this plan.');
      return;
    }

    if (confirm(`Confirm change subscription plan from ${org.plan.toUpperCase()} to ${plan.toUpperCase()}?`)) {
      setIsUpdating(true);
      try {
        if (plan === 'free') {
          // Downgrade to free immediately
          await updateDoc(doc(db, 'organizations', org.id), {
            plan: 'free',
            max_clinics: 1,
            max_tokens_per_day: 50,
            billing_status: 'active',
            'features.sms_notifications': false,
            'features.whatsapp_notifications': false,
            'features.analytics_dashboard': false,
            'features.custom_branding': false,
            'features.api_access': false,
            updated_at: serverTimestamp()
          });
          alert('Downgraded to Free Tier successfully.');
        } else {
          // Call subscription API
          const res = await fetch('/api/billing/create-subscription', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ plan, orgId: org.id })
          });
          const subData = await res.json();
          if (subData.error) throw new Error(subData.error);

          if (subData.isMock) {
            // Mock mode activation
            await updateDoc(doc(db, 'organizations', org.id), {
              plan: plan,
              max_clinics: plan === 'basic' ? 3 : 10,
              max_tokens_per_day: 99999,
              billing_status: 'active',
              razorpay_subscription_id: subData.subscription_id,
              'features.sms_notifications': true,
              'features.whatsapp_notifications': plan === 'pro',
              'features.analytics_dashboard': true,
              'features.custom_branding': plan === 'pro',
              'features.api_access': plan === 'pro',
              updated_at: serverTimestamp()
            });
            alert(`Upgraded to ${plan.toUpperCase()} (mock payment verified) successfully!`);
          } else {
            // Load Razorpay Script
            const options = {
              key: process.env.NEXT_PUBLIC_RAZORPAY_KEY_ID || 'rzp_test_mock',
              subscription_id: subData.subscription_id,
              name: 'Q-PULSE Network',
              description: `Upgrade Plan to ${plan.toUpperCase()}`,
              handler: async (response: any) => {
                alert('Upgrade Payment Authorized! Subscriptions details updating...');
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
        alert(`Billing Action failed: ${err.message || 'Unknown error'}`);
      } finally {
        setIsUpdating(false);
      }
    }
  };

  if (loading) {
    return (
      <div style={{ display: 'grid', placeItems: 'center', minHeight: '100vh' }}>
        <div style={{ textAlign: 'center' }}>
          <Loader2 size={40} className="animate-spin" style={{ color: '#007BFF', margin: '0 auto 1rem' }} />
          <p style={{ color: '#5a6a7e', fontWeight: 500 }}>Loading subscriptions details…</p>
        </div>
      </div>
    );
  }

  const isSuspended = org?.billing_status === 'suspended';

  return (
    <main style={{ minHeight: '100vh', background: '#f8fafc', padding: '2rem 1rem' }}>
      <div style={{ maxWidth: 860, margin: '0 auto' }}>
        
        {/* Back Link */}
        <button 
          onClick={() => router.push('/org')}
          style={{
            background: 'none', border: 'none', color: '#007BFF', 
            fontSize: '0.85rem', display: 'inline-flex', alignItems: 'center', 
            gap: '0.4rem', cursor: 'pointer', marginBottom: '1.5rem', fontWeight: 600
          }}
        >
          <ArrowLeft size={16} /> Back to Dashboard
        </button>

        {/* Current Subscription Card */}
        <div className="clinic-card" style={{ padding: '2rem', marginBottom: '2rem', display: 'flex', flexWrap: 'wrap', justifyContent: 'space-between', alignItems: 'center', gap: '1.5rem' }}>
          <div>
            <span style={{ fontSize: '0.72rem', color: '#5a6a7e', textTransform: 'uppercase', fontWeight: 700, display: 'block', marginBottom: '0.4rem' }}>Current Subscribed Plan</span>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.3rem' }}>
              <h1 style={{ fontSize: '1.6rem', margin: 0, fontWeight: 900, color: '#1a2332' }}>
                {org?.plan?.toUpperCase()} Plan
              </h1>
              <span style={{
                fontSize: '0.72rem', padding: '2px 8px', borderRadius: 12, fontWeight: 700,
                background: org?.billing_status === 'active' ? 'rgba(40,167,69,0.1)' : 'rgba(220,53,69,0.1)',
                color: org?.billing_status === 'active' ? '#28a745' : '#dc3545'
              }}>
                {org?.billing_status?.toUpperCase()}
              </span>
            </div>
            <p style={{ margin: 0, fontSize: '0.8rem', color: '#5a6a7e' }}>
              Renewal Date: {org?.billing_cycle_end?.toDate ? org.billing_cycle_end.toDate().toLocaleDateString() : '—'}
            </p>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.35rem', textAlign: 'right' }}>
            <span style={{ fontSize: '0.75rem', color: '#5a6a7e' }}>SaaS Org Ref ID</span>
            <code style={{ fontSize: '0.78rem', color: '#1a2332', background: '#f1f5f9', padding: '0.2rem 0.5rem', borderRadius: 4 }}>{org?.id}</code>
          </div>
        </div>

        {/* Pricing Grid Header */}
        <div style={{ textAlign: 'center', marginBottom: '2.5rem' }}>
          <h2 style={{ fontSize: '1.35rem', color: '#1a2332', fontWeight: 800, marginBottom: '0.5rem' }}>SaaS Subscription Matrix</h2>
          <p style={{ fontSize: '0.88rem', color: '#5a6a7e', margin: 0 }}>Choose a plan matching your healthcare operations.</p>
        </div>

        {/* Plan Cards Grid */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(250px, 1fr))', gap: '1.5rem' }}>
          
          {/* FREE PLAN */}
          <div className="clinic-card" style={{ padding: '2rem', display: 'flex', flexDirection: 'column', background: '#fff', border: org?.plan === 'free' ? '2.5px solid #007BFF' : '1px solid #eef0f3' }}>
            <h3 style={{ margin: 0, fontSize: '1.05rem', color: '#1a2332' }}>Free Tier</h3>
            <div style={{ margin: '1rem 0' }}>
              <strong style={{ fontSize: '2rem', color: '#1a2332' }}>₹0</strong>
              <span style={{ fontSize: '0.8rem', color: '#5a6a7e' }}> / forever</span>
            </div>
            
            <ul style={{ margin: '0 0 2rem 0', paddingLeft: '1.1rem', fontSize: '0.8rem', color: '#5a6a7e', display: 'flex', flexDirection: 'column', gap: '0.6rem' }}>
              <li>1 Active Clinic limit</li>
              <li>50 daily bookings limit</li>
              <li>Basic Queue Tracking</li>
              <li style={{ textDecoration: 'line-through', opacity: 0.5 }}>SMS notifications</li>
              <li style={{ textDecoration: 'line-through', opacity: 0.5 }}>EHR Medical Records</li>
            </ul>

            <button 
              onClick={() => handlePlanChange('free')}
              className="btn btn-outline" 
              style={{ width: '100%', marginTop: 'auto' }}
              disabled={org?.plan === 'free' || isUpdating}
            >
              {org?.plan === 'free' ? 'Active Plan' : 'Downgrade to Free'}
            </button>
          </div>

          {/* BASIC PLAN */}
          <div className="clinic-card" style={{ padding: '2rem', display: 'flex', flexDirection: 'column', background: '#fff', border: org?.plan === 'basic' ? '2.5px solid #007BFF' : '1px solid #eef0f3', position: 'relative' }}>
            <h3 style={{ margin: 0, fontSize: '1.05rem', color: '#1a2332' }}>Basic SaaS</h3>
            <div style={{ margin: '1rem 0' }}>
              <strong style={{ fontSize: '2rem', color: '#007BFF' }}>₹999</strong>
              <span style={{ fontSize: '0.8rem', color: '#5a6a7e' }}> / month</span>
            </div>
            
            <ul style={{ margin: '0 0 2rem 0', paddingLeft: '1.1rem', fontSize: '0.8rem', color: '#5a6a7e', display: 'flex', flexDirection: 'column', gap: '0.6rem' }}>
              <li><strong>3 Active Clinics</strong> limit</li>
              <li>Unlimited Patient bookings</li>
              <li><strong>SMS Queue Notifications</strong></li>
              <li>Secure EHR Health Records</li>
              <li>Financial Analytics Logs</li>
            </ul>

            <button 
              onClick={() => handlePlanChange('basic')}
              className="btn btn-primary" 
              style={{ width: '100%', marginTop: 'auto' }}
              disabled={org?.plan === 'basic' || isUpdating}
            >
              {isUpdating ? <Loader2 size={16} className="animate-spin" /> : org?.plan === 'basic' ? 'Active Plan' : 'Select Basic Plan'}
            </button>
          </div>

          {/* PRO PLAN */}
          <div className="clinic-card" style={{ padding: '2rem', display: 'flex', flexDirection: 'column', background: '#fff', border: org?.plan === 'pro' ? '2.5px solid #007BFF' : '1px solid #eef0f3' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <h3 style={{ margin: 0, fontSize: '1.05rem', color: '#1a2332' }}>Pro Enterprise</h3>
              <Sparkles size={16} color="#ffb000" />
            </div>
            <div style={{ margin: '1rem 0' }}>
              <strong style={{ fontSize: '2rem', color: '#ffb000' }}>₹2,999</strong>
              <span style={{ fontSize: '0.8rem', color: '#5a6a7e' }}> / month</span>
            </div>
            
            <ul style={{ margin: '0 0 2rem 0', paddingLeft: '1.1rem', fontSize: '0.8rem', color: '#5a6a7e', display: 'flex', flexDirection: 'column', gap: '0.6rem' }}>
              <li><strong>10 Active Clinics</strong> limit</li>
              <li>WhatsApp Integration API</li>
              <li>FCM Push notifications</li>
              <li>Custom Branded Portals</li>
              <li>Public developer REST APIs</li>
            </ul>

            <button 
              onClick={() => handlePlanChange('pro')}
              className="btn btn-outline" 
              style={{ width: '100%', marginTop: 'auto', color: '#ffb000', borderColor: 'rgba(255,176,0,0.3)' }}
              disabled={org?.plan === 'pro' || isUpdating}
            >
              {isUpdating ? <Loader2 size={16} className="animate-spin" /> : org?.plan === 'pro' ? 'Active Plan' : 'Upgrade to Pro'}
            </button>
          </div>

        </div>

      </div>
    </main>
  );
}
