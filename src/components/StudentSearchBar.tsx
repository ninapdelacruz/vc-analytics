import React from 'react';
import { Search, X } from 'lucide-react';
import { CalificacionNormalizada } from '../types';
import { crearClaveEstudiante } from '../utils/calculations';
import { buscarEstudiantes, normalizarParaBusqueda } from '../utils/studentSearch';

interface StudentSearchBarProps {
  searchTerm: string;
  onSearchChange: (value: string) => void;
  selectedStudentId: string | null;
  estudiantesUnicos: CalificacionNormalizada[][];
  onSelectStudent: (key: string, nombre: string) => void;
  onClearSelection: () => void;
}

const resaltarCoincidencias = (nombre: string, busqueda: string): React.ReactNode => {
  const tokens = normalizarParaBusqueda(busqueda).split(/\s+/).filter(t => t.length >= 2);
  if (tokens.length === 0) return nombre;

  const normNombre = normalizarParaBusqueda(nombre);
  const ranges: { start: number; end: number }[] = [];

  for (const token of tokens) {
    let idx = 0;
    while (idx < normNombre.length) {
      const found = normNombre.indexOf(token, idx);
      if (found === -1) break;
      ranges.push({ start: found, end: found + token.length });
      idx = found + 1;
    }
  }

  if (ranges.length === 0) return nombre;

  ranges.sort((a, b) => a.start - b.start);
  const merged: { start: number; end: number }[] = [];
  for (const r of ranges) {
    const last = merged[merged.length - 1];
    if (last && r.start <= last.end) last.end = Math.max(last.end, r.end);
    else merged.push({ ...r });
  }

  const parts: React.ReactNode[] = [];
  let cursor = 0;
  merged.forEach((r, i) => {
    if (cursor < r.start) parts.push(nombre.slice(cursor, r.start));
    parts.push(
      <mark key={i} className="bg-yellow-200 text-slate-900 rounded px-0.5">
        {nombre.slice(r.start, r.end)}
      </mark>
    );
    cursor = r.end;
  });
  if (cursor < nombre.length) parts.push(nombre.slice(cursor));
  return parts;
};

export const StudentSearchBar: React.FC<StudentSearchBarProps> = ({
  searchTerm,
  onSearchChange,
  selectedStudentId,
  estudiantesUnicos,
  onSelectStudent,
  onClearSelection,
}) => {
  const resultados = buscarEstudiantes(estudiantesUnicos, searchTerm);
  const showDropdown = searchTerm.length >= 2 && !selectedStudentId;

  return (
    <div className="bg-white p-5 rounded-xl shadow-sm border border-slate-200">
      <div className="flex items-center justify-between mb-3 border-b border-slate-100 pb-2">
        <h3 className="text-sm font-bold text-slate-800">Buscar Estudiante</h3>
        <span className="text-[10px] text-slate-400 font-bold uppercase tracking-wider">
          Coincidencia flexible · sin límite de resultados
        </span>
      </div>
      <div className="relative">
        <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
        <input
          type="text"
          placeholder="Ej: Padilla Dana, Padilla Marc, Beleño..."
          className="w-full pl-9 pr-10 py-2.5 text-sm border border-slate-200 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none text-slate-700 bg-slate-50"
          value={searchTerm}
          onChange={(e) => {
            onSearchChange(e.target.value);
            if (selectedStudentId) onClearSelection();
          }}
        />
        {searchTerm && (
          <button
            type="button"
            onClick={() => { onSearchChange(''); onClearSelection(); }}
            className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
          >
            <X className="w-4 h-4" />
          </button>
        )}

        {showDropdown && (
          <div className="absolute top-full left-0 right-0 mt-2 bg-white border border-slate-200 shadow-xl rounded-lg overflow-hidden z-30">
            {resultados.length === 0 ? (
              <p className="px-4 py-6 text-sm text-slate-500 text-center">
                No se encontraron estudiantes para &quot;{searchTerm}&quot;
              </p>
            ) : (
              <>
                <p className="px-4 py-2 text-[10px] font-bold text-slate-400 uppercase tracking-wider bg-slate-50 border-b border-slate-100">
                  {resultados.length} resultado{resultados.length !== 1 ? 's' : ''}
                </p>
                <div className="max-h-[320px] overflow-y-auto">
                  {resultados.map((res) => {
                    const info = res.calificaciones[0];
                    const key = crearClaveEstudiante(info);
                    return (
                      <button
                        key={key}
                        type="button"
                        className="w-full text-left px-4 py-3 hover:bg-blue-50 flex flex-col border-b border-slate-100 last:border-0 transition-colors"
                        onClick={() => onSelectStudent(key, info.estudianteNombre)}
                      >
                        <span className="font-bold text-slate-800 text-sm">
                          {resaltarCoincidencias(info.estudianteNombre, searchTerm)}
                        </span>
                        <span className="text-[10px] uppercase tracking-widest text-slate-500 mt-1 font-bold">
                          {info.grado}° · Curso {info.curso} · {info.nivel}
                          {info.estudianteNumero ? ` · #${info.estudianteNumero}` : ''}
                        </span>
                      </button>
                    );
                  })}
                </div>
              </>
            )}
          </div>
        )}
      </div>
    </div>
  );
};
