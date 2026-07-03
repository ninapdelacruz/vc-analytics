import React from 'react';

export const DashboardSkeleton: React.FC = () => (
  <div className="space-y-5 animate-pulse max-w-7xl mx-auto">
    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
      {[1, 2, 3].map(i => (
        <div key={i} className="h-24 bg-slate-200 rounded-xl" />
      ))}
    </div>
    <div className="h-72 bg-slate-200 rounded-xl" />
    <div className="h-96 bg-slate-200 rounded-xl" />
  </div>
);
