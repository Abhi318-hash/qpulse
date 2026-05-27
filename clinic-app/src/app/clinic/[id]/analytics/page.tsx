'use client';

import React, { useState, useEffect } from 'react';
import { useRouter, useParams } from 'next/navigation';
import { collection, query, where, getDocs, doc, getDoc } from 'firebase/firestore';
import { db, auth } from '@/lib/firebase';
import { onAuthStateChanged } from 'firebase/auth';
import { 
  ArrowLeft, Calendar, Clock, IndianRupee, Users, 
  TrendingUp, Activity, BarChart2, AlertCircle, Loader2 
} from 'lucide-react';
import Link from 'next/link';

export default function ClinicAnalytics() {
  const router = useRouter();
  const params = useParams();
  const clinicId = params.id as string;

  const [clinic, setClinic] = useState<any>(null);
  const [appointments, setAppointments] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [authenticated, setAuthenticated] = useState(false);

  // Computed metrics
  const [metrics, setMetrics] = useState({
    totalVisits: 0,
    completedVisits: 0,
    totalRevenue: 0,
    avgWaitTime: 0,
    noShowRate: 0,
    growthRate: 0, // Mock comparison
  });

  // Chart data
  const [dailyVolume, setDailyVolume] = useState<{ day: string; count: number }[]>([]);
  const [statusBreakdown, setStatusBreakdown] = useState<{ label: string; count: number; color: string }[]>([]);
  const [hourlyPeak, setHourlyPeak] = useState<{ range: string; count: number; pct: number }[]>([]);
  const [topDiseases, setTopDiseases] = useState<{ disease: string; count: number }[]>([]);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      if (!user) {
        router.push(`/login?redirect=/clinic/${clinicId}/analytics`);
        return;
      }
      setAuthenticated(true);
      fetchAnalyticsData();
    });

    return () => unsubscribe();
  }, [clinicId]);

  const fetchAnalyticsData = async () => {
    try {
      setLoading(true);
      // 1. Fetch clinic details
      const clinicSnap = await getDoc(doc(db, 'clinics', clinicId));
      if (!clinicSnap.exists()) {
        console.error('Clinic not found');
        setLoading(false);
        return;
      }
      setClinic({ id: clinicSnap.id, ...clinicSnap.data() });

      // 2. Fetch appointments (no date index needed, client-side filter)
      const q = query(
        collection(db, 'appointments'),
        where('clinic_id', '==', clinicId)
      );
      const apptsSnap = await getDocs(q);
      const appts = apptsSnap.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      setAppointments(appts);

      computeMetrics(appts);
    } catch (err) {
      console.error('Failed to load clinic analytics:', err);
    } finally {
      setLoading(false);
    }
  };

  const computeMetrics = (data: any[]) => {
    const total = data.length;
    const completed = data.filter(a => a.status === 'COMPLETED');
    const completedCount = completed.length;

    // Total Revenue
    const revenue = completed.reduce((sum, a) => sum + (a.fees || 0), 0);

    // Avg Wait Time (COMPLETED visits)
    let totalWaitTime = 0;
    let timedCompletedCount = 0;
    completed.forEach(a => {
      if (a.completed_at && a.queued_at) {
        const compTime = a.completed_at.seconds || new Date(a.completed_at).getTime() / 1000;
        const qTime = a.queued_at.seconds || new Date(a.queued_at).getTime() / 1000;
        const waitMin = (compTime - qTime) / 60;
        if (waitMin > 0 && waitMin < 240) { // Sanitization
          totalWaitTime += waitMin;
          timedCompletedCount++;
        }
      }
    });
    const avgWait = timedCompletedCount > 0 ? Math.round(totalWaitTime / timedCompletedCount) : 0;

    // No show rate
    const noShows = data.filter(a => a.status === 'NO_SHOW').length;
    const noShowRate = total > 0 ? Math.round((noShows / total) * 100) : 0;

    setMetrics({
      totalVisits: total,
      completedVisits: completedCount,
      totalRevenue: revenue,
      avgWaitTime: avgWait,
      noShowRate,
      growthRate: total > 5 ? 12 : 0
    });

    // ── 1. Daily Volume (Last 7 Days) ──
    const last7Days: { [key: string]: number } = {};
    for (let i = 6; i >= 0; i--) {
      const d = new Date();
      d.setDate(d.getDate() - i);
      const dateStr = d.toISOString().split('T')[0];
      last7Days[dateStr] = 0;
    }

    data.forEach(a => {
      // Find date_string or fallback to created_at
      let dStr = a.date_string;
      if (!dStr && a.created_at) {
        const dObj = a.created_at.toDate ? a.created_at.toDate() : new Date(a.created_at);
        dStr = dObj.toISOString().split('T')[0];
      }
      if (dStr && last7Days[dStr] !== undefined) {
        last7Days[dStr]++;
      }
    });

    const dailyData = Object.entries(last7Days).map(([date, count]) => {
      const dateObj = new Date(date);
      const formattedDay = dateObj.toLocaleDateString('en-US', { weekday: 'short', day: 'numeric' });
      return { day: formattedDay, count };
    });
    setDailyVolume(dailyData);

    // ── 2. Status Breakdown ──
    const statuses = {
      COMPLETED: { count: 0, color: '#10b981' },
      WAITING: { count: 0, color: '#007BFF' },
      NO_SHOW: { count: 0, color: '#f59e0b' },
      CANCELLED: { count: 0, color: '#ef4444' },
    };
    data.forEach(a => {
      const s = a.status as keyof typeof statuses;
      if (statuses[s]) {
        statuses[s].count++;
      }
    });
    const breakdown = Object.entries(statuses).map(([label, info]) => ({
      label,
      count: info.count,
      color: info.color
    })).filter(item => item.count > 0);
    setStatusBreakdown(breakdown);

    // ── 3. Peak Hours ──
    const hourlyDistribution = {
      'Morning (8-12)': 0,
      'Noon (12-16)': 0,
      'Evening (16-20)': 0,
      'Night (20-24)': 0
    };
    data.forEach(a => {
      let hour = 10; // Default
      if (a.created_at) {
        const dateObj = a.created_at.toDate ? a.created_at.toDate() : new Date(a.created_at);
        hour = dateObj.getHours();
      }
      if (hour >= 8 && hour < 12) hourlyDistribution['Morning (8-12)']++;
      else if (hour >= 12 && hour < 16) hourlyDistribution['Noon (12-16)']++;
      else if (hour >= 16 && hour < 20) hourlyDistribution['Evening (16-20)']++;
      else if (hour >= 20 && hour < 24) hourlyDistribution['Night (20-24)']++;
    });
    const maxHourCount = Math.max(...Object.values(hourlyDistribution), 1);
    const hourlyData = Object.entries(hourlyDistribution).map(([range, count]) => ({
      range,
      count,
      pct: Math.round((count / maxHourCount) * 100)
    }));
    setHourlyPeak(hourlyData);

    // ── 4. Top Disease Complaints ──
    const diseaseFrequencies: { [key: string]: number } = {};
    data.forEach(a => {
      const rawDis = a.disease || 'General Checkup';
      const cleanDis = rawDis.trim().toLowerCase().replace(/^\w/, (c: string) => c.toUpperCase());
      diseaseFrequencies[cleanDis] = (diseaseFrequencies[cleanDis] || 0) + 1;
    });
    const sortedDiseases = Object.entries(diseaseFrequencies)
      .map(([disease, count]) => ({ disease, count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 5);
    setTopDiseases(sortedDiseases);
  };

  if (loading || !authenticated) {
    return (
      <div style={{ display: 'grid', placeItems: 'center', minHeight: '100vh', background: '#f8fafc' }}>
        <div style={{ textAlign: 'center' }}>
          <Loader2 size={40} className="animate-spin" style={{ color: '#007BFF', margin: '0 auto 1rem' }} />
          <p style={{ color: '#5a6a7e', fontWeight: 500 }}>Compiling Analytics Workspace…</p>
        </div>
      </div>
    );
  }

  const maxDailyCount = Math.max(...dailyVolume.map(d => d.count), 1);

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
              <h1 style={{ fontSize: '1.45rem', fontWeight: 900, margin: 0 }}>{clinic?.name}</h1>
              <p style={{ margin: 0, fontSize: '0.8rem', color: '#5a6a7e' }}>
                Operational Insights &amp; Analytics dashboard
              </p>
            </div>
          </div>
          
          <div style={{ background: 'white', border: '1px solid #eef0f3', padding: '0.5rem 0.75rem', borderRadius: 10, fontSize: '0.8rem', color: '#5a6a7e', fontWeight: 500 }}>
            Active Doctor: <strong style={{ color: '#1a2332' }}>Dr. {clinic?.doctor_name}</strong>
          </div>
        </div>

        {/* ── METRICS STRIP ── */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '1rem', marginBottom: '2rem' }}>
          {[
            { label: 'Total Registrations', value: metrics.totalVisits, icon: <Users size={20} color="#007BFF" />, desc: 'All booked tokens' },
            { label: 'Revenue Generated', value: `₹${metrics.totalRevenue.toLocaleString()}`, icon: <IndianRupee size={20} color="#10b981" />, desc: 'From completed visits' },
            { label: 'Avg Waiting Duration', value: `${metrics.avgWaitTime} Mins`, icon: <Clock size={20} color="#6366f1" />, desc: 'Queue delay per patient' },
            { label: 'No-Show / Missed', value: `${metrics.noShowRate}%`, icon: <AlertCircle size={20} color="#f59e0b" />, desc: 'Token skip frequency' }
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

        {/* ── CHARTS ROW ── */}
        <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: '1.5rem', marginBottom: '2rem', flexWrap: 'wrap' }}>
          
          {/* Daily Patient Volume (SVG Chart) */}
          <div style={{ background: 'white', padding: '1.5rem', borderRadius: 20, border: '1px solid #eef0f3', boxShadow: '0 4px 12px rgba(0,0,0,0.02)' }}>
            <h2 style={{ fontSize: '0.98rem', fontWeight: 800, margin: '0 0 1.5rem 0', display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
              <TrendingUp size={16} color="#007BFF" /> 7-Day Patient Load Volume
            </h2>
            
            <div style={{ height: 200, display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between', padding: '0 0.5rem', gap: '1rem' }}>
              {dailyVolume.map((d, i) => {
                const heightPct = (d.count / maxDailyCount) * 80 + 10; // min 10% for styling
                return (
                  <div key={i} style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', height: '100%', justifyContent: 'flex-end' }}>
                    <div style={{ fontSize: '0.72rem', fontWeight: 700, color: '#007BFF', marginBottom: '0.35rem' }}>{d.count}</div>
                    
                    {/* Vertical Bar */}
                    <div style={{
                      width: '100%', maxWidth: 36, height: `${heightPct}%`,
                      background: 'linear-gradient(to top, #007BFF, #6366f1)',
                      borderRadius: '8px 8px 0 0', position: 'relative', overflow: 'hidden',
                      transition: 'height 0.4s ease'
                    }}>
                      <div style={{ position: 'absolute', top: 0, left: 0, width: '100%', height: '100%', background: 'linear-gradient(to top, rgba(255,255,255,0), rgba(255,255,255,0.15))' }} />
                    </div>

                    <div style={{ fontSize: '0.65rem', color: '#64748b', marginTop: '0.5rem', textAlign: 'center', whiteSpace: 'nowrap' }}>{d.day}</div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Consultation Ratios (SVG Donut Breakdown) */}
          <div style={{ background: 'white', padding: '1.5rem', borderRadius: 20, border: '1px solid #eef0f3', boxShadow: '0 4px 12px rgba(0,0,0,0.02)' }}>
            <h2 style={{ fontSize: '0.98rem', fontWeight: 800, margin: '0 0 1.5rem 0', display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
              <Activity size={16} color="#007BFF" /> Token Status Breakdown
            </h2>

            {statusBreakdown.length === 0 ? (
              <div style={{ textAlign: 'center', color: '#5a6a7e', padding: '2rem 0', fontSize: '0.85rem' }}>
                No transaction data logged yet.
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.8rem', marginTop: '0.5rem' }}>
                {statusBreakdown.map((item, idx) => {
                  const pct = Math.round((item.count / metrics.totalVisits) * 100);
                  return (
                    <div key={idx} style={{ display: 'flex', flexDirection: 'column', gap: '0.2rem' }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.75rem', fontWeight: 600 }}>
                        <span style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                          <span style={{ width: 8, height: 8, borderRadius: '50%', background: item.color }} />
                          {item.label}
                        </span>
                        <span style={{ color: '#5a6a7e' }}>{item.count} ({pct}%)</span>
                      </div>
                      
                      {/* Bar indicator */}
                      <div style={{ width: '100%', height: 6, background: '#f1f5f9', borderRadius: 3, overflow: 'hidden' }}>
                        <div style={{ width: `${pct}%`, height: '100%', background: item.color, borderRadius: 3 }} />
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>

        {/* ── BOTTOM GRID ── */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1.5rem' }}>
          
          {/* Peak Roster Hours */}
          <div style={{ background: 'white', padding: '1.5rem', borderRadius: 20, border: '1px solid #eef0f3', boxShadow: '0 4px 12px rgba(0,0,0,0.02)' }}>
            <h2 style={{ fontSize: '0.98rem', fontWeight: 800, margin: '0 0 1.25rem 0', display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
              <Clock size={16} color="#007BFF" /> Peak Hours Analysis
            </h2>
            
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.88rem' }}>
              {hourlyPeak.map((hour, idx) => (
                <div key={idx}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.75rem', marginBottom: '0.25rem' }}>
                    <span style={{ color: '#1a2332', fontWeight: 600 }}>{hour.range}</span>
                    <span style={{ color: '#5a6a7e' }}>{hour.count} patients</span>
                  </div>
                  <div style={{ width: '100%', height: 8, background: '#f8fafc', border: '1px solid #eef0f3', borderRadius: 4, overflow: 'hidden' }}>
                    <div style={{ width: `${hour.pct}%`, height: '100%', background: 'linear-gradient(to right, #6366f1, #007BFF)', borderRadius: 4 }} />
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Top Chief Complaints */}
          <div style={{ background: 'white', padding: '1.5rem', borderRadius: 20, border: '1px solid #eef0f3', boxShadow: '0 4px 12px rgba(0,0,0,0.02)' }}>
            <h2 style={{ fontSize: '0.98rem', fontWeight: 800, margin: '0 0 1.25rem 0', display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
              <BarChart2 size={16} color="#007BFF" /> Top Patient Concerns
            </h2>

            {topDiseases.length === 0 ? (
              <div style={{ textAlign: 'center', color: '#5a6a7e', padding: '3rem 0', fontSize: '0.85rem' }}>
                No symptoms/diagnoses documented.
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                {topDiseases.map((item, idx) => (
                  <div key={idx} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '0.6rem 0.9rem', background: '#f8fafc', border: '1px solid #eef0f3', borderRadius: 10 }}>
                    <span style={{ fontSize: '0.82rem', fontWeight: 600, color: '#1a2332' }}>{idx + 1}. {item.disease}</span>
                    <span style={{ fontSize: '0.72rem', background: '#007BFF', color: 'white', padding: '0.2rem 0.5rem', borderRadius: 20, fontWeight: 700 }}>
                      {item.count} {item.count === 1 ? 'visit' : 'visits'}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

      </div>
    </main>
  );
}
