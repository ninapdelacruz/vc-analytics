import * as XLSX from 'xlsx';
import { CalificacionNormalizada, AlertaCalidad, Nivel, ConfiguracionAcademica } from '../types';
import { normalizarTipoAsignatura } from './calculations';

export const parseFileName = (fileName: string, config: ConfiguracionAcademica) => {
  // Ej: BACH_08_01_2026.xlsx
  const regex = /^(PRIM|BACH)_([0-9]{2})_([0-9]{2})_([0-9]{4})(?:[^.]*)?\.xlsx$/i;
  const match = fileName.match(regex);

  if (!match) {
    return null;
  }

  const [_, nivelCode, gradoCode, cursoCode, anioCode] = match;

  const nivel: Nivel = nivelCode.toUpperCase() === 'PRIM' ? 'Primaria' : 'Bachillerato';
  const gradoNum = parseInt(gradoCode, 10);
  
  const mappedLetra = config.mapeoCursos[cursoCode] || cursoCode;
  const curso = `${gradoNum}${mappedLetra}`; // e.g., 8A, 10B
  const anio = parseInt(anioCode, 10);

  return { nivel, gradoNum, curso, anio };
};

const extractSubjectInfo = (rawText: string) => {
  if (!rawText || typeof rawText !== 'string') return null;
  const match = rawText.trim().match(/^(.+?)\s+IH\s+(\d+)$/i);
  if (!match) return null;
  return {
    codigoAsignatura: match[1].trim().toUpperCase(),
    intensidadHoraria: parseInt(match[2].trim(), 10)
  };
};

export const processExcelFile = async (
  file: File, 
  config: ConfiguracionAcademica,
  onProgress: (msg: string) => void
): Promise<{ calificaciones: CalificacionNormalizada[], alertas: AlertaCalidad[], fileMeta: any }> => {
  return new Promise((resolve, reject) => {
    const fileMeta = parseFileName(file.name, config);
    const alertas: AlertaCalidad[] = [];

    if (!fileMeta) {
      alertas.push({
        id: crypto.randomUUID(),
        gravedad: 'Alta',
        tipo: 'Nombre de archivo inválido',
        archivo: file.name,
        descripcion: `El nombre del archivo ${file.name} no cumple el formato NIVEL_GRADO_CODIGO_AÑO.xlsx`,
        accionSugerida: 'Renombrar el archivo con el formato correcto.',
        estado: 'Pendiente',
        origen: 'parser',
        fecha: new Date().toISOString()
      });
      return reject(new Error('Formato de nombre de archivo inválido.'));
    }

    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const data = e.target?.result;
        const workbook = XLSX.read(data, { type: 'array' });

        let targetSheet: XLSX.WorkSheet | null = null;
        let headerRowIndex = -1;
        let rawData: any[][] = [];

        for (const sheetName of workbook.SheetNames) {
          const sheet = workbook.Sheets[sheetName];
          const json: any[][] = XLSX.utils.sheet_to_json(sheet, { header: 1, defval: null });
          
          for (let i = 0; i < Math.min(json.length, 20); i++) {
            const row = json[i];
            if (!row) continue;
            const rowStr = row.map(c => (c || '').toString().toLowerCase().trim());
            // Buscar la fila de "No.", "Apellidos/Nombres", "P1", "P2", "P3", "P4", "DEF"
            // Solo aseguramos que tenga algo de P1, P2 y apellidos
            const hasNames = rowStr.some(c => c.includes('apellido') || c.includes('nombre'));
            const hasPeriods = rowStr.includes('p1') && rowStr.includes('p2');
            
            if (hasNames && hasPeriods) {
              targetSheet = sheet;
              headerRowIndex = i;
              rawData = json;
              break;
            }
          }
          if (targetSheet) break;
        }

        if (!targetSheet || headerRowIndex === -1) {
           throw new Error('No se encontró una tabla válida en el archivo Excel con encabezados P1, P2, etc.');
        }

        const subjectRowIndex = headerRowIndex - 1;
        if (subjectRowIndex < 0) {
          throw new Error('No se encontró la fila de asignaturas.');
        }

        const periodRow = rawData[headerRowIndex];
        const subjectRow = rawData[subjectRowIndex];

        // Buscar el inicio de las notas (generalmente columna C, index 2)
        let firstP1Index = periodRow.findIndex(c => (c || '').toString().toLowerCase().trim() === 'p1');
        if (firstP1Index === -1) firstP1Index = 2; // fallback

        // Analizar los bloques de 5 columnas
        const blocks: { colIndex: number; subjectCode: string; ih: number }[] = [];
        const ignoredHeaders: string[] = ['ASIGN', 'ASIGNATURA', 'APELLIDOS', 'NOMBRES', 'NO', 'NOTA', 'PERIODO', 'DEF', 'IH'];

        for (let i = firstP1Index; i < subjectRow.length; i += 5) {
          const subjectHeader = subjectRow[i];
          if (subjectHeader) {
            const info = extractSubjectInfo(subjectHeader.toString());
            if (info) {
              const code = info.codigoAsignatura.toUpperCase();
              
              // 1. Ignorar encabezados inválidos
              if (ignoredHeaders.includes(code)) {
                continue;
              }

              // 2. Comprobar que las siguientes 5 columnas tengan P1, P2, P3, P4, DEF
              const expectedPeriods = ['p1', 'p2', 'p3', 'p4', 'def'];
              let periodsMatch = true;
              for (let offset = 0; offset < 5; offset++) {
                const colVal = periodRow[i + offset];
                if (!colVal || colVal.toString().toLowerCase().trim() !== expectedPeriods[offset]) {
                  periodsMatch = false;
                  break;
                }
              }

              if (!periodsMatch) {
                alertas.push({
                   id: crypto.randomUUID(),
                   gravedad: 'Media',
                   tipo: 'Estructura incorrecta',
                   archivo: file.name,
                   curso: fileMeta.curso,
                   descripcion: `El bloque de la asignatura ${code} fue ignorado porque las siguientes 5 columnas no coinciden exactamente con (P1, P2, P3, P4, DEF).`,
                   accionSugerida: 'Revisar la estructura de columnas de la asignatura en el archivo Excel.',
                   estado: 'Pendiente',
                   origen: 'parser'
                });
                continue;
              }

              blocks.push({ colIndex: i, subjectCode: code, ih: info.intensidadHoraria });
            }
          }
        }

        const calificaciones: CalificacionNormalizada[] = [];

        for (let i = headerRowIndex + 1; i < rawData.length; i++) {
          const row = rawData[i];
          if (!row || row.length === 0) continue;

          const numCell = (row[0] || '').toString().trim();
          const nameCell = (row[1] || '').toString().trim();

          // Ignorar notas institucionales
          if (numCell.toLowerCase().startsWith('nota:') || numCell.toLowerCase().startsWith('nota ') || (!numCell && !nameCell)) {
            continue;
          }

          if (!nameCell) continue; // Si no hay nombre, ignorar

          let hasAnyNoteForStudent = false;

          for (const block of blocks) {
            // Check dictionary
            const dictEntry = config.diccionarioAreas.find(d => d.codigoBase === block.subjectCode);
            let nombreAsignatura = block.subjectCode;
            let tipoAsignatura: any = 'Académica';
            let cuentaParaPerdida = true;

            if (dictEntry) {
              nombreAsignatura = dictEntry.nombreAsignatura;
              tipoAsignatura = dictEntry.tipo;
              cuentaParaPerdida = dictEntry.cuentaPerdida === 'SI' || dictEntry.cuentaPerdida === 'SI_CONDICIONAL';
            } else {
              alertas.push({
                id: crypto.randomUUID(),
                gravedad: 'Media',
                tipo: 'Código de asignatura desconocido',
                archivo: file.name,
                curso: fileMeta.curso,
                estudiante: nameCell,
                codigoAsignatura: block.subjectCode,
                descripcion: `El código "${block.subjectCode}" no está registrado en el diccionario.`,
                accionSugerida: 'Agregar el código al diccionario.',
                estado: 'Pendiente',
                origen: 'parser'
              });
            }
               // Check applicability
            let aplica = true;
            const appRules = config.aplicabilidad.filter(r => r.codigoBase === block.subjectCode);
            if (appRules.length > 0) {
              const rule = appRules.find(r => (r.nivel === fileMeta.nivel || r.nivel === 'Todos' as any) && (r.gradoClave === fileMeta.gradoNum.toString() || r.gradoClave === 'Todos'));
              if (rule) {
                aplica = rule.aplica;
                if (!aplica) cuentaParaPerdida = false; // No aplica -> No cuenta para pérdida
              } else {
                const generalRule = appRules.find(r => r.gradoClave === 'Todos');
                if (generalRule) {
                   aplica = generalRule.aplica;
                   if (!aplica) cuentaParaPerdida = false;
                } else {
                   aplica = false;
                   cuentaParaPerdida = false;
                }
              }
            }

            // Check center of interest in Primaria rule
            const normTipo = normalizarTipoAsignatura(tipoAsignatura);
            if (fileMeta.nivel === 'Primaria' && normTipo === 'Centro de interés') {
              aplica = false;
              cuentaParaPerdida = false;
            }

            if (!aplica) {
              alertas.push({
                id: crypto.randomUUID(),
                gravedad: 'Baja',
                tipo: 'Asignatura no aplicable',
                archivo: file.name,
                nivel: fileMeta.nivel,
                grado: fileMeta.gradoNum.toString(),
                curso: fileMeta.curso,
                estudiante: nameCell,
                nombreAsignatura: nombreAsignatura,
                descripcion: `La asignatura ${nombreAsignatura} no aplica para grado ${fileMeta.gradoNum}.`,
                accionSugerida: 'Revisar la configuración de aplicabilidad.',
                estado: 'Pendiente',
                origen: 'parser'
              });
            }

            // Reglas especiales
            if (block.subjectCode === 'COMPO') {
              cuentaParaPerdida = false;
            }

            const periods = ['P1', 'P2', 'P3', 'P4', 'DEF'];
            
            periods.forEach((period, pIdx) => {
              const cellValue = row[block.colIndex + pIdx];
              let finalNota: string | number | null = null;
              
              if (cellValue !== null && cellValue !== undefined && cellValue !== '') {
                const sVal = cellValue.toString().trim();
                if (sVal === '*') {
                  finalNota = '*';
                } else {
                  const n = parseFloat(sVal);
                  if (!isNaN(n)) {
                    finalNota = n;
                  }
                }
              }

              if (finalNota !== null) {
                hasAnyNoteForStudent = true;
                
                // Alert on out of bounds (only if numeric and not '*')
                if (typeof finalNota === 'number') {
                  if (finalNota < config.notaMinima || finalNota > config.notaMaxima) {
                    alertas.push({
                      id: crypto.randomUUID(),
                      gravedad: 'Crítica',
                      tipo: 'Nota fuera de rango',
                      archivo: file.name,
                      curso: fileMeta.curso,
                      estudiante: nameCell,
                      nombreAsignatura: nombreAsignatura,
                      descripcion: `La nota ${finalNota} en ${period} excede el rango permitido (${config.notaMinima} - ${config.notaMaxima}).`,
                      accionSugerida: 'Corregir en el archivo Excel origen.',
                      estado: 'Pendiente',
                      origen: 'parser'
                    });
                  }
                }

                calificaciones.push({
                  archivo: file.name,
                  nivel: fileMeta.nivel,
                  grado: fileMeta.gradoNum,
                  curso: fileMeta.curso,
                  anio: fileMeta.anio,
                  estudianteNumero: numCell,
                  estudianteNombre: nameCell,
                  codigoAsignatura: block.subjectCode,
                  nombreAsignatura,
                  area: dictEntry ? dictEntry.area : block.subjectCode,
                  intensidadHoraria: block.ih,
                  periodo: period,
                  nota: finalNota,
                  tipoAsignatura,
                  cuentaParaPerdida,
                  aplica,
                  fuente: file.name
                });
              }
            });
          }
        }

        if (calificaciones.length === 0) {
          alertas.push({
            id: crypto.randomUUID(),
            gravedad: 'Crítica',
            tipo: 'Archivo sin registros',
            archivo: file.name,
            descripcion: `No se extrajeron registros válidos del archivo.`,
            accionSugerida: 'Verificar la estructura de notas numéricas.',
            estado: 'Pendiente',
            origen: 'parser'
          });
        } else {
          // Check for future periods without data
          const periodsToCheck = ['P1', 'P2', 'P3', 'P4'];
          for (const per of periodsToCheck) {
            const hasData = calificaciones.some(c => c.periodo === per && c.nota !== null && typeof c.nota === 'number');
            if (!hasData) {
               alertas.push({
                 id: crypto.randomUUID(),
                 gravedad: 'Informativa',
                 tipo: 'Período sin datos',
                 archivo: file.name,
                 descripcion: `El período ${per} no contiene ninguna nota numérica válida.`,
                 accionSugerida: 'Verificar si el período ya fue calificado.',
                 estado: 'Pendiente',
                 origen: 'parser'
               });
            }
          }
        }

        resolve({ calificaciones, alertas, fileMeta });

      } catch (error: any) {
        reject(error);
      }
    };
    reader.onerror = (error) => reject(error);
    reader.readAsArrayBuffer(file);
  });
};

export const detectActivePeriod = (calificaciones: CalificacionNormalizada[]): 'P1' | 'P2' | 'P3' | 'P4' => {
  let activePeriod: 'P1' | 'P2' | 'P3' | 'P4' = 'P1';

  const periods: ('P1' | 'P2' | 'P3' | 'P4')[] = ['P1', 'P2', 'P3', 'P4'];
  
  for (const period of periods) {
    // Si encontramos notas numéricas en el período, entonces asumimos que al menos llegamos a ese período
    const hasNotes = calificaciones.some(c => c.periodo === period && typeof c.nota === 'number');
    if (hasNotes) {
      activePeriod = period;
    }
  }

  return activePeriod;
};

