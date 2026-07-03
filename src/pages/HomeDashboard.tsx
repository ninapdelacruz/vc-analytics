import React, { useMemo } from 'react';
import { useStore } from '../store';
import { calcularRiesgoEstudiante, agruparPorEstudiante } from '../utils/calculations';
import { Users, BookOpen, AlertTriangle, FileWarning, TrendingDown, ChevronRight, AlertCircle } from 'lucide-react';

interface HomeProps {
  onNavigate: (tab: string) => void;
}

export const HomeDashboard: React.FC<HomeProps> = ({ onNavigate }) => {
  const { calificaciones, configuracion, periodoActivo, alertas, archivosCargados } = useStore();

  const metrics = useMemo(() => {
    if (calificaciones.length === 0) return null;

    const estudiantesUnicos = agruparPorEstudiante(calificaciones);
    
    let riesgoAlto = 0;
    
    estudiantesUnicos.forEach(cals => {
      const { riesgo } = calcularRiesgoEstudiante(cals, periodoActivo, configuracion);
      if (riesgo === 'Alto' || riesgo === 'Crítico') {
        riesgoAlto++;
      }
    });

    const cursosUnicos = new Set(calificaciones.map(c => c.curso));

    return {
      totalEstudiantes: estudiantesUnicos.length,
      riesgoAlto,
      pctRiesgoAlto: (riesgoAlto / estudiantesUnicos.length) * 100,
      totalCursos: cursosUnicos.size,
      totalAlertas: alertas.length,
    };
  }, [calificaciones, periodoActivo, configuracion, alertas]);

  if (!metrics) return null;

  const kpiCards = [
    { title: 'Estudiantes Analizados', value: metrics.totalEstudiantes, sub: '100% de la muestra', icon: Users, color: 'text-slate-900' },
    { title: 'Cursos Cargados', value: metrics.totalCursos, sub: `${archivosCargados.length} archivos`, icon: BookOpen, color: 'text-blue-800' },
    { title: 'Riesgo Alto / Crítico', value: metrics.riesgoAlto, sub: `${metrics.pctRiesgoAlto !== null && metrics.pctRiesgoAlto !== undefined ? metrics.pctRiesgoAlto.toFixed(1) : '0.0'}% del total`, icon: AlertTriangle, color: 'text-red-600' },
    { title: 'Alertas de Datos', value: metrics.totalAlertas, sub: 'Requieren revisión', icon: FileWarning, color: 'text-yellow-600' },
  ];

  const quickLinks = [
    { id: 'riesgo', title: 'Riesgo de pérdida del año', desc: 'Identifica y analiza estudiantes con riesgo.', icon: TrendingDown, color: 'bg-[#008f39] text-white', highlight: true },
    { id: 'resumen', title: 'Resumen institucional', desc: 'Visión general del desempeño.', icon: Users, color: 'bg-white border border-gray-200' },
    { id: 'calidad', title: 'Calidad de datos', desc: 'Revisa integridad y consistencia.', icon: FileWarning, color: 'bg-white border border-gray-200' },
  ];

  return (
    <div className="space-y-8">
      {/* Welcome Banner */}
      <div className="bg-white border border-slate-200 p-6 rounded-xl shadow-sm flex flex-col md:flex-row items-start md:items-center justify-between gap-6">
        <div>
          <h2 className="text-lg font-bold text-slate-800 mb-1">¡Bienvenido a Villa Campo Analytics!</h2>
          <p className="text-sm text-slate-500 max-w-2xl">
            Has cargado datos de <strong className="text-slate-800">{metrics.totalCursos} cursos</strong> correspondientes al período <strong className="text-slate-800">{periodoActivo}</strong>.
            Utiliza los módulos inferiores para explorar el desempeño y tomar decisiones oportunas.
          </p>
        </div>
        <div className="bg-blue-50 px-4 py-3 rounded-md border border-blue-100 flex items-center gap-4 min-w-[160px]">
          <div className="w-10 h-10 bg-white rounded flex items-center justify-center text-blue-700 shadow-sm">
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
            </svg>
          </div>
          <div>
            <p className="text-[10px] text-blue-600 font-bold uppercase tracking-widest">Período Activo</p>
            <p className="text-xl font-bold text-blue-800 leading-none mt-1">{periodoActivo}</p>
          </div>
        </div>
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {kpiCards.map((kpi, i) => (
          <div key={i} className="bg-white border border-slate-200 p-5 rounded-xl shadow-sm">
            <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1">{kpi.title}</p>
            <div className="flex items-baseline gap-2">
              <h3 className={`text-3xl font-bold ${kpi.color}`}>{kpi.value.toLocaleString()}</h3>
              <span className="text-slate-500 text-[10px] font-bold">{kpi.sub}</span>
            </div>
          </div>
        ))}
      </div>

      {/* Quick Links */}
      <div>
        <h3 className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-4">Accesos Rápidos</h3>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {quickLinks.map(link => {
            const Icon = link.icon;
            return (
              <button
                key={link.id}
                onClick={() => onNavigate(link.id)}
                className={`flex items-start gap-3 p-5 rounded-xl transition-all text-left border ${link.highlight ? 'bg-blue-600 border-blue-700 text-white shadow-lg' : 'bg-white border-slate-200 text-slate-700 hover:bg-slate-50'}`}
              >
                <div className={`p-2 rounded ${link.highlight ? 'bg-white/20' : 'bg-slate-100 text-slate-500'}`}>
                  <Icon className="w-5 h-5" />
                </div>
                <div className="flex-1">
                  <h4 className={`text-sm font-bold mb-1 ${link.highlight ? 'text-white' : 'text-slate-800'}`}>{link.title}</h4>
                  <p className={`text-xs ${link.highlight ? 'text-blue-100' : 'text-slate-500'}`}>{link.desc}</p>
                </div>
                <ChevronRight className={`w-4 h-4 mt-0.5 ${link.highlight ? 'text-white/70' : 'text-slate-400'}`} />
              </button>
            );
          })}
        </div>
      </div>
      {/* Auto Analysis Text */}
      <div className="bg-slate-800 border border-slate-700 p-5 rounded-xl flex gap-4 items-start shadow-inner">
        <div className="p-2 bg-slate-700 text-slate-300 rounded shrink-0">
          <AlertCircle className="w-4 h-4" />
        </div>
        <div>
          <h4 className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-2">Análisis Automático Generado</h4>
          <p className="text-sm text-slate-300 leading-relaxed font-mono">
            ACTUALMENTE SE HAN CARGADO DATOS DE <strong className="text-white bg-slate-700 px-1 rounded">{metrics.totalCursos}</strong> CURSOS, 
            ANALIZANDO UN TOTAL DE <strong className="text-white bg-slate-700 px-1 rounded">{metrics.totalEstudiantes}</strong> ESTUDIANTES PARA EL PERÍODO {periodoActivo}. 
            SE IDENTIFICARON <strong className="text-red-400 bg-red-900/30 px-1 rounded">{metrics.riesgoAlto} ESTUDIANTES ({metrics.pctRiesgoAlto !== null && metrics.pctRiesgoAlto !== undefined ? metrics.pctRiesgoAlto.toFixed(1) : '0.0'}%)</strong> EN RIESGO ALTO O CRÍTICO DE PÉRDIDA. 
            ADEMÁS, HAY <strong className="text-yellow-400 bg-yellow-900/30 px-1 rounded">{metrics.totalAlertas} ALERTAS</strong> DE CALIDAD DE DATOS QUE REQUIEREN REVISIÓN.
          </p>
        </div>
      </div>
    </div>
  );
};
