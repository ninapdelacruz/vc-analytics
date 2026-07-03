import crypto from 'crypto';
import type { Request, Response } from 'express';
import type mysql from 'mysql2/promise';
import { getPool } from './db.js';
import { hashAccessCode } from './hash.js';

const SESSION_HOURS = Number(process.env.SESSION_HOURS ?? 8);
const PROTECTED_MODULES = ['admin', 'config', 'calidad'] as const;

function clientIp(req: Request): string | null {
  const forwarded = req.headers['x-forwarded-for'];
  if (typeof forwarded === 'string') return forwarded.split(',')[0]?.trim() ?? null;
  return req.socket.remoteAddress ?? null;
}

async function logAttempt(modulo: string, exito: boolean, ip: string | null) {
  try {
    await getPool().query(
      'INSERT INTO vc_acceso_log (modulo, exito, ip_origen) VALUES (?, ?, ?)',
      [modulo, exito ? 1 : 0, ip]
    );
  } catch {
    /* auditoría no bloqueante */
  }
}

async function verifyCodeHash(codigo: string): Promise<boolean> {
  const db = getPool();
  const [rows] = await db.query<mysql.RowDataPacket[]>(
    'SELECT codigo_hash FROM vc_codigo_acceso WHERE id = 1'
  );
  if (rows.length === 0) return false;
  return rows[0].codigo_hash === hashAccessCode(codigo);
}

async function createSession(ip: string | null): Promise<{ token: string; expiresAt: string }> {
  const token = crypto.randomUUID();
  const expira = new Date(Date.now() + SESSION_HOURS * 60 * 60 * 1000);
  await getPool().query(
    'INSERT INTO vc_sesion_acceso (token, expira_en, ip_origen) VALUES (?, ?, ?)',
    [token, expira, ip]
  );
  return { token, expiresAt: expira.toISOString() };
}

async function sessionValid(token: string | undefined): Promise<boolean> {
  if (!token) return false;
  const db = getPool();
  const [rows] = await db.query<mysql.RowDataPacket[]>(
    'SELECT token FROM vc_sesion_acceso WHERE token = ? AND expira_en > NOW()',
    [token]
  );
  return rows.length > 0;
}

function extractToken(req: Request): string | undefined {
  const auth = req.headers.authorization;
  if (auth?.startsWith('Bearer ')) return auth.slice(7);
  return req.headers['x-access-token'] as string | undefined;
}

export async function postVerify(req: Request, res: Response) {
  const codigo = typeof req.body?.codigo === 'string' ? req.body.codigo : '';
  const modulo = typeof req.body?.modulo === 'string' ? req.body.modulo : 'admin';
  const ip = clientIp(req);

  if (!codigo.trim()) {
    return res.status(400).json({ ok: false, error: 'Ingrese el código de acceso.' });
  }

  try {
    const valid = await verifyCodeHash(codigo);
    await logAttempt(modulo, valid, ip);

    if (!valid) {
      return res.status(401).json({ ok: false, error: 'Código incorrecto.' });
    }

    const session = await createSession(ip);
    return res.json({
      ok: true,
      token: session.token,
      expiresAt: session.expiresAt,
      modulos: PROTECTED_MODULES,
    });
  } catch (err) {
    console.error('[auth] verify error', err);
    return res.status(503).json({ ok: false, error: 'No se pudo validar el código. Revise la conexión MySQL.' });
  }
}

export async function getSession(req: Request, res: Response) {
  try {
    const valid = await sessionValid(extractToken(req));
    if (!valid) return res.status(401).json({ ok: false, autenticado: false });
    return res.json({ ok: true, autenticado: true, modulos: PROTECTED_MODULES });
  } catch {
    return res.status(503).json({ ok: false, error: 'Servicio no disponible.' });
  }
}

export async function deleteSession(req: Request, res: Response) {
  const token = extractToken(req);
  if (token) {
    try {
      await getPool().query('DELETE FROM vc_sesion_acceso WHERE token = ?', [token]);
    } catch { /* ignore */ }
  }
  return res.json({ ok: true });
}

export async function getHealth(_req: Request, res: Response) {
  try {
    const db = getPool();
    await db.query('SELECT 1');
    const [codeRow] = await db.query<mysql.RowDataPacket[]>(
      'SELECT id FROM vc_codigo_acceso WHERE id = 1'
    );
    return res.json({
      ok: true,
      mysql: true,
      codigoConfigurado: codeRow.length > 0,
    });
  } catch {
    return res.status(503).json({ ok: false, mysql: false });
  }
}
