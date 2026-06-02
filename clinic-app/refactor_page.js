const fs = require('fs');
const path = require('path');

const pagePath = path.join(__dirname, 'src', 'app', 'page.tsx');
let content = fs.readFileSync(pagePath, 'utf8');

const newDisplayLogic = `
        {/* ── THEATERS (CLINICS) & SHOWTIMES (DOCTORS) ── */}
        <section style={{ marginBottom: '4rem' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem', marginBottom: '1.5rem' }}>
            <div style={{ padding: '0.4rem', background: 'rgba(99,102,241,0.1)', borderRadius: '8px' }}>
              <Building size={18} color="#6366f1" />
            </div>
            <h2 style={{ fontSize: '1.1rem', fontWeight: 800, color: '#1a2332', margin: 0 }}>Available Clinics in {selectedCity || 'Your Area'}</h2>
          </div>
          
          <div style={{ display: 'flex', flexDirection: 'column', gap: '2rem' }}>
            {(() => {
              // 1. Filter logic
              const term = search.toLowerCase();
              let filtered = clinics.filter(c => {
                const matchSearch = term === '' || 
                  c.name.toLowerCase().includes(term) || 
                  c.doctor_name?.toLowerCase().includes(term) ||
                  (c.location && c.location.toLowerCase().includes(term)) ||
                  (c.specialization && c.specialization.toLowerCase().includes(term));
                
                const matchCategory = selectedCategory === 'All' || c.specialization === selectedCategory;
                
                const matchCity = selectedCity === '' || 
                  c.city === selectedCity || 
                  (c.location && c.location.toLowerCase().includes(selectedCity.toLowerCase()));
                  
                return matchSearch && matchCategory && matchCity;
              });

              // Rural Fallback
              let isFallback = false;
              if (filtered.length === 0 && selectedCategory !== 'All' && selectedCity !== '') {
                filtered = clinics.filter(c => {
                  const matchCity = c.city === selectedCity || (c.location && c.location.toLowerCase().includes(selectedCity.toLowerCase()));
                  const matchSearch = term === '' || c.name.toLowerCase().includes(term) || c.doctor_name?.toLowerCase().includes(term);
                  return matchCity && matchSearch;
                });
                isFallback = true;
              }

              if (filtered.length === 0) {
                return (
                  <div style={{ textAlign: 'center', padding: '4rem', background: '#f8fafc', borderRadius: 16, border: '1px dashed #dee2e8' }}>
                    <p style={{ color: '#5a6a7e', margin: 0, fontSize: '0.9rem' }}>No clinics found matching your criteria.</p>
                  </div>
                );
              }

              return (
                <>
                  {isFallback && (
                    <div style={{ padding: '1rem', background: 'rgba(251,191,36,0.1)', border: '1px solid rgba(251,191,36,0.4)', borderRadius: 12, color: '#b45309', fontSize: '0.85rem' }}>
                      <strong style={{ display: 'block', marginBottom: '0.2rem' }}>No {selectedCategory} found in {selectedCity}.</strong>
                      Here are other available clinics in your area:
                    </div>
                  )}
                  {filtered.map(clinic => (
                    <div id={\`clinic-\${clinic.id}\`} key={clinic.id} style={{ background: '#fff', borderRadius: 16, border: '1px solid #eef0f3', boxShadow: '0 4px 20px rgba(0,0,0,0.03)', overflow: 'hidden' }}>
                      {/* Theater Header */}
                      <div style={{ padding: '1.25rem 1.5rem', borderBottom: '1px solid #eef0f3', background: '#f8fafc', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <div>
                          <h3 style={{ margin: '0 0 0.25rem 0', fontSize: '1.1rem', fontWeight: 800, color: '#1a2332' }}>{clinic.name}</h3>
                          <p style={{ margin: 0, fontSize: '0.8rem', color: '#5a6a7e', display: 'flex', alignItems: 'center', gap: '0.3rem' }}>
                            <MapPin size={12} /> {clinic.city ? \`\${clinic.city} • \` : ''}{clinic.location}
                          </p>
                        </div>
                        {clinic.is_open ? (
                          <span style={{ padding: '0.25rem 0.75rem', background: 'rgba(40,167,69,0.1)', color: '#28a745', borderRadius: 20, fontSize: '0.75rem', fontWeight: 700 }}>Open Now</span>
                        ) : (
                          <span style={{ padding: '0.25rem 0.75rem', background: '#f1f5f9', color: '#94a3b8', borderRadius: 20, fontSize: '0.75rem', fontWeight: 700 }}>Closed</span>
                        )}
                      </div>
                      
                      {/* Showtimes (Doctors) */}
                      <div style={{ padding: '1.5rem', overflowX: 'auto', display: 'flex', gap: '1rem' }} className="hide-scrollbar">
                        <div style={{ minWidth: 280, border: '1px solid #eef0f3', borderRadius: 12, padding: '1rem', background: '#fff', position: 'relative' }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '1rem' }}>
                            <div style={{ width: 44, height: 44, borderRadius: '50%', background: 'linear-gradient(135deg,#e8f4fd,#cce4f8)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                              <span style={{ fontWeight: 700, fontSize: '0.9rem', color: '#007BFF' }}>{clinic.doctor_name ? clinic.doctor_name.charAt(0) : 'D'}</span>
                            </div>
                            <div>
                              <h4 style={{ margin: '0 0 0.15rem 0', fontSize: '0.95rem', fontWeight: 700, color: '#1a2332' }}>Dr. {clinic.doctor_name}</h4>
                              <p style={{ margin: 0, fontSize: '0.75rem', color: '#5a6a7e' }}>{clinic.specialization}</p>
                            </div>
                          </div>
                          
                          <div style={{ display: 'flex', justifyContent: 'space-between', background: clinic.is_open ? '#f0f7ff' : '#f8fafc', padding: '0.75rem', borderRadius: 8, marginBottom: '1rem' }}>
                            <div>
                              <span style={{ fontSize: '0.65rem', color: '#5a6a7e', textTransform: 'uppercase', display: 'block' }}>Serving</span>
                              <strong style={{ color: clinic.is_open ? '#28a745' : '#94a3b8' }}>#{clinic.currently_serving_token || '--'}</strong>
                            </div>
                            <div style={{ textAlign: 'right' }}>
                              <span style={{ fontSize: '0.65rem', color: '#5a6a7e', textTransform: 'uppercase', display: 'block' }}>Waiting</span>
                              <strong style={{ color: clinic.is_open ? '#007BFF' : '#94a3b8' }}>{clinic.patient_count || 0}</strong>
                            </div>
                          </div>
                          
                          <button onClick={() => setBookingClinic(clinic)} disabled={!clinic.is_open || clinic.booking_closed}
                            className="btn btn-primary"
                            style={{ width: '100%', padding: '0.6rem', fontSize: '0.85rem', fontWeight: 700, opacity: (!clinic.is_open || clinic.booking_closed) ? 0.5 : 1 }}>
                            {clinic.is_open ? (clinic.booking_closed ? 'Booking Closed' : 'Book Token') : 'Closed'}
                          </button>
                        </div>
                      </div>
                    </div>
                  ))}
                </>
              );
            })()}
          </div>
        </section>
`;

const replaceStart = content.indexOf('{/* Hospital Search Results */}');
const modStartIndex = content.indexOf('{/* ── BOOKING MODAL');

if (replaceStart !== -1 && modStartIndex !== -1) {
  content = content.substring(0, replaceStart) + newDisplayLogic + '\n' + content.substring(modStartIndex);
  fs.writeFileSync(pagePath, content);
  console.log("Replaced old lists with Theaters/Showtimes successfully.");
} else {
  console.log("Could not find boundaries.");
}
