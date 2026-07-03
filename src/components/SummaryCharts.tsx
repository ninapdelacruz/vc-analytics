import React from 'react';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip as RechartsTooltip, ResponsiveContainer, Cell,
  LineChart, Line, PieChart, Pie, Legend
} from 'recharts';

export interface RiskChartItem {
  name: string;
  value: number;
  pct: number;
  color: string;
}

export interface RankListItem {
  id: string;
  label: string;
  value: number;
  subValue?: number;
  pct?: number;
  progressPct: number;
  cursoKey?: string;
}

export interface ActiveCrossFilters {
  riesgo: string;
  asignatura: string;
  cursoKey: string;
  desempeno: string;
}

interface SummaryChartsProps {
  riesgoChartData: RiskChartItem[];
  topAsignaturasLista: RankListItem[];
  topCursosLista: RankListItem[];
  topCIAsignaturas: any[];
  desempenoChartData: { name: string; value: number; color: string }[];
  levelComparisonData: any[];
  trendData: any[];
  activeFilters: ActiveCrossFilters;
  onToggleRiesgo: (riesgo: string) => void;
  onToggleAsignatura: (nombre: string) => void;
  onToggleCurso: (item: RankListItem) => void;
  onToggleDesempeno: (nivel: string) => void;
  onToggleCIAsignatura?: (nombre: string) => void;
}

const ChartCard: React.FC<{ title: string; subtitle: string; children: React.ReactNode; className?: string }> = ({
  title, subtitle, children, className = ''
}) => (
  <div className={`bg-white border border-slate-200 p-4 rounded-xl shadow-sm flex flex-col ${className}`}>
    <div className="mb-3">
      <h3 className="text-xs font-bold text-slate-800 uppercase tracking-wider">{title}</h3>
      <p className="text-[10px] text-slate-400 font-bold uppercase tracking-widest mt-0.5">{subtitle}</p>
    </div>
    {children}
  </div>
);

const RankList: React.FC<{
  items: RankListItem[];
  barColor: string;
  activeId: string;
  valueSuffix?: string;
  onItemClick: (item: RankListItem) => void;
}> = ({ items, barColor, activeId, valueSuffix = '', onItemClick }) => (
  <div className="flex flex-col gap-2 overflow-y-auto max-h-[260px] pr-1">
    {items.length === 0 && (
      <p className="text-xs text-slate-400 text-center py-8">Sin datos para la selección actual</p>
    )}
    {items.map((item, idx) => {
      const isActive = activeId === item.id;
      return (
        <button
          key={item.id}
          type="button"
          onClick={() => onItemClick(item)}
          className={`w-full text-left rounded-lg p-2 transition-all border ${
            isActive
              ? 'bg-blue-50 border-blue-300 ring-1 ring-blue-400'
              : 'bg-slate-50/50 border-transparent hover:bg-slate-100 hover:border-slate-200'
          }`}
          title="Clic para filtrar / clic de nuevo para quitar"
        >
          <div className="flex items-center justify-between gap-2 mb-1">
            <span className="text-[10px] font-bold text-slate-500 w-4">{idx + 1}.</span>
            <span className="text-xs font-bold text-slate-700 flex-1 truncate">{item.label}</span>
            <span className="text-xs font-black font-mono text-slate-900 shrink-0">
              {item.value}{valueSuffix}
            </span>
          </div>
          <div className="h-1.5 bg-slate-200 rounded-full overflow-hidden ml-6">
            <div
              className="h-full rounded-full transition-all duration-300"
              style={{ width: `${item.progressPct}%`, backgroundColor: barColor }}
            />
          </div>
          {item.pct !== undefined && (
            <p className="text-[9px] text-slate-400 font-mono mt-0.5 ml-6">{item.pct.toFixed(1)}% en Bajo</p>
          )}
        </button>
      );
    })}
  </div>
);

export const SummaryCharts: React.FC<SummaryChartsProps> = ({
  riesgoChartData,
  topAsignaturasLista,
  topCursosLista,
  topCIAsignaturas,
  desempenoChartData,
  levelComparisonData,
  trendData,
  activeFilters,
  onToggleRiesgo,
  onToggleAsignatura,
  onToggleCurso,
  onToggleDesempeno,
  onToggleCIAsignatura,
}) => {
  const totalRiesgo = riesgoChartData.reduce((s, d) => s + d.value, 0);

  const renderRiskLabel = (props: any) => {
    const { x, y, width, value, index } = props;
    const item = riesgoChartData[index];
    if (!item || value === 0) return null;
    return (
      <text x={x + width / 2} y={y - 6} fill="#475569" textAnchor="middle" fontSize={9} fontWeight="bold">
        {value} ({item.pct.toFixed(1)}%)
      </text>
    );
  };

  return (
    <div className="space-y-4" id="summary-charts-grid">
      {/* Fila 1 — 4 widgets principales (mockup) */}
      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4">
        {/* Riesgo */}
        <ChartCard
          title="Estudiantes por nivel de riesgo"
          subtitle="Clic en barras para filtrar (Power BI)"
          className="h-[340px]"
        >
          <div className="flex-1 h-[260px]">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={riesgoChartData} margin={{ top: 20, right: 8, left: -20, bottom: 5 }}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                <XAxis dataKey="name" tick={{ fontSize: 9, fontWeight: 'bold', fill: '#64748b' }} axisLine={false} tickLine={false} />
                <YAxis tick={{ fontSize: 9, fill: '#64748b' }} axisLine={false} tickLine={false} />
                <RechartsTooltip
                  content={({ active, payload }) => {
                    if (!active || !payload?.length) return null;
                    const d = payload[0].payload as RiskChartItem;
                    return (
                      <div className="bg-slate-800 text-white p-2.5 rounded-lg text-xs font-mono border border-slate-700 shadow-xl">
                        <p className="font-bold uppercase text-slate-300">{d.name}</p>
                        <p>{d.value} estudiantes ({d.pct.toFixed(1)}%)</p>
                        <p className="text-slate-400 mt-1 text-[10px]">Clic para filtrar cruzado</p>
                      </div>
                    );
                  }}
                />
                <Bar
                  dataKey="value"
                  style={{ cursor: 'pointer' }}
                  onClick={(data: any) => data?.name && onToggleRiesgo(data.name)}
                  radius={[4, 4, 0, 0]}
                  label={renderRiskLabel}
                >
                  {riesgoChartData.map((entry, i) => {
                    const isActive = activeFilters.riesgo === entry.name
                      || (activeFilters.riesgo === 'Alto/Crítico' && (entry.name === 'Alto' || entry.name === 'Crítico'));
                    return (
                      <Cell
                        key={i}
                        fill={entry.color}
                      opacity={activeFilters.riesgo && activeFilters.riesgo !== 'Todos' && !isActive ? 0.35 : 1}
                        stroke={isActive ? '#1e40af' : undefined}
                        strokeWidth={isActive ? 2 : 0}
                      />
                    );
                  })}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
          <p className="text-[9px] text-slate-400 text-center mt-1 font-mono">Total: {totalRiesgo} estudiantes</p>
        </ChartCard>

        {/* Top cursos — lista con progress bar */}
        <ChartCard
          title="Top 5 cursos en riesgo alto/crítico"
          subtitle="Clic para filtrar curso, nivel y grado"
          className="h-[340px]"
        >
          <RankList
            items={topCursosLista}
            barColor="#ea580c"
            activeId={activeFilters.cursoKey}
            onItemClick={onToggleCurso}
          />
        </ChartCard>

        {/* Top asignaturas — lista con % en Bajo */}
        <ChartCard
          title="Top 10 asignaturas con más estudiantes en Bajo"
          subtitle="Clic para filtrar asignatura académica"
          className="h-[340px]"
        >
          <RankList
            items={topAsignaturasLista}
            barColor="#ef4444"
            activeId={activeFilters.asignatura}
            onItemClick={(item) => onToggleAsignatura(item.label)}
          />
        </ChartCard>

        {/* Donut desempeño */}
        <ChartCard
          title="Distribución de desempeño general"
          subtitle="Clic en segmento para filtrar por nivel"
          className="h-[340px]"
        >
          <div className="flex flex-col sm:flex-row items-center justify-center gap-3 flex-1 min-h-[260px]">
            <div className="w-44 h-44">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={desempenoChartData}
                    cx="50%"
                    cy="50%"
                    innerRadius={48}
                    outerRadius={68}
                    paddingAngle={2}
                    dataKey="value"
                    style={{ cursor: 'pointer' }}
                    onClick={(_, index) => {
                      const name = desempenoChartData[index]?.name;
                      if (name) onToggleDesempeno(name);
                    }}
                  >
                    {desempenoChartData.map((entry, index) => {
                      const isActive = activeFilters.desempeno === entry.name;
                      return (
                        <Cell
                          key={index}
                          fill={entry.color}
                          opacity={activeFilters.desempeno && activeFilters.desempeno !== '' && !isActive ? 0.35 : 1}
                          stroke={isActive ? '#1e40af' : '#fff'}
                          strokeWidth={isActive ? 2 : 1}
                        />
                      );
                    })}
                  </Pie>
                  <RechartsTooltip
                    content={({ active, payload }) => {
                      if (!active || !payload?.length) return null;
                      const d = payload[0].payload;
                      const total = desempenoChartData.reduce((s, i) => s + i.value, 0);
                      const pct = total > 0 ? ((d.value / total) * 100).toFixed(1) : '0';
                      return (
                        <div className="bg-slate-800 text-white p-2.5 rounded-lg text-xs font-mono">
                          <p className="font-bold">{d.name}</p>
                          <p>{d.value} ({pct}%)</p>
                        </div>
                      );
                    }}
                  />
                </PieChart>
              </ResponsiveContainer>
            </div>
            <div className="flex flex-col gap-1.5">
              {desempenoChartData.map((entry, i) => {
                const isActive = activeFilters.desempeno === entry.name;
                return (
                  <button
                    key={i}
                    type="button"
                    onClick={() => onToggleDesempeno(entry.name)}
                    className={`flex items-center gap-2 px-2 py-1 rounded text-left transition-all ${
                      isActive ? 'bg-blue-50 ring-1 ring-blue-400' : 'hover:bg-slate-50'
                    }`}
                  >
                    <div className="w-2.5 h-2.5 rounded-sm shrink-0" style={{ backgroundColor: entry.color }} />
                    <span className="text-[10px] font-bold text-slate-600">{entry.name}:</span>
                    <span className="text-[10px] font-mono font-bold text-slate-800">{entry.value}</span>
                  </button>
                );
              })}
            </div>
          </div>
        </ChartCard>
      </div>

      {/* Fila 2 — comparativo y tendencia */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <ChartCard
          title="Comparativo por nivel escolar"
          subtitle="Primaria vs Bachillerato — métricas cruzadas"
          className="h-[320px]"
        >
          <div className="h-[250px]">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={levelComparisonData} margin={{ top: 16, right: 30, left: -10, bottom: 5 }}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                <XAxis dataKey="name" tick={{ fontSize: 10, fontWeight: 'bold', fill: '#64748b' }} axisLine={false} tickLine={false} />
                <YAxis yAxisId="left" domain={[0, 10]} tick={{ fontSize: 9, fill: '#64748b' }} axisLine={false} tickLine={false} />
                <YAxis yAxisId="right" orientation="right" tick={{ fontSize: 9, fill: '#64748b' }} axisLine={false} tickLine={false} />
                <RechartsTooltip />
                <Legend wrapperStyle={{ fontSize: '10px', fontWeight: 'bold' }} />
                <Bar yAxisId="left" dataKey="Promedio" fill="#2563eb" radius={[4, 4, 0, 0]} name="Promedio" />
                <Bar yAxisId="right" dataKey="% Promedio en Bajo" fill="#f59e0b" radius={[4, 4, 0, 0]} name="% Prom. Bajo" />
                <Bar yAxisId="right" dataKey="Riesgo Alto/Crítico" fill="#ef4444" radius={[4, 4, 0, 0]} name="Riesgo A/C" />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </ChartCard>

        <ChartCard
          title="Tendencia por período académico"
          subtitle="Promedio (eje izq.) y % con pérdidas (eje der.)"
          className="h-[320px]"
        >
          <div className="h-[250px]">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={trendData} margin={{ top: 16, right: 30, left: -10, bottom: 5 }}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                <XAxis dataKey="name" tick={{ fontSize: 10, fontWeight: 'bold', fill: '#64748b' }} axisLine={false} tickLine={false} />
                <YAxis yAxisId="left" domain={[0, 10]} tick={{ fontSize: 9, fill: '#64748b' }} axisLine={false} tickLine={false} />
                <YAxis yAxisId="right" orientation="right" domain={[0, 100]} tick={{ fontSize: 9, fill: '#64748b' }} axisLine={false} tickLine={false} />
                <RechartsTooltip
                  content={({ active, payload }) => {
                    if (!active || !payload?.length) return null;
                    const d = payload[0].payload;
                    if (!d.hasData) {
                      return (
                        <div className="bg-slate-800 text-white p-2 rounded text-xs font-mono">
                          {d.name}: sin datos
                        </div>
                      );
                    }
                    return (
                      <div className="bg-slate-800 text-white p-2.5 rounded-lg text-xs font-mono">
                        <p className="font-bold">{d.name}</p>
                        <p className="text-blue-300">Promedio: {d.Promedio?.toFixed(2)}</p>
                        <p className="text-red-300">% Pérdidas: {d['% Estudiantes con Pérdidas']?.toFixed(1)}%</p>
                      </div>
                    );
                  }}
                />
                <Legend wrapperStyle={{ fontSize: '10px', fontWeight: 'bold' }} />
                <Line yAxisId="left" type="monotone" dataKey="Promedio" stroke="#3b82f6" strokeWidth={2.5} dot={{ r: 4 }} connectNulls={false} />
                <Line yAxisId="right" type="monotone" dataKey="% Estudiantes con Pérdidas" stroke="#ef4444" strokeWidth={2.5} dot={{ r: 4 }} connectNulls={false} />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </ChartCard>
      </div>

      {/* Centros de interés — condicional */}
      {topCIAsignaturas.length > 0 && (
        <ChartCard
          title="Centros de interés con más pérdidas"
          subtitle="Clic para filtrar centro de interés"
          className="h-[280px]"
        >
          <RankList
            items={topCIAsignaturas.map((a, i) => ({
              id: a.nombre,
              label: a.nombre,
              value: a.perdidos,
              pct: a.pctPerdida,
              progressPct: topCIAsignaturas[0]?.perdidos > 0 ? (a.perdidos / topCIAsignaturas[0].perdidos) * 100 : 0,
            }))}
            barColor="#6366f1"
            activeId={activeFilters.asignatura}
            onItemClick={(item) => onToggleCIAsignatura?.(item.label)}
          />
        </ChartCard>
      )}
    </div>
  );
};
