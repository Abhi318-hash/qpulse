'use client';

import React from 'react';
import Link from 'next/link';
import { Activity, Bug, Code, Mail, Server, Zap, Building, Stethoscope, Rocket, ShieldAlert } from 'lucide-react';

export default function AboutPage() {
  return (
    <>
      <main className="container fade-in" style={{ maxWidth: '900px', margin: '0 auto', paddingTop: '3rem', paddingBottom: '3rem' }}>
        
        {/* Header */}
        <div style={{ textAlign: 'center', marginBottom: '3rem' }}>
          <div style={{ display: 'inline-flex', padding: '1rem', background: 'var(--glass-base)', borderRadius: '50%', border: '1px solid var(--glass-border)', marginBottom: '1rem' }}>
             <Activity size={40} className="pulse-primary" style={{ color: 'var(--accent-primary)' }} />
          </div>
          <h1 style={{ fontSize: '2.5rem', fontWeight: 900, marginBottom: '0.5rem', background: 'linear-gradient(to right, #00d2ff, #ffffff)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }}>
            Q-PULSE for Providers
          </h1>
          <p style={{ color: 'var(--text-secondary)', fontSize: '1.1rem', maxWidth: 500, margin: '0 auto' }}>
            The central hub for hospital administrators, clinic staff, and new partners to manage and scale their medical queues.
          </p>
        </div>

        {/* ── B2B Portals Grid ── */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '1.5rem', marginBottom: '4rem' }}>
          
          {/* Org Admin Portal */}
          <Link href="/onboard" style={{ textDecoration: 'none' }}>
            <div className="glass-container hover-lift" style={{ padding: '2rem', height: '100%', display: 'flex', flexDirection: 'column', transition: 'all 0.3s' }}>
              <div style={{ background: 'rgba(0, 123, 255, 0.1)', width: 50, height: 50, borderRadius: 12, display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: '1rem' }}>
                <Building size={24} color="#007BFF" />
              </div>
              <h2 style={{ fontSize: '1.25rem', fontWeight: 700, margin: '0 0 0.5rem 0', color: 'var(--text-primary)' }}>Hospital / Org Admin</h2>
              <p style={{ color: 'var(--text-secondary)', fontSize: '0.9rem', flex: 1, margin: 0, lineHeight: 1.5 }}>
                Login to manage your hospital branches, add clinics, and view organization-wide analytics.
              </p>
              <div style={{ marginTop: '1.5rem', fontSize: '0.85rem', fontWeight: 700, color: '#007BFF', display: 'flex', alignItems: 'center', gap: '0.3rem' }}>
                Access Portal &rarr;
              </div>
            </div>
          </Link>

          {/* Clinic Staff Portal */}
          <Link href="/clinic/login" style={{ textDecoration: 'none' }}>
            <div className="glass-container hover-lift" style={{ padding: '2rem', height: '100%', display: 'flex', flexDirection: 'column', transition: 'all 0.3s' }}>
              <div style={{ background: 'rgba(16, 185, 129, 0.1)', width: 50, height: 50, borderRadius: 12, display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: '1rem' }}>
                <Stethoscope size={24} color="#10b981" />
              </div>
              <h2 style={{ fontSize: '1.25rem', fontWeight: 700, margin: '0 0 0.5rem 0', color: 'var(--text-primary)' }}>Clinic Staff</h2>
              <p style={{ color: 'var(--text-secondary)', fontSize: '0.9rem', flex: 1, margin: 0, lineHeight: 1.5 }}>
                Login to your clinic dashboard to manage live patient queues, book appointments, and advance tokens.
              </p>
              <div style={{ marginTop: '1.5rem', fontSize: '0.85rem', fontWeight: 700, color: '#10b981', display: 'flex', alignItems: 'center', gap: '0.3rem' }}>
                Access Portal &rarr;
              </div>
            </div>
          </Link>

          {/* Partner Onboarding */}
          <Link href="/onboard" style={{ textDecoration: 'none' }}>
            <div className="glass-container hover-lift" style={{ padding: '2rem', height: '100%', display: 'flex', flexDirection: 'column', transition: 'all 0.3s' }}>
              <div style={{ background: 'rgba(99, 102, 241, 0.1)', width: 50, height: 50, borderRadius: 12, display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: '1rem' }}>
                <Rocket size={24} color="#6366f1" />
              </div>
              <h2 style={{ fontSize: '1.25rem', fontWeight: 700, margin: '0 0 0.5rem 0', color: 'var(--text-primary)' }}>Partner with Us</h2>
              <p style={{ color: 'var(--text-secondary)', fontSize: '0.9rem', flex: 1, margin: 0, lineHeight: 1.5 }}>
                New to Q-PULSE? Submit an application to digitize your clinic or hospital queue system today.
              </p>
              <div style={{ marginTop: '1.5rem', fontSize: '0.85rem', fontWeight: 700, color: '#6366f1', display: 'flex', alignItems: 'center', gap: '0.3rem' }}>
                Apply Now &rarr;
              </div>
            </div>
          </Link>

        </div>

        {/* ── Developer Info ── */}
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
                   <p style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', margin: 0 }}>Next.js Edge Engine</p>
                </div>
                <div style={{ background: 'rgba(255,255,255,0.03)', padding: '1rem', borderRadius: '12px', border: '1px solid var(--glass-border)' }}>
                   <Zap size={18} color="var(--success)" style={{ marginBottom: '0.5rem' }} />
                   <h3 style={{ fontSize: '0.9rem', margin: '0 0 0.3rem 0', color: 'var(--text-primary)' }}>Database Engine</h3>
                   <p style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', margin: 0 }}>Google Firebase Real-Time Firestore</p>
                </div>
             </div>
          </div>
        </div>

        {/* ── Help & Support ── */}
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

        {/* Super Admin / Footer */}
        <div style={{ textAlign: 'center', marginTop: '3rem', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '1rem' }}>
           <Link href="/admin/login" style={{ display: 'inline-flex', alignItems: 'center', gap: '0.3rem', color: 'var(--text-secondary)', fontSize: '0.75rem', textDecoration: 'none', opacity: 0.6 }}>
             <ShieldAlert size={12} /> System Admin Portal
           </Link>
           <p style={{ color: 'var(--text-secondary)', fontSize: '0.8rem', margin: 0 }}>© {new Date().getFullYear()} Q-PULSE Developers. All rights reserved.</p>
        </div>

      </main>
      <style dangerouslySetInnerHTML={{__html: `
        .hover-lift:hover {
          transform: translateY(-5px);
          box-shadow: 0 10px 25px rgba(0,0,0,0.2) !important;
          border-color: rgba(255,255,255,0.2) !important;
        }
      `}} />
    </>
  );
}
