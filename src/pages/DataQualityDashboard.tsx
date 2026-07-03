import React, { useState, useMemo } from 'react';
import { useStore } from '../store';
import { AlertTriangle, ShieldAlert, CheckCircle, FileWarning, Search, Filter, AlertCircle, PlusCircle, Trash2, Layers, Check, X } from 'lucide-react';
import { GravedadAlerta, EstadoAlerta, AlertaCalidad } from '../types';
import { calcularDatasetAcademico } from '../utils/calculations';

export const DataQualityDashboard: React.FC = () => {
  const { alertas, archivosCargados, configuracion, setConfiguracion, revalidarDatos, calificaciones, periodoActivo, setAlertas } = useStore();
  const [dynamicAlertStatuses, setDynamicAlertStatuses] = useState<Record<string, EstadoAlerta>>({});
  const [searchTerm, setSearchTerm] = useState('');
  const [filterGravedad, setFilterGravedad] = useState<GravedadAlerta | 'Todas'>('Todas');
  const [filterEstado, setFilterEstado] = useState<EstadoAlerta | 'Todos'>('Todos');
  const [filterArchivo, setFilterArchivo] = useState<string>('Todos');
  
  // State for active alert group filter
  const [selectedGroupFilter, setSelectedGroupFilter] = useState<string | null>(null);

  // Modal State for adding unknown code to dictionary
  const [showAddModal, setShowAddModal] = useState(false);
  const [modalCode, setModalCode] = useState('');
  const [nombreAsignatura, setNombreAsignatura] = useState('');
  const [area, setArea] = useState('Matemáticas');
  const [tipo, setTipo] = useState('Académica');
  const [cuentaPerdida, setCuentaPerdida] = useState('SI');
  const [intensidadHoraria, setIntensidadHoraria] = useState(4);

  // 1. Calculate dynamic alerts using calculations engine
  const dataset = useMemo(() => {
    return calcularDatasetAcademico(calificaciones, configuracion, periodoActivo, {});
  }, [calificaciones, configuracion, periodoActivo]);

  const dynamicAlerts = useMemo(() => {
    return (dataset?.alertasCalculo || []).map((a: any, idx: number) => {
      const matchingStudent = dataset?.estudiantesCalculados?.find(e => e.estudianteNombre === a.estudiante);
      let gravedad: GravedadAlerta = 'Alta';
      if (a.descripcion.includes('múltiples centros')) {
        gravedad = 'Crítica';
      } else if (a.descripcion.includes('no coincide')) {
        gravedad = 'Alta';
      } else if (a.descripcion.includes('inactiva')) {
        gravedad = 'Alta';
      }

      let tipo = 'Centros de interés inconsistentes';
      if (a.descripcion.includes('no coincide')) {
        tipo = 'Inconsistencia de promedio';
      } else if (a.descripcion.includes('inactiva') || a.descripcion.includes('no aplicable')) {
        tipo = 'Asignatura no aplicable';
      }

      const id = `dyn-alert-${idx}`;
      return {
        id,
        gravedad,
        tipo,
        archivo: 'Análisis en Tiempo Real',
        nivel: matchingStudent?.nivel,
        grado: matchingStudent?.grado?.toString(),
        curso: a.curso,
        estudiante: a.estudiante,
        descripcion: a.descripcion,
        accionSugerida: a.descripcion.includes('múltiples')
          ? 'Verificar el centro de interés activo y remover o desactivar el secundario.'
          : a.descripcion.includes('no coincide')
          ? 'Recalcular promedio o ajustar la escala cualitativa.'
          : 'Ajustar la matrícula o aplicabilidad de la materia en el archivo original.',
        estado: dynamicAlertStatuses[id] || ('Pendiente' as const)
      };
    });
  }, [dataset, dynamicAlertStatuses]);

  // Combine static DB alerts and dynamic calculation alerts
  const allUnifiedAlerts = useMemo(() => {
    return [...alertas, ...dynamicAlerts];
  }, [alertas, dynamicAlerts]);

  // Grouped Alert counts (for "Pendientes por corregir")
  const gruposAlertas = useMemo(() => {
    return [
      { id: 'codigos', label: 'Códigos desconocidos', count: allUnifiedAlerts.filter(a => a.tipo === 'Código de asignatura desconocido' && a.estado === 'Pendiente').length, color: 'border-l-orange-500' },
      { id: 'aplicabilidad', label: 'Asignaturas no aplicables', count: allUnifiedAlerts.filter(a => a.tipo === 'Asignatura no aplicable' && a.estado === 'Pendiente').length, color: 'border-l-blue-400' },
      { id: 'centros', label: 'Centros de interés inconsistentes', count: allUnifiedAlerts.filter(a => a.tipo === 'Centros de interés inconsistentes' && a.estado === 'Pendiente').length, color: 'border-l-red-500' },
      { id: 'notas', label: 'Notas fuera de rango', count: allUnifiedAlerts.filter(a => a.tipo === 'Nota fuera de rango' && a.estado === 'Pendiente').length, color: 'border-l-rose-600' },
      { id: 'estudiantes', label: 'Estudiantes duplicados', count: allUnifiedAlerts.filter(a => a.tipo === 'Estudiante duplicado' && a.estado === 'Pendiente').length, color: 'border-l-yellow-600' },
      { id: 'archivos', label: 'Archivos con estructura incorrecta', count: allUnifiedAlerts.filter(a => (a.tipo === 'Estructura incorrecta' || a.tipo === 'Error de lectura' || a.tipo === 'Archivo sin registros' || a.tipo === 'Nombre de archivo inválido') && a.estado === 'Pendiente').length, color: 'border-l-red-700' },
      { id: 'cursos', label: 'Cursos duplicados', count: allUnifiedAlerts.filter(a => a.tipo === 'Curso duplicado' && a.estado === 'Pendiente').length, color: 'border-l-indigo-500' },
      { id: 'inconsistencias', label: 'Inconsistencias de promedio/cualitativo', count: allUnifiedAlerts.filter(a => (a.tipo === 'Inconsistencia de promedio' || a.tipo === 'Inconsistencia de cálculo') && a.estado === 'Pendiente').length, color: 'border-l-violet-600' }
    ];
  }, [allUnifiedAlerts]);

  // Handle Group Click
  const handleGroupClick = (groupId: string) => {
    if (selectedGroupFilter === groupId) {
      setSelectedGroupFilter(null); // Toggle off
    } else {
      setSelectedGroupFilter(groupId);
    }
  };

  // Filtered Alert calculation
  const filteredAlertas = useMemo(() => {
    return allUnifiedAlerts.filter(a => {
      const matchSearch = a.descripcion.toLowerCase().includes(searchTerm.toLowerCase()) ||
                          (a.estudiante && a.estudiante.toLowerCase().includes(searchTerm.toLowerCase())) ||
                          (a.nombreAsignatura && a.nombreAsignatura.toLowerCase().includes(searchTerm.toLowerCase())) ||
                          a.tipo.toLowerCase().includes(searchTerm.toLowerCase());
      const matchGravedad = filterGravedad === 'Todas' || a.gravedad === filterGravedad;
      const matchEstado = filterEstado === 'Todos' || a.estado === filterEstado;
      const matchArchivo = filterArchivo === 'Todos' || a.archivo === filterArchivo;

      let matchGroup = true;
      if (selectedGroupFilter === 'codigos') matchGroup = a.tipo === 'Código de asignatura desconocido';
      else if (selectedGroupFilter === 'aplicabilidad') matchGroup = a.tipo === 'Asignatura no aplicable';
      else if (selectedGroupFilter === 'centros') matchGroup = a.tipo === 'Centros de interés inconsistentes';
      else if (selectedGroupFilter === 'notas') matchGroup = a.tipo === 'Nota fuera de rango';
      else if (selectedGroupFilter === 'estudiantes') matchGroup = a.tipo === 'Estudiante duplicado';
      else if (selectedGroupFilter === 'archivos') matchGroup = (a.tipo === 'Estructura incorrecta' || a.tipo === 'Error de lectura' || a.tipo === 'Archivo sin registros' || a.tipo === 'Nombre de archivo inválido');
      else if (selectedGroupFilter === 'cursos') matchGroup = a.tipo === 'Curso duplicado';
      else if (selectedGroupFilter === 'inconsistencias') matchGroup = (a.tipo === 'Inconsistencia de promedio' || a.tipo === 'Inconsistencia de cálculo');

      return matchSearch && matchGravedad && matchEstado && matchArchivo && matchGroup;
    });
  }, [allUnifiedAlerts, searchTerm, filterGravedad, filterEstado, filterArchivo, selectedGroupFilter]);

  // Aggregate pending subject codes for the "Códigos pendientes en diccionario" section
  const codigosPendientes = useMemo(() => {
    const map = new Map<string, { code: string; count: number; files: Set<string>; courses: Set<string>; }>();
    
    allUnifiedAlerts.forEach(a => {
      if (a.tipo === 'Código de asignatura desconocido' && a.codigoAsignatura) {
        const code = a.codigoAsignatura;
        if (!map.has(code)) {
          map.set(code, { code, count: 0, files: new Set(), courses: new Set() });
        }
        const item = map.get(code)!;
        item.count += 1;
        if (a.archivo) item.files.add(a.archivo);
        if (a.curso) item.courses.add(a.curso);
      }
    });

    return Array.from(map.values()).map(item => ({
      codigo: item.code,
      vecesDetectado: item.count,
      archivosAfectados: Array.from(item.files),
      cursosAfectados: Array.from(item.courses),
    }));
  }, [allUnifiedAlerts]);

  // KPIs
  const totalAlertas = allUnifiedAlerts.length;
  const criticas = allUnifiedAlerts.filter(a => a.gravedad === 'Crítica').length;
  const altas = allUnifiedAlerts.filter(a => a.gravedad === 'Alta').length;
  const medias = allUnifiedAlerts.filter(a => a.gravedad === 'Media').length;
  const bajas = allUnifiedAlerts.filter(a => a.gravedad === 'Baja').length;
  const codigosDesconocidos = allUnifiedAlerts.filter(a => a.tipo === 'Código de asignatura desconocido').length;
  const noAplicables = allUnifiedAlerts.filter(a => a.tipo === 'Asignatura no aplicable').length;

  const getGravedadStyle = (gravedad: GravedadAlerta) => {
    switch(gravedad) {
      case 'Crítica': return 'bg-red-100 text-red-800 border-red-200';
      case 'Alta': return 'bg-orange-100 text-orange-800 border-orange-200';
      case 'Media': return 'bg-yellow-100 text-yellow-800 border-yellow-200';
      case 'Baja': return 'bg-blue-100 text-blue-800 border-blue-200';
      case 'Informativa': return 'bg-slate-100 text-slate-800 border-slate-200';
      default: return 'bg-slate-100 text-slate-800';
    }
  };

  // Open modal with pre-filled code
  const openAddModal = (code: string) => {
    setModalCode(code);
    setNombreAsignatura('');
    setShowAddModal(true);
  };

  // Submit dictionary entry
  const handleAddSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const newEntry = {
      codigoBase: modalCode,
      nombreAsignatura: nombreAsignatura || modalCode,
      area,
      tipo: tipo as any,
      cuentaPerdida: cuentaPerdida as any,
      observacion: 'Registrado desde calidad de datos',
      activa: true
    };

    setConfiguracion({
      diccionarioAreas: [...configuracion.diccionarioAreas, newEntry]
    });

    // Run revalidation so the alert disappears instantly
    setTimeout(() => {
      revalidarDatos();
    }, 50);

    setShowAddModal(false);
  };

  // Get unique areas from existing config to suggest
  const areasDisponibles = useMemo(() => {
    const areas = configuracion.diccionarioAreas.map(d => d.area);
    return Array.from(new Set(areas)).sort();
  }, [configuracion.diccionarioAreas]);

  return (
    <div id="data-quality-container" className="space-y-6 max-w-7xl mx-auto">
      {/* KPIs */}
      <div id="kpi-grid" className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-7 gap-4">
        <div className="bg-white p-4 rounded-xl shadow-sm border border-slate-200 flex flex-col justify-center">
          <p className="text-[10px] text-slate-500 font-bold uppercase tracking-widest mb-1">Total Alertas</p>
          <h3 className="text-2xl font-bold text-slate-900 font-mono">{totalAlertas}</h3>
        </div>
        <div className="bg-white p-4 rounded-xl shadow-sm border border-red-200 flex flex-col justify-center bg-red-50">
          <p className="text-[10px] text-red-600 font-bold uppercase tracking-widest mb-1 flex items-center gap-1">
            <ShieldAlert className="w-3 h-3" /> Críticas
          </p>
          <h3 className="text-2xl font-bold text-red-700 font-mono">{criticas}</h3>
        </div>
        <div className="bg-white p-4 rounded-xl shadow-sm border border-orange-200 flex flex-col justify-center bg-orange-50">
          <p className="text-[10px] text-orange-600 font-bold uppercase tracking-widest mb-1 flex items-center gap-1">
            <AlertTriangle className="w-3 h-3" /> Altas
          </p>
          <h3 className="text-2xl font-bold text-orange-700 font-mono">{altas}</h3>
        </div>
        <div className="bg-white p-4 rounded-xl shadow-sm border border-yellow-200 flex flex-col justify-center bg-yellow-50">
          <p className="text-[10px] text-yellow-600 font-bold uppercase tracking-widest mb-1 flex items-center gap-1">
            <FileWarning className="w-3 h-3" /> Medias
          </p>
          <h3 className="text-2xl font-bold text-yellow-700 font-mono">{medias}</h3>
        </div>
        <div className="bg-white p-4 rounded-xl shadow-sm border border-blue-200 flex flex-col justify-center bg-blue-50">
          <p className="text-[10px] text-blue-600 font-bold uppercase tracking-widest mb-1 flex items-center gap-1">
            <CheckCircle className="w-3 h-3" /> Bajas
          </p>
          <h3 className="text-2xl font-bold text-blue-700 font-mono">{bajas}</h3>
        </div>
        <div className="bg-white p-4 rounded-xl shadow-sm border border-slate-200 flex flex-col justify-center">
          <p className="text-[10px] text-slate-500 font-bold uppercase tracking-widest mb-1">Cód. Desconocidos</p>
          <h3 className="text-2xl font-bold text-slate-900 font-mono">{codigosDesconocidos}</h3>
        </div>
        <div className="bg-white p-4 rounded-xl shadow-sm border border-slate-200 flex flex-col justify-center">
          <p className="text-[10px] text-slate-500 font-bold uppercase tracking-widest mb-1">No aplicables</p>
          <h3 className="text-2xl font-bold text-slate-900 font-mono">{noAplicables}</h3>
        </div>
      </div>

      {/* Main Grid: "Pendientes por corregir" sidebar on the left, Alertas Table on the right */}
      <div id="main-quality-grid" className="grid grid-cols-1 lg:grid-cols-4 gap-6">
        
        {/* Left column: Pendientes por corregir */}
        <div id="pendientes-panel" className="lg:col-span-1 space-y-4">
          <div className="bg-white p-5 rounded-xl shadow-sm border border-slate-200">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-sm font-bold text-slate-800 uppercase tracking-wider flex items-center gap-2">
                <Layers className="w-4 h-4 text-slate-500" /> Pendientes por corregir
              </h3>
              {selectedGroupFilter && (
                <button 
                  onClick={() => setSelectedGroupFilter(null)}
                  className="text-[10px] text-blue-600 hover:underline font-bold"
                >
                  Limpiar Filtro
                </button>
              )}
            </div>
            
            <div className="space-y-2">
              {gruposAlertas.map((g) => {
                const isActive = selectedGroupFilter === g.id;
                return (
                  <button
                    key={g.id}
                    onClick={() => handleGroupClick(g.id)}
                    className={`w-full text-left p-3 rounded-lg border text-xs font-mono transition-all flex justify-between items-center ${
                      isActive 
                        ? 'bg-slate-900 text-white border-slate-950 shadow-sm' 
                        : 'bg-slate-50 hover:bg-slate-100 text-slate-700 border-slate-200 border-l-4 ' + g.color
                    }`}
                  >
                    <span className="font-semibold truncate pr-2">{g.label}</span>
                    <span className={`px-2 py-0.5 rounded text-[11px] font-bold ${
                      isActive ? 'bg-slate-800 text-white' : g.count > 0 ? 'bg-red-100 text-red-700' : 'bg-slate-200 text-slate-500'
                    }`}>
                      {g.count}
                    </span>
                  </button>
                );
              })}
            </div>
            <p className="text-[10px] text-slate-400 mt-4 leading-normal">
              * Haz clic en un grupo de alertas para filtrar automáticamente la tabla de detalles a la derecha.
            </p>
          </div>
        </div>

        {/* Right column: Filters & Alert List Table */}
        <div id="alerts-table-panel" className="lg:col-span-3">
          <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden flex flex-col h-[520px]">
            <div className="p-4 border-b border-slate-200 bg-slate-50 flex flex-col md:flex-row gap-4 justify-between items-center">
              <div className="relative w-full md:w-80">
                <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                <input 
                  type="text" 
                  placeholder="Buscar alertas..." 
                  className="w-full pl-9 pr-4 py-2 text-sm border border-slate-200 rounded focus:ring-2 focus:ring-blue-500 outline-none text-slate-700 font-mono bg-white"
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                />
              </div>
              
              <div className="flex flex-wrap gap-2 w-full md:w-auto justify-end">
                {selectedGroupFilter && (
                  <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded text-xs font-bold bg-slate-900 text-white font-mono uppercase">
                    Filtro Activo
                    <button onClick={() => setSelectedGroupFilter(null)} className="hover:text-red-300">
                      <X className="w-3.5 h-3.5" />
                    </button>
                  </span>
                )}
                
                <div className="flex items-center gap-2 border border-slate-200 rounded px-2 py-1 bg-white">
                  <Filter className="w-3 h-3 text-slate-400" />
                  <select 
                    className="text-xs bg-transparent outline-none font-bold text-slate-700 cursor-pointer"
                    value={filterGravedad}
                    onChange={(e) => setFilterGravedad(e.target.value as any)}
                  >
                    <option value="Todas">Todas las gravedades</option>
                    <option value="Crítica">Crítica</option>
                    <option value="Alta">Alta</option>
                    <option value="Media">Media</option>
                    <option value="Baja">Baja</option>
                    <option value="Informativa">Informativa</option>
                  </select>
                </div>
                
                <div className="flex items-center gap-2 border border-slate-200 rounded px-2 py-1 bg-white">
                  <select 
                    className="text-xs bg-transparent outline-none font-bold text-slate-700 cursor-pointer w-32 truncate"
                    value={filterArchivo}
                    onChange={(e) => setFilterArchivo(e.target.value)}
                  >
                    <option value="Todos">Todos los archivos</option>
                    {archivosCargados.map((a: any) => {
                      const nombre = a.nombreArchivo || a.nombre;
                      return <option key={nombre} value={nombre} title={nombre}>{nombre}</option>;
                    })}
                  </select>
                </div>
                
                <div className="flex items-center gap-2 border border-slate-200 rounded px-2 py-1 bg-white">
                  <select 
                    className="text-xs bg-transparent outline-none font-bold text-slate-700 cursor-pointer"
                    value={filterEstado}
                    onChange={(e) => setFilterEstado(e.target.value as any)}
                  >
                    <option value="Todos">Todos los estados</option>
                    <option value="Pendiente">Pendiente</option>
                    <option value="Revisada">Revisada</option>
                    <option value="Ignorada">Ignorada</option>
                    <option value="Corregida">Corregida</option>
                  </select>
                </div>
              </div>
            </div>

            <div className="overflow-y-auto overflow-x-auto flex-1">
              <table className="w-full text-left text-sm min-w-[800px]">
                <thead className="bg-slate-100 text-slate-500 font-bold text-[10px] uppercase tracking-widest border-b border-slate-200 sticky top-0 z-10 shadow-sm">
                  <tr>
                    <th className="px-4 py-3">Gravedad</th>
                    <th className="px-4 py-3">Tipo</th>
                    <th className="px-4 py-3">Contexto (Archivo / Curso / Estudiante / Asignatura)</th>
                    <th className="px-4 py-3">Descripción</th>
                    <th className="px-4 py-3">Acción Sugerida</th>
                    <th className="px-4 py-3 w-40">Seguimiento / Estado</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {filteredAlertas.length === 0 ? (
                    <tr>
                      <td colSpan={6} className="px-4 py-12 text-center text-slate-400 text-xs font-mono">
                        NO SE ENCONTRARON ALERTAS CON LOS FILTROS SELECCIONADOS.
                      </td>
                    </tr>
                  ) : (
                    filteredAlertas.map((alerta) => (
                       <tr key={alerta.id} className="hover:bg-slate-50 transition-colors">
                        <td className="px-4 py-3 align-top">
                          <span className={`inline-flex items-center px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider border ${getGravedadStyle(alerta.gravedad)}`}>
                            {alerta.gravedad}
                          </span>
                        </td>
                        <td className="px-4 py-3 align-top font-bold text-slate-700 text-xs">{alerta.tipo}</td>
                        <td className="px-4 py-3 align-top text-xs">
                          <div className="flex flex-col gap-1">
                            <span className="text-slate-500 flex items-center gap-1"><FileWarning className="w-3 h-3 text-slate-400" /> {alerta.archivo}</span>
                            {alerta.curso && <span className="text-slate-700 font-bold">Curso: <span className="font-normal font-mono">{alerta.curso}</span></span>}
                            {alerta.estudiante && <span className="text-slate-700 font-bold">Estudiante: <span className="font-normal">{alerta.estudiante}</span></span>}
                            {alerta.nombreAsignatura && <span className="text-slate-700 font-bold">Asignatura: <span className="font-normal font-mono text-blue-700">{alerta.nombreAsignatura}</span></span>}
                          </div>
                        </td>
                        <td className="px-4 py-3 align-top text-xs text-slate-600 max-w-xs break-words font-mono">
                          {alerta.descripcion}
                        </td>
                        <td className="px-4 py-3 align-top text-xs font-semibold text-slate-500">
                          {alerta.accionSugerida}
                          {alerta.tipo === 'Código de asignatura desconocido' && alerta.codigoAsignatura && (
                            <button
                              onClick={() => openAddModal(alerta.codigoAsignatura!)}
                              className="mt-2 block bg-orange-100 text-orange-800 hover:bg-orange-200 px-2 py-1 rounded text-[10px] font-bold uppercase tracking-wider transition-colors"
                            >
                              Resolver ahora
                            </button>
                          )}
                        </td>
                        <td className="px-4 py-3 align-top text-xs">
                          <div className="flex flex-col gap-1.5">
                            <span className={`inline-flex items-center self-start px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider border ${
                              alerta.estado === 'Pendiente' ? 'bg-amber-100 text-amber-800 border-amber-200' :
                              alerta.estado === 'Revisada' ? 'bg-blue-100 text-blue-800 border-blue-200' :
                              alerta.estado === 'Ignorada' ? 'bg-slate-100 text-slate-800 border-slate-200' :
                              'bg-green-100 text-green-800 border-green-200'
                            }`}>
                              {alerta.estado}
                            </span>
                            <div className="flex items-center gap-1 mt-1">
                              <select
                                value={alerta.estado}
                                onChange={(e) => {
                                  const newState = e.target.value as EstadoAlerta;
                                  if (alerta.id.startsWith('dyn-alert-')) {
                                    setDynamicAlertStatuses(prev => ({ ...prev, [alerta.id]: newState }));
                                  } else {
                                    const updated = alertas.map(a => a.id === alerta.id ? { ...a, estado: newState } : a);
                                    setAlertas(updated);
                                  }
                                }}
                                className="bg-white border border-slate-200 rounded px-1 py-0.5 text-[10px] font-bold text-slate-700 outline-none cursor-pointer"
                              >
                                <option value="Pendiente">Pendiente</option>
                                <option value="Revisada">Revisada</option>
                                <option value="Ignorada">Ignorada</option>
                                <option value="Corregida">Corregida</option>
                              </select>
                            </div>
                          </div>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      </div>

      {/* Códigos pendientes en diccionario Section */}
      <div id="codigos-diccionario-seccion" className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
        <div className="p-4 border-b border-slate-200 bg-slate-50">
          <h3 className="text-sm font-bold text-slate-800 uppercase tracking-wider flex items-center gap-2">
            <PlusCircle className="w-4 h-4 text-orange-500" /> Códigos pendientes en diccionario
          </h3>
          <p className="text-xs text-slate-500 mt-1">
            Códigos de asignaturas encontrados en los archivos Excel que no existen en el diccionario oficial. Agrégalos para regularizar los cálculos.
          </p>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm min-w-[700px]">
            <thead className="bg-slate-100 text-slate-500 font-bold text-[10px] uppercase tracking-widest border-b border-slate-200">
              <tr>
                <th className="px-6 py-3">Código Desconocido</th>
                <th className="px-6 py-3">Veces Detectado</th>
                <th className="px-6 py-3">Archivos Afectados</th>
                <th className="px-6 py-3">Cursos Afectados</th>
                <th className="px-6 py-3">Acción</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {codigosPendientes.length === 0 ? (
                <tr>
                  <td colSpan={5} className="px-6 py-8 text-center text-slate-400 text-xs font-mono">
                    EXCELENTE: NO HAY CÓDIGOS DESCONOCIDOS PENDIENTES EN EL DICCIONARIO.
                  </td>
                </tr>
              ) : (
                codigosPendientes.map((item) => (
                  <tr key={item.codigo} className="hover:bg-slate-50 transition-colors">
                    <td className="px-6 py-4 align-middle font-mono font-bold text-orange-700 bg-orange-50/30">
                      {item.codigo}
                    </td>
                    <td className="px-6 py-4 align-middle font-mono text-slate-700 font-bold">
                      {item.vecesDetectado} veces
                    </td>
                    <td className="px-6 py-4 align-middle text-xs text-slate-500 max-w-xs truncate" title={item.archivosAfectados.join(', ')}>
                      {item.archivosAfectados.join(', ')}
                    </td>
                    <td className="px-6 py-4 align-middle text-xs font-mono font-bold text-slate-700">
                      {item.cursosAfectados.join(', ') || 'Desconocido'}
                    </td>
                    <td className="px-6 py-4 align-middle">
                      <button
                        onClick={() => openAddModal(item.codigo)}
                        className="inline-flex items-center gap-1.5 bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs px-3 py-1.5 rounded transition-colors"
                      >
                        <PlusCircle className="w-3.5 h-3.5" /> Agregar al diccionario
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Auto Analysis Summary Text */}
      <div className="bg-slate-800 border border-slate-700 p-5 rounded-xl flex gap-4 items-start shadow-inner mt-4">
        <div className="p-2 bg-slate-700 text-slate-300 rounded shrink-0">
          <AlertCircle className="w-4 h-4" />
        </div>
        <div>
          <h4 className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-2">Análisis Automático Generado</h4>
          <p className="text-sm text-slate-300 leading-relaxed font-mono">
            SE HAN DETECTADO <strong className="text-white bg-slate-700 px-1 rounded">{totalAlertas} ALERTAS</strong> EN LA CALIDAD DE LOS DATOS CARGADOS. 
            ES PRIORITARIO RESOLVER LAS <strong className="text-red-400 bg-red-900/30 px-1 rounded">{criticas} ALERTAS CRÍTICAS</strong> PARA EVITAR ERRORES EN EL CÁLCULO DE RIESGO DE LOS ESTUDIANTES. 
            EXISTEN <strong className="text-white bg-slate-700 px-1 rounded">{codigosDesconocidos} ASIGNATURAS NO RECONOCIDAS</strong> QUE DEBEN AGREGARSE AL DICCIONARIO.
          </p>
        </div>
      </div>

      {/* Modal form to add a code to the dictionary */}
      {showAddModal && (
        <div className="fixed inset-0 bg-slate-900/55 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-xl border border-slate-200 max-w-md w-full overflow-hidden">
            <div className="bg-slate-900 text-white px-5 py-4 flex justify-between items-center">
              <h3 className="text-sm font-bold uppercase tracking-wider font-mono">Agregar a Diccionario</h3>
              <button 
                onClick={() => setShowAddModal(false)}
                className="text-slate-400 hover:text-white"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
            
            <form onSubmit={handleAddSubmit} className="p-5 space-y-4">
              <div>
                <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-widest mb-1">Código de Asignatura</label>
                <input 
                  type="text" 
                  readOnly 
                  value={modalCode} 
                  className="w-full bg-slate-100 border border-slate-200 text-slate-700 font-mono font-bold text-sm px-3 py-2 rounded focus:outline-none"
                />
              </div>

              <div>
                <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-widest mb-1">Nombre de Asignatura</label>
                <input 
                  type="text" 
                  required 
                  placeholder="Ej: Matemáticas" 
                  value={nombreAsignatura} 
                  onChange={(e) => setNombreAsignatura(e.target.value)} 
                  className="w-full bg-white border border-slate-200 text-slate-800 text-sm px-3 py-2 rounded focus:ring-2 focus:ring-blue-500 outline-none"
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-widest mb-1">Área Académica</label>
                  <select 
                    value={area} 
                    onChange={(e) => setArea(e.target.value)} 
                    className="w-full bg-white border border-slate-200 text-slate-800 text-xs px-3 py-2 rounded focus:ring-2 focus:ring-blue-500 outline-none font-bold"
                  >
                    {areasDisponibles.map(a => (
                      <option key={a} value={a}>{a}</option>
                    ))}
                    {!areasDisponibles.includes(area) && <option value={area}>{area}</option>}
                    <option value="Otra">Otra Area</option>
                  </select>
                </div>

                <div>
                  <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-widest mb-1">Tipo de Asignatura</label>
                  <select 
                    value={tipo} 
                    onChange={(e) => setTipo(e.target.value)} 
                    className="w-full bg-white border border-slate-200 text-slate-800 text-xs px-3 py-2 rounded focus:ring-2 focus:ring-blue-500 outline-none font-bold"
                  >
                    <option value="Académica">Académica</option>
                    <option value="Centro de interés">Centro de interés</option>
                    <option value="Técnica">Técnica</option>
                    <option value="Comportamiento">Comportamiento</option>
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-widest mb-1">Cuenta para Pérdida</label>
                  <select 
                    value={cuentaPerdida} 
                    onChange={(e) => setCuentaPerdida(e.target.value)} 
                    className="w-full bg-white border border-slate-200 text-slate-800 text-xs px-3 py-2 rounded focus:ring-2 focus:ring-blue-500 outline-none font-bold"
                  >
                    <option value="SI">SÍ</option>
                    <option value="NO">NO</option>
                    <option value="SI_CONDICIONAL">SÍ (Condicional)</option>
                  </select>
                </div>

                <div>
                  <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-widest mb-1">Intensidad Horaria Base</label>
                  <input 
                    type="number" 
                    min={1} 
                    max={15} 
                    required 
                    value={intensidadHoraria} 
                    onChange={(e) => setIntensidadHoraria(parseInt(e.target.value, 10))} 
                    className="w-full bg-white border border-slate-200 text-slate-800 text-xs px-3 py-2 rounded focus:ring-2 focus:ring-blue-500 outline-none font-mono"
                  />
                </div>
              </div>

              <div className="pt-2 flex justify-end gap-2">
                <button 
                  type="button" 
                  onClick={() => setShowAddModal(false)}
                  className="bg-slate-100 hover:bg-slate-200 text-slate-600 font-bold text-xs px-4 py-2 rounded transition-colors"
                >
                  Cancelar
                </button>
                <button 
                  type="submit" 
                  className="bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs px-4 py-2 rounded transition-colors flex items-center gap-1.5"
                >
                  <Check className="w-4 h-4" /> Registrar Asignatura
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
