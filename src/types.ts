export type Nivel = 'Primaria' | 'Bachillerato' | 'Media' | 'Básica Secundaria' | 'Todos';

export type OperadorDesempeno = '>=' | '>' | '<=' | '<';

export interface NivelDesempeno {
  nombre: string;
  min: number;
  operadorMin: OperadorDesempeno;
  max: number;
  operadorMax: OperadorDesempeno;
  color: string;
}

export type TipoCuentaPerdida = 'SI' | 'NO' | 'SI_CONDICIONAL';

export interface DiccionarioAsignatura {
  codigoBase: string;
  nombreAsignatura: string;
  area: string;
  tipo: 'Académica' | 'Centro de interés' | 'Comportamiento' | 'Complementaria' | 'Básica' | 'No académica';
  cuentaPerdida: TipoCuentaPerdida;
  observacion: string;
  activa: boolean;
}

export interface AplicabilidadGrado {
  nivel: 'Primaria' | 'Bachillerato';
  gradoClave: string; // e.g. "6", "10", "Todos"
  codigoBase: string;
  aplica: boolean;
  cuentaPerdidaAplicable: boolean;
  observacionAplicabilidad: string;
}

export interface ConfiguracionAcademica {
  periodos: number;
  pesosPeriodos: number[]; // e.g., [25, 25, 25, 25]
  notaMinima: number;
  notaMaxima: number;
  notaAprobacion: number;
  asignaturasParaPerder: number;
  nivelesDesempeno: NivelDesempeno[];
  diccionarioAreas: DiccionarioAsignatura[];
  aplicabilidad: AplicabilidadGrado[];
  reglaMultiplesCentros: 'Inconsistencia' | 'Manual' | 'Reciente' | 'MasPeriodos' | 'DiferentePorPeriodo';
  usaDefinitivaArchivo: boolean;
  mapeoCursos: Record<string, string>; // e.g., "01": "A"
  margenRiesgo?: number;
  modoCalculoPromedioInstitucional?: 'directo' | 'estudiante' | 'intensidad' | 'acumulado' | 'def';
  cursosEsperados?: { nivel: 'Primaria' | 'Bachillerato'; grado: number; curso: string; }[];
}

export interface CalificacionNormalizada {
  archivo: string;
  nivel: Nivel;
  grado: number;
  curso: string;
  anio: number;
  estudianteNumero: number | string;
  estudianteNombre: string;
  codigoAsignatura: string;
  nombreAsignatura: string;
  asignatura?: string; // Backwards compatibility with some UI views
  area?: string; // Derived area for UI grouping
  intensidadHoraria: number;
  periodo: string; // 'P1', 'P2', 'P3', 'P4', 'DEF'
  nota: number | string | null; // Note can be '*' or null
  tipoAsignatura: 'Obligatoria' | 'Centro de interés' | 'Comportamiento' | 'Complementaria' | 'Básica' | 'Académica' | 'No académica';
  cuentaParaPerdida: boolean;
  fuente?: string;
  aplica?: boolean;
}

export type GravedadAlerta = 'Crítica' | 'Alta' | 'Media' | 'Baja' | 'Informativa';
export type EstadoAlerta = 'Pendiente' | 'Revisada' | 'Ignorada' | 'Corregida';

export type OrigenAlerta = 'parser' | 'revalidacion' | 'calculo';

export interface AlertaCalidad {
  id: string;
  gravedad: GravedadAlerta;
  tipo: string;
  archivo: string;
  nivel?: string;
  grado?: string;
  curso?: string;
  estudiante?: string;
  codigoAsignatura?: string;
  nombreAsignatura?: string;
  periodo?: string;
  descripcion: string;
  accionSugerida: string;
  estado: EstadoAlerta;
  fecha?: string;
  origen?: OrigenAlerta;
}

export interface AsignaturaValidaParaPerdida {
  archivo: string;
  nivel: string;
  grado: number;
  curso: string;
  anio: number;
  estudianteNumero: string | number;
  estudianteNombre: string;
  codigoAsignatura: string;
  nombreAsignatura: string;
  nota: number;
  tipoAsignatura: string;
  area: string;
  periodoAnalisis: 'P1' | 'P2' | 'P3' | 'P4' | 'DEF';
  intensidadHoraria: number;
  aplica: boolean;
  cuentaParaPerdida: boolean;
}

export interface Intervencion {
  id: string;
  estudianteId: string;
  estudianteNombre: string;
  curso: string;
  riesgo: 'Bajo' | 'Medio' | 'Alto' | 'Crítico';
  causa: string;
  accion: string;
  responsable: string;
  fecha: string;
  estado: 'Sin iniciar' | 'Citado' | 'En refuerzo' | 'En seguimiento' | 'Mejoró' | 'No mejoró' | 'Cerrado';
  resultado: string;
}

export interface ArchivoCargado {
  idArchivo: string;
  nombreArchivo: string;
  nombre: string; // for backward compatibility
  nivel: string;
  grado: number;
  curso: string;
  anio: number;
  periodoDetectado: 'P1' | 'P2' | 'P3' | 'P4' | 'DEF';
  fechaCarga: string; // e.g. "01/07/2026"
  horaCarga: string;  // e.g. "08:15 p.m."
  timestampCarga: number;
  estadoProcesamiento: 'Procesado' | 'Error';
  totalRegistros: number;
  totalAlertasPendientes: number;
}

export interface SeedData {
  configuracion: ConfiguracionAcademica;
  calificaciones: CalificacionNormalizada[];
  alertas: AlertaCalidad[];
  intervenciones: Intervencion[];
  archivosCargados: ArchivoCargado[];
  periodoActivo: 'P1' | 'P2' | 'P3' | 'P4' | 'DEF';
}

