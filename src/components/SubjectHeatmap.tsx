import React, { memo, useState, useCallback, useMemo } from 'react';
import { createPortal } from 'react-dom';
import { ChartTooltipBox } from './ChartTooltipBox';

export interface HeatmapCell {
  asignatura: string;
  grado: number;
  pct: number | null;
  total: number;
  perdidas: number;
}

export interface AsignaturaHeatmapMeta {
  esCentroInteres: boolean;
}

interface Props {
  asignaturas: string[];
  grados: number[];
  cells: HeatmapCell[];
  meta: Record<string, AsignaturaHeatmapMeta>;
  selectedCell?: { asignatura: string; grado: number } | null;
  onCellClick?: (asignatura: string, grado: number) => void;
  /** Mapa de centros de interés: verde si hay estudiantes sin pérdidas; leyenda distinta. */
  variant?: 'academica' | 'centroInteres';
}

const cellColor = (
  pct: number | null,
  hasData: boolean,
  perdidas: number,
  variant: Props['variant']
): string => {
  if (!hasData) return '#f8fafc';
  if (variant === 'centroInteres' && perdidas === 0) return '#86efac';
  if (pct === null || pct === 0) return '#fef9c3';
  if (pct < 10) return '#fef9c3';
  if (pct < 20) return '#fde047';
  if (pct < 30) return '#fb923c';
  if (pct < 40) return '#f87171';
  return '#dc2626';
};

const cellTextColor = (
  pct: number | null,
  hasData: boolean,
  perdidas: number,
  variant: Props['variant']
): string => {
  if (!hasData) return '#94a3b8';
  if (variant === 'centroInteres' && perdidas === 0) return '#14532d';
  if (pct !== null && pct >= 30) return '#ffffff';
  return '#1e293b';
};

const TOOLTIP_OFFSET = 14;

export const SubjectHeatmap = memo(function SubjectHeatmap({
  asignaturas,
  grados,
  cells,
  meta,
  selectedCell,
  onCellClick,
  variant = 'academica',
}: Props) {
  const [hovered, setHovered] = useState<HeatmapCell | null>(null);
  const [tooltipPos, setTooltipPos] = useState<{ x: number; y: number } | null>(null);

  const cellMap = useMemo(() => {
    const map = new Map<string, HeatmapCell>();
    cells.forEach(c => map.set(`${c.asignatura}|${c.grado}`, c));
    return map;
  }, [cells]);

  const updateTooltipPos = useCallback((clientX: number, clientY: number) => {
    setTooltipPos({ x: clientX, y: clientY });
  }, []);

  const handleCellEnter = useCallback((cell: HeatmapCell, e: React.MouseEvent) => {
    setHovered(cell);
    updateTooltipPos(e.clientX, e.clientY);
  }, [updateTooltipPos]);

  const handleCellMove = useCallback((e: React.MouseEvent) => {
    updateTooltipPos(e.clientX, e.clientY);
  }, [updateTooltipPos]);

  const handleLeave = useCallback(() => {
    setHovered(null);
    setTooltipPos(null);
  }, []);

  const tooltipLines = useMemo(() => {
    if (!hovered) return [];
    if (hovered.perdidas === 0) {
      return [
        `${hovered.total} estudiante${hovered.total !== 1 ? 's' : ''} · sin pérdidas`,
        'Clic para ver desglose por curso',
      ];
    }
    return [
      `${hovered.perdidas} de ${hovered.total} notas en Bajo`,
      `${hovered.pct!.toFixed(1)}% del grado`,
      'Clic para ver desglose por curso',
    ];
  }, [hovered]);

  const tooltipStyle = useMemo((): React.CSSProperties | null => {
    if (!tooltipPos) return null;
    const maxW = 260;
    const maxH = 120;
    let left = tooltipPos.x + TOOLTIP_OFFSET;
    let top = tooltipPos.y + TOOLTIP_OFFSET;
    if (typeof window !== 'undefined') {
      if (left + maxW > window.innerWidth - 8) {
        left = tooltipPos.x - maxW - TOOLTIP_OFFSET;
      }
      if (top + maxH > window.innerHeight - 8) {
        top = tooltipPos.y - maxH - TOOLTIP_OFFSET;
      }
      left = Math.max(8, left);
      top = Math.max(8, top);
    }
    return { position: 'fixed', left, top, zIndex: 9999, maxWidth: maxW, pointerEvents: 'none' };
  }, [tooltipPos]);

  if (asignaturas.length === 0 || grados.length === 0) {
    return (
      <div className="flex items-center justify-center py-12 text-xs text-slate-400">
        Sin datos para el mapa de calor
      </div>
    );
  }

  const esMapaCI = variant === 'centroInteres';

  return (
    <div className="relative">
      {hovered && hovered.total > 0 && tooltipPos && tooltipStyle &&
        createPortal(
          <div style={tooltipStyle}>
            <ChartTooltipBox
              title={`${hovered.asignatura} · ${hovered.grado}°`}
              lines={tooltipLines}
              accent={hovered.perdidas === 0 ? 'blue' : 'red'}
            />
          </div>,
          document.body
        )}
      <div className="overflow-x-auto pb-1">
        <div
          className="grid gap-1 min-w-full"
          style={{
            gridTemplateColumns: `minmax(140px, 2fr) repeat(${grados.length}, minmax(44px, 1fr))`,
          }}
        >
          <div />
          {grados.map(g => (
            <div key={g} className="text-xs font-bold text-slate-600 text-center py-1.5">
              {g}°
            </div>
          ))}
          {asignaturas.map(asig => {
            const esCI = meta[asig]?.esCentroInteres;
            return (
              <React.Fragment key={asig}>
                <div
                  className={`text-xs font-semibold truncate pr-2 flex items-center gap-1.5 py-0.5 rounded-l ${
                    esCI ? 'text-violet-800 bg-violet-50 border-l-4 border-violet-400 pl-2' : 'text-slate-700 pl-1'
                  }`}
                  title={asig}
                >
                  {esCI && (
                    <span className="shrink-0 text-[9px] font-bold uppercase tracking-wide text-violet-600 bg-violet-100 px-1 py-0.5 rounded">
                      C.I.
                    </span>
                  )}
                  <span className="truncate">{asig}</span>
                </div>
                {grados.map(grado => {
                  const cell = cellMap.get(`${asig}|${grado}`);
                  const pct = cell?.total ? cell.pct : null;
                  const hasData = cell != null && cell.total > 0;
                  const perdidas = cell?.perdidas ?? 0;
                  const isSelected =
                    selectedCell?.asignatura === asig && selectedCell?.grado === grado;
                  const sinPerdidas = hasData && perdidas === 0;
                  return (
                    <button
                      key={`${asig}-${grado}`}
                      type="button"
                      disabled={!hasData}
                      onClick={() => hasData && onCellClick?.(asig, grado)}
                      onMouseEnter={e => hasData && cell && handleCellEnter(cell, e)}
                      onMouseMove={e => hasData && hovered && handleCellMove(e)}
                      onMouseLeave={handleLeave}
                      className={`h-9 rounded text-xs font-bold tabular-nums transition-all ${
                        hasData ? 'cursor-pointer hover:ring-2 hover:ring-blue-400 hover:ring-offset-1' : 'cursor-default'
                      } ${isSelected ? 'ring-2 ring-blue-600 ring-offset-2' : ''}`}
                      style={{
                        backgroundColor: cellColor(pct, hasData, perdidas, variant),
                        color: cellTextColor(pct, hasData, perdidas, variant),
                      }}
                    >
                      {hasData && sinPerdidas && esMapaCI
                        ? '✓'
                        : hasData && pct !== null
                          ? `${pct.toFixed(0)}%`
                          : '—'}
                    </button>
                  );
                })}
              </React.Fragment>
            );
          })}
        </div>
      </div>
      <div className="mt-4 flex flex-wrap items-center gap-x-4 gap-y-2 text-[10px] text-slate-500 border-t border-slate-100 pt-3">
        {esMapaCI ? (
          <>
            <span className="font-bold uppercase tracking-wide text-violet-700">Centros de interés:</span>
            <span className="inline-flex items-center gap-1">
              <span className="w-3.5 h-3.5 rounded-sm border border-green-300" style={{ backgroundColor: '#86efac' }} />
              Con estudiantes · 0 pérdidas
            </span>
            {[
              { label: '1–10%', color: '#fef9c3' },
              { label: '10–20%', color: '#fde047' },
              { label: '20–30%', color: '#fb923c' },
              { label: '30%+', color: '#f87171' },
            ].map(item => (
              <span key={item.label} className="inline-flex items-center gap-1">
                <span className="w-3.5 h-3.5 rounded-sm border border-slate-200" style={{ backgroundColor: item.color }} />
                {item.label}
              </span>
            ))}
          </>
        ) : (
          <>
            <span className="font-bold uppercase tracking-wide text-slate-600">% notas en Bajo:</span>
            {[
              { label: '0–10', color: '#fef9c3' },
              { label: '10–20', color: '#fde047' },
              { label: '20–30', color: '#fb923c' },
              { label: '30–40', color: '#f87171' },
              { label: '40+', color: '#dc2626' },
            ].map(item => (
              <span key={item.label} className="inline-flex items-center gap-1">
                <span className="w-3.5 h-3.5 rounded-sm border border-slate-200" style={{ backgroundColor: item.color }} />
                {item.label}
              </span>
            ))}
          </>
        )}
      </div>
    </div>
  );
});
