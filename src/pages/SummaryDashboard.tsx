import React, { useMemo, useState } from 'react';
import { useStore } from '../store';
import { AlertaCalidad } from '../types';
import { 
  esNotaValida, 
  calcularPromedio, 
  clasificarDesempeno, 
  isPerdida, 
  agruparPorEstudiante, 
  calcularRiesgoEstudiante,
  obtenerAsignaturasValidasParaPerdida,
  calcularDatasetAcademico,
  normalizarTipoAsignatura,
  validarContraReferencia,
  obtenerPeriodosVisibles,
} from '../utils/calculations';
import { SummaryCharts } from '../components/SummaryCharts';
import { SummaryKpiCards } from '../components/SummaryKpiCards';
import { SummaryTables } from '../components/SummaryTables';
import { 
  AlertCircle, RefreshCw, Layers, 
  HelpCircle, Download, X
} from 'lucide-react';

export const SummaryDashboard: React.FC = () => {
  const { calificaciones, configuracion, periodoActivo, alertas } = useStore();

  // FILTER STATES
  const [filtroNivel, setFiltroNivel] = useState<string>('Todos');
  const [filtroGrado, setFiltroGrado] = useState<string>('Todos');
  const [filtroCurso, setFiltroCurso] = useState<string>('Todos');
  const [filtroPeriodo, setFiltroPeriodo] = useState<string>(periodoActivo || 'DEF');
  const [filtroArea, setFiltroArea] = useState<string>('Todas');
  const [filtroAsignatura, setFiltroAsignatura] = useState<string>('Todas');
  const [filtroTipo, setFiltroTipo] = useState<string>('Académicas'); // Default to Académicas
  const [filtroRiesgo, setFiltroRiesgo] = useState<string>('Todos');
  const [filtroDesempeno, setFiltroDesempeno] = useState<string>('Todos');

  // SPECIAL CLICK KPI TOGGLES (Problem 5)
  const [soloConPerdidas, setSoloConPerdidas] = useState<boolean>(false);
  const [soloPromedioEnBajo, setSoloPromedioEnBajo] = useState<boolean>(false);

  // AUDIT PANEL STATE (Problem 16)
  const [verCalculoKPI, setVerCalculoKPI] = useState<string | null>(null);

  // RESET FILTERS
  const handleLimpiarFiltros = () => {
    setFiltroNivel('Todos');
    setFiltroGrado('Todos');
    setFiltroCurso('Todos');
    setFiltroPeriodo(periodoActivo || 'DEF');
    setFiltroArea('Todas');
    setFiltroAsignatura('Todas');
    setFiltroTipo('Académicas');
    setFiltroRiesgo('Todos');
    setFiltroDesempeno('Todos');
    setSoloConPerdidas(false);
    setSoloPromedioEnBajo(false);
  };

  const filtrosEstructurales = useMemo(() => ({
    nivel: filtroNivel === 'Todos' ? undefined : filtroNivel,
    grado: filtroGrado === 'Todos' ? undefined : parseInt(filtroGrado, 10),
    curso: filtroCurso === 'Todos' ? undefined : filtroCurso,
    area: filtroArea === 'Todas' ? undefined : filtroArea,
    asignatura: filtroAsignatura === 'Todas' ? undefined : filtroAsignatura,
    tipoAsignatura: filtroTipo === 'Todas' ? undefined : filtroTipo,
  }), [filtroNivel, filtroGrado, filtroCurso, filtroArea, filtroAsignatura, filtroTipo]);

  const toggleFiltroRiesgo = (riesgo: string) => {
    setFiltroRiesgo(prev => (prev === riesgo ? 'Todos' : riesgo));
  };

  const toggleFiltroAsignatura = (nombre: string, tipo: 'Académicas' | 'Centros de interés' = 'Académicas') => {
    setFiltroAsignatura(prev => {
      if (prev === nombre) {
        return 'Todas';
      }
      setFiltroTipo(tipo);
      return nombre;
    });
  };

  const toggleFiltroCurso = (item: { cursoKey?: string; label: string }) => {
    if (item.cursoKey) {
      const parts = item.cursoKey.split('-');
      if (parts.length >= 4) {
        const [, nivel, grado, curso] = parts;
        const isActive = filtroCurso === curso && filtroNivel === nivel && filtroGrado === String(grado);
        if (isActive) {
          setFiltroCurso('Todos');
          setFiltroNivel('Todos');
          setFiltroGrado('Todos');
        } else {
          setFiltroNivel(nivel);
          setFiltroGrado(String(grado));
          setFiltroCurso(curso);
        }
        return;
      }
    }
    const match = item.label.match(/^([^\s(]+)/);
    const cursoCode = match?.[1] || item.label;
    setFiltroCurso(prev => (prev === cursoCode ? 'Todos' : cursoCode));
  };

  const applyCursoFromTable = (cursoLabel: string) => {
    const match = cursoLabel.match(/^([^\s(]+)/);
    const cursoCode = match?.[1] || cursoLabel;
    const nivelMatch = cursoLabel.match(/\((\w+)/);
    const gradoMatch = cursoLabel.match(/(\d+)°/);
    if (nivelMatch) setFiltroNivel(nivelMatch[1]);
    if (gradoMatch) setFiltroGrado(gradoMatch[1]);
    setFiltroCurso(prev => (prev === cursoCode ? 'Todos' : cursoCode));
  };

  const toggleFiltroDesempeno = (nivel: string) => {
    setFiltroDesempeno(prev => (prev === nivel ? 'Todos' : nivel));
  };

  // EXTRACT DYNAMIC FILTER LISTS (from unfiltered database)
  const nivelesOptions = ['Todos', 'Primaria', 'Bachillerato'];

  const gradosOptions = useMemo(() => {
    const uniq = Array.from(new Set(calificaciones.map(c => c.grado)))
      .filter(g => g !== null && g !== undefined)
      .sort((a, b) => a - b);
    return ['Todos', ...uniq.map(String)];
  }, [calificaciones]);

  const cursosOptions = useMemo(() => {
    const uniq = Array.from(new Set(calificaciones.map(c => c.curso)))
      .filter(Boolean)
      .sort();
    return ['Todos', ...uniq];
  }, [calificaciones]);

  const periodosOptions = useMemo(
    () => obtenerPeriodosVisibles(calificaciones, configuracion),
    [calificaciones, configuracion]
  );

  const areasOptions = useMemo(() => {
    const fromCalifs = calificaciones.map(c => {
      const dict = configuracion.diccionarioAreas.find(d => d.codigoBase === c.codigoAsignatura);
      return dict?.area || c.area || '';
    }).filter(Boolean);
    const uniq = Array.from(new Set(fromCalifs)).sort();
    return ['Todas', ...uniq];
  }, [calificaciones, configuracion]);

  const asignaturasOptions = useMemo(() => {
    const uniq = Array.from(new Set(calificaciones.map(c => c.nombreAsignatura)))
      .filter(Boolean)
      .sort();
    return ['Todas', ...uniq];
  }, [calificaciones]);

  const tiposOptions = ['Todas', 'Académicas', 'Centros de interés', 'Comportamiento', 'No académicas'];
  const riesgosOptions = ['Todos', 'Alto/Crítico', 'Sin riesgo', 'Bajo', 'Medio', 'Alto', 'Crítico'];

  const getStudentValidGradesForPeriod = (studentName: string, studentNumber: string | number, period: any, allGrades?: any[]) => {
    const rawStudentCals = allGrades || calificaciones.filter(c => c.estudianteNombre === studentName && c.estudianteNumero === studentNumber);
    return obtenerAsignaturasValidasParaPerdida(rawStudentCals, period, configuracion);
  };

  // 1. Unfiltered/Filtered dataset by structural filters via central engine
  const dataset = useMemo(() => {
    const filtrosResumen = {
      area: filtroArea === "Todas" ? undefined : filtroArea,
      asignatura: filtroAsignatura === "Todas" ? undefined : filtroAsignatura,
      tipoAsignatura: filtroTipo === "Todas" ? undefined : filtroTipo,
      riesgo: filtroRiesgo === "Todos" ? undefined : filtroRiesgo,
      soloConPerdidas,
      soloPromedioEnBajo,
      nivel: filtroNivel === 'Todos' ? undefined : filtroNivel,
      grado: filtroGrado === 'Todos' ? undefined : parseInt(filtroGrado, 10),
      curso: filtroCurso === 'Todos' ? undefined : filtroCurso
    };
    return calcularDatasetAcademico(
      calificaciones,
      configuracion,
      filtroPeriodo as any,
      filtrosResumen
    );
  }, [calificaciones, configuracion, filtroPeriodo, filtroNivel, filtroGrado, filtroCurso, filtroArea, filtroAsignatura, filtroTipo, filtroRiesgo, soloConPerdidas, soloPromedioEnBajo]);

  // COMPUTE KPIs — cross-filter desempeño (Power BI) sobre dataset del motor
  const estudiantesBase = dataset.estudiantesCalculados;
  const filteredStudents = useMemo(() => {
    if (filtroDesempeno === 'Todos') return estudiantesBase;
    return estudiantesBase.filter(s => {
      const level = clasificarDesempeno(s.promedioGeneral, configuracion);
      return level?.nombre === filtroDesempeno;
    });
  }, [estudiantesBase, filtroDesempeno, configuracion]);

  const activeCursoKey = useMemo(() => {
    if (filtroCurso === 'Todos') return '';
    const match = estudiantesBase.find(s =>
      s.curso === filtroCurso &&
      (filtroNivel === 'Todos' || s.nivel === filtroNivel) &&
      (filtroGrado === 'Todos' || String(s.grado) === filtroGrado)
    );
    return match ? `${match.anio}-${match.nivel}-${match.grado}-${match.curso}` : '';
  }, [estudiantesBase, filtroCurso, filtroNivel, filtroGrado]);

  const totalEstudiantes = filteredStudents.length;

  const countPromedioEnBajo = useMemo(() => {
    return filteredStudents.filter(s => {
      const level = clasificarDesempeno(s.promedioGeneral, configuracion);
      return level?.nombre === 'Bajo';
    }).length;
  }, [filteredStudents, configuracion]);

  const periodoComparacion = useMemo(() => {
    if (filtroPeriodo === 'P2') return 'P1';
    if (filtroPeriodo === 'DEF') return 'P2';
    if (filtroPeriodo === 'P3') return 'P2';
    if (filtroPeriodo === 'P4') return 'P3';
    return null;
  }, [filtroPeriodo]);

  const datasetPeriodoAnterior = useMemo(() => {
    if (!periodoComparacion) return null;
    return calcularDatasetAcademico(
      calificaciones,
      configuracion,
      periodoComparacion as 'P1' | 'P2' | 'P3' | 'P4' | 'DEF',
      { ...filtrosEstructurales, tipoAsignatura: filtrosEstructurales.tipoAsignatura }
    );
  }, [calificaciones, configuracion, periodoComparacion, filtrosEstructurales]);

  const kpiDeltas = useMemo(() => {
    if (!datasetPeriodoAnterior || !periodoComparacion) return null;

    const calcMetrics = (students: typeof filteredStudents) => {
      let countBajo = 0;
      const avgs: number[] = [];
      let perdidas = 0;
      let riesgo = 0;
      students.forEach(s => {
        if (s.promedioGeneral !== null && s.promedioGeneral !== undefined) {
          avgs.push(s.promedioGeneral);
          if (clasificarDesempeno(s.promedioGeneral, configuracion)?.nombre === 'Bajo') countBajo++;
        }
        if (s.numPerdidas > 0) perdidas++;
        if (s.riesgo === 'Alto' || s.riesgo === 'Crítico') riesgo++;
      });
      return {
        total: students.length,
        promedio: avgs.length > 0 ? avgs.reduce((a, b) => a + b, 0) / avgs.length : null,
        pctBajo: avgs.length > 0 ? (countBajo / avgs.length) * 100 : 0,
        perdidas,
        riesgo,
      };
    };

    const curr = calcMetrics(filteredStudents);
    const prev = calcMetrics(datasetPeriodoAnterior.estudiantesCalculados);

    return {
      estudiantes: { valor: curr.total - prev.total, etiqueta: 'estudiantes', positivoEsBueno: true },
      promedio: {
        valor: curr.promedio !== null && prev.promedio !== null ? curr.promedio - prev.promedio : null,
        etiqueta: 'promedio',
        positivoEsBueno: true,
      },
      pctBajo: {
        valor: curr.pctBajo - prev.pctBajo,
        etiqueta: 'p.p.',
        positivoEsBueno: false,
      },
      riesgo: {
        valor: curr.riesgo - prev.riesgo,
        etiqueta: 'riesgo',
        positivoEsBueno: false,
      },
      cursos: { valor: 0, etiqueta: 'cursos', positivoEsBueno: true },
    };
  }, [datasetPeriodoAnterior, filteredStudents, configuracion, periodoComparacion]);

  const tieneFiltrosCruzados = useMemo(() => {
    return filtroRiesgo !== 'Todos' || filtroDesempeno !== 'Todos' || soloConPerdidas || soloPromedioEnBajo
      || filtroAsignatura !== 'Todas' || filtroCurso !== 'Todos' || filtroNivel !== 'Todos';
  }, [filtroRiesgo, filtroDesempeno, soloConPerdidas, soloPromedioEnBajo, filtroAsignatura, filtroCurso, filtroNivel]);

  const tieneFiltrosAsignatura = useMemo(() => {
    return filtroArea !== 'Todas' || filtroAsignatura !== 'Todas' || filtroTipo !== 'Todas';
  }, [filtroArea, filtroAsignatura, filtroTipo]);

  const totalEstudiantesConNotaSeleccionada = useMemo(() => {
    let count = 0;
    filteredStudents.forEach(s => {
      const grades = (s as any).filteredSubjects;
      const hasValidNote = grades.some(g => esNotaValida(g.nota, configuracion));
      if (hasValidNote) {
        count++;
      }
    });
    return count;
  }, [filteredStudents, configuracion, filtroPeriodo, filtroArea, filtroAsignatura, filtroTipo]);

  // PROBLEM 1: Consolidated Average calculator supporting five distinct modes
  const { promedioInstitucional, pctPromedioEnBajo, totalEstudiantesConPerdidas, auditDetail } = useMemo(() => {
    let allFilteredNotas: { nota: number; intensidad: number; estudianteNombre: string; periodo: string; codigo: string; nombreAsig: string }[] = [];
    const estudianteAverages: number[] = [];
    let countInBajo = 0;
    let countWithLoss = 0;
    
    const modoCalculo = configuracion.modoCalculoPromedioInstitucional || 'estudiante';

    if (!tieneFiltrosAsignatura && (modoCalculo === 'estudiante' || modoCalculo === 'acumulado' || modoCalculo === 'def')) {
       // Fast-path: Use exactly the calculated engine dataset
       filteredStudents.forEach(s => {
         const avg = s.promedioGeneral;
         if (avg !== null && avg !== undefined) {
           estudianteAverages.push(avg);
           const level = clasificarDesempeno(avg, configuracion);
           if (level?.nombre === 'Bajo') {
             countInBajo++;
           }
         }
         if (s.numPerdidas > 0) {
           countWithLoss++;
         }
       });

       const avgInst = estudianteAverages.length > 0
         ? estudianteAverages.reduce((sum, val) => sum + val, 0) / estudianteAverages.length
         : null;

       return {
         promedioInstitucional: avgInst,
         pctPromedioEnBajo: estudianteAverages.length > 0 ? (countInBajo / estudianteAverages.length) * 100 : 0,
         totalEstudiantesConPerdidas: countWithLoss,
         auditDetail: {
           modoCalculo,
           explanationText: `Se calcula usando la base central del motor. Promedio de ${estudianteAverages.length} estudiantes.`,
           estudianteAverages,
           allFilteredNotas: [],
           totalEstudiantesConNotas: estudianteAverages.length,
           totalNotasProcesadas: estudianteAverages.length
         }
       };
    }

    filteredStudents.forEach(s => {
      // Average Calculation subset (might use acumulado / def)
      const targetGrades = (s as any).filteredSubjects;
      const validGrades = targetGrades.filter(g => esNotaValida(g.nota, configuracion));
      const validNotas = validGrades.map(g => Number(g.nota));

      validGrades.forEach(g => {
        allFilteredNotas.push({
          nota: Number(g.nota),
          intensidad: (g.intensidadHoraria && g.intensidadHoraria > 0) ? g.intensidadHoraria : 1,
          estudianteNombre: s.estudianteNombre,
          periodo: g.periodoAnalisis || filtroPeriodo,
          codigo: g.codigoAsignatura,
          nombreAsig: g.nombreAsignatura
        });
      });

      if (validNotas.length > 0) {
        const avg = validNotas.reduce((sum, val) => sum + val, 0) / validNotas.length;
        estudianteAverages.push(avg);

        // Correct % Average Below calculation (Phase 4)
        const level = clasificarDesempeno(avg, configuracion);
        if (level?.nombre === 'Bajo') {
          countInBajo++;
        }
      }

      // Count of students with losses
      const hasLoss = (s as any).filteredSubjects.some(g => isPerdida(g.nota, configuracion));
      if (hasLoss) {
        countWithLoss++;
      }
    });

    let avgInst: number | null = null;
    let explanationText = "";

    if (modoCalculo === 'directo') {
      avgInst = allFilteredNotas.length > 0
        ? allFilteredNotas.reduce((sum, item) => sum + item.nota, 0) / allFilteredNotas.length
        : null;
      explanationText = `Promedio directo de las ${allFilteredNotas.length} calificaciones válidas registradas en el período/filtros seleccionados.`;
    } else if (modoCalculo === 'estudiante') {
      avgInst = estudianteAverages.length > 0
        ? estudianteAverages.reduce((sum, val) => sum + val, 0) / estudianteAverages.length
        : null;
      explanationText = `Se calcula primero el promedio de asignaturas de cada uno de los ${estudianteAverages.length} estudiantes, y luego se promedian esos valores individuales de forma equilibrada.`;
    } else if (modoCalculo === 'intensidad') {
      const sumNotesIH = allFilteredNotas.reduce((sum, item) => sum + (item.nota * item.intensidad), 0);
      const sumIH = allFilteredNotas.reduce((sum, item) => sum + item.intensidad, 0);
      avgInst = sumIH > 0 ? sumNotesIH / sumIH : null;
      explanationText = `Promedio ponderado por la intensidad horaria (IH) de cada asignatura. Suma de (nota × IH) dividido entre la suma de IH de todas las notas (${sumIH} hrs).`;
    } else if (modoCalculo === 'acumulado') {
      avgInst = allFilteredNotas.length > 0
        ? allFilteredNotas.reduce((sum, item) => sum + item.nota, 0) / allFilteredNotas.length
        : null;
      explanationText = `Promedio acumulado de calificaciones desde P1 hasta el período seleccionado (${filtroPeriodo}). Consolida un total de ${allFilteredNotas.length} notas cursadas.`;
    } else if (modoCalculo === 'def') {
      avgInst = allFilteredNotas.length > 0
        ? allFilteredNotas.reduce((sum, item) => sum + item.nota, 0) / allFilteredNotas.length
        : null;
      explanationText = `Promedio institucional calculado con DEF académico, entendido como promedio simple de P1 y P2 válidos. Consolida ${allFilteredNotas.length} notas del motor central.`;
    }

    const pctBajo = estudianteAverages.length > 0 ? (countInBajo / estudianteAverages.length) * 100 : 0;

    return {
      promedioInstitucional: avgInst,
      pctPromedioEnBajo: pctBajo,
      totalEstudiantesConPerdidas: countWithLoss,
      auditDetail: {
        modoCalculo,
        explanationText,
        totalNotasProcesadas: allFilteredNotas.length,
        totalEstudiantesConNotas: estudianteAverages.length,
        notasLista: allFilteredNotas,
        estudianteAverages
      }
    };
  }, [filteredStudents, filtroPeriodo, filtroArea, filtroAsignatura, filtroTipo, configuracion, totalEstudiantes]);

  const totalRiesgoAltoCritico = useMemo(() => {
    return filteredStudents.filter(s => 
      s.riesgo === 'Alto' || s.riesgo === 'Crítico'
    ).length;
  }, [filteredStudents]);

  // PROBLEM 6: Calculate active expected vs loaded courses with unique combinations
  const totalCursosTotalesDB = useMemo(() => {
    const u = new Set<string>();
    calificaciones.forEach(c => u.add(`${c.nivel}-${c.grado}-${c.curso}-${c.anio}`));
    return u.size;
  }, [calificaciones]);

  const totalCursosCargados = useMemo(() => {
    const u = new Set<string>();
    calificaciones.forEach(c => u.add(`${c.anio}-${c.nivel}-${c.grado}-${c.curso}`));
    return u.size;
  }, [calificaciones]);

  const totalCursosEsperados = configuracion.cursosEsperados?.length ?? 0;
  const cursosPendientes = Math.max(0, totalCursosEsperados - totalCursosCargados);

  // PROBLEM 2: Consolidate active qualifications to match all student/grade filters
  const calificacionesFiltradasParaStats = useMemo(() => {
    const arr: any[] = [];
    filteredStudents.forEach(s => {
      const grades = (s as any).filteredSubjects;
      arr.push(...grades);
    });
    return arr;
  }, [filteredStudents, filtroPeriodo, filtroArea, filtroAsignatura, filtroTipo, configuracion]);

  // CRITICAL SUBJECTS CALCULATION
  const { asignaturaAcademicaMasCritica, academicAsignaturasStats } = useMemo(() => {
    const academicGrades = calificacionesFiltradasParaStats.filter(c => {
      const dict = configuracion.diccionarioAreas.find(d => d.codigoBase === c.codigoAsignatura);
      const tipo = normalizarTipoAsignatura(dict?.tipo || c.tipoAsignatura || 'Académica');
      return tipo === 'Académica';
    });

    const academicMap = new Map<string, { total: number, perdidos: number, notas: number[] }>();
    academicGrades.forEach(g => {
      if (!esNotaValida(g.nota, configuracion)) return;
      const name = g.nombreAsignatura;
      if (!name) return;

      if (!academicMap.has(name)) {
        academicMap.set(name, { total: 0, perdidos: 0, notas: [] });
      }
      const stats = academicMap.get(name)!;
      stats.total++;
      const val = Number(g.nota);
      stats.notas.push(val);
      if (isPerdida(g.nota, configuracion)) {
        stats.perdidos++;
      }
    });

    const statsArr = Array.from(academicMap.entries()).map(([nombre, stats]) => {
      const pctPerdida = stats.total > 0 ? (stats.perdidos / stats.total) * 100 : 0;
      const promedio = stats.notas.length > 0 ? stats.notas.reduce((a, b) => a + b, 0) / stats.notas.length : 0;
      return {
        nombre,
        total: stats.total,
        perdidos: stats.perdidos,
        pctPerdida,
        promedio,
      };
    });

    statsArr.sort((a, b) => {
      if (b.perdidos !== a.perdidos) return b.perdidos - a.perdidos;
      if (b.pctPerdida !== a.pctPerdida) return b.pctPerdida - a.pctPerdida;
      return a.promedio - b.promedio;
    });

    return {
      asignaturaAcademicaMasCritica: statsArr.length > 0 ? statsArr[0].nombre : 'Ninguna',
      academicAsignaturasStats: statsArr,
    };
  }, [calificacionesFiltradasParaStats, configuracion]);

  const asignaturaCriticaPct = useMemo(() => {
    return academicAsignaturasStats.length > 0 ? academicAsignaturasStats[0].pctPerdida : 0;
  }, [academicAsignaturasStats]);

  // CRITICAL CENTER OF INTEREST CALCULATION
  const { centroInteresMasCritico, ciAsignaturasStats } = useMemo(() => {
    const ciGrades = calificacionesFiltradasParaStats.filter(c => {
      const dict = configuracion.diccionarioAreas.find(d => d.codigoBase === c.codigoAsignatura);
      const tipo = normalizarTipoAsignatura(dict?.tipo || c.tipoAsignatura || 'Académica');
      return tipo === 'Centro de interés';
    });

    const ciMap = new Map<string, { total: number, perdidos: number, notas: number[] }>();
    ciGrades.forEach(g => {
      if (!esNotaValida(g.nota, configuracion)) return;
      const name = g.nombreAsignatura;
      if (!name) return;

      if (!ciMap.has(name)) {
        ciMap.set(name, { total: 0, perdidos: 0, notas: [] });
      }
      const stats = ciMap.get(name)!;
      stats.total++;
      const val = Number(g.nota);
      stats.notas.push(val);
      if (isPerdida(g.nota, configuracion)) {
        stats.perdidos++;
      }
    });

    const statsArr = Array.from(ciMap.entries()).map(([nombre, stats]) => {
      const pctPerdida = stats.total > 0 ? (stats.perdidos / stats.total) * 100 : 0;
      const promedio = stats.notas.length > 0 ? stats.notas.reduce((a, b) => a + b, 0) / stats.notas.length : 0;
      return {
        nombre,
        total: stats.total,
        perdidos: stats.perdidos,
        pctPerdida,
        promedio,
      };
    }).sort((a, b) => {
      if (b.perdidos !== a.perdidos) return b.perdidos - a.perdidos;
      if (b.pctPerdida !== a.pctPerdida) return b.pctPerdida - a.pctPerdida;
      return a.promedio - b.promedio;
    });

    return {
      centroInteresMasCritico: statsArr.length > 0 ? statsArr[0].nombre : 'Sin datos',
      ciAsignaturasStats: statsArr,
    };
  }, [calificacionesFiltradasParaStats, configuracion]);

  // CHARTS DATA PREPARATION
  const riesgoChartData = useMemo(() => {
    const counts = { 'Sin riesgo': 0, 'Bajo': 0, 'Medio': 0, 'Alto': 0, 'Crítico': 0 };
    filteredStudents.forEach(s => {
      const r = s.riesgo;
      if (r in counts) {
        counts[r as keyof typeof counts]++;
      }
    });
    const total = filteredStudents.length || 1;
    return [
      { name: 'Sin riesgo', value: counts['Sin riesgo'], pct: (counts['Sin riesgo'] / total) * 100, color: '#10b981' },
      { name: 'Bajo', value: counts['Bajo'], pct: (counts['Bajo'] / total) * 100, color: '#3b82f6' },
      { name: 'Medio', value: counts['Medio'], pct: (counts['Medio'] / total) * 100, color: '#f59e0b' },
      { name: 'Alto', value: counts['Alto'], pct: (counts['Alto'] / total) * 100, color: '#f97316' },
      { name: 'Crítico', value: counts['Crítico'], pct: (counts['Crítico'] / total) * 100, color: '#ef4444' },
    ];
  }, [filteredStudents]);

  const topAsignaturasLista = useMemo(() => {
    const list = academicAsignaturasStats.slice(0, 10);
    const maxPerdidos = list[0]?.perdidos || 1;
    return list.map(a => ({
      id: a.nombre,
      label: a.nombre,
      value: a.perdidos,
      pct: a.pctPerdida,
      progressPct: (a.perdidos / maxPerdidos) * 100,
    }));
  }, [academicAsignaturasStats]);

  const topAcademicAsignaturas = useMemo(() => {
    return academicAsignaturasStats.slice(0, 10);
  }, [academicAsignaturasStats]);

  const topCIAsignaturas = useMemo(() => {
    return ciAsignaturasStats.slice(0, 10);
  }, [ciAsignaturasStats]);

  const topCursosRisk = useMemo(() => {
    const courseMap = new Map<string, { count: number; etiqueta: string }>();
    filteredStudents.forEach(s => {
      if (s.riesgo === 'Alto' || s.riesgo === 'Crítico') {
        const key = `${s.anio}-${s.nivel}-${s.grado}-${s.curso}`;
        const etiqueta = `${s.curso} (${s.nivel} ${s.grado}°)`;
        const prev = courseMap.get(key);
        courseMap.set(key, { count: (prev?.count || 0) + 1, etiqueta });
      }
    });
    return Array.from(courseMap.entries())
      .map(([key, { count, etiqueta }]) => ({ curso: etiqueta, cursoKey: key, count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 10);
  }, [filteredStudents]);

  const topCursosLista = useMemo(() => {
    const list = topCursosRisk.slice(0, 5);
    const max = list[0]?.count || 1;
    return list.map(c => ({
      id: c.cursoKey,
      label: c.curso,
      value: c.count,
      cursoKey: c.cursoKey,
      progressPct: (c.count / max) * 100,
    }));
  }, [topCursosRisk]);

  const desempenoChartData = useMemo(() => {
    const counts = { 'Bajo': 0, 'Básico': 0, 'Alto': 0, 'Superior': 0 };
    filteredStudents.forEach(s => {
      const level = clasificarDesempeno(s.promedioGeneral, configuracion);
      if (level && level.nombre in counts) {
        counts[level.nombre as keyof typeof counts]++;
      }
    });
    return [
      { name: 'Bajo', value: counts['Bajo'], color: '#ef4444' },
      { name: 'Básico', value: counts['Básico'], color: '#f59e0b' },
      { name: 'Alto', value: counts['Alto'], color: '#3b82f6' },
      { name: 'Superior', value: counts['Superior'], color: '#10b981' },
    ];
  }, [filteredStudents, configuracion]);

  const levelComparisonData = useMemo(() => {
    return ['Primaria', 'Bachillerato'].map(lvl => {
      const studs = filteredStudents.filter(s => s.nivel === lvl);
      const totalStuds = studs.length;

      const avgs: number[] = [];
      let countInBajo = 0;
      let countAltoCritico = 0;

      studs.forEach(s => {
        if (s.promedioGeneral !== null) {
          avgs.push(s.promedioGeneral);
          const level = clasificarDesempeno(s.promedioGeneral, configuracion);
          if (level?.nombre === 'Bajo') countInBajo++;
        }
        if (s.riesgo === 'Alto' || s.riesgo === 'Crítico') {
          countAltoCritico++;
        }
      });

      const average = avgs.length > 0 ? avgs.reduce((a, b) => a + b, 0) / avgs.length : 0;
      const pctBajo = totalStuds > 0 ? (countInBajo / totalStuds) * 100 : 0;

      return {
        name: lvl,
        'Promedio': parseFloat(average.toFixed(2)),
        '% Promedio en Bajo': parseFloat(pctBajo.toFixed(1)),
        'Riesgo Alto/Crítico': countAltoCritico,
      };
    });
  }, [filteredStudents, configuracion]);

  const trendData = useMemo(() => {
    return ['P1', 'P2', 'P3', 'P4'].map(p => {
      const pDataset = calcularDatasetAcademico(
        calificaciones,
        configuracion,
        p as any,
        {
          nivel: filtroNivel === 'Todos' ? undefined : filtroNivel,
          grado: filtroGrado === 'Todos' ? undefined : parseInt(filtroGrado, 10),
          curso: filtroCurso === 'Todos' ? undefined : filtroCurso,
          area: filtroArea === 'Todas' ? undefined : filtroArea,
          asignatura: filtroAsignatura === 'Todas' ? undefined : filtroAsignatura,
          tipoAsignatura: filtroTipo === 'Todas' ? undefined : filtroTipo
        }
      );

      const evals = pDataset.estudiantesCalculados.filter(e => e.filteredSubjects.some(s => esNotaValida(s.nota, configuracion)));
      if (evals.length === 0) {
        return {
          name: p,
          'Promedio': null,
          '% Estudiantes con Pérdidas': null,
          hasData: false,
        };
      }

      let studentsWithLossesCount = 0;
      let sumPromedios = 0;
      let countPromedios = 0;

      for (const e of evals) {
        if (e.promedioGeneral !== null) {
          sumPromedios += e.promedioGeneral;
          countPromedios++;
        }
        if (e.filteredSubjects.some(s => s.nota < configuracion.notaAprobacion)) {
          studentsWithLossesCount++;
        }
      }

      const avg = countPromedios > 0 ? sumPromedios / countPromedios : 0;
      const pctLoss = (studentsWithLossesCount / evals.length) * 100;

      return {
        name: p,
        'Promedio': parseFloat(avg.toFixed(2)),
        '% Estudiantes con Pérdidas': parseFloat(pctLoss.toFixed(1)),
        hasData: true,
      };
    });
  }, [calificaciones, configuracion, filtroNivel, filtroGrado, filtroCurso, filtroArea, filtroAsignatura, filtroTipo]);

  // TABLES DATA PREPARATION
  const cursosResumen = useMemo(() => {
    const lossMapByCurso = new Map<string, Map<string, number>>();

    filteredStudents.forEach(s => {
      const cursoKey = `${s.anio}-${s.nivel}-${s.grado}-${s.curso}`;
      const grades = (s as any).filteredSubjects;
      grades.forEach((g: any) => {
        const dict = configuracion.diccionarioAreas.find(d => d.codigoBase === g.codigoAsignatura);
        const tipo = dict?.tipo || g.tipoAsignatura || 'Académica';
        if (tipo === 'Académica' && isPerdida(g.nota, configuracion)) {
          if (!lossMapByCurso.has(cursoKey)) lossMapByCurso.set(cursoKey, new Map());
          const lossMap = lossMapByCurso.get(cursoKey)!;
          lossMap.set(g.nombreAsignatura, (lossMap.get(g.nombreAsignatura) || 0) + 1);
        }
      });
    });

    return dataset.resumenPorCurso.map(rc => {
      const cursoKey = rc.cursoKey || `${rc.anio}-${rc.nivel}-${rc.grado}-${rc.curso}`;
      const studs = filteredStudents.filter(s => `${s.anio}-${s.nivel}-${s.grado}-${s.curso}` === cursoKey);
      const count = studs.length;

      const avgs = studs.map(s => s.promedioGeneral).filter((p): p is number => p !== null && p !== undefined);
      const countInBajo = avgs.filter(avg => clasificarDesempeno(avg, configuracion)?.nombre === 'Bajo').length;
      const countLoss = studs.filter(s => (s as any).filteredSubjects.some((g: any) => isPerdida(g.nota, configuracion))).length;

      const lossMap = lossMapByCurso.get(cursoKey) || new Map();
      let critSubject = 'Ninguna';
      let maxLosses = 0;
      lossMap.forEach((losses, name) => {
        if (losses > maxLosses) {
          maxLosses = losses;
          critSubject = name;
        }
      });

      const pendingAlerts = alertas.filter(a => a.curso === rc.curso && a.estado === 'Pendiente').length;

      return {
        nivel: rc.nivel,
        grado: rc.grado,
        anio: rc.anio,
        curso: rc.etiqueta || rc.curso,
        cursoKey,
        estudiantes: count || rc.totalEstudiantes,
        promedio: rc.promedioCurso ?? (avgs.length > 0 ? avgs.reduce((a, b) => a + b, 0) / avgs.length : 0),
        pctBajo: count > 0 ? (countInBajo / count) * 100 : 0,
        estudiantesConPerdidas: countLoss,
        riesgoAlto: rc.estudiantesAltos,
        riesgoCritico: rc.estudiantesCriticos,
        asignaturaCritica: critSubject,
        alertasPendientes: pendingAlerts,
      };
    });
  }, [dataset.resumenPorCurso, filteredStudents, configuracion, alertas]);

  const asignaturasResumen = useMemo(() => {
    const statsMap = new Map<string, {
      codigo: string;
      nombre: string;
      area: string;
      tipo: string;
      evaluados: number;
      perdidos: number;
      notas: number[];
      lossesByCourse: Map<string, { total: number, perdidas: number }>;
      cuentaPerdida: boolean;
      aplicablesCount: number;
      noAplicablesCount: number;
    }>();

    filteredStudents.forEach(s => {
      const grades = (s as any).filteredSubjects;
      grades.forEach(g => {
        const code = g.codigoAsignatura;
        const name = g.nombreAsignatura;
        if (!name) return;

        const dict = configuracion.diccionarioAreas.find(d => d.codigoBase === code);
        const area = dict?.area || g.area || 'Desconocida';
        const tipo = dict?.tipo || g.tipoAsignatura || 'Académica';
        const cuentaPerdida = dict?.cuentaPerdida === 'SI' || dict?.cuentaPerdida === 'SI_CONDICIONAL';

        if (!statsMap.has(name)) {
          statsMap.set(name, {
            codigo: code,
            nombre: name,
            area,
            tipo,
            evaluados: 0,
            perdidos: 0,
            notas: [],
            lossesByCourse: new Map(),
            cuentaPerdida,
            aplicablesCount: 0,
            noAplicablesCount: 0,
          });
        }

        const stat = statsMap.get(name)!;

        // Check applicability explicitly
        const isApp = g.aplica !== false;
        if (isApp) {
          stat.aplicablesCount++;
        } else {
          stat.noAplicablesCount++;
        }

        if (esNotaValida(g.nota, configuracion)) {
          stat.evaluados++;
          const val = Number(g.nota);
          stat.notas.push(val);

          const isLost = isPerdida(g.nota, configuracion);
          if (isLost) {
            stat.perdidos++;
          }

          const cursoLabel = `${s.curso} (${s.nivel} ${s.grado}°)`;
          if (!stat.lossesByCourse.has(cursoLabel)) {
            stat.lossesByCourse.set(cursoLabel, { total: 0, perdidas: 0 });
          }
          const cStat = stat.lossesByCourse.get(cursoLabel)!;
          cStat.total++;
          if (isLost) {
            cStat.perdidas++;
          }
        }
      });
    });

    return Array.from(statsMap.values()).map(stat => {
      const pctPerdida = stat.evaluados > 0 ? (stat.perdidos / stat.evaluados) * 100 : 0;
      const promedio = stat.notas.length > 0 ? stat.notas.reduce((a, b) => a + b, 0) / stat.notas.length : 0;

      let maxLossPct = -1;
      let mostCriticalCourse = 'N/A';
      stat.lossesByCourse.forEach((cStat, curso) => {
         const pct = cStat.total > 0 ? (cStat.perdidas / cStat.total) * 100 : 0;
         if (pct > maxLossPct && cStat.perdidas > 0) {
           maxLossPct = pct;
           mostCriticalCourse = curso;
         }
      });

      // Detailed text
      const aplicaText = `${stat.aplicablesCount} aplicables / ${stat.noAplicablesCount} no aplicables`;

      return {
        codigo: stat.codigo,
        asignatura: stat.nombre,
        area: stat.area,
        tipo: stat.tipo,
        estudiantesEvaluados: stat.evaluados,
        estudiantesPerdidos: stat.perdidos,
        pctPerdida,
        promedio,
        cursoMasCritico: mostCriticalCourse,
        cuentaParaPerdida: stat.cuentaPerdida ? 'Sí' : 'No',
        aplica: aplicaText,
      };
    });
  }, [filteredStudents, filtroPeriodo, configuracion]);

  const estudiantesPrioritarios = useMemo(() => {
    return filteredStudents.map(s => ({
      estudiante: s.estudianteNombre,
      nivel: s.nivel,
      grado: s.grado,
      curso: s.curso,
      asignaturasPerdidas: s.numPerdidas,
      asignaturasEnRiesgo: s.asignaturasEnRiesgo?.length || 0,
      promedio: s.promedioGeneral,
      riesgo: s.riesgo,
      causaPrincipal: s.causaPrincipal,
      accionSugerida: s.accionSugerida,
    }));
  }, [filteredStudents]);

  // AUTOMATED COMPREHENSIVE NARRATIVE TEXT
  const analysisText = useMemo(() => {
    const avg = promedioInstitucional !== null && promedioInstitucional !== undefined ? promedioInstitucional.toFixed(2) : 'N/A';
    const pctBajo = pctPromedioEnBajo !== null && pctPromedioEnBajo !== undefined ? pctPromedioEnBajo.toFixed(1) : '0.0';
    const perdidasCount = totalEstudiantesConPerdidas;
    const riesgoCount = totalRiesgoAltoCritico;
    const critSubject = asignaturaAcademicaMasCritica;
    const ciCritSubject = centroInteresMasCritico;
    
    let text = `ACTUALMENTE, LA INSTITUCIÓN TIENE ${totalEstudiantes} ESTUDIANTES ANALIZADOS BAJO LOS FILTROS SELECCIONADOS. `;
    text += `EL PROMEDIO GENERAL DE LA SELECCIÓN ES DE ${avg}. `;
    text += `EL ${pctBajo}% DE LOS ESTUDIANTES TIENE SU PROMEDIO GENERAL EN NIVEL BAJO; SIN EMBARGO, `;
    text += `${perdidasCount} ESTUDIANTES PRESENTAN AL MENOS UNA ASIGNATURA PERDIDA, Y ${riesgoCount} ESTUDIANTES SE ENCUENTRAN EN RIESGO ALTO O CRÍTICO DE PERDER EL AÑO POR ACUMULACIÓN DE ÁREAS REPROBADAS (UMBRAL DE RIESGO CONFIGURADO: ≥ ${configuracion.asignaturasParaPerder} ASIGNATURAS). `;

    if (critSubject && critSubject !== 'Ninguna') {
      text += `LA ASIGNATURA ACADÉMICA CON MAYOR IMPACTO EN LAS PÉRDIDAS ES ${critSubject.toUpperCase()}. `;
    }

    if (ciCritSubject && ciCritSubject !== 'Sin datos') {
      text += `EN CENTROS DE INTERÉS, EL MAYOR FOCO DE PÉRDIDA SE REGISTRA EN ${ciCritSubject.toUpperCase()}. ESTE RESULTADO SE MUESTRA SEPARADO PORQUE LOS CENTROS DE INTERÉS TIENEN REGLAS ESPECIALES DE APLICABILIDAD EN BACHILLERATO Y NO DEBEN MEZCLARSE CON ASIGNATURAS ACADÉMICAS ORDINARIAS. `;
    }

    // Course upload gaps alert
    const numConfigured = totalCursosEsperados;
    const numLoaded = totalCursosCargados;
    if (numConfigured > 0 && numLoaded < numConfigured) {
      text += `FALTAN ${cursosPendientes} CURSOS POR CARGAR CON RESPECTO A LOS CURSOS ESPERADOS CONFIGURADOS, POR LO TANTO EL RESUMEN INSTITUCIONAL AÚN NO REPRESENTA LA TOTALIDAD DE LA INSTITUCIÓN. `;
    }

    return text;
  }, [totalEstudiantes, promedioInstitucional, pctPromedioEnBajo, totalEstudiantesConPerdidas, totalRiesgoAltoCritico, asignaturaAcademicaMasCritica, centroInteresMasCritico, configuracion, totalCursosCargados, totalCursosEsperados, cursosPendientes]);

  const validacionReferencia = useMemo(() => {
    const puedeValidar = filtroTipo === 'Académicas' && filtroNivel === 'Todos' && filtroGrado === 'Todos' && filtroCurso === 'Todos'
      && filtroArea === 'Todas' && filtroAsignatura === 'Todas' && filtroRiesgo === 'Todos'
      && !soloConPerdidas && !soloPromedioEnBajo
      && (filtroPeriodo === 'P1' || filtroPeriodo === 'P2' || filtroPeriodo === 'DEF');

    if (!puedeValidar || calificaciones.length === 0) return null;

    return validarContraReferencia(filtroPeriodo as 'P1' | 'P2' | 'DEF', {
      totalEstudiantes,
      promedioAcademicas: promedioInstitucional,
      pctPromedioBajo: pctPromedioEnBajo,
      estudiantesConPerdidas: totalEstudiantesConPerdidas,
      riesgoAltoCritico: totalRiesgoAltoCritico,
      registrosIncluidos: dataset.calificacionesValidas.length,
      registrosExcluidos: dataset.registrosExcluidos.length,
    });
  }, [filtroTipo, filtroNivel, filtroGrado, filtroCurso, filtroArea, filtroAsignatura, filtroRiesgo, soloConPerdidas, soloPromedioEnBajo, filtroPeriodo, calificaciones.length, totalEstudiantes, promedioInstitucional, pctPromedioEnBajo, totalEstudiantesConPerdidas, totalRiesgoAltoCritico, dataset]);

  return (
    <div className="space-y-6 max-w-7xl mx-auto relative" id="summary-dashboard-root">
      
      {/* HEADER SECTION */}
      <div className="bg-white p-5 rounded-xl shadow-sm border border-slate-200 flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <h2 className="text-sm font-bold text-slate-800 flex items-center gap-2">
            <Layers className="w-4 h-4 text-blue-700" />
            Resumen Institucional Académico
          </h2>
          <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mt-1">
            Análisis unificado de rendimiento y pérdidas de Villa Campo Analytics.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-3">
          {/* PROBLEM 17: CSV Export dropdown buttons */}
          <div className="relative inline-block text-left group">
            <button className="flex items-center gap-1.5 px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold rounded border border-slate-200 transition-colors">
              <Download className="w-3.5 h-3.5" />
              <span>Exportar Datos Auditoría</span>
            </button>
            <div className="absolute right-0 mt-1 w-64 bg-white border border-slate-200 rounded-md shadow-lg hidden group-hover:block hover:block z-30">
              <div className="py-1">
                <button
                  onClick={() => {
                    const rows: any[] = [];
                    filteredStudents.forEach(s => {
                      const grades = (s as any).filteredSubjects;
                      grades.forEach(g => {
                        rows.push({
                          Archivo: g.archivo || '',
                          Estudiante: s.estudianteNombre,
                          Numero: s.estudianteNumero,
                          Nivel: s.nivel,
                          Grado: s.grado,
                          Curso: s.curso,
                          Año: s.anio,
                          CódigoAsignatura: g.codigoAsignatura,
                          Asignatura: g.nombreAsignatura,
                          Área: g.area || '',
                          IntensidadHoraria: (g.intensidadHoraria && g.intensidadHoraria > 0) ? g.intensidadHoraria : 1,
                          PeriodoAnalisis: g.periodoAnalisis || filtroPeriodo,
                          NotaUsada: g.nota === null ? '' : g.nota,
                          CuentaParaPerdida: g.cuentaParaPerdida !== false ? 'Sí' : 'No',
                          Aplica: g.aplica !== false ? 'Sí' : 'No',
                          Perdida: g.nota < configuracion.notaAprobacion ? 'Sí' : 'No',
                          TipoAsignatura: g.tipoAsignatura || 'Académica',
                        });
                      });
                    });

                    const headers = [
                      'Estudiante', 'Número', 'Nivel', 'Grado', 'Curso', 'Año', 
                      'Código Asignatura', 'Asignatura', 'Intensidad Horaria', 'Período', 
                      'Nota', 'Es Válida', 'Aplica', 'Tipo Asignatura', 'Cuenta Para Pérdida'
                    ];
                    import('../utils/exporter').then(({ exportToCSV }) => {
                      exportToCSV(rows, 'calificacionesFiltradasResumen', headers);
                    });
                  }}
                  className="w-full text-left px-4 py-2 text-xs text-slate-700 hover:bg-slate-50 font-bold flex flex-col"
                >
                  <span>1. Calificaciones Filtradas</span>
                  <span className="text-[9px] text-slate-400 font-normal">calificacionesFiltradasResumen.csv (fila x fila)</span>
                </button>
                <button
                  onClick={() => {
                    const rows = filteredStudents.map(s => ({
                      Estudiante: s.estudianteNombre,
                      Numero: s.estudianteNumero,
                      Nivel: s.nivel,
                      Grado: s.grado,
                      Curso: s.curso,
                      Año: s.anio,
                      Riesgo: s.riesgo,
                      PromedioGeneral: s.promedioGeneral !== null && s.promedioGeneral !== undefined ? s.promedioGeneral.toFixed(4) : 'N/A',
                      AsignaturasPerdidas: s.numPerdidas,
                      AsignaturasEnRiesgo: s.asignaturasEnRiesgo?.length || 0,
                      CausaPrincipal: s.causaPrincipal || 'Ninguna',
                      AccionSugerida: s.accionSugerida || 'Ninguna'
                    }));

                    const headers = [
                      'Estudiante', 'Número', 'Nivel', 'Grado', 'Curso', 'Año',
                      'Riesgo', 'Promedio General', 'Asignaturas Perdidas', 'Asignaturas en Riesgo',
                      'Causa Principal', 'Acción Sugerida'
                    ];
                    import('../utils/exporter').then(({ exportToCSV }) => {
                      exportToCSV(rows, 'estudiantesCalculadosResumen', headers);
                    });
                  }}
                  className="w-full text-left px-4 py-2 text-xs text-slate-700 hover:bg-slate-50 border-t border-slate-100 font-bold flex flex-col"
                >
                  <span>2. Estudiantes Consolidados</span>
                  <span className="text-[9px] text-slate-400 font-normal">estudiantesCalculadosResumen.csv</span>
                </button>
                <button
                  onClick={() => {
                    const rows = dataset.registrosExcluidos.map(c => ({
                      Archivo: c.archivo,
                      Nivel: c.nivel,
                      Grado: c.grado,
                      Curso: c.curso,
                      Numero: c.estudianteNumero,
                      Estudiante: c.estudianteNombre,
                      Codigo: c.codigoAsignatura,
                      Asignatura: c.nombreAsignatura,
                      Periodo: c.periodo,
                      Nota: c.nota,
                      MotivoExclusion: (c as any).motivoExclusion || 'Excluido'
                    }));
                    const headers = ['Archivo', 'Nivel', 'Grado', 'Curso', 'Numero', 'Estudiante', 'Codigo', 'Asignatura', 'Periodo', 'Nota', 'MotivoExclusion'];
                    import('../utils/exporter').then(({ exportToCSV }) => {
                      exportToCSV(rows, 'registrosExcluidosDelCalculo', headers);
                    });
                  }}
                  className="w-full text-left px-4 py-2 text-xs text-slate-700 hover:bg-slate-50 border-t border-slate-100 font-bold flex flex-col"
                >
                  <span>3. Registros Excluidos</span>
                  <span className="text-[9px] text-slate-400 font-normal">registrosExcluidosDelCalculo.csv</span>
                </button>
                <button
                  onClick={() => {
                    import('../utils/exporter').then(({ exportToCSV }) => {
                      const rows = dataset.calificacionesValidas.map(c => ({
                        Archivo: c.archivo,
                        Nivel: c.nivel,
                        Grado: c.grado,
                        Curso: c.curso,
                        Año: c.anio,
                        EstudianteNumero: c.estudianteNumero,
                        EstudianteNombre: c.estudianteNombre,
                        CódigoAsignatura: c.codigoAsignatura,
                        NombreAsignatura: c.nombreAsignatura,
                        Área: c.area,
                        TipoAsignatura: c.tipoAsignatura,
                        PeriodoAnalisis: c.periodoAnalisis,
                        NotaUsada: c.nota,
                        CuentaParaPerdida: c.cuentaParaPerdida ? 'Sí' : 'No',
                        Aplica: c.aplica ? 'Sí' : 'No',
                        Perdida: c.perdida ? 'Sí' : 'No',
                      }));
                      exportToCSV(rows, 'calificacionesValidasMotorCentral', Object.keys(rows[0] || {}));
                    });
                  }}
                  className="w-full text-left px-4 py-2 text-xs text-slate-700 hover:bg-slate-50 border-t border-slate-100 font-bold flex flex-col"
                >
                  <span>5. Calificaciones Válidas Motor</span>
                  <span className="text-[9px] text-slate-400 font-normal">calificacionesValidasMotorCentral.csv</span>
                </button>
                <button
                  onClick={() => {
                    import('../utils/exporter').then(({ exportToCSV }) => {
                      const rows = dataset.resumenPorCurso.map(r => ({
                        Curso: r.etiqueta || r.curso,
                        Nivel: r.nivel,
                        Grado: r.grado,
                        Año: r.anio,
                        TotalEstudiantes: r.totalEstudiantes,
                        PromedioCurso: r.promedioCurso,
                        EstudiantesCriticos: r.estudiantesCriticos,
                        EstudiantesAltos: r.estudiantesAltos,
                        PorcentajeAprobacion: r.porcentajeAprobacion,
                      }));
                      exportToCSV(rows, 'resumenPorCursoMotorCentral', Object.keys(rows[0] || {}));
                    });
                  }}
                  className="w-full text-left px-4 py-2 text-xs text-slate-700 hover:bg-slate-50 border-t border-slate-100 font-bold flex flex-col"
                >
                  <span>6. Resumen por Curso</span>
                  <span className="text-[9px] text-slate-400 font-normal">resumenPorCursoMotorCentral.csv</span>
                </button>
                <button
                  onClick={() => {
                    import('../utils/exporter').then(({ exportToCSV }) => {
                      const rows = dataset.resumenPorAsignatura.map(r => ({
                        CódigoAsignatura: r.codigoAsignatura,
                        NombreAsignatura: r.nombreAsignatura,
                        TipoAsignatura: r.tipoAsignatura,
                        Área: r.area,
                        TotalEstudiantes: r.totalEstudiantes,
                        PromedioAsignatura: r.promedioAsignatura,
                        TotalPerdidos: r.totalPerdidos,
                        PorcentajePerdida: r.porcentajePerdida,
                      }));
                      exportToCSV(rows, 'resumenPorAsignaturaMotorCentral', Object.keys(rows[0] || {}));
                    });
                  }}
                  className="w-full text-left px-4 py-2 text-xs text-slate-700 hover:bg-slate-50 border-t border-slate-100 font-bold flex flex-col"
                >
                  <span>7. Resumen por Asignatura</span>
                  <span className="text-[9px] text-slate-400 font-normal">resumenPorAsignaturaMotorCentral.csv</span>
                </button>
                <button
                  onClick={() => {
                    import('../utils/exporter').then(({ exportToCSV }) => {
                      const rows = [
                        ...dataset.calificacionesValidas.map(c => ({ TipoRegistro: 'CalificacionValida', ...c })),
                        ...dataset.registrosExcluidos.map(c => ({ TipoRegistro: 'Excluido', motivoExclusion: (c as any).motivoExclusion, ...c })),
                        ...filteredStudents.map(s => ({ TipoRegistro: 'Estudiante', ...s, asignaturasPerdidas: s.numPerdidas })),
                      ];
                      exportToCSV(rows, 'datasetAcademicoCompleto', Object.keys(rows[0] || {}));
                    });
                  }}
                  className="w-full text-left px-4 py-2 text-xs text-slate-700 hover:bg-slate-50 border-t border-slate-100 font-bold flex flex-col"
                >
                  <span>8. Dataset Académico Completo</span>
                  <span className="text-[9px] text-slate-400 font-normal">datasetAcademicoCompleto.csv</span>
                </button>
              </div>
            </div>
          </div>

          <div className="flex items-center gap-3 bg-blue-50/60 px-4 py-2 border border-blue-100 rounded-lg text-xs">
            <RefreshCw className="w-3.5 h-3.5 text-blue-700" />
            <span className="text-blue-800 font-bold font-mono">Período Activo: {periodoActivo}</span>
          </div>
        </div>
      </div>

      {/* FILTER BAR SECTION */}
      <div className="bg-white p-4 rounded-xl shadow-sm border border-slate-200" id="filters-container">
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center border-b border-slate-100 pb-2 mb-4 gap-2">
          <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest flex items-center gap-1.5">
            Filtros interactivos de consulta
          </span>
          <div className="flex flex-wrap gap-2 items-center">
            {/* PROBLEM 5: Active badges for special filters with an 'X' to remove them */}
            {soloConPerdidas && (
              <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded bg-orange-100 text-orange-800 text-[10px] font-bold border border-orange-200">
                Filtro: Con Pérdidas
                <button onClick={() => setSoloConPerdidas(false)} className="text-orange-600 hover:text-orange-900 ml-0.5">
                  <X className="w-3 h-3" />
                </button>
              </span>
            )}
            {soloPromedioEnBajo && (
              <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded bg-amber-100 text-amber-800 text-[10px] font-bold border border-amber-200">
                Filtro: Promedio en Bajo
                <button onClick={() => setSoloPromedioEnBajo(false)} className="text-amber-600 hover:text-amber-900 ml-0.5">
                  <X className="w-3 h-3" />
                </button>
              </span>
            )}
            <button 
              onClick={handleLimpiarFiltros}
              className="text-[10px] font-bold text-red-600 border border-red-200 px-3 py-1.5 rounded uppercase hover:bg-red-50 transition-colors flex items-center gap-1"
            >
              Limpiar filtros
            </button>
          </div>
        </div>

        <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-8 gap-3">
          {/* Nivel */}
          <div>
            <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1">Nivel</label>
            <select 
              className="w-full bg-slate-50 border border-slate-200 text-xs rounded p-2 focus:ring-2 focus:ring-blue-500 outline-none font-bold text-slate-700"
              value={filtroNivel}
              onChange={(e) => { setFiltroNivel(e.target.value); setFiltroGrado('Todos'); setFiltroCurso('Todos'); }}
            >
              {nivelesOptions.map(n => <option key={n} value={n}>{n === 'Todos' ? 'Todos los niveles' : n}</option>)}
            </select>
          </div>

          {/* Grado */}
          <div>
            <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1">Grado</label>
            <select 
              className="w-full bg-slate-50 border border-slate-200 text-xs rounded p-2 focus:ring-2 focus:ring-blue-500 outline-none font-bold text-slate-700 font-mono"
              value={filtroGrado}
              onChange={(e) => { setFiltroGrado(e.target.value); setFiltroCurso('Todos'); }}
            >
              {gradosOptions.map(g => <option key={g} value={g}>{g === 'Todos' ? 'Todos' : `${g}°`}</option>)}
            </select>
          </div>

          {/* Curso */}
          <div>
            <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1">Curso</label>
            <select 
              className="w-full bg-slate-50 border border-slate-200 text-xs rounded p-2 focus:ring-2 focus:ring-blue-500 outline-none font-bold text-slate-700 font-mono"
              value={filtroCurso}
              onChange={(e) => setFiltroCurso(e.target.value)}
            >
              {cursosOptions.map(c => <option key={c} value={c}>{c === 'Todos' ? 'Todos' : c}</option>)}
            </select>
          </div>

          {/* Periodo */}
          <div>
            <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1">Período</label>
            <select 
              className="w-full bg-slate-50 border border-slate-200 text-xs rounded p-2 focus:ring-2 focus:ring-blue-500 outline-none font-bold text-slate-700 font-mono"
              value={filtroPeriodo}
              onChange={(e) => setFiltroPeriodo(e.target.value)}
            >
              {periodosOptions.map(p => <option key={p} value={p}>{p}</option>)}
            </select>
          </div>

          {/* Área */}
          <div>
            <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1">Área</label>
            <select 
              className="w-full bg-slate-50 border border-slate-200 text-xs rounded p-2 focus:ring-2 focus:ring-blue-500 outline-none font-bold text-slate-700 truncate"
              value={filtroArea}
              onChange={(e) => setFiltroArea(e.target.value)}
            >
              {areasOptions.map(a => <option key={a} value={a}>{a === 'Todas' ? 'Todas las áreas' : a}</option>)}
            </select>
          </div>

          {/* Asignatura */}
          <div>
            <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1">Asignatura</label>
            <select 
              className="w-full bg-slate-50 border border-slate-200 text-xs rounded p-2 focus:ring-2 focus:ring-blue-500 outline-none font-bold text-slate-700 truncate"
              value={filtroAsignatura}
              onChange={(e) => setFiltroAsignatura(e.target.value)}
            >
              {asignaturasOptions.map(a => <option key={a} value={a}>{a === 'Todas' ? 'Todas' : a}</option>)}
            </select>
          </div>

          {/* Tipo de Asignatura */}
          <div>
            <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1">Tipo de Asig.</label>
            <select 
              className="w-full bg-slate-50 border border-slate-200 text-xs rounded p-2 focus:ring-2 focus:ring-blue-500 outline-none font-bold text-slate-700"
              value={filtroTipo}
              onChange={(e) => setFiltroTipo(e.target.value)}
            >
              {tiposOptions.map(t => <option key={t} value={t}>{t}</option>)}
            </select>
          </div>

          {/* Riesgo */}
          <div>
            <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1">Riesgo</label>
            <select 
              className="w-full bg-slate-50 border border-slate-200 text-xs rounded p-2 focus:ring-2 focus:ring-blue-500 outline-none font-bold text-slate-700"
              value={filtroRiesgo}
              onChange={(e) => setFiltroRiesgo(e.target.value)}
            >
              {riesgosOptions.map(r => <option key={r} value={r}>{r === 'Todos' ? 'Todos los riesgos' : r}</option>)}
            </select>
          </div>
        </div>
      </div>

      {/* BARRA DE FILTROS CRUZADOS ACTIVOS (Power BI) */}
      {tieneFiltrosCruzados && (
        <div className="flex flex-wrap items-center gap-2 px-3 py-2 bg-blue-50 border border-blue-200 rounded-lg">
          <span className="text-[10px] font-bold text-blue-800 uppercase tracking-wider">Filtros cruzados:</span>
          {filtroRiesgo !== 'Todos' && (
            <button type="button" onClick={() => setFiltroRiesgo('Todos')} className="inline-flex items-center gap-1 px-2 py-0.5 bg-white border border-blue-300 rounded text-[10px] font-bold text-blue-700 hover:bg-blue-100">
              Riesgo: {filtroRiesgo} <X className="w-3 h-3" />
            </button>
          )}
          {filtroDesempeno !== 'Todos' && (
            <button type="button" onClick={() => setFiltroDesempeno('Todos')} className="inline-flex items-center gap-1 px-2 py-0.5 bg-white border border-blue-300 rounded text-[10px] font-bold text-blue-700 hover:bg-blue-100">
              Desempeño: {filtroDesempeno} <X className="w-3 h-3" />
            </button>
          )}
          {soloConPerdidas && (
            <button type="button" onClick={() => setSoloConPerdidas(false)} className="inline-flex items-center gap-1 px-2 py-0.5 bg-white border border-orange-300 rounded text-[10px] font-bold text-orange-700 hover:bg-orange-50">
              Con pérdidas <X className="w-3 h-3" />
            </button>
          )}
          {soloPromedioEnBajo && (
            <button type="button" onClick={() => setSoloPromedioEnBajo(false)} className="inline-flex items-center gap-1 px-2 py-0.5 bg-white border border-amber-300 rounded text-[10px] font-bold text-amber-700 hover:bg-amber-50">
              Promedio en Bajo <X className="w-3 h-3" />
            </button>
          )}
          {filtroAsignatura !== 'Todas' && (
            <button type="button" onClick={() => setFiltroAsignatura('Todas')} className="inline-flex items-center gap-1 px-2 py-0.5 bg-white border border-rose-300 rounded text-[10px] font-bold text-rose-700 hover:bg-rose-50">
              Asignatura: {filtroAsignatura} <X className="w-3 h-3" />
            </button>
          )}
          {filtroCurso !== 'Todos' && (
            <button type="button" onClick={() => { setFiltroCurso('Todos'); setFiltroNivel('Todos'); setFiltroGrado('Todos'); }} className="inline-flex items-center gap-1 px-2 py-0.5 bg-white border border-indigo-300 rounded text-[10px] font-bold text-indigo-700 hover:bg-indigo-50">
              Curso: {filtroCurso} <X className="w-3 h-3" />
            </button>
          )}
          <button type="button" onClick={handleLimpiarFiltros} className="ml-auto text-[10px] font-bold text-blue-600 hover:underline uppercase">
            Limpiar todos
          </button>
        </div>
      )}

      {/* KPI GRID — estilo mockup con cross-filter */}
      <SummaryKpiCards
        totalEstudiantes={totalEstudiantes}
        totalEstudiantesConNota={totalEstudiantesConNotaSeleccionada}
        tieneFiltrosAsignatura={tieneFiltrosAsignatura}
        promedioInstitucional={promedioInstitucional}
        pctPromedioEnBajo={pctPromedioEnBajo}
        countPromedioEnBajo={countPromedioEnBajo}
        totalEstudiantesConPerdidas={totalEstudiantesConPerdidas}
        totalRiesgoAltoCritico={totalRiesgoAltoCritico}
        totalCursosCargados={totalCursosCargados}
        totalCursosEsperados={totalCursosEsperados}
        cursosPendientes={cursosPendientes}
        asignaturaCritica={asignaturaAcademicaMasCritica}
        asignaturaCriticaPct={asignaturaCriticaPct}
        centroInteresCritico={centroInteresMasCritico}
        periodoComparacion={periodoComparacion}
        deltas={kpiDeltas}
        filtrosActivos={{
          riesgo: filtroRiesgo,
          desempeno: filtroDesempeno,
          soloPerdidas: soloConPerdidas,
          soloPromedioBajo: soloPromedioEnBajo,
        }}
        onResetFiltros={handleLimpiarFiltros}
        onVerCalculoPromedio={() => setVerCalculoKPI('promedio')}
        onVerCalculoPerdidas={() => setVerCalculoKPI('perdidas')}
        onVerCalculoRiesgo={() => setVerCalculoKPI('riesgo')}
        onTogglePromedioBajo={() => setSoloPromedioEnBajo(prev => !prev)}
        onTogglePerdidas={() => setSoloConPerdidas(prev => !prev)}
        onToggleRiesgo={() => setFiltroRiesgo(prev => prev === 'Alto/Crítico' ? 'Todos' : 'Alto/Crítico')}
        onLimpiarFiltrosAsignatura={() => { setFiltroArea('Todas'); setFiltroAsignatura('Todas'); setFiltroTipo('Todas'); }}
        onFiltrarAsignaturaCritica={() => {
          if (asignaturaAcademicaMasCritica !== 'Ninguna') {
            toggleFiltroAsignatura(asignaturaAcademicaMasCritica, 'Académicas');
          }
        }}
        onFiltrarCentroInteres={() => {
          if (centroInteresMasCritico !== 'Sin datos') {
            toggleFiltroAsignatura(centroInteresMasCritico, 'Centros de interés');
          }
        }}
      />

      {/* VISUAL CHARTS SECTION */}
      <SummaryCharts
        riesgoChartData={riesgoChartData}
        topAsignaturasLista={topAsignaturasLista}
        topCursosLista={topCursosLista}
        topCIAsignaturas={topCIAsignaturas}
        desempenoChartData={desempenoChartData}
        levelComparisonData={levelComparisonData}
        trendData={trendData}
        activeFilters={{
          riesgo: filtroRiesgo,
          asignatura: filtroAsignatura === 'Todas' ? '' : filtroAsignatura,
          cursoKey: activeCursoKey,
          desempeno: filtroDesempeno === 'Todos' ? '' : filtroDesempeno,
        }}
        onToggleRiesgo={toggleFiltroRiesgo}
        onToggleAsignatura={(nombre) => toggleFiltroAsignatura(nombre, 'Académicas')}
        onToggleCurso={toggleFiltroCurso}
        onToggleDesempeno={toggleFiltroDesempeno}
        onToggleCIAsignatura={(nombre) => toggleFiltroAsignatura(nombre, 'Centros de interés')}
      />

      {/* AUTOMATIC TEXT ANALYSIS REPORT */}
      <div className="bg-slate-800 border border-slate-700 p-5 rounded-xl flex gap-4 items-start shadow-inner mt-4" id="analysis-report-box">
        <div className="p-2 bg-slate-700 text-slate-300 rounded shrink-0">
          <AlertCircle className="w-4 h-4 text-slate-300" />
        </div>
        <div>
          <h4 className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-2">Análisis Automático Generado de Desempeño</h4>
          <p className="text-xs text-slate-300 leading-relaxed font-mono whitespace-pre-line">
            {analysisText}
          </p>
        </div>
      </div>

      {/* INTERACTIVE DATA TABLES */}
      <SummaryTables
        cursosResumen={cursosResumen}
        asignaturasResumen={asignaturasResumen}
        estudiantesPrioritarios={estudiantesPrioritarios}
        onFilterCurso={(curso) => {
          applyCursoFromTable(curso);
          document.getElementById('summary-dashboard-root')?.scrollIntoView({ behavior: 'smooth' });
        }}
        onFilterAsignatura={(asig) => {
          toggleFiltroAsignatura(asig, 'Académicas');
          document.getElementById('summary-dashboard-root')?.scrollIntoView({ behavior: 'smooth' });
        }}
        onFilterRiesgo={(risk) => {
          toggleFiltroRiesgo(risk);
          document.getElementById('summary-dashboard-root')?.scrollIntoView({ behavior: 'smooth' });
        }}
      />

      {/* PROBLEM 16: Slide-out Mathematical Audit Panel */}
      {verCalculoKPI !== null && (
        <div className="fixed inset-0 z-50 overflow-hidden bg-slate-900/60 backdrop-blur-sm flex justify-end">
          <div className="relative w-full max-w-2xl bg-white h-full shadow-2xl flex flex-col animate-slide-in">
            {/* Panel Header */}
            <div className="bg-slate-900 text-white p-5 flex justify-between items-center shrink-0">
              <div>
                <span className="text-[9px] text-blue-400 font-bold uppercase tracking-wider">Módulo de Transparencia de Cálculos</span>
                <h3 className="text-base font-bold flex items-center gap-2 mt-0.5">
                  <HelpCircle className="w-5 h-5 text-blue-400" />
                  {verCalculoKPI === 'promedio' && 'Auditoría: Promedio Institucional'}
                  {verCalculoKPI === 'perdidas' && 'Auditoría: Estudiantes con Pérdidas'}
                  {verCalculoKPI === 'riesgo' && 'Auditoría: Estudiantes en Riesgo Alto/Crítico'}
                </h3>
              </div>
              <button 
                onClick={() => setVerCalculoKPI(null)} 
                className="p-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 transition-colors"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Panel Content (Scrollable) */}
            <div className="flex-1 overflow-y-auto p-6 space-y-6">
              
              {/* SECTION 1: PROMEDIO INSTITUCIONAL DETAILS */}
              {verCalculoKPI === 'promedio' && (
                <div className="space-y-4">
                  <div className="bg-slate-50 border border-slate-200 p-4 rounded-lg">
                    <h4 className="text-xs font-bold text-slate-800 uppercase tracking-wide mb-1.5">Configuración Académica Activa</h4>
                    <p className="text-xs text-slate-600 font-bold">
                      Modo Seleccionado: <span className="text-blue-700 underline capitalize">{auditDetail.modoCalculo === 'directo' ? 'Promedio Directo' : auditDetail.modoCalculo === 'estudiante' ? 'Promedio de Estudiantes' : auditDetail.modoCalculo === 'intensidad' ? 'Promedio Ponderado por IH' : auditDetail.modoCalculo === 'acumulado' ? 'Promedio Acumulado' : 'Solo DEF'}</span>
                    </p>
                    <p className="text-[11px] text-slate-500 mt-2 italic leading-relaxed">
                      "{auditDetail.explanationText}"
                    </p>
                  </div>

                  {validacionReferencia && (
                    <div className="border border-amber-200 rounded-lg overflow-hidden">
                      <div className="bg-amber-50 px-3 py-2 text-[10px] font-bold text-amber-800 uppercase border-b border-amber-200">
                        Validación contra referencia ({filtroPeriodo})
                      </div>
                      <table className="w-full text-left text-[10px]">
                        <thead className="bg-white text-slate-500">
                          <tr>
                            <th className="px-2 py-1">Indicador</th>
                            <th className="px-2 py-1">Esperado</th>
                            <th className="px-2 py-1">Calculado</th>
                            <th className="px-2 py-1">Δ</th>
                            <th className="px-2 py-1">OK</th>
                          </tr>
                        </thead>
                        <tbody>
                          {validacionReferencia.map((v, i) => (
                            <tr key={i} className={v.coincide ? '' : 'bg-red-50'}>
                              <td className="px-2 py-1 font-mono">{v.indicador}</td>
                              <td className="px-2 py-1 font-mono">{v.esperado}</td>
                              <td className="px-2 py-1 font-mono">{v.calculado ?? 'N/A'}</td>
                              <td className="px-2 py-1 font-mono">{v.diferencia ?? '-'}</td>
                              <td className="px-2 py-1">{v.coincide ? '✓' : '✗'}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}

                  <div className="grid grid-cols-2 gap-4">
                    <div className="bg-blue-50 border border-blue-100 p-3 rounded-lg text-center">
                      <span className="block text-[10px] font-bold text-blue-600 uppercase">Valor Resultante</span>
                      <span className="text-2xl font-black text-blue-900 font-mono">
                        {promedioInstitucional !== null && promedioInstitucional !== undefined ? promedioInstitucional.toFixed(4) : 'N/A'}
                      </span>
                      {promedioInstitucional !== null && (
                        <span className="block text-[9px] text-slate-500 mt-1">
                          Numerador: {(promedioInstitucional * auditDetail.totalNotasProcesadas).toFixed(2)} / Denominador: {auditDetail.totalNotasProcesadas}
                        </span>
                      )}
                    </div>
                    <div className="bg-slate-50 border border-slate-200 p-3 rounded-lg text-center">
                      <span className="block text-[10px] font-bold text-slate-500 uppercase">Registros Procesados</span>
                      <span className="text-xl font-bold text-slate-800 font-mono">
                        {auditDetail.modoCalculo === 'estudiante' ? `${auditDetail.totalEstudiantesConNotas} estudiantes` : `${auditDetail.totalNotasProcesadas} calificaciones`}
                      </span>
                    </div>
                  </div>

                  <div className="border border-slate-200 rounded-lg overflow-hidden">
                    <div className="bg-slate-100 px-3 py-2 text-[10px] font-bold text-slate-600 uppercase border-b border-slate-200 flex justify-between items-center">
                      <span>Muestra de registros utilizados</span>
                      <button 
                        onClick={() => {
                          let rows = [];
                          if (auditDetail.modoCalculo === 'estudiante') {
                            rows = auditDetail.estudianteAverages.map((avg: number, i: number) => ({ Estudiante: filteredStudents[i]?.nombre, Curso: filteredStudents[i]?.curso, Promedio: avg }));
                          } else {
                            rows = auditDetail.allFilteredNotas.map((n: any) => ({ Estudiante: n.estudianteNombre, Asignatura: n.nombreAsig, Nota: n.nota }));
                          }
                          import('../utils/exporter').then(({ exportToCSV }) => exportToCSV(rows, 'auditoria_promedio_institucional', Object.keys(rows[0] || {})));
                        }}
                        className="text-blue-600 hover:text-blue-800 underline uppercase text-[9px]"
                      >
                        Exportar CSV
                      </button>
                    </div>
                    <div className="max-h-60 overflow-y-auto divide-y divide-slate-100 text-[11px]">
                      {auditDetail.modoCalculo === 'estudiante' ? (
                        auditDetail.estudianteAverages.slice(0, 30).map((avg: number, idx: number) => {
                          const est = filteredStudents[idx];
                          return (
                            <div key={idx} className="px-3 py-2 flex justify-between items-center hover:bg-slate-50">
                              <span className="text-slate-700 font-medium font-mono">{idx + 1}. {est?.nombre} ({est?.curso})</span>
                              <span className="font-bold text-slate-900 font-mono">{avg !== null && avg !== undefined ? avg.toFixed(3) : 'N/A'}</span>
                            </div>
                          );
                        })
                      ) : (
                        auditDetail.notasLista.slice(0, 30).map((item: any, idx: number) => (
                          <div key={idx} className="px-3 py-2 flex justify-between items-center hover:bg-slate-50">
                            <div className="flex flex-col">
                              <span className="text-slate-700 font-bold">{idx + 1}. {item.estudianteNombre}</span>
                              <span className="text-[10px] text-slate-400 uppercase font-mono">{item.nombreAsig} ({item.codigo}) • IH: {item.intensidad} hr • {item.periodo}</span>
                            </div>
                            <span className="font-bold text-slate-900 font-mono">{item.nota}</span>
                          </div>
                        ))
                      )}
                      {((auditDetail.modoCalculo === 'estudiante' ? auditDetail.estudianteAverages.length : auditDetail.notasLista.length) > 30) && (
                        <div className="px-3 py-2 text-center text-[10px] text-slate-400 bg-slate-50 font-bold">
                          ... y { (auditDetail.modoCalculo === 'estudiante' ? auditDetail.estudianteAverages.length : auditDetail.notasLista.length) - 30 } registros más. Descarga la auditoría en CSV para ver la lista completa.
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              )}

              {/* SECTION 2: ESTUDIANTES CON PERDIDAS DETAILS */}
              {verCalculoKPI === 'perdidas' && (
                <div className="space-y-4">
                  <div className="bg-red-50 border border-red-100 p-4 rounded-lg">
                    <h4 className="text-xs font-bold text-red-800 uppercase tracking-wide mb-1">Reglas de validación aplicadas</h4>
                    <p className="text-[11px] text-red-700 leading-relaxed font-mono">
                      1. Excluye asignaturas cuya columna aplica es falso.<br />
                      2. Excluye Comportamiento y notas de tipo conductual.<br />
                      3. Excluye Centros de Interés en el nivel Primaria.<br />
                      4. Nota reprobatoria: menor a {configuracion.notaAprobacion}.<br />
                      5. Resuelve duplicidad de Centros de Interés según directrices académicas.
                    </p>
                  </div>

                  <div className="border border-slate-200 rounded-lg overflow-hidden">
                    <div className="bg-slate-100 px-3 py-2 text-[10px] font-bold text-slate-600 uppercase border-b border-slate-200 flex justify-between">
                      <span>Lista de Estudiantes con pérdidas</span>
                      <span className="text-slate-400">{totalEstudiantesConPerdidas} estudiantes</span>
                    </div>
                    <div className="max-h-96 overflow-y-auto divide-y divide-slate-100 text-[11px]">
                      {filteredStudents
                        .filter(s => {
                          const validAcademicGrades = obtenerAsignaturasValidasParaPerdida(s.allGrades, filtroPeriodo, configuracion);
                          const studentSelectedGrades = validAcademicGrades.filter(c => {
                            const dict = configuracion.diccionarioAreas.find(d => d.codigoBase === c.codigoAsignatura);
                            const area = dict?.area || c.area || 'Desconocida';
                            const matchArea = filtroArea === 'Todas' || area === filtroArea;
                            const matchAsignatura = filtroAsignatura === 'Todas' || c.nombreAsignatura === filtroAsignatura;
                            let matchTipo = true;
                            const tipo = dict?.tipo || c.tipoAsignatura || 'Académica';
                            if (filtroTipo !== 'Todas') {
                              if (filtroTipo === 'Académicas') matchTipo = tipo === 'Académica';
                              else if (filtroTipo === 'Centros de interés') matchTipo = tipo === 'Centro de interés';
                              else if (filtroTipo === 'Comportamiento') matchTipo = tipo === 'Comportamiento';
                              else if (filtroTipo === 'No académicas') matchTipo = tipo !== 'Académica' && tipo !== 'Centro de interés' && tipo !== 'Comportamiento';
                            }
                            return matchArea && matchAsignatura && matchTipo;
                          });
                          return studentSelectedGrades.some(g => isPerdida(g.nota, configuracion));
                        })
                        .map((s, idx) => {
                          const validAcademicGrades = obtenerAsignaturasValidasParaPerdida(s.allGrades, filtroPeriodo, configuracion);
                          const lostGrades = validAcademicGrades.filter(g => isPerdida(g.nota, configuracion));
                          return (
                            <div key={idx} className="px-4 py-2.5 flex flex-col hover:bg-slate-50 gap-1">
                              <div className="flex justify-between items-center">
                                <span className="font-bold text-slate-800">{idx + 1}. {s.estudianteNombre} ({s.curso})</span>
                                <span className="text-xs font-bold text-red-600 font-mono">{lostGrades.length} perdidas</span>
                              </div>
                              <div className="flex flex-wrap gap-1.5 mt-1">
                                {lostGrades.map((g, i) => (
                                  <span key={i} className="inline-flex items-center text-[10px] bg-red-50 text-red-700 px-1.5 py-0.5 rounded border border-red-100 font-mono font-bold">
                                    {g.nombreAsignatura}: {g.nota}
                                  </span>
                                ))}
                              </div>
                            </div>
                          );
                        })}
                    </div>
                  </div>
                </div>
              )}

              {/* SECTION 3: ESTUDIANTES EN RIESGO DETAILS */}
              {verCalculoKPI === 'riesgo' && (
                <div className="space-y-4">
                  <div className="bg-amber-50 border border-amber-100 p-4 rounded-lg">
                    <h4 className="text-xs font-bold text-amber-800 uppercase tracking-wide mb-1">Criterio de clasificación de riesgo</h4>
                    <p className="text-[11px] text-amber-700 leading-relaxed font-mono">
                      • RIESGO CRÍTICO: Estudiante tiene <span className="font-bold">≥ {configuracion.asignaturasParaPerder}</span> materias reprobadas en total.<br />
                      • RIESGO ALTO: Estudiante tiene <span className="font-bold">{configuracion.asignaturasParaPerder - 1}</span> materias reprobadas en total.
                    </p>
                  </div>

                  <div className="border border-slate-200 rounded-lg overflow-hidden">
                    <div className="bg-slate-100 px-3 py-2 text-[10px] font-bold text-slate-600 uppercase border-b border-slate-200 flex justify-between">
                      <span>Lista de Estudiantes Alto / Crítico</span>
                      <span className="text-slate-400">{totalRiesgoAltoCritico} estudiantes</span>
                    </div>
                    <div className="max-h-96 overflow-y-auto divide-y divide-slate-100 text-[11px]">
                      {filteredStudents
                        .filter(s => s.riesgo === 'Alto' || s.riesgo === 'Crítico')
                        .map((s, idx) => (
                          <div key={idx} className="px-4 py-2.5 flex justify-between items-center hover:bg-slate-50">
                            <div>
                              <span className="font-bold text-slate-800 block">{idx + 1}. {s.estudianteNombre} ({s.curso})</span>
                              <span className="text-[10px] text-slate-400 uppercase font-mono">Causa: {s.causaPrincipal}</span>
                            </div>
                            <div className="flex items-center gap-2">
                              <span className="font-mono font-bold text-slate-700 text-xs">{s.numPerdidas} pérdidas</span>
                              <span className={`px-2 py-0.5 rounded font-bold text-[10px] uppercase font-mono ${s.riesgo === 'Crítico' ? 'bg-red-100 text-red-800' : 'bg-orange-100 text-orange-800'}`}>
                                {s.riesgo}
                              </span>
                            </div>
                          </div>
                        ))}
                    </div>
                  </div>
                </div>
              )}

            </div>

            {/* Panel Footer */}
            <div className="bg-slate-50 border-t border-slate-200 p-4 text-center shrink-0">
              <p className="text-[10px] text-slate-400 font-bold uppercase tracking-wider">
                Auditoría certificada de consistencia matemática de Villa Campo Analytics.
              </p>
            </div>
          </div>
        </div>
      )}

    </div>
  );
};
