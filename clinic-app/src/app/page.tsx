'use client'

import { subscribeToActiveClinics, subscribeToUserActiveTokens, addPatientToken, cancelUserToken, getUserMedicalHistory } from '@/lib/actions';
import { auth } from '@/lib/firebase';
import { onAuthStateChanged, signOut } from 'firebase/auth';
import Link from 'next/link';
import { useState, useEffect, Suspense, useRef } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import { Users, LayoutDashboard, Settings, Activity, Zap, Hospital, MapPin, Search as SearchIcon, Stethoscope, Star, Heart, QrCode, LogOut, Ticket, Loader2, CalendarPlus, X, History } from 'lucide-react';
import { QRCodeSVG } from 'qrcode.react';

export default function Home() {
  return (
    <Suspense fallback={<div className="container fade-in" style={{ textAlign: 'center', paddingTop: '50px' }}><Loader2 className="animate-spin" /></div>}>
      <HomeContent />
    </Suspense>
  );
}

// Need to shift Home() to the bottom, I am patching HomeContent directly
function HomeContent() {
  const [clinics, setClinics] = useState<any[]>([]);
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);
  const [favorites, setFavorites] = useState<string[]>([]);
  
  // User Auth & Tokens
  const [currentUser, setCurrentUser] = useState<any>(null);
  const [myTokens, setMyTokens] = useState<any[]>([]);
  const [myHistory, setMyHistory] = useState<any[]>([]);
  const [showHistory, setShowHistory] = useState(false);
  
  // Booking Modal
  const [bookingClinic, setBookingClinic] = useState<any | null>(null);
  const [patientName, setPatientName] = useState('');
  const [patientAge, setPatientAge] = useState('');
  const [disease, setDisease] = useState('');
  const [isBooking, setIsBooking] = useState(false);

  // Use a Ref to store previous clinics data purely for Notification tracking
  // without clogging the React render cycle or causing Infinite Loops
  const clinicsRef = useRef<any[]>([]);

  const myTokensRef = useRef<any[]>([]);

  const searchParams = useSearchParams();
  const router = useRouter();

  useEffect(() => {
    // Load favorites from localStorage
    const saved = localStorage.getItem('qpulse_favorites');
    if (saved) {
      try {
        setFavorites(JSON.parse(saved));
      } catch (e) {
        console.error("Failed to parse favorites", e);
      }
    }

    let unsubscribeTokens: () => void;

    // Realtime Auth state
    const unsubscribeAuth = onAuthStateChanged(auth, (user) => {
      setCurrentUser(user);
      
      // If user is logged in, subscribe to their personal active tokens
      if (user && user.phoneNumber) {
        unsubscribeTokens = subscribeToUserActiveTokens(user.phoneNumber, (tokens) => {
           setMyTokens(tokens);
           myTokensRef.current = tokens;
        });

        // Fetch their past history
        getUserMedicalHistory(user.phoneNumber).then(history => {
          setMyHistory(history);
        });
      } else {
        setMyTokens([]);
        myTokensRef.current = [];
        setMyHistory([]);
      }
    });

    return () => {
      unsubscribeAuth();
      if (unsubscribeTokens) unsubscribeTokens();
    };
  }, []);

  useEffect(() => {
    // Subscribe to real-time clinics
    const unsubscribeClinics = subscribeToActiveClinics((data) => {
      // 1. Process local notifications (Side Effect, keep out of setState)
      data.forEach(newClinic => {
        const oldClinic = clinicsRef.current.find(c => c.id === newClinic.id);
        if (oldClinic && oldClinic.currently_serving_token !== newClinic.currently_serving_token) {
          // Find if user has token
          const matchingToken = myTokensRef.current.find(t => t.clinic_id === newClinic.id);
          if (matchingToken && newClinic.currently_serving_token !== '--') {
            const servingNum = Number(newClinic.currently_serving_token);
            const userNextTokenNum = Number(matchingToken.token_number);
            
            if (!isNaN(servingNum) && !isNaN(userNextTokenNum)) {
              if (servingNum === userNextTokenNum) {
                triggerNotification('🚨 Turn Alert!', `Your token #${userNextTokenNum} is now being called! Please approach the desk.`);
              } else if (userNextTokenNum - servingNum === 2) {
                triggerNotification('⚠️ Be Ready', `Token #${servingNum} is currently serving. You are next in line!`);
              }
            }
          }
        }
      });

      // 2. Update Ref for next snapshot comparison
      clinicsRef.current = data;

      // 3. Update Pure State
      setClinics(data);
      setLoading(false);
    });

    return () => {
      unsubscribeClinics();
    };
  }, []); // Run only once on mount

  const triggerNotification = (title: string, body: string) => {
    if (!('Notification' in window)) return;
    if (Notification.permission === 'granted') {
      new Notification(title, { body, icon: '/favicon.ico' });
    }
  };

  // Handle addFavorite from QR scan
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

  const toggleFavorite = (id: string, e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    let newFavs;
    if (favorites.includes(id)) {
      newFavs = favorites.filter(favId => favId !== id);
    } else {
      newFavs = [...favorites, id];
    }
    setFavorites(newFavs);
    localStorage.setItem('qpulse_favorites', JSON.stringify(newFavs));
  };

  const handleBookClick = (clinic: any) => {
    if (!currentUser) {
      router.push('/login');
      return;
    }
    // Check if they already have a token for this clinic
    const existing = myTokens.find(t => t.clinic_id === clinic.id);
    if (existing) {
      alert(`You already have active Token #${existing.token_number} at this clinic!`);
      return;
    }
    setBookingClinic(clinic);
  };

  const submitBooking = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!bookingClinic || !patientName || !currentUser?.phoneNumber) return;
    
    // Request Push Notification permissions immediately so we can send background alerts!
    if ('Notification' in window && Notification.permission !== 'granted' && Notification.permission !== 'denied') {
      try {
        await Notification.requestPermission();
      } catch (err) {
        console.log("Notification permission error", err);
      }
    }
    
    setIsBooking(true);
    try {
      await addPatientToken(
        bookingClinic.id,
        patientName,
        parseInt(patientAge) || 0,
        0, // Public users pay at the clinic
        disease || 'General',
        currentUser.phoneNumber
      );
      setBookingClinic(null);
      setPatientName('');
      setPatientAge('');
      setDisease('');
    } catch (err) {
      console.error(err);
      alert('Booking failed. Please try again.');
    } finally {
      setIsBooking(false);
    }
  };

  const handleCancelToken = async (clinicId: string, tokenId: string) => {
    if (confirm('Are you sure you want to cancel this token?')) {
      await cancelUserToken(clinicId, tokenId);
    }
  };

  const filteredClinics = clinics.filter(c => 
    c.name?.toLowerCase().includes(search.toLowerCase()) ||
    c.doctor_name?.toLowerCase().includes(search.toLowerCase()) ||
    c.location?.toLowerCase().includes(search.toLowerCase())
  );

  const favoriteClinics = clinics.filter(c => favorites.includes(c.id));
  const otherClinics = filteredClinics.filter(c => !favorites.includes(c.id));

  return (
    <main className="container fade-in">
      <header className="header" style={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
        
        {/* Top Bar Auth Status */}
        <div style={{ width: '100%', display: 'flex', justifyContent: 'flex-end', marginBottom: '2rem' }}>
          {currentUser ? (
            <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
              <button onClick={() => setShowHistory(true)} className="btn" style={{ padding: '0.4rem 0.8rem', fontSize: '0.75rem', background: 'rgba(0, 210, 255, 0.1)', color: 'var(--accent-primary)', border: '1px solid rgba(0,210,255,0.2)' }}>
                <History size={12} /> Medical History
              </button>
              <span style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', marginLeft: '1rem' }}>
                {currentUser.phoneNumber}
              </span>
              <button onClick={() => signOut(auth)} className="btn btn-outline" style={{ padding: '0.4rem 0.8rem', fontSize: '0.75rem' }}>
                <LogOut size={12} /> Log Out
              </button>
            </div>
          ) : (
            <button onClick={() => router.push('/login')} className="btn btn-outline" style={{ padding: '0.5rem 1rem', fontSize: '0.85rem' }}>
              <Users size={14} /> Log In to Book
            </button>
          )}
        </div>

        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '1rem', marginBottom: '0.5rem' }}>
          <Activity size={48} className="pulse-primary" style={{ color: 'var(--accent-primary)' }} />
          <h1 style={{ fontSize: '4.5rem', fontWeight: '900', margin: 0, background: 'linear-gradient(to right, #00d2ff, #3a7bd5, #ffffff)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent', letterSpacing: '-2px' }}>
            Q-PULSE
          </h1>
        </div>
        <p style={{ color: 'var(--text-secondary)', fontSize: '1.4rem', fontWeight: '300', letterSpacing: '1px' }}>
          "Skip the wait, stay in the pulse"
        </p>

        <div style={{ marginTop: '3rem', width: '100%', maxWidth: '600px', position: 'relative' }}>
          <SearchIcon style={{ position: 'absolute', left: '1rem', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-secondary)' }} size={20} />
          <input 
            type="text"
            className="input-field"
            placeholder="Search by Clinic, Doctor, or Location..."
            style={{ paddingLeft: '3rem' }}
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
      </header>

      {/* User's Active Tokens Section */}
      {myTokens.length > 0 && (
        <section style={{ marginBottom: '3rem' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '1.5rem' }}>
            <Ticket size={20} color="var(--accent-primary)" />
            <h2 style={{ fontSize: '1.2rem', fontWeight: '700', textTransform: 'uppercase', letterSpacing: '2px', color: 'var(--text-primary)' }}>Your Active Tokens</h2>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: '1.5rem' }}>
            {myTokens.map(token => {
              const matchedClinic = clinics.find(c => c.id === token.clinic_id);
              return (
                <div key={token.id} className="glass-card" style={{ border: '1px solid var(--accent-primary)', position: 'relative', overflow: 'hidden' }}>
                  <div style={{ position: 'absolute', top: 0, right: 0, background: 'var(--accent-primary)', color: '#000', fontWeight: 'bold', padding: '0.25rem 1rem', borderBottomLeftRadius: '12px', fontSize: '0.8rem' }}>
                    LIVE
                  </div>
                  <h3 style={{ margin: '0 0 0.5rem 0' }}>{matchedClinic?.name || 'Clinic'}</h3>
                  <p style={{ margin: '0 0 1rem 0', color: 'var(--text-secondary)', fontSize: '0.85rem' }}>Patient: {token.patient_name}</p>
                  
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: 'rgba(0,0,0,0.2)', padding: '1rem', borderRadius: '8px' }}>
                    <div style={{ textAlign: 'center' }}>
                      <span style={{ display: 'block', fontSize: '0.7rem', color: 'var(--text-secondary)', textTransform: 'uppercase' }}>Your Token</span>
                      <strong style={{ fontSize: '1.8rem', color: 'var(--text-primary)' }}>#{token.token_number}</strong>
                    </div>
                    <div style={{ width: '1px', height: '40px', background: 'var(--glass-border)' }}></div>
                    <div style={{ textAlign: 'center' }}>
                      <span style={{ display: 'block', fontSize: '0.7rem', color: 'var(--text-secondary)', textTransform: 'uppercase' }}>Now Serving</span>
                      <strong style={{ fontSize: '1.8rem', color: 'var(--success)' }}>#{matchedClinic?.currently_serving_token || '--'}</strong>
                    </div>
                  </div>

                  <button 
                    onClick={() => handleCancelToken(token.clinic_id, token.id)}
                    className="btn btn-outline" 
                    style={{ width: '100%', marginTop: '1rem', padding: '0.6rem', fontSize: '0.8rem', borderColor: 'rgba(255,77,77,0.3)', color: 'var(--danger)' }}
                  >
                    Cancel Appointment
                  </button>
                </div>
              );
            })}
          </div>
          <div style={{ margin: '2.5rem 0', height: '1px', background: 'linear-gradient(90deg, transparent, var(--glass-border), transparent)' }}></div>
        </section>
      )}

      {/* Favorites Section */}
      {favorites.length > 0 && !search && (
        <section style={{ marginBottom: '3rem' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '1.5rem' }}>
            <Heart size={20} fill="var(--accent-primary)" color="var(--accent-primary)" />
            <h2 style={{ fontSize: '1.2rem', fontWeight: '700', textTransform: 'uppercase', letterSpacing: '2px', color: 'var(--text-primary)' }}>Your Favorites</h2>
          </div>
          <div className="grid-clinics">
            {favoriteClinics.map(clinic => (
              <ClinicCard key={clinic.id} clinic={clinic} isFavorite={true} onFavoriteToggle={toggleFavorite} onBookClick={() => handleBookClick(clinic)} />
            ))}
          </div>
          <div style={{ margin: '2.5rem 0', height: '1px', background: 'linear-gradient(90deg, transparent, var(--glass-border), transparent)' }}></div>
        </section>
      )}

      {/* Main Clinic List */}
      <div className="grid-clinics">
        {loading ? (
          <div className="glass-card" style={{ gridColumn: '1 / -1', textAlign: 'center', padding: '4rem' }}>
            <Loader2 size={40} className="animate-spin" style={{ color: 'var(--accent-primary)', margin: '0 auto 1rem' }} />
            <p style={{ color: 'var(--text-secondary)' }}>Tuning into the pulse securely...</p>
          </div>
        ) : otherClinics.length === 0 && favoriteClinics.length === 0 ? (
          <div className="glass-card" style={{ gridColumn: '1 / -1', textAlign: 'center' }}>
            <p style={{ color: 'var(--text-secondary)' }}>No clinics match your search pulse.</p>
          </div>
        ) : (
          otherClinics.map((clinic) => (
            <ClinicCard key={clinic.id} clinic={clinic} isFavorite={favorites.includes(clinic.id)} onFavoriteToggle={toggleFavorite} onBookClick={() => handleBookClick(clinic)} />
          ))
        )}
      </div>

      <footer style={{ marginTop: '5rem', borderTop: '1px solid var(--glass-border)', padding: '2rem 0', display: 'flex', justifyContent: 'center', gap: '2rem' }}>
        <Link href="/admin/login" className="btn btn-outline" style={{ fontSize: '0.9rem' }}>
          <Settings size={16} /> Admin Portal
        </Link>
        <Link href="/clinic/login" className="btn btn-outline" style={{ fontSize: '0.9rem' }}>
          <Hospital size={16} /> Staff Portal
        </Link>
        <span style={{ color: 'var(--text-secondary)', fontSize: '0.9rem', display: 'flex', alignItems: 'center' }}>
          | Powered by Q-PULSE Network
        </span>
      </footer>

      {/* Booking Modal */}
      {bookingClinic && (
        <div style={{
          position: 'fixed', top: 0, left: 0, width: '100%', height: '100%',
          background: 'rgba(0,0,0,0.85)', backdropFilter: 'blur(10px)',
          zIndex: 9999, display: 'flex', justifyContent: 'center', alignItems: 'center', padding: '1rem'
        }}>
          <div className="glass-card fade-in" style={{ width: '100%', maxWidth: '500px', display: 'flex', flexDirection: 'column', padding: 0, overflow: 'hidden' }}>
            
            <div style={{ padding: '1.5rem', borderBottom: '1px solid var(--glass-border)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <h2 style={{ margin: 0, fontSize: '1.2rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <CalendarPlus size={20} color="var(--accent-primary)" /> Book Token
              </h2>
              <button onClick={() => setBookingClinic(null)} className="btn btn-outline" style={{ padding: '0.5rem', minWidth: 'auto', border: 'none', color: 'var(--text-secondary)' }}>
                <X size={24} />
              </button>
            </div>

            <div style={{ padding: '1.5rem', display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
              <div>
                <p style={{ margin: '0 0 0.5rem 0', color: 'var(--text-secondary)', fontSize: '0.85rem' }}>Booking appointment at:</p>
                <h3 style={{ margin: 0, fontSize: '1.4rem', color: 'var(--accent-primary)' }}>{bookingClinic.name}</h3>
                <p style={{ margin: '0.2rem 0 0 0', color: 'var(--text-secondary)', fontSize: '0.85rem' }}>Doctor: {bookingClinic.doctor_name}</p>
              </div>

              <form onSubmit={submitBooking} style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                <input 
                  type="text" 
                  className="input-field" 
                  placeholder="Patient Full Name" 
                  value={patientName} 
                  onChange={e => setPatientName(e.target.value)} 
                  required 
                  disabled={isBooking}
                />
                <input 
                  type="number" 
                  className="input-field" 
                  placeholder="Age" 
                  value={patientAge} 
                  onChange={e => setPatientAge(e.target.value)} 
                  disabled={isBooking}
                />
                <input 
                  type="text" 
                  className="input-field" 
                  placeholder="Brief Medical Issue (e.g. Fever, Checkup)" 
                  value={disease} 
                  onChange={e => setDisease(e.target.value)} 
                  disabled={isBooking}
                  required
                />
                
                <div style={{ background: 'rgba(0, 210, 255, 0.05)', padding: '1rem', borderRadius: '8px', border: '1px solid rgba(0, 210, 255, 0.1)', marginTop: '0.5rem' }}>
                  <p style={{ margin: 0, fontSize: '0.8rem', color: 'var(--text-secondary)', textAlign: 'center' }}>
                    By confirming, you will be assigned a live Token Number. You pay consultation fees at the clinic desk.
                  </p>
                </div>

                <button type="submit" className="btn btn-primary" style={{ padding: '1rem', fontSize: '1.1rem' }} disabled={isBooking || !patientName}>
                  {isBooking ? <Loader2 size={24} className="animate-spin" /> : 'Confirm & Generate Token'}
                </button>
              </form>
            </div>
          </div>
        </div>
      )}

      {/* User Medical History Modal */}
      {showHistory && (
        <div style={{
          position: 'fixed', top: 0, left: 0, width: '100%', height: '100%',
          background: 'rgba(0,0,0,0.85)', backdropFilter: 'blur(10px)',
          zIndex: 9999, display: 'flex', justifyContent: 'center', alignItems: 'center', padding: '1rem'
        }}>
          <div className="glass-card fade-in" style={{ width: '100%', maxWidth: '800px', maxHeight: '90vh', display: 'flex', flexDirection: 'column', padding: 0, overflow: 'hidden' }}>
            
            {/* Modal Header */}
            <div style={{ padding: '1.5rem', borderBottom: '1px solid var(--glass-border)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <h2 style={{ margin: 0, fontSize: '1.2rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <History size={20} color="var(--accent-primary)" /> Your Medical Portfolio
              </h2>
              <button onClick={() => setShowHistory(false)} className="btn btn-outline" style={{ padding: '0.5rem', minWidth: 'auto', border: 'none', color: 'var(--text-secondary)' }}>
                <X size={24} />
              </button>
            </div>

            {/* Modal Body */}
            <div style={{ padding: '1.5rem', flex: 1, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '1rem' }}>
              {myHistory.length === 0 ? (
                <div style={{ textAlign: 'center', padding: '3rem', color: 'var(--text-secondary)' }}>
                  You have no completed appointments.
                </div>
              ) : (
                myHistory.map(record => {
                  const dateObj = record.created_at?.toDate ? record.created_at.toDate() : new Date();
                  const matchedClinic = clinics.find(c => c.id === record.clinic_id);
                  return (
                    <div key={record.id} style={{ 
                      display: 'grid', 
                      gridTemplateColumns: 'minmax(200px, 1fr) auto auto', 
                      gap: '2rem', 
                      padding: '1.5rem', 
                      background: 'rgba(255,255,255,0.03)', 
                      borderRadius: '12px', 
                      border: '1px solid var(--glass-border)',
                      alignItems: 'center'
                    }}>
                      <div>
                        <h4 style={{ margin: '0 0 0.5rem 0', color: 'var(--text-primary)', fontSize: '1.1rem' }}>{matchedClinic?.name || 'Clinic'}</h4>
                        <p style={{ margin: 0, fontSize: '0.85rem', color: 'var(--text-secondary)' }}>{record.patient_name} ({record.age}yrs) · {record.disease}</p>
                      </div>
                      <div style={{ textAlign: 'center', background: 'rgba(0, 210, 255, 0.05)', padding: '0.5rem 1rem', borderRadius: '8px', border: '1px solid rgba(0, 210, 255, 0.1)' }}>
                         <span style={{ color: 'var(--accent-primary)', display: 'block', fontSize: '0.7rem', textTransform: 'uppercase', fontWeight: 700 }}>Fees Paid</span>
                         <span style={{ fontSize: '1.3rem', fontWeight: 800 }}>₹{record.fees || '0'}</span>
                      </div>
                      <div style={{ textAlign: 'right', color: 'var(--text-secondary)' }}>
                         <p style={{ margin: '0 0 0.2rem 0', fontSize: '0.9rem' }}>{dateObj.toLocaleDateString()}</p>
                         <p style={{ margin: 0, fontSize: '0.8rem' }}>{dateObj.toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}</p>
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </div>
        </div>
      )}
    </main>
  );
}

function ClinicCard({ clinic, isFavorite, onFavoriteToggle, onBookClick }: any) {
  const [showQR, setShowQR] = useState(false);
  const patientUrl = typeof window !== 'undefined' ? `${window.location.origin}/?addFavorite=${clinic.id}` : '';

  return (
    <div className="glass-card" style={{ overflow: 'hidden', borderTop: `4px solid ${clinic.is_open ? 'var(--accent-primary)' : 'var(--danger)'}`, position: 'relative' }}>
      <button 
        onClick={(e) => onFavoriteToggle(clinic.id, e)}
        style={{ position: 'absolute', top: '1rem', right: '3.5rem', background: 'none', border: 'none', cursor: 'pointer', zIndex: 10, padding: '0.5rem' }}
        title={isFavorite ? "Remove from favorites" : "Add to favorites"}
      >
        <Star size={20} fill={isFavorite ? "var(--accent-primary)" : "none"} color={isFavorite ? "var(--accent-primary)" : "var(--text-secondary)"} style={{ transition: 'all 0.2s' }} />
      </button>

      <button 
        onClick={(e) => { e.preventDefault(); e.stopPropagation(); setShowQR(!showQR); }}
        style={{ position: 'absolute', top: '1rem', right: '1rem', background: 'none', border: 'none', cursor: 'pointer', zIndex: 10, padding: '0.5rem' }}
        title="Show QR Code"
      >
        <QrCode size={20} color={showQR ? "var(--accent-primary)" : "var(--text-secondary)"} style={{ transition: 'all 0.2s' }} />
      </button>

      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '1.5rem' }}>
        <div style={{ display: 'flex', gap: '0.8rem', alignItems: 'center' }}>
          <div style={{ background: 'rgba(0, 210, 255, 0.1)', padding: '0.5rem', borderRadius: '8px' }}>
            <Hospital size={20} color="var(--accent-primary)" />
          </div>
          <div>
            <h2 style={{ fontSize: '1.4rem', fontWeight: '600', margin: 0 }}>{clinic.name}</h2>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', fontSize: '0.85rem', color: 'var(--text-secondary)', marginTop: '0.2rem' }}>
              <MapPin size={12} /> {clinic.location}
            </div>
          </div>
        </div>
        <div className={`badge ${clinic.is_open ? 'badge-live' : ''}`} style={!clinic.is_open ? { background: 'rgba(255, 77, 77, 0.1)', color: 'var(--danger)', border: '1px solid rgba(255, 77, 77, 0.2)' } : {}}>
          {clinic.is_open ? 'Live' : 'Closed'}
        </div>
      </div>

      <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem', marginBottom: '1.5rem', padding: '0.8rem', background: 'rgba(255,255,255,0.02)', borderRadius: '12px' }}>
        <Stethoscope size={16} color="var(--accent-secondary)" />
        <span style={{ fontSize: '0.9rem', color: 'var(--text-secondary)' }}>Primary: {clinic.doctor_name}</span>
      </div>
      
      <div style={{ display: 'flex', justifyContent: 'space-around', alignItems: 'center', padding: '1.5rem 0', background: 'rgba(0,0,0,0.2)', borderRadius: '12px', marginBottom: '1.5rem' }}>
        <div style={{ textAlign: 'center' }}>
          <span style={{ display: 'block', fontSize: '0.7rem', color: 'var(--text-secondary)', textTransform: 'uppercase', marginBottom: '0.4rem' }}>Now Serving</span>
          <strong style={{ fontSize: '2.5rem', color: clinic.is_open ? 'var(--success)' : 'var(--text-secondary)' }}>
             {clinic.is_open ? (clinic.currently_serving_token || '--') : '--'}
          </strong>
        </div>
        <div style={{ width: '1px', height: '60px', background: 'var(--glass-border)' }}></div>
        <div style={{ textAlign: 'center' }}>
          <span style={{ display: 'block', fontSize: '0.7rem', color: 'var(--text-secondary)', textTransform: 'uppercase', marginBottom: '0.4rem' }}>Waiting</span>
          <strong style={{ fontSize: '2.5rem', color: clinic.is_open ? 'var(--accent-primary)' : 'var(--text-secondary)', textShadow: clinic.is_open ? '0 0 20px rgba(0, 210, 255, 0.3)' : 'none' }}>
             {clinic.is_open ? clinic.patient_count : '--'}
          </strong>
        </div>
      </div>

      <button 
        onClick={onBookClick}
        disabled={!clinic.is_open}
        className="btn btn-primary" 
        style={{ width: '100%', display: 'flex', justifyContent: 'center', alignItems: 'center', gap: '0.5rem', opacity: clinic.is_open ? 1 : 0.5 }}
      >
        <CalendarPlus size={18} /> {clinic.is_open ? 'Book Appointment' : 'Currently Closed'}
      </button>

      {showQR && (
        <div style={{ marginTop: '1.5rem', paddingTop: '1.5rem', borderTop: '1px solid var(--glass-border)', textAlign: 'center', animation: 'slideDown 0.3s ease-out' }}>
          <p style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', marginBottom: '1rem' }}>Scan this QR on another phone to add it to favorites!</p>
          <div style={{ background: 'white', padding: '1rem', borderRadius: '12px', display: 'inline-block' }}>
            <QRCodeSVG value={patientUrl} size={150} />
          </div>
        </div>
      )}
    </div>
  );
}


