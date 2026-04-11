'use client';

import React, { useState, useEffect } from 'react';
import { RecaptchaVerifier, signInWithPhoneNumber, ConfirmationResult } from 'firebase/auth';
import { auth } from '@/lib/firebase';
import { Loader2, Phone, ShieldCheck, ArrowRight } from 'lucide-react';

interface PhoneAuthProps {
  title: string;
  subtitle: string;
  onSuccess: (uid: string) => void;
  primaryColor?: string;
}

export default function PhoneAuth({ title, subtitle, onSuccess, primaryColor = 'var(--accent-primary)' }: PhoneAuthProps) {
  const [phoneNumber, setPhoneNumber] = useState('');
  const [otp, setOtp] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [confirmationResult, setConfirmationResult] = useState<ConfirmationResult | null>(null);

  // reCAPTCHA is now initialized lazily on submit to prevent lag and UI issues on load

  const handleSendOtp = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!phoneNumber) return setError('Please enter a phone number');
    
    setLoading(true);
    setError('');
    try {
      // Clean all spaces and non-numeric characters (except the plus sign)
      const cleanNumber = phoneNumber.replace(/[^0-9+]/g, '');
      const formattedNumber = cleanNumber.startsWith('+') ? cleanNumber : `+91${cleanNumber}`; 
      
      if (!window.recaptchaVerifier) {
        window.recaptchaVerifier = new RecaptchaVerifier(auth, 'recaptcha-container', {
          size: 'invisible',
        });
      }
      
      const appVerifier = window.recaptchaVerifier;
      const res = await signInWithPhoneNumber(auth, formattedNumber, appVerifier);
      setConfirmationResult(res);
    } catch (err: any) {
      console.error(err);
      setError(err.message || 'Failed to send OTP. Is your number formatted correctly?');
      if (window.recaptchaVerifier) {
        window.recaptchaVerifier.render().then((widgetId: any) => {
          (window as any).grecaptcha.reset(widgetId);
        });
      }
    } finally {
      setLoading(false);
    }
  };

  const handleVerifyOtp = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!otp || !confirmationResult) return setError('Please enter the OTP');
    
    setLoading(true);
    setError('');
    try {
      const result = await confirmationResult.confirm(otp);
      const user = result.user;
      
      // Successfully authenticated
      // Create session cookie or hit our backend API to sync the user 
      onSuccess(user.uid);
      
    } catch (err: any) {
      console.error(err);
      setError('Invalid OTP code.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="glass-card fade-in" style={{ 
      width: '100%', 
      maxWidth: '420px', 
      position: 'relative',
      boxShadow: `0 10px 40px ${primaryColor}22`
    }}>
      {/* Decorative top bar */}
      <div style={{
        position: 'absolute',
        top: 0,
        left: 0,
        right: 0,
        height: '4px',
        background: `linear-gradient(90deg, transparent, ${primaryColor}, transparent)`,
        borderTopLeftRadius: '16px',
        borderTopRightRadius: '16px'
      }} />

      <div style={{ textAlign: 'center', marginBottom: '2rem' }}>
        <h2 style={{ 
          fontSize: '1.8rem', 
          marginBottom: '0.5rem',
          background: `linear-gradient(to right, #ffffff, ${primaryColor})`,
          WebkitBackgroundClip: 'text',
          WebkitTextFillColor: 'transparent'
        }}>
          {title}
        </h2>
        <p style={{ color: 'var(--text-secondary)', fontSize: '0.95rem' }}>{subtitle}</p>
      </div>

      <div id="recaptcha-container"></div>

      {error && (
        <div style={{ 
          padding: '0.8rem', 
          background: 'rgba(255, 77, 77, 0.1)', 
          border: '1px solid rgba(255, 77, 77, 0.2)',
          borderRadius: '8px',
          color: 'var(--danger)',
          fontSize: '0.85rem',
          marginBottom: '1rem',
          textAlign: 'center'
        }}>
          {error}
        </div>
      )}

      {!confirmationResult ? (
        <form onSubmit={handleSendOtp} style={{ display: 'flex', flexDirection: 'column', gap: '1.2rem' }}>
          <div style={{ position: 'relative' }}>
            <Phone size={18} color="var(--text-secondary)" style={{ position: 'absolute', left: '1rem', top: '50%', transform: 'translateY(-50%)' }} />
            <input 
              type="tel" 
              className="input-field" 
              placeholder="Mobile Number (e.g. +91 98765...)" 
              style={{ paddingLeft: '2.8rem' }}
              value={phoneNumber}
              onChange={(e) => setPhoneNumber(e.target.value)}
              disabled={loading}
              autoFocus
            />
          </div>
          <button 
            type="submit" 
            className="btn"
            disabled={loading}
            style={{ 
              background: `linear-gradient(135deg, ${primaryColor}, #111)`,
              color: 'white',
              boxShadow: `0 4px 15px ${primaryColor}44`,
              border: `1px solid ${primaryColor}66`
            }}
          >
            {loading ? <Loader2 size={18} className="animate-spin" /> : <>Send OTP <ArrowRight size={18} /></>}
          </button>
        </form>
      ) : (
        <form onSubmit={handleVerifyOtp} style={{ display: 'flex', flexDirection: 'column', gap: '1.2rem', animation: 'fadeIn 0.3s ease' }}>
          <div style={{ position: 'relative' }}>
            <ShieldCheck size={18} color={primaryColor} style={{ position: 'absolute', left: '1rem', top: '50%', transform: 'translateY(-50%)' }} />
            <input 
              type="text" 
              className="input-field" 
              placeholder="Enter 6-digit OTP" 
              style={{ 
                paddingLeft: '2.8rem', 
                letterSpacing: '4px', 
                fontSize: '1.2rem', 
                fontWeight: 'bold',
                borderColor: `${primaryColor}55`
              }}
              value={otp}
              onChange={(e) => setOtp(e.target.value.replace(/[^0-9]/g, ''))}
              maxLength={6}
              disabled={loading}
              autoFocus
            />
          </div>
          <button 
            type="submit" 
            className="btn"
            disabled={loading || otp.length < 6}
            style={{ 
              background: `linear-gradient(135deg, ${primaryColor}, #111)`,
              color: 'white',
              boxShadow: `0 4px 15px ${primaryColor}44`,
              border: `1px solid ${primaryColor}66`
            }}
          >
            {loading ? <Loader2 size={18} className="animate-spin" /> : 'Verify Securely'}
          </button>
          
          <button 
            type="button" 
            onClick={() => { setConfirmationResult(null); setOtp(''); }}
            className="btn btn-outline"
            style={{ fontSize: '0.8rem', padding: '0.5rem', border: 'none' }}
            disabled={loading}
          >
            Change Phone Number
          </button>
        </form>
      )}
    </div>
  );
}

// Global declaration for recaptcha
declare global {
  interface Window {
    recaptchaVerifier: any;
  }
}
