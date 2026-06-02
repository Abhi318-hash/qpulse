const fs = require('fs');

// 1. Update globals.css
let css = fs.readFileSync('src/app/globals.css', 'utf8');
const hideTranslateCSS = `
/* Hide Google Translate Banner and tooltips */
.goog-te-banner-frame.skiptranslate {
    display: none !important;
}
body {
    top: 0px !important;
}
.goog-tooltip {
    display: none !important;
}
.goog-tooltip:hover {
    display: none !important;
}
.goog-text-highlight {
    background-color: transparent !important;
    border: none !important; 
    box-shadow: none !important;
}
#goog-gt-tt {
    display: none !important;
}
`;
if (!css.includes('.goog-te-banner-frame.skiptranslate')) {
  fs.writeFileSync('src/app/globals.css', css + hideTranslateCSS);
  console.log('Updated globals.css');
}

// 2. Update page.tsx
let page = fs.readFileSync('src/app/page.tsx', 'utf8');

// Find the start of the RIGHT: Profile Dropdown
const rightDivStart = page.indexOf('{/* RIGHT: Profile Dropdown */}');
const dropdownMenuStart = page.indexOf('{/* Theme Toggle inside Dropdown */}');

if (rightDivStart !== -1 && dropdownMenuStart !== -1) {
  // We want to insert the "For Providers" link right inside the RIGHT: Profile Dropdown div, before the profile button.
  // We can just use a regex replace for that part.

  // First, remove the "For Providers" link from the dropdown menu.
  // The block looks like this:
  /*
                    <Link
                      href="/about"
                      onClick={() => setShowNavDropdown(false)}
                      style={{
                        ...
                      }}
                      ...
                    >
                      <Building size={16} /> For Providers
                    </Link>
  
                    <div
                      style={{
                        height: 1,
                        ...
                      }}
                    />
  */
  const forProvidersRegex = /<Link\s+href="\/about"\s+onClick=\{\(\) => setShowNavDropdown\(false\)\}[\s\S]*?<Building size=\{16\} \/> For Providers\s+<\/Link>\s*<div\s+style=\{\{\s*height: 1,\s*background: isDark[\s\S]*?margin: "0\.25rem 0",\s*\}\}\s*\/>/;
  
  page = page.replace(forProvidersRegex, '');

  // Second, insert it right before the Profile button
  const profileBtnRegex = /(<div\s+style=\{\{\s*display: "flex",\s*alignItems: "center",\s*gap: "0\.4rem",\s*position: "relative",\s*\}\}\s*>)\s*(<button\s+onClick=\{\(\) => setShowNavDropdown\(!showNavDropdown\)\})/;

  const newProvidersBtn = `
                <Link
                  href="/about"
                  style={{
                    ...iconBtn,
                    width: "auto",
                    padding: "0 0.75rem",
                    gap: "0.4rem",
                    color: navSub,
                    fontSize: "0.8rem",
                    fontWeight: 600,
                    textDecoration: "none",
                  }}
                  title="For Providers"
                  aria-label="For Providers"
                >
                  <Building size={16} />
                  {!isMobile && "For Providers"}
                </Link>
                `;

  page = page.replace(profileBtnRegex, `$1\n${newProvidersBtn}\n$2`);

  fs.writeFileSync('src/app/page.tsx', page);
  console.log('Updated page.tsx');
}
