import 'dotenv/config';
import express from 'express';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { ensureAccessCodeFromEnv, testConnection } from './db.js';
import { postVerify, getSession, deleteSession, getHealth } from './auth.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const PORT = Number(process.env.PORT ?? 3000);

function resolveDistPath(): string {
  const candidates = [
    path.join(process.cwd(), 'dist'),
    path.join(__dirname, 'dist'),
  ];
  for (const candidate of candidates) {
    if (fs.existsSync(path.join(candidate, 'index.html'))) {
      return candidate;
    }
  }
  return path.join(process.cwd(), 'dist');
}

const distPath = resolveDistPath();
const app = express();

app.use(express.json({ limit: '2mb' }));

app.use((_req, res, next) => {
  res.setHeader('Access-Control-Allow-Origin', process.env.CORS_ORIGIN ?? '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,POST,DELETE,OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization, X-Access-Token');
  if (_req.method === 'OPTIONS' && _req.path.startsWith('/api')) {
    return res.sendStatus(204);
  }
  next();
});

app.get('/api/health', getHealth);
app.post('/api/auth/verify', postVerify);
app.get('/api/auth/session', getSession);
app.delete('/api/auth/session', deleteSession);

app.use(express.static(distPath, { index: false }));

app.use((req, res, next) => {
  if (req.method !== 'GET' || req.path.startsWith('/api')) {
    return next();
  }
  res.sendFile(path.join(distPath, 'index.html'), err => {
    if (err) {
      res.status(503).send(
        `Frontend no encontrado en ${distPath}. Ejecute npm run build.`
      );
    }
  });
});

async function start() {
  console.log('[server] cwd:', process.cwd());
  console.log('[server] dist:', distPath);
  console.log('[server] dist existe:', fs.existsSync(path.join(distPath, 'index.html')));

  const connected = await testConnection();
  if (!connected) {
    console.warn('[server] MySQL no disponible. Auth restringido fallará hasta conectar la BD.');
  } else {
    await ensureAccessCodeFromEnv();
    console.log('[server] MySQL conectado');
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`[server] Villa Campo escuchando en 0.0.0.0:${PORT}`);
  });
}

start().catch(err => {
  console.error('[server] Error fatal al iniciar:', err);
  process.exit(1);
});

process.on('unhandledRejection', err => {
  console.error('[server] unhandledRejection:', err);
});

