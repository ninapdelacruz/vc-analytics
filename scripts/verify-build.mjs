import fs from 'fs';
import path from 'path';

const required = ['dist/index.html', 'server.js'];
const missing = required.filter(f => !fs.existsSync(path.join(process.cwd(), f)));

if (missing.length > 0) {
  console.error('[postbuild] Faltan artefactos de build:', missing.join(', '));
  process.exit(1);
}

console.log('[postbuild] OK — dist/index.html + server.js (entry Hostinger)');
