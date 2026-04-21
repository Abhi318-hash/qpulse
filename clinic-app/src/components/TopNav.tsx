'use client';

import { useRouter, usePathname } from 'next/navigation';
import { ArrowLeft, ArrowRight, Activity, Sun, Moon, Info } from 'lucide-react';
import Link from 'next/link';
import { useEffect, useState } from 'react';

// Pages with their own built-in nav — TopNav hides here
const HIDDEN_ON: (string | RegExp)[] = ['/', /^\/clinic\/[^/]+$/];

export default function TopNav() {
  const router = useRouter();
  const pathname = usePathname();
  const [theme, setTheme] = useState('dark');
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
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
      {/* Back / Forward */}
      <div style={{ display: 'flex', gap: '0.5rem' }}>
        <button onClick={() => router.back()} style={{ background: 'var(--btn-glass)', border: '1px solid var(--glass-border)', color: 'var(--text-primary)', padding: '0.5rem', borderRadius: '8px', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', minWidth: 36, minHeight: 36 }}>
          <ArrowLeft size={18} />
        </button>
        <button onClick={() => router.forward()} style={{ background: 'var(--btn-glass)', border: '1px solid var(--glass-border)', color: 'var(--text-primary)', padding: '0.5rem', borderRadius: '8px', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', minWidth: 36, minHeight: 36 }}>
          <ArrowRight size={18} />
        </button>
      </div>

      {/* Centred logo */}
      <a href="/" style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', textDecoration: 'none', position: 'absolute', left: '50%', transform: 'translateX(-50%)' }}>
        <Activity size={20} color="var(--accent-primary)" />
        <span style={{ fontWeight: 800, fontSize: '1.1rem', color: 'var(--accent-primary)', letterSpacing: '1px' }}>Q-PULSE</span>
      </a>

      {/* Right tools */}
      <div style={{ display: 'flex', gap: '0.5rem' }}>
        <Link href="/about" title="About & Bug Reporting" style={{ background: 'var(--btn-glass)', border: '1px solid var(--glass-border)', color: 'var(--text-primary)', padding: '0.5rem', borderRadius: '8px', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', textDecoration: 'none', minWidth: 36, minHeight: 36 }}>
          <Info size={18} />
        </Link>
        <button onClick={toggleTheme} title="Toggle Theme" style={{ background: 'var(--btn-glass)', border: '1px solid var(--glass-border)', color: 'var(--text-primary)', padding: '0.5rem', borderRadius: '8px', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', minWidth: 36, minHeight: 36 }}>
          {theme === 'light' ? <Moon size={18} /> : <Sun size={18} />}
        </button>
      </div>
    </nav>
  );
}
