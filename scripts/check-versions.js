import fs from 'fs';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const root = resolve(__dirname, '..');

function readJson(path) {
  return JSON.parse(fs.readFileSync(path, 'utf8'));
}

const pkg = readJson(resolve(root, 'package.json'));
const manifest = readJson(resolve(root, 'public/manifest.json'));

let ok = true;

if (pkg.version !== manifest.version) {
  console.error(`❌ Version mismatch: package.json ${pkg.version} vs public/manifest.json ${manifest.version}`);
  ok = false;
} else {
  console.log(`✅ Version sync: ${pkg.version}`);
}

// Also check dist/manifest if exists (do not fail if dist not built locally)
const distManifestPath = resolve(root, 'dist/manifest.json');
if (fs.existsSync(distManifestPath)) {
  const distManifest = readJson(distManifestPath);
  if (distManifest.version !== pkg.version) {
    console.warn(`⚠️  dist/manifest.json ${distManifest.version} differs from package.json ${pkg.version} — run npm run build`);
    // not fatal locally, but CI will rebuild and check diff
  } else {
    console.log(`✅ dist/manifest.json sync: ${distManifest.version}`);
  }
}

if (!ok) process.exit(1);
