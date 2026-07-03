import { CalificacionNormalizada } from '../types';

/** Quita acentos y normaliza para comparación flexible. */
export const normalizarParaBusqueda = (texto: string): string =>
  (texto || '')
    .trim()
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '');

/**
 * Cada token de la búsqueda debe coincidir parcialmente con el nombre:
 * - subcadena en el nombre completo, o
 * - subcadena en alguna palabra (ej. "dana" → "danna", "marc" → "marce").
 */
export const coincideNombreEstudiante = (nombre: string, busqueda: string): boolean => {
  const tokens = normalizarParaBusqueda(busqueda).split(/\s+/).filter(t => t.length >= 2);
  if (tokens.length === 0) return false;

  const normNombre = normalizarParaBusqueda(nombre);
  const partes = normNombre.split(/\s+/).filter(Boolean);

  return tokens.every(token =>
    normNombre.includes(token) ||
    partes.some(parte => parte.includes(token) || parte.startsWith(token))
  );
};

/** Puntaje de relevancia (mayor = mejor coincidencia). */
export const puntajeCoincidencia = (nombre: string, busqueda: string): number => {
  const normNombre = normalizarParaBusqueda(nombre);
  const normBusqueda = normalizarParaBusqueda(busqueda);
  const tokens = normBusqueda.split(/\s+/).filter(t => t.length >= 2);
  if (tokens.length === 0) return 0;

  let score = 0;
  if (normNombre === normBusqueda) score += 100;
  if (normNombre.startsWith(normBusqueda)) score += 50;

  const partes = normNombre.split(/\s+/);
  for (const token of tokens) {
    if (partes.some(p => p === token)) score += 20;
    else if (partes.some(p => p.startsWith(token))) score += 15;
    else if (partes.some(p => p.includes(token))) score += 10;
    else if (normNombre.includes(token)) score += 5;
  }
  return score;
};

export interface ResultadoBusquedaEstudiante {
  calificaciones: CalificacionNormalizada[];
  puntaje: number;
}

export const buscarEstudiantes = (
  grupos: CalificacionNormalizada[][],
  busqueda: string
): ResultadoBusquedaEstudiante[] => {
  if (!busqueda || busqueda.trim().length < 2) return [];

  return grupos
    .filter(grupo => coincideNombreEstudiante(grupo[0].estudianteNombre, busqueda))
    .map(grupo => ({
      calificaciones: grupo,
      puntaje: puntajeCoincidencia(grupo[0].estudianteNombre, busqueda),
    }))
    .sort((a, b) => b.puntaje - a.puntaje);
};
