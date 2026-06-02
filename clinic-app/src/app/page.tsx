'use client'

import { subscribeToActiveClinics, subscribeToUserActiveTokens, addPatientToken, cancelUserToken, getUserMedicalHistory, saveFcmToken, ensurePatientProfile, subscribeToPatientsAheadCount, updatePatientProfile } from '@/lib/actions';
import { grantClinicAccess, revokeClinicAccess } from '@/lib/patientActions';
import { auth, db, storage } from '@/lib/firebase';
import { collection, query, where, getDocs, orderBy } from 'firebase/firestore';
import { ref, uploadBytes, getDownloadURL } from 'firebase/storage';
import { onAuthStateChanged, signOut } from 'firebase/auth';
import Link from 'next/link';
import LanguageSelector from '@/components/LanguageSelector';
import React, { useState, useEffect, Suspense, useRef, useMemo, useCallback } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import { Settings, Activity, Hospital, MapPin, Search as SearchIcon, Stethoscope, Star, Heart, QrCode, LogOut, Ticket, Loader2, CalendarPlus, X, History, ChevronDown, ChevronUp, Phone, Clock, UserRound, IndianRupee, CheckCircle, ArrowLeft, ArrowRight, Info, Sun, Moon, Bell, FilePlus, Lock, Building } from 'lucide-react';

import dynamic from 'next/dynamic';
import Image from 'next/image';

const DynamicQRCodeSVG = dynamic(() => import('qrcode.react').then(mod => mod.QRCodeSVG), { ssr: false });
const TokenAheadCounter = ({ clinicId, queuedAtMillis }: { clinicId: string, queuedAtMillis: number }) => {
  const [count, setCount] = useState<number | null>(null);
  useEffect(() => {
    return subscribeToPatientsAheadCount(clinicId, queuedAtMillis, setCount);
  }, [clinicId, queuedAtMillis]);
  if (count === null) return null;
  return (
    <div style={{ textAlign: 'center', marginTop: '1rem', background: count === 0 ? '#d1fae5' : '#fffbeb', padding: '0.6rem', borderRadius: 8, color: count === 0 ? '#059669' : '#f59e0b', fontSize: '0.85rem', fontWeight: 700 }}>
      {count === 0 ? "You're Next!" : `${count} patients ahead of you`}
    </div>
  );
};

// Hook to detect iOS Safari and if it's already installed
function useIOSInstallPrompt() {
  const [showPrompt, setShowPrompt] = useState(false);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    const isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent) && !(window as any).MSStream;
    const isSafari = /WebKit/.test(navigator.userAgent) && !/CriOS|FxiOS|OPiOS/.test(navigator.userAgent);
    const isStandalone = window.matchMedia('(display-mode: standalone)').matches || (navigator as any).standalone;
    const dismissed = localStorage.getItem('qpulse_ios_prompt_dismissed') === 'true';

    if (isIOS && isSafari && !isStandalone && !dismissed) {
      setShowPrompt(true);
    }
  }, []);

  const dismiss = () => {
    setShowPrompt(false);
    localStorage.setItem('qpulse_ios_prompt_dismissed', 'true');
  };

  return { showPrompt, dismiss };
}

function IOSInstallBanner() {
  const { showPrompt, dismiss } = useIOSInstallPrompt();
  
  if (!showPrompt) return null;

  return (
    <div className="fade-in" style={{
      position: 'fixed', bottom: 0, left: 0, right: 0, 
      background: 'rgba(255, 255, 255, 0.98)', 
      backdropFilter: 'blur(10px)',
      boxShadow: '0 -4px 12px rgba(0,0,0,0.1)',
      padding: '1rem', paddingBottom: 'max(1rem, env(safe-area-inset-bottom))',
      zIndex: 9999, display: 'flex', alignItems: 'flex-start', gap: '1rem',
      borderTop: '1px solid #e2e8f0'
    }}>
      <div style={{ flex: 1 }}>
        <h4 style={{ margin: '0 0 0.25rem 0', fontSize: '0.95rem', color: '#1a2332' }}>Install Q-PULSE</h4>
        <p style={{ margin: 0, fontSize: '0.8rem', color: '#5a6a7e', lineHeight: 1.4 }}>
          Tap the <b>Share</b> button <span style={{display:'inline-block', border:'1px solid #ccc', padding:'2px 4px', borderRadius:4, margin:'0 2px'}}>⏍</span> below, then select <b>"Add to Home Screen"</b>.
        </p>
      </div>
      <button onClick={dismiss} style={{ background: 'none', border: 'none', padding: '0.2rem', cursor: 'pointer', color: '#94a3b8' }}>
        <X size={20} />
      </button>
    </div>
  );
}

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
  const [searchTab, setSearchTab] = useState<'clinic' | 'hospital' | 'doctor'>('clinic');
  const [hospitals, setHospitals] = useState<any[]>([]);
  const [doctorResults, setDoctorResults] = useState<any[]>([]);
  const [hospitalSearch, setHospitalSearch] = useState('');
  const [doctorSearch, setDoctorSearch] = useState('');
  const [searchingHospitals, setSearchingHospitals] = useState(false);
  const [searchingDoctors, setSearchingDoctors] = useState(false);
  const [loading, setLoading] = useState(true);
  const [errorMsg, setErrorMsg] = useState('');
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
  const [useInsurance, setUseInsurance] = useState(false);
  const [insuranceProvider, setInsuranceProvider] = useState('');
  const [insurancePolicy, setInsurancePolicy] = useState('');
  const [insuranceImage, setInsuranceImage] = useState<File | null>(null);
  const [consultationType, setConsultationType] = useState<'IN_PERSON' | 'VIDEO'>('IN_PERSON');
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
    
    // Language state removed for Google Translate

    let unsubscribeTokens: () => void;
    const unsubscribeAuth = onAuthStateChanged(auth, (user) => {
      setCurrentUser(user);
      if (user && user.phoneNumber) {
        ensurePatientProfile(user.uid, user.phoneNumber);
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
      setErrorMsg('');
    }, (err) => {
      setErrorMsg(err.message || 'Failed to connect to database');
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
    setUseInsurance(false);
    setInsuranceProvider('');
    setInsurancePolicy('');
    setInsuranceImage(null);
    setBookingClinic(clinic);
  }, [currentUser, myTokens, userProfile, router]);

  const submitBooking = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!bookingClinic || !patientName || !currentUser?.phoneNumber) return;
    if (useInsurance && (!insuranceProvider || !insuranceImage)) {
      alert('Please provide your insurance provider and upload a photo of your ID card.');
      return;
    }
    if ('Notification' in window && Notification.permission !== 'granted' && Notification.permission !== 'denied') {
      try { await Notification.requestPermission(); } catch {}
    }
    setIsBooking(true);
    try {
      const p = { name: patientName, age: patientAge, disease };
      setUserProfile(p);
      localStorage.setItem('qpulse_user_profile', JSON.stringify(p));
      await updatePatientProfile(currentUser.uid, p);

      let card_image_url = '';
      if (useInsurance && insuranceImage) {
        const fileExt = insuranceImage.name.split('.').pop() || 'jpg';
        const fileRef = ref(storage, `insurance/${currentUser.uid}/${Date.now()}.${fileExt}`);
        await uploadBytes(fileRef, insuranceImage);
        card_image_url = await getDownloadURL(fileRef);
      }

      const insurancePayload = useInsurance ? {
        provider_name: insuranceProvider,
        policy_number: insurancePolicy,
        card_image_url,
        verification_status: 'PENDING' as const
      } : undefined;

      const tokenStr = await addPatientToken(
        bookingClinic.id,
        patientName,
        parseInt(patientAge) || 0,
        0,
        disease,
        currentUser.phoneNumber || '',
        'online',
        insurancePayload,
        consultationType
      );
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

  // Hospital search — fetch on demand (only when user actually types)
  useEffect(() => {
    if (searchTab !== 'hospital' || hospitalSearch.trim().length < 2) {
      setHospitals([]);
      return;
    }
    setSearchingHospitals(true);
    const term = hospitalSearch.toLowerCase();
    getDocs(query(collection(db, 'hospitals')))
      .then(snap => {
        const results = snap.docs
          .map(d => ({ id: d.id, ...d.data() }))
          .filter((h: any) =>
            h.name?.toLowerCase().includes(term) ||
            h.city?.toLowerCase().includes(term) ||
            h.address?.toLowerCase().includes(term)
          );
        setHospitals(results);
      })
      .finally(() => setSearchingHospitals(false));
  }, [hospitalSearch, searchTab]);

  // Doctor search — query clinics by doctor_name field
  useEffect(() => {
    if (searchTab !== 'doctor' || doctorSearch.trim().length < 2) {
      setDoctorResults([]);
      return;
    }
    setSearchingDoctors(true);
    const term = doctorSearch.toLowerCase();
    // Filter already-loaded clinics for speed
    const matches = clinics.filter(c =>
      c.doctor_name?.toLowerCase().includes(term) ||
      c.specialization?.toLowerCase().includes(term)
    );
    setDoctorResults(matches);
    setSearchingDoctors(false);
  }, [doctorSearch, searchTab, clinics]);

  return (
    <>
      <IOSInstallBanner />
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

            {/* About / For Providers */}
            <Link href="/about" style={{ ...iconBtn, width: 'auto', padding: '0 0.75rem', gap: '0.4rem', color: navSub, fontSize: '0.8rem', fontWeight: 600, textDecoration: 'none' }} title="For Providers" aria-label="For Providers">
              <Building size={16} />
              {!isMobile && 'For Providers'}
            </Link>

            {/* Language Selector */}
            <LanguageSelector isMobile={false} />

            {/* Theme toggle */}
            <button onClick={toggleTheme} style={iconBtn} title={isDark ? 'Light mode' : 'Dark mode'} aria-label="Toggle theme">
              {isDark ? <Sun size={16} color="#fbbf24" /> : <Moon size={16} />}
            </button>

             {/* Auth */}
            {currentUser ? (
              <button
                onClick={() => router.push('/profile')}
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

          {/* ── 3-in-1 Universal Search ── */}
          <div style={{ width: '100%', maxWidth: 580 }}>
            {/* Tab Row */}
            <div style={{ display: 'flex', background: isDark ? 'rgba(255,255,255,0.06)' : '#f0f4f8', borderRadius: '10px 10px 0 0', overflow: 'hidden', border: `1px solid ${isDark ? 'rgba(255,255,255,0.1)' : '#dee2e8'}`, borderBottom: 'none' }}>
              {(['clinic', 'hospital', 'doctor'] as const).map(tab => (
                <button
                  key={tab}
                  onClick={() => setSearchTab(tab)}
                  style={{
                    flex: 1, border: 'none', cursor: 'pointer',
                    padding: '0.6rem 0.5rem', fontSize: '0.78rem', fontWeight: 700,
                    background: searchTab === tab
                      ? (isDark ? 'rgba(0,123,255,0.2)' : 'white')
                      : 'transparent',
                    color: searchTab === tab ? '#007BFF' : (isDark ? '#94a3b8' : '#5a6a7e'),
                    borderBottom: searchTab === tab ? '2px solid #007BFF' : '2px solid transparent',
                    transition: 'all 0.2s', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.3rem',
                    fontFamily: 'inherit',
                  }}
                >
                  {tab === 'clinic' && <><Stethoscope size={13} /> Clinic</>}
                  {tab === 'hospital' && <><Hospital size={13} /> Hospital</>}
                  {tab === 'doctor' && <><UserRound size={13} /> Doctor</>}
                </button>
              ))}
            </div>

            {/* Search Input */}
            <div style={{ position: 'relative' }}>
              <SearchIcon style={{ position: 'absolute', left: '1.1rem', top: '50%', transform: 'translateY(-50%)', color: '#5a6a7e', zIndex: 1 }} size={18} />
              {searchTab === 'clinic' && (
                <input type="text" className="input-field"
                  placeholder="Search clinic name, doctor, or location…"
                  style={{ paddingLeft: '3rem', background: isDark ? '#0d1929' : '#fff', border: `1.5px solid ${isDark ? 'rgba(255,255,255,0.15)' : '#dee2e8'}`, borderRadius: '0 0 12px 12px', fontSize: '0.95rem', height: 52, boxShadow: '0 2px 12px rgba(0,0,0,0.06)' }}
                  value={search} onChange={e => setSearch(e.target.value)}
                />
              )}
              {searchTab === 'hospital' && (
                <input type="text" className="input-field"
                  placeholder="Search hospital or branch name, city…"
                  style={{ paddingLeft: '3rem', background: isDark ? '#0d1929' : '#fff', border: `1.5px solid ${isDark ? 'rgba(255,255,255,0.15)' : '#dee2e8'}`, borderRadius: '0 0 12px 12px', fontSize: '0.95rem', height: 52, boxShadow: '0 2px 12px rgba(0,0,0,0.06)' }}
                  value={hospitalSearch} onChange={e => setHospitalSearch(e.target.value)}
                />
              )}
              {searchTab === 'doctor' && (
                <input type="text" className="input-field"
                  placeholder="Search doctor name or specialization…"
                  style={{ paddingLeft: '3rem', background: isDark ? '#0d1929' : '#fff', border: `1.5px solid ${isDark ? 'rgba(255,255,255,0.15)' : '#dee2e8'}`, borderRadius: '0 0 12px 12px', fontSize: '0.95rem', height: 52, boxShadow: '0 2px 12px rgba(0,0,0,0.06)' }}
                  value={doctorSearch} onChange={e => setDoctorSearch(e.target.value)}
                />
              )}
            </div>
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

        {/* Recent Visit Upload Prompt */}
        {currentUser && myHistory.length > 0 && (
          <RecentVisitUploadPrompt 
            visit={myHistory[0]} 
            currentUser={currentUser} 
            onUploadSuccess={() => {
              getUserMedicalHistory(currentUser.phoneNumber).then(history => setMyHistory(history));
            }}
          />
        )}

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
                const positionsAhead = myTokensRef.current.filter(t => t.clinic_id === token.clinic_id && Number(t.token_number) < Number(token.token_number)).length;
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
                    {token.queued_at && mc && (
                      <TokenAheadCounter clinicId={token.clinic_id} queuedAtMillis={token.queued_at.toMillis()} />
                    )}

                    <div style={{ marginTop: '1rem' }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.75rem' }}>
                        <span>Status</span>
                        <span style={{ fontWeight: 800, color: '#4f46e5' }}>{token.status || 'WAITING'}</span>
                      </div>
                    </div>

                    {token.consultation_type === 'VIDEO' && ((mc && Number(token.token_number) - Number(mc.currently_serving_token) <= 0) || token.status === 'SERVING') && (
                      <Link href={`/consult/${token.id}`} style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.5rem', background: '#25D366', color: 'white', padding: '0.75rem', borderRadius: '12px', textDecoration: 'none', fontWeight: 700, marginTop: '1rem', animation: 'pulse 2s infinite' }}>
                        <span style={{ fontSize: '1.2rem' }}>📹</span> Join Video Call Now
                      </Link>
                    )}
                    
                    <div style={{ display: 'flex', gap: '0.5rem', marginTop: '1rem' }}>
                      <button 
                        onClick={async () => {
                          if (!currentUser) return;
                          try {
                            await grantClinicAccess(currentUser.uid, token.clinic_id);
                            alert('Access granted! Doctor can now securely view your past medical history.');
                          } catch(err) { alert('Failed to grant access'); }
                        }}
                        style={{ flex: 1, padding: '0.55rem', fontSize: '0.75rem', background: 'rgba(40,167,69,0.1)', color: '#28a745', border: '1px solid rgba(40,167,69,0.2)', borderRadius: 9, cursor: 'pointer', fontWeight: 600 }}
                      >
                        Grant History Access
                      </button>
                      
                      <button 
                        onClick={async () => {
                          if (!currentUser) return;
                          try {
                            await revokeClinicAccess(currentUser.uid, token.clinic_id);
                            alert('Access revoked! Doctor can no longer see your history.');
                          } catch(err) { alert('Failed to revoke access'); }
                        }}
                        style={{ padding: '0.55rem 0.75rem', fontSize: '0.75rem', background: '#fff', color: '#5a6a7e', border: '1px solid #eef0f3', borderRadius: 9, cursor: 'pointer' }}
                        title="Revoke Access"
                      >
                        <Lock size={14} />
                      </button>
                    </div>

                    <button onClick={() => handleCancelToken(token.clinic_id, token.id)} style={{ width: '100%', marginTop: '0.5rem', padding: '0.55rem', fontSize: '0.8rem', background: 'rgba(220,53,69,0.06)', color: '#dc3545', border: '1px solid rgba(220,53,69,0.2)', borderRadius: 9, cursor: 'pointer', fontFamily: 'inherit' }}>
                      Cancel Appointment
                    </button>
                  </div>
                );
              })}
            </div>
            <div style={{ margin: '2rem 0', height: 1, background: 'linear-gradient(90deg,transparent,#dee2e8,transparent)' }} />
          </section>
        )}

        {/* Hospital Search Results */}
        {searchTab === 'hospital' && (
          <section style={{ marginBottom: '3rem' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem', marginBottom: '1.25rem' }}>
              <div style={{ padding: '0.4rem', background: 'rgba(99,102,241,0.1)', borderRadius: '8px' }}>
                <Hospital size={18} color="#6366f1" />
              </div>
              <h2 style={{ fontSize: '1.05rem', fontWeight: 700, color: '#1a2332', margin: 0 }}>
                {hospitalSearch.length >= 2 ? `Hospitals matching "${hospitalSearch}"` : 'Search Hospitals & Branches'}
              </h2>
            </div>
            {hospitalSearch.length < 2 ? (
              <div style={{ textAlign: 'center', padding: '3rem', color: '#94a3b8', background: '#f8fafc', borderRadius: 16, border: '1px dashed #dee2e8' }}>
                <Hospital size={36} style={{ margin: '0 auto 0.75rem', opacity: 0.3 }} />
                <p style={{ margin: 0 }}>Type at least 2 characters to search hospitals…</p>
              </div>
            ) : searchingHospitals ? (
              <div style={{ textAlign: 'center', padding: '3rem' }}><Loader2 size={28} className="animate-spin" style={{ color: '#6366f1' }} /></div>
            ) : hospitals.length === 0 ? (
              <div style={{ textAlign: 'center', padding: '3rem', color: '#94a3b8', background: '#f8fafc', borderRadius: 16, border: '1px dashed #dee2e8' }}>
                <p style={{ margin: 0 }}>No hospitals found for &quot;{hospitalSearch}&quot;</p>
              </div>
            ) : (
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill,minmax(280px,1fr))', gap: '1rem' }}>
                {hospitals.map((h: any) => (
                  <div key={h.id} style={{ background: 'white', borderRadius: 16, padding: '1.5rem', border: '1px solid #eef0f3', borderLeft: '4px solid #6366f1', boxShadow: '0 2px 12px rgba(99,102,241,0.06)' }}>
                    <div style={{ display: 'flex', gap: '0.75rem' }}>
                      <div style={{ width: 40, height: 40, borderRadius: 10, background: 'rgba(99,102,241,0.1)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                        <Hospital size={20} color="#6366f1" />
                      </div>
                      <div>
                        <h3 style={{ margin: '0 0 0.2rem', fontSize: '0.95rem', fontWeight: 700, color: '#1a2332' }}>{h.name}</h3>
                        <p style={{ margin: 0, fontSize: '0.78rem', color: '#5a6a7e' }}>{h.city}{h.address ? ` · ${h.address}` : ''}</p>
                      </div>
                    </div>
                    <div style={{ marginTop: '1rem', fontSize: '0.78rem', color: '#5a6a7e', display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                      <Stethoscope size={12} />
                      {clinics.filter(c => c.hospital_id === h.id).length} clinic room(s)
                    </div>
                  </div>
                ))}
              </div>
            )}
          </section>
        )}

        {/* Doctor Search Results */}
        {searchTab === 'doctor' && (
          <section style={{ marginBottom: '3rem' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem', marginBottom: '1.25rem' }}>
              <div style={{ padding: '0.4rem', background: 'rgba(16,185,129,0.1)', borderRadius: '8px' }}>
                <UserRound size={18} color="#10b981" />
              </div>
              <h2 style={{ fontSize: '1.05rem', fontWeight: 700, color: '#1a2332', margin: 0 }}>
                {doctorSearch.length >= 2 ? `Doctors matching "${doctorSearch}"` : 'Search Doctors & Specializations'}
              </h2>
            </div>
            {doctorSearch.length < 2 ? (
              <div style={{ textAlign: 'center', padding: '3rem', color: '#94a3b8', background: '#f8fafc', borderRadius: 16, border: '1px dashed #dee2e8' }}>
                <UserRound size={36} style={{ margin: '0 auto 0.75rem', opacity: 0.3 }} />
                <p style={{ margin: 0 }}>Type a doctor name or specialization to search…</p>
              </div>
            ) : doctorResults.length === 0 ? (
              <div style={{ textAlign: 'center', padding: '3rem', color: '#94a3b8', background: '#f8fafc', borderRadius: 16, border: '1px dashed #dee2e8' }}>
                <p style={{ margin: 0 }}>No doctors found for &quot;{doctorSearch}&quot;</p>
              </div>
            ) : (
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill,minmax(280px,1fr))', gap: '1rem' }}>
                {doctorResults.map((clinic: any) => (
                  <div key={clinic.id} style={{ background: 'white', borderRadius: 16, padding: '1.5rem', border: '1px solid #eef0f3', borderLeft: '4px solid #10b981', boxShadow: '0 2px 12px rgba(16,185,129,0.06)' }}>
                    <div style={{ display: 'flex', gap: '0.75rem' }}>
                      <div style={{ width: 44, height: 44, borderRadius: '50%', background: 'rgba(16,185,129,0.1)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                        <UserRound size={20} color="#10b981" />
                      </div>
                      <div>
                        <h3 style={{ margin: '0 0 0.15rem', fontSize: '0.95rem', fontWeight: 700, color: '#1a2332' }}>Dr. {clinic.doctor_name}</h3>
                        {clinic.specialization && <p style={{ margin: '0 0 0.2rem', fontSize: '0.78rem', color: '#10b981', fontWeight: 600 }}>{clinic.specialization}</p>}
                        <p style={{ margin: 0, fontSize: '0.75rem', color: '#5a6a7e' }}>{clinic.name}</p>
                      </div>
                    </div>
                    <div style={{ marginTop: '0.75rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <span style={{ fontSize: '0.75rem', color: clinic.is_open ? '#10b981' : '#94a3b8', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '0.3rem' }}>
                        <span style={{ width: 7, height: 7, borderRadius: '50%', background: clinic.is_open ? '#10b981' : '#94a3b8', display: 'inline-block' }} />
                        {clinic.is_open ? 'Open' : 'Closed'}
                      </span>
                      <button onClick={() => { setSearchTab('clinic'); setSearch(clinic.doctor_name); }} style={{ fontSize: '0.75rem', fontWeight: 700, background: 'rgba(0,123,255,0.08)', color: '#007BFF', border: '1px solid rgba(0,123,255,0.2)', borderRadius: 8, padding: '0.35rem 0.7rem', cursor: 'pointer', fontFamily: 'inherit' }}>
                        Book Token
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </section>
        )}

        {/* Favourites (clinic tab only) */}
        {searchTab === 'clinic' && favorites.length > 0 && !search && (
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

        {/* Clinic Directory header (clinic tab only) */}
        {searchTab === 'clinic' && (
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
        </div>)}


        {searchTab === 'clinic' && (
        <div className="grid-clinics">
          {loading ? (
            <div style={{ gridColumn: '1/-1', textAlign: 'center', padding: '5rem 2rem', background: '#fff', borderRadius: 16, border: '1px solid #eef0f3' }}>
              <Loader2 size={36} className="animate-spin" style={{ color: '#007BFF', margin: '0 auto 1rem' }} />
              <p style={{ color: '#5a6a7e', fontWeight: 500 }}>Loading clinics…</p>
            </div>
          ) : errorMsg ? (
            <div style={{ gridColumn: '1/-1', textAlign: 'center', padding: '4rem 2rem', background: 'rgba(220,53,69,0.05)', borderRadius: 16, border: '1px solid rgba(220,53,69,0.2)' }}>
              <p style={{ color: '#dc3545', fontWeight: 700, marginBottom: '0.5rem' }}>Connection Error</p>
              <p style={{ color: '#5a6a7e', fontSize: '0.9rem' }}>{errorMsg}</p>
              <p style={{ color: '#5a6a7e', fontSize: '0.85rem', marginTop: '1rem' }}>Please verify Firebase App Check / Security Rules.</p>
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
        )}


        {/* ── FOOTER ────────────────────────────────────── */}
        <footer style={{ marginTop: '4rem', paddingTop: '2rem', borderTop: '1px solid #eef0f3', display: 'flex', justifyContent: 'center', alignItems: 'center', gap: '1.25rem', flexWrap: 'wrap' }}>
          <Link href="/about" style={{ fontSize: '0.85rem', color: '#5a6a7e', textDecoration: 'none', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '0.3rem' }}>
            <Building size={15} /> For Providers
          </Link>
          <span style={{ width: 4, height: 4, borderRadius: '50%', background: '#dee2e8' }} />
          <Link href="/login" style={{ fontSize: '0.85rem', color: '#5a6a7e', textDecoration: 'none', fontWeight: 600 }}>
            Org Admin
          </Link>
          <span style={{ width: 4, height: 4, borderRadius: '50%', background: '#dee2e8' }} />
          <Link href="/clinic/login" style={{ fontSize: '0.85rem', color: '#5a6a7e', textDecoration: 'none', fontWeight: 600 }}>
            Staff Login
          </Link>
          <span style={{ width: 4, height: 4, borderRadius: '50%', background: '#dee2e8' }} />
          <Link href="/onboard" style={{ fontSize: '0.85rem', color: '#5a6a7e', textDecoration: 'none', fontWeight: 600 }}>
            Register Clinic
          </Link>
          <div style={{ flexBasis: '100%', height: 0 }}></div>
          <span style={{ color: '#94a3b8', fontSize: '0.8rem', display: 'flex', alignItems: 'center', gap: '0.4rem', marginTop: '0.5rem' }}>
            Powered by Q-PULSE Network
          </span>
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
                <div style={{ width: 44, height: 44, borderRadius: '50%', background: 'rgba(255,255,255,0.2)', display: 'flex', alignItems: 'center', justifyContent: 'center', overflow: 'hidden', position: 'relative' }}>
                  {bookingClinic.doctor_image_url
                    ? <Image src={bookingClinic.doctor_image_url} alt="" fill style={{ objectFit: 'cover' }} unoptimized />
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
              
              <div style={{ display: 'flex', gap: '0.5rem', marginBottom: '0.5rem' }}>
                <button type="button" onClick={() => setConsultationType('IN_PERSON')} className={`btn ${consultationType === 'IN_PERSON' ? 'btn-primary' : 'btn-outline'}`} style={{ flex: 1, padding: '0.75rem', fontSize: '0.85rem' }}>
                  🏥 Walk-in Visit
                </button>
                <button type="button" onClick={() => setConsultationType('VIDEO')} className={`btn ${consultationType === 'VIDEO' ? 'btn-primary' : 'btn-outline'}`} style={{ flex: 1, padding: '0.75rem', fontSize: '0.85rem' }}>
                  📹 Video Consult
                </button>
              </div>

              <input type="text" className="input-field" placeholder="Patient Full Name" value={patientName} onChange={e => setPatientName(e.target.value)} required disabled={isBooking} maxLength={50} />
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.8rem' }}>
                <input type="number" className="input-field" placeholder="Age" value={patientAge} onChange={e => setPatientAge(e.target.value)} disabled={isBooking} />
                <input type="text" className="input-field" placeholder="Medical Issue" value={disease} onChange={e => setDisease(e.target.value)} disabled={isBooking} required maxLength={150} />
              </div>
              <div style={{ background: '#f8fafc', padding: '0.9rem', borderRadius: 10, border: '1px solid #eef0f3', fontSize: '0.8rem', color: '#5a6a7e', textAlign: 'center' }}>
                You&apos;ll be assigned a live token. Pay ₹{bookingClinic.fees || '500'} at the clinic desk.
                <div style={{ fontSize: '0.72rem', color: '#007BFF', marginTop: '0.4rem', fontWeight: 600 }}>
                  🔔 SMS alert will be sent when your turn is near!
                </div>
              </div>

              <div style={{ padding: '0.75rem', border: '1px solid #eef0f3', borderRadius: 10, background: useInsurance ? '#f0f9ff' : 'transparent' }}>
                <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: '0.85rem', fontWeight: 600, color: '#1a2332', cursor: 'pointer' }}>
                  <input type="checkbox" checked={useInsurance} onChange={e => setUseInsurance(e.target.checked)} style={{ width: 16, height: 16 }} disabled={isBooking} />
                  Cashless / Insurance Pre-Authorization
                </label>
                {useInsurance && (
                  <div style={{ marginTop: '0.75rem', display: 'flex', flexDirection: 'column', gap: '0.75rem', animation: 'fadeIn 0.2s ease' }}>
                    <input type="text" className="input-field" placeholder="Insurance Provider (e.g. Star Health)" value={insuranceProvider} onChange={e => setInsuranceProvider(e.target.value)} required disabled={isBooking} maxLength={50} style={{ padding: '0.6rem' }} />
                    <input type="text" className="input-field" placeholder="Policy Number (Optional)" value={insurancePolicy} onChange={e => setInsurancePolicy(e.target.value)} disabled={isBooking} maxLength={50} style={{ padding: '0.6rem' }} />
                    <label style={{ fontSize: '0.75rem', color: '#5a6a7e', fontWeight: 600 }}>Upload ID Card Photo *</label>
                    <input type="file" accept="image/*" onChange={e => setInsuranceImage(e.target.files?.[0] || null)} required disabled={isBooking} style={{ fontSize: '0.8rem' }} />
                  </div>
                )}
              </div>
              {!bookingClinic.is_open ? (
                <div style={{ background: '#fef2f2', border: '1px solid #fecaca', padding: '1.5rem', borderRadius: '12px', textAlign: 'center', marginBottom: '1.5rem' }}>
                  <h4 style={{ color: '#dc2626', margin: '0 0 0.5rem 0', fontWeight: 700 }}>Booking Closed</h4>
                  <p style={{ color: '#b91c1c', fontSize: '0.9rem', margin: 0 }}>This clinic is not accepting new tokens right now. Please try again later.</p>
                </div>
              ) : (
                <button type="submit" disabled={isBooking} className="btn btn-primary" style={{ width: '100%', padding: '1rem', fontSize: '1rem', fontWeight: 700, borderRadius: 12 }}>
                  {isBooking ? <><Loader2 className="animate-spin" size={20} /> Booking...</> : <><Ticket size={20} /> Book Token</>}
                </button>
              )}
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
    </>
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

  let isBookingClosed = false;
  if (clinic.booking_end_time) {
    const [hr, min] = clinic.booking_end_time.split(':').map(Number);
    const now = new Date();
    if (now.getHours() > hr || (now.getHours() === hr && now.getMinutes() >= min)) {
      isBookingClosed = true;
    }
  }

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
            {clinic.booking_end_time && (
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.55rem', fontSize: '0.82rem', color: '#5a6a7e' }}>
                <Clock size={14} color="#dc3545" style={{ flexShrink: 0 }} /> Booking Cutoff: {clinic.booking_end_time}
              </div>
            )}
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.55rem', fontSize: '0.82rem', color: '#5a6a7e' }}>
              <IndianRupee size={14} color="#28a745" style={{ flexShrink: 0 }} /> ₹{fees} per consultation · Pay at desk
            </div>
          </div>
        )}

        {/* Book Button */}
        <button onClick={() => onBookClick(clinic)} disabled={!isOpen || isBookingClosed}
          className="btn btn-primary"
          style={{ width: '100%', padding: '0.85rem', fontSize: '0.95rem', fontWeight: 700, marginTop: '1rem', opacity: (!isOpen || isBookingClosed) ? 0.5 : 1, justifyContent: 'center' }}>
          {isOpen ? (isBookingClosed ? 'Booking Closed' : <><CalendarPlus size={17} /> Book Token Now</>) : 'Currently Closed'}
        </button>

        {/* QR code */}
        {showQR && (
          <div style={{ marginTop: '1.25rem', paddingTop: '1.25rem', borderTop: '1px solid #eef0f3', textAlign: 'center' }}>
            <p style={{ fontSize: '0.78rem', color: '#5a6a7e', marginBottom: '0.75rem', fontWeight: 500 }}>Scan to add this clinic to favourites on another device</p>
                  <div style={{ background: '#f8fafc', padding: '1rem', borderRadius: 12, border: '1px solid #eef0f3', display: 'flex', justifyContent: 'center' }}>
                    <DynamicQRCodeSVG value={patientUrl} size={150} level="M" />
                  </div>
          </div>
        )}
      </div>
    </div>
  );
});

function RecentVisitUploadPrompt({ visit, currentUser, onUploadSuccess }: { visit: any, currentUser: any, onUploadSuccess: () => void }) {
  const [file, setFile] = useState<File | null>(null);
  const [uploading, setUploading] = useState(false);
  const [dismissed, setDismissed] = useState(false);

  // Check if already uploaded or dismissed
  if (dismissed || visit.prescription_uploaded || visit.status !== 'COMPLETED') return null;

  // Only show if completed in the last 48 hours
  const completedDate = visit.completed_at?.toDate ? visit.completed_at.toDate() : (visit.created_at?.toDate ? visit.created_at.toDate() : new Date());
  const hoursSinceCompletion = (Date.now() - completedDate.getTime()) / 3600000;
  if (hoursSinceCompletion > 48) return null;

  const handleUpload = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!file || !currentUser) return;
    setUploading(true);
    try {
      const { uploadFileToStorage, addPatientPrescriptionDocument } = await import('@/lib/patientActions');
      const { doc, updateDoc } = await import('firebase/firestore');
      const { db } = await import('@/lib/firebase');

      // 1. Upload to storage
      const { downloadUrl, storagePath } = await uploadFileToStorage(
        currentUser.uid,
        file,
        'prescriptions'
      );

      // 2. Add prescription record
      await addPatientPrescriptionDocument(currentUser.uid, {
        fileUrl: downloadUrl,
        storagePath,
        fileName: file.name,
        fileSizeBytes: file.size,
        mimeType: file.type,
        clinicId: visit.clinic_id,
        doctorName: visit.doctor_name || '',
        notes: `Uploaded from home page for visit on ${completedDate.toLocaleDateString()}`
      });

      // 3. Mark appointment as prescription uploaded
      await updateDoc(doc(db, 'appointments', visit.id), {
        prescription_uploaded: true
      });

      alert('Prescription uploaded successfully!');
      onUploadSuccess();
    } catch (err) {
      console.error(err);
      alert('Failed to upload prescription.');
    } finally {
      setUploading(false);
    }
  };

  return (
    <div style={{
      background: 'rgba(0,123,255,0.06)',
      border: '1px solid rgba(0,123,255,0.18)',
      borderRadius: '16px',
      padding: '1.25rem 1.5rem',
      marginBottom: '2rem',
      position: 'relative',
      display: 'flex',
      flexDirection: 'column',
      gap: '0.75rem'
    }}>
      <button 
        onClick={() => setDismissed(true)} 
        style={{ position: 'absolute', top: '1rem', right: '1rem', background: 'none', border: 'none', cursor: 'pointer', color: '#5a6a7e' }}
      >
        <X size={16} />
      </button>
      <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
        <div style={{ padding: '0.4rem', background: 'rgba(0,123,255,0.1)', borderRadius: '8px' }}>
          <FilePlus size={18} color="#007BFF" />
        </div>
        <div>
          <h4 style={{ margin: 0, fontSize: '0.9rem', fontWeight: 700, color: '#1a2332' }}>Recent Visit Prescription</h4>
          <p style={{ margin: 0, fontSize: '0.78rem', color: '#5a6a7e' }}>
            Upload your prescription for your visit on {completedDate.toLocaleDateString()} to save it to your secure health history.
          </p>
        </div>
      </div>
      <form onSubmit={handleUpload} style={{ display: 'flex', alignItems: 'center', gap: '1rem', flexWrap: 'wrap', marginTop: '0.25rem' }}>
        <input 
          type="file" 
          required 
          accept="image/*,application/pdf"
          onChange={e => setFile(e.target.files?.[0] || null)}
          style={{ fontSize: '0.8rem' }}
          disabled={uploading}
        />
        <button 
          type="submit" 
          className="btn btn-primary" 
          style={{ padding: '0.45rem 1rem', fontSize: '0.8rem', minHeight: 'unset' }}
          disabled={uploading || !file}
        >
          {uploading ? <Loader2 size={14} className="animate-spin" /> : 'Upload'}
        </button>
      </form>
    </div>
  );
}
