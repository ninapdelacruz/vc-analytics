import React, { useMemo, useState, useCallback, useEffect } from 'react';
import { useStore } from '../store';
import {
  isPerdida,
  calcularRiesgoEstudiante,
  agruparPorEstudiante,
  clasificarDesempeno,
  obtenerAsignaturasValidasParaPerdida,
  obtenerAsignaturaCriticaEstudiante,
  crearClaveCurso,
  formatearNota,
  redondearNota,
  compararEstudiantesPorRiesgo,
} from '../utils/calculations';
import { coincideNombreEstudiante } from '../utils/studentSearch';
import { NotaTag } from '../components/NotaTag';
import { CourseDistribucionChart } from '../components/CourseDistribucionChart';
import { CourseAsignaturasBarChart } from '../components/CourseAsignaturasBarChart';
import {
  Search, AlertCircle, Users, TrendingUp, TrendingDown,
  PieChart as PieChartIcon, RotateCcw, GraduationCap, X, BookOpen
} from 'lucide-react';
import {
  Tooltip as RechartsTooltip, ResponsiveContainer,
  LineChart, Line, XAxis, YAxis, CartesianGrid, LabelList
} from 'recharts';

type PeriodoAnalisis = 'P1' | 'P2' | 'P3' | 'P4' | 'DEF';

interface GrupoCurso {
  key: string;
  anio: number;
  nivel: string;
  grado: number;
  curso: string;
  etiqueta: string;
}

const inicialesNombre = (nombre: string): string => {
  const partes = (nombre || '').trim().split(/\s+/).filter(Boolean);
  if (partes.length === 0) return '??';
  if (partes.length === 1) return partes[0].slice(0, 2).toUpperCase();
  return (partes[0][0] + partes[1][0]).toUpperCase();
};

const periodoAnterior = (p: PeriodoAnalisis): PeriodoAnalisis | null => {
  if (p === 'P2') return 'P1';
  if (p === 'P3') return 'P2';
  if (p === 'P4') return 'P3';
  if (p === 'DEF') return 'P2';
  return null;
};

export const CourseDashboard: React.FC = () => {
  const { calificaciones, configuracion, periodoActivo } = useStore();
  const periodo = periodoActivo as PeriodoAnalisis;

  const [filtroNivel, setFiltroNivel] = useState('');
  const [filtroGrado, setFiltroGrado] = useState('');
  const [filtroCurso, setFiltroCurso] = useState('');
  const [searchTerm, setSearchTerm] = useState('');
  const [filtroAsignatura, setFiltroAsignatura] = useState<string | null>(null);
  const [filtroDesempeno, setFiltroDesempeno] = useState<string | null>(null);
  const [showAllRanking, setShowAllRanking] = useState(false);

  const gruposCurso = useMemo((): GrupoCurso[] => {
    const map = new Map<string, GrupoCurso>();
    calificaciones.forEach(c => {
      const key = crearClaveCurso(c);
      if (!map.has(key)) {
        map.set(key, {
          key,
          anio: c.anio,
          nivel: c.nivel,
          grado: c.grado,
          curso: c.curso,
          etiqueta: `${c.grado}° · Curso ${c.curso} · ${c.nivel}`,
        });
      }
    });
    return Array.from(map.values()).sort((a, b) =>
      a.nivel.localeCompare(b.nivel) || a.grado - b.grado || a.curso.localeCompare(b.curso)
    );
  }, [calificaciones]);

  useEffect(() => {
    if (gruposCurso.length === 0) return;
    const exists = gruposCurso.some(g =>
      g.nivel === filtroNivel && String(g.grado) === filtroGrado && g.curso === filtroCurso
    );
    if (!exists) {
      const first = gruposCurso[0];
      setFiltroNivel(first.nivel);
      setFiltroGrado(String(first.grado));
      setFiltroCurso(first.curso);
    }
  }, [gruposCurso, filtroNivel, filtroGrado, filtroCurso]);

  const nivelesOptions = useMemo(() =>
    Array.from(new Set(gruposCurso.map(g => g.nivel))).sort(),
    [gruposCurso]
  );

  const gradosOptions = useMemo((): string[] => {
    const grados: string[] = gruposCurso
      .filter(g => g.nivel === filtroNivel)
      .map(g => String(g.grado));
    return Array.from(new Set<string>(grados)).sort((a, b) => parseInt(a, 10) - parseInt(b, 10));
  }, [gruposCurso, filtroNivel]);

  const cursosOptions = useMemo(() =>
    gruposCurso
      .filter(g => g.nivel === filtroNivel && String(g.grado) === filtroGrado)
      .map(g => g.curso)
      .sort(),
    [gruposCurso, filtroNivel, filtroGrado]
  );

  const grupoActivo = useMemo(() =>
    gruposCurso.find(g =>
      g.nivel === filtroNivel && String(g.grado) === filtroGrado && g.curso === filtroCurso
    ) ?? null,
    [gruposCurso, filtroNivel, filtroGrado, filtroCurso]
  );

  const metrics = useMemo(() => {
    if (!grupoActivo || calificaciones.length === 0) return null;

    const cursoData = calificaciones.filter(c =>
      c.nivel === grupoActivo.nivel &&
      c.grado === grupoActivo.grado &&
      c.curso === grupoActivo.curso &&
      c.anio === grupoActivo.anio
    );

    const estudiantes = agruparPorEstudiante(cursoData);

    const estudiantesRiesgo = estudiantes.map(est => {
      const riskResult = calcularRiesgoEstudiante(est, periodo, configuracion);
      const asignaturaCritica = obtenerAsignaturaCriticaEstudiante(est, periodo, configuracion);
      const nivelDesempeno = clasificarDesempeno(riskResult.promedioGeneral, configuracion)?.nombre ?? 'Sin datos';
      const perdidasNombres = riskResult.asignaturasPerdidas.map(a => a.nombreAsignatura);
      const asignaturasPerdidasDetalle = riskResult.asignaturasPerdidas.map(a => ({
        nombre: a.nombreAsignatura,
        nota: a.nota,
      }));

      return {
        est,
        id: est[0].estudianteNumero,
        nombre: est[0].estudianteNombre,
        riesgo: riskResult.riesgo,
        numPerdidas: riskResult.numPerdidas,
        asignaturasPerdidasLista: perdidasNombres,
        asignaturasPerdidasDetalle,
        asignaturasCriticas: perdidasNombres.join(', '),
        asignaturaCritica: asignaturaCritica || 'N/A',
        promedio: riskResult.promedioGeneral,
        nivelDesempeno,
      };
    });

    const totalEstudiantes = estudiantesRiesgo.length;

    let bajo = 0, basico = 0, alto = 0, superior = 0;
    const promediosValidos = estudiantesRiesgo
      .map(e => e.promedio)
      .filter((p): p is number => p !== null && !isNaN(p));

    const promedioCurso = promediosValidos.length > 0
      ? redondearNota(promediosValidos.reduce((a, b) => a + b, 0) / promediosValidos.length)
      : null;

    estudiantesRiesgo.forEach(e => {
      const level = clasificarDesempeno(e.promedio, configuracion);
      if (level?.nombre === 'Bajo') bajo++;
      else if (level?.nombre === 'Básico') basico++;
      else if (level?.nombre === 'Alto') alto++;
      else if (level?.nombre === 'Superior') superior++;
    });

    const distribucion = [
      { name: 'Bajo', value: bajo, color: '#ef4444' },
      { name: 'Básico', value: basico, color: '#f97316' },
      { name: 'Alto', value: alto, color: '#3b82f6' },
      { name: 'Superior', value: superior, color: '#22c55e' },
    ]
      .filter(d => d.value > 0)
      .map(d => ({
        ...d,
        pct: totalEstudiantes > 0 ? (d.value / totalEstudiantes) * 100 : 0,
      }));

    const estudiantesRiesgoAlto = estudiantesRiesgo.filter(e =>
      e.riesgo === 'Alto' || e.riesgo === 'Crítico'
    ).length;
    const pctRiesgoAlto = totalEstudiantes > 0 ? (estudiantesRiesgoAlto / totalEstudiantes) * 100 : 0;

    const asigMap = new Map<string, number>();
    estudiantes.forEach(est => {
      obtenerAsignaturasValidasParaPerdida(est, periodo, configuracion).forEach(g => {
        if (isPerdida(g.nota, configuracion)) {
          asigMap.set(g.nombreAsignatura, (asigMap.get(g.nombreAsignatura) || 0) + 1);
        }
      });
    });

    const asignaturasPerdidas = Array.from(asigMap.entries())
      .map(([name, count]) => ({
        name,
        count,
        pct: totalEstudiantes > 0 ? (count / totalEstudiantes) * 100 : 0,
      }))
      .sort((a, b) => b.pct - a.pct || b.count - a.count)
      .slice(0, 5);

    const asigMasCritica = asignaturasPerdidas[0] ?? null;

    const calcularPromedioCursoPeriodo = (per: PeriodoAnalisis) => {
      const avgs: number[] = [];
      estudiantes.forEach(est => {
        const risk = calcularRiesgoEstudiante(est, per, configuracion);
        if (risk.promedioGeneral !== null && !isNaN(risk.promedioGeneral)) {
          avgs.push(risk.promedioGeneral);
        }
      });
      return avgs.length > 0 ? redondearNota(avgs.reduce((a, b) => a + b, 0) / avgs.length) : null;
    };

    const trendData = (['P1', 'P2', 'P3', 'P4'] as PeriodoAnalisis[]).map(p => ({
      name: p,
      promedio: calcularPromedioCursoPeriodo(p),
    }));

    const perAnt = periodoAnterior(periodo);
    const promedioAnterior = perAnt ? calcularPromedioCursoPeriodo(perAnt) : null;
    const deltaPromedio = promedioCurso !== null && promedioAnterior !== null
      ? redondearNota(promedioCurso - promedioAnterior)
      : null;

    const rankingEstudiantes = [...estudiantesRiesgo].sort(compararEstudiantesPorRiesgo);

    return {
      grupoActivo,
      totalEstudiantes,
      promedioCurso,
      promedioAnterior,
      deltaPromedio,
      perAnt,
      pctRiesgoAlto,
      estudiantesRiesgoAlto,
      distribucion,
      asignaturasPerdidas,
      asigMasCritica,
      trendData,
      rankingEstudiantes,
    };
  }, [grupoActivo, calificaciones, periodo, configuracion]);

  const estudiantesFiltrados = useMemo(() => {
    if (!metrics) return [];
    let list = metrics.rankingEstudiantes;

    if (searchTerm.trim().length >= 2) {
      list = list.filter(e => coincideNombreEstudiante(e.nombre, searchTerm));
    }
    if (filtroAsignatura) {
      list = list.filter(e => e.asignaturasPerdidasLista.includes(filtroAsignatura));
    }
    if (filtroDesempeno) {
      list = list.filter(e => e.nivelDesempeno === filtroDesempeno);
    }
    return list;
  }, [metrics, searchTerm, filtroAsignatura, filtroDesempeno]);

  const toggleAsignatura = useCallback((name: string) => {
    setFiltroAsignatura(prev => (prev === name ? null : name));
  }, []);

  const toggleDesempeno = useCallback((name: string) => {
    setFiltroDesempeno(prev => (prev === name ? null : name));
  }, []);

  const limpiarFiltros = useCallback(() => {
    if (gruposCurso.length > 0) {
      const first = gruposCurso[0];
      setFiltroNivel(first.nivel);
      setFiltroGrado(String(first.grado));
      setFiltroCurso(first.curso);
    }
    setSearchTerm('');
    setFiltroAsignatura(null);
    setFiltroDesempeno(null);
  }, [gruposCurso]);

  const tieneFiltrosCruzados = filtroAsignatura !== null || filtroDesempeno !== null;

  if (!metrics || !grupoActivo) {
    return <div className="p-8 text-center text-slate-500">Cargando datos del análisis por curso...</div>;
  }

  const estEnBajo = metrics.distribucion.find(d => d.name === 'Bajo')?.value || 0;
  const pctEnBajo = metrics.totalEstudiantes > 0 ? (estEnBajo / metrics.totalEstudiantes) * 100 : 0;

  const deltaPositivo = metrics.deltaPromedio !== null && metrics.deltaPromedio >= 0;

  const barMaxPct = Math.max(...metrics.asignaturasPerdidas.map(a => a.pct), 1);
  const barDomainMax = Math.min(100, Math.ceil(barMaxPct * 1.15));

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-5 fade-in" id="course-dashboard-root">

      {/* Header */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-800">Análisis por Curso</h1>
          <p className="text-slate-500 text-sm">Desempeño, riesgos y seguimiento individual del curso seleccionado.</p>
        </div>
      </div>

      {/* Banner curso activo — muy visible */}
      <div className="bg-gradient-to-r from-[#004aad] to-blue-700 text-white rounded-xl p-5 shadow-md flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="flex items-center gap-4">
          <div className="w-14 h-14 rounded-xl bg-white/15 flex items-center justify-center border border-white/20 shrink-0">
            <GraduationCap className="w-7 h-7" />
          </div>
          <div>
            <p className="text-[10px] font-bold uppercase tracking-widest text-blue-200">Curso activo</p>
            <h2 className="text-2xl sm:text-3xl font-black leading-tight">
              {grupoActivo.grado}° — Curso {grupoActivo.curso}
            </h2>
            <p className="text-sm text-blue-100 font-medium mt-0.5">
              {grupoActivo.nivel} · Año {grupoActivo.anio} · Período <strong className="text-white">{periodo}</strong>
            </p>
          </div>
        </div>
        <div className="flex flex-wrap gap-3 sm:text-right">
          <div className="bg-white/10 rounded-lg px-4 py-2 border border-white/20">
            <p className="text-[10px] uppercase tracking-wider text-blue-200">Estudiantes</p>
            <p className="text-xl font-black">{metrics.totalEstudiantes}</p>
          </div>
          <div className="bg-white/10 rounded-lg px-4 py-2 border border-white/20">
            <p className="text-[10px] uppercase tracking-wider text-blue-200">Promedio {periodo}</p>
            <p className="text-xl font-black font-mono">
              {metrics.promedioCurso !== null ? formatearNota(metrics.promedioCurso) : 'N/A'}
            </p>
          </div>
        </div>
      </div>

      {/* Filtros Nivel / Grado / Curso */}
      <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 items-end">
          <div>
            <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1">Nivel</label>
            <select
              className="w-full text-xs border border-slate-200 rounded-lg px-3 py-2 bg-slate-50 font-bold text-slate-700"
              value={filtroNivel}
              onChange={e => {
                setFiltroNivel(e.target.value);
                const grados = gruposCurso.filter(g => g.nivel === e.target.value);
                if (grados.length > 0) {
                  setFiltroGrado(String(grados[0].grado));
                  setFiltroCurso(grados[0].curso);
                }
                setFiltroAsignatura(null);
                setFiltroDesempeno(null);
              }}
            >
              {nivelesOptions.map(n => <option key={n} value={n}>{n}</option>)}
            </select>
          </div>
          <div>
            <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1">Grado</label>
            <select
              className="w-full text-xs border border-slate-200 rounded-lg px-3 py-2 bg-slate-50 font-bold text-slate-700"
              value={filtroGrado}
              onChange={e => {
                setFiltroGrado(e.target.value);
                const cursos = gruposCurso.filter(g => g.nivel === filtroNivel && String(g.grado) === e.target.value);
                if (cursos.length > 0) setFiltroCurso(cursos[0].curso);
                setFiltroAsignatura(null);
                setFiltroDesempeno(null);
              }}
            >
              {gradosOptions.map(g => <option key={g} value={g}>{g}°</option>)}
            </select>
          </div>
          <div>
            <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1">Curso</label>
            <select
              className="w-full text-xs border border-slate-200 rounded-lg px-3 py-2 bg-slate-50 font-bold text-slate-700"
              value={filtroCurso}
              onChange={e => {
                setFiltroCurso(e.target.value);
                setFiltroAsignatura(null);
                setFiltroDesempeno(null);
              }}
            >
              {cursosOptions.map(c => <option key={c} value={c}>{c}</option>)}
            </select>
          </div>
          <button
            type="button"
            onClick={limpiarFiltros}
            className="flex items-center justify-center gap-2 text-xs font-bold text-slate-600 border border-slate-200 rounded-lg px-3 py-2 hover:bg-slate-50"
          >
            <RotateCcw className="w-3.5 h-3.5" /> Limpiar filtros
          </button>
        </div>
      </div>

      {/* Filtros cruzados */}
      {tieneFiltrosCruzados && (
        <div className="flex flex-wrap items-center gap-2 px-3 py-2 bg-blue-50 border border-blue-200 rounded-lg">
          <span className="text-[10px] font-bold text-blue-800 uppercase">Filtros cruzados:</span>
          {filtroAsignatura && (
            <button type="button" onClick={() => setFiltroAsignatura(null)} className="inline-flex items-center gap-1 px-2 py-0.5 bg-white border border-blue-300 rounded text-[10px] font-bold text-blue-700">
              Asignatura: {filtroAsignatura} <X className="w-3 h-3" />
            </button>
          )}
          {filtroDesempeno && (
            <button type="button" onClick={() => setFiltroDesempeno(null)} className="inline-flex items-center gap-1 px-2 py-0.5 bg-white border border-amber-300 rounded text-[10px] font-bold text-amber-700">
              Desempeño: {filtroDesempeno} <X className="w-3 h-3" />
            </button>
          )}
          <button type="button" onClick={() => { setFiltroAsignatura(null); setFiltroDesempeno(null); }} className="ml-auto text-[10px] font-bold text-blue-600 hover:underline uppercase">
            Quitar todos
          </button>
        </div>
      )}

      {/* KPIs */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4">
        <div className="bg-white p-4 rounded-xl shadow-sm border border-slate-200">
          <div className="flex items-center gap-3 mb-2">
            <div className="w-8 h-8 rounded-full bg-blue-100 flex items-center justify-center text-blue-600">
              <Users className="w-4 h-4" />
            </div>
            <h3 className="text-xs font-bold text-slate-500 uppercase tracking-wider">Estudiantes</h3>
          </div>
          <div className="text-2xl font-black text-slate-800">{metrics.totalEstudiantes}</div>
          <p className="text-[10px] text-slate-400 mt-1 uppercase">100% matriculados</p>
        </div>

        <div className="bg-white p-4 rounded-xl shadow-sm border border-slate-200 border-b-4 border-b-green-400">
          <div className="flex items-center gap-3 mb-2">
            <div className="w-8 h-8 rounded-full bg-green-100 flex items-center justify-center text-green-600">
              <TrendingUp className="w-4 h-4" />
            </div>
            <h3 className="text-xs font-bold text-slate-500 uppercase tracking-wider">Promedio</h3>
          </div>
          <div className="text-2xl font-black text-slate-800 font-mono">
            {metrics.promedioCurso !== null ? formatearNota(metrics.promedioCurso) : 'N/A'}
          </div>
          {metrics.deltaPromedio !== null && metrics.perAnt ? (
            <p className={`text-[10px] font-bold mt-1 uppercase flex items-center gap-1 ${deltaPositivo ? 'text-green-600' : 'text-red-600'}`}>
              {deltaPositivo ? <TrendingUp className="w-3 h-3" /> : <TrendingDown className="w-3 h-3" />}
              {deltaPositivo ? '+' : ''}{formatearNota(metrics.deltaPromedio)} vs {metrics.perAnt}
            </p>
          ) : (
            <p className="text-[10px] text-slate-400 mt-1 uppercase">Sin período anterior</p>
          )}
        </div>

        <div className="bg-white p-4 rounded-xl shadow-sm border border-slate-200">
          <div className="flex items-center gap-3 mb-2">
            <div className="w-8 h-8 rounded-full bg-orange-100 flex items-center justify-center text-orange-600">
              <PieChartIcon className="w-4 h-4" />
            </div>
            <h3 className="text-xs font-bold text-slate-500 uppercase tracking-wider">% en Bajo</h3>
          </div>
          <div className="text-2xl font-black text-slate-800">{pctEnBajo.toFixed(1)}%</div>
          <p className="text-[10px] text-slate-400 mt-1 uppercase">{estEnBajo} estudiantes</p>
        </div>

        <div className="bg-white p-4 rounded-xl shadow-sm border border-slate-200 border-b-4 border-b-red-400">
          <div className="flex items-center gap-3 mb-2">
            <div className="w-8 h-8 rounded-full bg-red-100 flex items-center justify-center text-red-600">
              <AlertCircle className="w-4 h-4" />
            </div>
            <h3 className="text-xs font-bold text-slate-500 uppercase tracking-wider">Riesgo Alto</h3>
          </div>
          <div className="text-2xl font-black text-slate-800">{metrics.estudiantesRiesgoAlto}</div>
          <p className="text-[10px] text-red-500 mt-1 uppercase font-bold">{metrics.pctRiesgoAlto.toFixed(1)}% del curso</p>
        </div>

        <div className="bg-white p-4 rounded-xl shadow-sm border border-slate-200">
          <div className="flex items-center gap-3 mb-2">
            <div className="w-8 h-8 rounded-full bg-purple-100 flex items-center justify-center text-purple-600">
              <BookOpen className="w-4 h-4" />
            </div>
            <h3 className="text-xs font-bold text-slate-500 uppercase tracking-wider">Más perdida</h3>
          </div>
          <div className="text-lg font-black text-slate-800 truncate" title={metrics.asigMasCritica?.name}>
            {metrics.asigMasCritica?.name || 'N/A'}
          </div>
          <p className="text-[10px] text-slate-400 mt-1 uppercase">
            {metrics.asigMasCritica ? `${metrics.asigMasCritica.pct.toFixed(0)}% del curso` : '—'}
          </p>
        </div>

      </div>

      {/* Gráficos — donut más ancho, barras más compactas */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-5">
        <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm flex flex-col min-h-[340px] lg:col-span-5">
          <h3 className="text-xs font-bold text-slate-800 uppercase tracking-wider mb-1">
            Distribución de desempeños ({periodo})
          </h3>
          <p className="text-[10px] text-slate-400 mb-2">Clic en segmento para filtrar tabla</p>
          <CourseDistribucionChart
            data={metrics.distribucion}
            totalEstudiantes={metrics.totalEstudiantes}
            filtroDesempeno={filtroDesempeno}
            onToggleDesempeno={toggleDesempeno}
          />
        </div>

        <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm flex flex-col min-h-[340px] lg:col-span-4">
          <h3 className="text-xs font-bold text-slate-800 uppercase tracking-wider mb-1">
            Asignaturas con más pérdidas ({periodo})
          </h3>
          <p className="text-[10px] text-slate-400 mb-2">% del curso · clic para filtrar</p>
          <CourseAsignaturasBarChart
            data={metrics.asignaturasPerdidas}
            barDomainMax={barDomainMax}
            filtroAsignatura={filtroAsignatura}
            onToggleAsignatura={toggleAsignatura}
          />
        </div>

        <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm flex flex-col min-h-[340px] lg:col-span-3">
          <h3 className="text-xs font-bold text-slate-800 uppercase tracking-wider mb-1">Tendencia del promedio</h3>
          <p className="text-[10px] text-slate-400 mb-3">Promedio del curso por período</p>
          <div className="flex-1 min-h-[220px]">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={metrics.trendData} margin={{ top: 22, right: 12, left: -6, bottom: 5 }}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{ fontSize: 12, fill: '#64748b', fontWeight: 700 }} />
                <YAxis
                  domain={[configuracion.notaMinima, configuracion.notaMaxima]}
                  axisLine={false}
                  tickLine={false}
                  tick={{ fontSize: 11, fill: '#64748b' }}
                  width={30}
                />
                <RechartsTooltip formatter={(v: number) => [formatearNota(v), 'Promedio']} />
                <Line
                  type="monotone"
                  dataKey="promedio"
                  stroke="#16a34a"
                  strokeWidth={2.5}
                  isAnimationActive={false}
                  dot={{ r: 5, fill: '#16a34a', strokeWidth: 2, stroke: '#fff' }}
                  connectNulls={false}
                >
                  <LabelList
                    dataKey="promedio"
                    position="top"
                    offset={10}
                    formatter={(v: number) => (v != null ? formatearNota(v) : '')}
                    style={{ fontSize: 11, fontWeight: 700, fill: '#166534' }}
                  />
                </Line>
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
        {/* Tabla */}
        <div className="bg-white border border-slate-200 rounded-xl overflow-hidden shadow-sm lg:col-span-2">
          <div className="px-5 py-4 border-b border-slate-100 flex flex-col sm:flex-row sm:justify-between sm:items-center gap-3 bg-slate-50">
            <div>
              <h3 className="text-sm font-bold text-slate-800">Seguimiento individual</h3>
              <p className="text-[10px] text-slate-400">{grupoActivo.etiqueta} · {estudiantesFiltrados.length} estudiantes</p>
            </div>
            <div className="relative">
              <Search className="w-4 h-4 absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400" />
              <input
                type="text"
                placeholder="Buscar estudiante..."
                className="pl-8 pr-4 py-1.5 text-xs bg-white border border-slate-200 rounded-md outline-none focus:border-blue-500 w-full sm:w-52"
                value={searchTerm}
                onChange={e => setSearchTerm(e.target.value)}
              />
            </div>
          </div>
          <div className="overflow-x-auto overflow-y-auto max-h-[min(560px,70vh)] scroll-smooth">
            <table className="w-full text-left border-collapse min-w-[560px]">
              <thead>
                <tr className="bg-white border-b border-slate-200 sticky top-0 z-10 shadow-sm">
                  <th className="py-3 px-4 text-[10px] font-bold text-slate-500 uppercase">Estudiante</th>
                  <th className="py-3 px-4 text-[10px] font-bold text-slate-500 uppercase">Asignaturas perdidas</th>
                  <th className="py-3 px-4 text-[10px] font-bold text-slate-500 uppercase text-center">Riesgo</th>
                  <th className="py-3 px-4 text-[10px] font-bold text-slate-500 uppercase">Asig. crítica</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {estudiantesFiltrados.length === 0 && (
                  <tr>
                    <td colSpan={4} className="py-8 text-center text-xs text-slate-400">Sin estudiantes para los filtros actuales</td>
                  </tr>
                )}
                {(showAllRanking ? estudiantesFiltrados : estudiantesFiltrados.slice(0, 20)).map((est, i) => (
                  <tr key={`${est.id}-${i}`} className="hover:bg-slate-50 transition-colors">
                    <td className="py-4 px-4 align-top">
                      <div className="flex items-center gap-3">
                        <div className="w-8 h-8 rounded-full bg-blue-50 text-blue-700 flex items-center justify-center text-[10px] font-bold shrink-0 border border-blue-100">
                          {inicialesNombre(est.nombre)}
                        </div>
                        <div>
                          <div className="text-xs font-bold text-slate-800">{est.nombre}</div>
                          <div className="text-[10px] text-slate-400 font-mono">ID: {est.id}</div>
                        </div>
                      </div>
                    </td>
                    <td className="py-4 px-4 align-top min-w-[200px]">
                      <div className="flex items-baseline gap-2 mb-2">
                        <span className="text-lg font-black text-slate-800">{est.numPerdidas}</span>
                        <span className="text-[10px] text-slate-400 uppercase font-bold">perdidas</span>
                      </div>
                      {est.asignaturasPerdidasDetalle.length > 0 ? (
                        <div className="flex flex-wrap gap-1.5 pb-1">
                          {est.asignaturasPerdidasDetalle.map(asig => (
                            <NotaTag
                              key={asig.nombre}
                              nombre={asig.nombre}
                              nota={asig.nota}
                              periodo={periodo}
                            />
                          ))}
                        </div>
                      ) : (
                        <span className="text-[10px] text-slate-400">Ninguna</span>
                      )}
                    </td>
                    <td className="py-4 px-4 text-center align-top">
                      <span className={`text-[10px] font-bold uppercase px-2 py-0.5 rounded-full border ${
                        est.riesgo === 'Crítico' ? 'bg-red-50 text-red-700 border-red-200' :
                        est.riesgo === 'Alto' ? 'bg-orange-50 text-orange-700 border-orange-200' :
                        est.riesgo === 'Medio' ? 'bg-amber-50 text-amber-700 border-amber-200' :
                        'bg-slate-50 text-slate-600 border-slate-200'
                      }`}>
                        {est.riesgo}
                      </span>
                    </td>
                    <td className="py-4 px-4 text-xs font-bold text-slate-700 align-top">{est.asignaturaCritica}</td>
                  </tr>
                ))}
                {/* Espacio inferior para que la última fila no quede recortada al hacer scroll */}
                <tr aria-hidden className="h-3">
                  <td colSpan={4} className="p-0" />
                </tr>
              </tbody>
            </table>
          </div>
          <div className="px-5 py-3 border-t border-slate-200 bg-slate-50 flex flex-col sm:flex-row items-center justify-between gap-2">
            <p className="text-[10px] text-slate-500 font-medium">
              Mostrando{' '}
              <strong className="text-slate-700">
                {showAllRanking ? estudiantesFiltrados.length : Math.min(20, estudiantesFiltrados.length)}
              </strong>{' '}
              de {estudiantesFiltrados.length} estudiantes
            </p>
            {estudiantesFiltrados.length > 20 && (
              <button
                type="button"
                onClick={() => setShowAllRanking(v => !v)}
                className="text-[11px] font-bold text-blue-600 hover:text-blue-800 uppercase tracking-wide px-3 py-1 rounded-md hover:bg-blue-50 transition-colors"
              >
                {showAllRanking ? 'Ver menos' : `Ver todos (${estudiantesFiltrados.length})`}
              </button>
            )}
          </div>
        </div>

        {/* Ranking + Lectura */}
        <div className="flex flex-col gap-5">
          <div className="bg-white border border-slate-200 rounded-xl p-5 shadow-sm">
            <h3 className="text-xs font-bold text-slate-800 uppercase tracking-wider mb-1">
              Ranking por riesgo ({periodo})
            </h3>
            <p className="text-[10px] text-slate-400 mb-3">Riesgo → más pérdidas → menor promedio</p>
            <div className="space-y-2">
              {metrics.rankingEstudiantes.slice(0, 5).map((est, idx) => (
                <div key={idx} className="flex items-center gap-3 p-2.5 rounded-lg bg-slate-50 border border-slate-100">
                  <span className="text-sm font-black text-slate-400 w-5">{idx + 1}</span>
                  <div className="w-8 h-8 rounded-full bg-blue-50 text-blue-700 flex items-center justify-center text-[10px] font-bold shrink-0">
                    {inicialesNombre(est.nombre)}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-[11px] font-bold text-slate-800 leading-tight">{est.nombre}</p>
                    <p className="text-[10px] text-slate-500 font-semibold mt-0.5">
                      {est.numPerdidas} perdidas · Prom. {est.promedio != null ? formatearNota(est.promedio) : '—'}
                    </p>
                  </div>
                  <span className={`text-[9px] font-bold uppercase px-2 py-0.5 rounded shrink-0 ${
                    est.riesgo === 'Crítico' ? 'bg-red-100 text-red-700' :
                    est.riesgo === 'Alto' ? 'bg-orange-100 text-orange-700' :
                    'bg-amber-100 text-amber-700'
                  }`}>
                    {est.riesgo}
                  </span>
                </div>
              ))}
            </div>
          </div>

          <div className="bg-slate-800 border border-slate-700 p-5 rounded-xl shadow-inner flex-1">
            <div className="flex items-center gap-3 mb-4">
              <div className="p-2 bg-slate-700 text-blue-400 rounded-lg">
                <AlertCircle className="w-5 h-5" />
              </div>
              <h4 className="text-[10px] font-bold text-slate-300 uppercase tracking-widest">Lectura automática</h4>
            </div>
            <div className="space-y-3 text-xs text-slate-300 leading-relaxed">
              <p>
                El curso <strong className="text-white">{grupoActivo.grado}° {grupoActivo.curso}</strong> ({grupoActivo.nivel}) presenta un promedio de{' '}
                <strong className="text-white">{metrics.promedioCurso !== null ? formatearNota(metrics.promedioCurso) : 'N/A'}</strong> en {periodo}.
                {metrics.deltaPromedio !== null && metrics.perAnt && (
                  <> {deltaPositivo ? 'Subió' : 'Bajó'} <strong className={deltaPositivo ? 'text-green-400' : 'text-red-400'}>{Math.abs(metrics.deltaPromedio).toFixed(2)}</strong> pts vs {metrics.perAnt}.</>
                )}
              </p>
              <p>
                El <strong className="text-red-400">{metrics.pctRiesgoAlto.toFixed(1)}%</strong> ({metrics.estudiantesRiesgoAlto} estudiantes) está en riesgo alto o crítico.
              </p>
              {metrics.asigMasCritica && (
                <p>
                  La asignatura con más estudiantes en pérdida es <strong className="text-amber-300">{metrics.asigMasCritica.name}</strong> con el{' '}
                  <strong className="text-white">{metrics.asigMasCritica.pct.toFixed(0)}%</strong> del curso.
                </p>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
