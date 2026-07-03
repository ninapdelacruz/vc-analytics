/**
 * Punto de entrada para Hostinger.
 * Tras `npm run build`, carga el servidor compilado en dist/server.js
 */
import { existsSync } from 'node:fs';
import { join } from 'node:path';

const serverEntry = join(process.cwd(), 'dist', 'server.js');

if (!existsSync(serverEntry)) {
  console.error('[start] No se encontró dist/server.js');
  console.error('[start] cwd:', process.cwd());
  process.exit(1);
}

await import(serverEntry);
