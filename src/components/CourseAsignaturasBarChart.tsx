import React, { memo } from 'react';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Cell, LabelList,
  Tooltip as RechartsTooltip, ResponsiveContainer,
} from 'recharts';
import { ChartTooltipBox } from './ChartTooltipBox';

export interface AsignaturaPerdidaItem {
  name: string;
  count: number;
  pct: number;
}

interface Props {
  data: AsignaturaPerdidaItem[];
  barDomainMax: number;
  filtroAsignatura: string | null;
  onToggleAsignatura: (name: string) => void;
}

export const CourseAsignaturasBarChart = memo(function CourseAsignaturasBarChart({
  data,
  barDomainMax,
  filtroAsignatura,
  onToggleAsignatura,
}: Props) {
  return (
    <div className="flex-1 min-h-[240px]">
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={data} layout="vertical" margin={{ top: 8, right: 48, left: 0, bottom: 8 }}>
          <CartesianGrid strokeDasharray="3 3" horizontal vertical={false} stroke="#f1f5f9" />
          <XAxis type="number" domain={[0, barDomainMax]} hide />
          <YAxis
            dataKey="name"
            type="category"
            axisLine={false}
            tickLine={false}
            tick={{ fontSize: 12, fill: '#334155', fontWeight: 600 }}
            width={104}
          />
          <RechartsTooltip
            cursor={{ fill: '#fef2f2' }}
            offset={12}
            wrapperStyle={{ zIndex: 30, outline: 'none' }}
            isAnimationActive={false}
            content={({ active, payload }) => {
              if (!active || !payload?.length) return null;
              const d = payload[0].payload as AsignaturaPerdidaItem;
              return (
                <ChartTooltipBox
                  title={d.name}
                  lines={[
                    `${d.count} estudiante${d.count !== 1 ? 's' : ''} con pérdida`,
                    `${d.pct.toFixed(1)}% del curso`,
                  ]}
                  accent="red"
                />
              );
            }}
          />
          <Bar
            dataKey="pct"
            radius={[0, 5, 5, 0]}
            barSize={24}
            name="% estudiantes"
            isAnimationActive={false}
            onClick={(d) => d?.name && onToggleAsignatura(d.name as string)}
            style={{ cursor: 'pointer' }}
          >
            {data.map(entry => (
              <Cell
                key={entry.name}
                fill="#ef4444"
                opacity={filtroAsignatura && filtroAsignatura !== entry.name ? 0.35 : 1}
                stroke={filtroAsignatura === entry.name ? '#1d4ed8' : 'none'}
                strokeWidth={filtroAsignatura === entry.name ? 2 : 0}
              />
            ))}
            <LabelList
              dataKey="pct"
              position="right"
              formatter={(v: number) => `${v.toFixed(0)}%`}
              style={{ fontSize: 12, fontWeight: 700, fill: '#1e293b' }}
            />
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
});
