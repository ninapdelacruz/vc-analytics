import mysql from 'mysql2/promise';
import { hashAccessCode } from './hash.js';

let pool: mysql.Pool | null = null;

function env(name: string, fallback = ''): string {
  return (process.env[name] ?? fallback).trim().replace(/^["']|["']$/g, '');
}

export function getPool(): mysql.Pool {
  if (!pool) {
    const url = env('DATABASE_URL');
    if (url) {
      pool = mysql.createPool(url);
    } else {
      /**
       * En Hostinger, `localhost` a menudo resuelve a IPv6 (::1) y MySQL
       * rechaza el usuario como 'user'@'::1'. Usar 127.0.0.1 fuerza IPv4
       * y coincide con privilegios 'user'@'localhost'.
       */
      let host = env('MYSQL_HOST', '127.0.0.1');
      if (host === 'localhost' || host === '::1') {
        host = '127.0.0.1';
      }

      pool = mysql.createPool({
        host,
        port: Number(env('MYSQL_PORT', '3306') || 3306),
        user: env('MYSQL_USER', 'u313974416_vc_analytics'),
        password: env('MYSQL_PASSWORD'),
        database: env('MYSQL_DATABASE', 'u313974416_vc_analytics'),
        waitForConnections: true,
        connectionLimit: 5,
        charset: 'utf8mb4',
        connectTimeout: 8000,
      });
    }
  }
  return pool;
}

export async function getMysqlError(): Promise<string | null> {
  try {
    await getPool().query('SELECT 1');
    return null;
  } catch (err) {
    return err instanceof Error ? err.message : 'Error desconocido';
  }
}

/**
 * Si vc_codigo_acceso está vacía y existe ACCESS_CODE, inserta el hash en MySQL.
 * No sobrescribe un código ya guardado en la base (MySQL es la fuente principal).
 */
export async function ensureAccessCodeFromEnv(): Promise<void> {
  const envCode = env('ACCESS_CODE');
  if (!envCode) return;

  try {
    const db = getPool();
    const [rows] = await db.query<mysql.RowDataPacket[]>(
      'SELECT codigo_hash FROM vc_codigo_acceso WHERE id = 1'
    );
    if (rows.length === 0) {
      await db.query(
        `INSERT INTO vc_codigo_acceso (id, codigo_hash, descripcion) VALUES (1, ?, ?)`,
        [hashAccessCode(envCode), 'Inicializado desde ACCESS_CODE']
      );
      console.log('[db] Código de acceso registrado en MySQL desde ACCESS_CODE');
    }
  } catch (err) {
    console.warn('[db] No se pudo sincronizar ACCESS_CODE en MySQL:', err instanceof Error ? err.message : err);
  }
}

export async function testConnection(): Promise<boolean> {
  return (await getMysqlError()) === null;
}

export async function getDbStatus(): Promise<{
  connected: boolean;
  error: string | null;
  codigoConfigurado: boolean;
  tablasOk: boolean;
}> {
  try {
    const db = getPool();
    await db.query('SELECT 1');
    const [codeRow] = await db.query<mysql.RowDataPacket[]>(
      'SELECT id FROM vc_codigo_acceso WHERE id = 1'
    );
    let tablasOk = true;
    try {
      await db.query('SELECT 1 FROM vc_sesion_acceso LIMIT 1');
      await db.query('SELECT 1 FROM vc_acceso_log LIMIT 1');
    } catch {
      tablasOk = false;
    }
    return {
      connected: true,
      error: null,
      codigoConfigurado: codeRow.length > 0,
      tablasOk,
    };
  } catch (err) {
    return {
      connected: false,
      error: err instanceof Error ? err.message : 'Error desconocido',
      codigoConfigurado: false,
      tablasOk: false,
    };
  }
}
