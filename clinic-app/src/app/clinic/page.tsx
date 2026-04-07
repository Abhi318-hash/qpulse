'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { auth } from '@/lib/firebase';
import { onAuthStateChanged, signOut } from 'firebase/auth';
import { subscribeToActiveClinics } from '@/lib/actions';
import { Loader2, Hospital, LogOut, ArrowRight } from 'lucide-react';
import Link from 'next/link';

export default function GlobalStaffDashboard() {
  const router = useRouter();
  const [clinics, setClinics] = useState<any[]>([]);
  const [loadingAuth, setLoadingAuth] = useState(true);
  const [currentUserPhone, setCurrentUserPhone] = useState<string | null>(null);

  useEffect(() => {
    let unsubscribeData: () => void;

    const unsubscribeAuth = onAuthStateChanged(auth, (user) => {
      if (!user) {
        router.push('/clinic/login');
      } else {
        setCurrentUserPhone(user.phoneNumber);
        
        // Start listening to clinics specifically to find theirs
        unsubscribeData = subscribeToActiveClinics((data) => {
          const myClinics = data.filter(c => c.authorized_phone === user.phoneNumber);
          
          if (myClinics.length === 1) {
             // Exact match: Send them directly to their own clinic!
             router.push(`/clinic/${myClinics[0].id}`);
          } else {
             // 0 or Multiple clinics
             setClinics(myClinics);
             setLoadingAuth(false);
          }
        });
      }
    });

    return () => {
      unsubscribeAuth();
      if (unsubscribeData) unsubscribeData();
    };
  }, [router]);

  const handleLogout = async () => {
    await signOut(auth);
    router.push('/clinic/login');
  };

  if (loadingAuth) {
    return (
      <div className="container" style={{ display: 'grid', placeItems: 'center', minHeight: '80vh' }}>
        <Loader2 className="animate-spin" size={40} style={{ color: 'var(--accent-primary)' }} />
      </div>
    );
  }

  return (
    <div className="container fade-in" style={{ maxWidth: '800px' }}>
      <header className="header" style={{ textAlign: 'left', display: 'flex', justifyContent: 'space-between', alignItems: 'center', paddingBottom: '2rem' }}>
        <div>
          <h1 style={{ background: 'linear-gradient(to right, #00d2ff, #ffffff)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent', margin: 0 }}>
            Staff Workspace
          </h1>
          <p style={{ color: 'var(--text-secondary)', marginTop: '0.25rem' }}>
            Select a clinic queue terminal to actively manage.
          </p>
        </div>
        <button onClick={handleLogout} className="btn btn-outline" style={{ display: 'flex', gap: '0.4rem', color: 'var(--danger)', borderColor: 'rgba(255,77,77,0.3)' }}>
          <LogOut size={16} /> Logout
        </button>
      </header>

      <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
        {clinics.length === 0 ? (
          <div className="glass-card" style={{ textAlign: 'center', color: 'var(--text-secondary)' }}>
            No active clinics available to manage.
          </div>
        ) : (
          clinics.map(clinic => (
            <Link key={clinic.id} href={`/clinic/${clinic.id}`} style={{ display: 'block' }}>
              <div className="glass-card" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', transition: 'all 0.2s', cursor: 'pointer' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
                  <div style={{ padding: '0.8rem', background: 'rgba(0, 210, 255, 0.1)', borderRadius: '12px' }}>
                    <Hospital size={24} color="var(--accent-primary)" />
                  </div>
                  <div>
                    <h3 style={{ margin: 0, fontSize: '1.2rem' }}>{clinic.name}</h3>
                    <p style={{ margin: 0, color: 'var(--text-secondary)', fontSize: '0.85rem' }}>{clinic.doctor_name} · {clinic.location}</p>
                  </div>
                </div>
                <ArrowRight size={20} color="var(--text-secondary)" />
              </div>
            </Link>
          ))
        )}
      </div>
    </div>
  );
}
