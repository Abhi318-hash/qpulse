import React from 'react';
import Link from 'next/link';
import { Shield, ArrowLeft } from 'lucide-react';

export default function PrivacyPage() {
  return (
    <main style={{ minHeight: '100vh', background: '#f8fafc', padding: '3rem 1rem', color: '#1a2332' }}>
      <div style={{ maxWidth: 800, margin: '0 auto', background: 'white', padding: '2.5rem', borderRadius: 20, border: '1px solid #eef0f3', boxShadow: '0 4px 12px rgba(0,0,0,0.03)' }}>
        
        {/* Back link */}
        <Link href="/" style={{ fontSize: '0.85rem', color: '#007BFF', display: 'inline-flex', alignItems: 'center', gap: '0.4rem', textDecoration: 'none', marginBottom: '2rem', fontWeight: 600 }}>
          <ArrowLeft size={16} /> Back to Homepage
        </Link>

        {/* Title */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '1.5rem' }}>
          <Shield size={32} color="#007BFF" />
          <h1 style={{ fontSize: '1.75rem', fontWeight: 900, margin: 0 }}>Privacy Policy &amp; DPDP Act Compliance</h1>
        </div>

        <p style={{ color: '#5a6a7e', fontSize: '0.9rem', marginBottom: '1.5rem' }}>
          Last Updated: May 27, 2026
        </p>

        <section style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem', fontSize: '0.88rem', lineHeight: 1.7, color: '#334155' }}>
          <div>
            <h2 style={{ fontSize: '1.1rem', fontWeight: 700, color: '#1e293b', marginBottom: '0.5rem' }}>1. Introduction</h2>
            <p>
              Q-PULSE Healthcare Network ("we", "our", or "us") operates a clinic queue management and personal electronic health records (EHR) SaaS system. This Privacy Policy outlines how we collect, store, share, and protect your digital healthcare data, strictly adhering to the **Digital Personal Data Protection (DPDP) Act 2023** (India) and other global health information privacy regulations.
            </p>
          </div>

          <div>
            <h2 style={{ fontSize: '1.1rem', fontWeight: 700, color: '#1e293b', marginBottom: '0.5rem' }}>2. Consent and Authorization</h2>
            <p>
              By creating an account, registering a phone number, booking a token, or utilizing the EHR prescription uploading feature, you provide explicit, revocable consent to store your profile information (Name, Age, Contact, Symptoms, Diagnosis, Vitals, and Prescription files). 
            </p>
          </div>

          <div>
            <h2 style={{ fontSize: '1.1rem', fontWeight: 700, color: '#1e293b', marginBottom: '0.5rem' }}>3. Right to Data Portability (Data Export)</h2>
            <p>
              Under Section 6 of the DPDP Act 2023, you have the right to download all personal and medical data stored in our system. You can retrieve your profile, completed visit history, and prescriptions in a structured, machine-readable JSON format at any time directly from the **Profile** dashboard.
            </p>
          </div>

          <div>
            <h2 style={{ fontSize: '1.1rem', fontWeight: 700, color: '#1e293b', marginBottom: '0.5rem' }}>4. Right to Erasure (Account Deletion)</h2>
            <p>
              You have the right to request the erasure of your personal data when it is no longer necessary for the purpose for which it was collected. Initiating the "Delete Account" command in the profile tab will permanently:
            </p>
            <ul style={{ paddingLeft: '1.25rem', marginTop: '0.5rem' }}>
              <li>Purge your profile and emergency contacts from our production database.</li>
              <li>Wipe all uploaded prescription JPEG, PNG, and PDF files from Firebase Storage.</li>
              <li>Anonymize all past appointment rosters (sanitizing name, phone, age, and disease logs).</li>
            </ul>
          </div>

          <div>
            <h2 style={{ fontSize: '1.1rem', fontWeight: 700, color: '#1e293b', marginBottom: '0.5rem' }}>5. Security and Encryption</h2>
            <p>
              All personal and medical documents are protected. Data in transit is secured via HTTPS/TLS, and prescription files are fully encrypted at rest inside secure Firebase Storage buckets. Access to patient files is limited exclusively to doctors during active queue sessions.
            </p>
          </div>

          <div style={{ borderTop: '1px solid #eef0f3', paddingTop: '1.5rem', marginTop: '1rem', fontSize: '0.8rem', color: '#5a6a7e' }}>
            For privacy inquiries or to contact our Data Protection Officer, please write to: <strong>privacy@qpulse.health</strong>
          </div>
        </section>

      </div>
    </main>
  );
}
