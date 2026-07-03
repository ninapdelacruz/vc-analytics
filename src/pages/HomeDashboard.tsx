import React, { useMemo } from 'react';
import { useStore } from '../store';
import { calcularRiesgoEstudiante, agruparPorEstudiante } from '../utils/calculations';
import {
  Users, BookOpen, AlertTriangle, TrendingDown, ChevronRight, AlertCircle,
  BarChart2, Target, Bookmark, Settings, FileWarning, ClipboardList, Shield,
} from 'lucide-react';

interface HomeProps {
  onNavigate: (tab: string) => void;
}

export const HomeDashboard: React.FC<HomeProps> = ({ onNavigate }) => {
  const { calificaciones, configuracion, periodoActivo, archivosCargados } = useStore();

  const metrics = useMemo(() => {
    if (calificaciones.length === 0) return null;

    const estudiantesUnicos = agruparPorEstudiante(calificaciones);
    let riesgoAlto = 0;

    estudiantesUnicos.forEach(cals => {
      const { riesgo } = calcularRiesgoEstudiante(cals, periodoActivo, configuracion);
      if (riesgo === 'Alto' || riesgo === 'Crítico') riesgoAlto++;
    });

    const cursosUnicos = new Set(calificaciones.map(c => c.curso));

    return {
      totalEstudiantes: estudiantesUnicos.length,
      riesgoAlto,
      pctRiesgoAlto: (riesgoAlto / estudiantesUnicos.length) * 100,
      totalCursos: cursosUnicos.size,
      archivos: archivosCargados.length,
    };
  }, [calificaciones, periodoActivo, configuracion, archivosCargados]);

  if (!metrics) return null;

  const ultimaCarga = archivosCargados.length > 0
    ? archivosCargados[archivosCargados.length - 1]?.fechaCarga
    : null;

  const kpiCards = [
    {
      title: 'Estudiantes analizados',
      value: metrics.totalEstudiantes,
      sub: '100% de la muestra',
      icon: Users,
      accent: 'border-b-blue-500',
      iconBg: 'bg-blue-100 text-blue-700',
      valueColor: 'text-slate-900',
    },
    {
      title: 'Cursos cargados',
      value: metrics.totalCursos,
      sub: `${metrics.archivos} archivos`,
      icon: BookOpen,
      accent: 'border-b-emerald-500',
      iconBg: 'bg-emerald-100 text-emerald-700',
      valueColor: 'text-blue-800',
    },
    {
      title: 'Riesgo alto / crítico',
      value: metrics.riesgoAlto,
      sub: `${metrics.pctRiesgoAlto.toFixed(1)}% del total`,
      icon: AlertTriangle,
      accent: 'border-b-red-500',
      iconBg: 'bg-red-100 text-red-600',
      valueColor: 'text-red-600',
      onClick: () => onNavigate('riesgo'),
    },
  ];

  const modules = [
    { id: 'resumen', title: 'Resumen institucional', desc: 'Visión general del desempeño académico.', icon: BarChart2, color: 'text-blue-600 bg-blue-50' },
    { id: 'riesgo', title: 'Riesgo de pérdida del año', desc: 'Estudiantes con riesgo alto o crítico.', icon: TrendingDown, color: 'text-red-600 bg-red-50', highlight: true },
    { id: 'estudiantes', title: 'Detalle por estudiante', desc: 'Consulta individual y trayectoria.', icon: Users, color: 'text-indigo-600 bg-indigo-50' },
    { id: 'cursos', title: 'Análisis por curso', desc: 'Comparativo entre grados y cursos.', icon: BookOpen, color: 'text-emerald-600 bg-emerald-50' },
    { id: 'asignaturas', title: 'Análisis por asignatura', desc: 'Pérdidas y desempeño por materia.', icon: Bookmark, color: 'text-violet-600 bg-violet-50' },
    { id: 'recuperacion', title: 'Nota necesaria para aprobar', desc: 'Qué nota falta en períodos restantes.', icon: Target, color: 'text-amber-600 bg-amber-50' },
    { id: 'calidad', title: 'Calidad de datos', desc: 'Integridad y consistencia (protegido).', icon: FileWarning, color: 'text-orange-600 bg-orange-50', locked: true },
    { id: 'admin', title: 'Administración', desc: 'Carga de archivos Excel (protegido).', icon: Settings, color: 'text-slate-600 bg-slate-100', locked: true },
    { id: 'config', title: 'Configuración', desc: 'Parámetros académicos (protegido).', icon: ClipboardList, color: 'text-slate-600 bg-slate-100', locked: true },
  ];

  return (
    <div className="space-y-6">
      {/* Hero */}
      <div className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-[#0D47A1] via-[#1565C0] to-[#008f39] text-white shadow-lg">
        <div className="absolute inset-0 opacity-10 bg-[radial-gradient(circle_at_20%_20%,white,transparent_45%)]" />
        <div className="relative p-6 md:p-8 flex flex-col lg:flex-row lg:items-center gap-6">
          <div className="flex items-start gap-4 flex-1 min-w-0">
            <img
              src="/escudo-villa-campo.png"
              alt="Escudo IE Villa Campo"
              className="w-16 h-16 md:w-20 md:h-20 object-contain rounded-full bg-white p-1 shadow-lg shrink-0"
            />
            <div>
              <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-blue-100 mb-1">
                Institución Educativa Villa Campo
              </p>
              <h2 className="text-xl md:text-2xl font-black mb-2">¡Bienvenido a Villa Campo Analytics!</h2>
              <p className="text-sm text-blue-50/90 max-w-2xl leading-relaxed">
                Datos de <strong className="text-white">{metrics.totalCursos} cursos</strong> y{' '}
                <strong className="text-white">{metrics.totalEstudiantes.toLocaleString()} estudiantes</strong> en el período{' '}
                <strong className="text-white">{periodoActivo}</strong>. Explora los módulos para orientar intervenciones a tiempo.
              </p>
              {ultimaCarga && (
                <p className="text-[11px] text-blue-100/80 mt-3">
                  Última carga registrada: {ultimaCarga}
                </p>
              )}
            </div>
          </div>

          <div className="bg-white/15 backdrop-blur-sm border border-white/30 rounded-2xl px-5 py-4 min-w-[160px] text-center shadow-inner">
            <p className="text-[10px] font-black uppercase tracking-widest text-blue-100">Período activo</p>
            <p className="text-4xl font-black text-white mt-1 leading-none">{periodoActivo}</p>
            <p className="text-[10px] text-blue-100 mt-2">Cámbialo en la barra superior</p>
          </div>
        </div>
      </div>

      {/* KPIs — sin alertas de datos */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {kpiCards.map((kpi) => {
          const Icon = kpi.icon;
          const Comp = kpi.onClick ? 'button' : 'div';
          return (
            <Comp
              key={kpi.title}
              type={kpi.onClick ? 'button' : undefined}
              onClick={kpi.onClick}
              className={`bg-white border border-slate-200 border-b-4 ${kpi.accent} p-5 rounded-xl shadow-sm text-left ${kpi.onClick ? 'hover:shadow-md hover:border-slate-300 transition-all cursor-pointer' : ''}`}
            >
              <div className="flex items-center justify-between mb-3">
                <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">{kpi.title}</p>
                <div className={`w-9 h-9 rounded-lg flex items-center justify-center ${kpi.iconBg}`}>
                  <Icon className="w-4 h-4" />
                </div>
              </div>
              <div className="flex items-baseline gap-2">
                <h3 className={`text-3xl font-black ${kpi.valueColor}`}>{kpi.value.toLocaleString()}</h3>
                <span className="text-slate-500 text-[10px] font-bold">{kpi.sub}</span>
              </div>
            </Comp>
          );
        })}
      </div>

      {/* Módulos */}
      <div>
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Módulos de análisis</h3>
          <p className="text-[10px] text-slate-400">Los módulos con candado piden código al entrar</p>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-3">
          {modules.map(mod => {
            const Icon = mod.icon;
            return (
              <button
                key={mod.id}
                type="button"
                onClick={() => onNavigate(mod.id)}
                className={`group flex items-start gap-3 p-4 rounded-xl border bg-white text-left transition-all hover:shadow-md hover:-translate-y-0.5 ${
                  mod.highlight
                    ? 'border-emerald-400 ring-1 ring-emerald-200'
                    : 'border-slate-200 hover:border-blue-200'
                }`}
              >
                <div className={`p-2.5 rounded-xl ${mod.color} shrink-0`}>
                  <Icon className="w-5 h-5" />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <h4 className="text-sm font-bold text-slate-800">{mod.title}</h4>
                    {mod.locked && (
                      <span className="text-[9px] font-bold uppercase tracking-wide text-slate-400 bg-slate-100 px-1.5 py-0.5 rounded">
                        Código
                      </span>
                    )}
                  </div>
                  <p className="text-xs text-slate-500 mt-0.5 leading-relaxed">{mod.desc}</p>
                </div>
                <ChevronRight className="w-4 h-4 text-slate-300 group-hover:text-blue-500 mt-1 shrink-0" />
              </button>
            );
          })}
        </div>
      </div>

      {/* Lectura automática — sin alertas de calidad */}
      <div className="bg-slate-800 border border-slate-700 p-5 rounded-xl flex gap-4 items-start shadow-inner">
        <div className="p-2 bg-slate-700 text-slate-300 rounded shrink-0">
          <AlertCircle className="w-4 h-4" />
        </div>
        <div>
          <h4 className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-2">Análisis automático generado</h4>
          <p className="text-sm text-slate-300 leading-relaxed font-mono">
            ACTUALMENTE SE HAN CARGADO DATOS DE{' '}
            <strong className="text-white bg-slate-700 px-1 rounded">{metrics.totalCursos}</strong> CURSOS,
            ANALIZANDO UN TOTAL DE{' '}
            <strong className="text-white bg-slate-700 px-1 rounded">{metrics.totalEstudiantes}</strong> ESTUDIANTES
            PARA EL PERÍODO {periodoActivo}. SE IDENTIFICARON{' '}
            <strong className="text-red-400 bg-red-900/30 px-1 rounded">
              {metrics.riesgoAlto} ESTUDIANTES ({metrics.pctRiesgoAlto.toFixed(1)}%)
            </strong>{' '}
            EN RIESGO ALTO O CRÍTICO DE PÉRDIDA.
          </p>
        </div>
      </div>

      <div className="flex items-center justify-between text-[10px] text-slate-400 px-1">
        <span className="inline-flex items-center gap-1.5">
          <AlertCircle className="w-3.5 h-3.5" />
          Indicadores calculados con el período activo seleccionado en la barra superior.
        </span>
        <span className="inline-flex items-center gap-1.5 text-emerald-700 font-semibold">
          <Shield className="w-3.5 h-3.5" />
          Datos protegidos y confidenciales
        </span>
      </div>
    </div>
  );
};
