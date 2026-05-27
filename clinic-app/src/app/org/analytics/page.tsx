'use client';

import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { collection, query, where, getDocs, doc, getDoc } from 'firebase/firestore';
import { db, auth } from '@/lib/firebase';
import { onAuthStateChanged } from 'firebase/auth';
import { 
  ArrowLeft, Building, Users, Clock, IndianRupee, 
  TrendingUp, Table, Loader2, ArrowUpRight, BarChart2
} from 'lucide-react';
import Link from 'next/link';

export default function OrgAnalytics() {
  const router = useRouter();

  const [org, setOrg] = useState<any>(null);
  const [clinics, setClinics] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [authenticated, setAuthenticated] = useState(false);

  // Computed metrics
  const [metrics, setMetrics] = useState({
    totalClinics: 0,
    totalBookings: 0,
    totalRevenue: 0,
    avgWaitTime: 0,
  });

  // Cross-clinic summary
  const [clinicSummaries, setClinicSummaries] = useState<any[]>([]);
  // Booking source breakdown
  const [bookingSources, setBookingSources] = useState<{ source: string; count: number; pct: number }[]>([]);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      if (!user) {
        router.push('/login?redirect=/org/analytics');
        return;
      }
      setAuthenticated(true);
      fetchOrgAnalytics(user.phoneNumber);
    });

    return () => unsubscribe();
  }, []);

  const fetchOrgAnalytics = async (phone: string | null) => {
    if (!phone) {
      router.push('/');
      return;
    }

    try {
      setLoading(true);

      // 1. Get the admin record by phone number
      const adminRef = doc(db, 'admins', phone);
      const adminSnap = await getDoc(adminRef);

      if (!adminSnap.exists() || adminSnap.data().role !== 'org_admin') {
        alert('Unauthorized access.');
        router.push('/');
        return;
      }

      const orgId = adminSnap.data().org_id;
      if (!orgId) {
        router.push('/onboard');
        return;
      }

      // 2. Fetch Organization Details
      const orgSnap = await getDoc(doc(db, 'organizations', orgId));
      if (!orgSnap.exists()) {
        console.error('Org not found');
        setLoading(false);
        return;
      }
      const orgData = { id: orgSnap.id, ...orgSnap.data() };
      setOrg(orgData);

      // 3. Fetch Clinics
      const clinicsQuery = query(collection(db, 'clinics'), where('org_id', '==', orgId));
      const clinicsSnap = await getDocs(clinicsQuery);
      const clinicsList = clinicsSnap.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      setClinics(clinicsList);

      // 4. Fetch All Appointments under this organization
      const apptsQuery = query(collection(db, 'appointments'), where('org_id', '==', orgId));
      const apptsSnap = await getDocs(apptsQuery);
      const apptsList = apptsSnap.docs.map(doc => ({ id: doc.id, ...doc.data() }));

      computeOrgMetrics(clinicsList, apptsList);
    } catch (err) {
      console.error('Error fetching org analytics:', err);
    } finally {
      setLoading(false);
    }
  };

  const computeOrgMetrics = (clinicsData: any[], apptsData: any[]) => {
    const totalClinics = clinicsData.length;
    const totalBookings = apptsData.length;

    // Total completed appointments
    const completed = apptsData.filter(a => a.status === 'COMPLETED');
    const totalRevenue = completed.reduce((sum, a) => sum + (a.fees || 0), 0);

    // Average wait time
    let totalWaitTime = 0;
    let timedCompletedCount = 0;
    completed.forEach(a => {
      if (a.completed_at && a.queued_at) {
        const compTime = a.completed_at.seconds || new Date(a.completed_at).getTime() / 1000;
        const qTime = a.queued_at.seconds || new Date(a.queued_at).getTime() / 1000;
        const waitMin = (compTime - qTime) / 60;
        if (waitMin > 0 && waitMin < 240) {
          totalWaitTime += waitMin;
          timedCompletedCount++;
        }
      }
    });
    const avgWaitTime = timedCompletedCount > 0 ? Math.round(totalWaitTime / timedCompletedCount) : 0;

    setMetrics({
      totalClinics,
      totalBookings,
      totalRevenue,
      avgWaitTime,
    });

    // ── 1. Compile Clinic Summaries ──
    const summaries = clinicsData.map(clinic => {
      const clinicAppts = apptsData.filter(a => a.clinic_id === clinic.id);
      const clinicCompleted = clinicAppts.filter(a => a.status === 'COMPLETED');
      const rev = clinicCompleted.reduce((sum, a) => sum + (a.fees || 0), 0);
      
      let clinicWaitSum = 0;
      let clinicWaitCount = 0;
      clinicCompleted.forEach(a => {
        if (a.completed_at && a.queued_at) {
          const compTime = a.completed_at.seconds || new Date(a.completed_at).getTime() / 1000;
          const qTime = a.queued_at.seconds || new Date(a.queued_at).getTime() / 1000;
          const waitMin = (compTime - qTime) / 60;
          if (waitMin > 0 && waitMin < 240) {
            clinicWaitSum += waitMin;
            clinicWaitCount++;
          }
        }
      });
      const cAvgWait = clinicWaitCount > 0 ? Math.round(clinicWaitSum / clinicWaitCount) : 0;

      return {
        id: clinic.id,
        name: clinic.name,
        doctor: clinic.doctor_name,
        specialization: clinic.specialization,
        total: clinicAppts.length,
        completed: clinicCompleted.length,
        revenue: rev,
        avgWait: cAvgWait,
      };
    });
    setClinicSummaries(summaries);

    // ── 2. Booking Source Breakdown ──
    const sources = {
      online: 0,
      walkin: 0,
      staff: 0,
    };
    apptsData.forEach(a => {
      const src = a.booking_source || 'online';
      if (src === 'online') sources.online++;
      else if (src === 'walkin') sources.walkin++;
      else sources.staff++;
    });

    const totalSources = Math.max(totalBookings, 1);
    const sourceBreakdown = [
      { source: 'Online (Patient App)', count: sources.online, pct: Math.round((sources.online / totalSources) * 100) },
      { source: 'Walk-in Desk', count: sources.walkin, pct: Math.round((sources.walkin / totalSources) * 100) },
      { source: 'Staff Bookings', count: sources.staff, pct: Math.round((sources.staff / totalSources) * 100) },
    ];
    setBookingSources(sourceBreakdown);
  };

  if (loading || !authenticated) {
    return (
      <div style={{ display: 'grid', placeItems: 'center', minHeight: '100vh', background: '#f8fafc' }}>
        <div style={{ textAlign: 'center' }}>
          <Loader2 size={40} className="animate-spin" style={{ color: '#007BFF', margin: '0 auto 1rem' }} />
          <p style={{ color: '#5a6a7e', fontWeight: 500 }}>Loading Organization Analytics Workspace…</p>
        </div>
      </div>
    );
  }

  const maxRevenue = Math.max(...clinicSummaries.map(s => s.revenue), 1);

  return (
    <main style={{ minHeight: '100vh', background: '#f8fafc', padding: '2rem 1rem', color: '#1a2332' }}>
      <div style={{ maxWidth: 1100, margin: '0 auto' }}>
        
        {/* Back Link & Header */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '2rem' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
            <Link 
              href={`/org`} 
              style={{
                width: 38, height: 38, borderRadius: 10, border: '1px solid #eef0f3',
                background: 'white', display: 'flex', alignItems: 'center', justifyContent: 'center',
                color: '#5a6a7e', textDecoration: 'none', boxShadow: '0 2px 6px rgba(0,0,0,0.02)'
              }}
            >
              <ArrowLeft size={18} />
            </Link>
            <div>
              <h1 style={{ fontSize: '1.45rem', fontWeight: 900, margin: 0 }}>{org?.name}</h1>
              <p style={{ margin: 0, fontSize: '0.8rem', color: '#5a6a7e' }}>
                Multi-Tenant Consolidated Revenue &amp; Utilization Analytics
              </p>
            </div>
          </div>
          
          <div style={{ background: 'white', border: '1px solid #eef0f3', padding: '0.5rem 0.75rem', borderRadius: 10, fontSize: '0.8rem', color: '#5a6a7e', fontWeight: 500 }}>
            Workspace Owner: <strong style={{ color: '#1a2332' }}>{org?.owner_phone}</strong>
          </div>
        </div>

        {/* ── METRICS STRIP ── */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '1rem', marginBottom: '2rem' }}>
          {[
            { label: 'Active Clinic Rooms', value: metrics.totalClinics, icon: <Building size={20} color="#007BFF" />, desc: `Plan Tier: ${org?.plan?.toUpperCase()}` },
            { label: 'Total Roster Bookings', value: metrics.totalBookings, icon: <Users size={20} color="#6366f1" />, desc: 'Tokens generated' },
            { label: 'Aggregated Revenue', value: `₹${metrics.totalRevenue.toLocaleString()}`, icon: <IndianRupee size={20} color="#10b981" />, desc: 'All clinics combined' },
            { label: 'Overall Queue Delay', value: `${metrics.avgWaitTime} Mins`, icon: <Clock size={20} color="#f59e0b" />, desc: 'Network average wait' }
          ].map((metric, i) => (
            <div key={i} style={{ background: 'white', padding: '1.5rem', borderRadius: 16, border: '1px solid #eef0f3', boxShadow: '0 4px 12px rgba(0,0,0,0.02)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div>
                <span style={{ fontSize: '0.72rem', color: '#5a6a7e', textTransform: 'uppercase', fontWeight: 700, display: 'block', marginBottom: '0.3rem' }}>{metric.label}</span>
                <strong style={{ fontSize: '1.5rem', fontWeight: 800, color: '#1e293b' }}>{metric.value}</strong>
                <span style={{ fontSize: '0.7rem', color: '#64748b', display: 'block', marginTop: '0.2rem' }}>{metric.desc}</span>
              </div>
              <div style={{ width: 44, height: 44, borderRadius: 10, background: '#f8fafc', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                {metric.icon}
              </div>
            </div>
          ))}
        </div>

        {/* ── CHARTS & BOOKING ROW ── */}
        <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: '1.5rem', marginBottom: '2rem' }}>
          
          {/* Revenue Comparison by Clinic (Sleek CSS/SVG Bar Chart) */}
          <div style={{ background: 'white', padding: '1.5rem', borderRadius: 20, border: '1px solid #eef0f3', boxShadow: '0 4px 12px rgba(0,0,0,0.02)' }}>
            <h2 style={{ fontSize: '0.98rem', fontWeight: 800, margin: '0 0 1.5rem 0', display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
              <TrendingUp size={16} color="#007BFF" /> Consolidated Revenue Comparison
            </h2>

            {clinicSummaries.length === 0 ? (
              <div style={{ textAlign: 'center', color: '#5a6a7e', padding: '3rem 0', fontSize: '0.85rem' }}>
                No active clinics to compare.
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
                {clinicSummaries.map((clinic, idx) => {
                  const pct = Math.round((clinic.revenue / maxRevenue) * 100);
                  return (
                    <div key={idx} style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
                      <div style={{ width: 140, textOverflow: 'ellipsis', overflow: 'hidden', whiteSpace: 'nowrap', fontSize: '0.8rem', fontWeight: 700 }}>
                        {clinic.name}
                      </div>
                      
                      <div style={{ flex: 1, height: 16, background: '#f1f5f9', borderRadius: 8, overflow: 'hidden', position: 'relative' }}>
                        <div style={{
                          width: `${pct}%`, height: '100%',
                          background: 'linear-gradient(to right, #007BFF, #10b981)',
                          borderRadius: 8, transition: 'width 0.4s ease'
                        }} />
                      </div>

                      <div style={{ width: 80, textAlign: 'right', fontSize: '0.8rem', fontWeight: 700, color: '#10b981' }}>
                        ₹{clinic.revenue.toLocaleString()}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* Booking Sources (Donut breakdown) */}
          <div style={{ background: 'white', padding: '1.5rem', borderRadius: 20, border: '1px solid #eef0f3', boxShadow: '0 4px 12px rgba(0,0,0,0.02)' }}>
            <h2 style={{ fontSize: '0.98rem', fontWeight: 800, margin: '0 0 1.5rem 0', display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
              <BarChart2 size={16} color="#007BFF" /> Booking Source Analysis
            </h2>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.9rem' }}>
              {bookingSources.map((src, i) => {
                const colors = ['#007BFF', '#f59e0b', '#6366f1'];
                return (
                  <div key={i}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.75rem', fontWeight: 600, marginBottom: '0.2rem' }}>
                      <span>{src.source}</span>
                      <span style={{ color: '#5a6a7e' }}>{src.count} ({src.pct}%)</span>
                    </div>
                    <div style={{ width: '100%', height: 6, background: '#f1f5f9', borderRadius: 3, overflow: 'hidden' }}>
                      <div style={{ width: `${src.pct}%`, height: '100%', background: colors[i % colors.length], borderRadius: 3 }} />
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>

        {/* ── CROSS CLINIC COMPARISON TABLE ── */}
        <div style={{ background: 'white', padding: '1.5rem', borderRadius: 20, border: '1px solid #eef0f3', boxShadow: '0 4px 12px rgba(0,0,0,0.02)' }}>
          <h2 style={{ fontSize: '0.98rem', fontWeight: 800, margin: '0 0 1.25rem 0', display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
            <Table size={16} color="#007BFF" /> Clinic Roster Performance Audit
          </h2>

          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '0.82rem' }}>
              <thead>
                <tr style={{ borderBottom: '2px solid #f1f5f9', color: '#64748b' }}>
                  <th style={{ padding: '0.75rem 0.5rem', fontWeight: 700 }}>Clinic Room</th>
                  <th style={{ padding: '0.75rem 0.5rem', fontWeight: 700 }}>Physician</th>
                  <th style={{ padding: '0.75rem 0.5rem', fontWeight: 700 }}>Specialization</th>
                  <th style={{ padding: '0.75rem 0.5rem', fontWeight: 700, textAlign: 'center' }}>Total Tokens</th>
                  <th style={{ padding: '0.75rem 0.5rem', fontWeight: 700, textAlign: 'center' }}>Served</th>
                  <th style={{ padding: '0.75rem 0.5rem', fontWeight: 700, textAlign: 'right' }}>Revenue Generated</th>
                  <th style={{ padding: '0.75rem 0.5rem', fontWeight: 700, textAlign: 'center' }}>Avg Wait Time</th>
                  <th style={{ padding: '0.75rem 0.5rem' }}></th>
                </tr>
              </thead>
              <tbody>
                {clinicSummaries.length === 0 ? (
                  <tr>
                    <td colSpan={8} style={{ padding: '2rem', textAlign: 'center', color: '#64748b' }}>No clinic information registered in workspace.</td>
                  </tr>
                ) : (
                  clinicSummaries.map((item, idx) => (
                    <tr key={idx} style={{ borderBottom: '1px solid #f1f5f9', transition: 'background 0.2s' }}>
                      <td style={{ padding: '0.9rem 0.5rem', fontWeight: 700, color: '#1e293b' }}>{item.name}</td>
                      <td style={{ padding: '0.9rem 0.5rem', color: '#334155' }}>Dr. {item.doctor}</td>
                      <td style={{ padding: '0.9rem 0.5rem', color: '#64748b' }}>{item.specialization}</td>
                      <td style={{ padding: '0.9rem 0.5rem', textAlign: 'center', fontWeight: 600 }}>{item.total}</td>
                      <td style={{ padding: '0.9rem 0.5rem', textAlign: 'center', color: '#10b981', fontWeight: 600 }}>{item.completed}</td>
                      <td style={{ padding: '0.9rem 0.5rem', textAlign: 'right', fontWeight: 700, color: '#10b981' }}>₹{item.revenue.toLocaleString()}</td>
                      <td style={{ padding: '0.9rem 0.5rem', textAlign: 'center', fontWeight: 600 }}>{item.avgWait} mins</td>
                      <td style={{ padding: '0.9rem 0.5rem', textAlign: 'right' }}>
                        <Link 
                          href={`/clinic/${item.id}/analytics`} 
                          style={{
                            display: 'inline-flex', alignItems: 'center', gap: '0.2rem',
                            color: '#007BFF', textDecoration: 'none', fontWeight: 600
                          }}
                        >
                          View <ArrowUpRight size={14} />
                        </Link>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>

      </div>
    </main>
  );
}
