import React from 'react';
import { BookOpen } from 'lucide-react';
import { ConfiguracionAcademica } from '../types';
import { formatearNota, EstadoAsignatura, PeriodoCodigo } from '../utils/calculations';

export interface AsignaturaFila {
  codigoAsignatura: string;
  nombreAsignatura: string;
  tipoAsignatura: string;
  p1: number | null;
  p2: number | null;
  p3: number | null;
  p4: number | null;
  def: number | null;
  notaEvaluada: number;
  nota: number;
  estado: EstadoAsignatura;
  estadoDef: EstadoAsignatura | null;
  notaNecesaria: number | null;
  observacion: string;
}

interface StudentSubjectTableProps {
  filas: AsignaturaFila[];
  periodoActivo: string;
  selectedCodigo: string | null;
  onToggleAsignatura: (codigo: string) => void;
  configuracion: ConfiguracionAcademica;
  columnasPeriodo?: PeriodoCodigo[];
}

const estadoStyles: Record<string, string> = {
  Perdida: 'bg-red-50 text-red-700 border-red-200',
  Aprobada: 'bg-green-50 text-green-700 border-green-200',
  'En riesgo': 'bg-amber-50 text-amber-700 border-amber-200',
  'Sin datos': 'bg-slate-100 text-slate-600 border-slate-200',
};

const ALL_PERIOD_COLUMNS: PeriodoCodigo[] = ['P1', 'P2', 'P3', 'P4', 'DEF'];

const periodCellClass = (period: string, periodoActivo: string, isDefCol: boolean) => {
  const isActive =
    (periodoActivo === 'DEF' && isDefCol) ||
    (periodoActivo === period && !isDefCol);
  return isActive
    ? 'bg-blue-50 font-bold text-blue-900 ring-1 ring-inset ring-blue-200'
    : 'text-slate-600';
};

export const StudentSubjectTable: React.FC<StudentSubjectTableProps> = ({
  filas,
  periodoActivo,
  selectedCodigo,
  onToggleAsignatura,
  columnasPeriodo = ALL_PERIOD_COLUMNS,
}) => {
  const fmt = (n: number | null) => (n !== null && !isNaN(n) ? formatearNota(n) : '-');

  const periodValues: Record<string, (a: AsignaturaFila) => number | null> = {
    P1: a => a.p1,
    P2: a => a.p2,
    P3: a => a.p3,
    P4: a => a.p4,
    DEF: a => a.def,
  };

  return (
    <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
      <div className="p-4 border-b border-slate-100 bg-slate-50 flex items-center justify-between">
        <div>
          <h3 className="text-sm font-bold text-slate-800 uppercase tracking-widest">Desempeño por asignatura</h3>
          <p className="text-[10px] text-slate-500 font-bold mt-0.5 max-w-2xl">
            Columna <span className="text-blue-700">{periodoActivo}</span> resaltada = nota que determina el estado.
            {periodoActivo !== 'DEF' && ' La columna DEF muestra el promedio P1+P2 y puede diferir del estado del período activo.'}
          </p>
        </div>
        {selectedCodigo && (
          <button
            type="button"
            onClick={() => onToggleAsignatura(selectedCodigo)}
            className="text-[10px] font-bold text-blue-600 hover:underline uppercase shrink-0"
          >
            Quitar selección
          </button>
        )}
      </div>
      <div className="overflow-x-auto">
        <table className="w-full text-left text-sm min-w-[900px]">
          <thead className="bg-slate-100 text-slate-500 font-bold text-[10px] uppercase tracking-widest border-b border-slate-200">
            <tr>
              <th className="px-4 py-3">Asignatura</th>
              <th className="px-4 py-3">Tipo</th>
              {columnasPeriodo.map(p => (
                <th
                  key={p}
                  className={`px-4 py-3 text-center ${periodCellClass(p, periodoActivo, p === 'DEF')}`}
                >
                  {p}
                  {(periodoActivo === p || (periodoActivo === 'DEF' && p === 'DEF')) && (
                    <span className="block text-[8px] text-blue-600 font-normal normal-case">activo</span>
                  )}
                </th>
              ))}
              <th className="px-4 py-3">Estado ({periodoActivo})</th>
              <th className="px-4 py-3 text-right">Nota necesaria</th>
              <th className="px-4 py-3">Observación</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {filas.length === 0 && (
              <tr>
                <td colSpan={11} className="px-4 py-8 text-center text-slate-400 text-xs">
                  Sin asignaturas para el filtro seleccionado
                </td>
              </tr>
            )}
            {filas.map((asig) => {
              const isSelected = selectedCodigo === asig.codigoAsignatura;
              const isDimmed = selectedCodigo !== null && !isSelected;
              const showEstadoDef = asig.estadoDef && asig.estadoDef !== asig.estado && periodoActivo !== 'DEF';

              return (
                <tr
                  key={asig.codigoAsignatura}
                  onClick={() => onToggleAsignatura(asig.codigoAsignatura)}
                  className={`cursor-pointer transition-all ${
                    isSelected
                      ? 'bg-blue-50 ring-1 ring-inset ring-blue-300'
                      : isDimmed
                        ? 'opacity-40 hover:opacity-60'
                        : 'hover:bg-slate-50'
                  }`}
                >
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-2 font-medium text-slate-800 text-xs">
                      <BookOpen className="w-3.5 h-3.5 text-blue-600 shrink-0" />
                      <span className="truncate max-w-[180px]" title={asig.nombreAsignatura}>
                        {asig.nombreAsignatura}
                      </span>
                    </div>
                  </td>
                  <td className="px-4 py-3 text-[10px] text-slate-500 font-bold uppercase">{asig.tipoAsignatura}</td>
                  {columnasPeriodo.map(p => (
                    <td
                      key={p}
                      className={`px-4 py-3 font-mono text-xs text-center ${periodCellClass(p, periodoActivo, p === 'DEF')}`}
                    >
                      {fmt(periodValues[p](asig))}
                    </td>
                  ))}
                  <td className="px-4 py-3">
                    <div className="flex flex-col gap-1">
                      <span className={`inline-flex items-center w-fit px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider border ${estadoStyles[asig.estado]}`}>
                        {asig.estado}
                      </span>
                      {showEstadoDef && (
                        <span className={`inline-flex items-center w-fit px-2 py-0.5 rounded text-[9px] font-bold uppercase tracking-wider border ${estadoStyles[asig.estadoDef!]}`}>
                          DEF: {asig.estadoDef}
                        </span>
                      )}
                    </div>
                  </td>
                  <td className="px-4 py-3 font-bold text-blue-700 font-mono text-xs text-right">
                    {asig.notaNecesaria === 999 ? 'Requiere Rec.' : asig.notaNecesaria !== null ? formatearNota(asig.notaNecesaria) : '-'}
                  </td>
                  <td className="px-4 py-3 text-[10px] text-slate-500 max-w-[220px] leading-relaxed">{asig.observacion}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
};
