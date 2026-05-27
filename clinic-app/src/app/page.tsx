'use client'

import { subscribeToActiveClinics, subscribeToUserActiveTokens, addPatientToken, cancelUserToken, getUserMedicalHistory, saveFcmToken } from '@/lib/actions';
import { auth } from '@/lib/firebase';
import { onAuthStateChanged, signOut } from 'firebase/auth';
import Link from 'next/link';
import React, { useState, useEffect, Suspense, useRef, useMemo, useCallback } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import { Settings, Activity, Hospital, MapPin, Search as SearchIcon, Stethoscope, Star, Heart, QrCode, LogOut, Ticket, Loader2, CalendarPlus, X, History, ChevronDown, ChevronUp, Phone, Clock, UserRound, IndianRupee, CheckCircle, ArrowLeft, ArrowRight, Info, Sun, Moon, Bell } from 'lucide-react';
import { QRCodeSVG } from 'qrcode.react';

export default function Home() {
  return (
    <Suspense fallback={<div style={{ display: 'grid', placeItems: 'center', height: '100vh' }}><Loader2 className="animate-spin" style={{ color: '#007BFF' }} /></div>}>
      <HomeContent />
    </Suspense>
  );
}

// Hook: reactive window width for responsive inline styles
function useWindowWidth() {
  const [width, setWidth] = useState(375);
  useEffect(() => {
    const update = () => setWidth(window.innerWidth);
    update();
    window.addEventListener('resize', update, { passive: true });
    return () => window.removeEventListener('resize', update);
  }, []);
  return width;
}

function HomeContent() {
  const windowWidth = useWindowWidth();
  const isMobile = windowWidth <= 480;
  const [clinics, setClinics] = useState<any[]>([]);
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);
  const [favorites, setFavorites] = useState<string[]>([]);

  const [currentUser, setCurrentUser] = useState<any>(null);
  const [myTokens, setMyTokens] = useState<any[]>([]);
  const [myHistory, setMyHistory] = useState<any[]>([]);
  const [showHistory, setShowHistory] = useState(false);
  const [showSidebar, setShowSidebar] = useState(false);

  const [userProfile, setUserProfile] = useState({ name: '', age: '', disease: '' });

  const [bookingClinic, setBookingClinic] = useState<any | null>(null);
  const [patientName, setPatientName] = useState('');
  const [patientAge, setPatientAge] = useState('');
  const [disease, setDisease] = useState('');
  const [isBooking, setIsBooking] = useState(false);
  const [pushEnabled, setPushEnabled] = useState(false);
  const [isTogglingPush, setIsTogglingPush] = useState(false);

  // Check if permission is already granted on mount/auth
  useEffect(() => {
    if (typeof window !== 'undefined' && 'Notification' in window && Notification.permission === 'granted' && currentUser?.phoneNumber) {
      setPushEnabled(true);
      // Auto-refresh token
      import('@/lib/fcm').then(({ requestPushPermission }) => {
        requestPushPermission().then(token => {
          if (token) {
            saveFcmToken(currentUser.phoneNumber, token);
          }
        });
      });
    }
  }, [currentUser]);

  const handlePushToggle = async () => {
    if (!currentUser?.phoneNumber) return;
    setIsTogglingPush(true);
    try {
      if (!pushEnabled) {
        const { requestPushPermission } = await import('@/lib/fcm');
        const token = await requestPushPermission();
        if (token) {
          await saveFcmToken(currentUser.phoneNumber, token);
          setPushEnabled(true);
          alert('Push notifications enabled successfully!');
        } else {
          alert('Failed to enable push notifications. Please check browser permissions.');
        }
      } else {
        setPushEnabled(false);
      }
    } catch (error) {
      console.error(error);
      alert('Failed to configure notifications.');
    } finally {
      setIsTogglingPush(false);
    }
  };

  const clinicsRef = useRef<any[]>([]);
  const myTokensRef = useRef<any[]>([]);

  const searchParams = useSearchParams();
  const router = useRouter();

  // ── Theme toggle (syncs with TopNav's localStorage key) ──
  const [theme, setTheme] = useState<'light' | 'dark'>('light');
  useEffect(() => {
    const saved = localStorage.getItem('qpulse_theme');
    const initial = saved === 'dark' ? 'dark' : 'light';
    setTheme(initial);
    if (initial === 'dark') document.documentElement.removeAttribute('data-theme');
    else document.documentElement.setAttribute('data-theme', 'light');
  }, []);
  const toggleTheme = () => {
    const next = theme === 'light' ? 'dark' : 'light';
    setTheme(next);
    if (next === 'dark') document.documentElement.removeAttribute('data-theme');
    else document.documentElement.setAttribute('data-theme', 'light');
    localStorage.setItem('qpulse_theme', next);
  };

  const isDark = theme === 'dark';
  const navBg = isDark ? 'rgba(10,15,25,0.92)' : 'rgba(255,255,255,0.96)';
  const navBorder = isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.07)';
  const navText = isDark ? '#e2e8f0' : '#1a2332';
  const navSub = isDark ? '#94a3b8' : '#5a6a7e';
  const mainBg = isDark
    ? 'linear-gradient(160deg,#0a0f19 0%,#0f172a 100%)'
    : 'linear-gradient(160deg,#f0f6ff 0%,#f8fafc 100%)';
  const iconBtn = {
    background: isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.04)',
    border: `1px solid ${isDark ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.1)'}`,
    color: isDark ? '#e2e8f0' : '#1a2332',
    padding: '0.45rem',
    borderRadius: '8px',
    cursor: 'pointer',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    minWidth: 36,
    minHeight: 36,
    transition: 'all 0.2s',
    textDecoration: 'none',
  } as React.CSSProperties;

  useEffect(() => {
    const saved = localStorage.getItem('qpulse_favorites');
    if (saved) { try { setFavorites(JSON.parse(saved)); } catch (e) {} }
    const savedProfile = localStorage.getItem('qpulse_user_profile');
    if (savedProfile) { try { setUserProfile(JSON.parse(savedProfile)); } catch (e) {} }

    let unsubscribeTokens: () => void;
    const unsubscribeAuth = onAuthStateChanged(auth, (user) => {
      setCurrentUser(user);
      if (user && user.phoneNumber) {
        unsubscribeTokens = subscribeToUserActiveTokens(user.phoneNumber, (tokens) => {
          setMyTokens(tokens);
          myTokensRef.current = tokens;
        });
        getUserMedicalHistory(user.phoneNumber).then(history => setMyHistory(history));
      } else {
        setMyTokens([]); myTokensRef.current = []; setMyHistory([]);
      }
    });
    return () => { unsubscribeAuth(); if (unsubscribeTokens) unsubscribeTokens(); };
  }, []);

  useEffect(() => {
    const unsubscribeClinics = subscribeToActiveClinics((data) => {
      data.forEach(newClinic => {
        const oldClinic = clinicsRef.current.find(c => c.id === newClinic.id);
        if (oldClinic && oldClinic.currently_serving_token !== newClinic.currently_serving_token) {
          const matchingToken = myTokensRef.current.find(t => t.clinic_id === newClinic.id);
          if (matchingToken && newClinic.currently_serving_token !== '--') {
            const servingNum = Number(newClinic.currently_serving_token);
            const userNextTokenNum = Number(matchingToken.token_number);
            if (!isNaN(servingNum) && !isNaN(userNextTokenNum)) {
              if (servingNum === userNextTokenNum) {
                triggerNotification('🚨 Turn Alert!', `Your token #${userNextTokenNum} is now being called!`);
              } else if (userNextTokenNum - servingNum === 2) {
                triggerNotification('⚠️ Be Ready', `You are next in line at token #${servingNum}!`);
              }
            }
          }
        }
      });
      clinicsRef.current = data;
      setClinics(data);
      setLoading(false);
    });
    return () => unsubscribeClinics();
  }, []);

  const triggerNotification = (title: string, body: string) => {
    if (!('Notification' in window)) return;
    if (Notification.permission === 'granted') new Notification(title, { body, icon: '/favicon.ico' });
  };

  useEffect(() => {
    const addId = searchParams.get('addFavorite');
    if (addId && !favorites.includes(addId)) {
      const newFavs = [...favorites, addId];
      setFavorites(newFavs);
      localStorage.setItem('qpulse_favorites', JSON.stringify(newFavs));
      const params = new URLSearchParams(searchParams.toString());
      params.delete('addFavorite');
      router.replace(`/?${params.toString()}`);
    }
  }, [searchParams, favorites, router]);

  const toggleFavorite = useCallback((id: string, e: React.MouseEvent) => {
    e.preventDefault(); e.stopPropagation();
    setFavorites(prevFavs => {
      const newFavs = prevFavs.includes(id) ? prevFavs.filter(f => f !== id) : [...prevFavs, id];
      localStorage.setItem('qpulse_favorites', JSON.stringify(newFavs));
      return newFavs;
    });
  }, []);

  const handleBookClick = useCallback((clinic: any) => {
    if (!currentUser) { router.push('/login'); return; }
    const existing = myTokens.find(t => t.clinic_id === clinic.id);
    if (existing) { alert(`You already have active Token #${existing.token_number} at this clinic!`); return; }
    setPatientName(userProfile.name || '');
    setPatientAge(userProfile.age || '');
    setDisease(userProfile.disease || '');
    setBookingClinic(clinic);
  }, [currentUser, myTokens, userProfile, router]);

  const submitBooking = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!bookingClinic || !patientName || !currentUser?.phoneNumber) return;
    if ('Notification' in window && Notification.permission !== 'granted' && Notification.permission !== 'denied') {
      try { await Notification.requestPermission(); } catch {}
    }
    setIsBooking(true);
    try {
      const p = { name: patientName, age: patientAge, disease };
      setUserProfile(p);
      localStorage.setItem('qpulse_user_profile', JSON.stringify(p));
      await addPatientToken(bookingClinic.id, patientName, parseInt(patientAge) || 0, 0, disease || 'General', currentUser.phoneNumber);
      setBookingClinic(null); setPatientName(''); setPatientAge(''); setDisease('');
    } catch { alert('Booking failed. Please try again.'); }
    finally { setIsBooking(false); }
  };

  const handleCancelToken = async (clinicId: string, tokenId: string) => {
    if (confirm('Are you sure you want to cancel this token?')) await cancelUserToken(clinicId, tokenId);
  };

  const filteredClinics = useMemo(() =>
    clinics.filter(c =>
      c.name?.toLowerCase().includes(search.toLowerCase()) ||
      c.doctor_name?.toLowerCase().includes(search.toLowerCase()) ||
      c.location?.toLowerCase().includes(search.toLowerCase())
    ), [clinics, search]);

  const favoriteClinics = useMemo(() => filteredClinics.filter(c => favorites.includes(c.id)), [filteredClinics, favorites]);
  const otherClinics = useMemo(() => filteredClinics.filter(c => !favorites.includes(c.id)), [filteredClinics, favorites]);

  return (
    <main style={{ background: mainBg, minHeight: '100vh', transition: 'background 0.3s' }}>

      {/* ── STICKY NAV ── */}
      <nav style={{
        background: navBg,
        backdropFilter: 'blur(16px)',
        WebkitBackdropFilter: 'blur(16px)',
        borderBottom: `1px solid ${navBorder}`,
        position: 'sticky', top: 0, zIndex: 100,
        boxShadow: '0 1px 12px rgba(0,0,0,0.08)',
        transition: 'background 0.3s, border-color 0.3s',
      }}>
        <div style={{
          width: '100%',
          padding: '0 1.25rem',
          height: 56,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: '0.5rem',
          boxSizing: 'border-box',
        }}>

          {/* ══ LEFT: Logo + Back/Forward ══ */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>

            {/* Q-PULSE logo → external site */}
            <a
              href="https://qpluse.vercel.app/"
              target="_blank"
              rel="noopener noreferrer"
              style={{ display: 'flex', alignItems: 'center', gap: '0.45rem', textDecoration: 'none', whiteSpace: 'nowrap' }}
            >
              <Activity size={20} color="#007BFF" />
              <span style={{ fontWeight: 800, fontSize: isMobile ? '0.95rem' : '1.1rem', color: navText, letterSpacing: '-0.5px', transition: 'color 0.3s' }}>
                Q-PULSE
              </span>
              {!isMobile && (
                <span style={{ fontSize: '0.62rem', padding: '2px 6px', background: 'rgba(0,123,255,0.1)', color: '#007BFF', borderRadius: '20px', fontWeight: 700, border: '1px solid rgba(0,123,255,0.2)' }}>
                  LIVE
                </span>
              )}
            </a>

            {/* Divider */}
            <span style={{ width: 1, height: 20, background: navBorder, display: 'inline-block' }} />

            {/* Back / Forward */}
            <button onClick={() => router.back()} style={iconBtn} title="Go back" aria-label="Back">
              <ArrowLeft size={16} />
            </button>
            <button onClick={() => router.forward()} style={iconBtn} title="Go forward" aria-label="Forward">
              <ArrowRight size={16} />
            </button>
          </div>

          {/* ══ RIGHT: About · Theme · Auth ══ */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>

            {/* About */}
            <Link href="/about" style={iconBtn} title="About Q-PULSE" aria-label="About">
              <Info size={16} />
            </Link>

            {/* Theme toggle */}
            <button onClick={toggleTheme} style={iconBtn} title={isDark ? 'Light mode' : 'Dark mode'} aria-label="Toggle theme">
              {isDark ? <Sun size={16} color="#fbbf24" /> : <Moon size={16} />}
            </button>

            {/* Auth */}
            {currentUser ? (
              <button
                onClick={() => setShowSidebar(true)}
                style={{
                  ...iconBtn,
                  paddingLeft: isMobile ? '0.45rem' : '0.8rem',
                  paddingRight: isMobile ? '0.45rem' : '0.8rem',
                  gap: '0.35rem',
                  background: 'rgba(0,123,255,0.08)',
                  border: '1px solid rgba(0,123,255,0.22)',
                  color: '#007BFF',
                  fontFamily: 'inherit',
                  fontWeight: 600,
                  fontSize: '0.8rem',
                }}
              >
                <UserRound size={16} />
                {!isMobile && 'Profile'}
              </button>
            ) : (
              <button
                onClick={() => router.push('/login')}
                className="btn btn-primary"
                style={{ fontSize: '0.8rem', padding: isMobile ? '0.4rem 0.65rem' : '0.4rem 1rem', minHeight: 36 }}
              >
                {isMobile ? <UserRound size={16} /> : 'Login'}
              </button>
            )}
          </div>

        </div>
      </nav>

      {/* ── HERO SECTION ──────────────────────────────────── */}
      <section style={{ padding: '3.5rem 2rem 2rem', maxWidth: 1100, margin: '0 auto' }}>
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', textAlign: 'center', marginBottom: '2.5rem' }}>
          <div style={{
            display: 'inline-flex', alignItems: 'center', gap: '0.5rem',
            background: 'rgba(0,123,255,0.08)', border: '1px solid rgba(0,123,255,0.2)',
            padding: '0.35rem 1rem', borderRadius: '20px', marginBottom: '1.25rem'
          }}>
            <span style={{ width: 8, height: 8, background: '#28a745', borderRadius: '50%', boxShadow: '0 0 8px #28a745', animation: 'pulse 2s infinite', display: 'inline-block' }} />
            <span style={{ fontSize: '0.8rem', fontWeight: 700, color: '#007BFF' }}>Real-Time Queue Network — Live Now</span>
          </div>
          <h1 style={{ fontSize: 'clamp(2.2rem,5vw,3.5rem)', fontWeight: 900, color: '#1a2332', letterSpacing: '-1.5px', margin: '0 0 1rem 0', lineHeight: 1.15 }}>
            Skip the Wait,{' '}
            <span style={{ background: 'linear-gradient(135deg,#007BFF,#0056CC)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }}>
              Stay in the Pulse
            </span>
          </h1>
          <p style={{ fontSize: '1.1rem', color: '#5a6a7e', maxWidth: 560, lineHeight: 1.7, margin: '0 0 2rem 0' }}>
            Book your clinic token online and track the live queue in real time — no calls, no waiting room stress.
          </p>
          <div style={{ width: '100%', maxWidth: 560, position: 'relative' }}>
            <SearchIcon style={{ position: 'absolute', left: '1.1rem', top: '50%', transform: 'translateY(-50%)', color: '#5a6a7e' }} size={19} />
            <input type="text" className="input-field"
              placeholder="Search by clinic, doctor name, or location…"
              style={{ paddingLeft: '3rem', background: '#fff', border: '1.5px solid #dee2e8', borderRadius: '12px', fontSize: '0.95rem', height: 52, boxShadow: '0 2px 12px rgba(0,0,0,0.06)' }}
              value={search} onChange={e => setSearch(e.target.value)}
            />
          </div>
        </div>
        <div style={{ display: 'flex', justifyContent: 'center', gap: '2.5rem', flexWrap: 'wrap' }}>
          {[
            { icon: <CheckCircle size={15} color="#28a745" />, text: 'No app download needed' },
            { icon: <CheckCircle size={15} color="#28a745" />, text: 'Live queue updates' },
            { icon: <CheckCircle size={15} color="#28a745" />, text: 'Pay at clinic desk' },
          ].map((item, i) => (
            <div key={i} style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', fontSize: '0.82rem', color: '#5a6a7e', fontWeight: 500 }}>
              {item.icon} {item.text}
            </div>
          ))}
        </div>
      </section>

      <div style={{ maxWidth: 1100, margin: '0 auto', padding: '0 2rem 4rem' }}>

        {/* ── ACTIVE TOKENS ─────────────────────────────── */}
        {myTokens.length > 0 && (
          <section style={{ marginBottom: '3rem' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem', marginBottom: '1.25rem' }}>
              <div style={{ padding: '0.4rem', background: 'rgba(0,123,255,0.1)', borderRadius: '8px' }}>
                <Ticket size={18} color="#007BFF" />
              </div>
              <h2 style={{ fontSize: '1.05rem', fontWeight: 700, color: '#1a2332', margin: 0 }}>Your Active Tokens</h2>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(280px,1fr))', gap: '1.25rem' }}>
              {myTokens.map(token => {
                const mc = clinics.find(c => c.id === token.clinic_id);
                return (
                  <div key={token.id} style={{ background: '#fff', borderRadius: 16, padding: '1.5rem', boxShadow: '0 2px 8px rgba(0,0,0,0.06), 0 8px 24px rgba(0,123,255,0.08)', border: '1px solid rgba(0,123,255,0.15)', position: 'relative', overflow: 'hidden' }}>
                    <div style={{ position: 'absolute', top: 0, right: 0, background: 'linear-gradient(135deg,#007BFF,#0056CC)', color: 'white', fontWeight: 700, padding: '0.2rem 0.9rem', borderBottomLeftRadius: 12, fontSize: '0.72rem' }}>LIVE</div>
                    <h3 style={{ margin: '0 0 0.3rem 0', fontSize: '1rem', color: '#1a2332', fontWeight: 700 }}>{mc?.name || 'Clinic'}</h3>
                    <p style={{ margin: '0 0 1rem 0', color: '#5a6a7e', fontSize: '0.82rem' }}>Patient: {token.patient_name}</p>
                    <div style={{ display: 'flex', justifyContent: 'space-around', background: '#f8fafc', padding: '1rem', borderRadius: 12, border: '1px solid #eef0f3' }}>
                      <div style={{ textAlign: 'center' }}>
                        <span style={{ display: 'block', fontSize: '0.65rem', color: '#5a6a7e', textTransform: 'uppercase', fontWeight: 700, marginBottom: '0.3rem' }}>Your Token</span>
                        <strong style={{ fontSize: '1.8rem', color: '#007BFF', lineHeight: 1 }}>#{token.token_number}</strong>
                      </div>
                      <div style={{ width: 1, background: '#eef0f3' }} />
                      <div style={{ textAlign: 'center' }}>
                        <span style={{ display: 'block', fontSize: '0.65rem', color: '#5a6a7e', textTransform: 'uppercase', fontWeight: 700, marginBottom: '0.3rem' }}>Now Serving</span>
                        <strong style={{ fontSize: '1.8rem', color: '#28a745', lineHeight: 1 }}>#{mc?.currently_serving_token || '--'}</strong>
                      </div>
                    </div>
                    <button onClick={() => handleCancelToken(token.clinic_id, token.id)} style={{ width: '100%', marginTop: '1rem', padding: '0.55rem', fontSize: '0.8rem', background: 'rgba(220,53,69,0.06)', color: '#dc3545', border: '1px solid rgba(220,53,69,0.2)', borderRadius: 9, cursor: 'pointer', fontFamily: 'inherit' }}>
                      Cancel Appointment
                    </button>
                  </div>
                );
              })}
            </div>
            <div style={{ margin: '2rem 0', height: 1, background: 'linear-gradient(90deg,transparent,#dee2e8,transparent)' }} />
          </section>
        )}

        {/* ── FAVORITES ─────────────────────────────────── */}
        {favorites.length > 0 && !search && (
          <section style={{ marginBottom: '3rem' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem', marginBottom: '1.25rem' }}>
              <div style={{ padding: '0.4rem', background: 'rgba(220,53,69,0.1)', borderRadius: '8px' }}>
                <Heart size={18} fill="#dc3545" color="#dc3545" />
              </div>
              <h2 style={{ fontSize: '1.05rem', fontWeight: 700, color: '#1a2332', margin: 0 }}>Your Favourites</h2>
            </div>
            <div className="grid-clinics">
              {favoriteClinics.map(clinic => (
                <ClinicCard key={clinic.id} clinic={clinic} isFavorite={true} onFavoriteToggle={toggleFavorite} onBookClick={() => handleBookClick(clinic)} />
              ))}
            </div>
            <div style={{ margin: '2rem 0', height: 1, background: 'linear-gradient(90deg,transparent,#dee2e8,transparent)' }} />
          </section>
        )}

        {/* ── CLINIC DIRECTORY ──────────────────────────── */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '1.25rem' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
            <div style={{ padding: '0.4rem', background: 'rgba(0,123,255,0.1)', borderRadius: '8px' }}>
              <Hospital size={18} color="#007BFF" />
            </div>
            <h2 style={{ fontSize: '1.05rem', fontWeight: 700, color: '#1a2332', margin: 0 }}>
              {search ? `Results for "${search}"` : 'All Clinics'}
            </h2>
          </div>
          {!loading && <span style={{ fontSize: '0.82rem', color: '#5a6a7e', fontWeight: 500 }}>{otherClinics.length + favoriteClinics.length} clinics live</span>}
        </div>

        <div className="grid-clinics">
          {loading ? (
            <div style={{ gridColumn: '1/-1', textAlign: 'center', padding: '5rem 2rem', background: '#fff', borderRadius: 16, border: '1px solid #eef0f3' }}>
              <Loader2 size={36} className="animate-spin" style={{ color: '#007BFF', margin: '0 auto 1rem' }} />
              <p style={{ color: '#5a6a7e', fontWeight: 500 }}>Loading clinics…</p>
            </div>
          ) : otherClinics.length === 0 && favoriteClinics.length === 0 ? (
            <div style={{ gridColumn: '1/-1', textAlign: 'center', padding: '4rem 2rem', background: '#fff', borderRadius: 16, border: '1px solid #eef0f3' }}>
              <p style={{ color: '#5a6a7e' }}>No clinics found matching your search.</p>
            </div>
          ) : (
            otherClinics.map(clinic => (
              <ClinicCard key={clinic.id} clinic={clinic} isFavorite={favorites.includes(clinic.id)} onFavoriteToggle={toggleFavorite} onBookClick={() => handleBookClick(clinic)} />
            ))
          )}
        </div>

        {/* ── FOOTER ────────────────────────────────────── */}
        <footer style={{ marginTop: '4rem', paddingTop: '2rem', borderTop: '1px solid #eef0f3', display: 'flex', justifyContent: 'center', gap: '1.25rem', flexWrap: 'wrap' }}>
          <Link href="/admin/login" target="_blank" rel="noopener noreferrer" className="btn btn-outline" style={{ fontSize: '0.85rem', padding: '0.5rem 1.1rem', color: '#5a6a7e' }}>
            <Settings size={15} /> Admin Portal
          </Link>
          <Link href="/clinic/login" target="_blank" rel="noopener noreferrer" className="btn btn-outline" style={{ fontSize: '0.85rem', padding: '0.5rem 1.1rem', color: '#5a6a7e' }}>
            <Hospital size={15} /> Staff Portal
          </Link>
          <span style={{ color: '#5a6a7e', fontSize: '0.85rem', display: 'flex', alignItems: 'center', fontWeight: 500 }}>Powered by Q-PULSE Network</span>
        </footer>
      </div>

      {/* ── BOOKING MODAL ─────────────────────────────────── */}
      {bookingClinic && (
        <div style={{ position: 'fixed', top: 0, left: 0, width: '100%', height: '100%', background: 'rgba(10,20,40,0.5)', backdropFilter: 'blur(8px)', zIndex: 9999, display: 'flex', justifyContent: 'center', alignItems: 'center', padding: '1rem' }}
          onClick={e => e.target === e.currentTarget && setBookingClinic(null)}>
          <div style={{ background: '#fff', borderRadius: 20, width: '100%', maxWidth: 500, overflow: 'hidden', boxShadow: '0 24px 80px rgba(0,0,0,0.2)', animation: 'fadeIn 0.25s ease' }}>
            <div style={{ background: 'linear-gradient(135deg,#007BFF,#0056CC)', padding: '1.5rem', position: 'relative' }}>
              <button onClick={() => setBookingClinic(null)} style={{ position: 'absolute', top: '1rem', right: '1rem', background: 'rgba(255,255,255,0.2)', border: 'none', borderRadius: '50%', width: 32, height: 32, display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', color: 'white' }}>
                <X size={18} />
              </button>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                <div style={{ width: 44, height: 44, borderRadius: '50%', background: 'rgba(255,255,255,0.2)', display: 'flex', alignItems: 'center', justifyContent: 'center', overflow: 'hidden' }}>
                  {bookingClinic.doctor_image_url
                    ? <img src={bookingClinic.doctor_image_url} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                    : <UserRound size={22} color="white" />}
                </div>
                <div>
                  <h2 style={{ margin: 0, fontSize: '1.15rem', color: 'white', fontWeight: 800 }}>{bookingClinic.name}</h2>
                  <p style={{ margin: 0, color: 'rgba(255,255,255,0.8)', fontSize: '0.82rem' }}>{bookingClinic.doctor_name} · {bookingClinic.specialization || 'General Physician'}</p>
                </div>
              </div>
            </div>
            <form onSubmit={submitBooking} style={{ padding: '1.75rem', display: 'flex', flexDirection: 'column', gap: '1rem' }}>
              <p style={{ margin: '0 0 0.5rem 0', color: '#5a6a7e', fontSize: '0.85rem', fontWeight: 500 }}>Fill in your details to generate a live token:</p>
              <input type="text" className="input-field" placeholder="Patient Full Name" value={patientName} onChange={e => setPatientName(e.target.value)} required disabled={isBooking} />
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.8rem' }}>
                <input type="number" className="input-field" placeholder="Age" value={patientAge} onChange={e => setPatientAge(e.target.value)} disabled={isBooking} />
                <input type="text" className="input-field" placeholder="Medical Issue" value={disease} onChange={e => setDisease(e.target.value)} disabled={isBooking} required />
              </div>
              <div style={{ background: '#f8fafc', padding: '0.9rem', borderRadius: 10, border: '1px solid #eef0f3', fontSize: '0.8rem', color: '#5a6a7e', textAlign: 'center' }}>
                You&apos;ll be assigned a live token. Pay ₹{bookingClinic.fees || '500'} at the clinic desk.
                <div style={{ fontSize: '0.72rem', color: '#007BFF', marginTop: '0.4rem', fontWeight: 600 }}>
                  🔔 SMS alert will be sent when your turn is near!
                </div>
              </div>
              <button type="submit" className="btn btn-primary" style={{ padding: '0.9rem', fontSize: '1rem', fontWeight: 700 }} disabled={isBooking || !patientName}>
                {isBooking ? <Loader2 size={22} className="animate-spin" /> : <><CalendarPlus size={18} /> Confirm &amp; Get Token</>}
              </button>
            </form>
          </div>
        </div>
      )}

      {/* ── HISTORY MODAL ─────────────────────────────────── */}
      {showHistory && (
        <div style={{ position: 'fixed', top: 0, left: 0, width: '100%', height: '100%', background: 'rgba(10,20,40,0.5)', backdropFilter: 'blur(8px)', zIndex: 9999, display: 'flex', justifyContent: 'center', alignItems: 'center', padding: '1rem' }}>
          <div style={{ background: '#fff', borderRadius: 20, width: '100%', maxWidth: 760, maxHeight: '90vh', display: 'flex', flexDirection: 'column', overflow: 'hidden', boxShadow: '0 24px 80px rgba(0,0,0,0.2)' }}>
            <div style={{ padding: '1.5rem', borderBottom: '1px solid #eef0f3', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <h2 style={{ margin: 0, fontSize: '1.1rem', color: '#1a2332', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <History size={18} color="#007BFF" /> Your Medical History
              </h2>
              <button onClick={() => setShowHistory(false)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#5a6a7e', display: 'flex' }}><X size={22} /></button>
            </div>
            <div style={{ padding: '1.5rem', flex: 1, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
              {myHistory.length === 0 ? (
                <div style={{ textAlign: 'center', padding: '3rem', color: '#5a6a7e' }}>No completed appointments yet.</div>
              ) : myHistory.map(record => {
                const dateObj = record.created_at?.toDate ? record.created_at.toDate() : new Date();
                const mc = clinics.find(c => c.id === record.clinic_id);
                return (
                  <div key={record.id} style={{ display: 'grid', gridTemplateColumns: 'minmax(180px,1fr) auto auto', gap: '1.5rem', padding: '1rem 1.25rem', background: '#f8fafc', borderRadius: 12, border: '1px solid #eef0f3', alignItems: 'center' }}>
                    <div>
                      <h4 style={{ margin: '0 0 0.3rem 0', color: '#1a2332', fontSize: '0.95rem', fontWeight: 700 }}>{mc?.name || 'Clinic'}</h4>
                      <p style={{ margin: 0, fontSize: '0.8rem', color: '#5a6a7e' }}>{record.patient_name} ({record.age}yrs) · {record.disease}</p>
                    </div>
                    <div style={{ textAlign: 'center', background: '#f0fff4', padding: '0.5rem 1rem', borderRadius: 8, border: '1px solid rgba(40,167,69,0.2)' }}>
                      <span style={{ color: '#5a6a7e', display: 'block', fontSize: '0.65rem', textTransform: 'uppercase', fontWeight: 700 }}>Fees Paid</span>
                      <span style={{ fontSize: '1.2rem', fontWeight: 800, color: '#28a745' }}>₹{record.fees || '0'}</span>
                    </div>
                    <div style={{ textAlign: 'right', color: '#5a6a7e', fontSize: '0.8rem' }}>
                      <p style={{ margin: '0 0 0.2rem 0', fontWeight: 600 }}>{dateObj.toLocaleDateString()}</p>
                      <p style={{ margin: 0 }}>{dateObj.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</p>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      )}

      {/* ── USER SIDEBAR ──────────────────────────────────── */}
      {showSidebar && currentUser && (
        <div style={{ position: 'fixed', top: 0, right: 0, width: '100%', maxWidth: 340, height: '100%', background: '#fff', borderLeft: '1px solid #eef0f3', boxShadow: '-8px 0 40px rgba(0,0,0,0.12)', zIndex: 10000, display: 'flex', flexDirection: 'column', animation: 'slideInRight 0.3s ease-out' }}>
          <div style={{ padding: '1.5rem', borderBottom: '1px solid #eef0f3', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <h2 style={{ margin: 0, fontSize: '1.1rem', color: '#1a2332', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <UserRound size={18} color="#007BFF" /> My Profile
            </h2>
            <button onClick={() => setShowSidebar(false)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#5a6a7e', display: 'flex' }}><X size={22} /></button>
          </div>
          <div style={{ padding: '1.75rem', flex: 1, overflowY: 'auto' }}>
            <div style={{ textAlign: 'center', marginBottom: '2rem' }}>
              <div style={{ width: 64, height: 64, borderRadius: '50%', background: 'linear-gradient(135deg,#007BFF,#0056CC)', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 0.75rem', boxShadow: '0 4px 16px rgba(0,123,255,0.3)' }}>
                <UserRound size={30} color="white" />
              </div>
              <p style={{ margin: 0, color: '#5a6a7e', fontSize: '0.72rem', textTransform: 'uppercase', letterSpacing: '1px', fontWeight: 700 }}>Logged in as</p>
              <h3 style={{ margin: '0.4rem 0 0', fontWeight: 700, color: '#1a2332', fontSize: '1rem' }}>{currentUser.phoneNumber}</h3>
            </div>
            <div style={{ marginBottom: '2rem' }}>
              <h4 style={{ fontSize: '0.72rem', color: '#5a6a7e', textTransform: 'uppercase', letterSpacing: '0.08em', fontWeight: 700, marginBottom: '1rem', paddingBottom: '0.5rem', borderBottom: '1px solid #eef0f3', display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                <Settings size={13} /> Auto-Fill Profile
              </h4>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                <div>
                  <label style={{ fontSize: '0.72rem', color: '#5a6a7e', textTransform: 'uppercase', fontWeight: 700, marginBottom: '0.4rem', display: 'block' }}>Full Name</label>
                  <input type="text" className="input-field" value={userProfile.name} onChange={e => { const p = { ...userProfile, name: e.target.value }; setUserProfile(p); localStorage.setItem('qpulse_user_profile', JSON.stringify(p)); }} placeholder="Your name" />
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 2fr', gap: '0.75rem' }}>
                  <div>
                    <label style={{ fontSize: '0.72rem', color: '#5a6a7e', textTransform: 'uppercase', fontWeight: 700, marginBottom: '0.4rem', display: 'block' }}>Age</label>
                    <input type="number" className="input-field" value={userProfile.age} onChange={e => { const p = { ...userProfile, age: e.target.value }; setUserProfile(p); localStorage.setItem('qpulse_user_profile', JSON.stringify(p)); }} placeholder="Yrs" />
                  </div>
                  <div>
                    <label style={{ fontSize: '0.72rem', color: '#5a6a7e', textTransform: 'uppercase', fontWeight: 700, marginBottom: '0.4rem', display: 'block' }}>Symptom</label>
                    <input type="text" className="input-field" value={userProfile.disease} onChange={e => { const p = { ...userProfile, disease: e.target.value }; setUserProfile(p); localStorage.setItem('qpulse_user_profile', JSON.stringify(p)); }} placeholder="e.g. Checkup" />
                  </div>
                </div>
              </div>
            </div>

            <div style={{ marginBottom: '2rem' }}>
              <h4 style={{ fontSize: '0.72rem', color: '#5a6a7e', textTransform: 'uppercase', letterSpacing: '0.08em', fontWeight: 700, marginBottom: '1rem', paddingBottom: '0.5rem', borderBottom: '1px solid #eef0f3', display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                <Bell size={13} /> Notification Preferences
              </h4>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: '0.85rem', color: '#1a2332', cursor: 'pointer' }}>
                  <input
                    type="checkbox"
                    checked={pushEnabled}
                    onChange={handlePushToggle}
                    disabled={isTogglingPush}
                  />
                  Enable Push Notifications
                </label>
                <span style={{ fontSize: '0.7rem', color: '#5a6a7e', marginLeft: '1.4rem' }}>
                  Get browser alerts when your token is near.
                </span>
              </div>
            </div>

            <button onClick={() => { setShowSidebar(false); setShowHistory(true); }} className="btn btn-outline" style={{ width: '100%', padding: '0.85rem', color: '#007BFF', borderColor: 'rgba(0,123,255,0.25)', marginBottom: '1rem' }}>
              <History size={16} /> View Medical History
            </button>
          </div>
          <div style={{ padding: '1.5rem', borderTop: '1px solid #eef0f3' }}>
            <button onClick={() => { signOut(auth); setShowSidebar(false); }} className="btn" style={{ width: '100%', background: 'rgba(220,53,69,0.08)', color: '#dc3545', border: '1px solid rgba(220,53,69,0.2)', borderRadius: 10 }}>
              <LogOut size={16} /> Log Out
            </button>
          </div>
        </div>
      )}
    </main>
  );
}

const ClinicCard = React.memo(function ClinicCard({ clinic, isFavorite, onFavoriteToggle, onBookClick }: any) {
  const [showQR, setShowQR] = useState(false);
  const [showDetails, setShowDetails] = useState(false);

  const patientUrl = useMemo(() => typeof window !== 'undefined' ? `${window.location.origin}/?addFavorite=${clinic.id}` : '', [clinic.id]);

  const degrees = clinic.dr_degree || 'MBBS, MD';
  const specialization = clinic.specialization || 'General Physician';
  const fees = clinic.fees || '500';
  const phone = clinic.phone_number || 'Not listed';
  const hours = clinic.operating_hours || '10:00 AM – 6:00 PM';
  const isOpen = !!clinic.is_open;
  const initials = (clinic.doctor_name || 'DR').split(' ').map((w: string) => w[0]).join('').toUpperCase().slice(0, 2);

  return (
    <div style={{
      background: '#fff', borderRadius: 18,
      boxShadow: '0 2px 8px rgba(0,0,0,0.06), 0 8px 28px rgba(0,0,0,0.04)',
      border: `1px solid ${isOpen ? 'rgba(0,123,255,0.12)' : 'rgba(220,53,69,0.12)'}`,
      overflow: 'hidden', display: 'flex', flexDirection: 'column',
      transition: 'transform 0.25s ease, box-shadow 0.25s ease',
      borderTop: `4px solid ${isOpen ? '#007BFF' : '#dc3545'}`,
      position: 'relative'
    }}
      onMouseEnter={e => { (e.currentTarget as HTMLDivElement).style.transform = 'translateY(-4px)'; (e.currentTarget as HTMLDivElement).style.boxShadow = '0 4px 12px rgba(0,0,0,0.08), 0 16px 40px rgba(0,123,255,0.1)'; }}
      onMouseLeave={e => { (e.currentTarget as HTMLDivElement).style.transform = ''; (e.currentTarget as HTMLDivElement).style.boxShadow = '0 2px 8px rgba(0,0,0,0.06), 0 8px 28px rgba(0,0,0,0.04)'; }}
    >
      {/* Quick Actions */}
      <div style={{ position: 'absolute', top: '1rem', right: '1rem', display: 'flex', gap: '0.4rem', zIndex: 10 }}>
        <button onClick={e => onFavoriteToggle(clinic.id, e)}
          style={{ background: isFavorite ? 'rgba(220,53,69,0.1)' : '#f8fafc', border: `1px solid ${isFavorite ? 'rgba(220,53,69,0.3)' : '#eef0f3'}`, borderRadius: '50%', cursor: 'pointer', padding: '0.4rem', display: 'flex' }}
          title={isFavorite ? 'Remove from favourites' : 'Add to favourites'}>
          <Star size={15} fill={isFavorite ? '#dc3545' : 'none'} color={isFavorite ? '#dc3545' : '#5a6a7e'} />
        </button>
        <button onClick={e => { e.preventDefault(); e.stopPropagation(); setShowQR(!showQR); }}
          style={{ background: showQR ? 'rgba(0,123,255,0.1)' : '#f8fafc', border: `1px solid ${showQR ? 'rgba(0,123,255,0.3)' : '#eef0f3'}`, borderRadius: '50%', cursor: 'pointer', padding: '0.4rem', display: 'flex' }}
          title="Show QR Code">
          <QrCode size={15} color={showQR ? '#007BFF' : '#5a6a7e'} />
        </button>
      </div>

      <div style={{ padding: '1.5rem' }}>
        {/* Clinic name + live status */}
        <div style={{ paddingRight: '5rem', marginBottom: '1.25rem' }}>
          <h2 style={{ fontSize: '1.2rem', fontWeight: 800, margin: '0 0 0.4rem 0', color: '#1a2332', letterSpacing: '-0.3px' }}>{clinic.name}</h2>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.4rem' }}>
            <span style={{
              display: 'inline-flex', alignItems: 'center', gap: '0.35rem',
              padding: '0.2rem 0.75rem', borderRadius: 20, fontSize: '0.72rem', fontWeight: 700,
              background: isOpen ? 'rgba(40,167,69,0.1)' : 'rgba(220,53,69,0.1)',
              color: isOpen ? '#28a745' : '#dc3545',
              border: `1px solid ${isOpen ? 'rgba(40,167,69,0.25)' : 'rgba(220,53,69,0.25)'}`
            }}>
              {isOpen && <span style={{ width: 6, height: 6, background: '#28a745', borderRadius: '50%', boxShadow: '0 0 6px #28a745', animation: 'pulse 2s infinite', display: 'inline-block' }} />}
              {isOpen ? 'Queue is Live' : 'Clinic Closed'}
            </span>
            {clinic.notification_config?.sms_enabled && (
              <span style={{
                display: 'inline-flex', alignItems: 'center', gap: '0.25rem',
                padding: '0.2rem 0.75rem', borderRadius: 20, fontSize: '0.72rem', fontWeight: 700,
                background: 'rgba(0,123,255,0.08)', color: '#007BFF',
                border: '1px solid rgba(0,123,255,0.2)'
              }} title="SMS alerts sent automatically">
                <Bell size={11} /> SMS Active
              </span>
            )}
          </div>
        </div>

        {/* Doctor section */}
        <div style={{ display: 'flex', gap: '0.9rem', alignItems: 'center', padding: '1rem', background: '#f8fafc', borderRadius: 12, border: '1px solid #eef0f3', marginBottom: '1.25rem' }}>
          <div style={{ width: 52, height: 52, borderRadius: '50%', flexShrink: 0, overflow: 'hidden', background: 'linear-gradient(135deg,#e8f4fd,#cce4f8)', border: '2px solid #fff', boxShadow: '0 2px 8px rgba(0,123,255,0.15)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            {clinic.doctor_image_url
              ? <img src={clinic.doctor_image_url} alt={clinic.doctor_name} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
              : <span style={{ fontWeight: 700, fontSize: '1rem', color: '#007BFF' }}>{initials}</span>}
          </div>
          <div style={{ minWidth: 0 }}>
            <h3 style={{ margin: '0 0 0.15rem 0', fontSize: '0.98rem', fontWeight: 700, color: '#1a2332', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{clinic.doctor_name}</h3>
            <p style={{ margin: '0 0 0.4rem 0', fontSize: '0.78rem', color: '#007BFF', fontWeight: 600 }}>{degrees}</p>
            <span style={{ display: 'inline-flex', alignItems: 'center', gap: '0.25rem', background: 'rgba(0,123,255,0.08)', color: '#007BFF', padding: '0.15rem 0.6rem', borderRadius: 20, fontSize: '0.7rem', fontWeight: 600 }}>
              <Stethoscope size={10} /> {specialization}
            </span>
          </div>
        </div>

        {/* Live token counter */}
        <div style={{ display: 'flex', justifyContent: 'space-around', padding: '1.25rem 1rem', background: isOpen ? '#f0f7ff' : '#f8fafc', borderRadius: 12, border: `1px solid ${isOpen ? 'rgba(0,123,255,0.12)' : '#eef0f3'}`, marginBottom: '1.25rem' }}>
          <div style={{ textAlign: 'center' }}>
            <span style={{ display: 'block', fontSize: '0.65rem', color: '#5a6a7e', textTransform: 'uppercase', fontWeight: 700, letterSpacing: '0.07em', marginBottom: '0.3rem' }}>Now Serving</span>
            <strong style={{ fontSize: '2.4rem', lineHeight: 1, color: isOpen ? '#28a745' : '#5a6a7e', fontWeight: 900 }}>
              {isOpen ? (clinic.currently_serving_token || '--') : '--'}
            </strong>
          </div>
          <div style={{ width: 1, background: isOpen ? 'rgba(0,123,255,0.15)' : '#eef0f3' }} />
          <div style={{ textAlign: 'center' }}>
            <span style={{ display: 'block', fontSize: '0.65rem', color: '#5a6a7e', textTransform: 'uppercase', fontWeight: 700, letterSpacing: '0.07em', marginBottom: '0.3rem' }}>Waiting</span>
            <strong style={{ fontSize: '2.4rem', lineHeight: 1, color: isOpen ? '#007BFF' : '#5a6a7e', fontWeight: 900 }}>
              {isOpen ? clinic.patient_count : '--'}
            </strong>
          </div>
        </div>

        {/* Expandable clinic details */}
        <button onClick={() => setShowDetails(!showDetails)}
          style={{ width: '100%', background: 'none', border: 'none', color: '#5a6a7e', fontSize: '0.82rem', padding: '0.5rem 0', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.4rem', fontFamily: 'inherit' }}>
          {showDetails ? 'Hide Details' : 'View Clinic Info'}
          {showDetails ? <ChevronUp size={15} /> : <ChevronDown size={15} />}
        </button>

        {showDetails && (
          <div style={{ padding: '1rem', background: '#f8fafc', borderRadius: 10, border: '1px solid #eef0f3', marginTop: '0.5rem', display: 'flex', flexDirection: 'column', gap: '0.7rem' }}>
            <a href={`https://maps.google.com/?q=${encodeURIComponent(clinic.location)}`} target="_blank" rel="noopener noreferrer"
              style={{ display: 'flex', alignItems: 'center', gap: '0.55rem', fontSize: '0.82rem', color: '#5a6a7e', textDecoration: 'none' }}>
              <MapPin size={14} color="#007BFF" style={{ flexShrink: 0 }} /> {clinic.location}
            </a>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.55rem', fontSize: '0.82rem', color: '#5a6a7e' }}>
              <Clock size={14} color="#007BFF" style={{ flexShrink: 0 }} /> {hours}
            </div>
            <a href={`tel:${phone}`} style={{ display: 'flex', alignItems: 'center', gap: '0.55rem', fontSize: '0.82rem', color: '#5a6a7e', textDecoration: 'none' }}>
              <Phone size={14} color="#007BFF" style={{ flexShrink: 0 }} /> {phone}
            </a>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.55rem', fontSize: '0.82rem', color: '#5a6a7e' }}>
              <IndianRupee size={14} color="#28a745" style={{ flexShrink: 0 }} /> ₹{fees} per consultation · Pay at desk
            </div>
          </div>
        )}

        {/* Book Button */}
        <button onClick={() => onBookClick(clinic)} disabled={!isOpen}
          className="btn btn-primary"
          style={{ width: '100%', padding: '0.85rem', fontSize: '0.95rem', fontWeight: 700, marginTop: '1rem', opacity: isOpen ? 1 : 0.5, justifyContent: 'center' }}>
          {isOpen ? <><CalendarPlus size={17} /> Book Token Now</> : 'Currently Closed'}
        </button>

        {/* QR code */}
        {showQR && (
          <div style={{ marginTop: '1.25rem', paddingTop: '1.25rem', borderTop: '1px solid #eef0f3', textAlign: 'center' }}>
            <p style={{ fontSize: '0.78rem', color: '#5a6a7e', marginBottom: '0.75rem', fontWeight: 500 }}>Scan to add this clinic to favourites on another device</p>
            <div style={{ background: 'white', padding: '0.75rem', borderRadius: 10, display: 'inline-block', border: '1px solid #eef0f3', boxShadow: '0 2px 8px rgba(0,0,0,0.06)' }}>
              <QRCodeSVG value={patientUrl} size={130} />
            </div>
          </div>
        )}
      </div>
    </div>
  );
});
