import React, { useMemo, useState, useCallback } from 'react';
import { useStore } from '../store';
import {
  calcularRiesgoEstudiante,
  agruparPorEstudiante,
  obtenerAsignaturasValidasParaPerdida,
  obtenerNotaAnalisis,
  crearClaveEstudiante,
  clasificarEstadoAsignatura,
  formatearNota,
  EstadoAsignatura,
  calcularAsignaturasPrioritarias,
  obtenerColumnasNotaTabla,
} from '../utils/calculations';
import { User, AlertCircle, X } from 'lucide-react';
import { StudentSearchBar } from '../components/StudentSearchBar';
import { StudentKpiCards } from '../components/StudentKpiCards';
import { StudentSubjectTable, AsignaturaFila } from '../components/StudentSubjectTable';
import { StudentCharts } from '../components/StudentCharts';

type PeriodoAnalisis = 'P1' | 'P2' | 'P3' | 'P4' | 'DEF';
type FiltroEstado = 'Todos' | 'Aprobada' | 'Perdida' | 'En riesgo';

const generarObservacion = (
  estado: EstadoAsignatura,
  estadoDef: EstadoAsignatura | null,
  notaEvaluada: number,
  def: number | null,
  periodoActivo: string,
  notaNecesaria: number | null,
): string => {
  const parts: string[] = [];

  if (estado === 'Perdida') {
    if (notaNecesaria === 999) parts.push('Requiere plan de recuperación; meta inalcanzable con nota máxima.');
    else if (notaNecesaria !== null) parts.push(`Requiere refuerzo urgente; necesita ${formatearNota(notaNecesaria)} en períodos restantes.`);
    else parts.push('Requiere refuerzo urgente y seguimiento docente.');
  } else if (estado === 'En riesgo') {
    parts.push(`Nota de ${periodoActivo} (${formatearNota(notaEvaluada)}) en margen de aprobación [6.0–6.5).`);
  } else if (estado === 'Aprobada') {
    parts.push('Desempeño adecuado en el período activo.');
  } else {
    parts.push('Sin datos suficientes para evaluar.');
  }

  if (periodoActivo !== 'DEF' && estadoDef && def !== null && estadoDef !== estado) {
    parts.push(`Promedio DEF (${formatearNota(def)}): ${estadoDef.toLowerCase()}.`);
  }

  return parts.join(' ');
};

export const StudentDashboard: React.FC = () => {
  const { calificaciones, configuracion, periodoActivo } = useStore();
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedStudentId, setSelectedStudentId] = useState<string | null>(null);
  const [selectedAsignatura, setSelectedAsignatura] = useState<string | null>(null);
  const [filtroEstado, setFiltroEstado] = useState<FiltroEstado>('Todos');

  const periodoAnalisis = periodoActivo as PeriodoAnalisis;

  const columnasPeriodo = useMemo(
    () => obtenerColumnasNotaTabla(calificaciones, configuracion),
    [calificaciones, configuracion]
  );

  const estudiantesUnicos = useMemo(() => agruparPorEstudiante(calificaciones), [calificaciones]);

  const toggleAsignatura = useCallback((codigo: string) => {
    setSelectedAsignatura(prev => (prev === codigo ? null : codigo));
  }, []);

  const toggleFiltroEstado = useCallback((estado: FiltroEstado) => {
    setFiltroEstado(prev => (prev === estado ? 'Todos' : estado));
    setSelectedAsignatura(null);
  }, []);

  const handleSelectStudent = useCallback((key: string, nombre: string) => {
    setSelectedStudentId(key);
    setSearchTerm(nombre);
    setSelectedAsignatura(null);
    setFiltroEstado('Todos');
  }, []);

  const handleClearSelection = useCallback(() => {
    setSelectedStudentId(null);
    setSelectedAsignatura(null);
    setFiltroEstado('Todos');
  }, []);

  const analisis = useMemo(() => {
    if (!selectedStudentId) return null;

    const cals = estudiantesUnicos.find(c => crearClaveEstudiante(c[0]) === selectedStudentId);
    if (!cals) return null;

    const info = cals[0];
    const riesgoResult = calcularRiesgoEstudiante(cals, periodoAnalisis, configuracion);
    const validGrades = obtenerAsignaturasValidasParaPerdida(cals, periodoAnalisis, configuracion);

    const filas: AsignaturaFila[] = validGrades.map(g => {
      const matchGrades = cals.filter(c => c.codigoAsignatura === g.codigoAsignatura);
      const notaEvaluada = obtenerNotaAnalisis(matchGrades, periodoAnalisis, configuracion);
      const def = obtenerNotaAnalisis(matchGrades, 'DEF', configuracion);
      const nota = notaEvaluada ?? g.nota;
      const estado = clasificarEstadoAsignatura(nota, configuracion);
      const estadoDef = periodoAnalisis !== 'DEF' ? clasificarEstadoAsignatura(def, configuracion) : null;

      let notaNecesaria: number | null = null;
      let pCursados = 0;
      let suma = 0;
      (['P1', 'P2', 'P3', 'P4'] as const).forEach(p => {
        const pNota = obtenerNotaAnalisis(matchGrades, p, configuracion);
        if (pNota !== null && !isNaN(pNota)) {
          suma += pNota;
          pCursados++;
        }
      });

      if (pCursados > 0 && pCursados < configuracion.periodos) {
        const pPendientes = configuracion.periodos - pCursados;
        const necesaria = ((configuracion.notaAprobacion * configuracion.periodos) - suma) / pPendientes;
        notaNecesaria = Math.max(configuracion.notaMinima, parseFloat(necesaria.toFixed(2)));
        if (necesaria > configuracion.notaMaxima) notaNecesaria = 999;
      }

      const getPeriodoNota = (p: PeriodoAnalisis) => obtenerNotaAnalisis(matchGrades, p, configuracion);

      return {
        codigoAsignatura: g.codigoAsignatura,
        nombreAsignatura: g.nombreAsignatura,
        tipoAsignatura: g.tipoAsignatura,
        p1: getPeriodoNota('P1'),
        p2: getPeriodoNota('P2'),
        p3: getPeriodoNota('P3'),
        p4: getPeriodoNota('P4'),
        def,
        notaEvaluada: nota,
        nota,
        estado,
        estadoDef,
        notaNecesaria,
        observacion: generarObservacion(estado, estadoDef, nota, def, periodoAnalisis, notaNecesaria),
      };
    });

    const aprobadas = filas.filter(f => f.estado === 'Aprobada').length;
    const enRiesgo = filas.filter(f => f.estado === 'En riesgo').length;

    const validNotasNecesarias = filas
      .filter(f => f.notaNecesaria !== null && f.notaNecesaria !== 999)
      .map(f => ({ nota: f.notaNecesaria as number, nombre: f.nombreAsignatura }));
    const maxEntry = validNotasNecesarias.length > 0
      ? validNotasNecesarias.reduce((a, b) => (a.nota >= b.nota ? a : b))
      : null;
    const requiereRecuperacion = filas.some(f => f.notaNecesaria === 999);

    const periodosTrend: PeriodoAnalisis[] = ['P1', 'P2', 'P3', 'P4', 'DEF'];
    const trendData = periodosTrend
      .map(p => {
        const { promedioGeneral } = calcularRiesgoEstudiante(cals, p, configuracion);
        return { periodo: p, promedio: promedioGeneral };
      })
      .filter(p => p.promedio !== null);

    const asignaturasPrioritarias = calcularAsignaturasPrioritarias(filas, 4);

    return {
      info,
      riesgoResult,
      filas,
      aprobadas,
      enRiesgo,
      notaNecesariaMasAlta: maxEntry?.nota ?? null,
      asignaturaNotaMasAlta: maxEntry?.nombre ?? null,
      requiereRecuperacion,
      trendData,
      asignaturasPrioritarias,
    };
  }, [selectedStudentId, estudiantesUnicos, periodoAnalisis, configuracion]);

  const filasFiltradas = useMemo(() => {
    if (!analisis) return [];
    let rows = analisis.filas;
    if (filtroEstado !== 'Todos') rows = rows.filter(r => r.estado === filtroEstado);
    return rows;
  }, [analisis, filtroEstado]);

  const chartData = useMemo(() => {
    return filasFiltradas
      .filter(f => f.nota !== null && !isNaN(f.nota))
      .map(f => ({
        codigo: f.codigoAsignatura,
        asignatura: f.nombreAsignatura.length > 14 ? f.nombreAsignatura.slice(0, 14) + '…' : f.nombreAsignatura,
        nota: f.nota,
        estado: f.estado as 'Perdida' | 'Aprobada' | 'En riesgo',
      }));
  }, [filasFiltradas]);

  const tieneFiltrosActivos = filtroEstado !== 'Todos' || selectedAsignatura !== null;

  return (
    <div className="space-y-5 max-w-7xl mx-auto" id="student-dashboard-root">

      <StudentSearchBar
        searchTerm={searchTerm}
        onSearchChange={setSearchTerm}
        selectedStudentId={selectedStudentId}
        estudiantesUnicos={estudiantesUnicos}
        onSelectStudent={handleSelectStudent}
        onClearSelection={handleClearSelection}
      />

      {!analisis && (
        <div className="text-center py-16 text-slate-500 text-sm border-2 border-dashed border-slate-200 rounded-xl bg-slate-50">
          <User className="w-10 h-10 mx-auto mb-3 text-slate-300" />
          <p className="font-bold text-slate-600">Selecciona un estudiante</p>
          <p className="text-xs mt-1 text-slate-400 max-w-md mx-auto">
            Escribe parte del nombre — no hace falta ser exacto. Ej: &quot;Padilla Dana&quot; encuentra &quot;Padilla Beleño Danna Marc&quot;.
          </p>
        </div>
      )}

      {analisis && (
        <>
          {/* Perfil + KPIs — layout mockup */}
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-4">
            <div className="lg:col-span-4 bg-white p-5 rounded-xl shadow-sm border border-slate-200">
              <div className="flex items-start gap-4">
                <div className="w-14 h-14 bg-blue-50 text-blue-700 rounded-xl flex items-center justify-center border border-blue-100 shrink-0">
                  <User className="w-7 h-7" />
                </div>
                <div className="min-w-0">
                  <h2 className="text-lg font-bold text-slate-900 leading-tight">{analisis.info.estudianteNombre}</h2>
                  <p className="text-[10px] uppercase tracking-widest text-slate-500 font-bold mt-1">
                    {analisis.info.estudianteNumero ? `#${analisis.info.estudianteNumero} · ` : ''}
                    {analisis.info.grado}° · Curso {analisis.info.curso}
                  </p>
                  <p className="text-[10px] uppercase tracking-widest text-blue-600 font-bold mt-0.5">{analisis.info.nivel}</p>
                  <p className="text-[10px] text-slate-400 font-bold mt-2 uppercase">
                    Período activo: <span className="text-blue-700">{periodoAnalisis}</span>
                    <span className="text-slate-300 ml-1">(cambia en la barra superior)</span>
                  </p>
                </div>
              </div>
            </div>

            <div className="lg:col-span-8">
              <StudentKpiCards
                totalAsignaturas={analisis.filas.length}
                aprobadas={analisis.aprobadas}
                numPerdidas={analisis.riesgoResult.numPerdidas}
                enRiesgo={analisis.enRiesgo}
                notaNecesariaMasAlta={analisis.notaNecesariaMasAlta}
                asignaturaNotaMasAlta={analisis.asignaturaNotaMasAlta}
                requiereRecuperacion={analisis.requiereRecuperacion}
                promedioGeneral={analisis.riesgoResult.promedioGeneral}
                riesgo={analisis.riesgoResult.riesgo}
                configuracion={configuracion}
                filtroEstado={filtroEstado}
                onToggleFiltroEstado={toggleFiltroEstado}
              />
            </div>
          </div>

          {/* Barra filtros cruzados */}
          {tieneFiltrosActivos && (
            <div className="flex flex-wrap items-center gap-2 px-3 py-2 bg-blue-50 border border-blue-200 rounded-lg">
              <span className="text-[10px] font-bold text-blue-800 uppercase tracking-wider">Filtros activos:</span>
              {filtroEstado !== 'Todos' && (
                <button type="button" onClick={() => setFiltroEstado('Todos')} className="inline-flex items-center gap-1 px-2 py-0.5 bg-white border border-blue-300 rounded text-[10px] font-bold text-blue-700">
                  Estado: {filtroEstado} <X className="w-3 h-3" />
                </button>
              )}
              {selectedAsignatura && (
                <button type="button" onClick={() => setSelectedAsignatura(null)} className="inline-flex items-center gap-1 px-2 py-0.5 bg-white border border-indigo-300 rounded text-[10px] font-bold text-indigo-700">
                  Asignatura seleccionada <X className="w-3 h-3" />
                </button>
              )}
              <button
                type="button"
                onClick={() => { setFiltroEstado('Todos'); setSelectedAsignatura(null); }}
                className="ml-auto text-[10px] font-bold text-blue-600 hover:underline uppercase"
              >
                Limpiar todos
              </button>
            </div>
          )}

          {/* Tabla principal (mockup: antes de gráficos) */}
          <StudentSubjectTable
            filas={filasFiltradas}
            periodoActivo={periodoAnalisis}
            selectedCodigo={selectedAsignatura}
            onToggleAsignatura={toggleAsignatura}
            configuracion={configuracion}
            columnasPeriodo={columnasPeriodo}
          />

          {/* Gráficos + recomendación */}
          <StudentCharts
            chartData={chartData}
            trendData={analisis.trendData}
            periodoActivo={periodoAnalisis}
            selectedCodigo={selectedAsignatura}
            configuracion={configuracion}
            riesgo={analisis.riesgoResult.riesgo}
            causaPrincipal={analisis.riesgoResult.causaPrincipal}
            accionSugerida={analisis.riesgoResult.accionSugerida}
            asignaturasPrioritarias={analisis.asignaturasPrioritarias}
            notaNecesariaMasAlta={analisis.notaNecesariaMasAlta}
            requiereRecuperacion={analisis.requiereRecuperacion}
            onToggleAsignatura={toggleAsignatura}
          />

          {/* Análisis automático */}
          <div className="bg-slate-800 border border-slate-700 p-5 rounded-xl flex gap-4 items-start shadow-inner">
            <div className="p-2 bg-slate-700 text-slate-300 rounded shrink-0">
              <AlertCircle className="w-4 h-4" />
            </div>
            <div>
              <h4 className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-2">Análisis automático generado</h4>
              <p className="text-sm text-slate-300 leading-relaxed">
                El estudiante <strong className="text-white">{analisis.info.estudianteNombre}</strong> del curso{' '}
                <strong className="text-white">{analisis.info.curso}</strong> presenta un promedio general de{' '}
                <strong className="text-white">{analisis.riesgoResult.promedioGeneral?.toFixed(2) ?? 'N/A'}</strong> en{' '}
                <strong className="text-white">{periodoAnalisis}</strong>. Con{' '}
                <strong className={analisis.riesgoResult.numPerdidas > 0 ? 'text-red-400' : 'text-green-400'}>
                  {analisis.riesgoResult.numPerdidas} asignaturas perdidas
                </strong>{' '}
                y <strong className="text-amber-400">{analisis.enRiesgo} en riesgo</strong>, su nivel se clasifica como{' '}
                <strong className="text-white uppercase">{analisis.riesgoResult.riesgo}</strong>.
                {' '}{analisis.riesgoResult.causaPrincipal}
                {' '}{analisis.riesgoResult.accionSugerida}
              </p>
            </div>
          </div>
        </>
      )}
    </div>
  );
};
