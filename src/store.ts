import { create } from 'zustand';
import { persist, createJSONStorage, StateStorage } from 'zustand/middleware';
import { get, set, del } from 'idb-keyval';
import { SeedData, ConfiguracionAcademica, CalificacionNormalizada, AlertaCalidad, Intervencion, DiccionarioAsignatura, AplicabilidadGrado } from './types';
import { normalizarTipoAsignatura, crearClaveEstudiante } from './utils/calculations';

// Custom IDB storage
const idbStorage: StateStorage = {
  getItem: async (name: string): Promise<string | null> => {
    return (await get(name)) || null;
  },
  setItem: async (name: string, value: string): Promise<void> => {
    await set(name, value);
  },
  removeItem: async (name: string): Promise<void> => {
    await del(name);
  },
};

const TIPOS_ALERTA_ESTRUCTURAL = [
  'Error de lectura',
  'Archivo sin registros',
  'Nombre de archivo inválido',
  'Estructura incorrecta',
];

const claveAlerta = (a: AlertaCalidad) =>
  `${a.tipo}|${a.archivo}|${a.curso || ''}|${a.estudiante || ''}|${a.codigoAsignatura || ''}|${a.periodo || ''}`;

const deduplicarAlertas = (alertas: AlertaCalidad[]): AlertaCalidad[] => {
  const seen = new Set<string>();
  return alertas.filter(a => {
    const key = claveAlerta(a);
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
};
const defaultDiccionario: DiccionarioAsignatura[] = [
  { codigoBase: 'MATEM', nombreAsignatura: 'Matemáticas', area: 'Matemáticas', tipo: 'Académica', cuentaPerdida: 'SI', observacion: 'Área obligatoria.', activa: true },
  { codigoBase: 'ESTAD', nombreAsignatura: 'Estadística', area: 'Estadística', tipo: 'Académica', cuentaPerdida: 'SI', observacion: 'Área obligatoria.', activa: true },
  { codigoBase: 'GEOME', nombreAsignatura: 'Geometría', area: 'Geometría', tipo: 'Académica', cuentaPerdida: 'SI', observacion: 'Aplica según tabla de aplicabilidad.', activa: true },
  { codigoBase: 'LENGU', nombreAsignatura: 'Lenguaje', area: 'Lenguaje', tipo: 'Académica', cuentaPerdida: 'SI', observacion: 'Área obligatoria.', activa: true },
  { codigoBase: 'NATUR', nombreAsignatura: 'Ciencias Naturales', area: 'Naturales', tipo: 'Académica', cuentaPerdida: 'SI', observacion: 'Área obligatoria.', activa: true },
  { codigoBase: 'QUIMI', nombreAsignatura: 'Química', area: 'Química', tipo: 'Académica', cuentaPerdida: 'SI', observacion: 'Área obligatoria o según grado.', activa: true },
  { codigoBase: 'FISIC', nombreAsignatura: 'Física', area: 'Física', tipo: 'Académica', cuentaPerdida: 'SI', observacion: 'Área obligatoria o según grado.', activa: true },
  { codigoBase: 'SOCIA', nombreAsignatura: 'Ciencias Sociales', area: 'Sociales', tipo: 'Académica', cuentaPerdida: 'SI', observacion: 'Área obligatoria.', activa: true },
  { codigoBase: 'INGLE', nombreAsignatura: 'Inglés', area: 'Inglés', tipo: 'Académica', cuentaPerdida: 'SI', observacion: 'Área obligatoria.', activa: true },
  { codigoBase: 'RELIG', nombreAsignatura: 'Religión', area: 'Religión', tipo: 'Académica', cuentaPerdida: 'SI', observacion: 'Área obligatoria.', activa: true },
  { codigoBase: 'EDUFI', nombreAsignatura: 'Educación Física', area: 'Educación Física', tipo: 'Académica', cuentaPerdida: 'SI', observacion: 'Área obligatoria.', activa: true },
  { codigoBase: 'ARTIS', nombreAsignatura: 'Artística', area: 'Artística', tipo: 'Académica', cuentaPerdida: 'SI', observacion: 'Área obligatoria.', activa: true },
  { codigoBase: 'INFOR', nombreAsignatura: 'Informática', area: 'Informática', tipo: 'Académica', cuentaPerdida: 'SI', observacion: 'Área obligatoria.', activa: true },
  { codigoBase: 'ETICA', nombreAsignatura: 'Ética', area: 'Ética', tipo: 'Académica', cuentaPerdida: 'SI', observacion: 'Área obligatoria.', activa: true },
  { codigoBase: 'FILOS', nombreAsignatura: 'Filosofía', area: 'Filosofía', tipo: 'Académica', cuentaPerdida: 'SI', observacion: 'Aplica solo en 10° y 11°.', activa: true },
  { codigoBase: 'CECNO', nombreAsignatura: 'Ciencias Económicas', area: 'Ciencias Económicas', tipo: 'Académica', cuentaPerdida: 'SI', observacion: 'Aplica solo en 10° y 11°.', activa: true },
  { codigoBase: 'CIUDA', nombreAsignatura: 'Competencias Ciudadanas', area: 'Competencias Ciudadanas', tipo: 'Académica', cuentaPerdida: 'SI', observacion: 'Aplica solo en Primaria.', activa: true },
  { codigoBase: 'COMPO', nombreAsignatura: 'Comportamiento', area: 'Convivencia', tipo: 'Comportamiento', cuentaPerdida: 'NO', observacion: 'No suma como pérdida académica.', activa: true },
  { codigoBase: 'EDUM', nombreAsignatura: 'Música', area: 'Centro de interés', tipo: 'Centro de interés', cuentaPerdida: 'SI_CONDICIONAL', observacion: 'Cuenta como pérdida solo en Bachillerato si tiene nota válida y corresponde al centro activo.', activa: true },
  { codigoBase: 'EDUMU', nombreAsignatura: 'Música', area: 'Centros de interés', tipo: 'Centro de interés', cuentaPerdida: 'SI_CONDICIONAL', observacion: 'Cuenta como pérdida solo en Bachillerato si tiene nota válida y corresponde al centro activo.', activa: true },
  { codigoBase: 'ECOLM', nombreAsignatura: 'Medio Ambiente', area: 'Centro de interés', tipo: 'Centro de interés', cuentaPerdida: 'SI_CONDICIONAL', observacion: 'Cuenta como pérdida solo en Bachillerato si tiene nota válida y corresponde al centro activo.', activa: true },
  { codigoBase: 'PROCS', nombreAsignatura: 'Comunicaciones', area: 'Centro de interés', tipo: 'Centro de interés', cuentaPerdida: 'SI_CONDICIONAL', observacion: 'Cuenta como pérdida solo en Bachillerato si tiene nota válida y corresponde al centro activo.', activa: true },
  { codigoBase: 'FORDE', nombreAsignatura: 'Deportes', area: 'Centro de interés', tipo: 'Centro de interés', cuentaPerdida: 'SI_CONDICIONAL', observacion: 'Cuenta como pérdida solo en Bachillerato si tiene nota válida y corresponde al centro activo.', activa: true },
  { codigoBase: 'DANFO', nombreAsignatura: 'Danza', area: 'Centro de interés', tipo: 'Centro de interés', cuentaPerdida: 'SI_CONDICIONAL', observacion: 'Cuenta como pérdida solo en Bachillerato si tiene nota válida y corresponde al centro activo.', activa: true },
  { codigoBase: 'EXPAR', nombreAsignatura: 'Artística C.I.', area: 'Centro de interés', tipo: 'Centro de interés', cuentaPerdida: 'SI_CONDICIONAL', observacion: 'Cuenta como pérdida solo en Bachillerato si tiene nota válida y corresponde al centro activo.', activa: true },
  { codigoBase: 'EDECE', nombreAsignatura: 'Emprendimiento', area: 'Centro de interés', tipo: 'Centro de interés', cuentaPerdida: 'SI_CONDICIONAL', observacion: 'Cuenta como pérdida solo en Bachillerato si tiene nota válida y corresponde al centro activo.', activa: true },
  { codigoBase: 'LIDC', nombreAsignatura: 'Liderazgo', area: 'Centro de interés', tipo: 'Centro de interés', cuentaPerdida: 'SI_CONDICIONAL', observacion: 'Cuenta como pérdida solo en Bachillerato si tiene nota válida y corresponde al centro activo.', activa: true },
  { codigoBase: 'LIDCI', nombreAsignatura: 'Liderazgo', area: 'Centros de interés', tipo: 'Centro de interés', cuentaPerdida: 'SI_CONDICIONAL', observacion: 'Cuenta como pérdida solo en Bachillerato si tiene nota válida y corresponde al centro activo.', activa: true },
  { codigoBase: 'GESTR', nombreAsignatura: 'Brigada', area: 'Centro de interés', tipo: 'Centro de interés', cuentaPerdida: 'SI_CONDICIONAL', observacion: 'Cuenta como pérdida solo en Bachillerato si tiene nota válida y corresponde al centro activo.', activa: true },
  { codigoBase: 'SEGIN', nombreAsignatura: 'Inglés C.I.', area: 'Centro de interés', tipo: 'Centro de interés', cuentaPerdida: 'SI_CONDICIONAL', observacion: 'Cuenta como pérdida solo en Bachillerato si tiene nota válida y corresponde al centro activo.', activa: true },
  { codigoBase: 'PROGR', nombreAsignatura: 'Programación', area: 'Centro de interés', tipo: 'Centro de interés', cuentaPerdida: 'SI_CONDICIONAL', observacion: 'Cuenta como pérdida solo en Bachillerato si tiene nota válida y corresponde al centro activo.', activa: true },
  { codigoBase: 'ROBOT', nombreAsignatura: 'Robótica', area: 'Centro de interés', tipo: 'Centro de interés', cuentaPerdida: 'SI_CONDICIONAL', observacion: 'Cuenta como pérdida solo en Bachillerato si tiene nota válida y corresponde al centro activo.', activa: true },
];

const defaultAplicabilidad: AplicabilidadGrado[] = [
  { nivel: 'Bachillerato', gradoClave: '10', codigoBase: 'FILOS', aplica: true, cuentaPerdidaAplicable: true, observacionAplicabilidad: 'Aplica en 10 y 11' },
  { nivel: 'Bachillerato', gradoClave: '11', codigoBase: 'FILOS', aplica: true, cuentaPerdidaAplicable: true, observacionAplicabilidad: 'Aplica en 10 y 11' },
  { nivel: 'Bachillerato', gradoClave: '10', codigoBase: 'CECNO', aplica: true, cuentaPerdidaAplicable: true, observacionAplicabilidad: 'Aplica en 10 y 11' },
  { nivel: 'Bachillerato', gradoClave: '11', codigoBase: 'CECNO', aplica: true, cuentaPerdidaAplicable: true, observacionAplicabilidad: 'Aplica en 10 y 11' },
  { nivel: 'Primaria', gradoClave: 'Todos', codigoBase: 'CIUDA', aplica: true, cuentaPerdidaAplicable: true, observacionAplicabilidad: 'Aplica en Primaria' },
  { nivel: 'Bachillerato', gradoClave: '6', codigoBase: 'GEOME', aplica: true, cuentaPerdidaAplicable: true, observacionAplicabilidad: 'Aplica de 6 a 9' },
  { nivel: 'Bachillerato', gradoClave: '7', codigoBase: 'GEOME', aplica: true, cuentaPerdidaAplicable: true, observacionAplicabilidad: 'Aplica de 6 a 9' },
  { nivel: 'Bachillerato', gradoClave: '8', codigoBase: 'GEOME', aplica: true, cuentaPerdidaAplicable: true, observacionAplicabilidad: 'Aplica de 6 a 9' },
  { nivel: 'Bachillerato', gradoClave: '9', codigoBase: 'GEOME', aplica: true, cuentaPerdidaAplicable: true, observacionAplicabilidad: 'Aplica de 6 a 9' },
];

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

const defaultConfiguracion: ConfiguracionAcademica = {
  periodos: 4,
  pesosPeriodos: [25, 25, 25, 25],
  notaMinima: 1.0,
  notaMaxima: 10.0,
  notaAprobacion: 6.0,
  asignaturasParaPerder: 4,
  nivelesDesempeno: [
    { nombre: 'Bajo', min: 1.0, operadorMin: '>=', max: 6.0, operadorMax: '<', color: 'text-red-600 bg-red-100' },
    { nombre: 'Básico', min: 6.0, operadorMin: '>=', max: 8.0, operadorMax: '<', color: 'text-yellow-600 bg-yellow-100' },
    { nombre: 'Alto', min: 8.0, operadorMin: '>=', max: 9.0, operadorMax: '<', color: 'text-green-600 bg-green-100' },
    { nombre: 'Superior', min: 9.0, operadorMin: '>=', max: 10.0, operadorMax: '<=', color: 'text-emerald-700 bg-emerald-100' },
  ],
  diccionarioAreas: defaultDiccionario,
  aplicabilidad: defaultAplicabilidad,
  reglaMultiplesCentros: 'Inconsistencia',
  usaDefinitivaArchivo: false,
  mapeoCursos: {
    '01': 'A',
    '02': 'B',
    '03': 'C',
  },
  modoCalculoPromedioInstitucional: 'estudiante',
  cursosEsperados: defaultCursosEsperados,
};

interface AppState extends SeedData {
  setConfiguracion: (config: Partial<ConfiguracionAcademica>) => void;
  setCalificaciones: (calificaciones: CalificacionNormalizada[]) => void;
  addCalificaciones: (calificaciones: CalificacionNormalizada[], archivo: string, infoAdicional: any, nuevasAlertas?: AlertaCalidad[]) => void;
  eliminarArchivo: (nombreArchivo: string) => void;
  clearData: () => void;
  setPeriodoActivo: (periodo: SeedData['periodoActivo']) => void;
  setAlertas: (alertas: AlertaCalidad[]) => void;
  addIntervencion: (intervencion: Intervencion) => void;
  updateIntervencion: (id: string, intervencion: Partial<Intervencion>) => void;
  revalidarDatos: () => void;
  modoDemo: boolean;
  setModoDemo: (val: boolean) => void;
}

export const useStore = create<AppState>()(
  persist(
    (set, get) => ({
      configuracion: defaultConfiguracion,
      calificaciones: [],
      alertas: [],
      intervenciones: [],
      archivosCargados: [],
      periodoActivo: 'P1',
      modoDemo: false,

      setConfiguracion: (config) =>
        set((state) => ({
          configuracion: { ...state.configuracion, ...config },
        })),

      setCalificaciones: (calificaciones) => set({ calificaciones }),

      addCalificaciones: (nuevasCalificaciones, archivo, infoAdicional, nuevasAlertas = []) =>
        set((state) => {
          const { nivel, gradoNum, curso, anio, totalRegistros, periodoDetectado } = infoAdicional;
          
          const date = new Date();
          const day = String(date.getDate()).padStart(2, '0');
          const month = String(date.getMonth() + 1).padStart(2, '0');
          const year = date.getFullYear();
          let hours = date.getHours();
          const minutes = String(date.getMinutes()).padStart(2, '0');
          const ampm = hours >= 12 ? 'p.m.' : 'a.m.';
          hours = hours % 12;
          hours = hours ? hours : 12;
          const strTime = `${String(hours).padStart(2, '0')}:${minutes} ${ampm}`;

          const nuevoArchivo = {
            idArchivo: crypto.randomUUID(),
            nombreArchivo: archivo,
            nombre: archivo, // backward compatibility
            nivel,
            grado: gradoNum,
            curso,
            anio,
            periodoDetectado,
            fechaCarga: `${day}/${month}/${year}`,
            horaCarga: strTime,
            timestampCarga: date.getTime(),
            estadoProcesamiento: 'Procesado' as const,
            totalRegistros,
            totalAlertasPendientes: 0
          };

          const filtradas = state.calificaciones.filter(c => c.archivo !== archivo);
          const archivosFiltrados = state.archivosCargados.filter(a => a.nombreArchivo !== archivo);
          const alertasExistentes = state.alertas.filter(a => a.archivo !== archivo);
          
          return {
            calificaciones: [...filtradas, ...nuevasCalificaciones],
            archivosCargados: [...archivosFiltrados, nuevoArchivo],
            alertas: [...alertasExistentes, ...nuevasAlertas]
          };
        }),

      eliminarArchivo: (nombreArchivo) =>
        set((state) => {
          const calificacionesFiltradas = state.calificaciones.filter(c => c.archivo !== nombreArchivo);
          const archivosFiltrados = state.archivosCargados.filter(a => a.nombreArchivo !== nombreArchivo);
          const alertasFiltradas = state.alertas.filter(a => a.archivo !== nombreArchivo);
          return {
            calificaciones: calificacionesFiltradas,
            archivosCargados: archivosFiltrados,
            alertas: alertasFiltradas
          };
        }),

      clearData: () => set({ calificaciones: [], alertas: [], intervenciones: [], archivosCargados: [], periodoActivo: 'P1' }),

      setPeriodoActivo: (periodo) => set({ periodoActivo: periodo }),

      setAlertas: (alertas) => set({ alertas }),

      addIntervencion: (intervencion) =>
        set((state) => ({ intervenciones: [...state.intervenciones, intervencion] })),

      updateIntervencion: (id, intervencionUpdate) =>
        set((state) => ({
          intervenciones: state.intervenciones.map((i) =>
            i.id === id ? { ...i, ...intervencionUpdate } : i
          ),
        })),

      setModoDemo: (modoDemo) => set({ modoDemo }),

      revalidarDatos: () => {
        set((state) => {
          const { configuracion, calificaciones } = state;
          const nuevasCalificaciones: CalificacionNormalizada[] = [];
          const nuevasAlertas: AlertaCalidad[] = [];

          // Preserve parser alerts and structural alerts that should not be regenerated
          const existingParserAlerts = state.alertas.filter(a =>
            a.origen === 'parser' ||
            (a.origen === undefined && TIPOS_ALERTA_ESTRUCTURAL.includes(a.tipo))
          );
          nuevasAlertas.push(...existingParserAlerts);

          const agregarAlerta = (alerta: AlertaCalidad) => {
            const withOrigen = { ...alerta, origen: alerta.origen || 'revalidacion' as const };
            const key = claveAlerta(withOrigen);
            if (!nuevasAlertas.some(a => claveAlerta(a) === key)) {
              nuevasAlertas.push(withOrigen);
            }
          };

          if (calificaciones.length === 0) {
            return {
              calificaciones: [],
              alertas: [],
              archivosCargados: state.archivosCargados.map(f => ({ ...f, totalAlertasPendientes: 0 }))
            };
          }

          // Group by student to check multiple interest centers
          const studentGradesMap = new Map<string, CalificacionNormalizada[]>();

          for (const c of calificaciones) {
            const mod: CalificacionNormalizada = { ...c };

            // 1. Dictionary Check
            const dictEntry = configuracion.diccionarioAreas.find(d => d.codigoBase === c.codigoAsignatura);
            if (dictEntry) {
              mod.nombreAsignatura = dictEntry.nombreAsignatura;
              mod.tipoAsignatura = dictEntry.tipo;
              mod.cuentaParaPerdida = dictEntry.cuentaPerdida === 'SI' || dictEntry.cuentaPerdida === 'SI_CONDICIONAL';
            } else {
              mod.tipoAsignatura = 'Académica';
              mod.cuentaParaPerdida = true;
              
              const alreadyHasAlert = nuevasAlertas.some(a => 
                a.tipo === 'Código de asignatura desconocido' && 
                a.archivo === mod.archivo && 
                a.curso === mod.curso &&
                a.codigoAsignatura === mod.codigoAsignatura
              );
              if (!alreadyHasAlert) {
                agregarAlerta({
                  id: crypto.randomUUID(),
                  gravedad: 'Alta',
                  tipo: 'Código de asignatura desconocido',
                  archivo: mod.archivo,
                  curso: mod.curso,
                  estudiante: mod.estudianteNombre,
                  codigoAsignatura: mod.codigoAsignatura,
                  descripcion: `El código "${mod.codigoAsignatura}" no está registrado en el diccionario.`,
                  accionSugerida: 'Agregar el código al diccionario.',
                  estado: 'Pendiente'
                });
              }
            }

            mod.tipoAsignatura = normalizarTipoAsignatura(mod.tipoAsignatura);

            // 2. Applicability
            let aplica = true;
            if (mod.nivel === 'Primaria' && mod.tipoAsignatura === 'Centro de interés') {
              aplica = false;
              mod.cuentaParaPerdida = false;
              const alreadyHasAlert = nuevasAlertas.some(a => 
                a.tipo === 'Centro de interés en Primaria' && 
                a.archivo === mod.archivo && 
                a.curso === mod.curso &&
                a.codigoAsignatura === mod.codigoAsignatura &&
                a.grado === mod.grado.toString()
              );
              if (!alreadyHasAlert) {
                agregarAlerta({
                  id: crypto.randomUUID(),
                  gravedad: 'Media',
                  tipo: 'Centro de interés en Primaria',
                  archivo: mod.archivo,
                  nivel: mod.nivel,
                  grado: mod.grado.toString(),
                  curso: mod.curso,
                  nombreAsignatura: mod.nombreAsignatura,
                  codigoAsignatura: mod.codigoAsignatura,
                  descripcion: `Los centros de interés (${mod.nombreAsignatura}) no aplican para Primaria según la regla de negocio.`,
                  accionSugerida: 'Verificar la configuración o ignorar si es correcto.',
                  estado: 'Pendiente'
                });
              }
            } else {
              const appRules = configuracion.aplicabilidad.filter(r => r.codigoBase === mod.codigoAsignatura);
              if (appRules.length > 0) {
                const rule = appRules.find(r => (r.nivel === mod.nivel || r.nivel === 'Todos' as any) && (r.gradoClave === mod.grado.toString() || r.gradoClave === 'Todos'));
                if (rule) {
                  aplica = rule.aplica;
                  if (!aplica) mod.cuentaParaPerdida = false;
                } else {
                  const generalRule = appRules.find(r => r.gradoClave === 'Todos');
                  if (generalRule) {
                    aplica = generalRule.aplica;
                    if (!aplica) mod.cuentaParaPerdida = false;
                  } else {
                    aplica = false;
                    mod.cuentaParaPerdida = false;
                  }
                }
              }
            }

            mod.aplica = aplica;

            if (!aplica && !(mod.nivel === 'Primaria' && mod.tipoAsignatura === 'Centro de interés')) {
              const alreadyHasAlert = nuevasAlertas.some(a => 
                a.tipo === 'Asignatura no aplicable' && 
                a.archivo === mod.archivo && 
                a.curso === mod.curso &&
                a.grado === mod.grado.toString() &&
                a.codigoAsignatura === mod.codigoAsignatura
              );
              if (!alreadyHasAlert) {
                agregarAlerta({
                  id: crypto.randomUUID(),
                  gravedad: 'Informativa',
                  tipo: 'Asignatura no aplicable',
                  archivo: mod.archivo,
                  nivel: mod.nivel,
                  grado: mod.grado.toString(),
                  curso: mod.curso,
                  nombreAsignatura: mod.nombreAsignatura,
                  codigoAsignatura: mod.codigoAsignatura,
                  descripcion: `La asignatura ${mod.nombreAsignatura} (${mod.codigoAsignatura}) no aplica para grado ${mod.grado}.`,
                  accionSugerida: 'Revisar la configuración de aplicabilidad.',
                  estado: 'Pendiente'
                });
              }
            }

            // 3. Behavior Rule
            if (mod.codigoAsignatura === 'COMPO') {
              mod.cuentaParaPerdida = false;
            }

            // 4. Ranges Check
            if (typeof mod.nota === 'number') {
              if (mod.nota < configuracion.notaMinima || mod.nota > configuracion.notaMaxima) {
                agregarAlerta({
                  id: crypto.randomUUID(),
                  gravedad: 'Crítica',
                  tipo: 'Nota fuera de rango',
                  archivo: mod.archivo,
                  curso: mod.curso,
                  estudiante: mod.estudianteNombre,
                  codigoAsignatura: mod.codigoAsignatura,
                  periodo: mod.periodo,
                  nombreAsignatura: mod.nombreAsignatura,
                  descripcion: `La nota ${mod.nota} en ${mod.periodo} excede el rango permitido (${configuracion.notaMinima} - ${configuracion.notaMaxima}) para ${mod.estudianteNombre}.`,
                  accionSugerida: 'Corregir en el archivo Excel origen.',
                  estado: 'Pendiente'
                });
              }
            }

            nuevasCalificaciones.push(mod);

            const studKey = crearClaveEstudiante(mod);
            if (!studentGradesMap.has(studKey)) {
              studentGradesMap.set(studKey, []);
            }
            studentGradesMap.get(studKey)!.push(mod);
          }

          // 5. Duplicate student check
          const studentSubjectKeys = new Set<string>();
          const duplicateStudentKeys = new Set<string>();
          for (const c of nuevasCalificaciones) {
            const key = `${crearClaveEstudiante(c)}_${c.codigoAsignatura}_${c.periodo}`;
            if (studentSubjectKeys.has(key)) {
              duplicateStudentKeys.add(crearClaveEstudiante(c));
            } else {
              studentSubjectKeys.add(key);
            }
          }
          for (const studKey of duplicateStudentKeys) {
            const sample = nuevasCalificaciones.find(c => crearClaveEstudiante(c) === studKey);
            if (!sample) continue;
            agregarAlerta({
              id: crypto.randomUUID(),
              gravedad: 'Media',
              tipo: 'Estudiante duplicado',
              archivo: sample.archivo,
              curso: sample.curso,
              estudiante: sample.estudianteNombre,
              descripcion: `El estudiante "${sample.estudianteNombre}" tiene registros duplicados en el archivo.`,
              accionSugerida: 'Revisar el archivo Excel para remover filas duplicadas.',
              estado: 'Pendiente'
            });
          }

          // 6. Centros de interés inconsistentes y no activos
          for (const [, grades] of studentGradesMap.entries()) {
            const firstGrade = grades[0];
            if (!firstGrade) continue;
            const archivo = firstGrade.archivo;
            const estudiante = firstGrade.estudianteNombre;
            const periods = ['P1', 'P2', 'P3', 'P4'];
            
            // Determinar centro activo (regla P2)
            const p2CIGrades = grades.filter(c => 
              c.tipoAsignatura === 'Centro de interés' && 
              c.periodo === 'P2' && 
              c.nota !== null && typeof c.nota === 'number'
            );
            const activeP2Codes = Array.from(new Set(p2CIGrades.map(c => c.codigoAsignatura)));
            
            for (const per of periods) {
              const ciGrades = grades.filter(c => 
                c.tipoAsignatura === 'Centro de interés' && 
                c.periodo === per && 
                c.nota !== null && 
                c.nota !== undefined && 
                c.nota !== ''
              );
              const uniqueCodes = Array.from(new Set(ciGrades.map(c => c.codigoAsignatura)));
              if (uniqueCodes.length > 1) {
                agregarAlerta({
                  id: crypto.randomUUID(),
                  gravedad: 'Alta',
                  tipo: 'Centros de interés inconsistentes',
                  archivo,
                  curso: grades[0].curso,
                  estudiante,
                  periodo: per,
                  descripcion: `El estudiante "${estudiante}" tiene múltiples centros de interés con notas registradas en el período ${per}: ${uniqueCodes.join(', ')}.`,
                  accionSugerida: 'Verificar el centro de interés activo y remover la nota del centro inactivo.',
                  estado: 'Pendiente'
                });
              }
              
              if (activeP2Codes.length > 0) {
                 for (const c of ciGrades) {
                   if (!activeP2Codes.includes(c.codigoAsignatura)) {
                     const alreadyHas = nuevasAlertas.some(a => 
                       a.tipo === 'Centro de interés no activo' && 
                       a.archivo === archivo && 
                       a.curso === grades[0].curso && 
                       a.estudiante === estudiante &&
                       a.codigoAsignatura === c.codigoAsignatura &&
                       a.periodo === per
                     );
                     if (!alreadyHas) {
                       agregarAlerta({
                         id: crypto.randomUUID(),
                         gravedad: 'Informativa',
                         tipo: 'Centro de interés no activo',
                         archivo,
                         curso: grades[0].curso,
                         estudiante,
                         codigoAsignatura: c.codigoAsignatura,
                         periodo: per,
                         descripcion: `El centro de interés ${c.nombreAsignatura} tiene nota en ${per} pero no es el centro activo según P2 (${activeP2Codes.join(', ')}).`,
                         accionSugerida: 'Verificar si el estudiante cambió de centro de interés.',
                         estado: 'Pendiente'
                       });
                     }
                   }
                 }
              }
            }
          }

          // 7. Duplicate course check
          const courseYears = new Map<string, string[]>();
          for (const fileInfo of state.archivosCargados) {
            const regex = /^(PRIM|BACH)_([0-9]{2})_([0-9]{2})_([0-9]{4})(?:[^.]*)?\.xlsx$/i;
            const fileName = fileInfo.nombreArchivo || fileInfo.nombre || "";
            const match = fileName.match(regex);
            if (match) {
              const [_, nivelCode, gradoCode, cursoCode, anioCode] = match;
              const nivel = nivelCode.toUpperCase() === 'PRIM' ? 'Primaria' : 'Bachillerato';
              const gradoNum = parseInt(gradoCode, 10);
              const mappedLetra = configuracion.mapeoCursos[cursoCode] || cursoCode;
              const curso = `${gradoNum}${mappedLetra}`;
              const anio = parseInt(anioCode, 10);
              const key = `${nivel}_${curso}_${anio}`;
              if (!courseYears.has(key)) {
                courseYears.set(key, []);
              }
              courseYears.get(key)!.push(fileInfo.nombreArchivo);
            }
          }

          for (const [key, files] of courseYears.entries()) {
            if (files.length > 1) {
              const [nivel, curso, anio] = key.split('_');
              for (const file of files) {
                const alreadyAlerted = nuevasAlertas.some(a => a.tipo === 'Curso duplicado' && a.archivo === file);
                if (!alreadyAlerted) {
                  agregarAlerta({
                    id: crypto.randomUUID(),
                    gravedad: 'Media',
                    tipo: 'Curso duplicado',
                    archivo: file,
                    curso,
                    descripcion: `Múltiples archivos cargados para el curso ${curso} (${nivel}) del año ${anio}: ${files.join(', ')}.`,
                    accionSugerida: 'Eliminar o reemplazar el archivo duplicado.',
                    estado: 'Pendiente'
                  });
                }
              }
            }
          }

          // Update totalAlertasPendientes in archivosCargados
          const nuevosArchivosCargados = state.archivosCargados.map(f => {
            const pendingCount = nuevasAlertas.filter(a => a.archivo === f.nombreArchivo && a.estado === 'Pendiente').length;
            return {
              ...f,
              totalAlertasPendientes: pendingCount
            };
          });

          return {
            calificaciones: nuevasCalificaciones,
            alertas: deduplicarAlertas(nuevasAlertas),
            archivosCargados: nuevosArchivosCargados
          };
        });
      },
    }),
    {
      name: 'villa-campo-analytics-storage',
      storage: createJSONStorage(() => idbStorage),
    }
  )
);
