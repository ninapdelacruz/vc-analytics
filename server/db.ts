import mysql from 'mysql2/promise';
import { hashAccessCode } from './hash.js';

let pool: mysql.Pool | null = null;

export function getPool(): mysql.Pool {
  if (!pool) {
    pool = mysql.createPool({
      host: process.env.MYSQL_HOST ?? 'localhost',
      port: Number(process.env.MYSQL_PORT ?? 3306),
      user: process.env.MYSQL_USER ?? 'vc_app',
      password: process.env.MYSQL_PASSWORD ?? '',
      database: process.env.MYSQL_DATABASE ?? 'villa_campo_analytics',
      waitForConnections: true,
      connectionLimit: 10,
      charset: 'utf8mb4',
    });
  }
  return pool;
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
  try {
    const db = getPool();
    await db.query('SELECT 1');
    return true;
  } catch {
    return false;
  }
}
