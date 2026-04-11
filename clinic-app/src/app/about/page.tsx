'use client';

import React from 'react';
import Link from 'next/link';
import { Activity, Bug, Code, HelpCircle, Mail, MapPin, Server, Terminal, User, Zap } from 'lucide-react';

export default function AboutPage() {
  return (
    <>
      <main className="container fade-in" style={{ maxWidth: '800px', margin: '0 auto', paddingTop: '3rem' }}>
        
        <div style={{ textAlign: 'center', marginBottom: '3rem' }}>
          <div style={{ display: 'inline-flex', padding: '1rem', background: 'var(--glass-base)', borderRadius: '50%', border: '1px solid var(--glass-border)', marginBottom: '1rem' }}>
             <Activity size={40} className="pulse-primary" style={{ color: 'var(--accent-primary)' }} />
          </div>
          <h1 style={{ fontSize: '2.5rem', fontWeight: 900, marginBottom: '0.5rem', background: 'linear-gradient(to right, #00d2ff, #ffffff)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }}>
            About Q-PULSE
          </h1>
          <p style={{ color: 'var(--text-secondary)', fontSize: '1.1rem' }}>
            Next-Generation Medical Queue Engine
          </p>
        </div>

        <div className="glass-container" style={{ padding: '2.5rem', marginBottom: '2rem' }}>
          <h2 style={{ fontSize: '1.4rem', borderBottom: '1px solid var(--glass-border)', paddingBottom: '1rem', marginBottom: '1.5rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <Code size={20} color="var(--accent-primary)" /> Developer Information
          </h2>
          
          <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
             <p style={{ color: 'var(--text-secondary)', lineHeight: 1.6 }}>
               Q-PULSE was fundamentally designed to solve real-world clinical congestion. Built with cutting-edge real-time technologies, it empowers both patients and clinical staff to track, manage, and predict waiting times effortlessly without massive infrastructure overhead.
             </p>
             <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '1rem', marginTop: '1rem' }}>
                <div style={{ background: 'rgba(255,255,255,0.03)', padding: '1rem', borderRadius: '12px', border: '1px solid var(--glass-border)' }}>
                   <Server size={18} color="var(--accent-primary)" style={{ marginBottom: '0.5rem' }} />
                   <h3 style={{ fontSize: '0.9rem', margin: '0 0 0.3rem 0', color: 'var(--text-primary)' }}>Architecture</h3>
                   <p style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', margin: 0 }}>Next.js 15 PWA Edge Engine</p>
                </div>
                <div style={{ background: 'rgba(255,255,255,0.03)', padding: '1rem', borderRadius: '12px', border: '1px solid var(--glass-border)' }}>
                   <Zap size={18} color="var(--success)" style={{ marginBottom: '0.5rem' }} />
                   <h3 style={{ fontSize: '0.9rem', margin: '0 0 0.3rem 0', color: 'var(--text-primary)' }}>Database Engine</h3>
                   <p style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', margin: 0 }}>Google Firebase Real-Time Firestore</p>
                </div>
             </div>
          </div>
        </div>

        <div className="glass-container" style={{ padding: '2.5rem' }}>
          <h2 style={{ fontSize: '1.4rem', borderBottom: '1px solid var(--glass-border)', paddingBottom: '1rem', marginBottom: '1.5rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <Bug size={20} color="var(--danger)" /> Help & Support
          </h2>
          
          <p style={{ color: 'var(--text-secondary)', lineHeight: 1.6, marginBottom: '1.5rem' }}>
            Found a bug? Having trouble syncing your clinic tokens? Our developer team actively monitors systems for glitches. Please send us a direct bug report so we can permanently exterminate the issue.
          </p>

          <a 
            href="mailto:managesource02@gmail.com?subject=Q-PULSE%20Bug%20Report&body=Please%20describe%20the%20bug%20you%20encountered%3A%0D%0A%0D%0A" 
            className="btn btn-primary"
            style={{ width: '100%', display: 'flex', justifyContent: 'center', alignItems: 'center', gap: '0.5rem', padding: '1rem', background: 'linear-gradient(135deg, var(--danger), #ff8a80)', boxShadow: '0 4px 15px rgba(255, 77, 77, 0.3)' }}
          >
            <Mail size={18} /> Report Bug to managesource02@gmail.com
          </a>
        </div>

        <div style={{ textAlign: 'center', marginTop: '3rem', color: 'var(--text-secondary)', fontSize: '0.8rem' }}>
           <p>© {new Date().getFullYear()} Q-PULSE Developers. All rights reserved.</p>
        </div>

      </main>
    </>
  );
}
