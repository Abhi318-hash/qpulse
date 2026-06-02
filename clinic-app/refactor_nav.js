const fs = require('fs');
let content = fs.readFileSync('src/app/page.tsx', 'utf8');

// 1. Add showNavDropdown state
if (!content.includes('const [showNavDropdown, setShowNavDropdown] = useState(false);')) {
  content = content.replace('const [showSidebar, setShowSidebar] = useState(false);', 'const [showSidebar, setShowSidebar] = useState(false);\n  const [showNavDropdown, setShowNavDropdown] = useState(false);');
}

// 2. Replace the Right side of the Nav and the Left side (remove Back/Forward)
// We will replace the entire <nav> element up to </nav>

const navStart = content.indexOf('<nav');
const navEnd = content.indexOf('</nav>') + 6;

if (navStart !== -1 && navEnd !== -1) {
  const newNav = `<nav
            style={{
              background: navBg,
              backdropFilter: "blur(16px)",
              WebkitBackdropFilter: "blur(16px)",
              borderBottom: \`1px solid \${navBorder}\`,
              position: "sticky",
              top: 0,
              zIndex: 100,
              boxShadow: "0 1px 12px rgba(0,0,0,0.08)",
              transition: "background 0.3s, border-color 0.3s",
            }}
          >
            <div
              style={{
                width: "100%",
                padding: "0 1.25rem",
                height: 56,
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                gap: "0.5rem",
                boxSizing: "border-box",
              }}
            >
              {/* LEFT: Logo */}
              <div
                style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}
              >
                <a
                  href="https://qpluse.vercel.app/"
                  target="_blank"
                  rel="noopener noreferrer"
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: "0.45rem",
                    textDecoration: "none",
                    whiteSpace: "nowrap",
                  }}
                >
                  <Activity size={20} color="#007BFF" />
                  <span
                    style={{
                      fontWeight: 800,
                      fontSize: isMobile ? "0.95rem" : "1.1rem",
                      color: navText,
                      letterSpacing: "-0.5px",
                      transition: "color 0.3s",
                    }}
                  >
                    Q-PULSE
                  </span>
                  {!isMobile && (
                    <span
                      style={{
                        fontSize: "0.62rem",
                        padding: "2px 6px",
                        background: "rgba(0,123,255,0.1)",
                        color: "#007BFF",
                        borderRadius: "20px",
                        fontWeight: 700,
                        border: "1px solid rgba(0,123,255,0.2)",
                      }}
                    >
                      LIVE
                    </span>
                  )}
                </a>
              </div>
  
              {/* RIGHT: Profile Dropdown */}
              <div
                style={{ display: "flex", alignItems: "center", gap: "0.4rem", position: 'relative' }}
              >
                <button
                  onClick={() => setShowNavDropdown(!showNavDropdown)}
                  style={{
                    ...iconBtn,
                    padding: '0.4rem',
                    borderRadius: '50%',
                    background: currentUser ? "rgba(0,123,255,0.08)" : iconBtn.background,
                    border: currentUser ? "1px solid rgba(0,123,255,0.22)" : iconBtn.border,
                    color: currentUser ? "#007BFF" : navText,
                  }}
                  aria-label="Menu"
                >
                  <UserRound size={18} />
                </button>

                {/* Dropdown Menu */}
                {showNavDropdown && (
                  <div 
                    style={{ 
                      position: 'absolute', 
                      top: 'calc(100% + 8px)', 
                      right: 0, 
                      background: isDark ? '#1a2332' : '#ffffff',
                      border: \`1px solid \${isDark ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.1)'}\`,
                      borderRadius: '12px',
                      boxShadow: '0 4px 20px rgba(0,0,0,0.15)',
                      minWidth: '220px',
                      padding: '0.5rem',
                      display: 'flex',
                      flexDirection: 'column',
                      gap: '0.25rem',
                      zIndex: 1000,
                      animation: 'fadeIn 0.2s ease-out'
                    }}
                  >
                    {/* Theme Toggle inside Dropdown */}
                    <button
                      onClick={() => { toggleTheme(); setShowNavDropdown(false); }}
                      style={{
                        display: 'flex', alignItems: 'center', gap: '0.75rem', width: '100%', padding: '0.6rem 0.75rem',
                        background: 'transparent', border: 'none', cursor: 'pointer', borderRadius: '8px',
                        color: isDark ? '#e2e8f0' : '#1a2332', fontSize: '0.85rem', fontWeight: 500,
                        textAlign: 'left', transition: 'background 0.2s'
                      }}
                      onMouseOver={e => e.currentTarget.style.background = isDark ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.04)'}
                      onMouseOut={e => e.currentTarget.style.background = 'transparent'}
                    >
                      {isDark ? <Sun size={16} color="#fbbf24" /> : <Moon size={16} />}
                      {isDark ? 'Light Mode' : 'Dark Mode'}
                    </button>

                    {/* Language Selector container (we need to style it to blend in) */}
                    <div style={{ padding: '0.2rem 0.75rem', color: isDark ? '#e2e8f0' : '#1a2332' }}>
                      <LanguageSelector isMobile={false} />
                    </div>

                    <div style={{ height: 1, background: isDark ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.06)', margin: '0.25rem 0' }} />

                    <Link
                      href="/about"
                      onClick={() => setShowNavDropdown(false)}
                      style={{
                        display: 'flex', alignItems: 'center', gap: '0.75rem', width: '100%', padding: '0.6rem 0.75rem',
                        background: 'transparent', border: 'none', cursor: 'pointer', borderRadius: '8px',
                        color: isDark ? '#e2e8f0' : '#1a2332', fontSize: '0.85rem', fontWeight: 500,
                        textDecoration: 'none', transition: 'background 0.2s'
                      }}
                      onMouseOver={e => e.currentTarget.style.background = isDark ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.04)'}
                      onMouseOut={e => e.currentTarget.style.background = 'transparent'}
                    >
                      <Building size={16} /> For Providers
                    </Link>

                    <div style={{ height: 1, background: isDark ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.06)', margin: '0.25rem 0' }} />

                    {currentUser ? (
                      <>
                        <button
                          onClick={() => { router.push("/profile"); setShowNavDropdown(false); }}
                          style={{
                            display: 'flex', alignItems: 'center', gap: '0.75rem', width: '100%', padding: '0.6rem 0.75rem',
                            background: 'transparent', border: 'none', cursor: 'pointer', borderRadius: '8px',
                            color: isDark ? '#e2e8f0' : '#1a2332', fontSize: '0.85rem', fontWeight: 500,
                            textAlign: 'left', transition: 'background 0.2s'
                          }}
                          onMouseOver={e => e.currentTarget.style.background = isDark ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.04)'}
                          onMouseOut={e => e.currentTarget.style.background = 'transparent'}
                        >
                          <UserRound size={16} color="#007BFF" /> Profile
                        </button>
                        <button
                          onClick={() => { setShowSidebar(true); setShowNavDropdown(false); }}
                          style={{
                            display: 'flex', alignItems: 'center', gap: '0.75rem', width: '100%', padding: '0.6rem 0.75rem',
                            background: 'transparent', border: 'none', cursor: 'pointer', borderRadius: '8px',
                            color: isDark ? '#e2e8f0' : '#1a2332', fontSize: '0.85rem', fontWeight: 500,
                            textAlign: 'left', transition: 'background 0.2s'
                          }}
                          onMouseOver={e => e.currentTarget.style.background = isDark ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.04)'}
                          onMouseOut={e => e.currentTarget.style.background = 'transparent'}
                        >
                          <Settings size={16} color="#007BFF" /> Settings
                        </button>
                        <button
                          onClick={() => { signOut(auth); setShowNavDropdown(false); }}
                          style={{
                            display: 'flex', alignItems: 'center', gap: '0.75rem', width: '100%', padding: '0.6rem 0.75rem',
                            background: 'transparent', border: 'none', cursor: 'pointer', borderRadius: '8px',
                            color: '#dc3545', fontSize: '0.85rem', fontWeight: 500,
                            textAlign: 'left', transition: 'background 0.2s'
                          }}
                          onMouseOver={e => e.currentTarget.style.background = isDark ? 'rgba(220,53,69,0.1)' : 'rgba(220,53,69,0.08)'}
                          onMouseOut={e => e.currentTarget.style.background = 'transparent'}
                        >
                          <LogOut size={16} /> Log Out
                        </button>
                      </>
                    ) : (
                      <button
                        onClick={() => { router.push("/login"); setShowNavDropdown(false); }}
                        style={{
                          display: 'flex', alignItems: 'center', gap: '0.75rem', width: '100%', padding: '0.6rem 0.75rem',
                          background: '#007BFF', border: 'none', cursor: 'pointer', borderRadius: '8px',
                          color: '#fff', fontSize: '0.85rem', fontWeight: 600,
                          textAlign: 'center', justifyContent: 'center'
                        }}
                      >
                        Login / Sign Up
                      </button>
                    )}
                  </div>
                )}

              </div>
            </div>
          </nav>`;
  
  content = content.substring(0, navStart) + newNav + content.substring(navEnd);
  fs.writeFileSync('src/app/page.tsx', content);
  console.log('Nav updated successfully.');
} else {
  console.log('Could not find nav bounds.');
}
