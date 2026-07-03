import fs from 'fs';
import path from 'path';

const root = process.cwd();
const distServer = path.join(root, 'dist', 'server.js');
const rootServer = path.join(root, 'server.js');
const indexHtml = path.join(root, 'dist', 'index.html');

if (!fs.existsSync(indexHtml)) {
  console.error('[postbuild] Falta dist/index.html');
  process.exit(1);
}

if (!fs.existsSync(distServer)) {
  console.error('[postbuild] Falta dist/server.js');
  process.exit(1);
}

/* Hostinger puede usar entry en raíz o dentro de dist/ */
fs.copyFileSync(distServer, rootServer);

console.log('[postbuild] OK — dist/index.html + dist/server.js + server.js');
