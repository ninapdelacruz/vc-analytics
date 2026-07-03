import React, { useMemo, useState, useCallback, useEffect, useRef } from 'react';
import { useStore } from '../store';
import {
  calcularCasosNotaNecesaria,
  agruparPorEstudiante,
  clasificarViabilidadRecuperacion,
  calcularNotaNecesariaRestante,
  obtenerAsignaturasValidasParaPerdida,
  obtenerNotaAnalisis,
  clasificarEstadoAsignatura,
  peorViabilidad,
  formatearNota,
  NOTA_NECESARIA_IMPOSIBLE,
  isPerdida,
  obtenerColumnasNotaTabla,
  PeriodoCodigo,
  ViabilidadRecuperacion,
  CasoNotaNecesaria,
} from '../utils/calculations';
import { coincideNombreEstudiante } from '../utils/studentSearch';
import { ConfiguracionAcademica } from '../types';
import { ChartTooltipBox } from '../components/ChartTooltipBox';
import {
  Search, ArrowUp, ArrowDown, ArrowUpDown, ChevronDown, ChevronUp, X, Target,
} from 'lucide-react';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip as RechartsTooltip,
  ResponsiveContainer, Cell, LabelList,
} from 'recharts';

type PeriodoAnalisis = 'P1' | 'P2' | 'P3' | 'P4' | 'DEF';
type SortKey = 'estudiante' | 'curso' | 'asignatura' | 'notaNecesaria' | 'viabilidad';
type SortDir = 'asc' | 'desc';

const VIABILIDAD_ORDER: Record<ViabilidadRecuperacion, number> = {
  Imposible: 0, 'Muy difícil': 1, Difícil: 2, Recuperable: 3,
};

const VIABILIDAD_COLORS: Record<ViabilidadRecuperacion, string> = {
  Recuperable: '#16a34a',
  Difícil: '#d97706',
  'Muy difícil': '#e11d48',
  Imposible: '#450a0a',
};

const VIABILIDAD_BG: Record<ViabilidadRecuperacion, string> = {
  Recuperable: '#16a34a18',
  Difícil: '#d9770618',
  'Muy difícil': '#e11d4818',
  Imposible: '#450a0a18',
};

const NIVELES_VIABILIDAD: ViabilidadRecuperacion[] = ['Recuperable', 'Difícil', 'Muy difícil', 'Imposible'];
const CHART_MARGIN = { top: 20, right: 12, left: 4, bottom: 4 };

const NOTA_PERIODO_KEY: Record<PeriodoCodigo, 'p1' | 'p2' | 'p3' | 'p4' | 'def'> = {
  P1: 'p1', P2: 'p2', P3: 'p3', P4: 'p4', DEF: 'def',
};

const celdaNotaClass = (nota: number | null, config: ConfiguracionAcademica) => {
  if (nota === null) return 'text-slate-300';
  if (isPerdida(nota, config)) return 'text-red-600 font-bold';
  const margen = config.margenRiesgo ?? 0.5;
  if (nota >= config.notaAprobacion && nota < config.notaAprobacion + margen) return 'text-amber-600 font-semibold';
  return 'text-slate-700';
};

interface FiltrosRecuperacion {
  viabilidad: string;
  curso: string;
  asignatura: string;
  grado: number | null;
  search: string;
}

const iniciales = (nombre: string) => {
  const p = nombre.trim().split(/\s+/).filter(Boolean);
  if (p.length === 0) return '??';
  if (p.length === 1) return p[0].slice(0, 2).toUpperCase();
  return (p[0][0] + p[1][0]).toUpperCase();
};

export const RecoveryDashboard: React.FC = () => {
  const { calificaciones, configuracion, periodoActivo } = useStore();
  const periodoAnalisis = (periodoActivo as PeriodoAnalisis) || 'P1';
  const tablaRef = useRef<HTMLDivElement>(null);

  const [filtros, setFiltros] = useState<FiltrosRecuperacion>({
    viabilidad: 'Todos', curso: 'Todos', asignatura: 'Todos', grado: null, search: '',
  });
  const [sortKey, setSortKey] = useState<SortKey>('viabilidad');
  const [sortDir, setSortDir] = useState<SortDir>('asc');
  const [showAll, setShowAll] = useState(false);

  useEffect(() => {
    setFiltros({ viabilidad: 'Todos', curso: 'Todos', asignatura: 'Todos', grado: null, search: '' });
    setShowAll(false);
  }, [periodoAnalisis]);

  const scrollToTabla = useCallback(() => {
    requestAnimationFrame(() => tablaRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' }));
  }, []);

  const aplicarFiltro = useCallback((patch: Partial<FiltrosRecuperacion>) => {
    setFiltros(prev => ({ ...prev, ...patch }));
    setShowAll(false);
    scrollToTabla();
  }, [scrollToTabla]);

  const limpiarFiltros = useCallback(() => {
    setFiltros({ viabilidad: 'Todos', curso: 'Todos', asignatura: 'Todos', grado: null, search: '' });
    setShowAll(false);
  }, []);

  const casos = useMemo(
    () => calcularCasosNotaNecesaria(calificaciones, periodoAnalisis, configuracion),
    [calificaciones, periodoAnalisis, configuracion]
  );

  const columnasNota = useMemo(
    () => obtenerColumnasNotaTabla(calificaciones, configuracion),
    [calificaciones, configuracion]
  );

  /** Clasificación por estudiante según su peor asignatura pendiente. */
  const viabilidadPorEstudiante = useMemo(() => {
    const map = new Map<string, ViabilidadRecuperacion>();
    for (const cals of agruparPorEstudiante(calificaciones)) {
      const key = `${cals[0].estudianteNumero}-${cals[0].estudianteNombre}`;
      let peor: ViabilidadRecuperacion = 'Recuperable';
      const validGrades = obtenerAsignaturasValidasParaPerdida(cals, periodoAnalisis, configuracion);
      for (const g of validGrades) {
        const match = cals.filter(c => c.codigoAsignatura === g.codigoAsignatura);
        const nota = obtenerNotaAnalisis(match, periodoAnalisis, configuracion) ?? g.nota;
        const estado = clasificarEstadoAsignatura(nota, configuracion);
        const nn = calcularNotaNecesariaRestante(match, configuracion);
        if (nn === null || (estado !== 'Perdida' && estado !== 'En riesgo')) continue;
        peor = peorViabilidad(peor, clasificarViabilidadRecuperacion(nn, configuracion));
      }
      map.set(key, peor);
    }
    return map;
  }, [calificaciones, periodoAnalisis, configuracion]);

  const totalEstudiantes = viabilidadPorEstudiante.size || 1;

  const metrics = useMemo(() => {
    const counts: Record<ViabilidadRecuperacion, number> = {
      Recuperable: 0, Difícil: 0, 'Muy difícil': 0, Imposible: 0,
    };
    viabilidadPorEstudiante.forEach(v => counts[v]++);
    const umbralAlto = configuracion.notaAprobacion + 1;
    const casosAltos = casos.filter(c => c.notaNecesaria >= umbralAlto || c.notaNecesaria === NOTA_NECESARIA_IMPOSIBLE);

    const asigMap = new Map<string, { nombre: string; altos: number }>();
    casosAltos.forEach(c => {
      const prev = asigMap.get(c.codigoAsignatura) ?? { nombre: c.nombreAsignatura, altos: 0 };
      prev.altos++;
      asigMap.set(c.codigoAsignatura, prev);
    });

    let asignaturaMasDificil: { nombre: string; pct: number } | null = null;
    asigMap.forEach(({ nombre, altos }) => {
      const pct = (altos / totalEstudiantes) * 100;
      if (!asignaturaMasDificil || pct > asignaturaMasDificil.pct) {
        asignaturaMasDificil = { nombre, pct };
      }
    });

    return {
      counts,
      totalCasos: casos.length,
      casosAltos: casosAltos.length,
      asignaturaMasDificil,
    };
  }, [viabilidadPorEstudiante, casos, configuracion.notaAprobacion, totalEstudiantes]);

  const chartViabilidad = useMemo(
    () => NIVELES_VIABILIDAD.map(n => ({
      nivel: n,
      count: metrics.counts[n],
      pct: (metrics.counts[n] / totalEstudiantes) * 100,
      fill: VIABILIDAD_COLORS[n],
    })),
    [metrics.counts, totalEstudiantes]
  );

  const chartAsignaturas = useMemo(() => {
    const umbralAlto = configuracion.notaAprobacion + 1;
    const map = new Map<string, { name: string; count: number }>();
    casos
      .filter(c => c.notaNecesaria >= umbralAlto || c.notaNecesaria === NOTA_NECESARIA_IMPOSIBLE)
      .forEach(c => {
        const prev = map.get(c.codigoAsignatura) ?? { name: c.nombreAsignatura, count: 0 };
        prev.count++;
        map.set(c.codigoAsignatura, prev);
      });
    return Array.from(map.values())
      .sort((a, b) => b.count - a.count)
      .slice(0, 8)
      .map(a => ({
        ...a,
        pct: (a.count / totalEstudiantes) * 100,
      }));
  }, [casos, configuracion.notaAprobacion, totalEstudiantes]);

  const rankingCursos = useMemo(() => {
    const map = new Map<string, { curso: string; casos: CasoNotaNecesaria[] }>();
    casos.forEach(c => {
      const prev = map.get(c.curso) ?? { curso: c.curso, casos: [] };
      prev.casos.push(c);
      map.set(c.curso, prev);
    });
    return Array.from(map.values())
      .map(({ curso, casos: cs }) => {
        const dificiles = cs.filter(c => c.viabilidad === 'Muy difícil' || c.viabilidad === 'Imposible').length;
        const indice = cs.length > 0 ? dificiles / cs.length : 0;
        return { curso, casos: cs.length, indice, dificiles };
      })
      .filter(r => r.casos >= 3)
      .sort((a, b) => b.indice - a.indice || b.casos - a.casos)
      .slice(0, 8);
  }, [casos]);

  const cursosUnicos = useMemo(
    () => Array.from(new Set(casos.map(c => c.curso))).sort((a, b) => a.localeCompare(b, 'es')),
    [casos]
  );
  const asignaturasUnicas = useMemo(
    () => Array.from(new Map(casos.map(c => [c.codigoAsignatura, c.nombreAsignatura])).entries())
      .sort((a, b) => a[1].localeCompare(b[1], 'es')),
    [casos]
  );
  const gradosUnicos = useMemo(
    () => Array.from(new Set(casos.map(c => c.grado))).sort((a, b) => a - b),
    [casos]
  );

  const casosTabla = useMemo(() => {
    let list = [...casos];
    if (filtros.viabilidad !== 'Todos') list = list.filter(c => c.viabilidad === filtros.viabilidad);
    if (filtros.curso !== 'Todos') list = list.filter(c => c.curso === filtros.curso);
    if (filtros.asignatura !== 'Todos') list = list.filter(c => c.codigoAsignatura === filtros.asignatura);
    if (filtros.grado != null) list = list.filter(c => c.grado === filtros.grado);
    if (filtros.search.trim().length >= 2) {
      list = list.filter(c => coincideNombreEstudiante(c.estudianteNombre, filtros.search));
    }

    const dir = sortDir === 'asc' ? 1 : -1;
    list.sort((a, b) => {
      switch (sortKey) {
        case 'estudiante': return dir * a.estudianteNombre.localeCompare(b.estudianteNombre, 'es');
        case 'curso': return dir * a.curso.localeCompare(b.curso, 'es');
        case 'asignatura': return dir * a.nombreAsignatura.localeCompare(b.nombreAsignatura, 'es');
        case 'notaNecesaria': {
          const na = a.notaNecesaria === NOTA_NECESARIA_IMPOSIBLE ? 9999 : a.notaNecesaria;
          const nb = b.notaNecesaria === NOTA_NECESARIA_IMPOSIBLE ? 9999 : b.notaNecesaria;
          return dir * (na - nb);
        }
        case 'viabilidad':
        default: {
          const diff = VIABILIDAD_ORDER[a.viabilidad] - VIABILIDAD_ORDER[b.viabilidad];
          if (diff !== 0) return dir * diff;
          return b.notaNecesaria - a.notaNecesaria;
        }
      }
    });
    return list;
  }, [casos, filtros, sortKey, sortDir]);

  const toggleSort = useCallback((key: SortKey) => {
    setSortKey(prev => {
      if (prev === key) {
        setSortDir(d => (d === 'asc' ? 'desc' : 'asc'));
        return prev;
      }
      setSortDir(key === 'estudiante' || key === 'curso' || key === 'asignatura' ? 'asc' : 'desc');
      return key;
    });
  }, []);

  const hayFiltros =
    filtros.viabilidad !== 'Todos' ||
    filtros.curso !== 'Todos' ||
    filtros.asignatura !== 'Todos' ||
    filtros.grado != null ||
    filtros.search.trim().length > 0;

  const SortHeader = ({ label, col, align = 'left' }: { label: string; col: SortKey; align?: 'left' | 'right' }) => (
    <th className={`px-4 py-3 ${align === 'right' ? 'text-right' : ''}`}>
      <button
        type="button"
        onClick={() => toggleSort(col)}
        className={`inline-flex items-center gap-1 hover:text-blue-700 transition-colors ${
          align === 'right' ? 'ml-auto' : ''
        } ${sortKey === col ? 'text-blue-700' : ''}`}
      >
        {label}
        {sortKey === col ? (
          sortDir === 'asc' ? <ArrowUp className="w-3 h-3" /> : <ArrowDown className="w-3 h-3" />
        ) : (
          <ArrowUpDown className="w-3 h-3 opacity-40" />
        )}
      </button>
    </th>
  );

  const visibleRows = showAll ? casosTabla : casosTabla.slice(0, 50);
  const periodosRestantes = configuracion.periodos - (periodoAnalisis === 'P1' ? 1 : periodoAnalisis === 'P2' ? 2 : periodoAnalisis === 'P3' ? 3 : periodoAnalisis === 'P4' ? 4 : 0);

  return (
    <div className="space-y-5 max-w-7xl mx-auto">
      <div>
        <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">
          Período {periodoAnalisis} · Nota mínima anual {configuracion.notaAprobacion} · escala {configuracion.notaMinima}–{configuracion.notaMaxima}
        </p>
        <p className="text-xs text-slate-600 mt-1">
          {metrics.totalCasos} casos de recuperación pendientes (estudiante + asignatura) ·{' '}
          {periodosRestantes > 0
            ? `${periodosRestantes} período${periodosRestantes !== 1 ? 's' : ''} restante${periodosRestantes !== 1 ? 's' : ''} para aprobar`
            : 'Sin períodos restantes en este análisis'}
        </p>
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-2 lg:grid-cols-5 gap-3">
        {NIVELES_VIABILIDAD.map(n => (
          <button
            key={n}
            type="button"
            onClick={() => aplicarFiltro({ viabilidad: n, curso: 'Todos', asignatura: 'Todos', grado: null })}
            className="bg-white p-4 rounded-xl shadow-sm border text-left hover:ring-2 transition-shadow"
            style={{ borderColor: `${VIABILIDAD_COLORS[n]}40`, borderBottomWidth: 4, borderBottomColor: VIABILIDAD_COLORS[n] }}
          >
            <p className="text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1 truncate">{n}</p>
            <h3 className="text-2xl font-black" style={{ color: VIABILIDAD_COLORS[n] }}>{metrics.counts[n]}</h3>
            <p className="text-[10px] text-slate-500 mt-1">
              {((metrics.counts[n] / totalEstudiantes) * 100).toFixed(1)}% estudiantes
            </p>
          </button>
        ))}
        {metrics.asignaturaMasDificil && (
          <div className="col-span-2 lg:col-span-1 bg-violet-50 p-4 rounded-xl shadow-sm border border-violet-200 border-b-4 border-b-violet-500">
            <p className="text-[10px] font-bold text-violet-600 uppercase tracking-wider mb-1 flex items-center gap-1">
              <Target className="w-3 h-3" /> Mayor dificultad
            </p>
            <h3 className="text-sm font-black text-violet-900 leading-tight truncate" title={metrics.asignaturaMasDificil.nombre}>
              {metrics.asignaturaMasDificil.nombre}
            </h3>
            <p className="text-[10px] text-violet-700 mt-1">
              Requiere nota alta en más casos
            </p>
          </div>
        )}
      </div>

      {casos.length === 0 ? (
        <div className="bg-white p-10 rounded-xl border border-slate-200 text-center">
          <p className="text-sm text-slate-600 font-medium">No hay casos de recuperación pendientes</p>
          <p className="text-xs text-slate-400 mt-2">
            En {periodoAnalisis} no quedan períodos por cursar o todos los estudiantes están al día en sus asignaturas.
          </p>
        </div>
      ) : (
        <>
          <div className="grid grid-cols-1 xl:grid-cols-12 gap-4">
            {/* Viabilidad — estrecho */}
            <div className="xl:col-span-3 bg-white p-5 rounded-xl shadow-sm border border-slate-200">
              <h3 className="text-xs font-bold text-slate-800 uppercase tracking-wider mb-1">Niveles de viabilidad</h3>
              <p className="text-[10px] text-slate-500 mb-3">Por estudiante · clic filtra tabla</p>
              <div className="h-[min(260px,40vh)] min-h-[200px]">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={chartViabilidad} margin={CHART_MARGIN}>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                    <XAxis dataKey="nivel" tick={{ fontSize: 9, fill: '#64748b', fontWeight: 600 }} axisLine={false} tickLine={false} interval={0} angle={-20} textAnchor="end" height={52} />
                    <YAxis allowDecimals={false} tick={{ fontSize: 11, fill: '#64748b', fontWeight: 600 }} axisLine={false} tickLine={false} width={36} />
                    <RechartsTooltip
                      isAnimationActive={false}
                      content={({ active, payload }) => {
                        if (!active || !payload?.length) return null;
                        const d = payload[0].payload as typeof chartViabilidad[0];
                        return (
                          <ChartTooltipBox
                            title={d.nivel}
                            lines={[`${d.count} estudiantes`, `${d.pct.toFixed(1)}% matrícula`]}
                            accent={d.nivel === 'Recuperable' ? 'blue' : 'red'}
                          />
                        );
                      }}
                    />
                    <Bar
                      dataKey="count"
                      radius={[4, 4, 0, 0]}
                      isAnimationActive={false}
                      style={{ cursor: 'pointer' }}
                      onClick={d => d?.nivel && aplicarFiltro({ viabilidad: d.nivel as string })}
                    >
                      {chartViabilidad.map(entry => (
                        <Cell
                          key={entry.nivel}
                          fill={entry.fill}
                          opacity={filtros.viabilidad === 'Todos' || filtros.viabilidad === entry.nivel ? 1 : 0.35}
                          stroke={filtros.viabilidad === entry.nivel ? '#1d4ed8' : undefined}
                          strokeWidth={filtros.viabilidad === entry.nivel ? 2 : 0}
                        />
                      ))}
                      <LabelList dataKey="count" position="top" style={{ fontSize: 10, fontWeight: 700, fill: '#475569' }} />
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>

            {/* Asignaturas — ancho */}
            <div className="xl:col-span-6 bg-white p-5 rounded-xl shadow-sm border border-slate-200">
              <h3 className="text-xs font-bold text-slate-800 uppercase tracking-wider mb-1">
                Asignaturas que exigen notas altas
              </h3>
              <p className="text-[10px] text-slate-500 mb-3">
                Casos con nota necesaria ≥ {formatearNota(configuracion.notaAprobacion + 1)} · clic filtra tabla
              </p>
              <div className="h-[min(260px,40vh)] min-h-[200px]">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={chartAsignaturas} layout="vertical" margin={{ top: 8, right: 40, left: 4, bottom: 8 }}>
                    <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="#f1f5f9" />
                    <XAxis type="number" allowDecimals={false} tick={{ fontSize: 10, fill: '#94a3b8' }} axisLine={false} tickLine={false} />
                    <YAxis dataKey="name" type="category" width={100} tick={{ fontSize: 10, fill: '#334155', fontWeight: 600 }} axisLine={false} tickLine={false} />
                    <RechartsTooltip
                      isAnimationActive={false}
                      content={({ active, payload }) => {
                        if (!active || !payload?.length) return null;
                        const d = payload[0].payload as typeof chartAsignaturas[0];
                        return (
                          <ChartTooltipBox
                            title={d.name}
                            lines={[`${d.count} casos`, `${d.pct.toFixed(1)}% de la matrícula`]}
                            accent="blue"
                          />
                        );
                      }}
                    />
                    <Bar
                      dataKey="count"
                      fill="#0284c7"
                      radius={[0, 4, 4, 0]}
                      barSize={18}
                      isAnimationActive={false}
                      style={{ cursor: 'pointer' }}
                      onClick={d => {
                        const match = casos.find(c => c.nombreAsignatura === d?.name);
                        if (match) aplicarFiltro({ asignatura: match.codigoAsignatura });
                      }}
                    >
                      <LabelList dataKey="count" position="right" style={{ fontSize: 10, fontWeight: 700, fill: '#475569' }} />
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>

            {/* Ranking cursos */}
            <div className="xl:col-span-3 bg-white p-5 rounded-xl shadow-sm border border-slate-200">
              <h3 className="text-xs font-bold text-slate-800 uppercase tracking-wider mb-1">Cursos más críticos</h3>
              <p className="text-[10px] text-slate-500 mb-3">Por % casos muy difícil / imposible</p>
              <ul className="space-y-2 max-h-[260px] overflow-y-auto">
                {rankingCursos.length === 0 ? (
                  <li className="text-xs text-slate-400">Sin datos suficientes</li>
                ) : rankingCursos.map((r, i) => (
                  <li key={r.curso}>
                    <button
                      type="button"
                      onClick={() => aplicarFiltro({ curso: r.curso })}
                      className="w-full flex items-center gap-2 text-left hover:bg-slate-50 rounded-lg px-2 py-1.5 transition-colors"
                    >
                      <span className="text-[10px] font-bold text-slate-400 w-4">{i + 1}</span>
                      <span className="text-xs font-bold text-slate-800 flex-1">{r.curso}</span>
                      <span
                        className="text-[10px] font-bold px-2 py-0.5 rounded-full tabular-nums"
                        style={{
                          backgroundColor: `${VIABILIDAD_COLORS[r.indice >= 0.5 ? 'Imposible' : r.indice >= 0.3 ? 'Muy difícil' : 'Difícil']}20`,
                          color: VIABILIDAD_COLORS[r.indice >= 0.5 ? 'Imposible' : r.indice >= 0.3 ? 'Muy difícil' : 'Difícil'],
                        }}
                      >
                        {(r.indice * 100).toFixed(0)}%
                      </span>
                    </button>
                  </li>
                ))}
              </ul>
            </div>
          </div>

          {/* Tabla */}
          <div ref={tablaRef} className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden scroll-mt-4">
            <div className="px-4 py-4 border-b border-slate-100 bg-slate-50 flex flex-col gap-3">
              <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
                <div>
                  <h3 className="text-sm font-bold text-slate-800">Estudiantes que requieren altas notas</h3>
                  <p className="text-[10px] text-slate-400">
                    {casosTabla.length} de {metrics.totalCasos} casos · {periodoAnalisis}
                  </p>
                </div>
                {hayFiltros && (
                  <button type="button" onClick={limpiarFiltros} className="inline-flex items-center gap-1 text-[10px] font-bold uppercase text-blue-700 hover:underline">
                    <X className="w-3 h-3" /> Limpiar filtros
                  </button>
                )}
              </div>

              {hayFiltros && (
                <div className="flex flex-wrap gap-1.5">
                  {filtros.viabilidad !== 'Todos' && (
                    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-blue-100 text-blue-800 text-[10px] font-bold">
                      {filtros.viabilidad}
                      <button type="button" onClick={() => aplicarFiltro({ viabilidad: 'Todos' })}><X className="w-3 h-3" /></button>
                    </span>
                  )}
                  {filtros.curso !== 'Todos' && (
                    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-blue-100 text-blue-800 text-[10px] font-bold">
                      Curso {filtros.curso}
                      <button type="button" onClick={() => aplicarFiltro({ curso: 'Todos' })}><X className="w-3 h-3" /></button>
                    </span>
                  )}
                  {filtros.asignatura !== 'Todos' && (
                    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-blue-100 text-blue-800 text-[10px] font-bold">
                      {asignaturasUnicas.find(([c]) => c === filtros.asignatura)?.[1] ?? filtros.asignatura}
                      <button type="button" onClick={() => aplicarFiltro({ asignatura: 'Todos' })}><X className="w-3 h-3" /></button>
                    </span>
                  )}
                </div>
              )}

              <div className="flex flex-col sm:flex-row flex-wrap gap-2">
                <select className="px-3 py-2 text-xs border border-slate-200 rounded-lg bg-white outline-none focus:border-blue-500" value={filtros.viabilidad} onChange={e => aplicarFiltro({ viabilidad: e.target.value })}>
                  <option value="Todos">Todas las viabilidades</option>
                  {NIVELES_VIABILIDAD.map(v => <option key={v} value={v}>{v}</option>)}
                </select>
                <select className="px-3 py-2 text-xs border border-slate-200 rounded-lg bg-white outline-none focus:border-blue-500" value={filtros.grado ?? ''} onChange={e => aplicarFiltro({ grado: e.target.value ? Number(e.target.value) : null, curso: 'Todos' })}>
                  <option value="">Todos los grados</option>
                  {gradosUnicos.map(g => <option key={g} value={g}>{g}°</option>)}
                </select>
                <select className="px-3 py-2 text-xs border border-slate-200 rounded-lg bg-white outline-none focus:border-blue-500" value={filtros.curso} onChange={e => aplicarFiltro({ curso: e.target.value })}>
                  <option value="Todos">Todos los cursos</option>
                  {cursosUnicos.map(c => <option key={c} value={c}>{c}</option>)}
                </select>
                <select className="px-3 py-2 text-xs border border-slate-200 rounded-lg bg-white outline-none focus:border-blue-500" value={filtros.asignatura} onChange={e => aplicarFiltro({ asignatura: e.target.value })}>
                  <option value="Todos">Todas las asignaturas</option>
                  {asignaturasUnicas.map(([cod, nom]) => <option key={cod} value={cod}>{nom}</option>)}
                </select>
                <div className="relative flex-1 min-w-[180px] sm:max-w-xs">
                  <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                  <input
                    type="text"
                    placeholder="Buscar estudiante..."
                    className="w-full pl-9 pr-3 py-2 text-xs border border-slate-200 rounded-lg outline-none focus:border-blue-500"
                    value={filtros.search}
                    onChange={e => setFiltros(prev => ({ ...prev, search: e.target.value }))}
                  />
                </div>
              </div>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left min-w-[800px]">
                <thead className="bg-white text-slate-500 font-bold text-[10px] uppercase tracking-wider border-b border-slate-200">
                  <tr>
                    <SortHeader label="Estudiante" col="estudiante" />
                    <SortHeader label="Curso" col="curso" />
                    <SortHeader label="Asignatura" col="asignatura" />
                    {columnasNota.map(p => (
                      <th
                        key={p}
                        className={`px-3 py-3 text-center ${periodoAnalisis === p ? 'text-blue-700 bg-blue-50/50' : ''}`}
                      >
                        {p}
                      </th>
                    ))}
                    <SortHeader label="Nota necesaria" col="notaNecesaria" align="right" />
                    <SortHeader label="Viabilidad" col="viabilidad" />
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {visibleRows.map(c => (
                    <tr key={c.id} className="hover:bg-slate-50 transition-colors">
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-2 min-w-0">
                          <span className="w-7 h-7 rounded-full bg-slate-100 text-slate-600 text-[10px] font-bold flex items-center justify-center shrink-0">
                            {iniciales(c.estudianteNombre)}
                          </span>
                          <span className="text-xs font-medium text-slate-800 truncate max-w-[160px]" title={c.estudianteNombre}>
                            {c.estudianteNombre}
                          </span>
                        </div>
                      </td>
                      <td className="px-4 py-3 text-xs text-slate-600">{c.curso}</td>
                      <td className="px-4 py-3 text-xs text-slate-700 max-w-[140px] truncate" title={c.nombreAsignatura}>{c.nombreAsignatura}</td>
                      {columnasNota.map(p => {
                        const nota = c[NOTA_PERIODO_KEY[p]];
                        return (
                          <td
                            key={p}
                            className={`px-3 py-3 text-center font-mono text-xs tabular-nums ${celdaNotaClass(nota, configuracion)} ${
                              periodoAnalisis === p ? 'bg-blue-50/30' : ''
                            }`}
                          >
                            {nota !== null ? formatearNota(nota) : '—'}
                          </td>
                        );
                      })}
                      <td className="px-4 py-3 text-right font-mono text-xs tabular-nums font-bold" style={{ color: VIABILIDAD_COLORS[c.viabilidad] }}>
                        {c.notaNecesaria === NOTA_NECESARIA_IMPOSIBLE ? 'Imposible' : formatearNota(c.notaNecesaria)}
                      </td>
                      <td className="px-4 py-3">
                        <span
                          className="inline-flex px-2 py-0.5 rounded-full text-[10px] font-bold uppercase border"
                          style={{
                            backgroundColor: VIABILIDAD_BG[c.viabilidad],
                            color: VIABILIDAD_COLORS[c.viabilidad],
                            borderColor: `${VIABILIDAD_COLORS[c.viabilidad]}55`,
                          }}
                        >
                          {c.viabilidad}
                        </span>
                      </td>
                    </tr>
                  ))}
                  {casosTabla.length === 0 && (
                    <tr>
                      <td colSpan={5 + columnasNota.length} className="px-4 py-10 text-center text-xs text-slate-400">
                        No hay casos con los filtros actuales.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>

            {casosTabla.length > 50 && (
              <div className="px-4 py-3 border-t border-slate-100 flex flex-col sm:flex-row items-center justify-between gap-2 bg-slate-50">
                <span className="text-[10px] font-bold text-slate-500 uppercase">Mostrando {visibleRows.length} de {casosTabla.length}</span>
                <button type="button" onClick={() => setShowAll(v => !v)} className="inline-flex items-center gap-1 text-xs font-bold text-blue-600 hover:underline uppercase">
                  {showAll ? <><ChevronUp className="w-3.5 h-3.5" /> Ver menos</> : <><ChevronDown className="w-3.5 h-3.5" /> Ver todos</>}
                </button>
              </div>
            )}
          </div>
        </>
      )}
    </div>
  );
};
