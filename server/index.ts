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

/**
 * Frontend de producción (Vite).
 * Nunca usar el index.html de la raíz del repo (apunta a /src/main.tsx y deja la app en blanco).
 * Debe existir carpeta assets/ generada por `vite build`.
 */
function isProductionDist(dir: string): boolean {
  const indexFile = path.join(dir, 'index.html');
  const assetsDir = path.join(dir, 'assets');
  if (!fs.existsSync(indexFile) || !fs.existsSync(assetsDir)) return false;
  try {
    const html = fs.readFileSync(indexFile, 'utf8');
    if (html.includes('/src/main.tsx') || html.includes('src/main.tsx')) return false;
    return html.includes('/assets/');
  } catch {
    return false;
  }
}

function resolveDistPath(): string {
  const candidates = [
    path.join(process.cwd(), 'dist'),
    path.join(__dirname, 'dist'),
    __dirname, // solo si server.js vive dentro de dist/
  ];
  for (const candidate of candidates) {
    if (isProductionDist(candidate)) return candidate;
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

app.use(express.static(distPath, {
  index: false,
  fallthrough: true,
  setHeaders(res, filePath) {
    if (filePath.endsWith('.js')) {
      res.setHeader('Content-Type', 'application/javascript; charset=utf-8');
    } else if (filePath.endsWith('.css')) {
      res.setHeader('Content-Type', 'text/css; charset=utf-8');
    } else if (filePath.endsWith('.html')) {
      res.setHeader('Content-Type', 'text/html; charset=utf-8');
    }
  },
}));

app.get('*', (req, res) => {
  if (req.path.startsWith('/api')) {
    return res.status(404).json({ ok: false, error: 'Ruta API no encontrada.' });
  }
  const indexFile = path.join(distPath, 'index.html');
  if (!isProductionDist(distPath)) {
    return res.status(503).type('html').send(
      `<h1>Frontend de producción no encontrado</h1>
       <p>distPath: <code>${distPath}</code></p>
       <p>Ejecute <code>npm run build</code> en el despliegue.</p>`
    );
  }
  res.setHeader('Content-Type', 'text/html; charset=utf-8');
  res.sendFile(indexFile);
});

async function start() {
  console.log('[server] cwd:', process.cwd());
  console.log('[server] __dirname:', __dirname);
  console.log('[server] dist:', distPath);
  console.log('[server] dist producción OK:', isProductionDist(distPath));

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
