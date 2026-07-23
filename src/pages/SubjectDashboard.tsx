import React, { useMemo, useState, useCallback, useRef, useEffect } from 'react';
import { useStore } from '../store';
import {
  isPerdida,
  calcularPromedio,
  agruparPorEstudiante,
  obtenerAsignaturasValidasParaPerdida,
  formatearNota,
  esNotaValida,
} from '../utils/calculations';
import { CalificacionNormalizada, ConfiguracionAcademica } from '../types';
import { SubjectHeatmap, HeatmapCell, AsignaturaHeatmapMeta } from '../components/SubjectHeatmap';
import { SubjectTop10Chart } from '../components/SubjectTop10Chart';
import { ChartTooltipBox } from '../components/ChartTooltipBox';
import {
  Filter, AlertCircle, BookOpen, AlertTriangle, TrendingUp, TrendingDown,
  Target, Layers, Grid3X3, RotateCcw, X, GraduationCap,
} from 'lucide-react';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip as RechartsTooltip,
  ResponsiveContainer, Cell, LineChart, Line, LabelList,
} from 'recharts';
import { AsignaturaValidaParaPerdida } from '../types';

type PeriodoAnalisis = 'P1' | 'P2' | 'P3' | 'P4' | 'DEF';
type NivelFiltro = 'Todas' | 'Primaria' | 'Bachillerato';
type GradeRow = AsignaturaValidaParaPerdida & { nota: number };

const MIN_MUESTRA_CURSO = 5;

interface AsignaturaRow {
  asignatura: string;
  total: number;
  perdidas: number;
  pctBajo: number;
  promedio: number | null;
  cursoCritico: string;
  cursoCriticoPerdidas: number;
  cursoCriticoTotal: number;
  cursoCriticoPct: number;
  cursoCriticoMuestraPequena: boolean;
  esCentroInteres: boolean;
}

interface CursoCriticoStats {
  nombre: string;
  perdidas: number;
  total: number;
  pct: number;
  muestraPequena: boolean;
}

interface CursoDesgloseRow {
  curso: string;
  etiqueta: string;
  total: number;
  perdidas: number;
  pctBajo: number;
  promedio: number | null;
}

const esCentroInteres = (tipo: string): boolean =>
  tipo.toLowerCase().includes('centro') || tipo.toLowerCase().includes('interés') || tipo.toLowerCase().includes('interes');

/** Cuenta celdas con nota numérica válida (excluye vacías, * y fuera de rango). */
const contarNotasValidasPeriodo = (
  cals: CalificacionNormalizada[],
  per: PeriodoAnalisis,
  config: ConfiguracionAcademica,
  nivel: NivelFiltro,
  asignatura: string
): number => {
  const periodosDef = ['P1', 'P2', 'P3', 'P4', 'DEF'];
  return cals.filter(c => {
    if (nivel !== 'Todas' && c.nivel !== nivel) return false;
    if (asignatura !== 'Todas' && c.nombreAsignatura !== asignatura) return false;
    if (c.codigoAsignatura === 'COMPO') return false;
    const periodoOk = per === 'DEF' ? periodosDef.includes(c.periodo) : c.periodo === per;
    return periodoOk && esNotaValida(c.nota, config);
  }).length;
};

const calcularCursoCritico = (
  cursoMap: Map<string, { total: number; perdidas: number }>
): CursoCriticoStats => {
  let best: CursoCriticoStats | null = null;
  cursoMap.forEach((s, curso) => {
    if (s.perdidas === 0) return;
    const pct = s.total > 0 ? (s.perdidas / s.total) * 100 : 0;
    if (
      !best ||
      s.perdidas > best.perdidas ||
      (s.perdidas === best.perdidas && pct > best.pct)
    ) {
      best = {
        nombre: curso,
        perdidas: s.perdidas,
        total: s.total,
        pct,
        muestraPequena: s.total < MIN_MUESTRA_CURSO,
      };
    }
  });
  return best ?? {
    nombre: 'N/A', perdidas: 0, total: 0, pct: 0, muestraPequena: false,
  };
};

const buildHeatmapCells = (
  asignaturas: string[],
  grados: number[],
  base: GradeRow[],
  config: ConfiguracionAcademica
): HeatmapCell[] => {
  const cells: HeatmapCell[] = [];
  asignaturas.forEach(asig => {
    grados.forEach(grado => {
      const subset = base.filter(c => c.nombreAsignatura === asig && c.grado === grado);
      const perdidas = subset.filter(c => isPerdida(c.nota, config)).length;
      cells.push({
        asignatura: asig,
        grado,
        total: subset.length,
        perdidas,
        pct: subset.length > 0 ? (perdidas / subset.length) * 100 : null,
      });
    });
  });
  return cells;
};

export const SubjectDashboard: React.FC = () => {
  const { calificaciones, configuracion, periodoActivo } = useStore();
  const periodo = periodoActivo as PeriodoAnalisis;

  const [selectedNivel, setSelectedNivel] = useState<NivelFiltro>('Todas');
  const [selectedAsignatura, setSelectedAsignatura] = useState<string>('Todas');
  const [desgloseSeleccion, setDesgloseSeleccion] = useState<{ asignatura: string; grado: number } | null>(null);
  const desgloseRef = useRef<HTMLDivElement>(null);

  const baseData = useMemo(() => {
    if (calificaciones.length === 0) return null;

    const grouped = agruparPorEstudiante(calificaciones);
    const validGrades: GradeRow[] = [];
    grouped.forEach(est => {
      obtenerAsignaturasValidasParaPerdida(est, periodo, configuracion).forEach(g => {
        validGrades.push({ ...g, nota: Number(g.nota) });
      });
    });

    const asignaturasList = Array.from(new Set(validGrades.map(c => c.nombreAsignatura)))
      .sort((a, b) => a.localeCompare(b, 'es'));

    const asignaturaMeta: Record<string, AsignaturaHeatmapMeta> = {};
    validGrades.forEach(c => {
      if (!asignaturaMeta[c.nombreAsignatura]) {
        asignaturaMeta[c.nombreAsignatura] = { esCentroInteres: esCentroInteres(c.tipoAsignatura) };
      }
    });

    return { validGrades, asignaturasList, asignaturaMeta, grouped };
  }, [calificaciones, periodo, configuracion]);

  const metrics = useMemo(() => {
    if (!baseData) return null;
    const { validGrades, asignaturasList, asignaturaMeta, grouped } = baseData;

    const filteredData = validGrades.filter(c => {
      const matchNivel = selectedNivel === 'Todas' || c.nivel === selectedNivel;
      const matchAsig = selectedAsignatura === 'Todas' || c.nombreAsignatura === selectedAsignatura;
      return matchNivel && matchAsig && esNotaValida(c.nota, configuracion);
    });

    const totalNotasRegistradas = contarNotasValidasPeriodo(
      calificaciones, periodo, configuracion, selectedNivel, selectedAsignatura
    );
    const totalNotasMotor = filteredData.length;
    const promedioGeneral = calcularPromedio(filteredData.map(c => c.nota));
    const notasEnBajo = filteredData.filter(c => isPerdida(c.nota, configuracion));
    const totalEnBajo = notasEnBajo.length;
    const pctEnBajo = totalNotasMotor > 0 ? (totalEnBajo / totalNotasMotor) * 100 : 0;

    const mapAsignaturas = new Map<string, {
      total: number; perdidas: number; notas: number[];
      cursoCritico: Map<string, { total: number; perdidas: number }>;
    }>();

    filteredData.forEach(c => {
      if (!mapAsignaturas.has(c.nombreAsignatura)) {
        mapAsignaturas.set(c.nombreAsignatura, {
          total: 0, perdidas: 0, notas: [], cursoCritico: new Map(),
        });
      }
      const asig = mapAsignaturas.get(c.nombreAsignatura)!;
      asig.total++;
      asig.notas.push(c.nota);
      if (isPerdida(c.nota, configuracion)) asig.perdidas++;

      const cursoLabel = `${c.curso} (${c.nivel} ${c.grado}°)`;
      if (!asig.cursoCritico.has(cursoLabel)) {
        asig.cursoCritico.set(cursoLabel, { total: 0, perdidas: 0 });
      }
      const cursoStats = asig.cursoCritico.get(cursoLabel)!;
      cursoStats.total++;
      if (isPerdida(c.nota, configuracion)) cursoStats.perdidas++;
    });

    const listAsignaturas: AsignaturaRow[] = Array.from(mapAsignaturas.entries())
      .map(([nombre, stats]) => {
        const critico = calcularCursoCritico(stats.cursoCritico);
        return {
          asignatura: nombre,
          total: stats.total,
          perdidas: stats.perdidas,
          pctBajo: stats.total > 0 ? (stats.perdidas / stats.total) * 100 : 0,
          promedio: calcularPromedio(stats.notas),
          cursoCritico: critico.nombre,
          cursoCriticoPerdidas: critico.perdidas,
          cursoCriticoTotal: critico.total,
          cursoCriticoPct: critico.pct,
          cursoCriticoMuestraPequena: critico.muestraPequena,
          esCentroInteres: asignaturaMeta[nombre]?.esCentroInteres ?? false,
        };
      })
      .sort((a, b) => {
        if (b.perdidas !== a.perdidas) return b.perdidas - a.perdidas;
        if (b.pctBajo !== a.pctBajo) return b.pctBajo - a.pctBajo;
        return (a.promedio ?? 0) - (b.promedio ?? 0);
      });

    const listAcademicas = listAsignaturas.filter(a => !a.esCentroInteres);
    const top10Criticas = listAcademicas.slice(0, 10);
    const asignaturaCriticaAcademica = listAcademicas[0] ?? null;
    const asignaturaCriticaCI = listAsignaturas.find(a => a.esCentroInteres && a.perdidas > 0) ?? null;

    const calcularTrendPeriodo = (per: PeriodoAnalisis) => {
      const periodValidGrades: GradeRow[] = [];
      grouped.forEach(est => {
        obtenerAsignaturasValidasParaPerdida(est, per, configuracion).forEach(g => {
          periodValidGrades.push({ ...g, nota: Number(g.nota) });
        });
      });
      const filtered = periodValidGrades.filter(c => {
        const matchNivel = selectedNivel === 'Todas' || c.nivel === selectedNivel;
        const matchAsig = selectedAsignatura === 'Todas' || c.nombreAsignatura === selectedAsignatura;
        return matchNivel && matchAsig;
      });
      const lost = filtered.filter(c => isPerdida(c.nota, configuracion));
      if (filtered.length === 0) return { pct: null as number | null, hasData: false };
      return { pct: (lost.length / filtered.length) * 100, hasData: true };
    };

    const trendData = (['P1', 'P2', 'P3', 'P4'] as PeriodoAnalisis[]).map(p => ({
      periodo: p,
      ...calcularTrendPeriodo(p),
    }));

    const trendMaxPct = Math.max(
      ...trendData.filter(d => d.hasData && d.pct != null).map(d => d.pct!),
      10
    );

    let primariaTotal = 0, primariaPerdidas = 0, bachilleratoTotal = 0, bachilleratoPerdidas = 0;
    filteredData.forEach(c => {
      if (c.nivel === 'Primaria') {
        primariaTotal++;
        if (isPerdida(c.nota, configuracion)) primariaPerdidas++;
      } else if (c.nivel === 'Bachillerato') {
        bachilleratoTotal++;
        if (isPerdida(c.nota, configuracion)) bachilleratoPerdidas++;
      }
    });

    const compareData = [
      {
        name: 'Primaria',
        enBajoPct: primariaTotal > 0 ? (primariaPerdidas / primariaTotal) * 100 : 0,
        estudiantesBajo: primariaPerdidas,
      },
      {
        name: 'Bachillerato',
        enBajoPct: bachilleratoTotal > 0 ? (bachilleratoPerdidas / bachilleratoTotal) * 100 : 0,
        estudiantesBajo: bachilleratoPerdidas,
      },
    ];

    const heatmapGrados = ([...new Set(validGrades.map(c => c.grado))] as number[]).sort((a, b) => a - b);
    const heatmapGradosCI = heatmapGrados.filter(g => g >= 6);
    const heatmapBase = validGrades.filter(c => selectedNivel === 'Todas' || c.nivel === selectedNivel);

    const asignaturasAcademicas = asignaturasList.filter(a => !asignaturaMeta[a]?.esCentroInteres);
    const asignaturasCI = asignaturasList.filter(a => asignaturaMeta[a]?.esCentroInteres);

    const heatmapAcademicoCells = buildHeatmapCells(asignaturasAcademicas, heatmapGrados, heatmapBase, configuracion);
    const heatmapCICells = buildHeatmapCells(asignaturasCI, heatmapGradosCI, heatmapBase, configuracion);

    let desgloseCursos: CursoDesgloseRow[] = [];
    if (desgloseSeleccion) {
      const subset = heatmapBase.filter(
        c => c.nombreAsignatura === desgloseSeleccion.asignatura && c.grado === desgloseSeleccion.grado
      );
      const porCurso = new Map<string, { notas: number[]; nivel: string }>();
      subset.forEach(c => {
        if (!porCurso.has(c.curso)) {
          porCurso.set(c.curso, { notas: [], nivel: c.nivel });
        }
        porCurso.get(c.curso)!.notas.push(c.nota);
      });
      desgloseCursos = Array.from(porCurso.entries())
        .map(([curso, data]) => {
          const perdidas = data.notas.filter(n => isPerdida(n, configuracion)).length;
          return {
            curso,
            etiqueta: `${curso} (${data.nivel} ${desgloseSeleccion.grado}°)`,
            total: data.notas.length,
            perdidas,
            pctBajo: data.notas.length > 0 ? (perdidas / data.notas.length) * 100 : 0,
            promedio: calcularPromedio(data.notas),
          };
        })
        .sort((a, b) => b.perdidas - a.perdidas || b.pctBajo - a.pctBajo);
    }

    return {
      promedioGeneral,
      totalNotasRegistradas,
      totalNotasMotor,
      totalEnBajo,
      pctEnBajo,
      listAsignaturas,
      top10Criticas,
      asignaturaCriticaAcademica,
      asignaturaCriticaCI,
      asignaturasList,
      asignaturasAcademicas,
      asignaturasCI,
      trendData,
      trendMaxPct,
      compareData,
      heatmapGrados,
      heatmapGradosCI,
      heatmapAcademicoCells,
      heatmapCICells,
      asignaturaMeta,
      desgloseCursos,
    };
  }, [baseData, calificaciones, selectedNivel, selectedAsignatura, desgloseSeleccion, configuracion, periodo]);

  const limpiarFiltros = useCallback(() => {
    setSelectedNivel('Todas');
    setSelectedAsignatura('Todas');
    setDesgloseSeleccion(null);
  }, []);

  const handleHeatmapClick = useCallback((asignatura: string, grado: number) => {
    setDesgloseSeleccion(prev =>
      prev?.asignatura === asignatura && prev?.grado === grado
        ? null
        : { asignatura, grado }
    );
  }, []);

  useEffect(() => {
    if (!desgloseSeleccion) return;
    // Esperar al render del panel antes de hacer scroll
    const id = requestAnimationFrame(() => {
      desgloseRef.current?.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    });
    return () => cancelAnimationFrame(id);
  }, [desgloseSeleccion]);

  const tieneFiltros = selectedNivel !== 'Todas' || selectedAsignatura !== 'Todas' || desgloseSeleccion !== null;

  if (!metrics) {
    return <div className="p-8 text-center text-slate-500 text-sm">Cargando datos del análisis por asignatura...</div>;
  }

  const asignaturaCritica = metrics.asignaturaCriticaAcademica;
  const trendDomainMax = Math.min(100, Math.ceil(metrics.trendMaxPct * 1.15));

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-5 fade-in">
      {/* Header */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-800">Análisis por Asignatura</h1>
          <p className="text-[10px] text-slate-400 mt-0.5 uppercase tracking-wide">
            Período activo: {periodo} · Solo calificaciones con nota válida registrada
          </p>
        </div>
        <div className="flex flex-wrap gap-2 items-center">
          <div className="flex items-center gap-2 bg-white px-3 py-1.5 rounded-lg border border-slate-200">
            <Layers className="w-4 h-4 text-slate-400" />
            <select
              className="text-xs bg-transparent outline-none text-slate-700 font-medium"
              value={selectedNivel}
              onChange={e => setSelectedNivel(e.target.value as NivelFiltro)}
            >
              <option value="Todas">Todos los niveles</option>
              <option value="Primaria">Primaria</option>
              <option value="Bachillerato">Bachillerato</option>
            </select>
          </div>
          <div className="flex items-center gap-2 bg-white px-3 py-1.5 rounded-lg border border-slate-200">
            <BookOpen className="w-4 h-4 text-slate-400" />
            <select
              className="text-xs bg-transparent outline-none text-slate-700 font-medium max-w-[180px]"
              value={selectedAsignatura}
              onChange={e => setSelectedAsignatura(e.target.value)}
            >
              <option value="Todas">Todas las asignaturas</option>
              {metrics.asignaturasList.map(a => (
                <option key={a} value={a}>{a}</option>
              ))}
            </select>
          </div>
        </div>
      </div>

      {tieneFiltros && (
        <div className="flex flex-wrap items-center gap-2 px-3 py-2 bg-blue-50 border border-blue-200 rounded-lg">
          <Filter className="w-3.5 h-3.5 text-blue-600" />
          <span className="text-[10px] font-bold text-blue-700 uppercase">Filtros activos:</span>
          {selectedNivel !== 'Todas' && (
            <span className="inline-flex items-center gap-1 px-2 py-0.5 bg-white border border-blue-300 rounded text-[10px] font-bold text-blue-700">
              Nivel: {selectedNivel}
              <button type="button" onClick={() => setSelectedNivel('Todas')}><X className="w-3 h-3" /></button>
            </span>
          )}
          {selectedAsignatura !== 'Todas' && (
            <span className="inline-flex items-center gap-1 px-2 py-0.5 bg-white border border-blue-300 rounded text-[10px] font-bold text-blue-700">
              Asignatura: {selectedAsignatura}
              <button type="button" onClick={() => setSelectedAsignatura('Todas')}><X className="w-3 h-3" /></button>
            </span>
          )}
          {desgloseSeleccion && (
            <span className="inline-flex items-center gap-1 px-2 py-0.5 bg-white border border-blue-300 rounded text-[10px] font-bold text-blue-700">
              Mapa: {desgloseSeleccion.asignatura} · {desgloseSeleccion.grado}°
              <button type="button" onClick={() => setDesgloseSeleccion(null)}><X className="w-3 h-3" /></button>
            </span>
          )}
          <button type="button" onClick={limpiarFiltros} className="ml-auto inline-flex items-center gap-1 text-[10px] font-bold text-blue-600 hover:underline uppercase">
            <RotateCcw className="w-3 h-3" /> Limpiar
          </button>
        </div>
      )}

      {/* KPIs — etiquetas más claras */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-6 gap-4">
        <div className="bg-white p-4 rounded-xl shadow-sm border border-slate-200">
          <div className="flex items-center gap-3 mb-2">
            <div className="w-8 h-8 rounded-full bg-blue-100 flex items-center justify-center text-blue-600">
              <TrendingUp className="w-4 h-4" />
            </div>
            <h3 className="text-xs font-bold text-slate-500 uppercase tracking-wider">Promedio de notas</h3>
          </div>
          <div className="text-2xl font-black text-slate-800">
            {metrics.promedioGeneral != null ? formatearNota(metrics.promedioGeneral) : 'N/A'}
          </div>
          <p className="text-[10px] text-slate-400 mt-1">Media de todas las calificaciones del filtro</p>
        </div>

        <div className="bg-white p-4 rounded-xl shadow-sm border border-slate-200">
          <div className="flex items-center gap-3 mb-2">
            <div className="w-8 h-8 rounded-full bg-indigo-100 flex items-center justify-center text-indigo-600">
              <BookOpen className="w-4 h-4" />
            </div>
            <h3 className="text-xs font-bold text-slate-500 uppercase tracking-wider">Notas válidas</h3>
          </div>
          <div className="text-2xl font-black text-slate-800">{metrics.totalNotasRegistradas.toLocaleString('es-CO')}</div>
          <p className="text-[10px] text-slate-400 mt-1">Celdas con nota numérica (vacías excluidas)</p>
        </div>

        <div className="bg-white p-4 rounded-xl shadow-sm border border-slate-200 border-b-4 border-b-red-400">
          <div className="flex items-center gap-3 mb-2">
            <div className="w-8 h-8 rounded-full bg-red-100 flex items-center justify-center text-red-600">
              <AlertTriangle className="w-4 h-4" />
            </div>
            <h3 className="text-xs font-bold text-slate-500 uppercase tracking-wider">Estudiantes en Bajo</h3>
          </div>
          <div className="text-2xl font-black text-slate-800">{metrics.totalEnBajo.toLocaleString('es-CO')}</div>
          <p className="text-[10px] text-red-500 mt-1 font-bold">Con nota &lt; {configuracion.notaAprobacion.toFixed(1)} en el análisis</p>
        </div>

        <div className="bg-white p-4 rounded-xl shadow-sm border border-slate-200 border-b-4 border-b-orange-400">
          <div className="flex items-center gap-3 mb-2">
            <div className="w-8 h-8 rounded-full bg-orange-100 flex items-center justify-center text-orange-600">
              <TrendingDown className="w-4 h-4" />
            </div>
            <h3 className="text-xs font-bold text-slate-500 uppercase tracking-wider">% en Bajo</h3>
          </div>
          <div className="text-2xl font-black text-slate-800">{metrics.pctEnBajo.toFixed(1)}%</div>
          <p className="text-[10px] text-slate-400 mt-1">Sobre {metrics.totalNotasMotor.toLocaleString('es-CO')} notas del motor</p>
        </div>

        <div className="bg-white p-4 rounded-xl shadow-sm border border-slate-200 col-span-1 lg:col-span-2">
          <div className="flex items-center gap-3 mb-2">
            <div className="w-8 h-8 rounded-full bg-purple-100 flex items-center justify-center text-purple-600">
              <Target className="w-4 h-4" />
            </div>
            <h3 className="text-xs font-bold text-slate-500 uppercase tracking-wider">Asignatura académica más crítica</h3>
          </div>
          <div className="text-lg font-black text-slate-800 truncate">
            {asignaturaCritica?.asignatura || 'N/A'}
          </div>
          <p className="text-[10px] text-slate-400 mt-1">
            {asignaturaCritica
              ? `${asignaturaCritica.perdidas} estudiantes en Bajo (${asignaturaCritica.pctBajo.toFixed(1)}%) · Peor curso: ${asignaturaCritica.cursoCritico} (${asignaturaCritica.cursoCriticoPerdidas}/${asignaturaCritica.cursoCriticoTotal})`
              : '—'}
          </p>
        </div>
      </div>

      {/* Gráficos (sin mapa de calor) */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-5">
        <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm flex flex-col min-h-[320px] lg:col-span-5">
          <h3 className="text-xs font-bold text-slate-800 uppercase tracking-wider mb-1">
            Top 10 asignaturas críticas ({periodo})
          </h3>
          <p className="text-[10px] text-slate-400 mb-2">Solo académicas · ranking por nº de estudiantes en Bajo (no %)</p>
          <SubjectTop10Chart data={metrics.top10Criticas} />
        </div>

        <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm flex flex-col min-h-[320px] lg:col-span-4">
          <h3 className="text-xs font-bold text-slate-800 uppercase tracking-wider mb-1">
            Tendencia % en Bajo
          </h3>
          <p className="text-[10px] text-slate-400 mb-2">Evolución por período académico</p>
          <div className="flex-1 min-h-[220px]">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={metrics.trendData} margin={{ top: 16, right: 8, left: -8, bottom: 5 }}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                <XAxis dataKey="periodo" axisLine={false} tickLine={false} tick={{ fontSize: 12, fill: '#64748b', fontWeight: 700 }} />
                <YAxis
                  axisLine={false} tickLine={false} tick={{ fontSize: 11, fill: '#64748b' }}
                  domain={[0, trendDomainMax]} tickFormatter={v => `${v}%`} width={36}
                />
                <RechartsTooltip
                  isAnimationActive={false}
                  content={({ active, payload }) => {
                    if (!active || !payload?.length) return null;
                    const d = payload[0].payload as { periodo: string; pct: number | null; hasData: boolean };
                    if (!d.hasData) return <ChartTooltipBox title={d.periodo} lines={['Sin datos']} accent="neutral" />;
                    return <ChartTooltipBox title={d.periodo} lines={[`${d.pct!.toFixed(1)}% notas en Bajo`]} accent="blue" />;
                  }}
                />
                <Line
                  type="monotone" dataKey="pct" stroke="#16a34a" strokeWidth={2.5} isAnimationActive={false}
                  connectNulls={false}
                  dot={(props: { cx?: number; cy?: number; payload?: { hasData?: boolean } }) =>
                    props.payload?.hasData && props.cx != null && props.cy != null
                      ? <circle cx={props.cx} cy={props.cy} r={5} fill="#16a34a" stroke="#fff" strokeWidth={2} />
                      : <g />
                  }
                >
                  <LabelList
                    dataKey="pct" position="top" offset={8}
                    formatter={(v: number) => (v != null && !isNaN(v) ? `${v.toFixed(1)}%` : '')}
                    style={{ fontSize: 11, fontWeight: 700, fill: '#166534' }}
                  />
                </Line>
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm flex flex-col min-h-[320px] lg:col-span-3">
          <h3 className="text-xs font-bold text-slate-800 uppercase tracking-wider mb-1">
            Comparativo por nivel
          </h3>
          <p className="text-[10px] text-slate-400 mb-2">Primaria vs Bachillerato · % notas en Bajo</p>
          <div className="flex-1 min-h-[220px]">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={metrics.compareData} margin={{ top: 16, right: 8, left: -8, bottom: 5 }}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{ fontSize: 12, fill: '#64748b', fontWeight: 700 }} />
                <YAxis axisLine={false} tickLine={false} tick={{ fontSize: 11, fill: '#64748b' }} tickFormatter={v => `${v}%`} width={36} />
                <RechartsTooltip
                  isAnimationActive={false}
                  content={({ active, payload }) => {
                    if (!active || !payload?.length) return null;
                    const d = payload[0].payload as { name: string; enBajoPct: number; estudiantesBajo: number };
                    return (
                      <ChartTooltipBox
                        title={d.name}
                        lines={[`${d.estudiantesBajo} notas en Bajo`, `${d.enBajoPct.toFixed(1)}% del nivel`]}
                        accent="blue"
                      />
                    );
                  }}
                />
                <Bar dataKey="enBajoPct" radius={[4, 4, 0, 0]} barSize={36} isAnimationActive={false}>
                  <Cell fill="#3b82f6" />
                  <Cell fill="#6366f1" />
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>

      {/* Tabla resumen + lectura automática */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
        <div className="bg-white border border-slate-200 rounded-xl overflow-hidden shadow-sm lg:col-span-2">
          <div className="px-5 py-4 border-b border-slate-100 flex justify-between items-center bg-slate-50">
            <div>
              <h3 className="text-sm font-bold text-slate-800">Resumen por asignatura</h3>
              <p className="text-[10px] text-slate-400">Una fila por asignatura · {periodo}</p>
            </div>
            <span className="text-[10px] font-bold text-slate-500 bg-white px-2 py-1 rounded border border-slate-200 uppercase">
              {metrics.listAsignaturas.length} asignaturas
            </span>
          </div>
          <div className="overflow-x-auto overflow-y-auto max-h-[min(420px,55vh)] scroll-smooth">
            <table className="w-full text-left border-collapse min-w-[520px]">
              <thead>
                <tr className="bg-white border-b border-slate-200 sticky top-0 z-10 shadow-sm">
                  <th className="py-3 px-4 text-[10px] font-bold text-slate-500 uppercase">Asignatura</th>
                  <th className="py-3 px-4 text-[10px] font-bold text-slate-500 uppercase text-center">Notas</th>
                  <th className="py-3 px-4 text-[10px] font-bold text-slate-500 uppercase text-center">Est. en Bajo</th>
                  <th className="py-3 px-4 text-[10px] font-bold text-slate-500 uppercase text-center">% Bajo</th>
                  <th className="py-3 px-4 text-[10px] font-bold text-slate-500 uppercase text-center">Promedio</th>
                  <th className="py-3 px-4 text-[10px] font-bold text-slate-500 uppercase">Curso más crítico</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {metrics.listAsignaturas.length === 0 && (
                  <tr>
                    <td colSpan={6} className="py-8 text-center text-xs text-slate-400">
                      No hay asignaturas que coincidan con los filtros
                    </td>
                  </tr>
                )}
                {metrics.listAsignaturas.map(asig => (
                  <tr key={asig.asignatura} className="hover:bg-slate-50 transition-colors">
                    <td className="py-3 px-4">
                      <div className="flex items-center gap-1.5">
                        {asig.esCentroInteres && (
                          <span className="shrink-0 text-[9px] font-bold uppercase text-violet-600 bg-violet-50 px-1 py-0.5 rounded border border-violet-200">
                            C.I.
                          </span>
                        )}
                        <span className="text-xs font-bold text-slate-700">{asig.asignatura}</span>
                      </div>
                    </td>
                    <td className="py-3 px-4 text-xs text-slate-600 text-center font-medium tabular-nums">{asig.total}</td>
                    <td className="py-3 px-4 text-xs font-bold text-red-500 text-center tabular-nums">{asig.perdidas}</td>
                    <td className="py-3 px-4 text-center">
                      <span className={`text-[10px] font-bold px-2 py-1 rounded-full tabular-nums ${
                        asig.pctBajo > 20 ? 'bg-red-100 text-red-700' :
                        asig.pctBajo > 10 ? 'bg-orange-100 text-orange-700' : 'bg-green-100 text-green-700'
                      }`}>
                        {asig.pctBajo.toFixed(1)}%
                      </span>
                    </td>
                    <td className="py-3 px-4 text-xs text-slate-600 text-center font-mono font-medium">
                      {asig.promedio != null ? formatearNota(asig.promedio) : 'N/A'}
                    </td>
                    <td className="py-3 px-4">
                      <div className="text-xs font-medium text-slate-700">{asig.cursoCritico}</div>
                      {asig.cursoCriticoPerdidas > 0 ? (
                        <div className="text-[10px] text-slate-500 tabular-nums">
                          <span className="text-red-500 font-bold">{asig.cursoCriticoPerdidas}</span>
                          {' de '}
                          {asig.cursoCriticoTotal}
                          {' en Bajo '}
                          ({asig.cursoCriticoPct.toFixed(1)}%)
                          {asig.cursoCriticoMuestraPequena && (
                            <span className="text-amber-600 font-bold ml-1">· n pequeño</span>
                          )}
                        </div>
                      ) : (
                        <div className="text-[10px] text-slate-400">Sin pérdidas por curso</div>
                      )}
                    </td>
                  </tr>
                ))}
                <tr aria-hidden="true"><td colSpan={6} className="h-3" /></tr>
              </tbody>
            </table>
          </div>
        </div>

        <div className="bg-slate-800 border border-slate-700 p-5 rounded-xl shadow-inner flex flex-col">
          <div className="flex items-center gap-3 mb-4">
            <div className="p-2 bg-slate-700 text-blue-400 rounded-lg">
              <AlertCircle className="w-5 h-5" />
            </div>
            <h4 className="text-[10px] font-bold text-slate-300 uppercase tracking-widest">Lectura automática</h4>
          </div>
          <div className="space-y-3 text-xs text-slate-300 leading-relaxed">
            {asignaturaCritica ? (
              <>
                <p>
                  La asignatura académica con más estudiantes en Bajo es{' '}
                  <strong className="text-red-400">{asignaturaCritica.asignatura}</strong>:{' '}
                  <strong className="text-white">{asignaturaCritica.perdidas}</strong> estudiantes
                  ({asignaturaCritica.pctBajo.toFixed(1)}% de {asignaturaCritica.total} notas).
                </p>
                <p>
                  El curso con más pérdidas ahí es{' '}
                  <strong className="text-white">{asignaturaCritica.cursoCritico}</strong>
                  {' '}({asignaturaCritica.cursoCriticoPerdidas} de {asignaturaCritica.cursoCriticoTotal} en Bajo).
                  {asignaturaCritica.cursoCriticoMuestraPequena && (
                    <span className="text-amber-400"> Muestra pequeña: interpretar el % con cautela.</span>
                  )}
                </p>
                {metrics.asignaturaCriticaCI && (
                  <p className="text-slate-400">
                    C.I. con más pérdidas:{' '}
                    <strong className="text-violet-300">{metrics.asignaturaCriticaCI.asignatura}</strong>
                    {' '}({metrics.asignaturaCriticaCI.perdidas} de {metrics.asignaturaCriticaCI.total} notas).
                  </p>
                )}
                {metrics.top10Criticas.length > 1 && (
                  <p>
                    Otras académicas:{' '}
                    <strong className="text-amber-300">{metrics.top10Criticas[1].asignatura}</strong>
                    {' '}({metrics.top10Criticas[1].perdidas})
                    {metrics.top10Criticas[2] && (
                      <>, <strong className="text-amber-300">{metrics.top10Criticas[2].asignatura}</strong> ({metrics.top10Criticas[2].perdidas})</>
                    )}.
                  </p>
                )}
                <p className="text-slate-400 text-[10px] pt-1 border-t border-slate-700">
                  El curso crítico se elige por cantidad de pérdidas, no solo por %. Usa el mapa de calor para comparar 6A vs 6B.
                </p>
              </>
            ) : (
              <p>No hay datos suficientes con los filtros actuales.</p>
            )}
          </div>
        </div>
      </div>

      {/* Mapas de calor — ancho completo al final */}
      <div className="space-y-5">
        <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm w-full">
          <h3 className="text-xs font-bold text-slate-800 uppercase tracking-wider mb-1 flex items-center gap-1.5">
            <Grid3X3 className="w-3.5 h-3.5 text-slate-400" />
            Mapa de calor · Asignaturas académicas ({periodo})
          </h3>
          <p className="text-[10px] text-slate-400 mb-4">
            {metrics.asignaturasAcademicas.length} asignaturas · % notas en Bajo por grado · clic para comparar cursos
          </p>
          <SubjectHeatmap
            asignaturas={metrics.asignaturasAcademicas}
            grados={metrics.heatmapGrados}
            cells={metrics.heatmapAcademicoCells}
            meta={metrics.asignaturaMeta}
            selectedCell={desgloseSeleccion}
            onCellClick={handleHeatmapClick}
          />
        </div>

        {metrics.asignaturasCI.length > 0 && (
          <div className="bg-white p-5 rounded-xl border border-violet-200 shadow-sm w-full">
            <h3 className="text-xs font-bold text-violet-900 uppercase tracking-wider mb-1 flex items-center gap-1.5">
              <Grid3X3 className="w-3.5 h-3.5 text-violet-400" />
              Mapa de calor · Centros de interés ({periodo})
            </h3>
            <p className="text-[10px] text-violet-600 mb-4">
              {metrics.asignaturasCI.length} centros · solo Bachillerato (6°–11°) · verde = estudiantes sin pérdidas
            </p>
            <SubjectHeatmap
              asignaturas={metrics.asignaturasCI}
              grados={metrics.heatmapGradosCI}
              cells={metrics.heatmapCICells}
              meta={metrics.asignaturaMeta}
              selectedCell={desgloseSeleccion}
              onCellClick={handleHeatmapClick}
              variant="centroInteres"
            />
          </div>
        )}
      </div>

      {/* Desglose por curso (justo debajo del mapa, al seleccionar celda) */}
      {desgloseSeleccion && (
        <div
          ref={desgloseRef}
          className="bg-white border-2 border-blue-200 rounded-xl overflow-hidden shadow-sm"
        >
          <div className="px-5 py-4 border-b border-blue-100 flex flex-col sm:flex-row sm:justify-between sm:items-center gap-2 bg-blue-50">
            <div className="flex items-center gap-2">
              <GraduationCap className="w-5 h-5 text-blue-600" />
              <div>
                <h3 className="text-sm font-bold text-slate-800">
                  Desglose por curso · {desgloseSeleccion.asignatura} · {desgloseSeleccion.grado}°
                </h3>
                <p className="text-[10px] text-slate-500">
                  Compara el desempeño de cada curso en esta asignatura y grado · {periodo}
                </p>
              </div>
            </div>
            <button
              type="button"
              onClick={() => setDesgloseSeleccion(null)}
              className="text-[10px] font-bold text-blue-600 hover:underline uppercase flex items-center gap-1"
            >
              <X className="w-3 h-3" /> Cerrar desglose
            </button>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse min-w-[480px]">
              <thead>
                <tr className="bg-white border-b border-slate-200">
                  <th className="py-3 px-5 text-[10px] font-bold text-slate-500 uppercase">Curso</th>
                  <th className="py-3 px-4 text-[10px] font-bold text-slate-500 uppercase text-center">Notas</th>
                  <th className="py-3 px-4 text-[10px] font-bold text-slate-500 uppercase text-center">Est. en Bajo</th>
                  <th className="py-3 px-4 text-[10px] font-bold text-slate-500 uppercase text-center">% Bajo</th>
                  <th className="py-3 px-4 text-[10px] font-bold text-slate-500 uppercase text-center">Promedio</th>
                  <th className="py-3 px-5 text-[10px] font-bold text-slate-500 uppercase">Comparación</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {metrics.desgloseCursos.length === 0 && (
                  <tr>
                    <td colSpan={6} className="py-8 text-center text-xs text-slate-400">
                      Sin datos para {desgloseSeleccion.asignatura} en {desgloseSeleccion.grado}°
                    </td>
                  </tr>
                )}
                {metrics.desgloseCursos.map((row, idx) => {
                  const esPeor = idx === 0 && row.perdidas > 0;
                  const esMejor = idx === metrics.desgloseCursos.length - 1 && metrics.desgloseCursos.length > 1 && row.perdidas === 0;
                  return (
                    <tr key={row.curso} className={`${esPeor ? 'bg-red-50/60' : esMejor ? 'bg-green-50/40' : 'hover:bg-slate-50'} transition-colors`}>
                      <td className="py-3 px-5 text-xs font-bold text-slate-800">{row.etiqueta}</td>
                      <td className="py-3 px-4 text-xs text-slate-600 text-center tabular-nums">{row.total}</td>
                      <td className="py-3 px-4 text-xs font-bold text-red-500 text-center tabular-nums">{row.perdidas}</td>
                      <td className="py-3 px-4 text-center">
                        <span className={`text-[10px] font-bold px-2 py-1 rounded-full tabular-nums ${
                          row.pctBajo > 20 ? 'bg-red-100 text-red-700' :
                          row.pctBajo > 10 ? 'bg-orange-100 text-orange-700' : 'bg-green-100 text-green-700'
                        }`}>
                          {row.pctBajo.toFixed(1)}%
                        </span>
                      </td>
                      <td className="py-3 px-4 text-xs text-slate-600 text-center font-mono font-medium">
                        {row.promedio != null ? formatearNota(row.promedio) : 'N/A'}
                      </td>
                      <td className="py-3 px-5">
                        {esPeor && (
                          <span className="text-[10px] font-bold text-red-600 uppercase">Más afectado</span>
                        )}
                        {esMejor && (
                          <span className="text-[10px] font-bold text-green-600 uppercase">Mejor desempeño</span>
                        )}
                        {!esPeor && !esMejor && idx === metrics.desgloseCursos.length - 1 && metrics.desgloseCursos.length === 1 && (
                          <span className="text-[10px] text-slate-400">Único curso en este grado</span>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
};
