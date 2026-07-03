import React from 'react';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip as RechartsTooltip,
  ResponsiveContainer, ReferenceLine, Cell, LineChart, Line
} from 'recharts';
import { AlertTriangle, CheckCircle, Shield } from 'lucide-react';
import { ConfiguracionAcademica } from '../types';
import { formatearNota } from '../utils/calculations';

export interface ChartBarItem {
  codigo: string;
  asignatura: string;
  nota: number;
  estado: 'Perdida' | 'Aprobada' | 'En riesgo';
}

export interface TrendPoint {
  periodo: string;
  promedio: number | null;
}

interface StudentChartsProps {
  chartData: ChartBarItem[];
  trendData: TrendPoint[];
  periodoActivo: string;
  selectedCodigo: string | null;
  configuracion: ConfiguracionAcademica;
  riesgo: string;
  causaPrincipal: string;
  accionSugerida: string;
  asignaturasPrioritarias: string[];
  notaNecesariaMasAlta: number | null;
  requiereRecuperacion: boolean;
  onToggleAsignatura: (codigo: string) => void;
}

const barColor = (estado: string, selected: boolean, dimmed: boolean) => {
  if (dimmed) return '#cbd5e1';
  if (selected) return '#2563eb';
  if (estado === 'Perdida') return '#ef4444';
  if (estado === 'En riesgo') return '#f59e0b';
  return '#1e40af';
};

export const StudentCharts: React.FC<StudentChartsProps> = ({
  chartData,
  trendData,
  periodoActivo,
  selectedCodigo,
  configuracion,
  riesgo,
  causaPrincipal,
  accionSugerida,
  asignaturasPrioritarias,
  notaNecesariaMasAlta,
  requiereRecuperacion,
  onToggleAsignatura,
}) => {
  const hasSelection = selectedCodigo !== null;

  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
      {/* Bar chart */}
      <div className="bg-white p-5 rounded-xl shadow-sm border border-slate-200 lg:col-span-2">
        <h3 className="text-xs font-bold text-slate-800 uppercase tracking-wider mb-1">
          Notas por asignatura ({periodoActivo})
        </h3>
        <p className="text-[10px] text-slate-400 font-bold uppercase tracking-widest mb-3">
          Clic en barra para filtrar tabla · segundo clic quita
        </p>
        <div className="h-[280px]">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={chartData} margin={{ top: 20, right: 10, left: 0, bottom: 70 }}>
              <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" />
              <XAxis
                dataKey="asignatura"
                angle={-40}
                textAnchor="end"
                height={70}
                tick={{ fontSize: 8, fill: '#64748b', fontWeight: 600 }}
                interval={0}
                axisLine={false}
                tickLine={false}
              />
              <YAxis
                domain={[configuracion.notaMinima, configuracion.notaMaxima]}
                tick={{ fontSize: 10, fill: '#64748b' }}
                axisLine={false}
                tickLine={false}
              />
              <RechartsTooltip
                cursor={{ fill: '#f8fafc' }}
                contentStyle={{ borderRadius: '8px', border: '1px solid #e2e8f0', fontSize: '12px' }}
                formatter={(v: number) => [formatearNota(v), 'Nota']}
              />
              <ReferenceLine
                y={configuracion.notaAprobacion}
                stroke="#ef4444"
                strokeDasharray="4 4"
                label={{ position: 'insideTopRight', value: `Mín. ${configuracion.notaAprobacion}`, fill: '#ef4444', fontSize: 10, fontWeight: 700 }}
              />
              <Bar
                dataKey="nota"
                radius={[3, 3, 0, 0]}
                label={{ position: 'top', fill: '#475569', fontSize: 8, fontWeight: 'bold', formatter: (v: number) => formatearNota(v, 1) }}
                onClick={(data) => {
                  if (data?.codigo) onToggleAsignatura(data.codigo as string);
                }}
                style={{ cursor: 'pointer' }}
              >
                {chartData.map((entry) => {
                  const isSelected = selectedCodigo === entry.codigo;
                  const isDimmed = hasSelection && !isSelected;
                  return (
                    <Cell
                      key={entry.codigo}
                      fill={barColor(entry.estado, isSelected, isDimmed)}
                      stroke={isSelected ? '#1d4ed8' : 'none'}
                      strokeWidth={isSelected ? 2 : 0}
                    />
                  );
                })}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Trend + Recommendation column */}
      <div className="flex flex-col gap-4">
        <div className="bg-white p-5 rounded-xl shadow-sm border border-slate-200 flex-1">
          <h3 className="text-xs font-bold text-slate-800 uppercase tracking-wider mb-1">Tendencia por período</h3>
          <p className="text-[10px] text-slate-400 font-bold uppercase tracking-widest mb-3">Promedio general</p>
          <div className="h-[160px]">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={trendData} margin={{ top: 10, right: 10, left: -10, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" />
                <XAxis dataKey="periodo" tick={{ fontSize: 10, fill: '#64748b', fontWeight: 700 }} axisLine={false} tickLine={false} />
                <YAxis domain={[configuracion.notaMinima, configuracion.notaMaxima]} tick={{ fontSize: 9, fill: '#64748b' }} axisLine={false} tickLine={false} width={28} />
                <RechartsTooltip formatter={(v: number) => [formatearNota(v), 'Promedio']} contentStyle={{ fontSize: '12px', borderRadius: '8px' }} />
                <ReferenceLine y={configuracion.notaAprobacion} stroke="#ef4444" strokeDasharray="4 4" />
                <Line type="monotone" dataKey="promedio" stroke="#2563eb" strokeWidth={2.5} dot={{ r: 4, fill: '#2563eb' }} connectNulls={false} />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div className="bg-slate-800 p-5 rounded-xl shadow-sm border border-slate-700 flex flex-col gap-3">
          <div className="flex items-center justify-between border-b border-slate-700 pb-2">
            <h3 className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Recomendación académica</h3>
            {riesgo === 'Crítico' || riesgo === 'Alto' ? (
              <AlertTriangle className="w-5 h-5 text-red-400" />
            ) : riesgo === 'Sin riesgo' ? (
              <CheckCircle className="w-5 h-5 text-green-400" />
            ) : (
              <Shield className="w-5 h-5 text-amber-400" />
            )}
          </div>
          <p className="text-xs text-slate-300 leading-relaxed">{causaPrincipal}</p>
          <p className="text-xs text-slate-400 leading-relaxed">{accionSugerida}</p>
          {asignaturasPrioritarias.length > 0 && (
            <div className="pt-2 border-t border-slate-700">
              <p className="text-[10px] text-slate-500 font-bold uppercase tracking-widest mb-1">Prioridad de intervención</p>
              <p className="text-[9px] text-slate-500 mb-1">Ordenadas por nota necesaria restante (mayor urgencia primero)</p>
              <p className="text-xs text-amber-300 font-bold">{asignaturasPrioritarias.join(', ')}</p>
            </div>
          )}
          {(riesgo === 'Crítico' || riesgo === 'Alto') && (
            <div className="pt-2 border-t border-slate-700">
              <p className="text-[10px] text-slate-500 font-bold uppercase tracking-widest mb-1">Meta resto del año</p>
              <p className="text-2xl font-black text-white font-mono">
                {requiereRecuperacion ? 'Recuperación' : notaNecesariaMasAlta !== null ? formatearNota(notaNecesariaMasAlta) : '-'}
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
