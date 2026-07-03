import React from 'react';

interface ChartTooltipBoxProps {
  title: string;
  lines: string[];
  accent?: 'red' | 'blue' | 'neutral';
}

export const ChartTooltipBox: React.FC<ChartTooltipBoxProps> = ({ title, lines, accent = 'neutral' }) => {
  const accentClass =
    accent === 'red' ? 'text-red-300' : accent === 'blue' ? 'text-blue-300' : 'text-slate-300';

  return (
    <div className="bg-slate-900 text-white text-xs rounded-lg px-3 py-2 shadow-xl border border-slate-700 pointer-events-none">
      <p className={`font-bold ${accentClass}`}>{title}</p>
      {lines.map((line, i) => (
        <p key={i} className="text-slate-200 mt-0.5 font-medium">
          {line}
        </p>
      ))}
    </div>
  );
};
