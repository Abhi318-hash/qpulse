'use client';

import { useRouter, usePathname } from 'next/navigation';
import { Activity, Sun, Moon, Info, User, LogOut } from 'lucide-react';
import Link from 'next/link';
import { useEffect, useState } from 'react';
import LanguageSelector from './LanguageSelector';
import { auth } from '@/lib/firebase';
import { onAuthStateChanged, signOut } from 'firebase/auth';

// Pages with their own built-in nav — TopNav hides here
const HIDDEN_ON: (string | RegExp)[] = ['/', /^\/clinic\/[^/]+$/];

export default function TopNav() {
  const router = useRouter();
  const pathname = usePathname();
  const [theme, setTheme] = useState('dark');
  const [mounted, setMounted] = useState(false);
  const [showDropdown, setShowDropdown] = useState(false);
  const [currentUser, setCurrentUser] = useState<any>(null);

  useEffect(() => {
    setMounted(true);
    const savedTheme = localStorage.getItem('qpulse_theme');
    if (savedTheme === 'light') {
      setTheme('light');
      document.documentElement.setAttribute('data-theme', 'light');
    }
    const unsubscribe = onAuthStateChanged(auth, user => {
      setCurrentUser(user);
    });
    return () => unsubscribe();
  }, []);

  const toggleTheme = () => {
    const newTheme = theme === 'light' ? 'dark' : 'light';
    setTheme(newTheme);
    if (newTheme === 'light') {
      document.documentElement.setAttribute('data-theme', 'light');
    } else {
      document.documentElement.removeAttribute('data-theme');
    }
    localStorage.setItem('qpulse_theme', newTheme);
  };

  // Hide on pages that have their own built-in navigation
  const isHidden = HIDDEN_ON.some(rule =>
    typeof rule === 'string' ? pathname === rule : rule.test(pathname)
  );

  if (!mounted || isHidden) return null;

  return (
    <nav style={{
      padding: '0 1rem',
      height: 56,
      display: 'flex',
      justifyContent: 'space-between',
      alignItems: 'center',
      background: 'var(--nav-bg)',
      backdropFilter: 'blur(12px)',
      WebkitBackdropFilter: 'blur(12px)',
      borderBottom: '1px solid var(--glass-border)',
      position: 'sticky',
      top: 0,
      zIndex: 50
    }}>
      {/* Back / Forward removed as per design */}
      <div style={{ flex: 1 }}></div>

      {/* Centred logo */}
      <a href="/" style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', textDecoration: 'none', position: 'absolute', left: '50%', transform: 'translateX(-50%)' }}>
        <Activity size={20} color="var(--accent-primary)" />
        <span style={{ fontWeight: 800, fontSize: '1.1rem', color: 'var(--accent-primary)', letterSpacing: '1px' }}>Q-PULSE</span>
      </a>

      {/* Right tools - Unified Dropdown */}
      <div style={{ flex: 1, display: 'flex', justifyContent: 'flex-end', alignItems: 'center', position: 'relative' }}>
        <button 
          onClick={() => setShowDropdown(!showDropdown)}
          style={{ background: 'var(--btn-glass)', border: '1px solid var(--glass-border)', color: 'var(--text-primary)', padding: '0.5rem', borderRadius: '50%', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', minWidth: 36, minHeight: 36 }}
        >
          <User size={18} />
        </button>

        {showDropdown && (
          <div style={{
            position: 'absolute', top: '100%', right: 0, marginTop: '0.5rem',
            background: 'var(--card-bg, #1e1e1e)', border: '1px solid var(--glass-border, rgba(255,255,255,0.1))',
            borderRadius: '8px', boxShadow: '0 4px 12px rgba(0,0,0,0.2)',
            zIndex: 100, minWidth: '200px', overflow: 'hidden', display: 'flex', flexDirection: 'column'
          }}>
            <div style={{ padding: '0.75rem', borderBottom: '1px solid var(--glass-border)' }}>
              <span style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>Settings & Options</span>
            </div>
            
            <div style={{ padding: '0.5rem' }}>
              <LanguageSelector isMobile={false} isDark={theme === 'dark'} />
            </div>

            <button onClick={toggleTheme} style={{
              display: 'flex', alignItems: 'center', gap: '0.75rem', width: '100%', padding: '0.75rem 1rem',
              background: 'none', border: 'none', color: 'var(--text-primary)', cursor: 'pointer',
              textAlign: 'left', fontSize: '0.9rem'
            }}>
              {theme === 'light' ? <Moon size={16} /> : <Sun size={16} />}
              {theme === 'light' ? 'Dark Mode' : 'Light Mode'}
            </button>

            <Link href="/about" onClick={() => setShowDropdown(false)} style={{
              display: 'flex', alignItems: 'center', gap: '0.75rem', width: '100%', padding: '0.75rem 1rem',
              color: 'var(--text-primary)', textDecoration: 'none', fontSize: '0.9rem'
            }}>
              <Info size={16} /> About Q-PULSE
            </Link>
            
            {currentUser && (
              <button onClick={() => { signOut(auth); setShowDropdown(false); router.push('/'); }} style={{
                display: 'flex', alignItems: 'center', gap: '0.75rem', width: '100%', padding: '0.75rem 1rem',
                background: 'none', border: 'none', color: 'var(--danger)', cursor: 'pointer',
                textAlign: 'left', fontSize: '0.9rem', borderTop: '1px solid var(--glass-border)'
              }}>
                <LogOut size={16} /> Logout
              </button>
            )}
          </div>
        )}
      </div>
    </nav>
  );
}
