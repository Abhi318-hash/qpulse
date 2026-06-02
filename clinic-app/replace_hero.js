const fs = require('fs');
let content = fs.readFileSync('src/app/page.tsx', 'utf8');

const regex = /\{\/\* ── 3-in-1 Universal Search ── \*\/\}([\s\S]*?)\{\/\* ── ACTIVE TOKENS ─────────────────────────────── \*\/\}/;

const replacement = `{/* ── MOVIE-BOOKING STYLE DISCOVERY ── */}
          <div style={{ width: '100%', maxWidth: 800 }}>
            {/* Top Row: City + Search */}
            <div style={{ display: 'flex', gap: '0.5rem', marginBottom: '1rem', flexDirection: 'row' }}>
              <div style={{ position: 'relative', flex: '0 0 200px' }}>
                <select 
                  className="input-field"
                  style={{ paddingLeft: '2.5rem', background: '#fff', border: '1.5px solid #dee2e8', borderRadius: '12px', fontSize: '0.9rem', height: 48, appearance: 'none' }}
                  value={selectedCity} onChange={e => setSelectedCity(e.target.value)}
                >
                  <option value="">All Cities</option>
                  {allCities.map(c => <option key={c} value={c}>{c}</option>)}
                </select>
              </div>
              <div style={{ position: 'relative', flex: 1 }}>
                <input type="text" className="input-field"
                  placeholder="Search clinics, hospitals, doctors..."
                  style={{ paddingLeft: '2.5rem', background: '#fff', border: '1.5px solid #dee2e8', borderRadius: '12px', fontSize: '0.9rem', height: 48 }}
                  value={search} onChange={e => setSearch(e.target.value)}
                />
              </div>
            </div>
            
            {/* Category Pills (Genres) */}
            <div style={{ display: 'flex', gap: '0.5rem', overflowX: 'auto', paddingBottom: '0.5rem', scrollbarWidth: 'none' }} className="hide-scrollbar">
              {['All', 'General Physician', 'Dentist', 'Cardiologist', 'Pediatrician', 'Orthopedics', 'Dermatologist'].map(cat => (
                <button
                  key={cat}
                  onClick={() => setSelectedCategory(cat)}
                  style={{
                    padding: '0.4rem 1rem', borderRadius: '20px', fontSize: '0.8rem', fontWeight: 600, whiteSpace: 'nowrap',
                    background: selectedCategory === cat ? '#007BFF' : 'rgba(0,0,0,0.05)',
                    color: selectedCategory === cat ? '#fff' : '#5a6a7e',
                    border: \`1px solid \${selectedCategory === cat ? '#007BFF' : 'rgba(0,0,0,0.05)'}\`,
                    cursor: 'pointer', transition: 'all 0.2s'
                  }}
                >
                  {cat}
                </button>
              ))}
            </div>
          </div>
        </div>
      </section>

      <div style={{ maxWidth: 1100, margin: '0 auto', padding: '0 2rem 4rem' }}>

        {/* ── RECENTLY VISITED / FAVORITES ── */}
        {currentUser && myHistory.length > 0 && (
          <section style={{ marginBottom: '3rem' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem', marginBottom: '1.25rem' }}>
              <div style={{ padding: '0.4rem', background: 'rgba(251,191,36,0.1)', borderRadius: '8px' }}>
                <span style={{ fontSize: '18px' }}>★</span>
              </div>
              <h2 style={{ fontSize: '1.05rem', fontWeight: 700, color: '#1a2332', margin: 0 }}>Recently Visited Clinics</h2>
            </div>
            <div style={{ display: 'flex', gap: '1rem', overflowX: 'auto', paddingBottom: '1rem', scrollbarWidth: 'none' }} className="hide-scrollbar">
              {Array.from(new Set(myHistory.map(h => h.clinic_id))).map(cid => {
                const clinic = clinics.find(c => c.id === cid);
                if (!clinic) return null;
                return (
                  <div key={cid} onClick={() => router.push(\`#clinic-\${cid}\`)} style={{ cursor: 'pointer', minWidth: 260, background: '#fff', borderRadius: 12, padding: '1.25rem', border: '1px solid #eef0f3', boxShadow: '0 2px 8px rgba(0,0,0,0.04)' }}>
                    <h3 style={{ margin: '0 0 0.2rem 0', fontSize: '0.95rem', fontWeight: 800, color: '#1a2332' }}>{clinic.name}</h3>
                    <p style={{ margin: 0, fontSize: '0.78rem', color: '#5a6a7e' }}>Dr. {clinic.doctor_name}</p>
                    <div style={{ marginTop: '0.75rem', display: 'flex', gap: '0.5rem' }}>
                      <span style={{ fontSize: '0.7rem', padding: '0.2rem 0.5rem', background: '#f8fafc', borderRadius: 4, color: '#5a6a7e' }}>{clinic.specialization}</span>
                    </div>
                  </div>
                );
              })}
            </div>
          </section>
        )}
        
        {/* ── ACTIVE TOKENS ─────────────────────────────── */}`;

content = content.replace(regex, replacement);
fs.writeFileSync('src/app/page.tsx', content);
