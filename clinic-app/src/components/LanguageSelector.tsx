'use client';

import { useState, useEffect } from 'react';
import { Globe } from 'lucide-react';

const LANGUAGES = [
  { code: 'en', label: 'English' },
  { code: 'hi', label: 'Hindi' },
  { code: 'mr', label: 'Marathi' }
];

export default function LanguageSelector({ isMobile, isDark }: { isMobile?: boolean, isDark?: boolean }) {
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

  const bg = isDark ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.04)';
  const border = isDark ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.1)';
  const text = isDark ? '#e2e8f0' : '#1a2332';
  const cardBg = isDark ? '#1a2332' : '#ffffff';

  return (
    <div style={{ position: 'relative', display: 'inline-block', width: '100%' }}>
      <button 
        onClick={() => setIsOpen(!isOpen)}
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: '0.75rem',
          background: 'transparent',
          border: 'none',
          color: text,
          padding: '0.6rem 0.75rem',
          borderRadius: '8px',
          cursor: 'pointer',
          fontFamily: 'inherit',
          fontSize: '0.85rem',
          fontWeight: 500,
          width: '100%',
          textAlign: 'left'
        }}
        onMouseOver={e => e.currentTarget.style.background = isDark ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.04)'}
        onMouseOut={e => e.currentTarget.style.background = 'transparent'}
        title="Select Language"
      >
        <Globe size={16} />
        {LANGUAGES.find(l => l.code === currentLang)?.label || 'Language'}
      </button>

      {isOpen && (
        <div style={{
          position: 'absolute',
          top: '100%',
          left: 0,
          marginTop: '0.2rem',
          background: cardBg,
          border: `1px solid ${border}`,
          borderRadius: '8px',
          boxShadow: '0 4px 12px rgba(0,0,0,0.15)',
          zIndex: 101,
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
                background: currentLang === lang.code ? (isDark ? 'rgba(0,123,255,0.2)' : 'rgba(0,123,255,0.1)') : 'transparent',
                border: 'none',
                color: currentLang === lang.code ? '#007BFF' : text,
                fontFamily: 'inherit',
                fontSize: '0.85rem',
                cursor: 'pointer'
              }}
              onMouseOver={e => {
                if (currentLang !== lang.code) e.currentTarget.style.background = isDark ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.04)';
              }}
              onMouseOut={e => {
                if (currentLang !== lang.code) e.currentTarget.style.background = 'transparent';
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
