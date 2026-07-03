import crypto from 'crypto';
import type { Request, Response, NextFunction } from 'express';
import type mysql from 'mysql2/promise';
import { getPool, getDbStatus } from './db.js';
import { hashAccessCode } from './hash.js';

const SESSION_HOURS = Number(process.env.SESSION_HOURS ?? 8);
const PROTECTED_MODULES = ['admin', 'config', 'calidad'] as const;

/** Sesiones en memoria solo si MySQL no puede guardar la sesión. */
const memorySessions = new Map<string, number>();

function clientIp(req: Request): string | null {
  const forwarded = req.headers['x-forwarded-for'];
  if (typeof forwarded === 'string') return forwarded.split(',')[0]?.trim() ?? null;
  return req.socket.remoteAddress ?? null;
}

function sessionExpiryDate(): Date {
  return new Date(Date.now() + SESSION_HOURS * 60 * 60 * 1000);
}

function envAccessCode(): string {
  return (process.env.ACCESS_CODE ?? '').trim();
}

/**
 * Valida el código institucional.
 * 1) MySQL (vc_codigo_acceso) — fuente principal
 * 2) ACCESS_CODE en variables de entorno — respaldo
 */
async function verifyCode(codigo: string): Promise<{ valid: boolean; source: 'mysql' | 'env' | 'none' }> {
  const input = codigo.trim();
  if (!input) return { valid: false, source: 'none' };
  const inputHash = hashAccessCode(input);

  try {
    const [rows] = await getPool().query<mysql.RowDataPacket[]>(
      'SELECT codigo_hash FROM vc_codigo_acceso WHERE id = 1'
    );
    if (rows.length > 0 && rows[0].codigo_hash) {
      return {
        valid: String(rows[0].codigo_hash).toLowerCase() === inputHash,
        source: 'mysql',
      };
    }
  } catch (err) {
    console.warn('[auth] MySQL no disponible, usando ACCESS_CODE:', err instanceof Error ? err.message : err);
  }

  const fromEnv = envAccessCode();
  if (fromEnv) {
    return {
      valid: hashAccessCode(fromEnv) === inputHash,
      source: 'env',
    };
  }

  return { valid: false, source: 'none' };
}

async function createSession(ip: string | null): Promise<{ token: string; expiresAt: string }> {
  const token = crypto.randomUUID();
  const expira = sessionExpiryDate();

  try {
    await getPool().query(
      'INSERT INTO vc_sesion_acceso (token, expira_en, ip_origen) VALUES (?, ?, ?)',
      [token, expira, ip]
    );
  } catch {
    memorySessions.set(token, expira.getTime());
  }

  return { token, expiresAt: expira.toISOString() };
}

async function sessionValid(token: string | undefined): Promise<boolean> {
  if (!token) return false;

  try {
    const [rows] = await getPool().query<mysql.RowDataPacket[]>(
      'SELECT token FROM vc_sesion_acceso WHERE token = ? AND expira_en > NOW()',
      [token]
    );
    if (rows.length > 0) return true;
  } catch {
    /* fallback memoria */
  }

  const expires = memorySessions.get(token);
  if (!expires) return false;
  if (expires <= Date.now()) {
    memorySessions.delete(token);
    return false;
  }
  return true;
}

function extractToken(req: Request): string | undefined {
  const auth = req.headers.authorization;
  if (auth?.startsWith('Bearer ')) return auth.slice(7);
  return req.headers['x-access-token'] as string | undefined;
}

/** Middleware: exige sesión válida (código institucional). */
export async function requireAuth(req: Request, res: Response, next: NextFunction) {
  const valid = await sessionValid(extractToken(req));
  if (!valid) {
    return res.status(401).json({
      ok: false,
      error: 'Sesión no válida. Ingrese el código en Administración e intente de nuevo.',
    });
  }
  next();
}

async function logAttempt(modulo: string, exito: boolean, ip: string | null) {
  try {
    await getPool().query(
      'INSERT INTO vc_acceso_log (modulo, exito, ip_origen) VALUES (?, ?, ?)',
      [modulo, exito ? 1 : 0, ip]
    );
  } catch {
    /* opcional */
  }
}

export async function postVerify(req: Request, res: Response) {
  const codigo = typeof req.body?.codigo === 'string' ? req.body.codigo : '';
  const modulo = typeof req.body?.modulo === 'string' ? req.body.modulo : 'admin';
  const ip = clientIp(req);

  if (!codigo.trim()) {
    return res.status(400).json({ ok: false, error: 'Ingrese el código de acceso.' });
  }

  try {
    const { valid, source } = await verifyCode(codigo);
    void logAttempt(modulo, valid, ip);

    if (!valid) {
      if (source === 'none') {
        return res.status(503).json({
          ok: false,
          error: 'No hay código configurado en MySQL ni en ACCESS_CODE.',
        });
      }
      return res.status(401).json({ ok: false, error: 'Código incorrecto.' });
    }

    const session = await createSession(ip);
    return res.json({
      ok: true,
      token: session.token,
      expiresAt: session.expiresAt,
      modulos: PROTECTED_MODULES,
      source,
    });
  } catch (err) {
    console.error('[auth] verify error', err);
    return res.status(500).json({
      ok: false,
      error: 'Error interno al validar el código. Intente de nuevo.',
    });
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
    memorySessions.delete(token);
    try {
      await getPool().query('DELETE FROM vc_sesion_acceso WHERE token = ?', [token]);
    } catch { /* ignore */ }
  }
  return res.json({ ok: true });
}

export async function getHealth(_req: Request, res: Response) {
  const status = await getDbStatus();
  const hasEnvCode = Boolean(envAccessCode());
  const codigoConfigurado = status.codigoConfigurado || hasEnvCode;

  return res.status(200).json({
    ok: true,
    api: true,
    mysql: status.connected,
    mysqlError: status.error,
    codigoConfigurado,
    authMode: status.codigoConfigurado ? 'mysql' : hasEnvCode ? 'env' : 'none',
  });
}
