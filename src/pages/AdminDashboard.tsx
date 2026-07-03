import React, { useRef, useState, useMemo } from 'react';
import { Upload, FileWarning, CheckCircle, AlertTriangle, Eye, Trash2, Download, FileText, ExternalLink, AlertCircle, RefreshCw, PlusCircle, X, ChevronRight, HelpCircle, CloudUpload } from 'lucide-react';
import { useStore } from '../store';
import { processExcelFile, parseFileName, detectActivePeriod } from '../utils/excelParser';
import { cn } from '../components/Sidebar';
import { pushStateToServer, pushConfigToServer } from '../utils/syncApi';

interface Props {
  onNavigate?: (tab: string) => void;
}

export const AdminDashboard: React.FC<Props> = ({ onNavigate }) => {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [uploadStatus, setUploadStatus] = useState<string | null>(null);
  const [lastUploadError, setLastUploadError] = useState<string | null>(null);
  const [syncMessage, setSyncMessage] = useState<string | null>(null);
  const [isSyncing, setIsSyncing] = useState(false);

  // Replacement Confirmation Modal State
  const [duplicateFileToProcess, setDuplicateFileToProcess] = useState<{ file: File; existingName: string; meta: any } | null>(null);

  // New expected course form state
  const [newNivel, setNewNivel] = useState<'Primaria' | 'Bachillerato'>('Bachillerato');
  const [newGrado, setNewGrado] = useState<number>(6);
  const [newCurso, setNewCurso] = useState<string>('A');

  const { 
    configuracion, 
    addCalificaciones, 
    eliminarArchivo, 
    setAlertas, 
    alertas, 
    calificaciones, 
    clearData, 
    archivosCargados, 
    revalidarDatos,
    setConfiguracion,
    setPeriodoActivo
  } = useStore();

  // Process a single file to extract data and save in store
  const processSingleFile = async (file: File) => {
    setIsProcessing(true);
    setUploadStatus(`Procesando ${file.name}...`);
    try {
      const { calificaciones: newCalifs, alertas: fileAlerts, fileMeta } = await processExcelFile(file, configuracion, setUploadStatus);
      
      // Calculate active period for this specific file
      let filePeriod: 'P1' | 'P2' | 'P3' | 'P4' | 'DEF' = 'P1';
      const periods = ['P1', 'P2', 'P3', 'P4'];
      for (const p of periods) {
        if (newCalifs.some(c => c.periodo === p && typeof c.nota === 'number')) {
          filePeriod = p as any;
        }
      }

      // Add to store with metadata
      addCalificaciones(newCalifs, file.name, {
        nivel: fileMeta.nivel,
        gradoNum: fileMeta.gradoNum,
        curso: fileMeta.curso,
        anio: fileMeta.anio,
        totalRegistros: newCalifs.length,
        periodoDetectado: filePeriod
      }, fileAlerts);

      // Update and revalidate, then force save to MySQL
      await new Promise(r => setTimeout(r, 80));
      revalidarDatos();
      const currentCalifs = useStore.getState().calificaciones;
      const newActivePeriod = detectActivePeriod(currentCalifs);
      setPeriodoActivo(newActivePeriod);

      setUploadStatus(`Guardando ${file.name} en el servidor...`);
      const saved = await pushStateToServer();
      if (!saved) {
        setLastUploadError(
          `Archivo procesado en este navegador, pero no se guardó en el servidor. Use «Sincronizar ahora».`
        );
      }

    } catch (error: any) {
      setLastUploadError(`Error en ${file.name}: ${error.message}`);
      
      // Add reader error to store alerts list
      const updatedAlerts = [...alertas, {
        id: crypto.randomUUID(),
        gravedad: 'Crítica' as const,
        tipo: 'Error de lectura',
        archivo: file.name,
        descripcion: error.message || 'Error desconocido al procesar el archivo.',
        accionSugerida: 'Verificar la estructura interna del archivo Excel.',
        estado: 'Pendiente' as const
      }];
      setAlertas(updatedAlerts);
    } finally {
      setIsProcessing(false);
      setUploadStatus(null);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  // Main entrypoint for file upload handling
  const handleFileUpload = async (files: FileList | null) => {
    if (!files || files.length === 0) return;
    setLastUploadError(null);

    const file = files[0];
    const fileMeta = parseFileName(file.name, configuracion);
    
    if (fileMeta) {
      // Check if a file with the same level, course and year already exists in the store
      const duplicate = archivosCargados.find(a => 
        a.nivel === fileMeta.nivel && 
        a.curso === fileMeta.curso && 
        a.anio === fileMeta.anio
      );
      
      if (duplicate) {
        setDuplicateFileToProcess({ 
          file, 
          existingName: duplicate.nombreArchivo, 
          meta: fileMeta 
        });
        return; // Wait for user decision
      }
    }

    // Process file immediately if no duplicates
    await processSingleFile(file);
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const handleDragLeave = () => {
    setIsDragging(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    handleFileUpload(e.dataTransfer.files);
  };

  // Replaces the existing file
  const handleConfirmReplace = async () => {
    if (duplicateFileToProcess) {
      eliminarArchivo(duplicateFileToProcess.existingName);
      await processSingleFile(duplicateFileToProcess.file);
      setDuplicateFileToProcess(null);
    }
  };

  // Loads as additional file
  const handleConfirmKeepBoth = async () => {
    if (duplicateFileToProcess) {
      await processSingleFile(duplicateFileToProcess.file);
      setDuplicateFileToProcess(null);
    }
  };

  // Actions for expected courses list
  const handleAddExpectedCourse = (e: React.FormEvent) => {
    e.preventDefault();
    const cursoStr = `${newGrado}${newCurso.toUpperCase()}`;
    const expectedList = configuracion.cursosEsperados || [];
    
    // Check if already in list
    const exists = expectedList.some(c => c.nivel === newNivel && c.grado === newGrado && c.curso === cursoStr);
    if (exists) return;

    const updated = [...expectedList, { nivel: newNivel, grado: newGrado, curso: cursoStr }];
    setConfiguracion({ cursosEsperados: updated });
  };

  const handleRemoveExpectedCourse = (nivel: string, grado: number, curso: string) => {
    const expectedList = configuracion.cursosEsperados || [];
    const updated = expectedList.filter(c => !(c.nivel === nivel && c.grado === grado && c.curso === curso));
    setConfiguracion({ cursosEsperados: updated });
  };

  const handleRestoreDefaultCursos = () => {
    const defaultCursosEsperados = [
      { nivel: 'Primaria', grado: 1, curso: '1A' },
      { nivel: 'Primaria', grado: 2, curso: '2A' },
      { nivel: 'Primaria', grado: 3, curso: '3A' },
      { nivel: 'Primaria', grado: 4, curso: '4A' },
      { nivel: 'Primaria', grado: 5, curso: '5A' },
      { nivel: 'Bachillerato', grado: 6, curso: '6A' },
      { nivel: 'Bachillerato', grado: 6, curso: '6B' },
      { nivel: 'Bachillerato', grado: 7, curso: '7A' },
      { nivel: 'Bachillerato', grado: 7, curso: '7B' },
      { nivel: 'Bachillerato', grado: 8, curso: '8A' },
      { nivel: 'Bachillerato', grado: 8, curso: '8B' },
      { nivel: 'Bachillerato', grado: 9, curso: '9A' },
      { nivel: 'Bachillerato', grado: 9, curso: '9B' },
      { nivel: 'Bachillerato', grado: 10, curso: '10A' },
      { nivel: 'Bachillerato', grado: 10, curso: '10B' },
      { nivel: 'Bachillerato', grado: 11, curso: '11A' },
      { nivel: 'Bachillerato', grado: 11, curso: '11B' },
    ] as { nivel: 'Primaria' | 'Bachillerato'; grado: number; curso: string; }[];

    setConfiguracion({ cursosEsperados: defaultCursosEsperados });
  };

  // Calculations for Administration KPIs (Section 6)
  const cursosEsperadosLista = configuracion.cursosEsperados || [];
  const totalCursosEsperados = cursosEsperadosLista.length;

  const totalCursosCargados = useMemo(() => {
    const unique = new Set(archivosCargados.map(a => `${a.nivel}_${a.grado}_${a.curso}`));
    return unique.size;
  }, [archivosCargados]);

  const totalCursosPendientes = Math.max(0, totalCursosEsperados - totalCursosCargados);
  const totalArchivosProcesados = archivosCargados.length;
  const totalAlertasPendientes = alertas.filter(a => a.estado === 'Pendiente').length;

  const ultimaCargaStr = useMemo(() => {
    if (archivosCargados.length === 0) return 'Sin cargas';
    // Sort to find latest
    const sorted = [...archivosCargados].sort((a, b) => b.timestampCarga - a.timestampCarga);
    const latest = sorted[0];
    return `${latest.fechaCarga} ${latest.horaCarga}`;
  }, [archivosCargados]);

  // Comparison list between expected and loaded
  const comparacionCursos = useMemo(() => {
    return cursosEsperadosLista.map(exp => {
      const isLoaded = archivosCargados.some(arc => 
        arc.nivel === exp.nivel && 
        arc.grado === exp.grado && 
        arc.curso === exp.curso
      );
      return {
        ...exp,
        estado: isLoaded ? ('Cargado' as const) : ('Pendiente' as const)
      };
    }).sort((a, b) => {
      if (a.nivel !== b.nivel) return a.nivel === 'Primaria' ? -1 : 1;
      return a.grado - b.grado || a.curso.localeCompare(b.curso);
    });
  }, [cursosEsperadosLista, archivosCargados]);

  const hasFiles = archivosCargados.length > 0;

  const handleForceSync = async () => {
    setIsSyncing(true);
    setSyncMessage(null);
    setLastUploadError(null);
    try {
      const configOk = await pushConfigToServer();
      const dataOk = await pushStateToServer();
      if (dataOk) {
        setSyncMessage(
          `Sincronizado: ${archivosCargados.length} archivos y ${calificaciones.length.toLocaleString()} registros enviados al servidor.`
        );
      } else {
        setLastUploadError('No se pudo sincronizar. Verifique la conexión e intente de nuevo.');
      }
      void configOk;
    } finally {
      setIsSyncing(false);
    }
  };

  return (
    <div id="admin-panel-container" className="space-y-6 max-w-7xl mx-auto">

      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-blue-50 border border-blue-200 rounded-xl px-4 py-3">
        <p className="text-xs text-blue-800 leading-relaxed">
          Los datos de este panel deben guardarse en el servidor para verse en el celular y otros navegadores.
          Si aquí ve <strong>{archivosCargados.length} archivos</strong> y en otro dispositivo menos, pulse sincronizar.
        </p>
        <button
          type="button"
          onClick={handleForceSync}
          disabled={isSyncing || !hasFiles}
          className="inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg bg-[#0D47A1] text-white text-xs font-bold uppercase tracking-wide hover:bg-blue-900 disabled:opacity-50 shrink-0"
        >
          <CloudUpload className={cn('w-4 h-4', isSyncing && 'animate-pulse')} />
          {isSyncing ? 'Sincronizando…' : 'Sincronizar ahora'}
        </button>
      </div>
      {syncMessage && (
        <p className="text-xs text-emerald-700 bg-emerald-50 border border-emerald-200 rounded-lg px-3 py-2">{syncMessage}</p>
      )}
      
      {/* 1. KPIs de Administración */}
      <div id="admin-kpis" className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
        <div className="bg-white p-4 rounded-xl shadow-sm border border-slate-200 flex flex-col justify-center">
          <p className="text-[10px] text-slate-500 font-bold uppercase tracking-widest mb-1">Cursos Esperados</p>
          <h3 className="text-2xl font-bold text-slate-800 font-mono">{totalCursosEsperados}</h3>
        </div>
        <div className="bg-white p-4 rounded-xl shadow-sm border border-emerald-200 bg-emerald-50/20 flex flex-col justify-center">
          <p className="text-[10px] text-emerald-700 font-bold uppercase tracking-widest mb-1">Con Archivo Cargado</p>
          <h3 className="text-2xl font-bold text-emerald-700 font-mono">{totalCursosCargados}</h3>
        </div>
        <div className="bg-white p-4 rounded-xl shadow-sm border border-amber-200 bg-amber-50/20 flex flex-col justify-center">
          <p className="text-[10px] text-amber-700 font-bold uppercase tracking-widest mb-1">Pendientes por Cargar</p>
          <h3 className="text-2xl font-bold text-amber-700 font-mono">{totalCursosPendientes}</h3>
        </div>
        <div className="bg-white p-4 rounded-xl shadow-sm border border-slate-200 flex flex-col justify-center">
          <p className="text-[10px] text-slate-500 font-bold uppercase tracking-widest mb-1">Archivos Procesados</p>
          <h3 className="text-2xl font-bold text-slate-800 font-mono">{totalArchivosProcesados}</h3>
        </div>
        <div className="bg-white p-4 rounded-xl shadow-sm border border-slate-200 flex flex-col justify-center col-span-1">
          <p className="text-[10px] text-slate-500 font-bold uppercase tracking-widest mb-1">Última Carga</p>
          <h3 className="text-xs font-bold text-slate-700 truncate font-mono mt-1">{ultimaCargaStr}</h3>
        </div>
        <div className="bg-white p-4 rounded-xl shadow-sm border border-red-200 bg-red-50/10 flex flex-col justify-center">
          <p className="text-[10px] text-red-600 font-bold uppercase tracking-widest mb-1">Alertas Pendientes</p>
          <h3 className="text-2xl font-bold text-red-600 font-mono">{totalAlertasPendientes}</h3>
        </div>
      </div>

      {/* 2. Middle section: Upload File & Config Expected Courses side-by-side */}
      <div id="admin-middle-section" className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        
        {/* Upload Column (Left, spans 1) */}
        <div className="lg:col-span-1 space-y-4">
          <div className="bg-white p-5 rounded-xl shadow-sm border border-slate-200">
            <h3 className="text-xs font-bold text-slate-800 mb-4 flex items-center gap-2 border-b border-slate-100 pb-2 uppercase tracking-wider">
              <Upload className="w-4 h-4 text-blue-700" />
              Cargar calificaciones
            </h3>
            
            <label 
              className={cn(
                "border border-dashed rounded text-center transition-all cursor-pointer py-10 block",
                isDragging ? "border-blue-500 bg-blue-50" : "border-slate-300 hover:border-blue-400 hover:bg-slate-50"
              )}
              onDragOver={handleDragOver}
              onDragLeave={handleDragLeave}
              onDrop={handleDrop}
            >
              <input 
                type="file" 
                ref={fileInputRef} 
                className="hidden" 
                accept=".xlsx,.xls,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet,application/vnd.ms-excel"
                onChange={(e) => handleFileUpload(e.target.files)}
              />
              <Upload className="w-10 h-10 text-slate-400 mx-auto mb-2 pointer-events-none" />
              <p className="text-xs font-bold text-slate-700 pointer-events-none">Busca un archivo Excel</p>
              <p className="text-[10px] text-slate-400 mt-1 pointer-events-none">o arrástralo aquí</p>
              <p className="text-[9px] text-blue-600 font-bold mt-3 uppercase tracking-wider pointer-events-none font-mono">Format: NIVEL_GRADO_CURSO_AÑO.xlsx</p>
            </label>

            {isProcessing && (
              <div className="mt-4 p-3 bg-blue-50 text-blue-700 rounded text-xs flex items-center gap-2 font-mono">
                <div className="animate-spin rounded-full h-3 w-3 border-2 border-blue-600 border-t-transparent"></div>
                {uploadStatus || 'PROCESANDO...'}
              </div>
            )}

            {lastUploadError && !isProcessing && (
              <div className="mt-4 p-3 bg-red-50 text-red-700 rounded text-xs flex items-start gap-2">
                <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />
                <div>
                  <span className="font-bold uppercase tracking-wider block mb-1">Error de procesamiento</span>
                  {lastUploadError}
                </div>
              </div>
            )}
            
            <div className="mt-6 pt-4 border-t border-slate-100 flex flex-col gap-2">
              <button 
                onClick={clearData}
                className="text-[10px] text-red-600 border border-red-200 px-3 py-2 rounded uppercase font-bold hover:bg-red-50 flex items-center gap-1 w-full justify-center"
              >
                <Trash2 className="w-3.5 h-3.5" /> Borrar todo del sistema
              </button>
            </div>
          </div>
        </div>

        {/* Expected Courses Config (Right, spans 2) */}
        <div className="lg:col-span-2">
          <div className="bg-white p-5 rounded-xl shadow-sm border border-slate-200 h-full flex flex-col justify-between">
            <div>
              <div className="flex items-center justify-between mb-3 border-b border-slate-100 pb-2">
                <h3 className="text-xs font-bold text-slate-800 flex items-center gap-2 uppercase tracking-wider">
                  <CheckCircle className="w-4 h-4 text-emerald-600" />
                  Definición de Cursos Esperados del Año Lectivo
                </h3>
                <button
                  onClick={handleRestoreDefaultCursos}
                  className="text-[10px] text-blue-600 hover:underline font-bold uppercase tracking-wider"
                >
                  Restaurar Estándar
                </button>
              </div>

              {/* Expected List with horizontal badges */}
              <div className="max-h-36 overflow-y-auto border border-slate-100 bg-slate-50/50 rounded p-3 flex flex-wrap gap-1.5">
                {cursosEsperadosLista.length === 0 ? (
                  <p className="text-xs text-slate-400 font-mono p-4 text-center w-full">No se han definido cursos esperados. Haz clic en "Restaurar Estándar" o agrega uno nuevo.</p>
                ) : (
                  cursosEsperadosLista.map((c, idx) => (
                    <span 
                      key={`${c.nivel}-${c.grado}-${c.curso}-${idx}`} 
                      className="inline-flex items-center gap-1 bg-white text-slate-700 border border-slate-200 pl-2 pr-1.5 py-1 rounded text-xs font-mono font-bold"
                    >
                      <span className="text-[9px] text-slate-400 font-normal">{c.nivel.slice(0, 4)}.</span>
                      {c.curso}
                      <button 
                        onClick={() => handleRemoveExpectedCourse(c.nivel, c.grado, c.curso)}
                        className="text-slate-400 hover:text-red-600 ml-0.5"
                        title="Quitar de esperados"
                      >
                        <X className="w-3 h-3" />
                      </button>
                    </span>
                  ))
                )}
              </div>
            </div>

            {/* Quick form to add a course */}
            <form onSubmit={handleAddExpectedCourse} className="mt-4 pt-3 border-t border-slate-100 grid grid-cols-1 sm:grid-cols-4 gap-3 items-end">
              <div>
                <label className="block text-[9px] font-bold text-slate-400 uppercase tracking-widest mb-1">Nivel</label>
                <select
                  value={newNivel}
                  onChange={(e) => {
                    const val = e.target.value as 'Primaria' | 'Bachillerato';
                    setNewNivel(val);
                    if (val === 'Primaria') {
                      setNewGrado(1);
                    } else {
                      setNewGrado(6);
                    }
                  }}
                  className="w-full bg-white border border-slate-200 text-slate-700 text-xs px-2 py-1.5 rounded outline-none font-bold"
                >
                  <option value="Primaria">Primaria</option>
                  <option value="Bachillerato">Bachillerato</option>
                </select>
              </div>
              <div>
                <label className="block text-[9px] font-bold text-slate-400 uppercase tracking-widest mb-1">Grado</label>
                <select
                  value={newGrado}
                  onChange={(e) => setNewGrado(parseInt(e.target.value, 10))}
                  className="w-full bg-white border border-slate-200 text-slate-700 text-xs px-2 py-1.5 rounded outline-none font-bold font-mono"
                >
                  {newNivel === 'Primaria' ? (
                    [1, 2, 3, 4, 5].map(g => <option key={g} value={g}>{g}° Primaria</option>)
                  ) : (
                    [6, 7, 8, 9, 10, 11].map(g => <option key={g} value={g}>{g}° Bachillerato</option>)
                  )}
                </select>
              </div>
              <div>
                <label className="block text-[9px] font-bold text-slate-400 uppercase tracking-widest mb-1">Curso (Letra)</label>
                <select
                  value={newCurso}
                  onChange={(e) => setNewCurso(e.target.value)}
                  className="w-full bg-white border border-slate-200 text-slate-700 text-xs px-2 py-1.5 rounded outline-none font-bold font-mono"
                >
                  <option value="A">A</option>
                  <option value="B">B</option>
                  <option value="C">C</option>
                  <option value="D">D</option>
                </select>
              </div>
              <button
                type="submit"
                className="w-full bg-slate-900 hover:bg-slate-950 text-white font-bold text-xs py-2 rounded transition-colors flex items-center justify-center gap-1"
              >
                <PlusCircle className="w-3.5 h-3.5" /> Agregar Curso
              </button>
            </form>
          </div>
        </div>
      </div>

      {/* 3. Cursos con archivo cargado */}
      <div id="cursos-cargados-seccion" className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
        <div className="p-4 border-b border-slate-200 bg-slate-50">
          <h3 className="text-xs font-bold text-slate-800 uppercase tracking-wider flex items-center gap-2">
            <CheckCircle className="w-4 h-4 text-emerald-600" /> Cursos con archivo cargado ({archivosCargados.length})
          </h3>
          <p className="text-xs text-slate-500 mt-1">
            Archivos Excel procesados actualmente en la base de datos de calificaciones de Villa Campo Analytics.
          </p>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm min-w-[900px]">
            <thead className="bg-slate-100 text-slate-500 font-bold text-[10px] uppercase tracking-widest border-b border-slate-200">
              <tr>
                <th className="px-6 py-3">Nivel / Grado / Curso</th>
                <th className="px-6 py-3">Archivo Cargado</th>
                <th className="px-6 py-3">Año Lectivo</th>
                <th className="px-6 py-3">Período Detectado</th>
                <th className="px-6 py-3">Fecha y Hora de Carga</th>
                <th className="px-6 py-3 text-center">Estado</th>
                <th className="px-6 py-3 text-right">Alertas Pendientes</th>
                <th className="px-6 py-3 text-center">Acciones</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {archivosCargados.length === 0 ? (
                <tr>
                  <td colSpan={8} className="px-6 py-10 text-center text-slate-400 text-xs font-mono">
                    NO SE HAN DETECTADO ARCHIVOS CARGADOS EN EL SISTEMA.
                  </td>
                </tr>
              ) : (
                archivosCargados.map((fileInfo, idx) => {
                  const regs = calificaciones.filter(c => c.archivo === fileInfo.nombreArchivo).length;
                  return (
                    <tr key={fileInfo.idArchivo || `${fileInfo.nombreArchivo || 'file'}-${idx}`} className="hover:bg-slate-50/50 transition-colors">
                      <td className="px-6 py-4 align-middle font-mono font-bold text-slate-800">
                        <span className="text-[10px] text-slate-400 font-normal uppercase block">{fileInfo.nivel}</span>
                        {fileInfo.curso}
                      </td>
                      <td className="px-6 py-4 align-middle text-xs">
                        <div className="flex items-center gap-2">
                          <FileText className="w-4 h-4 text-blue-600 shrink-0" />
                          <span className="font-semibold text-slate-800 truncate max-w-[180px]" title={fileInfo.nombreArchivo}>
                            {fileInfo.nombreArchivo}
                          </span>
                        </div>
                        <span className="text-[10px] text-slate-400 block font-mono mt-0.5">{regs} registros de calificaciones</span>
                      </td>
                      <td className="px-6 py-4 align-middle font-mono font-bold text-slate-600 text-xs">
                        Año {fileInfo.anio}
                      </td>
                      <td className="px-6 py-4 align-middle font-mono text-xs text-center">
                        <span className="bg-blue-50 text-blue-700 px-2 py-0.5 rounded font-bold border border-blue-100">
                          {fileInfo.periodoDetectado}
                        </span>
                      </td>
                      <td className="px-6 py-4 align-middle text-xs text-slate-500 whitespace-nowrap">
                        <span className="font-semibold block text-slate-700">{fileInfo.fechaCarga}</span>
                        <span className="text-[10px] block font-mono mt-0.5">{fileInfo.horaCarga}</span>
                      </td>
                      <td className="px-6 py-4 align-middle text-center">
                        <span className="inline-flex items-center px-2 py-0.5 rounded text-[10px] font-bold bg-green-100 text-green-700 uppercase tracking-wider border border-green-200">
                          {fileInfo.estadoProcesamiento || 'Procesado'}
                        </span>
                      </td>
                      <td className="px-6 py-4 align-middle text-right">
                        {fileInfo.totalAlertasPendientes > 0 ? (
                          <button
                            onClick={() => {
                              if (onNavigate) {
                                // Clear all filters in quality dashboard or let it load
                                onNavigate('calidad');
                              }
                            }}
                            className="inline-flex items-center gap-1 text-red-600 font-bold text-xs bg-red-50 hover:bg-red-100 px-2 py-1 rounded border border-red-100 transition-colors"
                          >
                            <AlertTriangle className="w-3.5 h-3.5" /> {fileInfo.totalAlertasPendientes} alertas
                          </button>
                        ) : (
                          <span className="text-green-500 font-mono text-xs font-bold">Sin alertas</span>
                        )}
                      </td>
                      <td className="px-6 py-4 align-middle text-center">
                        <div className="flex items-center justify-center gap-1.5">
                          {onNavigate && (
                            <button
                              onClick={() => {
                                onNavigate('cursos');
                              }}
                              className="p-1.5 text-slate-500 hover:text-blue-600 hover:bg-blue-50 rounded transition-colors"
                              title="Ver detalles del curso"
                            >
                              <Eye className="w-4 h-4" />
                            </button>
                          )}
                          <button
                            onClick={async () => {
                              // Reemplazar action triggers file explorer directly
                              if (fileInputRef.current) {
                                fileInputRef.current.click();
                              }
                            }}
                            className="p-1.5 text-slate-500 hover:text-amber-600 hover:bg-amber-50 rounded transition-colors"
                            title="Reemplazar archivo de calificaciones"
                          >
                            <RefreshCw className="w-4 h-4" />
                          </button>
                          <button
                            onClick={() => {
                              if (confirm(`¿Estás seguro de que deseas eliminar el archivo "${fileInfo.nombreArchivo}"? Esta acción borrará permanentemente todas sus calificaciones y alertas del sistema.`)) {
                                eliminarArchivo(fileInfo.nombreArchivo);
                                setTimeout(() => {
                                  revalidarDatos();
                                  const currentCalifs = useStore.getState().calificaciones;
                                  const newActivePeriod = detectActivePeriod(currentCalifs);
                                  setPeriodoActivo(newActivePeriod);
                                }, 50);
                              }
                            }}
                            className="p-1.5 text-slate-500 hover:text-red-600 hover:bg-red-50 rounded transition-colors"
                            title="Eliminar archivo"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* 4. Cursos pendientes por cargar */}
      <div id="cursos-pendientes-seccion" className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
        <div className="p-4 border-b border-slate-200 bg-slate-50">
          <h3 className="text-xs font-bold text-slate-800 uppercase tracking-wider flex items-center gap-2">
            <FileWarning className="w-4 h-4 text-amber-500" /> Comparativa de Carga y Cursos Pendientes
          </h3>
          <p className="text-xs text-slate-500 mt-1">
            Visualización en tiempo real de qué cursos esperados ya han sido cargados y cuáles faltan por reportar notas en el año.
          </p>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm min-w-[600px]">
            <thead className="bg-slate-100 text-slate-500 font-bold text-[10px] uppercase tracking-widest border-b border-slate-200">
              <tr>
                <th className="px-6 py-3">Nivel Educativo</th>
                <th className="px-6 py-3">Grado</th>
                <th className="px-6 py-3">Curso Esperado</th>
                <th className="px-6 py-3 text-center">Estado de Carga</th>
                <th className="px-6 py-3 text-center">Acción Directa</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {comparacionCursos.length === 0 ? (
                <tr>
                  <td colSpan={5} className="px-6 py-10 text-center text-slate-400 text-xs">
                    No se han definido cursos esperados en la configuración.
                  </td>
                </tr>
              ) : (
                comparacionCursos.map((c, idx) => (
                  <tr key={`${c.nivel}-${c.grado}-${c.curso}-${idx}`} className="hover:bg-slate-50/50 transition-colors">
                    <td className="px-6 py-3.5 align-middle font-medium text-slate-700">{c.nivel}</td>
                    <td className="px-6 py-3.5 align-middle text-slate-500 font-bold font-mono">{c.grado}°</td>
                    <td className="px-6 py-3.5 align-middle font-mono font-bold text-slate-800 text-sm">
                      Curso {c.curso}
                    </td>
                    <td className="px-6 py-3.5 align-middle text-center">
                      {c.estado === 'Cargado' ? (
                        <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-green-100 text-green-800">
                          <span className="w-2 h-2 rounded-full bg-green-500 animate-pulse"></span>
                          Cargado
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-amber-50 text-amber-700 border border-amber-200">
                          <span className="w-2 h-2 rounded-full bg-amber-400"></span>
                          Pendiente
                        </span>
                      )}
                    </td>
                    <td className="px-6 py-3.5 align-middle text-center">
                      {c.estado === 'Pendiente' ? (
                        <button
                          onClick={() => {
                            if (fileInputRef.current) {
                              fileInputRef.current.click();
                            }
                          }}
                          className="text-xs bg-slate-900 hover:bg-slate-950 text-white font-bold px-3 py-1.5 rounded transition-colors"
                        >
                          Cargar Archivo
                        </button>
                      ) : (
                        <span className="text-slate-400 text-xs font-mono">Completado</span>
                      )}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Duplicate / Replacement Confirmation Dialog (Section 8) */}
      {duplicateFileToProcess && (
        <div className="fixed inset-0 bg-slate-950/65 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-2xl border border-slate-200 max-w-lg w-full overflow-hidden">
            <div className="bg-amber-600 text-white p-5 flex items-start gap-4">
              <div className="p-2 bg-amber-700 rounded-lg shrink-0">
                <AlertTriangle className="w-6 h-6" />
              </div>
              <div>
                <h3 className="text-base font-bold uppercase tracking-wider font-mono">¿Reemplazar archivo de calificaciones?</h3>
                <p className="text-xs text-amber-100 mt-1">
                  Se ha detectado un archivo pre-existente cargado para el curso seleccionado.
                </p>
              </div>
            </div>

            <div className="p-6 space-y-4">
              <p className="text-sm text-slate-600 leading-relaxed">
                Ya existe un archivo cargado en el sistema para el curso <strong className="text-slate-900 font-mono font-bold bg-slate-100 px-1 rounded">{duplicateFileToProcess.meta.curso}</strong> del año <strong className="text-slate-900 font-mono font-bold bg-slate-100 px-1 rounded">{duplicateFileToProcess.meta.anio}</strong> (Nivel: <strong>{duplicateFileToProcess.meta.nivel}</strong>).
              </p>

              <div className="bg-slate-50 border border-slate-200 rounded p-4 space-y-2">
                <div className="flex justify-between items-center text-xs">
                  <span className="text-slate-500">Archivo Nuevo:</span>
                  <span className="font-mono font-bold text-blue-700">{duplicateFileToProcess.file.name}</span>
                </div>
                <div className="flex justify-between items-center text-xs">
                  <span className="text-slate-500">Archivo Existente:</span>
                  <span className="font-mono font-bold text-amber-700">{duplicateFileToProcess.existingName}</span>
                </div>
              </div>

              <div className="text-xs text-slate-500 leading-normal space-y-1 bg-amber-50 p-3 border border-amber-100 rounded">
                <p className="font-bold text-amber-800 uppercase tracking-wider">¿Qué sucede si seleccionas Reemplazar?</p>
                <p>1. Se eliminarán permanentemente todos los registros del archivo anterior.</p>
                <p>2. Se borrarán todas las alertas asociadas.</p>
                <p>3. Se procesará el nuevo archivo y se actualizarán automáticamente las estadísticas y dashboards.</p>
              </div>
            </div>

            <div className="bg-slate-50 px-6 py-4 flex flex-col sm:flex-row gap-2 justify-end border-t border-slate-100">
              <button
                type="button"
                onClick={() => setDuplicateFileToProcess(null)}
                className="bg-white border border-slate-200 text-slate-600 hover:bg-slate-100 font-bold text-xs px-4 py-2.5 rounded transition-colors uppercase tracking-wider"
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={handleConfirmKeepBoth}
                className="bg-blue-100 text-blue-700 hover:bg-blue-200 font-bold text-xs px-4 py-2.5 rounded transition-colors uppercase tracking-wider"
              >
                Cargar como versión adicional
              </button>
              <button
                type="button"
                onClick={handleConfirmReplace}
                className="bg-red-600 hover:bg-red-700 text-white font-bold text-xs px-4 py-2.5 rounded transition-colors uppercase tracking-wider"
              >
                Reemplazar archivo
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
