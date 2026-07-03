import React, { useMemo, useState, useCallback, useEffect, useRef } from 'react';
import { useStore } from '../store';
import { calcularRiesgoEstudiante, agruparPorEstudiante, formatearNota } from '../utils/calculations';
import { coincideNombreEstudiante } from '../utils/studentSearch';
import { ChartTooltipBox } from '../components/ChartTooltipBox';
import {
  Search, ArrowUp, ArrowDown, ArrowUpDown, ChevronDown, ChevronUp, ChevronLeft, X,
} from 'lucide-react';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip as RechartsTooltip,
  ResponsiveContainer, Cell, LabelList,
} from 'recharts';

type PeriodoAnalisis = 'P1' | 'P2' | 'P3' | 'P4' | 'DEF';
type SortKey = 'nombre' | 'curso' | 'perdidas' | 'promedio' | 'riesgo';
type SortDir = 'asc' | 'desc';
type VistaUbicacion = 'grado' | 'curso';
type RiesgoRelevante = 'Crítico' | 'Alto' | 'Medio';

interface EstudianteRiesgo {
  id: string;
  nombre: string;
  grado: number;
  curso: string;
  asignaturasPerdidas: number;
  promedio: number | null;
  riesgo: RiesgoRelevante | 'Bajo' | 'Sin riesgo';
  asignaturasPerdidasLista: string;
}

const RISK_ORDER: Record<string, number> = {
  Crítico: 0, Alto: 1, Medio: 2, Bajo: 3, 'Sin riesgo': 4,
};

/** Paleta con alto contraste entre niveles */
const RISK_COLORS: Record<RiesgoRelevante, string> = {
  Crítico: '#450a0a',
  Alto: '#e11d48',
  Medio: '#0284c7',
};

const RISK_BG: Record<RiesgoRelevante, string> = {
  Crítico: '#450a0a18',
  Alto: '#e11d4818',
  Medio: '#0284c718',
};

const NIVELES_FILTRO = ['Todos', 'Crítico', 'Alto', 'Medio'] as const;
const CHART_MARGIN = { top: 20, right: 12, left: 4, bottom: 4 };

const esEstudianteEnRiesgoPerdida = (e: EstudianteRiesgo): e is EstudianteRiesgo & { riesgo: RiesgoRelevante } =>
  e.asignaturasPerdidas >= 1 && (e.riesgo === 'Crítico' || e.riesgo === 'Alto' || e.riesgo === 'Medio');

interface UbicacionRow {
  key: string;
  label: string;
  grado?: number;
  curso?: string;
  critico: number;
  alto: number;
  medio: number;
  total: number;
}

interface FiltroActivo {
  grado: number | null;
  curso: string;
  riesgo: string;
  perdidas: number | null;
  search: string;
  soloUrgente: boolean;
}

export const RiskDashboard: React.FC = () => {
  const { calificaciones, configuracion, periodoActivo } = useStore();
  const periodoAnalisis = (periodoActivo as PeriodoAnalisis) || 'P1';
  const tablaRef = useRef<HTMLDivElement>(null);

  const [filtros, setFiltros] = useState<FiltroActivo>({
    grado: null, curso: 'Todos', riesgo: 'Todos', perdidas: null, search: '', soloUrgente: false,
  });
  const [sortKey, setSortKey] = useState<SortKey>('riesgo');
  const [sortDir, setSortDir] = useState<SortDir>('asc');
  const [showAll, setShowAll] = useState(false);
  const [vistaUbicacion, setVistaUbicacion] = useState<VistaUbicacion>('grado');
  const [gradoDrill, setGradoDrill] = useState<number | null>(null);

  useEffect(() => {
    setGradoDrill(null);
    setFiltros({ grado: null, curso: 'Todos', riesgo: 'Todos', perdidas: null, search: '', soloUrgente: false });
    setShowAll(false);
  }, [periodoAnalisis]);

  const scrollToTabla = useCallback(() => {
    requestAnimationFrame(() => {
      tablaRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    });
  }, []);

  const aplicarFiltro = useCallback((patch: Partial<FiltroActivo>) => {
    setFiltros(prev => ({ ...prev, ...patch }));
    setShowAll(false);
    scrollToTabla();
  }, [scrollToTabla]);

  const limpiarFiltros = useCallback(() => {
    setFiltros({ grado: null, curso: 'Todos', riesgo: 'Todos', perdidas: null, search: '', soloUrgente: false });
    setGradoDrill(null);
    setShowAll(false);
  }, []);

  const todosEstudiantes = useMemo((): EstudianteRiesgo[] => {
    return agruparPorEstudiante(calificaciones).map(cals => {
      const { riesgo, numPerdidas, promedioGeneral, asignaturasPerdidas } = calcularRiesgoEstudiante(
        cals, periodoAnalisis, configuracion
      );
      const rep = cals[0];
      return {
        id: `${rep.estudianteNumero}-${rep.estudianteNombre}`,
        nombre: rep.estudianteNombre,
        grado: rep.grado,
        curso: rep.curso,
        asignaturasPerdidas: numPerdidas,
        promedio: promedioGeneral,
        riesgo,
        asignaturasPerdidasLista: asignaturasPerdidas.length > 0
          ? asignaturasPerdidas.map(a => a.nombreAsignatura).join(', ')
          : '—',
      };
    });
  }, [calificaciones, periodoAnalisis, configuracion]);

  const estudiantesEnRiesgo = useMemo(
    () => todosEstudiantes.filter(esEstudianteEnRiesgoPerdida),
    [todosEstudiantes]
  );

  const umbralPerdida = configuracion.asignaturasParaPerder;
  const umbralAlto = umbralPerdida - 1;

  const metrics = useMemo(() => {
    const totalMatricula = todosEstudiantes.length || 1;
    const critico = estudiantesEnRiesgo.filter(e => e.riesgo === 'Crítico').length;
    const alto = estudiantesEnRiesgo.filter(e => e.riesgo === 'Alto').length;
    const medio = estudiantesEnRiesgo.filter(e => e.riesgo === 'Medio').length;
    const totalEnRiesgo = estudiantesEnRiesgo.length;
    const urgente = critico + alto;
    return {
      critico, alto, medio, totalEnRiesgo, urgente, totalMatricula,
      pctUrgente: (urgente / totalMatricula) * 100,
      pctCritico: (critico / totalMatricula) * 100,
    };
  }, [estudiantesEnRiesgo, todosEstudiantes.length]);

  const distribucionRiesgo = useMemo(
    () => [
      { nivel: 'Crítico' as const, count: metrics.critico, fill: RISK_COLORS.Crítico },
      { nivel: 'Alto' as const, count: metrics.alto, fill: RISK_COLORS.Alto },
      { nivel: 'Medio' as const, count: metrics.medio, fill: RISK_COLORS.Medio },
    ],
    [metrics.critico, metrics.alto, metrics.medio]
  );

  const perdidasChartData = useMemo(() => {
    const maxPerdidas = Math.max(...estudiantesEnRiesgo.map(e => e.asignaturasPerdidas), umbralPerdida);
    const counts = new Map<number, number>();
    estudiantesEnRiesgo.forEach(e => {
      counts.set(e.asignaturasPerdidas, (counts.get(e.asignaturasPerdidas) ?? 0) + 1);
    });
    return Array.from({ length: maxPerdidas }, (_, i) => i + 1)
      .filter(n => (counts.get(n) ?? 0) > 0)
      .map(n => {
        let fill = RISK_COLORS.Medio;
        if (n >= umbralPerdida) fill = RISK_COLORS.Crítico;
        else if (n === umbralAlto) fill = RISK_COLORS.Alto;
        return {
          label: n >= umbralPerdida ? `${n}+` : String(n),
          perdidas: n,
          count: counts.get(n) ?? 0,
          fill,
          esUmbralPerdida: n >= umbralPerdida,
          esUmbralAlto: n === umbralAlto,
        };
      });
  }, [estudiantesEnRiesgo, umbralPerdida, umbralAlto]);

  const ubicacionChartData = useMemo((): UbicacionRow[] => {
    const buildFromGroups = (
      entries: { key: string; label: string; extra: Partial<UbicacionRow>; riesgo: RiesgoRelevante }[]
    ) => {
      const map = new Map<string, UbicacionRow>();
      entries.forEach(({ key, label, extra, riesgo }) => {
        if (!map.has(key)) {
          map.set(key, { key, label, critico: 0, alto: 0, medio: 0, total: 0, ...extra });
        }
        const row = map.get(key)!;
        if (riesgo === 'Crítico') row.critico++;
        else if (riesgo === 'Alto') row.alto++;
        else row.medio++;
        row.total++;
      });
      return Array.from(map.values());
    };

    if (vistaUbicacion === 'curso') {
      return buildFromGroups(
        estudiantesEnRiesgo.map(e => ({
          key: e.curso, label: e.curso, extra: { curso: e.curso, grado: e.grado }, riesgo: e.riesgo,
        }))
      ).sort((a, b) => b.total - a.total || a.label.localeCompare(b.label, 'es'));
    }

    if (gradoDrill != null) {
      return buildFromGroups(
        estudiantesEnRiesgo
          .filter(e => e.grado === gradoDrill)
          .map(e => ({
            key: e.curso, label: e.curso, extra: { curso: e.curso, grado: e.grado }, riesgo: e.riesgo,
          }))
      ).sort((a, b) => b.total - a.total || a.label.localeCompare(b.label, 'es'));
    }

    return buildFromGroups(
      estudiantesEnRiesgo.map(e => ({
        key: String(e.grado), label: `${e.grado}°`, extra: { grado: e.grado }, riesgo: e.riesgo,
      }))
    ).sort((a, b) => (a.grado ?? 0) - (b.grado ?? 0));
  }, [estudiantesEnRiesgo, vistaUbicacion, gradoDrill]);

  const cursosUnicos = useMemo(() => {
    let list = estudiantesEnRiesgo;
    if (filtros.grado != null) list = list.filter(e => e.grado === filtros.grado);
    return Array.from(new Set(list.map(c => c.curso))).sort((a, b) => a.localeCompare(b, 'es'));
  }, [estudiantesEnRiesgo, filtros.grado]);

  const gradosUnicos = useMemo(
    () => Array.from(new Set(estudiantesEnRiesgo.map(e => e.grado))).sort((a, b) => a - b),
    [estudiantesEnRiesgo]
  );

  const estudiantesTabla = useMemo(() => {
    let list = [...estudiantesEnRiesgo];

    if (filtros.grado != null) list = list.filter(e => e.grado === filtros.grado);
    if (filtros.curso !== 'Todos') list = list.filter(e => e.curso === filtros.curso);
    if (filtros.riesgo !== 'Todos') list = list.filter(e => e.riesgo === filtros.riesgo);
    if (filtros.perdidas != null) list = list.filter(e => e.asignaturasPerdidas === filtros.perdidas);
    if (filtros.soloUrgente) list = list.filter(e => e.riesgo === 'Crítico' || e.riesgo === 'Alto');
    if (filtros.search.trim().length >= 2) {
      list = list.filter(e => coincideNombreEstudiante(e.nombre, filtros.search));
    }

    const dir = sortDir === 'asc' ? 1 : -1;
    list.sort((a, b) => {
      switch (sortKey) {
        case 'nombre': return dir * a.nombre.localeCompare(b.nombre, 'es');
        case 'curso': return dir * a.curso.localeCompare(b.curso, 'es') || a.grado - b.grado;
        case 'perdidas': return dir * (a.asignaturasPerdidas - b.asignaturasPerdidas);
        case 'promedio': {
          const pa = a.promedio ?? -1;
          const pb = b.promedio ?? -1;
          return dir * (pa - pb);
        }
        case 'riesgo':
        default: {
          const diff = (RISK_ORDER[a.riesgo] ?? 9) - (RISK_ORDER[b.riesgo] ?? 9);
          if (diff !== 0) return dir * diff;
          return a.promedio != null && b.promedio != null ? a.promedio - b.promedio : 0;
        }
      }
    });
    return list;
  }, [estudiantesEnRiesgo, filtros, sortKey, sortDir]);

  const toggleSort = useCallback((key: SortKey) => {
    setSortKey(prev => {
      if (prev === key) {
        setSortDir(d => (d === 'asc' ? 'desc' : 'asc'));
        return prev;
      }
      setSortDir(key === 'nombre' || key === 'curso' ? 'asc' : 'desc');
      return key;
    });
  }, []);

  const handleUbicacionClick = (row: UbicacionRow, riesgoSegment?: RiesgoRelevante) => {
    if (vistaUbicacion === 'grado' && gradoDrill == null && row.grado != null) {
      setGradoDrill(row.grado);
      aplicarFiltro({ grado: row.grado, curso: 'Todos', riesgo: riesgoSegment ?? 'Todos', perdidas: null });
    } else if (row.curso) {
      aplicarFiltro({
        grado: row.grado ?? filtros.grado,
        curso: row.curso,
        riesgo: riesgoSegment ?? 'Todos',
        perdidas: null,
      });
    }
  };

  const hayFiltrosActivos =
    filtros.grado != null ||
    filtros.curso !== 'Todos' ||
    filtros.riesgo !== 'Todos' ||
    filtros.perdidas != null ||
    filtros.soloUrgente ||
    filtros.search.trim().length > 0;

  const isUbicacionSelected = (row: UbicacionRow) => {
    if (filtros.curso !== 'Todos' && row.curso === filtros.curso) return true;
    if (filtros.grado != null && row.grado === filtros.grado && filtros.curso === 'Todos' && !row.curso) return true;
    if (filtros.grado != null && gradoDrill == null && vistaUbicacion === 'grado' && row.grado === filtros.grado && !filtros.curso) return true;
    return filtros.grado === row.grado && filtros.curso === 'Todos' && gradoDrill == null && vistaUbicacion === 'grado';
  };

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

  const visibleRows = showAll ? estudiantesTabla : estudiantesTabla.slice(0, 50);
  const maxUbicacion = Math.max(...ubicacionChartData.map(d => d.total), 1);
  const maxPerdidasChart = Math.max(...perdidasChartData.map(d => d.count), 1);

  const YAxisProps = {
    allowDecimals: false as const,
    tick: { fontSize: 11, fill: '#64748b', fontWeight: 600 as const },
    axisLine: false,
    tickLine: false,
    width: 36,
  };

  return (
    <div className="space-y-5 max-w-7xl mx-auto">
      <div>
        <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">
          Período {periodoAnalisis} · Pierde el año con {umbralPerdida} asignaturas perdidas
        </p>
        <p className="text-xs text-slate-600 mt-1">
          {metrics.totalEnRiesgo} estudiantes con al menos 1 perdida ·{' '}
          {metrics.urgente} en situación urgente (crítico o alto)
        </p>
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <button
          type="button"
          onClick={() => aplicarFiltro({ riesgo: 'Crítico', grado: null, curso: 'Todos', perdidas: null, soloUrgente: false })}
          className="bg-white p-4 sm:p-5 rounded-xl shadow-sm border border-red-200 border-b-4 border-b-[#450a0a] text-left hover:ring-2 hover:ring-red-200 transition-shadow"
        >
          <p className="text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1">Ya pierden el año</p>
          <h3 className="text-3xl font-black text-[#450a0a]">{metrics.critico}</h3>
          <p className="text-[10px] text-red-900 mt-1 leading-relaxed">
            Estudiantes con <strong>{umbralPerdida} o más</strong> asignaturas perdidas
            ({metrics.pctCritico.toFixed(1)}% matrícula) · Clic para ver listado
          </p>
        </button>
        <button
          type="button"
          onClick={() => aplicarFiltro({ riesgo: 'Alto', grado: null, curso: 'Todos', perdidas: null, soloUrgente: false })}
          className="bg-white p-4 sm:p-5 rounded-xl shadow-sm border border-rose-200 border-b-4 border-b-[#e11d48] text-left hover:ring-2 hover:ring-rose-200 transition-shadow"
        >
          <p className="text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1">A 1 asignatura de perder</p>
          <h3 className="text-3xl font-black text-[#e11d48]">{metrics.alto}</h3>
          <p className="text-[10px] text-rose-800 mt-1 leading-relaxed">
            <strong>{metrics.alto} estudiantes</strong> llevan exactamente{' '}
            <strong>{umbralAlto} perdidas</strong> — si reprueban 1 más, pierden el año · Clic para ver listado
          </p>
        </button>
        <button
          type="button"
          onClick={() => aplicarFiltro({ riesgo: 'Todos', grado: null, curso: 'Todos', perdidas: null, soloUrgente: true })}
          className="bg-white p-4 sm:p-5 rounded-xl shadow-sm border border-amber-200 border-b-4 border-b-amber-500 text-left hover:ring-2 hover:ring-amber-200 transition-shadow"
        >
          <p className="text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1">Riesgo inmediato total</p>
          <h3 className="text-3xl font-black text-amber-700">{metrics.urgente}</h3>
          <p className="text-[10px] text-amber-800 mt-1 leading-relaxed">
            Crítico ({metrics.critico}) + Alto ({metrics.alto}) = {metrics.urgente} estudiantes ·{' '}
            {metrics.pctUrgente.toFixed(1)}% matrícula
          </p>
        </button>
      </div>

      {/* Gráficos: ubicación ancho + distribución estrecha */}
      <div className="grid grid-cols-1 xl:grid-cols-12 gap-4">
        <div className="xl:col-span-8 bg-white p-5 rounded-xl shadow-sm border border-slate-200">
          <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-2 mb-3">
            <div>
              <h3 className="text-xs font-bold text-slate-800 uppercase tracking-wider">
                {gradoDrill != null
                  ? `Cursos de ${gradoDrill}° en riesgo`
                  : vistaUbicacion === 'grado'
                    ? 'Estudiantes en riesgo por grado'
                    : 'Estudiantes en riesgo por curso'}
              </h3>
              <p className="text-[10px] text-slate-500 mt-0.5">
                Clic en barra o segmento → filtra la tabla abajo
              </p>
            </div>
            <div className="flex items-center gap-1 shrink-0">
              {gradoDrill != null && (
                <button
                  type="button"
                  onClick={() => { setGradoDrill(null); aplicarFiltro({ grado: null, curso: 'Todos' }); }}
                  className="inline-flex items-center gap-1 px-2 py-1 text-[10px] font-bold uppercase text-blue-700 hover:bg-blue-50 rounded"
                >
                  <ChevronLeft className="w-3 h-3" /> Grados
                </button>
              )}
              <button
                type="button"
                onClick={() => { setVistaUbicacion('grado'); setGradoDrill(null); limpiarFiltros(); }}
                className={`px-2.5 py-1 text-[10px] font-bold uppercase rounded border transition-colors ${
                  vistaUbicacion === 'grado' && gradoDrill == null
                    ? 'bg-blue-100 text-blue-800 border-blue-200' : 'bg-white text-slate-500 border-slate-200 hover:bg-slate-50'
                }`}
              >
                Por grado
              </button>
              <button
                type="button"
                onClick={() => { setVistaUbicacion('curso'); setGradoDrill(null); limpiarFiltros(); }}
                className={`px-2.5 py-1 text-[10px] font-bold uppercase rounded border transition-colors ${
                  vistaUbicacion === 'curso'
                    ? 'bg-blue-100 text-blue-800 border-blue-200' : 'bg-white text-slate-500 border-slate-200 hover:bg-slate-50'
                }`}
              >
                Por curso
              </button>
            </div>
          </div>
          <div className="h-[min(300px,48vh)] min-h-[240px]">
            {ubicacionChartData.length === 0 ? (
              <div className="h-full flex items-center justify-center text-xs text-slate-400">
                Sin estudiantes con pérdidas en {periodoAnalisis}.
              </div>
            ) : (
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={ubicacionChartData} margin={CHART_MARGIN}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                  <XAxis
                    dataKey="label"
                    tick={{ fontSize: 11, fill: '#64748b', fontWeight: 600 }}
                    axisLine={false}
                    tickLine={false}
                    interval={0}
                    angle={vistaUbicacion === 'curso' || gradoDrill != null ? -35 : 0}
                    textAnchor={vistaUbicacion === 'curso' || gradoDrill != null ? 'end' : 'middle'}
                    height={vistaUbicacion === 'curso' || gradoDrill != null ? 48 : 30}
                  />
                  <YAxis {...YAxisProps} domain={[0, maxUbicacion + 2]} />
                  <RechartsTooltip
                    isAnimationActive={false}
                    cursor={{ fill: '#f8fafc' }}
                    content={({ active, payload }) => {
                      if (!active || !payload?.length) return null;
                      const d = payload[0].payload as UbicacionRow;
                      return (
                        <ChartTooltipBox
                          title={d.label}
                          lines={[
                            `${d.total} con pérdidas`,
                            `Crítico ${d.critico} · Alto ${d.alto} · Medio ${d.medio}`,
                            'Clic para filtrar tabla',
                          ]}
                          accent="red"
                        />
                      );
                    }}
                  />
                  {(['critico', 'alto', 'medio'] as const).map((key, i) => {
                    const riesgoMap = { critico: 'Crítico', alto: 'Alto', medio: 'Medio' } as const;
                    const colorMap = { critico: RISK_COLORS.Crítico, alto: RISK_COLORS.Alto, medio: RISK_COLORS.Medio };
                    return (
                      <Bar
                        key={key}
                        dataKey={key}
                        stackId="r"
                        fill={colorMap[key]}
                        isAnimationActive={false}
                        radius={i === 2 ? [4, 4, 0, 0] : undefined}
                        style={{ cursor: 'pointer' }}
                        onClick={(data) => data && handleUbicacionClick(data as UbicacionRow, riesgoMap[key])}
                      >
                        {ubicacionChartData.map(entry => (
                          <Cell
                            key={entry.key}
                            fill={colorMap[key]}
                            opacity={!hayFiltrosActivos || isUbicacionSelected(entry) ? 1 : 0.35}
                            stroke={
                              isUbicacionSelected(entry) && filtros.riesgo === riesgoMap[key]
                                ? '#1d4ed8' : undefined
                            }
                            strokeWidth={isUbicacionSelected(entry) ? 2 : 0}
                          />
                        ))}
                        {i === 2 && (
                          <LabelList dataKey="total" position="top" style={{ fontSize: 10, fontWeight: 700, fill: '#475569' }} />
                        )}
                      </Bar>
                    );
                  })}
                </BarChart>
              </ResponsiveContainer>
            )}
          </div>
          <div className="mt-2 flex flex-wrap gap-4 text-[10px] font-bold">
            {(Object.entries(RISK_COLORS) as [RiesgoRelevante, string][]).map(([n, c]) => (
              <span key={n} className="inline-flex items-center gap-1.5 text-slate-700">
                <span className="w-3 h-3 rounded-sm border border-slate-200" style={{ backgroundColor: c }} />
                {n}
              </span>
            ))}
          </div>
        </div>

        <div className="xl:col-span-4 bg-white p-5 rounded-xl shadow-sm border border-slate-200">
          <h3 className="text-xs font-bold text-slate-800 uppercase tracking-wider mb-1">
            Por nivel de riesgo
          </h3>
          <p className="text-[10px] text-slate-500 mb-3">{metrics.totalEnRiesgo} con pérdidas</p>
          <div className="h-[min(300px,48vh)] min-h-[240px]">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={distribucionRiesgo} margin={CHART_MARGIN}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                <XAxis
                  dataKey="nivel"
                  tick={{ fontSize: 10, fill: '#64748b', fontWeight: 600 }}
                  axisLine={false}
                  tickLine={false}
                />
                <YAxis {...YAxisProps} />
                <RechartsTooltip
                  isAnimationActive={false}
                  cursor={{ fill: '#f8fafc' }}
                  content={({ active, payload }) => {
                    if (!active || !payload?.length) return null;
                    const d = payload[0].payload as typeof distribucionRiesgo[0];
                    const pct = metrics.totalEnRiesgo > 0 ? (d.count / metrics.totalEnRiesgo) * 100 : 0;
                    return (
                      <ChartTooltipBox
                        title={d.nivel}
                        lines={[`${d.count} estudiantes`, `${pct.toFixed(1)}% del total con pérdidas`]}
                        accent={d.nivel !== 'Medio' ? 'red' : 'blue'}
                      />
                    );
                  }}
                />
                <Bar
                  dataKey="count"
                  radius={[4, 4, 0, 0]}
                  isAnimationActive={false}
                  style={{ cursor: 'pointer' }}
                  onClick={d => d?.nivel && aplicarFiltro({ riesgo: d.nivel as string, perdidas: null })}
                >
                  {distribucionRiesgo.map(entry => (
                    <Cell
                      key={entry.nivel}
                      fill={entry.fill}
                      opacity={filtros.riesgo === 'Todos' || filtros.riesgo === entry.nivel ? 1 : 0.3}
                      stroke={filtros.riesgo === entry.nivel ? '#1d4ed8' : undefined}
                      strokeWidth={filtros.riesgo === entry.nivel ? 2 : 0}
                    />
                  ))}
                  <LabelList dataKey="count" position="top" style={{ fontSize: 11, fontWeight: 700, fill: '#475569' }} />
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>

      {/* Por número de asignaturas perdidas */}
      <div className="bg-white p-5 rounded-xl shadow-sm border border-slate-200">
        <h3 className="text-xs font-bold text-slate-800 uppercase tracking-wider mb-1">
          Estudiantes por número de asignaturas perdidas
        </h3>
        <p className="text-[10px] text-slate-500 mb-3">
          Solo quienes tienen al menos 1 perdida · Clic en barra filtra la tabla ·
          Línea roja = umbral de pérdida del año ({umbralPerdida})
        </p>
        <div className="h-[min(220px,35vh)] min-h-[180px]">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={perdidasChartData} margin={{ ...CHART_MARGIN, bottom: 8 }}>
              <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
              <XAxis
                dataKey="label"
                tick={{ fontSize: 11, fill: '#64748b', fontWeight: 600 }}
                axisLine={false}
                tickLine={false}
                label={{
                  value: 'Nº asignaturas perdidas',
                  position: 'bottom',
                  offset: -2,
                  fontSize: 10,
                  fill: '#94a3b8',
                  fontWeight: 700,
                }}
              />
              <YAxis {...YAxisProps} domain={[0, maxPerdidasChart + 2]} />
              <RechartsTooltip
                isAnimationActive={false}
                cursor={{ fill: '#f8fafc' }}
                content={({ active, payload }) => {
                  if (!active || !payload?.length) return null;
                  const d = payload[0].payload as typeof perdidasChartData[0];
                  let nota = '';
                  if (d.esUmbralPerdida) nota = 'Ya cumplen criterio de pérdida';
                  else if (d.esUmbralAlto) nota = 'A 1 asignatura de perder el año';
                  return (
                    <ChartTooltipBox
                      title={`${d.perdidas} asignatura${d.perdidas !== 1 ? 's' : ''} perdida${d.perdidas !== 1 ? 's' : ''}`}
                      lines={[`${d.count} estudiantes`, nota || 'Seguimiento'].filter(Boolean)}
                      accent={d.esUmbralPerdida || d.esUmbralAlto ? 'red' : 'blue'}
                    />
                  );
                }}
              />
              <Bar
                dataKey="count"
                radius={[4, 4, 0, 0]}
                isAnimationActive={false}
                style={{ cursor: 'pointer' }}
                onClick={d => d?.perdidas != null && aplicarFiltro({ perdidas: d.perdidas as number, riesgo: 'Todos' })}
              >
                {perdidasChartData.map(entry => (
                  <Cell
                    key={entry.perdidas}
                    fill={entry.fill}
                    opacity={filtros.perdidas == null || filtros.perdidas === entry.perdidas ? 1 : 0.3}
                    stroke={filtros.perdidas === entry.perdidas ? '#1d4ed8' : entry.esUmbralPerdida ? '#450a0a' : undefined}
                    strokeWidth={filtros.perdidas === entry.perdidas || entry.esUmbralPerdida ? 2 : 0}
                  />
                ))}
                <LabelList dataKey="count" position="top" style={{ fontSize: 10, fontWeight: 700, fill: '#475569' }} />
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Tabla */}
      <div ref={tablaRef} className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden scroll-mt-4">
        <div className="px-4 py-4 border-b border-slate-100 bg-slate-50 flex flex-col gap-3">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
            <div>
              <h3 className="text-sm font-bold text-slate-800">Estudiantes en riesgo</h3>
              <p className="text-[10px] text-slate-400">
                {estudiantesTabla.length} de {metrics.totalEnRiesgo} · {periodoAnalisis}
                {hayFiltrosActivos && ' · filtrado'}
              </p>
            </div>
            {hayFiltrosActivos && (
              <button
                type="button"
                onClick={limpiarFiltros}
                className="inline-flex items-center gap-1 text-[10px] font-bold uppercase text-blue-700 hover:underline shrink-0"
              >
                <X className="w-3 h-3" /> Limpiar filtros
              </button>
            )}
          </div>

          {hayFiltrosActivos && (
            <div className="flex flex-wrap gap-1.5">
              {filtros.grado != null && (
                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-blue-100 text-blue-800 text-[10px] font-bold">
                  Grado {filtros.grado}°
                  <button type="button" onClick={() => aplicarFiltro({ grado: null })} aria-label="Quitar filtro grado"><X className="w-3 h-3" /></button>
                </span>
              )}
              {filtros.curso !== 'Todos' && (
                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-blue-100 text-blue-800 text-[10px] font-bold">
                  Curso {filtros.curso}
                  <button type="button" onClick={() => aplicarFiltro({ curso: 'Todos' })} aria-label="Quitar filtro curso"><X className="w-3 h-3" /></button>
                </span>
              )}
              {filtros.riesgo !== 'Todos' && (
                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-blue-100 text-blue-800 text-[10px] font-bold">
                  {filtros.riesgo}
                  <button type="button" onClick={() => aplicarFiltro({ riesgo: 'Todos' })} aria-label="Quitar filtro riesgo"><X className="w-3 h-3" /></button>
                </span>
              )}
              {filtros.perdidas != null && (
                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-blue-100 text-blue-800 text-[10px] font-bold">
                  {filtros.perdidas} perdida{filtros.perdidas !== 1 ? 's' : ''}
                  <button type="button" onClick={() => aplicarFiltro({ perdidas: null })} aria-label="Quitar filtro perdidas"><X className="w-3 h-3" /></button>
                </span>
              )}
              {filtros.soloUrgente && (
                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-rose-100 text-rose-800 text-[10px] font-bold">
                  Solo urgente (crítico + alto)
                  <button type="button" onClick={() => aplicarFiltro({ soloUrgente: false })} aria-label="Quitar filtro urgente"><X className="w-3 h-3" /></button>
                </span>
              )}
            </div>
          )}

          <div className="flex flex-col sm:flex-row flex-wrap gap-2">
            <select
              className="px-3 py-2 text-xs border border-slate-200 rounded-lg bg-white outline-none focus:border-blue-500"
              value={filtros.riesgo}
              onChange={e => aplicarFiltro({ riesgo: e.target.value })}
            >
              {NIVELES_FILTRO.map(n => (
                <option key={n} value={n}>{n === 'Todos' ? 'Todos los niveles' : n}</option>
              ))}
            </select>
            <select
              className="px-3 py-2 text-xs border border-slate-200 rounded-lg bg-white outline-none focus:border-blue-500"
              value={filtros.grado ?? ''}
              onChange={e => {
                const v = e.target.value;
                aplicarFiltro({ grado: v ? Number(v) : null, curso: 'Todos' });
              }}
            >
              <option value="">Todos los grados</option>
              {gradosUnicos.map(g => (
                <option key={g} value={g}>{g}°</option>
              ))}
            </select>
            <select
              className="px-3 py-2 text-xs border border-slate-200 rounded-lg bg-white outline-none focus:border-blue-500"
              value={filtros.curso}
              onChange={e => aplicarFiltro({ curso: e.target.value })}
            >
              <option value="Todos">Todos los cursos</option>
              {cursosUnicos.map(c => (
                <option key={c} value={c}>Curso {c}</option>
              ))}
            </select>
            <select
              className="px-3 py-2 text-xs border border-slate-200 rounded-lg bg-white outline-none focus:border-blue-500"
              value={filtros.perdidas ?? ''}
              onChange={e => {
                const v = e.target.value;
                aplicarFiltro({ perdidas: v ? Number(v) : null });
              }}
            >
              <option value="">Todas las perdidas</option>
              {perdidasChartData.map(p => (
                <option key={p.perdidas} value={p.perdidas}>{p.perdidas} perdida{p.perdidas !== 1 ? 's' : ''}</option>
              ))}
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
          <table className="w-full text-left min-w-[640px]">
            <thead className="bg-white text-slate-500 font-bold text-[10px] uppercase tracking-wider border-b border-slate-200 sticky top-0 z-10 shadow-sm">
              <tr>
                <SortHeader label="Estudiante" col="nombre" />
                <SortHeader label="Curso" col="curso" />
                <SortHeader label="Perdidas" col="perdidas" align="right" />
                <SortHeader label="Promedio" col="promedio" align="right" />
                <SortHeader label="Riesgo" col="riesgo" />
                <th className="px-4 py-3">Causa principal</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {visibleRows.map(est => (
                <tr key={est.id} className="hover:bg-slate-50 transition-colors">
                  <td className="px-4 py-3 text-xs font-medium text-slate-800 max-w-[200px] truncate" title={est.nombre}>
                    {est.nombre}
                  </td>
                  <td className="px-4 py-3 text-xs text-slate-600">{est.curso}</td>
                  <td className="px-4 py-3 text-right font-mono text-xs font-bold tabular-nums">{est.asignaturasPerdidas}</td>
                  <td className="px-4 py-3 text-right font-mono text-xs tabular-nums">
                    {est.promedio != null ? formatearNota(est.promedio) : 'N/A'}
                  </td>
                  <td className="px-4 py-3">
                    <span
                      className="inline-flex px-2 py-0.5 rounded-full text-[10px] font-bold uppercase border"
                      style={{
                        backgroundColor: RISK_BG[est.riesgo],
                        color: RISK_COLORS[est.riesgo],
                        borderColor: `${RISK_COLORS[est.riesgo]}55`,
                      }}
                    >
                      {est.riesgo}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-[10px] text-slate-600 max-w-[280px] truncate" title={est.asignaturasPerdidasLista}>
                    {est.asignaturasPerdidasLista}
                  </td>
                </tr>
              ))}
              {estudiantesTabla.length === 0 && (
                <tr>
                  <td colSpan={6} className="px-4 py-10 text-center text-xs text-slate-400">
                    No hay estudiantes con los filtros actuales.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        {estudiantesTabla.length > 50 && (
          <div className="px-4 py-3 border-t border-slate-100 flex flex-col sm:flex-row items-center justify-between gap-2 bg-slate-50">
            <span className="text-[10px] font-bold text-slate-500 uppercase">
              Mostrando {visibleRows.length} de {estudiantesTabla.length}
            </span>
            <button
              type="button"
              onClick={() => setShowAll(v => !v)}
              className="inline-flex items-center gap-1 text-xs font-bold text-blue-600 hover:underline uppercase"
            >
              {showAll ? <><ChevronUp className="w-3.5 h-3.5" /> Ver menos</> : <><ChevronDown className="w-3.5 h-3.5" /> Ver todos</>}
            </button>
          </div>
        )}
      </div>
    </div>
  );
};
