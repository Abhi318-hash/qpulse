const fs = require('fs');
let content = fs.readFileSync('src/app/page.tsx', 'utf8');

const targetIndex = content.indexOf('{/* ── BOOKING MODAL');
if (targetIndex !== -1) {
  const replacement = `
      </div>
      
      <footer style={{ marginTop: '4rem', paddingTop: '2rem', borderTop: '1px solid #eef0f3', display: 'flex', justifyContent: 'center', alignItems: 'center', gap: '1.25rem', flexWrap: 'wrap' }}>
        <Link href="/about" style={{ fontSize: '0.85rem', color: '#5a6a7e', textDecoration: 'none', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '0.3rem' }}>
          <Building size={15} /> For Providers
        </Link>
        <span style={{ width: 4, height: 4, borderRadius: '50%', background: '#dee2e8' }} />
        <Link href="/login" style={{ fontSize: '0.85rem', color: '#5a6a7e', textDecoration: 'none', fontWeight: 600 }}>
          Org Admin
        </Link>
        <span style={{ width: 4, height: 4, borderRadius: '50%', background: '#dee2e8' }} />
        <Link href="/clinic/login" style={{ fontSize: '0.85rem', color: '#5a6a7e', textDecoration: 'none', fontWeight: 600 }}>
          Staff Login
        </Link>
        <span style={{ width: 4, height: 4, borderRadius: '50%', background: '#dee2e8' }} />
        <Link href="/onboard" style={{ fontSize: '0.85rem', color: '#5a6a7e', textDecoration: 'none', fontWeight: 600 }}>
          Register Clinic
        </Link>
        <div style={{ flexBasis: '100%', height: 0 }}></div>
        <span style={{ color: '#94a3b8', fontSize: '0.8rem', display: 'flex', alignItems: 'center', gap: '0.4rem', marginTop: '0.5rem' }}>
          Powered by Q-PULSE Network
        </span>
      </footer>

      `;
  
  // Insert the missing div and footer before BOOKING MODAL
  content = content.substring(0, targetIndex) + replacement + content.substring(targetIndex);
  fs.writeFileSync('src/app/page.tsx', content);
  console.log('Fixed');
}
