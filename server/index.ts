import 'dotenv/config';
import express from 'express';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { ensureAccessCodeFromEnv, testConnection } from './db.js';
import { postVerify, getSession, deleteSession, getHealth, requireAuth } from './auth.js';
import { getEstado, putEstado, getConfig, putConfig } from './data.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const PORT = Number(process.env.PORT ?? 3000);

/** Frontend estático: misma carpeta que server.js (dist/) o ./dist desde la raíz. */
function resolveDistPath(): string {
  const candidates = [
    __dirname,
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

app.set('trust proxy', 1);
app.use(express.json({ limit: '50mb' }));

app.use((req, res, next) => {
  res.setHeader('Access-Control-Allow-Origin', process.env.CORS_ORIGIN ?? '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,POST,DELETE,OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization, X-Access-Token');
  if (req.method === 'OPTIONS' && req.path.startsWith('/api')) {
    return res.sendStatus(204);
  }
  next();
});

app.get('/api/health', getHealth);
app.post('/api/auth/verify', postVerify);
app.get('/api/auth/session', getSession);
app.delete('/api/auth/session', deleteSession);

/** Lectura pública (dashboards en cualquier dispositivo). Escritura con sesión admin. */
app.get('/api/data/estado', getEstado);
app.put('/api/data/estado', requireAuth, putEstado);
app.get('/api/data/config', getConfig);
app.put('/api/data/config', requireAuth, putConfig);

/** Cualquier otra ruta /api debe responder JSON, nunca HTML. */
app.use('/api', (_req, res) => {
  res.status(404).json({ ok: false, error: 'Ruta API no encontrada.' });
});

app.use(express.static(distPath, { index: false, fallthrough: true }));

app.get('*', (req, res) => {
  if (req.path.startsWith('/api')) {
    return res.status(404).json({ ok: false, error: 'Ruta API no encontrada.' });
  }
  const indexFile = path.join(distPath, 'index.html');
  if (!fs.existsSync(indexFile)) {
    return res.status(503).send(`Frontend no encontrado en ${distPath}. Ejecute npm run build.`);
  }
  res.sendFile(indexFile);
});

async function start() {
  console.log('[server] cwd:', process.cwd());
  console.log('[server] __dirname:', __dirname);
  console.log('[server] dist:', distPath);
  console.log('[server] index.html:', fs.existsSync(path.join(distPath, 'index.html')));

  const hasAccessCode = Boolean(process.env.ACCESS_CODE?.trim());
  console.log('[server] ACCESS_CODE configurado:', hasAccessCode);

  const connected = await testConnection();
  if (!connected) {
    console.warn('[server] MySQL no disponible. El acceso admin usa ACCESS_CODE (sin MySQL).');
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
