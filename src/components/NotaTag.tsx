import React, { useState } from 'react';
import { createPortal } from 'react-dom';
import { formatearNota } from '../utils/calculations';

interface NotaTagProps {
  nombre: string;
  nota: number;
  periodo: string;
}

/** Chip de asignatura perdida con tooltip flotante (no se recorta por overflow de la tabla). */
export const NotaTag: React.FC<NotaTagProps> = ({ nombre, nota, periodo }) => {
  const [tip, setTip] = useState<{ x: number; y: number } | null>(null);

  return (
    <>
      <span
        role="note"
        tabIndex={0}
        onMouseEnter={(e) => {
          const r = e.currentTarget.getBoundingClientRect();
          setTip({ x: r.left + r.width / 2, y: r.top });
        }}
        onMouseLeave={() => setTip(null)}
        onFocus={(e) => {
          const r = e.currentTarget.getBoundingClientRect();
          setTip({ x: r.left + r.width / 2, y: r.top });
        }}
        onBlur={() => setTip(null)}
        className="text-[10px] font-semibold bg-red-50 text-red-800 border border-red-200 px-1.5 py-0.5 rounded cursor-help hover:bg-red-100 hover:border-red-300 transition-colors"
      >
        {nombre}
      </span>
      {tip &&
        createPortal(
          <div
            className="fixed z-[9999] pointer-events-none"
            style={{ left: tip.x, top: tip.y - 8, transform: 'translate(-50%, -100%)' }}
          >
            <div className="bg-slate-900 text-white text-[11px] font-medium rounded-lg px-3 py-2 shadow-xl border border-slate-700 whitespace-nowrap">
              <span className="text-slate-300">{nombre}</span>
              <span className="mx-1.5 text-slate-500">|</span>
              <span>
                Nota <strong className="text-blue-300">{periodo}</strong>:{' '}
                <strong className="text-amber-300 font-mono">{formatearNota(nota)}</strong>
              </span>
            </div>
          </div>,
          document.body
        )}
    </>
  );
};
