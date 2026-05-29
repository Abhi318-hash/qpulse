'use client';

import React, { useEffect, useState } from 'react';
import { useRouter, useParams } from 'next/navigation';
import { onAuthStateChanged } from 'firebase/auth';
import { auth, db } from '@/lib/firebase';
import { doc, getDoc } from 'firebase/firestore';
import { checkIsAdmin } from '@/lib/adminAuth';
import { JitsiMeeting } from '@jitsi/react-sdk';
import { Loader2, ArrowLeft } from 'lucide-react';
import Image from 'next/image';

export default function ConsultPage() {
  const router = useRouter();
  const params = useParams();
  const id = params.id as string;
  
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  
  const [isDoctor, setIsDoctor] = useState(false);
  const [appointment, setAppointment] = useState<any>(null);
  const [displayName, setDisplayName] = useState('Guest');

  useEffect(() => {
    const unsubscribeAuth = onAuthStateChanged(auth, async (user) => {
      if (!user) {
        router.push('/login');
        return;
      }

      try {
        setLoading(true);
        // 1. Fetch appointment details
        const appRef = doc(db, 'appointments', id);
        const appSnap = await getDoc(appRef);
        
        if (!appSnap.exists()) {
          setError('Appointment not found.');
          setLoading(false);
          return;
        }

        const appData = appSnap.data();
        setAppointment(appData);

        // 2. Determine if current user is a doctor/staff for this clinic
        const clinicId = appData.clinic_id;
        let isStaff = false;
        
        // Check Super Admin or Org Admin
        const adminRole = await checkIsAdmin(user.phoneNumber || '');
        if (adminRole) {
          isStaff = true;
        } else {
          // Check Clinic Staff
          const clinicSnap = await getDoc(doc(db, 'clinics', clinicId));
          if (clinicSnap.exists() && clinicSnap.data().authorized_phone === user.phoneNumber) {
            isStaff = true;
          }
        }

        setIsDoctor(isStaff);

        // 3. Set display name
        if (isStaff) {
          setDisplayName(`Dr. (Clinic Staff)`);
        } else {
          setDisplayName(appData.patient_name || 'Patient');
        }

      } catch (err: any) {
        console.error('Error loading consultation:', err);
        setError('Failed to load consultation room.');
      } finally {
        setLoading(false);
      }
    });

    return () => unsubscribeAuth();
  }, [id, router]);

  const handleCallEnded = () => {
    // Navigate back to the respective dashboards
    if (isDoctor) {
      router.push(`/clinic/${appointment?.clinic_id}`);
    } else {
      router.push('/');
    }
  };

  if (loading) {
    return (
      <div style={{ height: '100vh', display: 'flex', flexDirection: 'column', justifyContent: 'center', alignItems: 'center', background: '#0a0f19' }}>
        <Loader2 size={48} className="animate-spin" color="#007BFF" />
        <p style={{ marginTop: '1rem', color: '#fff', fontSize: '1.2rem', fontWeight: 600 }}>Preparing secure connection...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div style={{ height: '100vh', display: 'flex', flexDirection: 'column', justifyContent: 'center', alignItems: 'center', background: '#0a0f19', color: '#fff' }}>
        <p style={{ color: '#ff4d4f', fontSize: '1.5rem', fontWeight: 700 }}>{error}</p>
        <button onClick={() => router.back()} className="btn btn-primary" style={{ marginTop: '2rem' }}>Go Back</button>
      </div>
    );
  }

  return (
    <div style={{ height: '100vh', display: 'flex', flexDirection: 'column', background: '#000' }}>
      {/* Custom Header */}
      <div style={{ padding: '1rem', background: '#0a0f19', display: 'flex', alignItems: 'center', justifyContent: 'space-between', borderBottom: '1px solid rgba(255,255,255,0.1)' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
          <button onClick={handleCallEnded} style={{ background: 'none', border: 'none', color: '#a0aec0', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '0.5rem', fontWeight: 600 }}>
            <ArrowLeft size={20} /> Leave
          </button>
          <div style={{ height: '24px', width: '1px', background: 'rgba(255,255,255,0.2)' }}></div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <Image src="/heartbeat.svg" alt="Q-Pulse" width={24} height={24} style={{ filter: 'invert(1)' }} />
            <span style={{ color: '#fff', fontWeight: 700, fontSize: '1.1rem' }}>Q-Pulse Telemedicine</span>
          </div>
        </div>
        <div>
          <span style={{ color: '#a0aec0', fontSize: '0.85rem' }}>{appointment.clinic_name || 'Clinic'}</span>
        </div>
      </div>

      {/* Jitsi Meeting Embed */}
      <div style={{ flex: 1 }}>
        <JitsiMeeting
          domain="meet.jit.si"
          roomName={`QPulseConsult-${id}`}
          configOverwrite={{
            startWithAudioMuted: false,
            startWithVideoMuted: false,
            disableModeratorIndicator: true,
            startScreenSharing: false,
            enableEmailInStats: false,
            prejoinPageEnabled: false,
            requireDisplayName: false
          }}
          interfaceConfigOverwrite={{
            DISABLE_JOIN_LEAVE_NOTIFICATIONS: true,
            SHOW_CHROME_EXTENSION_BANNER: false,
            SHOW_JITSI_WATERMARK: false,
            SHOW_WATERMARK_FOR_GUESTS: false,
            SHOW_BRAND_WATERMARK: false,
            DEFAULT_LOGO_URL: '',
            DEFAULT_WELCOME_PAGE_LOGO_URL: '',
            HIDE_INVITE_MORE_HEADER: true
          }}
          userInfo={{
            displayName: displayName,
            email: 'user@qpulse.local'
          }}
          onApiReady={(externalApi) => {
            // Attach event listeners
            externalApi.addListener('videoConferenceLeft', handleCallEnded);
          }}
          getIFrameRef={(iframeRef) => {
            iframeRef.style.height = '100%';
            iframeRef.style.width = '100%';
            iframeRef.style.border = 'none';
          }}
        />
      </div>
    </div>
  );
}
