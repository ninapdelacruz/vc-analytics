import React, { useState } from 'react';
import { useStore } from '../store';
import { Save, Settings, AlertTriangle, Upload, Download, Plus, Trash2, CheckCircle, AlertCircle } from 'lucide-react';
import { NivelDesempeno, OperadorDesempeno, DiccionarioAsignatura, AplicabilidadGrado } from '../types';
import { cn } from '../components/Sidebar';

export const ConfigDashboard: React.FC = () => {
  const { configuracion, setConfiguracion, revalidarDatos } = useStore();
  const [form, setForm] = useState(configuracion);
  const [saved, setSaved] = useState(false);
  const [activeTab, setActiveTab] = useState<'generales' | 'niveles' | 'diccionario' | 'aplicabilidad' | 'centros' | 'exportar'>('generales');

  const handleChange = (field: keyof typeof configuracion, value: any) => {
    setForm({ ...form, [field]: value });
    setSaved(false);
  };

  const handleSave = () => {
    setConfiguracion(form);
    revalidarDatos();
    setSaved(true);
    setTimeout(() => setSaved(false), 3000);
  };

  // NIVELES VALIDATIONS
  const checkNivelesGaps = () => {
    // Basic overlap and gap detection logic
    const sorted = [...form.nivelesDesempeno].sort((a, b) => a.min - b.min);
    const errors: string[] = [];
    if (sorted.length === 0) return errors;

    if (sorted[0].min > form.notaMinima) {
      errors.push(`El límite inferior (${sorted[0].min}) es mayor a la nota mínima (${form.notaMinima}).`);
    }

    for (let i = 0; i < sorted.length - 1; i++) {
      const current = sorted[i];
      const next = sorted[i+1];
      if (current.max > next.min) {
        errors.push(`Los rangos se superpongan entre ${current.nombre} y ${next.nombre}.`);
      } else if (current.max < next.min) {
        errors.push(`Hay un hueco de valores entre ${current.max} y ${next.min}.`);
      }
    }

    const last = sorted[sorted.length - 1];
    if (last.max < form.notaMaxima) {
      errors.push(`El límite superior del último nivel (${last.max}) no alcanza la nota máxima (${form.notaMaxima}).`);
    }

    return errors;
  };

  const gapErrors = checkNivelesGaps();

  return (
    <div className="space-y-6 max-w-6xl mx-auto">
      
      <div className="bg-white p-5 rounded-xl shadow-sm border border-slate-200 flex justify-between items-center">
        <div>
          <h2 className="text-sm font-bold text-slate-800 flex items-center gap-2">
            <Settings className="w-4 h-4 text-blue-700" />
            Configuración Académica
          </h2>
          <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mt-1">Define las reglas de evaluación, promedios y pérdida del año escolar.</p>
        </div>
        <button 
          onClick={handleSave}
          className="bg-blue-600 text-white px-4 py-2 rounded text-xs font-bold uppercase tracking-wider hover:bg-blue-700 transition-colors flex items-center gap-2 shadow-sm"
        >
          <Save className="w-3.5 h-3.5" />
          Guardar Cambios
        </button>
      </div>

      {saved && (
        <div className="bg-green-50 text-green-700 p-3 rounded text-[10px] font-bold uppercase tracking-widest border border-green-200 flex items-center gap-2">
          <CheckCircle className="w-3.5 h-3.5" /> Configuración guardada exitosamente. Los dashboards han sido actualizados.
        </div>
      )}

      {/* TABS */}
      <div className="flex border-b border-slate-200">
        {[
          { id: 'generales', label: 'A. Reglas generales' },
          { id: 'niveles', label: 'B. Niveles de desempeño' },
          { id: 'diccionario', label: 'C. Diccionario de áreas' },
          { id: 'aplicabilidad', label: 'D. Aplicabilidad' },
          { id: 'centros', label: 'E. Centros de interés' },
          { id: 'exportar', label: 'F. Importar / Exportar' },
        ].map(t => (
          <button
            key={t.id}
            onClick={() => setActiveTab(t.id as any)}
            className={cn(
              "px-4 py-3 text-[10px] font-bold uppercase tracking-widest transition-colors",
              activeTab === t.id 
                ? "border-b-2 border-blue-600 text-blue-700 bg-blue-50/50" 
                : "text-slate-500 hover:text-slate-700 hover:bg-slate-50 border-b-2 border-transparent"
            )}
          >
            {t.label}
          </button>
        ))}
      </div>

      <div className="bg-white p-5 rounded-xl shadow-sm border border-slate-200 min-h-[500px]">
        {/* TAB: GENERALES */}
        {activeTab === 'generales' && (
          <div className="space-y-6 max-w-2xl">
            <h3 className="text-sm font-bold text-slate-800 border-b border-slate-100 pb-2">Reglas Generales</h3>
            
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
              <div>
                <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-2">Nota mínima del sistema</label>
                <input 
                  type="number" step="0.1"
                  className="w-full border border-slate-200 bg-slate-50 rounded px-3 py-1.5 text-sm font-mono focus:ring-2 focus:ring-blue-500 outline-none"
                  value={form.notaMinima}
                  onChange={(e) => handleChange('notaMinima', parseFloat(e.target.value) || 0)}
                />
              </div>
              <div>
                <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-2">Nota máxima del sistema</label>
                <input 
                  type="number" step="0.1"
                  className="w-full border border-slate-200 bg-slate-50 rounded px-3 py-1.5 text-sm font-mono focus:ring-2 focus:ring-blue-500 outline-none"
                  value={form.notaMaxima}
                  onChange={(e) => handleChange('notaMaxima', parseFloat(e.target.value) || 10)}
                />
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
              <div>
                <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-2">Nota mínima de aprobación</label>
                <input 
                  type="number" step="0.1"
                  className="w-full border border-slate-200 bg-slate-50 rounded px-3 py-1.5 text-sm font-mono focus:ring-2 focus:ring-blue-500 outline-none"
                  value={form.notaAprobacion}
                  onChange={(e) => handleChange('notaAprobacion', parseFloat(e.target.value) || 6.0)}
                />
              </div>
              <div>
                <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-2">Asignaturas para perder el año</label>
                <input 
                  type="number" 
                  className="w-full border border-slate-200 bg-slate-50 rounded px-3 py-1.5 text-sm font-mono focus:ring-2 focus:ring-blue-500 outline-none"
                  value={form.asignaturasParaPerder}
                  onChange={(e) => handleChange('asignaturasParaPerder', parseInt(e.target.value) || 4)}
                />
              </div>
            </div>
            
            <div>
              <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-2">Cantidad de períodos académicos</label>
              <input 
                type="number" 
                className="w-full border border-slate-200 bg-slate-50 rounded px-3 py-1.5 text-sm font-mono focus:ring-2 focus:ring-blue-500 outline-none"
                value={form.periodos}
                onChange={(e) => handleChange('periodos', parseInt(e.target.value) || 4)}
              />
            </div>

            <div>
              <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-2">Modo de cálculo del promedio institucional</label>
              <select
                className="w-full border border-slate-200 bg-slate-50 rounded px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 outline-none"
                value={form.modoCalculoPromedioInstitucional || 'estudiante'}
                onChange={(e) => handleChange('modoCalculoPromedioInstitucional', e.target.value)}
              >
                <option value="estudiante">Promedio de promedios por estudiante (Recomendado/Default)</option>
                <option value="directo">Promedio directo de notas válidas</option>
                <option value="intensidad">Promedio ponderado por intensidad horaria</option>
                <option value="acumulado">Promedio acumulado de períodos cursados</option>
                <option value="def">Usar DEF (Solo nota definitiva final)</option>
              </select>
              <p className="text-[10px] text-slate-400 mt-1">
                Define cómo se consolidan las notas institucionales para compararse con Power BI.
              </p>
            </div>
          </div>
        )}

        {/* TAB: NIVELES */}
        {activeTab === 'niveles' && (
          <div className="space-y-6">
            <h3 className="text-sm font-bold text-slate-800 border-b border-slate-100 pb-2">Niveles de Desempeño</h3>
            
            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm min-w-[700px]">
                <thead className="bg-slate-50 text-slate-500 font-bold text-[10px] uppercase tracking-widest border-b border-slate-200">
                  <tr>
                    <th className="px-4 py-2">Nivel</th>
                    <th className="px-4 py-2 text-center">Operador Desde</th>
                    <th className="px-4 py-2 text-center">Desde (Nota)</th>
                    <th className="px-4 py-2 text-center">Operador Hasta</th>
                    <th className="px-4 py-2 text-center">Hasta (Nota)</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {form.nivelesDesempeno.map((nivel, index) => (
                    <tr key={index}>
                      <td className="px-4 py-2">
                        <span className={`text-[10px] font-bold uppercase tracking-widest px-2 py-1 rounded ${nivel.color}`}>{nivel.nombre}</span>
                      </td>
                      <td className="px-4 py-2 text-center">
                        <select 
                          className="border border-slate-300 bg-white rounded px-2 py-1 text-xs font-mono outline-none"
                          value={nivel.operadorMin}
                          onChange={(e) => {
                            const newNiveles = [...form.nivelesDesempeno];
                            newNiveles[index].operadorMin = e.target.value as OperadorDesempeno;
                            handleChange('nivelesDesempeno', newNiveles);
                          }}
                        >
                          <option value=">=">{'>='}</option>
                          <option value=">">{'>'}</option>
                        </select>
                      </td>
                      <td className="px-4 py-2 text-center">
                        <input 
                          type="number" step="0.1"
                          className="w-16 border border-slate-300 bg-slate-50 rounded px-2 py-1 text-xs font-mono text-center outline-none"
                          value={nivel.min}
                          onChange={(e) => {
                            const newNiveles = [...form.nivelesDesempeno];
                            newNiveles[index].min = parseFloat(e.target.value) || 0;
                            handleChange('nivelesDesempeno', newNiveles);
                          }}
                        />
                      </td>
                      <td className="px-4 py-2 text-center">
                        <select 
                          className="border border-slate-300 bg-white rounded px-2 py-1 text-xs font-mono outline-none"
                          value={nivel.operadorMax}
                          onChange={(e) => {
                            const newNiveles = [...form.nivelesDesempeno];
                            newNiveles[index].operadorMax = e.target.value as OperadorDesempeno;
                            handleChange('nivelesDesempeno', newNiveles);
                          }}
                        >
                          <option value="<=">{'<='}</option>
                          <option value="<">{'<'}</option>
                        </select>
                      </td>
                      <td className="px-4 py-2 text-center">
                        <input 
                          type="number" step="0.1"
                          className="w-16 border border-slate-300 bg-slate-50 rounded px-2 py-1 text-xs font-mono text-center outline-none"
                          value={nivel.max}
                          onChange={(e) => {
                            const newNiveles = [...form.nivelesDesempeno];
                            newNiveles[index].max = parseFloat(e.target.value) || 0;
                            handleChange('nivelesDesempeno', newNiveles);
                          }}
                        />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {gapErrors.length > 0 && (
              <div className="bg-orange-50 p-4 rounded border border-orange-200">
                <h4 className="text-orange-800 text-xs font-bold uppercase flex items-center gap-2 mb-2">
                  <AlertTriangle className="w-4 h-4" /> Problemas en rangos
                </h4>
                <ul className="list-disc pl-5 text-xs text-orange-700 space-y-1 font-mono">
                  {gapErrors.map((e, i) => <li key={i}>{e}</li>)}
                </ul>
              </div>
            )}
          </div>
        )}

        {/* TAB: DICCIONARIO */}
        {activeTab === 'diccionario' && (
          <div className="space-y-6">
            <div className="flex justify-between items-center border-b border-slate-100 pb-2">
              <h3 className="text-sm font-bold text-slate-800">Diccionario de Áreas y Asignaturas</h3>
              <button 
                onClick={() => {
                  handleChange('diccionarioAreas', [
                    ...form.diccionarioAreas, 
                    { codigoBase: '', nombreAsignatura: '', area: '', tipo: 'Académica', cuentaPerdida: 'SI', observacion: '', activa: true }
                  ]);
                }}
                className="bg-blue-50 text-blue-600 px-3 py-1 rounded flex items-center gap-1 text-xs font-bold hover:bg-blue-100 transition-colors"
              >
                <Plus className="w-4 h-4" /> Agregar Asignatura
              </button>
            </div>
            <div className="h-[400px] overflow-y-auto overflow-x-auto border border-slate-200 rounded">
              <table className="w-full text-left text-sm min-w-[800px]">
                <thead className="bg-slate-50 text-slate-500 font-bold text-[10px] uppercase tracking-widest border-b border-slate-200 sticky top-0 z-10">
                  <tr>
                    <th className="px-4 py-2">Código</th>
                    <th className="px-4 py-2">Asignatura</th>
                    <th className="px-4 py-2">Área</th>
                    <th className="px-4 py-2">Tipo</th>
                    <th className="px-4 py-2 text-center">Pierde Año</th>
                    <th className="px-4 py-2 text-center">Acciones</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {form.diccionarioAreas.map((item, i) => (
                    <tr key={i} className="hover:bg-slate-50">
                      <td className="px-4 py-2">
                        <input 
                          type="text"
                          className="w-full border border-slate-300 bg-white rounded px-2 py-1 text-xs font-mono font-bold text-slate-700 outline-none focus:ring-1 focus:ring-blue-500"
                          value={item.codigoBase}
                          onChange={(e) => {
                            const newArr = [...form.diccionarioAreas];
                            newArr[i].codigoBase = e.target.value;
                            handleChange('diccionarioAreas', newArr);
                          }}
                        />
                      </td>
                      <td className="px-4 py-2">
                        <input 
                          type="text"
                          className="w-full border border-slate-300 bg-white rounded px-2 py-1 text-xs outline-none focus:ring-1 focus:ring-blue-500"
                          value={item.nombreAsignatura}
                          onChange={(e) => {
                            const newArr = [...form.diccionarioAreas];
                            newArr[i].nombreAsignatura = e.target.value;
                            handleChange('diccionarioAreas', newArr);
                          }}
                        />
                      </td>
                      <td className="px-4 py-2">
                        <input 
                          type="text"
                          className="w-full border border-slate-300 bg-white rounded px-2 py-1 text-xs outline-none focus:ring-1 focus:ring-blue-500"
                          value={item.area}
                          onChange={(e) => {
                            const newArr = [...form.diccionarioAreas];
                            newArr[i].area = e.target.value;
                            handleChange('diccionarioAreas', newArr);
                          }}
                        />
                      </td>
                      <td className="px-4 py-2">
                        <select
                          className="w-full border border-slate-300 bg-white rounded px-2 py-1 text-xs outline-none focus:ring-1 focus:ring-blue-500"
                          value={item.tipo}
                          onChange={(e) => {
                            const newArr = [...form.diccionarioAreas];
                            newArr[i].tipo = e.target.value as any;
                            handleChange('diccionarioAreas', newArr);
                          }}
                        >
                          <option value="Académica">Académica</option>
                          <option value="Centro de interés">Centro de interés</option>
                          <option value="Comportamiento">Comportamiento</option>
                          <option value="Complementaria">Complementaria</option>
                          <option value="Básica">Básica</option>
                        </select>
                      </td>
                      <td className="px-4 py-2 text-center">
                        <select
                          className="border border-slate-300 bg-white rounded px-2 py-1 text-xs font-bold outline-none focus:ring-1 focus:ring-blue-500"
                          value={item.cuentaPerdida}
                          onChange={(e) => {
                            const newArr = [...form.diccionarioAreas];
                            newArr[i].cuentaPerdida = e.target.value as any;
                            handleChange('diccionarioAreas', newArr);
                          }}
                        >
                          <option value="SI">SI</option>
                          <option value="NO">NO</option>
                          <option value="SI_CONDICIONAL">SI_CONDICIONAL</option>
                        </select>
                      </td>
                      <td className="px-4 py-2 text-center">
                        <button 
                          onClick={() => {
                            const newArr = [...form.diccionarioAreas];
                            newArr.splice(i, 1);
                            handleChange('diccionarioAreas', newArr);
                          }}
                          className="text-red-400 hover:text-red-600 p-1"
                        >
                          <Trash2 className="w-4 h-4 mx-auto" />
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* TAB: APLICABILIDAD */}
        {activeTab === 'aplicabilidad' && (
          <div className="space-y-6">
            <div className="flex justify-between items-center border-b border-slate-100 pb-2">
              <h3 className="text-sm font-bold text-slate-800">Aplicabilidad por Grado</h3>
              <button 
                onClick={() => {
                  handleChange('aplicabilidad', [
                    ...form.aplicabilidad, 
                    { nivel: 'Bachillerato', gradoClave: '', codigoBase: '', aplica: true, cuentaPerdidaAplicable: true, observacionAplicabilidad: '' }
                  ]);
                }}
                className="bg-blue-50 text-blue-600 px-3 py-1 rounded flex items-center gap-1 text-xs font-bold hover:bg-blue-100 transition-colors"
              >
                <Plus className="w-4 h-4" /> Agregar Regla
              </button>
            </div>
            <div className="h-[400px] overflow-y-auto overflow-x-auto border border-slate-200 rounded">
              <table className="w-full text-left text-sm min-w-[800px]">
                <thead className="bg-slate-50 text-slate-500 font-bold text-[10px] uppercase tracking-widest border-b border-slate-200 sticky top-0 z-10">
                  <tr>
                    <th className="px-4 py-2">Nivel</th>
                    <th className="px-4 py-2">Grado</th>
                    <th className="px-4 py-2">Asignatura (Código)</th>
                    <th className="px-4 py-2 text-center">Aplica</th>
                    <th className="px-4 py-2 text-center">Suma Pérdida</th>
                    <th className="px-4 py-2 text-center">Acciones</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {form.aplicabilidad.map((item, i) => (
                    <tr key={i} className="hover:bg-slate-50">
                      <td className="px-4 py-2">
                        <select
                          className="w-full border border-slate-300 bg-white rounded px-2 py-1 text-xs outline-none focus:ring-1 focus:ring-blue-500"
                          value={item.nivel}
                          onChange={(e) => {
                            const newArr = [...form.aplicabilidad];
                            newArr[i].nivel = e.target.value as any;
                            handleChange('aplicabilidad', newArr);
                          }}
                        >
                          <option value="Primaria">Primaria</option>
                          <option value="Bachillerato">Bachillerato</option>
                          <option value="Todos">Todos</option>
                        </select>
                      </td>
                      <td className="px-4 py-2">
                        <input 
                          type="text"
                          className="w-full border border-slate-300 bg-white rounded px-2 py-1 text-xs font-mono outline-none focus:ring-1 focus:ring-blue-500"
                          value={item.gradoClave}
                          placeholder="e.g. 6, Todos"
                          onChange={(e) => {
                            const newArr = [...form.aplicabilidad];
                            newArr[i].gradoClave = e.target.value;
                            handleChange('aplicabilidad', newArr);
                          }}
                        />
                      </td>
                      <td className="px-4 py-2">
                        <input 
                          type="text"
                          className="w-full border border-slate-300 bg-white rounded px-2 py-1 text-xs font-mono font-bold text-slate-700 outline-none focus:ring-1 focus:ring-blue-500"
                          value={item.codigoBase}
                          onChange={(e) => {
                            const newArr = [...form.aplicabilidad];
                            newArr[i].codigoBase = e.target.value;
                            handleChange('aplicabilidad', newArr);
                          }}
                        />
                      </td>
                      <td className="px-4 py-2 text-center">
                        <input 
                          type="checkbox"
                          className="w-4 h-4 text-blue-600 rounded border-slate-300 focus:ring-blue-500 cursor-pointer"
                          checked={item.aplica}
                          onChange={(e) => {
                            const newArr = [...form.aplicabilidad];
                            newArr[i].aplica = e.target.checked;
                            handleChange('aplicabilidad', newArr);
                          }}
                        />
                      </td>
                      <td className="px-4 py-2 text-center">
                        <input 
                          type="checkbox"
                          className="w-4 h-4 text-blue-600 rounded border-slate-300 focus:ring-blue-500 cursor-pointer"
                          checked={item.cuentaPerdidaAplicable}
                          onChange={(e) => {
                            const newArr = [...form.aplicabilidad];
                            newArr[i].cuentaPerdidaAplicable = e.target.checked;
                            handleChange('aplicabilidad', newArr);
                          }}
                        />
                      </td>
                      <td className="px-4 py-2 text-center">
                        <button 
                          onClick={() => {
                            const newArr = [...form.aplicabilidad];
                            newArr.splice(i, 1);
                            handleChange('aplicabilidad', newArr);
                          }}
                          className="text-red-400 hover:text-red-600 p-1"
                        >
                          <Trash2 className="w-4 h-4 mx-auto" />
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* TAB: CENTROS */}
        {activeTab === 'centros' && (
          <div className="space-y-6 max-w-2xl">
            <h3 className="text-sm font-bold text-slate-800 border-b border-slate-100 pb-2">Centros de Interés</h3>
            <div className="mb-4">
               <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-2">Regla para múltiples centros de interés</label>
               <select 
                  className="w-full border border-slate-200 bg-slate-50 rounded px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 outline-none"
                  value={form.reglaMultiplesCentros}
                  onChange={(e) => handleChange('reglaMultiplesCentros', e.target.value)}
               >
                 <option value="Inconsistencia">Marcar inconsistencia y no contar hasta corregir</option>
                 <option value="Manual">Usar centro activo registrado manualmente</option>
                 <option value="Reciente">Usar centro con nota más reciente</option>
                 <option value="MasPeriodos">Usar centro con mayor cantidad de períodos calificados</option>
                 <option value="DiferentePorPeriodo">Permitir centro diferente por período</option>
               </select>
               <p className="text-[10px] text-slate-400 mt-1">Define qué hacer si un estudiante de Bachillerato tiene notas en más de un centro de interés simultáneamente.</p>
            </div>

            <div className="bg-blue-50 p-4 rounded border border-blue-200">
               <h4 className="text-blue-800 text-xs font-bold uppercase mb-2">Reglas Especiales Integradas</h4>
               <ul className="list-disc pl-5 text-xs text-blue-700 space-y-1">
                 <li>Filosofía y Ciencias Económicas solo aplican en 10° y 11°.</li>
                 <li>Competencias Ciudadanas solo aplica en Primaria.</li>
                 <li>Geometría solo aplica de 6° a 9°.</li>
                 <li>Centros de interés solo aplican en Bachillerato y son multigrado.</li>
                 <li>Comportamiento no cuenta para pérdida de año.</li>
               </ul>
            </div>
          </div>
        )}

        {/* TAB: EXPORTAR */}
        {activeTab === 'exportar' && (
          <div className="space-y-6">
            <h3 className="text-sm font-bold text-slate-800 border-b border-slate-100 pb-2">Importar / Exportar Configuración</h3>
            <div className="flex gap-4">
              <button 
                onClick={() => {
                  const dataStr = JSON.stringify(configuracion, null, 2);
                  const blob = new Blob([dataStr], { type: 'application/json' });
                  const url = URL.createObjectURL(blob);
                  const link = document.createElement('a');
                  link.download = 'configuracion_academica.json';
                  link.href = url;
                  link.click();
                }}
                className="flex-1 bg-white border border-slate-200 rounded p-6 text-center hover:bg-slate-50 hover:border-blue-300 hover:text-blue-700 transition-colors group"
              >
                <Download className="w-8 h-8 text-slate-400 mx-auto mb-2 group-hover:text-blue-500 transition-colors" />
                <h4 className="text-sm font-bold text-slate-700 group-hover:text-blue-700">Exportar (JSON)</h4>
                <p className="text-[10px] text-slate-500 mt-1 uppercase tracking-widest">Descargar archivo de configuración</p>
              </button>
              
              <label className="flex-1 bg-white border border-slate-200 rounded p-6 text-center hover:bg-slate-50 hover:border-blue-300 hover:text-blue-700 transition-colors cursor-pointer group">
                <input 
                  type="file" 
                  accept=".json,application/json" 
                  className="hidden" 
                  onChange={(e) => {
                    const file = e.target.files?.[0];
                    if (!file) return;
                    const reader = new FileReader();
                    reader.onload = (event) => {
                      try {
                        const json = JSON.parse(event.target?.result as string);
                        setConfiguracion(json);
                        setForm(json);
                        revalidarDatos();
                        setSaved(true);
                        setTimeout(() => setSaved(false), 3000);
                      } catch (error) {
                        alert("El archivo no tiene el formato JSON correcto o la estructura es inválida.");
                      }
                    };
                    reader.readAsText(file);
                    e.target.value = '';
                  }} 
                />
                <Upload className="w-8 h-8 text-slate-400 mx-auto mb-2 group-hover:text-blue-500 transition-colors" />
                <h4 className="text-sm font-bold text-slate-700 group-hover:text-blue-700">Importar (JSON)</h4>
                <p className="text-[10px] text-slate-500 mt-1 uppercase tracking-widest">Cargar archivo de configuración</p>
              </label>
            </div>
            <p className="text-xs text-slate-400 text-center font-mono mt-4">Importar una configuración recalculará automáticamente el riesgo de todos los estudiantes.</p>
          </div>
        )}

      </div>
      
      {/* Auto Analysis Text */}
      <div className="bg-slate-800 border border-slate-700 p-5 rounded-xl flex gap-4 items-start shadow-inner mt-4">
        <div className="p-2 bg-slate-700 text-slate-300 rounded shrink-0">
          <AlertCircle className="w-4 h-4" />
        </div>
        <div>
          <h4 className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-2">Análisis Automático Generado</h4>
          <p className="text-sm text-slate-300 leading-relaxed font-mono">
            LA CONFIGURACIÓN ACTUAL ESTABLECE LA NOTA DE APROBACIÓN EN <strong className="text-white bg-slate-700 px-1 rounded">{configuracion.notaAprobacion}</strong> Y EL CRITERIO DE PÉRDIDA DE AÑO EN <strong className="text-red-400 bg-red-900/30 px-1 rounded">{configuracion.asignaturasParaPerder} ASIGNATURAS PERDIDAS</strong>. 
            EL DICCIONARIO CUENTA CON <strong className="text-white bg-slate-700 px-1 rounded">{configuracion.diccionarioAreas.length} ASIGNATURAS REGISTRADAS</strong> Y SE HAN CONFIGURADO <strong className="text-white bg-slate-700 px-1 rounded">{configuracion.aplicabilidad.length} REGLAS DE APLICABILIDAD</strong> POR GRADO. 
            CUALQUIER MODIFICACIÓN RECALCULARÁ AUTOMÁTICAMENTE EL NIVEL DE RIESGO DE LOS ESTUDIANTES.
          </p>
        </div>
      </div>
    </div>
  );
};
