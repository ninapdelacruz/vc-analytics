import React, { useState, useCallback, memo } from 'react';
import { PieChart, Pie, Cell, ResponsiveContainer } from 'recharts';
import { ChartTooltipBox } from './ChartTooltipBox';

export interface DistribucionItem {
  name: string;
  value: number;
  pct: number;
  color: string;
}

interface Props {
  data: DistribucionItem[];
  totalEstudiantes: number;
  filtroDesempeno: string | null;
  onToggleDesempeno: (name: string) => void;
}

const renderPieLabel = (props: {
  cx?: number; cy?: number; midAngle?: number; outerRadius?: number;
  percent?: number; name?: string;
}) => {
  const { cx = 0, cy = 0, midAngle = 0, outerRadius = 0, percent = 0, name = '' } = props;
  if (percent < 0.01) return null;
  const RADIAN = Math.PI / 180;
  const radius = outerRadius + 22;
  const x = cx + radius * Math.cos(-midAngle * RADIAN);
  const y = cy + radius * Math.sin(-midAngle * RADIAN);
  const texto = percent < 0.05
    ? `${(percent * 100).toFixed(0)}%`
    : `${name} ${(percent * 100).toFixed(0)}%`;
  return (
    <text
      x={x}
      y={y}
      fill="#334155"
      textAnchor={x > cx ? 'start' : 'end'}
      dominantBaseline="central"
      fontSize={13}
      fontWeight={700}
    >
      {texto}
    </text>
  );
};

export const CourseDistribucionChart = memo(function CourseDistribucionChart({
  data,
  totalEstudiantes,
  filtroDesempeno,
  onToggleDesempeno,
}: Props) {
  const [hovered, setHovered] = useState<DistribucionItem | null>(null);

  const handleEnter = useCallback((_: unknown, index: number) => {
    const d = data[index];
    if (d) setHovered(d);
  }, [data]);

  const handleLeave = useCallback(() => setHovered(null), []);

  return (
    <>
      <div className="flex-1 relative min-h-[240px]">
        {hovered && (
          <div className="absolute top-0 right-0 z-20 max-w-[220px]">
            <ChartTooltipBox
              title={hovered.name}
              lines={[
                `${hovered.value} estudiantes`,
                `${hovered.pct.toFixed(1)}% del curso`,
              ]}
              accent="blue"
            />
          </div>
        )}
        <ResponsiveContainer width="100%" height={240}>
          <PieChart margin={{ top: 16, right: 36, left: 36, bottom: 16 }}>
            <Pie
              data={data}
              cx="50%"
              cy="50%"
              innerRadius={52}
              outerRadius={76}
              paddingAngle={3}
              dataKey="value"
              stroke="none"
              isAnimationActive={false}
              label={renderPieLabel}
              labelLine={{ stroke: '#94a3b8', strokeWidth: 1 }}
              onClick={(d) => d?.name && onToggleDesempeno(d.name as string)}
              onMouseEnter={handleEnter}
              onMouseLeave={handleLeave}
              style={{ cursor: 'pointer' }}
            >
              {data.map(entry => {
                const dimmed = filtroDesempeno !== null && filtroDesempeno !== entry.name;
                return (
                  <Cell
                    key={entry.name}
                    fill={entry.color}
                    opacity={dimmed ? 0.35 : 0.92}
                    stroke={filtroDesempeno === entry.name ? '#1d4ed8' : 'none'}
                    strokeWidth={filtroDesempeno === entry.name ? 2 : 0}
                  />
                );
              })}
            </Pie>
          </PieChart>
        </ResponsiveContainer>
        <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none" style={{ marginTop: -16 }}>
          <span className="text-2xl font-black text-slate-800">{totalEstudiantes}</span>
          <span className="text-xs text-slate-400 uppercase font-bold">Total</span>
        </div>
      </div>
      <div className="mt-3 grid grid-cols-2 gap-2">
        {data.map(d => (
          <button
            key={d.name}
            type="button"
            onClick={() => onToggleDesempeno(d.name)}
            onMouseEnter={() => setHovered(d)}
            onMouseLeave={() => setHovered(null)}
            className={`flex items-center justify-between text-sm font-bold px-3 py-2 rounded-lg transition-colors ${
              filtroDesempeno === d.name ? 'bg-blue-50 ring-1 ring-blue-300' : 'hover:bg-slate-50'
            }`}
          >
            <span className="flex items-center gap-2 truncate">
              <span className="w-3 h-3 rounded-full shrink-0" style={{ backgroundColor: d.color }} />
              {d.name}
            </span>
            <span className="text-slate-600 shrink-0 ml-2 tabular-nums">{d.pct.toFixed(0)}%</span>
          </button>
        ))}
      </div>
    </>
  );
});
