import React, { memo, useMemo } from 'react';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Cell, LabelList,
  Tooltip as RechartsTooltip, ResponsiveContainer,
} from 'recharts';
import { ChartTooltipBox } from './ChartTooltipBox';

export interface AsignaturaCriticaItem {
  asignatura: string;
  pctBajo: number;
  perdidas: number;
  total: number;
  esCentroInteres?: boolean;
}

interface Props {
  data: AsignaturaCriticaItem[];
}

const colorPorCantidad = (perdidas: number, max: number): string => {
  if (max <= 0) return '#22c55e';
  const ratio = perdidas / max;
  if (ratio >= 0.7) return '#ef4444';
  if (ratio >= 0.4) return '#f97316';
  return '#22c55e';
};

/** Abrevia etiquetas largas para el eje Y sin perder legibilidad. */
const abreviarAsignatura = (nombre: string, max = 18): string =>
  nombre.length <= max ? nombre : `${nombre.slice(0, max - 1)}…`;

export const SubjectTop10Chart = memo(function SubjectTop10Chart({ data }: Props) {
  const chartData = useMemo(
    () => [...data].sort((a, b) => a.perdidas - b.perdidas),
    [data]
  );
  const maxPerdidas = useMemo(
    () => Math.max(...data.map(d => d.perdidas), 1),
    [data]
  );
  const chartHeight = Math.max(280, chartData.length * 32 + 40);

  if (data.length === 0) {
    return (
      <div className="flex-1 flex items-center justify-center text-xs text-slate-400 min-h-[240px]">
        Sin datos para el ranking
      </div>
    );
  }

  return (
    <div className="flex-1 w-full" style={{ height: chartHeight }}>
      <ResponsiveContainer width="100%" height="100%">
        <BarChart
          data={chartData}
          layout="vertical"
          margin={{ top: 4, right: 52, left: 4, bottom: 4 }}
        >
          <CartesianGrid strokeDasharray="3 3" horizontal vertical={false} stroke="#f1f5f9" />
          <XAxis type="number" domain={[0, Math.ceil(maxPerdidas * 1.12)]} hide />
          <YAxis
            dataKey="asignatura"
            type="category"
            axisLine={false}
            tickLine={false}
            width={132}
            interval={0}
            tick={({ x, y, payload }: { x: number; y: number; payload: { value: string } }) => {
              const item = chartData.find(d => d.asignatura === payload.value);
              const label = abreviarAsignatura(payload.value);
              return (
                <g transform={`translate(${x},${y})`}>
                  <text
                    x={0}
                    y={0}
                    dy={4}
                    textAnchor="end"
                    fill={item?.esCentroInteres ? '#6d28d9' : '#334155'}
                    fontSize={11}
                    fontWeight={600}
                  >
                    {label}
                  </text>
                </g>
              );
            }}
          />
          <RechartsTooltip
            cursor={{ fill: '#f8fafc' }}
            offset={12}
            wrapperStyle={{ zIndex: 30, outline: 'none' }}
            isAnimationActive={false}
            content={({ active, payload }) => {
              if (!active || !payload?.length) return null;
              const d = payload[0].payload as AsignaturaCriticaItem;
              return (
                <ChartTooltipBox
                  title={d.asignatura}
                  lines={[
                    `${d.perdidas} estudiantes en Bajo`,
                    `${d.pctBajo.toFixed(1)}% de ${d.total} notas válidas`,
                    ...(d.esCentroInteres ? ['Centro de interés (multigrado)'] : []),
                  ]}
                  accent="red"
                />
              );
            }}
          />
          <Bar dataKey="perdidas" radius={[0, 5, 5, 0]} barSize={22} isAnimationActive={false}>
            {chartData.map(entry => (
              <Cell
                key={entry.asignatura}
                fill={entry.esCentroInteres ? '#8b5cf6' : colorPorCantidad(entry.perdidas, maxPerdidas)}
              />
            ))}
            <LabelList
              dataKey="perdidas"
              position="right"
              formatter={(v: number) => String(v)}
              style={{ fontSize: 12, fontWeight: 700, fill: '#1e293b' }}
            />
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
});
