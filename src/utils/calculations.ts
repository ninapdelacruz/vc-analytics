import { CalificacionNormalizada, ConfiguracionAcademica, NivelDesempeno, AsignaturaValidaParaPerdida } from '../types';

export const normalizarTexto = (texto: string) => (texto || '').trim().toLowerCase();

/** Formatea nota numérica evitando artefactos de punto flotante. */
export const formatearNota = (nota: number | null | undefined, decimales = 2): string => {
  if (nota === null || nota === undefined || typeof nota !== 'number' || isNaN(nota)) return '-';
  return parseFloat(nota.toFixed(decimales)).toFixed(decimales);
};

export const redondearNota = (nota: number, decimales = 2): number =>
  parseFloat(nota.toFixed(decimales));

export const normalizarTipoAsignatura = (tipo: string): 'Académica' | 'Centro de interés' | 'Comportamiento' | 'No académica' => {
  const norm = (tipo || '').trim().toLowerCase()
    .normalize("NFD").replace(/[\u0300-\u036f]/g, ""); // strip accents
  if (norm.includes('academica')) return 'Académica';
  if (norm.includes('centro') || norm.includes('interes') || norm.includes('c.i.')) return 'Centro de interés';
  if (norm.includes('comportamiento') || norm.includes('convivencia') || norm.includes('compo')) return 'Comportamiento';
  return 'No académica';
};

export const obtenerTipoAsignaturaConDiccionario = (
  c: CalificacionNormalizada,
  config: ConfiguracionAcademica
): 'Académica' | 'Centro de interés' | 'Comportamiento' | 'No académica' => {
  const dictEntry = config.diccionarioAreas.find(d => d.codigoBase === c.codigoAsignatura);
  if (dictEntry) {
    return normalizarTipoAsignatura(dictEntry.tipo);
  }
  return normalizarTipoAsignatura(c.tipoAsignatura);
};

export const esNotaValida = (nota: any, config: ConfiguracionAcademica): boolean => {
  if (nota === null || nota === undefined || nota === '') return false;
  if (typeof nota === 'boolean') return false;
  if (nota === '*') return false;
  const num = Number(nota);
  if (isNaN(num)) return false;
  if (typeof nota === 'string' && isNaN(parseFloat(nota))) return false;
  return num >= config.notaMinima && num <= config.notaMaxima;
};

export type PeriodoCodigo = 'P1' | 'P2' | 'P3' | 'P4' | 'DEF';

/** True si hay al menos una nota numérica válida en ese período. */
export const periodoTieneDatos = (
  calificaciones: CalificacionNormalizada[],
  periodo: string,
  config: ConfiguracionAcademica
): boolean =>
  calificaciones.some(c => c.periodo === periodo && esNotaValida(c.nota, config));

/** Períodos visibles en header y selectores: P1/P2 siempre; P3/P4 si hay datos; DEF siempre. */
export const obtenerPeriodosVisibles = (
  calificaciones: CalificacionNormalizada[],
  config: ConfiguracionAcademica
): PeriodoCodigo[] => {
  const result: PeriodoCodigo[] = ['P1', 'P2'];
  if (periodoTieneDatos(calificaciones, 'P3', config)) result.push('P3');
  if (periodoTieneDatos(calificaciones, 'P4', config)) result.push('P4');
  result.push('DEF');
  return result;
};

/** Columnas de nota en tablas: P1, P2, (+ P3/P4 si existen), DEF. */
export const obtenerColumnasNotaTabla = (
  calificaciones: CalificacionNormalizada[],
  config: ConfiguracionAcademica
): PeriodoCodigo[] => obtenerPeriodosVisibles(calificaciones, config);

export const getNotaPeriodo = (notas: CalificacionNormalizada[], asignaturaCodigo: string, periodo: string): number | null => {
  const row = notas.find(n => n.codigoAsignatura === asignaturaCodigo && n.periodo === periodo);
  if (!row) return null;
  if (typeof row.nota === 'number' && !isNaN(row.nota)) return row.nota;
  return null;
};

export const calcularPromedio = (notas: any[], config?: ConfiguracionAcademica): number | null => {
  if (!notas || !Array.isArray(notas)) return null;
  let validNotas: number[];
  if (config) {
    validNotas = notas.filter(n => esNotaValida(n, config)).map(n => Number(n));
  } else {
    validNotas = notas.filter(n => n !== null && n !== undefined && n !== '' && n !== '*' && !isNaN(Number(n))).map(n => Number(n));
  }
  if (validNotas.length === 0) return null;
  const sum = validNotas.reduce((a, b) => a + b, 0);
  return sum / validNotas.length;
};

export const clasificarDesempeno = (nota: any, config: ConfiguracionAcademica): NivelDesempeno | null => {
  if (!esNotaValida(nota, config)) return null;
  const num = Number(nota);
  for (const n of config.nivelesDesempeno) {
     const passMin = n.operadorMin === '>=' ? num >= n.min : num > n.min;
     const passMax = n.operadorMax === '<=' ? num <= n.max : num < n.max;
     if (passMin && passMax) return n;
  }
  return null;
};

export const isPerdida = (nota: any, config: ConfiguracionAcademica): boolean => {
  if (!esNotaValida(nota, config)) return false;
  const num = Number(nota);
  return num < config.notaAprobacion;
};

export type EstadoAsignatura = 'Perdida' | 'Aprobada' | 'En riesgo' | 'Sin datos';

/** Clasifica estado según la nota evaluada y el período activo (misma regla en todo el motor). */
export const clasificarEstadoAsignatura = (
  nota: number | null | undefined,
  config: ConfiguracionAcademica
): EstadoAsignatura => {
  if (nota === null || nota === undefined || typeof nota !== 'number' || isNaN(nota)) return 'Sin datos';
  if (isPerdida(nota, config)) return 'Perdida';
  const margen = config.margenRiesgo ?? 0.5;
  if (nota >= config.notaAprobacion && nota < config.notaAprobacion + margen) return 'En riesgo';
  return 'Aprobada';
};

/**
 * Prioriza asignaturas para intervención: mayor nota necesaria restante,
 * desempate por nota actual más baja. No usa el orden de la lista del Excel.
 */
export const calcularAsignaturasPrioritarias = (
  filas: Array<{
    nombreAsignatura: string;
    nota: number;
    notaNecesaria: number | null;
    estado: EstadoAsignatura;
  }>,
  limite = 4
): string[] => {
  return filas
    .filter(f => f.estado === 'Perdida' || f.estado === 'En riesgo')
    .sort((a, b) => {
      const urgencia = (n: number | null) => (n === 999 ? Infinity : n ?? -1);
      const diff = urgencia(b.notaNecesaria) - urgencia(a.notaNecesaria);
      if (diff !== 0) return diff;
      return a.nota - b.nota;
    })
    .slice(0, limite)
    .map(f => f.nombreAsignatura);
};

export type ViabilidadRecuperacion = 'Recuperable' | 'Difícil' | 'Muy difícil' | 'Imposible';

export const NOTA_NECESARIA_IMPOSIBLE = 999;

/** Nota mínima en períodos restantes para alcanzar la aprobación anual. null si ya no hay períodos pendientes. */
export const calcularNotaNecesariaRestante = (
  calificacionesAsignatura: CalificacionNormalizada[],
  config: ConfiguracionAcademica
): number | null => {
  let pCursados = 0;
  let suma = 0;
  (['P1', 'P2', 'P3', 'P4'] as const).forEach(p => {
    const pNota = obtenerNotaAnalisis(calificacionesAsignatura, p, config);
    if (pNota !== null && !isNaN(pNota)) {
      suma += pNota;
      pCursados++;
    }
  });
  if (pCursados === 0 || pCursados >= config.periodos) return null;
  const pPendientes = config.periodos - pCursados;
  const necesaria = ((config.notaAprobacion * config.periodos) - suma) / pPendientes;
  const nota = Math.max(config.notaMinima, parseFloat(necesaria.toFixed(2)));
  if (necesaria > config.notaMaxima) return NOTA_NECESARIA_IMPOSIBLE;
  return nota;
};

export const clasificarViabilidadRecuperacion = (
  notaNecesaria: number | null,
  config: ConfiguracionAcademica
): ViabilidadRecuperacion => {
  if (notaNecesaria === null) return 'Recuperable';
  if (notaNecesaria === NOTA_NECESARIA_IMPOSIBLE) return 'Imposible';
  const umbralFacil = config.notaAprobacion + 0.5;
  const umbralDificil = config.notaAprobacion + 1.5;
  const umbralMuyDificil = config.notaMaxima - 0.5;
  if (notaNecesaria <= umbralFacil) return 'Recuperable';
  if (notaNecesaria <= umbralDificil) return 'Difícil';
  if (notaNecesaria <= umbralMuyDificil) return 'Muy difícil';
  return 'Imposible';
};

const VIABILIDAD_PRIORITY: Record<ViabilidadRecuperacion, number> = {
  Imposible: 4, 'Muy difícil': 3, Difícil: 2, Recuperable: 1,
};

export const peorViabilidad = (a: ViabilidadRecuperacion, b: ViabilidadRecuperacion): ViabilidadRecuperacion =>
  VIABILIDAD_PRIORITY[a] >= VIABILIDAD_PRIORITY[b] ? a : b;

export const generarAccionViabilidad = (v: ViabilidadRecuperacion): string => {
  switch (v) {
    case 'Imposible': return 'Plan de recuperación anual / evaluación especial';
    case 'Muy difícil': return 'Refuerzo intensivo + citación acudiente';
    case 'Difícil': return 'Refuerzo académico programado';
    default: return 'Seguimiento y refuerzo puntual';
  }
};

export interface CasoNotaNecesaria {
  id: string;
  estudianteId: string;
  estudianteNombre: string;
  grado: number;
  curso: string;
  codigoAsignatura: string;
  nombreAsignatura: string;
  p1: number | null;
  p2: number | null;
  p3: number | null;
  p4: number | null;
  def: number | null;
  notaNecesaria: number;
  viabilidad: ViabilidadRecuperacion;
  estado: EstadoAsignatura;
  periodosRestantes: number;
}

/** Casos estudiante-asignatura con recuperación pendiente (perdida o en riesgo). */
export const calcularCasosNotaNecesaria = (
  calificaciones: CalificacionNormalizada[],
  periodoAnalisis: 'P1' | 'P2' | 'P3' | 'P4' | 'DEF',
  config: ConfiguracionAcademica
): CasoNotaNecesaria[] => {
  const casos: CasoNotaNecesaria[] = [];
  for (const cals of agruparPorEstudiante(calificaciones)) {
    const rep = cals[0];
    const validGrades = obtenerAsignaturasValidasParaPerdida(cals, periodoAnalisis, config);
    for (const g of validGrades) {
      const matchGrades = cals.filter(c => c.codigoAsignatura === g.codigoAsignatura);
      const notaEvaluada = obtenerNotaAnalisis(matchGrades, periodoAnalisis, config);
      const nota = notaEvaluada ?? g.nota;
      const estado = clasificarEstadoAsignatura(nota, config);
      const notaNecesaria = calcularNotaNecesariaRestante(matchGrades, config);
      if (notaNecesaria === null) continue;
      if (estado !== 'Perdida' && estado !== 'En riesgo') continue;

      let pCursados = 0;
      (['P1', 'P2', 'P3', 'P4'] as const).forEach(p => {
        if (obtenerNotaAnalisis(matchGrades, p, config) !== null) pCursados++;
      });

      const viabilidad = clasificarViabilidadRecuperacion(notaNecesaria, config);
      const getP = (p: 'P1' | 'P2' | 'P3' | 'P4' | 'DEF') => obtenerNotaAnalisis(matchGrades, p, config);
      casos.push({
        id: `${crearClaveEstudiante(rep)}-${g.codigoAsignatura}`,
        estudianteId: crearClaveEstudiante(rep),
        estudianteNombre: rep.estudianteNombre,
        grado: rep.grado,
        curso: rep.curso,
        codigoAsignatura: g.codigoAsignatura,
        nombreAsignatura: g.nombreAsignatura,
        p1: getP('P1'),
        p2: getP('P2'),
        p3: getP('P3'),
        p4: getP('P4'),
        def: getP('DEF'),
        notaNecesaria,
        viabilidad,
        estado,
        periodosRestantes: config.periodos - pCursados,
      });
    }
  }
  return casos;
};

const RISK_PRIORITY: Record<string, number> = {
  Crítico: 5, Alto: 4, Medio: 3, Bajo: 2, 'Sin riesgo': 1,
};

/** Orden de ranking: riesgo ↓, pérdidas ↓, promedio ↑ (más urgente primero). */
export const compararEstudiantesPorRiesgo = (
  a: { riesgo: string; numPerdidas: number; promedio: number | null },
  b: { riesgo: string; numPerdidas: number; promedio: number | null }
): number => {
  const prA = RISK_PRIORITY[a.riesgo] ?? 0;
  const prB = RISK_PRIORITY[b.riesgo] ?? 0;
  if (prB !== prA) return prB - prA;
  if (b.numPerdidas !== a.numPerdidas) return b.numPerdidas - a.numPerdidas;
  const promA = a.promedio ?? Infinity;
  const promB = b.promedio ?? Infinity;
  return promA - promB;
};

/** Asignatura más urgente de intervención para un estudiante en el período dado. */
export const obtenerAsignaturaCriticaEstudiante = (
  calificacionesEstudiante: CalificacionNormalizada[],
  periodoAnalisis: 'P1' | 'P2' | 'P3' | 'P4' | 'DEF',
  config: ConfiguracionAcademica
): string | null => {
  const validGrades = obtenerAsignaturasValidasParaPerdida(calificacionesEstudiante, periodoAnalisis, config);
  const filas = validGrades.map(g => {
    const matchGrades = calificacionesEstudiante.filter(c => c.codigoAsignatura === g.codigoAsignatura);
    const notaNecesaria = calcularNotaNecesariaRestante(matchGrades, config);
    return {
      nombreAsignatura: g.nombreAsignatura,
      nota: g.nota,
      notaNecesaria,
      estado: clasificarEstadoAsignatura(g.nota, config),
    };
  });
  return calcularAsignaturasPrioritarias(filas, 1)[0] ?? null;
};

export const crearClaveCurso = (c: Pick<CalificacionNormalizada, 'anio' | 'nivel' | 'grado' | 'curso'>) =>
  `${c.anio}-${c.nivel}-${c.grado}-${c.curso}`;

export const crearClaveEstudiante = (c: Partial<CalificacionNormalizada>) => {
  const anio = c.anio || '';
  const nivel = c.nivel || '';
  const grado = c.grado || '';
  const curso = c.curso || '';
  const num = c.estudianteNumero || '';
  const nombre = normalizarTexto(c.estudianteNombre || '');
  return `${anio}-${nivel}-${grado}-${curso}-${num}-${nombre}`;
};

export const agruparPorEstudiante = (calificaciones: CalificacionNormalizada[]) => {
  const map = new Map<string, CalificacionNormalizada[]>();
  for (const c of calificaciones) {
    const key = crearClaveEstudiante(c);
    if (!map.has(key)) {
      map.set(key, []);
    }
    map.get(key)!.push(c);
  }
  return Array.from(map.values());
};

export const esAsignaturaValidaParaRiesgo = (c: CalificacionNormalizada, periodoActivo: string, config: ConfiguracionAcademica): boolean => {
  if (c.periodo !== periodoActivo) return false;
  if (c.aplica === false) return false;
  if (!c.cuentaParaPerdida) return false;
  if (c.codigoAsignatura === 'COMPO' || obtenerTipoAsignaturaConDiccionario(c, config) === 'Comportamiento') return false;
  if (!c.codigoAsignatura) return false;
  if (!c.nombreAsignatura) return false;
  if (!esNotaValida(c.nota, config)) return false;
  return true;
};

export const resolverCentrosInteres = (centros: CalificacionNormalizada[], config: ConfiguracionAcademica): { result: CalificacionNormalizada[], alerta: boolean } => {
  const validCentros = centros.filter(c => esNotaValida(c.nota, config));
  
  if (validCentros.length === 0) return { result: [], alerta: false };
  if (validCentros.length === 1) return { result: [validCentros[0]], alerta: false };

  if (config.reglaMultiplesCentros === 'Inconsistencia') {
     return { result: [], alerta: true };
  }
  
  return { result: [validCentros[0]], alerta: true };
};

// --- CENTRAL CALCULATION ENGINE FUNCTIONS ---

/**
 * 3. obtenerNotaAnalisis(calificacionesEstudianteAsignatura, periodoAnalisis, config)
 */
export const obtenerNotaAnalisis = (
  calificacionesEstudianteAsignatura: CalificacionNormalizada[],
  periodoAnalisis: 'P1' | 'P2' | 'P3' | 'P4' | 'DEF',
  config: ConfiguracionAcademica
): number | null => {
  if (periodoAnalisis !== 'DEF') {
    const rec = calificacionesEstudianteAsignatura.find(c => c.periodo === periodoAnalisis);
    if (rec && esNotaValida(rec.nota, config)) {
      return Number(rec.nota);
    }
    return null;
  }

  // DEF case: simple average of valid P1 and P2
  const p1Rec = calificacionesEstudianteAsignatura.find(c => c.periodo === 'P1');
  const p2Rec = calificacionesEstudianteAsignatura.find(c => c.periodo === 'P2');

  const p1Val = p1Rec && esNotaValida(p1Rec.nota, config) ? Number(p1Rec.nota) : null;
  const p2Val = p2Rec && esNotaValida(p2Rec.nota, config) ? Number(p2Rec.nota) : null;

  const validPeriods: number[] = [];
  if (p1Val !== null) validPeriods.push(p1Val);
  if (p2Val !== null) validPeriods.push(p2Val);

  if (validPeriods.length === 0) return null;
  const sum = validPeriods.reduce((a, b) => a + b, 0);
  return redondearNota(sum / validPeriods.length);
};

/**
 * 5. esAsignaturaValidaParaPerdida(calificacion, config)
 */
export const esAsignaturaValidaParaPerdida = (
  c: CalificacionNormalizada,
  config: ConfiguracionAcademica
): boolean => {
  if (!c) return false;
  
  // Exclude behavior
  if (c.codigoAsignatura === 'COMPO') return false;
  const normTipo = obtenerTipoAsignaturaConDiccionario(c, config);
  if (normTipo === 'Comportamiento') return false;

  // Exclude non-applicable or not counting for loss
  if (c.aplica === false) return false;
  if (!c.cuentaParaPerdida) return false;

  // Exclude unknown codes (not in dictionary)
  const dictEntry = config.diccionarioAreas.find(d => d.codigoBase === c.codigoAsignatura);
  if (!dictEntry) return false;

  // Exclude centers of interest in Primaria
  if (normTipo === 'Centro de interés' && c.nivel === 'Primaria') return false;

  // Specific grade applicability guards
  let isApp = true;
  if (c.codigoAsignatura === 'FILOS' && c.grado !== 10 && c.grado !== 11) isApp = false;
  if (c.codigoAsignatura === 'CECNO' && c.grado !== 10 && c.grado !== 11) isApp = false;
  if (c.codigoAsignatura === 'CIUDA' && c.nivel !== 'Primaria') isApp = false;
  if (c.codigoAsignatura === 'GEOME' && (c.grado < 6 || c.grado > 9)) isApp = false;

  if (!isApp) return false;

  // Exclude invalid notes, empty, asterisks, out of bounds
  if (!esNotaValida(c.nota, config)) return false;

  return true;
};

/**
 * 6. resolverCentroInteresActivo(calificacionesEstudiante, periodoAnalisis, config)
 */
export const resolverCentroInteresActivo = (
  calificacionesEstudiante: CalificacionNormalizada[],
  periodoAnalisis: 'P1' | 'P2' | 'P3' | 'P4' | 'DEF',
  config: ConfiguracionAcademica
): { centroActivoCodigo: string | null; nota: number | null; alertaInconsistencia: boolean } => {
  // Centers of interest only apply to Bachillerato
  const firstRec = calificacionesEstudiante[0];
  if (!firstRec || firstRec.nivel === 'Primaria') {
    return { centroActivoCodigo: null, nota: null, alertaInconsistencia: false };
  }

  const ciGrades = calificacionesEstudiante.filter(c => obtenerTipoAsignaturaConDiccionario(c, config) === 'Centro de interés');
  if (ciGrades.length === 0) {
    return { centroActivoCodigo: null, nota: null, alertaInconsistencia: false };
  }

  // Find centers of interest that have a valid note in P2
  const p2CIs = ciGrades.filter(c => c.periodo === 'P2' && esNotaValida(c.nota, config));
  const uniqueP2Codes = Array.from(new Set(p2CIs.map(c => c.codigoAsignatura)));

  if (uniqueP2Codes.length > 1) {
    return { centroActivoCodigo: null, nota: null, alertaInconsistencia: true };
  }

  if (uniqueP2Codes.length === 0) {
    return { centroActivoCodigo: null, nota: null, alertaInconsistencia: false };
  }

  const activeCode = uniqueP2Codes[0];
  const activeCiGrades = ciGrades.filter(c => c.codigoAsignatura === activeCode);

  let finalNota: number | null = null;

  if (periodoAnalisis !== 'DEF') {
    const rec = activeCiGrades.find(c => c.periodo === periodoAnalisis);
    if (rec && esNotaValida(rec.nota, config)) {
      finalNota = Number(rec.nota);
    }
  } else {
    // DEF is average of valid P1 and P2 of this center of interest
    const p1Rec = activeCiGrades.find(c => c.periodo === 'P1');
    const p2Rec = activeCiGrades.find(c => c.periodo === 'P2');
    const p1Val = p1Rec && esNotaValida(p1Rec.nota, config) ? Number(p1Rec.nota) : null;
    const p2Val = p2Rec && esNotaValida(p2Rec.nota, config) ? Number(p2Rec.nota) : null;

    if (p1Val !== null && p2Val !== null) {
      finalNota = (p1Val + p2Val) / 2;
    } else if (p1Val !== null) {
      finalNota = p1Val;
    } else if (p2Val !== null) {
      finalNota = p2Val;
    }
  }

  return { centroActivoCodigo: activeCode, nota: finalNota, alertaInconsistencia: false };
};

/**
 * 7. obtenerAsignaturasValidasParaPerdida(calificacionesEstudiante, periodoAnalisis, config)
 */
export const obtenerAsignaturasValidasParaPerdida = (
  calificacionesEstudiante: CalificacionNormalizada[],
  periodoAnalisis: 'P1' | 'P2' | 'P3' | 'P4' | 'DEF',
  config: ConfiguracionAcademica
): AsignaturaValidaParaPerdida[] => {
  
  const buildEntry = (
    firstGrad: CalificacionNormalizada,
    code: string,
    notaAnalisis: number,
    tipoAsignatura: string,
    area: string
  ): AsignaturaValidaParaPerdida => ({
    archivo: firstGrad.archivo,
    nivel: firstGrad.nivel,
    grado: firstGrad.grado,
    curso: firstGrad.curso,
    anio: firstGrad.anio,
    estudianteNumero: firstGrad.estudianteNumero,
    estudianteNombre: firstGrad.estudianteNombre,
    codigoAsignatura: code,
    nombreAsignatura: firstGrad.nombreAsignatura || code,
    nota: notaAnalisis,
    tipoAsignatura,
    area,
    periodoAnalisis,
    intensidadHoraria: firstGrad.intensidadHoraria || 0,
    aplica: firstGrad.aplica !== false,
    cuentaParaPerdida: firstGrad.cuentaParaPerdida !== false,
  });

  // Group regular qualifications by subject code
  const regularGrades = calificacionesEstudiante.filter(c => {
    if (c.codigoAsignatura === 'COMPO') return false;
    const normTipo = obtenerTipoAsignaturaConDiccionario(c, config);
    if (normTipo === 'Comportamiento' || normTipo === 'Centro de interés') return false;
    return true;
  });

  const subjectsMap = new Map<string, CalificacionNormalizada[]>();
  for (const c of regularGrades) {
    if (!subjectsMap.has(c.codigoAsignatura)) {
      subjectsMap.set(c.codigoAsignatura, []);
    }
    subjectsMap.get(c.codigoAsignatura)!.push(c);
  }

  const result: AsignaturaValidaParaPerdida[] = [];

  for (const [code, grades] of subjectsMap.entries()) {
    const firstGrad = grades[0];
    if (!firstGrad) continue;

    const notaAnalisis = obtenerNotaAnalisis(grades, periodoAnalisis, config);
    if (notaAnalisis === null) continue;

    const tempQual: CalificacionNormalizada = {
      ...firstGrad,
      periodo: periodoAnalisis,
      nota: notaAnalisis
    };

    if (esAsignaturaValidaParaPerdida(tempQual, config)) {
      const tipo = obtenerTipoAsignaturaConDiccionario(firstGrad, config);
      result.push(buildEntry(
        firstGrad,
        code,
        notaAnalisis,
        tipo,
        firstGrad.area || firstGrad.nombreAsignatura || code
      ));
    }
  }

  // Resolve center of interest with resolverCentroInteresActivo
  const ciResolution = resolverCentroInteresActivo(calificacionesEstudiante, periodoAnalisis, config);
  if (ciResolution.centroActivoCodigo && ciResolution.nota !== null) {
    const activeCiGrade = calificacionesEstudiante.find(c => c.codigoAsignatura === ciResolution.centroActivoCodigo);
    if (activeCiGrade) {
      result.push(buildEntry(
        activeCiGrade,
        ciResolution.centroActivoCodigo,
        ciResolution.nota,
        'Centro de interés',
        activeCiGrade.area || 'Centros de interés'
      ));
    }
  }

  return result;
};

const generarCausaPrincipal = (numPerdidas: number, perdidas: any[], enRiesgo: any[], multiplesCentros: boolean, config: ConfiguracionAcademica) => {
  if (multiplesCentros) return "Tiene centro de interés inconsistente.";
  if (numPerdidas >= config.asignaturasParaPerder) return `Pierde ${numPerdidas} asignaturas académicas.`;
  if (numPerdidas === config.asignaturasParaPerder - 1) return "Está a una asignatura de perder el año.";
  if (numPerdidas > 0) {
     const names = [...perdidas].sort((a, b) => a.nota - b.nota).slice(0, 2).map(p => p.nombreAsignatura).join(" e ");
     return `Presenta bajo desempeño en ${names}.`;
  }
  if (enRiesgo.length > 0) return "Tiene asignaturas en riesgo cerca de la nota mínima.";
  return "Buen desempeño general.";
};

const generarAccionSugerida = (numPerdidas: number, perdidas: any[], enRiesgo: any[], multiplesCentros: boolean, config: ConfiguracionAcademica) => {
  if (multiplesCentros) return "Revisar centro de interés activo.";
  if (numPerdidas >= config.asignaturasParaPerder) return "Citación a acudiente y plan de recuperación.";
  if (numPerdidas === config.asignaturasParaPerder - 1) return "Refuerzo académico en asignaturas críticas.";
  if (numPerdidas > 0) return "Refuerzo académico en asignaturas perdidas.";
  if (enRiesgo.length > 0) return "Seguimiento preventivo por notas cercanas al mínimo.";
  return "Mantener buenos hábitos de estudio.";
};

/**
 * 8. calcularRiesgoEstudiante(calificacionesEstudiante, periodoAnalisis, config)
 */
export const calcularRiesgoEstudiante = (
  calificacionesEstudiante: CalificacionNormalizada[],
  periodoAnalisis: 'P1' | 'P2' | 'P3' | 'P4' | 'DEF',
  config: ConfiguracionAcademica
) => {
  const validSubjects = obtenerAsignaturasValidasParaPerdida(calificacionesEstudiante, periodoAnalisis, config);

  const asignaturasPerdidas = validSubjects.filter(s => s.nota < config.notaAprobacion);
  const margenRiesgo = config.margenRiesgo ?? 0.5;
  const asignaturasEnRiesgo = validSubjects.filter(s => s.nota >= config.notaAprobacion && s.nota < config.notaAprobacion + margenRiesgo);

  const numPerdidas = asignaturasPerdidas.length;

  let riesgo: 'Bajo' | 'Medio' | 'Alto' | 'Crítico' | 'Sin riesgo' = 'Sin riesgo';
  if (numPerdidas >= config.asignaturasParaPerder) {
    riesgo = 'Crítico';
  } else if (numPerdidas === config.asignaturasParaPerder - 1) {
    riesgo = 'Alto';
  } else if (numPerdidas >= 1) {
    riesgo = 'Medio';
  } else if (numPerdidas === 0 && asignaturasEnRiesgo.length > 0) {
    riesgo = 'Bajo';
  }

  const notesToAverage = validSubjects.map(s => s.nota);
  const promedioGeneral = calcularPromedio(notesToAverage, config);

  const ciResolution = resolverCentroInteresActivo(calificacionesEstudiante, periodoAnalisis, config);

  const causaPrincipal = generarCausaPrincipal(numPerdidas, asignaturasPerdidas, asignaturasEnRiesgo, ciResolution.alertaInconsistencia, config);
  const accionSugerida = generarAccionSugerida(numPerdidas, asignaturasPerdidas, asignaturasEnRiesgo, ciResolution.alertaInconsistencia, config);

  const alertas: string[] = [];
  if (ciResolution.alertaInconsistencia) {
    alertas.push("Tiene múltiples centros de interés con nota registrada en el mismo período.");
  }

  // Check 1 & 3: Notes in inactive or non-applicable subjects
  calificacionesEstudiante.forEach(g => {
    if (g.periodo === periodoAnalisis && esNotaValida(g.nota, config)) {
      const dictEntry = config.diccionarioAreas.find(d => d.codigoBase === g.codigoAsignatura);
      if (dictEntry && !dictEntry.activa) {
        alertas.push(`Tiene nota registrada en la asignatura inactiva "${g.nombreAsignatura || g.codigoAsignatura}".`);
      }
      
      const isValRisk = esAsignaturaValidaParaRiesgo(g, periodoAnalisis, config);
      const isValLoss = esAsignaturaValidaParaPerdida(g, config);
      if (!isValRisk && !isValLoss && g.codigoAsignatura !== 'COMPO') {
        alertas.push(`Tiene nota registrada en la asignatura no aplicable "${g.nombreAsignatura || g.codigoAsignatura}" para su nivel/grado.`);
      }
    }
  });

  // Check 2: Average and performance quantitative level mismatch
  if (promedioGeneral !== null && promedioGeneral !== undefined) {
    const computedDesempeno = clasificarDesempeno(promedioGeneral, config);
    const rawRecordWithDesempeno = calificacionesEstudiante.find(g => g.periodo === periodoAnalisis && (g as any).desempenoGeneral);
    if (rawRecordWithDesempeno) {
      const recordedDesempeno = (rawRecordWithDesempeno as any).desempenoGeneral;
      if (recordedDesempeno && computedDesempeno && recordedDesempeno !== computedDesempeno.nombre) {
        alertas.push(`El desempeño general reportado (${recordedDesempeno}) no coincide con el promedio calculado (${promedioGeneral.toFixed(2)} - ${computedDesempeno.nombre}).`);
      }
    }
  }

  return {
    numPerdidas,
    riesgo,
    asignaturasPerdidas,
    asignaturasEnRiesgo,
    promedioGeneral,
    causaPrincipal,
    accionSugerida,
    alertas
  };
};

/**
 * 9. calcularDatasetAcademico(calificaciones, config, periodoAnalisis, filtros)
 */
export const calcularDatasetAcademico = (
  calificaciones: CalificacionNormalizada[],
  config: ConfiguracionAcademica,
  periodoAnalisis: 'P1' | 'P2' | 'P3' | 'P4' | 'DEF',
  filtros?: {
    nivel?: string;
    grado?: number;
    curso?: string;
    area?: string;
    asignatura?: string;
    tipoAsignatura?: string;
    riesgo?: string;
    soloConPerdidas?: boolean;
    soloPromedioEnBajo?: boolean;
  }
) => {
  // Apply initial filters
  let filtered = calificaciones;
  if (filtros) {
    if (filtros.nivel && filtros.nivel !== 'Todos') {
      filtered = filtered.filter(c => c.nivel === filtros.nivel);
    }
    if (filtros.grado !== undefined && filtros.grado !== null) {
      filtered = filtered.filter(c => c.grado === filtros.grado);
    }
    if (filtros.curso && filtros.curso !== 'Todos') {
      filtered = filtered.filter(c => c.curso === filtros.curso);
    }
  }

  const groupedStudents = agruparPorEstudiante(filtered);

  let estudiantesCalculados = groupedStudents.map(studentGrades => {
    const first = studentGrades[0];
    
    // First, get ALL valid subjects to determine true academic risk
    const allValidSubjects = obtenerAsignaturasValidasParaPerdida(studentGrades, periodoAnalisis, config);
    const numPerdidasTrue = allValidSubjects.filter(s => s.nota < config.notaAprobacion).length;
    let trueRiesgo: 'Bajo' | 'Medio' | 'Alto' | 'Crítico' | 'Sin riesgo' = 'Sin riesgo';
    if (numPerdidasTrue >= config.asignaturasParaPerder) {
      trueRiesgo = 'Crítico';
    } else if (numPerdidasTrue >= config.asignaturasParaPerder - 1) {
      trueRiesgo = 'Alto';
    } else if (numPerdidasTrue > 0) {
      trueRiesgo = 'Medio';
    } else if (allValidSubjects.some(s => s.nota >= config.notaAprobacion && s.nota < config.notaAprobacion + (config.margenRiesgo ?? 0.5))) {
      trueRiesgo = 'Bajo';
    }

    // Now filter subjects based on user selection (Area, Asignatura, Tipo)
    let filteredSubjects = allValidSubjects;
    if (filtros) {
      if (filtros.area && filtros.area !== 'Todas') {
        filteredSubjects = filteredSubjects.filter(s => {
          const dict = config.diccionarioAreas.find(d => d.codigoBase === s.codigoAsignatura);
          const area = dict?.area || s.area || 'Desconocida';
          return area === filtros.area;
        });
      }
      if (filtros.asignatura && filtros.asignatura !== 'Todas') {
        filteredSubjects = filteredSubjects.filter(s => s.nombreAsignatura === filtros.asignatura);
      }
      if (filtros.tipoAsignatura && filtros.tipoAsignatura !== 'Todas') {
        filteredSubjects = filteredSubjects.filter(s => {
          const dict = config.diccionarioAreas.find(d => d.codigoBase === s.codigoAsignatura);
          const tipo = dict?.tipo || s.tipoAsignatura || 'Académica';
          if (filtros.tipoAsignatura === 'Académicas') return tipo === 'Académica';
          if (filtros.tipoAsignatura === 'Centros de interés') return tipo === 'Centro de interés';
          if (filtros.tipoAsignatura === 'Comportamiento') return tipo === 'Comportamiento';
          if (filtros.tipoAsignatura === 'No académicas') return tipo !== 'Académica' && tipo !== 'Centro de interés' && tipo !== 'Comportamiento';
          return true;
        });
      }
    }

    // Compute average over filtered subjects
    const validNotas = filteredSubjects.map(s => s.nota).filter(n => esNotaValida(n, config));
    const promedioGeneral = validNotas.length > 0 ? validNotas.reduce((a, b) => a + b, 0) / validNotas.length : null;

    // Use full risk results for the rest
    const risk = calcularRiesgoEstudiante(studentGrades, periodoAnalisis, config);

    return {
      estudianteNombre: first.estudianteNombre,
      estudianteNumero: first.estudianteNumero,
      nivel: first.nivel,
      grado: first.grado,
      curso: first.curso,
      anio: first.anio,
      promedioGeneral,
      numPerdidas: numPerdidasTrue,
      riesgo: trueRiesgo,
      asignaturasPerdidas: risk.asignaturasPerdidas,
      asignaturasEnRiesgo: risk.asignaturasEnRiesgo,
      causaPrincipal: risk.causaPrincipal,
      accionSugerida: risk.accionSugerida,
      alertas: risk.alertas,
      allGrades: studentGrades,
      filteredSubjects
    };
  });

  // Apply Risk and specific filters
  if (filtros) {
    if (filtros.riesgo && filtros.riesgo !== 'Todos') {
      if (filtros.riesgo === 'Alto/Crítico') {
        estudiantesCalculados = estudiantesCalculados.filter(e => e.riesgo === 'Alto' || e.riesgo === 'Crítico');
      } else {
        estudiantesCalculados = estudiantesCalculados.filter(e => e.riesgo === filtros.riesgo);
      }
    }
    if (filtros.soloConPerdidas) {
      estudiantesCalculados = estudiantesCalculados.filter(e => e.filteredSubjects.some(s => s.nota < config.notaAprobacion));
    }
    if (filtros.soloPromedioEnBajo) {
      estudiantesCalculados = estudiantesCalculados.filter(e => e.promedioGeneral !== null && e.promedioGeneral < config.notaAprobacion);
    }
  }

  // Collect all valid qualifications used in calculations
  const calificacionesValidas: (AsignaturaValidaParaPerdida & { perdida: boolean })[] = [];

  for (const est of estudiantesCalculados) {
    for (const sub of est.filteredSubjects) {
      calificacionesValidas.push({
        ...sub,
        perdida: sub.nota < config.notaAprobacion
      });
    }
  }

  // Collect excluded records
  const registrosExcluidos: (CalificacionNormalizada & { motivoExclusion: string })[] = [];
  
  for (const c of filtered) {
    let excluido = false;
    let motivo = '';
    
    if (periodoAnalisis === 'DEF') {
      if (c.periodo !== 'DEF' && c.periodo !== 'P1' && c.periodo !== 'P2' && c.periodo !== 'P3' && c.periodo !== 'P4') {
        excluido = true;
        motivo = `Período ${c.periodo} no aplicable al cálculo`;
      }
    } else {
      if (c.periodo !== periodoAnalisis) {
        excluido = true;
        motivo = `Período ${c.periodo} no coincide con análisis activo (${periodoAnalisis})`;
      }
    }
    
    if (!excluido) {
      const normTipo = obtenerTipoAsignaturaConDiccionario(c, config);
      if (c.codigoAsignatura === 'COMPO' || normTipo === 'Comportamiento') {
        excluido = true;
        motivo = 'Es una nota de Comportamiento (regla de exclusión)';
      } else if (c.aplica === false) {
        excluido = true;
        motivo = 'Asignatura no aplica según configuración';
      } else if (!esNotaValida(c.nota, config)) {
        excluido = true;
        motivo = `Nota inválida, vacía o fuera de rango (${c.nota})`;
      } else if (c.cuentaParaPerdida === false) {
        // Technically not excluded from the whole dataset, but from average/loss maybe?
        // Wait, AsignaturaValidaParaPerdida drops cuentaParaPerdida === false
        excluido = true;
        motivo = 'No cuenta para pérdida institucional';
      } else if (normTipo === 'Centro de interés') {
         // Did it survive the ciResolution?
         const studentKey = crearClaveEstudiante(c);
         const studentGrades = groupedStudents.find(g => crearClaveEstudiante(g[0]) === studentKey);
         if (studentGrades) {
           const resolution = resolverCentroInteresActivo(studentGrades, periodoAnalisis, config);
           if (resolution.centroActivoCodigo !== c.codigoAsignatura) {
             excluido = true;
             motivo = `Centro de interés inactivo (El activo es ${resolution.centroActivoCodigo || 'Ninguno en P2'})`;
           }
         }
      }
    }
    
    if (excluido) {
      registrosExcluidos.push({ ...c, motivoExclusion: motivo });
    }
  }

  // Calculate course summaries
  const cursoMap = new Map<string, typeof estudiantesCalculados>();
  for (const est of estudiantesCalculados) {
    const cursoKey = `${est.anio}-${est.nivel}-${est.grado}-${est.curso}`;
    if (!cursoMap.has(cursoKey)) {
      cursoMap.set(cursoKey, []);
    }
    cursoMap.get(cursoKey)!.push(est);
  }

  const resumenPorCurso = Array.from(cursoMap.values()).map((ests) => {
    const first = ests[0];
    const validAverages = ests.map(e => e.promedioGeneral).filter(p => p !== null) as number[];
    const promedioCurso = validAverages.length > 0 ? validAverages.reduce((a, b) => a + b, 0) / validAverages.length : null;

    const estudiantesCriticos = ests.filter(e => e.riesgo === 'Crítico').length;
    const estudiantesAltos = ests.filter(e => e.riesgo === 'Alto').length;
    const estudiantesMedios = ests.filter(e => e.riesgo === 'Medio').length;
    const estudiantesBajos = ests.filter(e => e.riesgo === 'Bajo').length;
    const estudiantesSinRiesgo = ests.filter(e => e.riesgo === 'Sin riesgo').length;

    const totalEstudiantes = ests.length;
    const totalNoPerdiendoAnio = ests.filter(e => e.numPerdidas < config.asignaturasParaPerder).length;
    const porcentajeAprobacion = totalEstudiantes > 0 ? (totalNoPerdiendoAnio / totalEstudiantes) * 100 : 0;

    return {
      curso: first.curso,
      nivel: first.nivel,
      grado: first.grado,
      anio: first.anio,
      cursoKey: `${first.anio}-${first.nivel}-${first.grado}-${first.curso}`,
      etiqueta: `${first.curso} (${first.nivel} ${first.grado}°)`,
      totalEstudiantes,
      promedioCurso,
      estudiantesCriticos,
      estudiantesAltos,
      estudiantesMedios,
      estudiantesBajos,
      estudiantesSinRiesgo,
      porcentajeAprobacion
    };
  });

  // Calculate subject summaries
  const asigMap = new Map<string, typeof calificacionesValidas>();
  for (const val of calificacionesValidas) {
    if (!asigMap.has(val.codigoAsignatura)) {
      asigMap.set(val.codigoAsignatura, []);
    }
    asigMap.get(val.codigoAsignatura)!.push(val);
  }

  const resumenPorAsignatura = Array.from(asigMap.entries()).map(([codigoAsignatura, vals]) => {
    const first = vals[0];
    const totalEstudiantes = vals.length;
    const notas = vals.map(v => v.nota);
    const promedioAsignatura = notas.length > 0 ? notas.reduce((a, b) => a + b, 0) / notas.length : null;

    const totalPerdidos = vals.filter(v => v.nota < config.notaAprobacion).length;
    const porcentajePerdida = totalEstudiantes > 0 ? (totalPerdidos / totalEstudiantes) * 100 : 0;

    return {
      codigoAsignatura,
      nombreAsignatura: first.nombreAsignatura,
      tipoAsignatura: first.tipoAsignatura,
      area: first.area,
      totalEstudiantes,
      promedioAsignatura,
      totalPerdidos,
      porcentajePerdida
    };
  });

  const estudiantesEnRiesgo = estudiantesCalculados.filter(e => e.riesgo !== 'Sin riesgo');

  const alertasCalculo = estudiantesCalculados.flatMap(e => e.alertas.map(a => ({
    estudiante: e.estudianteNombre,
    curso: e.curso,
    tipo: 'Inconsistencia de cálculo',
    descripcion: a
  })));

  return {
    calificacionesValidas,
    registrosExcluidos,
    estudiantesCalculados,
    resumenPorCurso,
    resumenPorAsignatura,
    estudiantesEnRiesgo,
    alertasCalculo
  };
};

/** Valores de referencia institucional (modo Académicas, sin filtros estructurales) */
export const REFERENCIA_INSTITUCIONAL = {
  P1: { totalEstudiantes: 573, promedioAcademicas: 7.72, pctPromedioBajo: 2.11, estudiantesConPerdidas: 273, riesgoAltoCritico: 112 },
  P2: { totalEstudiantes: 573, promedioAcademicas: 7.69, pctPromedioBajo: 3.15, estudiantesConPerdidas: 260, riesgoAltoCritico: 94 },
  DEF: { totalEstudiantes: 573, promedioAcademicas: 7.71, pctPromedioBajo: 1.75, estudiantesConPerdidas: 222, riesgoAltoCritico: 87 },
} as const;

export const validarContraReferencia = (
  periodo: 'P1' | 'P2' | 'P3' | 'P4' | 'DEF',
  calculado: {
    totalEstudiantes: number;
    promedioAcademicas: number | null;
    pctPromedioBajo: number;
    estudiantesConPerdidas: number;
    riesgoAltoCritico: number;
    registrosIncluidos: number;
    registrosExcluidos: number;
  },
  tolerancia = 0.15
) => {
  const ref = REFERENCIA_INSTITUCIONAL[periodo as keyof typeof REFERENCIA_INSTITUCIONAL];
  if (!ref) return [];

  const comparar = (indicador: string, esperado: number, valor: number | null, funcion: string) => {
    if (valor === null) {
      return { indicador, esperado, calculado: null, diferencia: null, funcion, registrosIncluidos: calculado.registrosIncluidos, registrosExcluidos: calculado.registrosExcluidos, coincide: false, posibleCausa: 'Sin datos calculados' };
    }
    const diferencia = valor - esperado;
    const coincide = Math.abs(diferencia) <= tolerancia;
    return {
      indicador,
      esperado,
      calculado: valor,
      diferencia: parseFloat(diferencia.toFixed(4)),
      funcion,
      registrosIncluidos: calculado.registrosIncluidos,
      registrosExcluidos: calculado.registrosExcluidos,
      coincide,
      posibleCausa: coincide ? undefined : 'Revisar filtros, centros de interés, asignaturas no aplicables o datos faltantes',
    };
  };

  return [
    comparar('Total estudiantes', ref.totalEstudiantes, calculado.totalEstudiantes, 'calcularDatasetAcademico → estudiantesCalculados.length'),
    comparar('Promedio académicas', ref.promedioAcademicas, calculado.promedioAcademicas, 'modo estudiante → promedioGeneral por estudiante'),
    comparar('% promedio Bajo académicas', ref.pctPromedioBajo, calculado.pctPromedioBajo, 'clasificarDesempeno sobre promedioGeneral'),
    comparar('Estudiantes con pérdidas académicas', ref.estudiantesConPerdidas, calculado.estudiantesConPerdidas, 'numPerdidas > 0 en estudiantesCalculados'),
    comparar('Riesgo Alto/Crítico', ref.riesgoAltoCritico, calculado.riesgoAltoCritico, 'trueRiesgo Alto o Crítico'),
  ];
};



