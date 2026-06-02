'use client';

import { useState, useEffect } from 'react';
import { Globe } from 'lucide-react';

const LANGUAGES = [
  { code: 'en', label: 'English' },
  { code: 'hi', label: 'Hindi' },
  { code: 'mr', label: 'Marathi' }
];

export default function LanguageSelector({ isMobile }: { isMobile?: boolean }) {
  const [currentLang, setCurrentLang] = useState('en');
  const [isOpen, setIsOpen] = useState(false);

  useEffect(() => {
    // Parse googtrans cookie to find current language
    const match = document.cookie.match(/(^|;) ?googtrans=([^;]*)(;|$)/);
    if (match) {
      const parts = match[2].split('/');
      if (parts.length === 3) {
        setCurrentLang(parts[2]);
      }
    }
  }, []);

  const changeLanguage = (lang: string) => {
    setCurrentLang(lang);
    setIsOpen(false);
    
    // Set googtrans cookie
    const domain = window.location.hostname;
    document.cookie = `googtrans=/en/${lang}; path=/; domain=${domain}`;
    document.cookie = `googtrans=/en/${lang}; path=/`; // some setups need this
    
    window.location.reload();
  };

  return (
    <div style={{ position: 'relative', display: 'inline-block' }}>
      <button 
        onClick={() => setIsOpen(!isOpen)}
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: '0.4rem',
          background: 'var(--btn-glass, rgba(255,255,255,0.05))',
          border: '1px solid var(--glass-border, rgba(255,255,255,0.1))',
          color: 'var(--text-primary, inherit)',
          padding: isMobile ? '0.5rem' : '0.45rem 0.8rem',
          borderRadius: '8px',
          cursor: 'pointer',
          fontFamily: 'inherit',
          fontSize: '0.8rem',
          fontWeight: 600,
          minWidth: 36,
          minHeight: 36
        }}
        title="Select Language"
      >
        <Globe size={16} />
        {!isMobile && LANGUAGES.find(l => l.code === currentLang)?.label}
      </button>

      {isOpen && (
        <div style={{
          position: 'absolute',
          top: '100%',
          right: 0,
          marginTop: '0.5rem',
          background: 'var(--card-bg, #1e1e1e)',
          border: '1px solid var(--glass-border, rgba(255,255,255,0.1))',
          borderRadius: '8px',
          boxShadow: '0 4px 12px rgba(0,0,0,0.2)',
          zIndex: 100,
          minWidth: '120px',
          overflow: 'hidden'
        }}>
          {LANGUAGES.map(lang => (
            <button
              key={lang.code}
              onClick={() => changeLanguage(lang.code)}
              style={{
                display: 'block',
                width: '100%',
                padding: '0.6rem 1rem',
                textAlign: 'left',
                background: currentLang === lang.code ? 'rgba(0,123,255,0.1)' : 'transparent',
                border: 'none',
                color: currentLang === lang.code ? '#007BFF' : 'var(--text-primary, #fff)',
                fontFamily: 'inherit',
                fontSize: '0.9rem',
                cursor: 'pointer'
              }}
            >
              {lang.label}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
