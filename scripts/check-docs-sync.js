import fs from 'fs';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const root = resolve(__dirname, '..');

const ru = fs.readFileSync(resolve(root, 'docs/README.md'), 'utf8');
const en = fs.readFileSync(resolve(root, 'docs/README_EN.md'), 'utf8');

let ok = true;
function check(name, ruMatch, enMatch) {
  if (ruMatch !== enMatch) {
    console.error(`❌ docs sync ${name}: RU=${ruMatch} EN=${enMatch}`);
    ok = false;
  } else {
    console.log(`✅ ${name}: ${ruMatch}`);
  }
}

// Feature tables should have 4 h4 headers each
const ruH4 = (ru.match(/<h4>/g) || []).length;
const enH4 = (en.match(/<h4>/g) || []).length;
check('feature h4 count', ruH4, enH4);

// Architecture anchors must exist in both
const hasArchRu = ru.includes('## 🧱 Архитектура') || ru.includes('## 🧱 Architecture');
const hasArchEn = en.includes('## 🧱 Architecture');
if (!hasArchRu || !hasArchEn) {
  console.error('❌ architecture section missing');
  ok = false;
} else console.log('✅ architecture section present');

// CODE_DOCUMENTATION link must exist
check('CODE_DOCUMENTATION link', ru.includes('CODE_DOCUMENTATION.md'), en.includes('CODE_DOCUMENTATION.md'));

// SYNC-NOTE must be present
check('SYNC-NOTE', ru.includes('SYNC-NOTE'), en.includes('SYNC-NOTE'));

if (!ok) {
  console.error('\nDocs are out of sync — update both README.md and README_EN.md together.');
  process.exit(1);
}
console.log('\nDocs sync OK');
