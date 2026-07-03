import 'dotenv/config';
import express from 'express';
import path from 'path';
import { fileURLToPath } from 'url';
import { ensureAccessCodeFromEnv, testConnection } from './db.js';
import { postVerify, getSession, deleteSession, getHealth } from './auth.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const PORT = Number(process.env.PORT ?? 3001);
const app = express();

app.use(express.json({ limit: '2mb' }));

app.use((_req, res, next) => {
  res.setHeader('Access-Control-Allow-Origin', process.env.CORS_ORIGIN ?? '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,POST,DELETE,OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization, X-Access-Token');
  next();
});

app.options('/api/*', (_req, res) => res.sendStatus(204));

app.get('/api/health', getHealth);
app.post('/api/auth/verify', postVerify);
app.get('/api/auth/session', getSession);
app.delete('/api/auth/session', deleteSession);

const distPath = path.join(__dirname, '..', 'dist');
app.use(express.static(distPath));
app.get('*', (_req, res) => {
  res.sendFile(path.join(distPath, 'index.html'), err => {
    if (err) res.status(404).send('Frontend no compilado. Ejecute npm run build.');
  });
});

async function start() {
  const connected = await testConnection();
  if (!connected) {
    console.warn('[server] MySQL no disponible. Auth de módulos restringidos fallará hasta conectar la BD.');
  } else {
    await ensureAccessCodeFromEnv();
    console.log('[server] MySQL conectado');
  }

  app.listen(PORT, () => {
    console.log(`[server] Villa Campo API en http://localhost:${PORT}`);
  });
}

start();
