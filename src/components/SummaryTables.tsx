import React, { useState, useMemo } from 'react';
import { Search, Download, ArrowUpDown, ChevronLeft, ChevronRight, FileSpreadsheet, ShieldAlert, AlertTriangle, AlertCircle, CheckCircle2 } from 'lucide-react';
import { exportToCSV } from '../utils/exporter';

interface SummaryTablesProps {
  cursosResumen: any[];
  asignaturasResumen: any[];
  estudiantesPrioritarios: any[];
  alertasAfectanResumen: any[];
  onFilterCurso: (curso: string) => void;
  onFilterAsignatura: (asignatura: string) => void;
  onFilterRiesgo: (riesgo: string) => void;
}

export const SummaryTables: React.FC<SummaryTablesProps> = ({
  cursosResumen,
  asignaturasResumen,
  estudiantesPrioritarios,
  alertasAfectanResumen,
  onFilterCurso,
  onFilterAsignatura,
  onFilterRiesgo,
}) => {
  const [activeTab, setActiveTab] = useState<'cursos' | 'asignaturas' | 'estudiantes' | 'alertas'>('cursos');

  // Search states
  const [searchCurso, setSearchCurso] = useState('');
  const [searchAsignatura, setSearchAsignatura] = useState('');
  const [searchEstudiante, setSearchEstudiante] = useState('');
  const [searchAlerta, setSearchAlerta] = useState('');

  // PROBLEM 14: Default prioritarios filters and sorting
  const [mostrarTodosPrioritarios, setMostrarTodosPrioritarios] = useState(false);

  // Sort states
  const [sortFieldCurso, setSortFieldCurso] = useState<string>('curso');
  const [sortOrderCurso, setSortOrderCurso] = useState<'asc' | 'desc'>('asc');

  const [sortFieldAsignatura, setSortFieldAsignatura] = useState<string>('asignatura');
  const [sortOrderAsignatura, setSortOrderAsignatura] = useState<'asc' | 'desc'>('asc');

  // Default sorting: asignaturasPerdidas descending (Problem 14)
  const [sortFieldEstudiante, setSortFieldEstudiante] = useState<string>('asignaturasPerdidas');
  const [sortOrderEstudiante, setSortOrderEstudiante] = useState<'asc' | 'desc'>('desc');

  const [sortFieldAlerta, setSortFieldAlerta] = useState<string>('gravedad');
  const [sortOrderAlerta, setSortOrderAlerta] = useState<'asc' | 'desc'>('desc');

  // Pagination states
  const [pageCurso, setPageCurso] = useState(1);
  const pageSizeCurso = 5;

  const [pageAsignatura, setPageAsignatura] = useState(1);
  const pageSizeAsignatura = 10;

  const [pageEstudiante, setPageEstudiante] = useState(1);
  const pageSizeEstudiante = 10;

  const [pageAlerta, setPageAlerta] = useState(1);
  const pageSizeAlerta = 5;

  // Reusable search + sort + pagination processor
  const processData = <T,>(
    data: T[],
    query: string,
    searchFields: (keyof T)[],
    sortField: string,
    sortOrder: 'asc' | 'desc',
    page: number,
    pageSize: number
  ) => {
    let result = [...data];

    // Search
    if (query.trim()) {
      const q = query.toLowerCase();
      result = result.filter(item =>
        searchFields.some(field =>
          String(item[field] || '').toLowerCase().includes(q)
        )
      );
    }

    // Sort
    if (sortField) {
      result.sort((a: any, b: any) => {
        let valA = a[sortField];
        let valB = b[sortField];

        if (valA === null || valA === undefined) return 1;
        if (valB === null || valB === undefined) return -1;

        // Custom ordering for risk hierarchy
        if (sortField === 'riesgo') {
          const hierarchy: Record<string, number> = { 'Crítico': 0, 'Alto': 1, 'Medio': 2, 'Bajo': 3, 'Sin riesgo': 4 };
          valA = hierarchy[valA] ?? 5;
          valB = hierarchy[valB] ?? 5;
        } else if (sortField === 'gravedad') {
          const hierarchy: Record<string, number> = { 'Crítica': 0, 'Alta': 1, 'Media': 2, 'Baja': 3, 'Informativa': 4 };
          valA = hierarchy[valA] ?? 5;
          valB = hierarchy[valB] ?? 5;
        }

        if (typeof valA === 'number' && typeof valB === 'number') {
          if (valA !== valB) {
            return sortOrder === 'asc' ? valA - valB : valB - valA;
          }
          // PROBLEM 14: Tiebreaker secondary sort for student losses -> sort by general average ascending
          if (sortField === 'asignaturasPerdidas' && a.promedio !== undefined && b.promedio !== undefined) {
            const avgA = a.promedio ?? 5.0;
            const avgB = b.promedio ?? 5.0;
            return avgA - avgB; // Lowest average first (highest risk)
          }
        }

        const strA = String(valA).toLowerCase();
        const strB = String(valB).toLowerCase();
        if (strA < strB) return sortOrder === 'asc' ? -1 : 1;
        if (strA > strB) return sortOrder === 'asc' ? 1 : -1;
        return 0;
      });
    }

    const total = result.length;
    const paginated = result.slice((page - 1) * pageSize, page * pageSize);
    const totalPages = Math.ceil(total / pageSize) || 1;

    return {
      data: paginated,
      total,
      totalPages,
    };
  };

  // Toggle sort helper
  const handleSort = (field: string, currentField: string, setField: (f: string) => void, currentOrder: 'asc' | 'desc', setOrder: (o: 'asc' | 'desc') => void, setPage: (p: number) => void) => {
    if (field === currentField) {
      setOrder(currentOrder === 'asc' ? 'desc' : 'asc');
    } else {
      setField(field);
      setOrder('asc');
    }
    setPage(1);
  };

  // Process Cursos
  const processedCursos = useMemo(() => {
    return processData(
      cursosResumen,
      searchCurso,
      ['curso', 'nivel', 'asignaturaCritica'],
      sortFieldCurso,
      sortOrderCurso,
      pageCurso,
      pageSizeCurso
    );
  }, [cursosResumen, searchCurso, sortFieldCurso, sortOrderCurso, pageCurso]);

  // Process Asignaturas
  const processedAsignaturas = useMemo(() => {
    return processData(
      asignaturasResumen,
      searchAsignatura,
      ['codigo', 'asignatura', 'area', 'tipo'],
      sortFieldAsignatura,
      sortOrderAsignatura,
      pageAsignatura,
      pageSizeAsignatura
    );
  }, [asignaturasResumen, searchAsignatura, sortFieldAsignatura, sortOrderAsignatura, pageAsignatura]);

  // Process Estudiantes Prioritarios
  const filteredPrioritarios = useMemo(() => {
    if (mostrarTodosPrioritarios) return estudiantesPrioritarios;
    return estudiantesPrioritarios.filter(e => e.riesgo === 'Crítico' || e.riesgo === 'Alto' || e.asignaturasPerdidas > 0);
  }, [estudiantesPrioritarios, mostrarTodosPrioritarios]);

  const processedEstudiantes = useMemo(() => {
    return processData(
      filteredPrioritarios,
      searchEstudiante,
      ['estudiante', 'curso', 'riesgo', 'causaPrincipal'],
      sortFieldEstudiante,
      sortOrderEstudiante,
      pageEstudiante,
      pageSizeEstudiante
    );
  }, [filteredPrioritarios, searchEstudiante, sortFieldEstudiante, sortOrderEstudiante, pageEstudiante]);

  // Process Alertas
  const processedAlertas = useMemo(() => {
    return processData(
      alertasAfectanResumen,
      searchAlerta,
      ['tipo', 'archivo', 'curso', 'descripcion', 'codigoAsignatura', 'nombreAsignatura'],
      sortFieldAlerta,
      sortOrderAlerta,
      pageAlerta,
      pageSizeAlerta
    );
  }, [alertasAfectanResumen, searchAlerta, sortFieldAlerta, sortOrderAlerta, pageAlerta]);

  // Exports
  const exportCursos = () => {
    const headers = ['Nivel', 'Grado', 'Curso', 'Total Estudiantes', 'Promedio General', '% en Bajo', 'Estudiantes con Pérdidas', 'Riesgo Alto', 'Riesgo Crítico', 'Asignatura Crítica', 'Alertas Pendientes'];
    const data = cursosResumen.map(c => ({
      nivel: c.nivel,
      grado: c.grado,
      curso: c.curso,
      estudiantes: c.estudiantes,
      promedio: c.promedio !== null && c.promedio !== undefined ? c.promedio.toFixed(2) : 'N/A',
      pctBajo: c.pctBajo !== null && c.pctBajo !== undefined ? c.pctBajo.toFixed(1) + '%' : '0.0%',
      perdidas: c.estudiantesConPerdidas,
      alto: c.riesgoAlto,
      critico: c.riesgoCritico,
      critica: c.asignaturaCritica,
      alertas: c.alertasPendientes,
    }));
    exportToCSV(data, 'resumen_por_curso', headers);
  };

  const exportAsignaturas = () => {
    const headers = ['Código', 'Asignatura', 'Área', 'Tipo', 'Estudiantes Evaluados', 'Estudiantes Perdidos', '% Pérdida', 'Promedio', 'Curso más Crítico', 'Suma Pérdida', 'Aplica'];
    const data = asignaturasResumen.map(a => ({
      codigo: a.codigo,
      asignatura: a.asignatura,
      area: a.area,
      tipo: a.tipo,
      evaluados: a.estudiantesEvaluados,
      perdidos: a.estudiantesPerdidos,
      pct: a.pctPerdida !== null && a.pctPerdida !== undefined ? a.pctPerdida.toFixed(1) + '%' : '0.0%',
      promedio: a.promedio !== null && a.promedio !== undefined ? a.promedio.toFixed(2) : 'N/A',
      cursoCritico: a.cursoMasCritico,
      suma: a.cuentaParaPerdida,
      aplica: a.aplica,
    }));
    exportToCSV(data, 'resumen_por_asignatura', headers);
  };

  const exportEstudiantes = () => {
    const headers = ['Estudiante', 'Nivel', 'Grado', 'Curso', 'Asignaturas Perdidas', 'Asignaturas en Riesgo', 'Promedio General', 'Riesgo', 'Causa Principal', 'Acción Sugerida'];
    const data = estudiantesPrioritarios.map(e => ({
      estudiante: e.estudiante,
      nivel: e.nivel,
      grado: e.grado,
      curso: e.curso,
      perdidas: e.asignaturasPerdidas,
      riesgoAsig: e.asignaturasEnRiesgo,
      promedio: e.promedio !== null && e.promedio !== undefined ? e.promedio.toFixed(2) : 'N/A',
      riesgo: e.riesgo,
      causa: e.causaPrincipal,
      accion: e.accionSugerida,
    }));
    exportToCSV(data, 'estudiantes_prioritarios', headers);
  };

  const exportAlertas = () => {
    const headers = ['Gravedad', 'Tipo de Alerta', 'Archivo', 'Curso', 'Código Asignatura', 'Nombre Asignatura', 'Descripción', 'Acción Sugerida'];
    const data = alertasAfectanResumen.map(a => ({
      gravedad: a.gravedad,
      tipo: a.tipo,
      archivo: a.archivo,
      curso: a.curso || 'Todos',
      codigo: a.codigoAsignatura || 'N/A',
      nombre: a.nombreAsignatura || 'N/A',
      desc: a.descripcion,
      accion: a.accionSugerida,
    }));
    exportToCSV(data, 'alertas_calidad', headers);
  };

  const getRiesgoStyle = (r: string) => {
    switch (r) {
      case 'Crítico': return 'bg-red-100 text-red-800 font-bold';
      case 'Alto': return 'bg-orange-100 text-orange-800 font-bold';
      case 'Medio': return 'bg-yellow-100 text-yellow-800';
      case 'Bajo': return 'bg-blue-100 text-blue-800';
      case 'Sin riesgo': return 'bg-green-100 text-green-800';
      default: return 'bg-slate-100 text-slate-800';
    }
  };

  return (
    <div id="summary-tables-section" className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden flex flex-col">
      {/* TABS */}
      <div className="flex border-b border-slate-200 bg-slate-50 flex-wrap">
        {[
          { id: 'cursos', label: 'Resumen por Curso', count: cursosResumen.length },
          { id: 'asignaturas', label: 'Resumen por Asignatura', count: asignaturasResumen.length },
          { id: 'estudiantes', label: 'Estudiantes Prioritarios', count: estudiantesPrioritarios.length },
          { id: 'alertas', label: 'Alertas de Calidad', count: alertasAfectanResumen.length, color: 'text-red-600' },
        ].map(tab => (
          <button
            key={tab.id}
            id={`tab-btn-${tab.id}`}
            onClick={() => setActiveTab(tab.id as any)}
            className={`px-5 py-4 text-xs font-bold uppercase tracking-wider border-b-2 transition-all flex items-center gap-2 ${
              activeTab === tab.id
                ? 'border-blue-600 text-blue-700 bg-white shadow-sm'
                : 'border-transparent text-slate-500 hover:text-slate-800 hover:bg-slate-100/50'
            }`}
          >
            <span className={tab.color}>{tab.label}</span>
            <span className="bg-slate-200/80 text-slate-700 text-[10px] px-2 py-0.5 rounded-full font-mono font-bold">
              {tab.count}
            </span>
          </button>
        ))}
      </div>

      {/* ACTIVE PANEL */}
      <div className="p-4 flex-1 flex flex-col min-h-[450px]">
        {/* PANEL: CURSOS */}
        {activeTab === 'cursos' && (
          <div className="flex-1 flex flex-col space-y-4">
            <div className="flex flex-col sm:flex-row gap-3 justify-between items-center">
              <div className="relative w-full sm:w-72">
                <Search className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                <input
                  type="text"
                  placeholder="Buscar curso o nivel..."
                  className="w-full pl-9 pr-4 py-1.5 text-xs border border-slate-200 rounded focus:ring-2 focus:ring-blue-500 outline-none text-slate-700 bg-white"
                  value={searchCurso}
                  onChange={(e) => { setSearchCurso(e.target.value); setPageCurso(1); }}
                />
              </div>
              <button
                id="btn-export-cursos"
                onClick={exportCursos}
                className="w-full sm:w-auto bg-slate-50 hover:bg-slate-100 border border-slate-200 text-slate-600 px-3 py-1.5 rounded text-xs font-bold uppercase tracking-wider flex items-center justify-center gap-2 transition-colors"
              >
                <Download className="w-3.5 h-3.5 text-emerald-600" /> Exportar CSV
              </button>
            </div>

            <div className="overflow-x-auto border border-slate-200 rounded-lg flex-1">
              <table className="w-full text-left text-xs min-w-[900px]">
                <thead className="bg-slate-100 text-slate-500 font-bold uppercase tracking-widest border-b border-slate-200 sticky top-0 z-10 shadow-sm">
                  <tr>
                    {[
                      { field: 'nivel', label: 'Nivel' },
                      { field: 'grado', label: 'Grado' },
                      { field: 'curso', label: 'Curso' },
                      { field: 'estudiantes', label: 'Estudiantes' },
                      { field: 'promedio', label: 'Promedio' },
                      { field: 'pctBajo', label: '% en Bajo' },
                      { field: 'estudiantesConPerdidas', label: 'Con Pérdidas' },
                      { field: 'riesgoAlto', label: 'Riesgo Alto' },
                      { field: 'riesgoCritico', label: 'Riesgo Crítico' },
                      { field: 'asignaturaCritica', label: 'Asignatura Crítica' },
                      { field: 'alertasPendientes', label: 'Alertas' },
                    ].map(h => (
                      <th
                        key={h.field}
                        onClick={() => handleSort(h.field, sortFieldCurso, setSortFieldCurso, sortOrderCurso, setSortOrderCurso, setPageCurso)}
                        className="px-4 py-3 cursor-pointer hover:bg-slate-200 hover:text-slate-800 transition-colors"
                      >
                        <div className="flex items-center gap-1.5">
                          {h.label}
                          <ArrowUpDown className="w-3 h-3 text-slate-400" />
                        </div>
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {processedCursos.data.length === 0 ? (
                    <tr>
                      <td colSpan={11} className="px-4 py-12 text-center text-slate-400 font-mono">
                        NO SE ENCONTRARON CURSOS.
                      </td>
                    </tr>
                  ) : (
                    processedCursos.data.map(c => (
                      <tr key={c.curso} className="hover:bg-slate-50/80 transition-colors">
                        <td className="px-4 py-2.5 font-medium text-slate-600">{c.nivel}</td>
                        <td className="px-4 py-2.5 font-mono">{c.grado}°</td>
                        <td className="px-4 py-2.5 font-bold font-mono text-blue-700">
                          <button
                            onClick={() => onFilterCurso(c.curso)}
                            className="hover:underline font-bold text-left outline-none cursor-pointer text-blue-600"
                          >
                            {c.curso}
                          </button>
                        </td>
                        <td className="px-4 py-2.5 font-mono">{c.estudiantes}</td>
                        <td className="px-4 py-2.5 font-bold font-mono">{c.promedio !== null && c.promedio !== undefined ? c.promedio.toFixed(2) : 'N/A'}</td>
                        <td className="px-4 py-2.5 font-mono font-medium text-amber-600">{c.pctBajo !== null && c.pctBajo !== undefined ? c.pctBajo.toFixed(1) : '0.0'}%</td>
                        <td className="px-4 py-2.5 font-mono text-red-600 font-bold">{c.estudiantesConPerdidas}</td>
                        <td className="px-4 py-2.5 font-mono font-bold text-orange-600">{c.riesgoAlto}</td>
                        <td className="px-4 py-2.5 font-mono font-bold text-red-700">{c.riesgoCritico}</td>
                        <td className="px-4 py-2.5 font-medium truncate max-w-[150px]" title={c.asignaturaCritica}>
                          <button
                            onClick={() => c.asignaturaCritica !== 'Ninguna' && onFilterAsignatura(c.asignaturaCritica)}
                            className="hover:underline text-left text-slate-700 font-medium"
                          >
                            {c.asignaturaCritica}
                          </button>
                        </td>
                        <td className="px-4 py-2.5 font-mono">
                          {c.alertasPendientes > 0 ? (
                            <span className="bg-red-50 text-red-700 px-2 py-0.5 rounded font-bold">{c.alertasPendientes}</span>
                          ) : (
                            <span className="text-slate-400">-</span>
                          )}
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>

            {/* Pagination Controls */}
            <div className="flex items-center justify-between pt-2">
              <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">
                Mostrando {processedCursos.data.length} de {processedCursos.total} cursos
              </span>
              <div className="flex gap-2">
                <button
                  disabled={pageCurso === 1}
                  onClick={() => setPageCurso(p => p - 1)}
                  className="p-1.5 rounded border border-slate-200 bg-white hover:bg-slate-50 disabled:opacity-40 transition-colors"
                >
                  <ChevronLeft className="w-4 h-4" />
                </button>
                <span className="text-xs font-mono font-bold px-3 py-1 bg-slate-100 rounded border border-slate-200 flex items-center">
                  {pageCurso} / {processedCursos.totalPages}
                </span>
                <button
                  disabled={pageCurso === processedCursos.totalPages}
                  onClick={() => setPageCurso(p => p + 1)}
                  className="p-1.5 rounded border border-slate-200 bg-white hover:bg-slate-50 disabled:opacity-40 transition-colors"
                >
                  <ChevronRight className="w-4 h-4" />
                </button>
              </div>
            </div>
          </div>
        )}

        {/* PANEL: ASIGNATURAS */}
        {activeTab === 'asignaturas' && (
          <div className="flex-1 flex flex-col space-y-4">
            <div className="flex flex-col sm:flex-row gap-3 justify-between items-center">
              <div className="relative w-full sm:w-72">
                <Search className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                <input
                  type="text"
                  placeholder="Buscar código, asignatura, área..."
                  className="w-full pl-9 pr-4 py-1.5 text-xs border border-slate-200 rounded focus:ring-2 focus:ring-blue-500 outline-none text-slate-700 bg-white"
                  value={searchAsignatura}
                  onChange={(e) => { setSearchAsignatura(e.target.value); setPageAsignatura(1); }}
                />
              </div>
              <button
                id="btn-export-asignaturas"
                onClick={exportAsignaturas}
                className="w-full sm:w-auto bg-slate-50 hover:bg-slate-100 border border-slate-200 text-slate-600 px-3 py-1.5 rounded text-xs font-bold uppercase tracking-wider flex items-center justify-center gap-2 transition-colors"
              >
                <Download className="w-3.5 h-3.5 text-emerald-600" /> Exportar CSV
              </button>
            </div>

            <div className="overflow-x-auto border border-slate-200 rounded-lg flex-1">
              <table className="w-full text-left text-xs min-w-[900px]">
                <thead className="bg-slate-100 text-slate-500 font-bold uppercase tracking-widest border-b border-slate-200 sticky top-0 z-10 shadow-sm">
                  <tr>
                    {[
                      { field: 'codigo', label: 'Código' },
                      { field: 'asignatura', label: 'Asignatura' },
                      { field: 'area', label: 'Área' },
                      { field: 'tipo', label: 'Tipo' },
                      { field: 'estudiantesEvaluados', label: 'Evaluados' },
                      { field: 'estudiantesPerdidos', label: 'Perdidos' },
                      { field: 'pctPerdida', label: '% Pérdida' },
                      { field: 'promedio', label: 'Promedio' },
                      { field: 'cursoMasCritico', label: 'Curso más Crítico' },
                      { field: 'cuentaParaPerdida', label: 'Suma Pérdida' },
                      { field: 'aplica', label: 'Aplica' },
                    ].map(h => (
                      <th
                        key={h.field}
                        onClick={() => handleSort(h.field, sortFieldAsignatura, setSortFieldAsignatura, sortOrderAsignatura, setSortOrderAsignatura, setPageAsignatura)}
                        className="px-4 py-3 cursor-pointer hover:bg-slate-200 hover:text-slate-800 transition-colors"
                      >
                        <div className="flex items-center gap-1.5">
                          {h.label}
                          <ArrowUpDown className="w-3 h-3 text-slate-400" />
                        </div>
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {processedAsignaturas.data.length === 0 ? (
                    <tr>
                      <td colSpan={11} className="px-4 py-12 text-center text-slate-400 font-mono">
                        NO SE ENCONTRARON ASIGNATURAS.
                      </td>
                    </tr>
                  ) : (
                    processedAsignaturas.data.map(a => (
                      <tr key={a.codigo} className="hover:bg-slate-50/80 transition-colors">
                        <td className="px-4 py-2.5 font-mono font-bold text-slate-500">{a.codigo}</td>
                        <td className="px-4 py-2.5 font-bold text-blue-700">
                          <button
                            onClick={() => onFilterAsignatura(a.asignatura)}
                            className="hover:underline font-bold text-left outline-none cursor-pointer text-blue-600"
                          >
                            {a.asignatura}
                          </button>
                        </td>
                        <td className="px-4 py-2.5 text-slate-600">{a.area}</td>
                        <td className="px-4 py-2.5">
                          <span className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider ${
                            a.tipo === 'Centro de interés' ? 'bg-indigo-50 text-indigo-700' :
                            a.tipo === 'Comportamiento' ? 'bg-teal-50 text-teal-700' : 'bg-slate-100 text-slate-700'
                          }`}>
                            {a.tipo}
                          </span>
                        </td>
                        <td className="px-4 py-2.5 font-mono">{a.estudiantesEvaluados}</td>
                        <td className="px-4 py-2.5 font-mono font-bold text-red-600">{a.estudiantesPerdidos}</td>
                        <td className="px-4 py-2.5 font-mono font-bold text-red-500">{a.pctPerdida !== null && a.pctPerdida !== undefined ? a.pctPerdida.toFixed(1) : '0.0'}%</td>
                        <td className="px-4 py-2.5 font-mono font-bold">{a.promedio !== null && a.promedio !== undefined ? a.promedio.toFixed(2) : 'N/A'}</td>
                        <td className="px-4 py-2.5 font-mono text-red-700 font-bold">{a.cursoMasCritico}</td>
                        <td className="px-4 py-2.5 font-bold">{a.cuentaParaPerdida}</td>
                        <td className="px-4 py-2.5 text-slate-500">{a.aplica}</td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>

            {/* Pagination Controls */}
            <div className="flex items-center justify-between pt-2">
              <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">
                Mostrando {processedAsignaturas.data.length} de {processedAsignaturas.total} asignaturas
              </span>
              <div className="flex gap-2">
                <button
                  disabled={pageAsignatura === 1}
                  onClick={() => setPageAsignatura(p => p - 1)}
                  className="p-1.5 rounded border border-slate-200 bg-white hover:bg-slate-50 disabled:opacity-40 transition-colors"
                >
                  <ChevronLeft className="w-4 h-4" />
                </button>
                <span className="text-xs font-mono font-bold px-3 py-1 bg-slate-100 rounded border border-slate-200 flex items-center">
                  {pageAsignatura} / {processedAsignaturas.totalPages}
                </span>
                <button
                  disabled={pageAsignatura === processedAsignaturas.totalPages}
                  onClick={() => setPageAsignatura(p => p + 1)}
                  className="p-1.5 rounded border border-slate-200 bg-white hover:bg-slate-50 disabled:opacity-40 transition-colors"
                >
                  <ChevronRight className="w-4 h-4" />
                </button>
              </div>
            </div>
          </div>
        )}

        {/* PANEL: ESTUDIANTES */}
        {activeTab === 'estudiantes' && (
          <div className="flex-1 flex flex-col space-y-4">
            <div className="flex flex-col sm:flex-row gap-3 justify-between items-center">
              <div className="flex flex-wrap items-center gap-3 w-full sm:w-auto">
                <div className="relative w-full sm:w-72">
                  <Search className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                  <input
                    type="text"
                    placeholder="Buscar estudiante, curso..."
                    className="w-full pl-9 pr-4 py-1.5 text-xs border border-slate-200 rounded focus:ring-2 focus:ring-blue-500 outline-none text-slate-700 bg-white"
                    value={searchEstudiante}
                    onChange={(e) => { setSearchEstudiante(e.target.value); setPageEstudiante(1); }}
                  />
                </div>

                {/* PROBLEM 14: Show all students toggle */}
                <div className="flex items-center gap-2 text-xs font-bold text-slate-600 bg-slate-50 border border-slate-200 px-3 py-1.5 rounded-lg select-none">
                  <input
                    type="checkbox"
                    id="chk-todos-prioritarios"
                    className="w-4 h-4 text-blue-600 border-slate-300 rounded focus:ring-blue-500 cursor-pointer"
                    checked={mostrarTodosPrioritarios}
                    onChange={(e) => { setMostrarTodosPrioritarios(e.target.checked); setPageEstudiante(1); }}
                  />
                  <label htmlFor="chk-todos-prioritarios" className="cursor-pointer">
                    Mostrar todos los estudiantes
                  </label>
                </div>
              </div>
              <button
                id="btn-export-estudiantes"
                onClick={exportEstudiantes}
                className="w-full sm:w-auto bg-slate-50 hover:bg-slate-100 border border-slate-200 text-slate-600 px-3 py-1.5 rounded text-xs font-bold uppercase tracking-wider flex items-center justify-center gap-2 transition-colors"
              >
                <Download className="w-3.5 h-3.5 text-emerald-600" /> Exportar CSV
              </button>
            </div>

            <div className="overflow-x-auto border border-slate-200 rounded-lg flex-1">
              <table className="w-full text-left text-xs min-w-[1000px]">
                <thead className="bg-slate-100 text-slate-500 font-bold uppercase tracking-widest border-b border-slate-200 sticky top-0 z-10 shadow-sm">
                  <tr>
                    {[
                      { field: 'estudiante', label: 'Estudiante' },
                      { field: 'nivel', label: 'Nivel' },
                      { field: 'grado', label: 'Grado' },
                      { field: 'curso', label: 'Curso' },
                      { field: 'asignaturasPerdidas', label: 'Asig. Perdidas' },
                      { field: 'asignaturasEnRiesgo', label: 'Asig. en Riesgo' },
                      { field: 'promedio', label: 'Promedio Gral' },
                      { field: 'riesgo', label: 'Riesgo' },
                      { field: 'causaPrincipal', label: 'Causa Principal' },
                      { field: 'accionSugerida', label: 'Acción Sugerida' },
                    ].map(h => (
                      <th
                        key={h.field}
                        onClick={() => handleSort(h.field, sortFieldEstudiante, setSortFieldEstudiante, sortOrderEstudiante, setSortOrderEstudiante, setPageEstudiante)}
                        className="px-4 py-3 cursor-pointer hover:bg-slate-200 hover:text-slate-800 transition-colors"
                      >
                        <div className="flex items-center gap-1.5">
                          {h.label}
                          <ArrowUpDown className="w-3 h-3 text-slate-400" />
                        </div>
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {processedEstudiantes.data.length === 0 ? (
                    <tr>
                      <td colSpan={10} className="px-4 py-12 text-center text-slate-400 font-mono">
                        NO SE ENCONTRARON ESTUDIANTES PRIORITARIOS.
                      </td>
                    </tr>
                  ) : (
                    processedEstudiantes.data.map((e, index) => (
                      <tr key={index} className="hover:bg-slate-50/80 transition-colors">
                        <td className="px-4 py-2.5 font-bold text-slate-800">{e.estudiante}</td>
                        <td className="px-4 py-2.5 text-slate-500">{e.nivel}</td>
                        <td className="px-4 py-2.5 font-mono">{e.grado}°</td>
                        <td className="px-4 py-2.5 font-bold font-mono text-blue-600">
                          <button onClick={() => onFilterCurso(e.curso)} className="hover:underline">{e.curso}</button>
                        </td>
                        <td className="px-4 py-2.5 font-mono font-bold text-red-600">{e.asignaturasPerdidas}</td>
                        <td className="px-4 py-2.5 font-mono text-orange-600">{e.asignaturasEnRiesgo}</td>
                        <td className="px-4 py-2.5 font-mono font-bold">{e.promedio !== null && e.promedio !== undefined ? e.promedio.toFixed(2) : 'N/A'}</td>
                        <td className="px-4 py-2.5">
                          <span
                            onClick={() => onFilterRiesgo(e.riesgo)}
                            className={`px-2.5 py-1 rounded-full text-[10px] uppercase cursor-pointer ${getRiesgoStyle(e.riesgo)}`}
                          >
                            {e.riesgo}
                          </span>
                        </td>
                        <td className="px-4 py-2.5 text-slate-600 font-medium max-w-[180px] truncate" title={e.causaPrincipal}>
                          {e.causaPrincipal}
                        </td>
                        <td className="px-4 py-2.5 text-slate-500 max-w-[180px] truncate" title={e.accionSugerida}>
                          {e.accionSugerida}
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>

            {/* Pagination Controls */}
            <div className="flex items-center justify-between pt-2">
              <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">
                Mostrando {processedEstudiantes.data.length} de {processedEstudiantes.total} estudiantes
              </span>
              <div className="flex gap-2">
                <button
                  disabled={pageEstudiante === 1}
                  onClick={() => setPageEstudiante(p => p - 1)}
                  className="p-1.5 rounded border border-slate-200 bg-white hover:bg-slate-50 disabled:opacity-40 transition-colors"
                >
                  <ChevronLeft className="w-4 h-4" />
                </button>
                <span className="text-xs font-mono font-bold px-3 py-1 bg-slate-100 rounded border border-slate-200 flex items-center">
                  {pageEstudiante} / {processedEstudiantes.totalPages}
                </span>
                <button
                  disabled={pageEstudiante === processedEstudiantes.totalPages}
                  onClick={() => setPageEstudiante(p => p + 1)}
                  className="p-1.5 rounded border border-slate-200 bg-white hover:bg-slate-50 disabled:opacity-40 transition-colors"
                >
                  <ChevronRight className="w-4 h-4" />
                </button>
              </div>
            </div>
          </div>
        )}

        {/* PANEL: ALERTAS */}
        {activeTab === 'alertas' && (
          <div className="flex-1 flex flex-col space-y-4">
            <div className="flex flex-col sm:flex-row gap-3 justify-between items-center">
              <div className="relative w-full sm:w-72">
                <Search className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                <input
                  type="text"
                  placeholder="Buscar alerta, descripción..."
                  className="w-full pl-9 pr-4 py-1.5 text-xs border border-slate-200 rounded focus:ring-2 focus:ring-blue-500 outline-none text-slate-700 bg-white"
                  value={searchAlerta}
                  onChange={(e) => { setSearchAlerta(e.target.value); setPageAlerta(1); }}
                />
              </div>
              <button
                id="btn-export-alertas"
                onClick={exportAlertas}
                className="w-full sm:w-auto bg-slate-50 hover:bg-slate-100 border border-slate-200 text-slate-600 px-3 py-1.5 rounded text-xs font-bold uppercase tracking-wider flex items-center justify-center gap-2 transition-colors"
              >
                <Download className="w-3.5 h-3.5 text-emerald-600" /> Exportar CSV
              </button>
            </div>

            <div className="overflow-x-auto border border-slate-200 rounded-lg flex-1">
              <table className="w-full text-left text-xs min-w-[900px]">
                <thead className="bg-slate-100 text-slate-500 font-bold uppercase tracking-widest border-b border-slate-200 sticky top-0 z-10 shadow-sm">
                  <tr>
                    {[
                      { field: 'gravedad', label: 'Gravedad' },
                      { field: 'tipo', label: 'Tipo de Alerta' },
                      { field: 'archivo', label: 'Archivo' },
                      { field: 'curso', label: 'Curso' },
                      { field: 'codigoAsignatura', label: 'Código' },
                      { field: 'nombreAsignatura', label: 'Asignatura' },
                      { field: 'descripcion', label: 'Descripción' },
                      { field: 'accionSugerida', label: 'Acción Sugerida' },
                    ].map(h => (
                      <th
                        key={h.field}
                        onClick={() => handleSort(h.field, sortFieldAlerta, setSortFieldAlerta, sortOrderAlerta, setSortOrderAlerta, setPageAlerta)}
                        className="px-4 py-3 cursor-pointer hover:bg-slate-200 hover:text-slate-800 transition-colors"
                      >
                        <div className="flex items-center gap-1.5">
                          {h.label}
                          <ArrowUpDown className="w-3 h-3 text-slate-400" />
                        </div>
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {processedAlertas.data.length === 0 ? (
                    <tr>
                      <td colSpan={8} className="px-4 py-12 text-center text-slate-400 font-mono">
                        NO SE ENCONTRARON ALERTAS PENDIENTES QUE AFECTEN ESTA SELECCIÓN.
                      </td>
                    </tr>
                  ) : (
                    processedAlertas.data.map(a => (
                      <tr key={a.id} className="hover:bg-slate-50/80 transition-colors">
                        <td className="px-4 py-2.5">
                          <span className={`px-2 py-0.5 rounded text-[9px] font-bold uppercase border ${
                            a.gravedad === 'Crítica' ? 'bg-red-50 text-red-800 border-red-200' :
                            a.gravedad === 'Alta' ? 'bg-orange-50 text-orange-800 border-orange-200' :
                            'bg-yellow-50 text-yellow-800 border-yellow-200'
                          }`}>
                            {a.gravedad}
                          </span>
                        </td>
                        <td className="px-4 py-2.5 font-bold text-slate-700">{a.tipo}</td>
                        <td className="px-4 py-2.5 text-slate-400 truncate max-w-[120px]" title={a.archivo}>{a.archivo}</td>
                        <td className="px-4 py-2.5 font-mono font-bold text-blue-700">
                          {a.curso ? (
                            <button onClick={() => onFilterCurso(a.curso)} className="hover:underline">{a.curso}</button>
                          ) : (
                            <span className="text-slate-400">Todos</span>
                          )}
                        </td>
                        <td className="px-4 py-2.5 font-mono text-slate-500">{a.codigoAsignatura || 'N/A'}</td>
                        <td className="px-4 py-2.5 font-bold text-slate-600 truncate max-w-[120px]" title={a.nombreAsignatura}>{a.nombreAsignatura || 'N/A'}</td>
                        <td className="px-4 py-2.5 text-slate-500 max-w-xs break-words">{a.descripcion}</td>
                        <td className="px-4 py-2.5 font-bold text-slate-400 uppercase tracking-wide text-[10px]">{a.accionSugerida}</td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>

            {/* Pagination Controls */}
            <div className="flex items-center justify-between pt-2">
              <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">
                Mostrando {processedAlertas.data.length} de {processedAlertas.total} alertas
              </span>
              <div className="flex gap-2">
                <button
                  disabled={pageAlerta === 1}
                  onClick={() => setPageAlerta(p => p - 1)}
                  className="p-1.5 rounded border border-slate-200 bg-white hover:bg-slate-50 disabled:opacity-40 transition-colors"
                >
                  <ChevronLeft className="w-4 h-4" />
                </button>
                <span className="text-xs font-mono font-bold px-3 py-1 bg-slate-100 rounded border border-slate-200 flex items-center">
                  {pageAlerta} / {processedAlertas.totalPages}
                </span>
                <button
                  disabled={pageAlerta === processedAlertas.totalPages}
                  onClick={() => setPageAlerta(p => p + 1)}
                  className="p-1.5 rounded border border-slate-200 bg-white hover:bg-slate-50 disabled:opacity-40 transition-colors"
                >
                  <ChevronRight className="w-4 h-4" />
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
