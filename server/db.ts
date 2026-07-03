import mysql from 'mysql2/promise';
import { hashAccessCode } from './hash.js';

let pool: mysql.Pool | null = null;

export function getPool(): mysql.Pool {
  if (!pool) {
    const url = process.env.DATABASE_URL?.trim();
    if (url) {
      pool = mysql.createPool(url);
    } else {
      pool = mysql.createPool({
        host: process.env.MYSQL_HOST ?? 'localhost',
        port: Number(process.env.MYSQL_PORT ?? 3306),
        user: process.env.MYSQL_USER ?? 'u313974416_vc_analytics',
        password: process.env.MYSQL_PASSWORD ?? '',
        database: process.env.MYSQL_DATABASE ?? 'u313974416_vc_analytics',
        waitForConnections: true,
        connectionLimit: 10,
        charset: 'utf8mb4',
        connectTimeout: 10000,
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

/** Inserta el hash del código desde ACCESS_CODE si la tabla está vacía. */
export async function ensureAccessCodeFromEnv(): Promise<void> {
  const envCode = process.env.ACCESS_CODE?.trim();
  if (!envCode) return;

  const db = getPool();
  const [rows] = await db.query<mysql.RowDataPacket[]>(
    'SELECT codigo_hash FROM vc_codigo_acceso WHERE id = 1'
  );
  if (rows.length === 0) {
    await db.query(
      `INSERT INTO vc_codigo_acceso (id, codigo_hash, descripcion) VALUES (1, ?, ?)`,
      [hashAccessCode(envCode), 'Inicializado desde ACCESS_CODE']
    );
    console.log('[db] Código de acceso registrado desde ACCESS_CODE');
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
