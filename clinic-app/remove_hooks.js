const fs = require('fs');
let content = fs.readFileSync('src/app/page.tsx', 'utf8');

const target1 = content.indexOf('// Hospital search — fetch on demand');
const target2 = content.indexOf('}, [doctorSearch, searchTab, clinics]);');

if (target1 !== -1 && target2 !== -1) {
  content = content.substring(0, target1) + content.substring(target2 + 39);
  fs.writeFileSync('src/app/page.tsx', content);
  console.log('Removed successfully.');
} else {
  console.log('Targets not found.');
}
