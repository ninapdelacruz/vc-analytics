import React from 'react';
import {
  Users, Award, TrendingDown, ShieldAlert, BookOpen, Target,
  HelpCircle, AlertTriangle, FileWarning, AlertCircle, Layers
} from 'lucide-react';

export interface KpiDelta {
  valor: number | null;
  etiqueta: string;
  positivoEsBueno?: boolean;
}

interface SummaryKpiCardsProps {
  totalEstudiantes: number;
  totalEstudiantesConNota: number;
  tieneFiltrosAsignatura: boolean;
  promedioInstitucional: number | null;
  pctPromedioEnBajo: number;
  countPromedioEnBajo: number;
  totalEstudiantesConPerdidas: number;
  totalRiesgoAltoCritico: number;
  totalCursosCargados: number;
  totalCursosEsperados: number;
  cursosPendientes: number;
  asignaturaCritica: string;
  asignaturaCriticaPct: number;
  centroInteresCritico: string;
  totalAlertas: number;
  periodoComparacion: string | null;
  deltas: {
    estudiantes?: KpiDelta;
    promedio?: KpiDelta;
    pctBajo?: KpiDelta;
    riesgo?: KpiDelta;
    cursos?: KpiDelta;
  } | null;
  filtrosActivos: {
    riesgo: string;
    desempeno: string;
    soloPerdidas: boolean;
    soloPromedioBajo: boolean;
  };
  onResetFiltros: () => void;
  onVerCalculoPromedio: () => void;
  onVerCalculoPerdidas: () => void;
  onVerCalculoRiesgo: () => void;
  onTogglePromedioBajo: () => void;
  onTogglePerdidas: () => void;
  onToggleRiesgo: () => void;
  onLimpiarFiltrosAsignatura: () => void;
  onFiltrarAsignaturaCritica: () => void;
  onFiltrarCentroInteres: () => void;
  onIrAlertas: () => void;
}

const DeltaBadge: React.FC<{ delta: KpiDelta | undefined; periodo: string | null }> = ({ delta, periodo }) => {
  if (!delta || delta.valor === null || !periodo) return null;
  const v = delta.valor;
  const isUp = v > 0;
  const isGood = delta.positivoEsBueno ? isUp : !isUp;
  const color = Math.abs(v) < 0.05 ? 'text-slate-400' : isGood ? 'text-emerald-600' : 'text-red-600';
  const arrow = v > 0 ? '↑' : v < 0 ? '↓' : '—';
  const formatted = delta.etiqueta.includes('%') || delta.etiqueta.includes('p.p.')
    ? `${Math.abs(v).toFixed(1)}${delta.etiqueta.includes('p.p.') ? ' p.p.' : '%'}`
    : Math.abs(v).toFixed(2);

  return (
    <span className={`text-[10px] font-bold font-mono ${color}`}>
      {arrow} {formatted} vs {periodo}
    </span>
  );
};

export const SummaryKpiCards: React.FC<SummaryKpiCardsProps> = ({
  totalEstudiantes,
  totalEstudiantesConNota,
  tieneFiltrosAsignatura,
  promedioInstitucional,
  pctPromedioEnBajo,
  countPromedioEnBajo,
  totalEstudiantesConPerdidas,
  totalRiesgoAltoCritico,
  totalCursosCargados,
  totalCursosEsperados,
  cursosPendientes,
  asignaturaCritica,
  asignaturaCriticaPct,
  centroInteresCritico,
  totalAlertas,
  periodoComparacion,
  deltas,
  filtrosActivos,
  onResetFiltros,
  onVerCalculoPromedio,
  onVerCalculoPerdidas,
  onVerCalculoRiesgo,
  onTogglePromedioBajo,
  onTogglePerdidas,
  onToggleRiesgo,
  onLimpiarFiltrosAsignatura,
  onFiltrarAsignaturaCritica,
  onFiltrarCentroInteres,
  onIrAlertas,
}) => {
  const cardBase = 'bg-white rounded-xl border shadow-sm transition-all cursor-pointer flex flex-col p-4 min-h-[120px]';
  const activeRing = 'ring-2 ring-blue-500 border-blue-300 shadow-md';

  return (
    <div className="space-y-3" id="kpis-container">
      {/* Fila principal — 6 KPIs estilo mockup */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-3">
        {/* 1. Total estudiantes */}
        <div
          className={`${cardBase} border-slate-200 hover:border-blue-300 hover:shadow-md`}
          onClick={onResetFiltros}
          title="Clic para limpiar filtros cruzados"
        >
          <div className="flex items-start justify-between gap-2 mb-2">
            <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Total estudiantes</p>
            <div className="w-8 h-8 rounded-lg bg-blue-50 flex items-center justify-center shrink-0">
              <Users className="w-4 h-4 text-blue-600" />
            </div>
          </div>
          <p className="text-2xl font-black text-slate-900 font-mono leading-none">{totalEstudiantes}</p>
          <p className="text-[10px] text-slate-500 mt-1">
            {tieneFiltrosAsignatura
              ? `${totalEstudiantesConNota} con nota en selección`
              : 'Selección activa del dashboard'}
          </p>
          <div className="mt-auto pt-2">
            <DeltaBadge delta={deltas?.estudiantes} periodo={periodoComparacion} />
          </div>
        </div>

        {/* 2. Promedio institucional */}
        <div
          className={`${cardBase} border-slate-200 hover:border-blue-300`}
          onClick={onLimpiarFiltrosAsignatura}
          title="Clic para limpiar filtros de asignatura"
        >
          <div className="flex items-start justify-between gap-2 mb-2">
            <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Promedio institucional</p>
            <div className="w-8 h-8 rounded-lg bg-emerald-50 flex items-center justify-center shrink-0">
              <Award className="w-4 h-4 text-emerald-600" />
            </div>
          </div>
          <p className="text-2xl font-black text-blue-800 font-mono leading-none">
            {promedioInstitucional !== null ? promedioInstitucional.toFixed(2) : 'N/A'}
          </p>
          <p className="text-[10px] text-slate-500 mt-1">Escala 1.0 – 10.0</p>
          <div className="mt-auto pt-2 flex items-center justify-between gap-1">
            <DeltaBadge delta={deltas?.promedio} periodo={periodoComparacion} />
            <button
              onClick={(e) => { e.stopPropagation(); onVerCalculoPromedio(); }}
              className="text-[9px] font-bold text-blue-600 hover:underline flex items-center gap-0.5"
            >
              <HelpCircle className="w-3 h-3" /> Auditoría
            </button>
          </div>
        </div>

        {/* 3. % en Bajo */}
        <div
          className={`${cardBase} border-slate-200 hover:border-amber-300 ${filtrosActivos.soloPromedioBajo ? activeRing : ''}`}
          onClick={onTogglePromedioBajo}
          title="Clic para filtrar / quitar filtro de promedio en Bajo"
        >
          <div className="flex items-start justify-between gap-2 mb-2">
            <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">% promedio en Bajo</p>
            <div className="w-8 h-8 rounded-lg bg-amber-50 flex items-center justify-center shrink-0">
              <TrendingDown className="w-4 h-4 text-amber-600" />
            </div>
          </div>
          <p className="text-2xl font-black text-slate-900 font-mono leading-none">
            {pctPromedioEnBajo.toFixed(1)}%
          </p>
          <p className="text-[10px] text-slate-500 mt-1">{countPromedioEnBajo} estudiantes</p>
          <div className="mt-auto pt-2">
            <DeltaBadge delta={deltas?.pctBajo} periodo={periodoComparacion} />
          </div>
        </div>

        {/* 4. Riesgo alto/crítico */}
        <div
          className={`${cardBase} border-slate-200 hover:border-red-300 ${filtrosActivos.riesgo === 'Alto/Crítico' ? activeRing : ''}`}
          onClick={onToggleRiesgo}
          title="Clic para filtrar / quitar riesgo Alto y Crítico"
        >
          <div className="flex items-start justify-between gap-2 mb-2">
            <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Riesgo alto/crítico</p>
            <div className="w-8 h-8 rounded-lg bg-red-50 flex items-center justify-center shrink-0">
              <ShieldAlert className="w-4 h-4 text-red-600" />
            </div>
          </div>
          <p className="text-2xl font-black text-red-700 font-mono leading-none">{totalRiesgoAltoCritico}</p>
          <p className="text-[10px] text-slate-500 mt-1">
            {totalEstudiantes > 0 ? ((totalRiesgoAltoCritico / totalEstudiantes) * 100).toFixed(1) : '0'}% del total
          </p>
          <div className="mt-auto pt-2 flex items-center justify-between gap-1">
            <DeltaBadge delta={deltas?.riesgo} periodo={periodoComparacion} />
            <button
              onClick={(e) => { e.stopPropagation(); onVerCalculoRiesgo(); }}
              className="text-[9px] font-bold text-red-600 hover:underline flex items-center gap-0.5"
            >
              <HelpCircle className="w-3 h-3" /> Auditar
            </button>
          </div>
        </div>

        {/* 5. Cursos cargados */}
        <div className={`${cardBase} border-slate-200 cursor-default`}>
          <div className="flex items-start justify-between gap-2 mb-2">
            <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Cursos cargados</p>
            <div className="w-8 h-8 rounded-lg bg-indigo-50 flex items-center justify-center shrink-0">
              <BookOpen className="w-4 h-4 text-indigo-600" />
            </div>
          </div>
          <p className="text-2xl font-black text-slate-900 font-mono leading-none">
            {totalCursosCargados}
            <span className="text-sm text-slate-400 font-normal">/{totalCursosEsperados || '—'}</span>
          </p>
          <p className="text-[10px] text-slate-500 mt-1">
            {cursosPendientes > 0 ? `Faltan ${cursosPendientes} por cargar` : 'Cobertura completa'}
          </p>
          <div className="mt-auto pt-2">
            <DeltaBadge delta={deltas?.cursos} periodo={periodoComparacion} />
          </div>
        </div>

        {/* 6. Asignatura más crítica */}
        <div
          className={`${cardBase} border-slate-200 hover:border-rose-300`}
          onClick={onFiltrarAsignaturaCritica}
          title="Clic para filtrar por esta asignatura"
        >
          <div className="flex items-start justify-between gap-2 mb-2">
            <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Asignatura crítica</p>
            <div className="w-8 h-8 rounded-lg bg-rose-50 flex items-center justify-center shrink-0">
              <Target className="w-4 h-4 text-rose-600" />
            </div>
          </div>
          <p className="text-sm font-black text-slate-800 uppercase truncate leading-tight" title={asignaturaCritica}>
            {asignaturaCritica}
          </p>
          <p className="text-[10px] text-red-600 font-bold mt-1">{asignaturaCriticaPct.toFixed(1)}% en Bajo</p>
          <p className="text-[9px] text-slate-400 mt-auto pt-2 uppercase">Clic para filtrar</p>
        </div>
      </div>

      {/* Fila secundaria compacta — métricas extra interactivas */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
        <button
          type="button"
          onClick={onTogglePerdidas}
          className={`flex items-center gap-2 px-3 py-2 rounded-lg border text-left transition-all ${
            filtrosActivos.soloPerdidas ? 'bg-orange-50 border-orange-300 ring-1 ring-orange-400' : 'bg-white border-slate-200 hover:border-orange-200'
          }`}
        >
          <AlertTriangle className="w-4 h-4 text-orange-500 shrink-0" />
          <div>
            <p className="text-[9px] font-bold text-slate-400 uppercase">Con pérdidas</p>
            <p className="text-sm font-black font-mono text-red-600">{totalEstudiantesConPerdidas}</p>
          </div>
        </button>

        <button
          type="button"
          onClick={onFiltrarCentroInteres}
          className="flex items-center gap-2 px-3 py-2 rounded-lg border border-slate-200 bg-white hover:border-indigo-200 text-left transition-all"
        >
          <Layers className="w-4 h-4 text-indigo-500 shrink-0" />
          <div className="min-w-0">
            <p className="text-[9px] font-bold text-slate-400 uppercase">CI más crítico</p>
            <p className="text-[10px] font-bold text-slate-700 truncate">{centroInteresCritico}</p>
          </div>
        </button>

        <button
          type="button"
          onClick={onIrAlertas}
          className="flex items-center gap-2 px-3 py-2 rounded-lg border border-slate-200 bg-white hover:border-red-200 text-left transition-all"
        >
          <AlertCircle className="w-4 h-4 text-amber-500 shrink-0" />
          <div>
            <p className="text-[9px] font-bold text-slate-400 uppercase">Alertas de datos</p>
            <p className="text-sm font-black font-mono text-slate-800">{totalAlertas}</p>
          </div>
        </button>

        <div className="flex items-center gap-2 px-3 py-2 rounded-lg border border-slate-200 bg-slate-50 text-left">
          <FileWarning className="w-4 h-4 text-slate-400 shrink-0" />
          <div>
            <p className="text-[9px] font-bold text-slate-400 uppercase">Cursos pendientes</p>
            <p className="text-sm font-black font-mono text-slate-700">
              {cursosPendientes > 0 ? cursosPendientes : '0'}
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};
