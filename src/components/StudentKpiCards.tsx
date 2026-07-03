import React from 'react';
import { CheckCircle, XCircle, AlertTriangle, Target } from 'lucide-react';
import { ConfiguracionAcademica } from '../types';
import { formatearNota } from '../utils/calculations';

interface StudentKpiCardsProps {
  totalAsignaturas: number;
  aprobadas: number;
  numPerdidas: number;
  enRiesgo: number;
  notaNecesariaMasAlta: number | null;
  asignaturaNotaMasAlta: string | null;
  requiereRecuperacion: boolean;
  promedioGeneral: number | null;
  riesgo: string;
  configuracion: ConfiguracionAcademica;
  filtroEstado: 'Todos' | 'Aprobada' | 'Perdida' | 'En riesgo';
  onToggleFiltroEstado: (estado: 'Todos' | 'Aprobada' | 'Perdida' | 'En riesgo') => void;
}

const pct = (n: number, total: number) => (total > 0 ? ((n / total) * 100).toFixed(1) : '0.0');

const KpiCard: React.FC<{
  title: string;
  value: string | number;
  subtitle?: string;
  icon: React.ReactNode;
  accent: string;
  active?: boolean;
  onClick?: () => void;
}> = ({ title, value, subtitle, icon, accent, active, onClick }) => (
  <button
    type="button"
    onClick={onClick}
    disabled={!onClick}
    className={`bg-white border rounded-xl p-4 shadow-sm text-left transition-all w-full ${
      active ? 'ring-2 ring-blue-400 border-blue-300 bg-blue-50/30' : 'border-slate-200 hover:border-slate-300'
    } ${onClick ? 'cursor-pointer' : 'cursor-default'}`}
  >
    <div className="flex items-start justify-between gap-2">
      <div className={`p-2 rounded-lg ${accent}`}>{icon}</div>
      <div className="flex-1 min-w-0">
        <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">{title}</p>
        <p className="text-2xl font-black text-slate-900 font-mono mt-1">{value}</p>
        {subtitle && <p className="text-[10px] text-slate-500 font-bold mt-0.5">{subtitle}</p>}
      </div>
    </div>
  </button>
);

export const StudentKpiCards: React.FC<StudentKpiCardsProps> = ({
  totalAsignaturas,
  aprobadas,
  numPerdidas,
  enRiesgo,
  notaNecesariaMasAlta,
  asignaturaNotaMasAlta,
  requiereRecuperacion,
  promedioGeneral,
  riesgo,
  configuracion,
  filtroEstado,
  onToggleFiltroEstado,
}) => {
  const getRiskColor = (r: string) => {
    switch (r) {
      case 'Crítico': return 'text-red-700 bg-red-100 border-red-200';
      case 'Alto': return 'text-red-600 bg-red-50 border-red-200';
      case 'Medio': return 'text-orange-600 bg-orange-50 border-orange-200';
      case 'Bajo': return 'text-yellow-600 bg-yellow-50 border-yellow-200';
      default: return 'text-green-700 bg-green-50 border-green-200';
    }
  };

  const promColor = promedioGeneral !== null && promedioGeneral < configuracion.notaAprobacion
    ? 'text-orange-600' : 'text-slate-900';

  return (
    <div className="space-y-4">
      {/* Perfil compacto en KPI row context handled by parent; KPI grid */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <KpiCard
          title="Asignaturas aprobadas"
          value={aprobadas}
          subtitle={`${pct(aprobadas, totalAsignaturas)}% del total`}
          icon={<CheckCircle className="w-4 h-4 text-green-600" />}
          accent="bg-green-50"
          active={filtroEstado === 'Aprobada'}
          onClick={() => onToggleFiltroEstado('Aprobada')}
        />
        <KpiCard
          title="Asignaturas perdidas"
          value={numPerdidas}
          subtitle={`${pct(numPerdidas, totalAsignaturas)}% del total`}
          icon={<XCircle className="w-4 h-4 text-red-600" />}
          accent="bg-red-50"
          active={filtroEstado === 'Perdida'}
          onClick={() => onToggleFiltroEstado('Perdida')}
        />
        <KpiCard
          title="Asignaturas en riesgo"
          value={enRiesgo}
          subtitle={`${pct(enRiesgo, totalAsignaturas)}% del total`}
          icon={<AlertTriangle className="w-4 h-4 text-amber-600" />}
          accent="bg-amber-50"
          active={filtroEstado === 'En riesgo'}
          onClick={() => onToggleFiltroEstado('En riesgo')}
        />
        <KpiCard
          title="Nota necesaria más alta"
          value={requiereRecuperacion ? 'Rec.' : notaNecesariaMasAlta !== null ? formatearNota(notaNecesariaMasAlta) : '-'}
          subtitle={asignaturaNotaMasAlta ? asignaturaNotaMasAlta : 'resto del año'}
          icon={<Target className="w-4 h-4 text-blue-600" />}
          accent="bg-blue-50"
        />
      </div>

      {/* Mini resumen promedio + riesgo */}
      <div className="flex flex-wrap items-center gap-4 px-1">
        <div>
          <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Promedio general</span>
          <p className={`text-xl font-black font-mono ${promColor}`}>
            {promedioGeneral !== null ? formatearNota(promedioGeneral) : 'N/A'}
          </p>
        </div>
        <div>
          <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Riesgo actual</span>
          <p className="mt-0.5">
            <span className={`inline-flex items-center px-2.5 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider border ${getRiskColor(riesgo)}`}>
              {riesgo}
            </span>
          </p>
        </div>
        {filtroEstado !== 'Todos' && (
          <button
            type="button"
            onClick={() => onToggleFiltroEstado('Todos')}
            className="text-[10px] font-bold text-blue-600 hover:underline uppercase ml-auto"
          >
            Quitar filtro: {filtroEstado}
          </button>
        )}
      </div>
    </div>
  );
};
