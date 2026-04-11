'use client';

import { useRouter } from 'next/navigation';
import { ArrowLeft, ArrowRight, Activity, Sun, Moon, Info } from 'lucide-react';
import Link from 'next/link';
import { useEffect, useState } from 'react';

export default function TopNav() {
  const router = useRouter();
  const [theme, setTheme] = useState('dark');

  useEffect(() => {
    const savedTheme = localStorage.getItem('qpulse_theme');
    if (savedTheme === 'light') {
      setTheme('light');
      document.documentElement.setAttribute('data-theme', 'light');
    }
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

  return (
    <nav style={{ 
      padding: '1rem', 
      display: 'flex', 
      justifyContent: 'space-between', 
      alignItems: 'center', 
      background: 'var(--nav-bg)', 
      backdropFilter: 'blur(12px)', 
      borderBottom: '1px solid var(--glass-border)', 
      position: 'sticky', 
      top: 0, 
      zIndex: 50 
    }}>
      {/* Back and Forward Buttons */}
      <div style={{ display: 'flex', gap: '0.5rem' }}>
        <button onClick={() => router.back()} style={{ background: 'var(--btn-glass)', border: '1px solid var(--glass-border)', color: 'var(--text-primary)', padding: '0.5rem', borderRadius: '8px', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', transition: 'all 0.2s' }}>
          <ArrowLeft size={18} />
        </button>
        <button onClick={() => router.forward()} style={{ background: 'var(--btn-glass)', border: '1px solid var(--glass-border)', color: 'var(--text-primary)', padding: '0.5rem', borderRadius: '8px', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', transition: 'all 0.2s' }}>
          <ArrowRight size={18} />
        </button>
      </div>

      {/* Centered Logo returning to External Landing Page */}
      <a href="https://qpluse.vercel.app" style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', textDecoration: 'none', position: 'absolute', left: '50%', transform: 'translateX(-50%)' }}>
        <Activity size={20} color="var(--accent-primary)" />
        <span style={{ fontWeight: 800, fontSize: '1.2rem', color: 'var(--accent-primary)', letterSpacing: '1px' }}>Q-PULSE</span>
      </a>
      
      {/* Right Side Tools */}
      <div style={{ display: 'flex', gap: '0.5rem' }}>
         <Link href="/about" title="About & Bug Reporting" style={{ background: 'var(--btn-glass)', border: '1px solid var(--glass-border)', color: 'var(--text-primary)', padding: '0.5rem', borderRadius: '8px', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', transition: 'all 0.2s', textDecoration: 'none' }}>
            <Info size={18} />
         </Link>
         <button onClick={toggleTheme} title="Toggle Theme" style={{ background: 'var(--btn-glass)', border: '1px solid var(--glass-border)', color: 'var(--text-primary)', padding: '0.5rem', borderRadius: '8px', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', transition: 'all 0.2s' }}>
            {theme === 'light' ? <Moon size={18} /> : <Sun size={18} />}
         </button>
      </div>
    </nav>
  );
}
