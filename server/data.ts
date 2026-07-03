import type { Request, Response } from 'express';
import type mysql from 'mysql2/promise';
import { getPool } from './db.js';

function parseJsonField<T>(value: unknown, fallback: T): T {
  if (value == null) return fallback;
  if (typeof value === 'string') {
    try {
      return JSON.parse(value) as T;
    } catch {
      return fallback;
    }
  }
  return value as T;
}

function resolveAnio(archivos: { anio?: number }[], explicit?: number): number {
  if (explicit && Number.isFinite(explicit)) return Number(explicit);
  const years = archivos.map(a => Number(a.anio)).filter(y => Number.isFinite(y) && y > 2000);
  if (years.length > 0) return Math.max(...years);
  return new Date().getFullYear();
}

export async function getEstado(_req: Request, res: Response) {
  try {
    const [rows] = await getPool().query<mysql.RowDataPacket[]>(
      `SELECT anio_escolar, periodo_activo, calificaciones, alertas, archivos_meta, actualizado_en
       FROM vc_estado_analitico
       ORDER BY actualizado_en DESC
       LIMIT 1`
    );

    if (rows.length === 0) {
      return res.json({ ok: true, empty: true, estado: null });
    }

    const row = rows[0];
    const meta = parseJsonField<{ archivosCargados?: unknown[]; intervenciones?: unknown[] }>(
      row.archivos_meta,
      {}
    );

    return res.json({
      ok: true,
      empty: false,
      estado: {
        anioEscolar: row.anio_escolar,
        periodoActivo: row.periodo_activo,
        calificaciones: parseJsonField(row.calificaciones, []),
        alertas: parseJsonField(row.alertas, []),
        archivosCargados: meta.archivosCargados ?? [],
        intervenciones: meta.intervenciones ?? [],
        actualizadoEn: row.actualizado_en,
      },
    });
  } catch (err) {
    console.error('[data] getEstado', err);
    return res.status(503).json({
      ok: false,
      error: err instanceof Error ? err.message : 'No se pudo leer el estado desde MySQL.',
    });
  }
}

export async function putEstado(req: Request, res: Response) {
  try {
    const body = req.body ?? {};
    const calificaciones = Array.isArray(body.calificaciones) ? body.calificaciones : [];
    const alertas = Array.isArray(body.alertas) ? body.alertas : [];
    const archivosCargados = Array.isArray(body.archivosCargados) ? body.archivosCargados : [];
    const intervenciones = Array.isArray(body.intervenciones) ? body.intervenciones : [];
    const periodoActivo = typeof body.periodoActivo === 'string' ? body.periodoActivo : 'P1';
    const anioEscolar = resolveAnio(archivosCargados, Number(body.anioEscolar));

    const archivosMeta = JSON.stringify({ archivosCargados, intervenciones });
    const califJson = JSON.stringify(calificaciones);
    const alertasJson = JSON.stringify(alertas);

    await getPool().query(
      `INSERT INTO vc_estado_analitico
         (anio_escolar, periodo_activo, calificaciones, alertas, archivos_meta)
       VALUES (?, ?, CAST(? AS JSON), CAST(? AS JSON), CAST(? AS JSON))
       ON DUPLICATE KEY UPDATE
         periodo_activo = VALUES(periodo_activo),
         calificaciones = VALUES(calificaciones),
         alertas = VALUES(alertas),
         archivos_meta = VALUES(archivos_meta)`,
      [anioEscolar, periodoActivo, califJson, alertasJson, archivosMeta]
    );

    /* Índice ligero de archivos para consulta en phpMyAdmin */
    await getPool().query('DELETE FROM vc_archivo_carga WHERE anio_escolar = ?', [anioEscolar]);
    for (const archivo of archivosCargados) {
      await getPool().query(
        `INSERT INTO vc_archivo_carga (nombre_archivo, anio_escolar, periodo, curso, registros)
         VALUES (?, ?, ?, ?, ?)`,
        [
          archivo.nombreArchivo ?? archivo.nombre ?? 'sin-nombre',
          Number(archivo.anio) || anioEscolar,
          archivo.periodoDetectado ?? 'P1',
          archivo.curso ?? null,
          Number(archivo.totalRegistros) || 0,
        ]
      );
    }

    return res.json({
      ok: true,
      anioEscolar,
      registros: calificaciones.length,
      archivos: archivosCargados.length,
    });
  } catch (err) {
    console.error('[data] putEstado', err);
    return res.status(503).json({
      ok: false,
      error: err instanceof Error ? err.message : 'No se pudo guardar el estado en MySQL.',
    });
  }
}

export async function getConfig(_req: Request, res: Response) {
  try {
    const [rows] = await getPool().query<mysql.RowDataPacket[]>(
      'SELECT json_config, actualizado_en FROM vc_configuracion_academica WHERE id = 1'
    );
    if (rows.length === 0) {
      return res.json({ ok: true, empty: true, configuracion: null });
    }
    return res.json({
      ok: true,
      empty: false,
      configuracion: parseJsonField(rows[0].json_config, null),
      actualizadoEn: rows[0].actualizado_en,
    });
  } catch (err) {
    console.error('[data] getConfig', err);
    return res.status(503).json({
      ok: false,
      error: err instanceof Error ? err.message : 'No se pudo leer la configuración.',
    });
  }
}

export async function putConfig(req: Request, res: Response) {
  try {
    const configuracion = req.body?.configuracion;
    if (!configuracion || typeof configuracion !== 'object') {
      return res.status(400).json({ ok: false, error: 'Falta configuracion en el cuerpo.' });
    }

    await getPool().query(
      `INSERT INTO vc_configuracion_academica (id, json_config)
       VALUES (1, CAST(? AS JSON))
       ON DUPLICATE KEY UPDATE json_config = VALUES(json_config)`,
      [JSON.stringify(configuracion)]
    );

    return res.json({ ok: true });
  } catch (err) {
    console.error('[data] putConfig', err);
    return res.status(503).json({
      ok: false,
      error: err instanceof Error ? err.message : 'No se pudo guardar la configuración.',
    });
  }
}
