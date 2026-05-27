import React from 'react';
import Link from 'next/link';
import { FileText, ArrowLeft } from 'lucide-react';

export default function TermsPage() {
  return (
    <main style={{ minHeight: '100vh', background: '#f8fafc', padding: '3rem 1rem', color: '#1a2332' }}>
      <div style={{ maxWidth: 800, margin: '0 auto', background: 'white', padding: '2.5rem', borderRadius: 20, border: '1px solid #eef0f3', boxShadow: '0 4px 12px rgba(0,0,0,0.03)' }}>
        
        {/* Back link */}
        <Link href="/" style={{ fontSize: '0.85rem', color: '#007BFF', display: 'inline-flex', alignItems: 'center', gap: '0.4rem', textDecoration: 'none', marginBottom: '2rem', fontWeight: 600 }}>
          <ArrowLeft size={16} /> Back to Homepage
        </Link>

        {/* Title */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '1.5rem' }}>
          <FileText size={32} color="#007BFF" />
          <h1 style={{ fontSize: '1.75rem', fontWeight: 900, margin: 0 }}>Terms of Service</h1>
        </div>

        <p style={{ color: '#5a6a7e', fontSize: '0.9rem', marginBottom: '1.5rem' }}>
          Last Updated: May 27, 2026
        </p>

        <section style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem', fontSize: '0.88rem', lineHeight: 1.7, color: '#334155' }}>
          <div>
            <h2 style={{ fontSize: '1.1rem', fontWeight: 700, color: '#1e293b', marginBottom: '0.5rem' }}>1. Agreement to Terms</h2>
            <p>
              By accessing or using the Q-PULSE clinic queue management platform ("Service"), you agree to be bound by these Terms of Service. If you are entering into this agreement on behalf of a clinic, hospital group, or other medical organization, you represent that you have the authority to bind such entity to these terms.
            </p>
          </div>

          <div>
            <h2 style={{ fontSize: '1.1rem', fontWeight: 700, color: '#1e293b', marginBottom: '0.5rem' }}>2. Use of Service</h2>
            <p>
              Q-PULSE provides queue coordination, notification management, and patient record storage. You agree to:
            </p>
            <ul style={{ paddingLeft: '1.25rem', marginTop: '0.5rem' }}>
              <li>Provide accurate registration information for your clinics and organization.</li>
              <li>Maintain the security of your staff login sessions and authorized phone numbers.</li>
              <li>Only upload medical records, prescriptions, and patient data for which you have acquired the necessary explicit patient consent.</li>
            </ul>
          </div>

          <div>
            <h2 style={{ fontSize: '1.1rem', fontWeight: 700, color: '#1e293b', marginBottom: '0.5rem' }}>3. Subscription and Billing</h2>
            <p>
              Certain aspects of the Service are provided on a paid subscription basis. Paid accounts are subject to monthly or annual recurring billing through our payment gateways (e.g., Razorpay). You are responsible for all charges incurred under your account. Failure to pay subscription fees may result in suspension or termination of premium features and access to clinic records.
            </p>
          </div>

          <div>
            <h2 style={{ fontSize: '1.1rem', fontWeight: 700, color: '#1e293b', marginBottom: '0.5rem' }}>4. Medical Disclaimer</h2>
            <p>
              Q-PULSE is a software tool for queue management and electronic health records organization. **We do not provide medical services, clinical advice, or diagnostics.** Any clinical decision or diagnosis logged in the platform is the sole responsibility of the attending practitioner. In the event of a medical emergency, patients should seek immediate professional medical attention instead of waiting in a virtual queue.
            </p>
          </div>

          <div>
            <h2 style={{ fontSize: '1.1rem', fontWeight: 700, color: '#1e293b', marginBottom: '0.5rem' }}>5. Limitation of Liability</h2>
            <p>
              To the maximum extent permitted by applicable law, Q-PULSE and its operators shall not be liable for any indirect, incidental, special, consequential, or punitive damages, or any loss of profits or revenues, whether incurred directly or indirectly, or any loss of data, use, goodwill, or other intangible losses resulting from your access to or use of the Service.
            </p>
          </div>

          <div style={{ borderTop: '1px solid #eef0f3', paddingTop: '1.5rem', marginTop: '1rem', fontSize: '0.8rem', color: '#5a6a7e' }}>
            For queries about our Terms of Service, please reach out to: <strong>support@qpulse.health</strong>
          </div>
        </section>

      </div>
    </main>
  );
}
