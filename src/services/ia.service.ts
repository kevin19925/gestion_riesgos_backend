import OpenAI from 'openai';
import { MongoClient, Db, Collection, ObjectId } from 'mongodb';
import * as fs from 'fs';
import * as path from 'path';
import prisma from '../prisma';
import { redisGet, redisSet } from '../redisClient';

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

/** TTL en segundos para el contexto IA (riesgos, procesos, controles, planes). Reduce consultas a DB. */
const IA_CONTEXT_CACHE_TTL = 90;
const IA_CONTEXT_CACHE_PREFIX = 'ia:context:';

const MONGODB_URI = process.env.MONGODB_URI!;
const MONGODB_DB_NAME = process.env.MONGODB_DB_NAME || 'cora_riesgos';
const COLECCION_CONVERSACIONES = process.env.COLECCION_CONVERSACIONES || 'conversaciones';
const PROMPT_ID = process.env.PROMPT_ID!;

/** System message CORA: se carga desde el doc del repo y se envía como primer mensaje al modelo. */
let cachedSystemMessageCora: string | null = null;

function getSystemMessageCora(): string {
  if (cachedSystemMessageCora) return cachedSystemMessageCora;
  const docPath = path.join(__dirname, '../../docs/SYSTEM_MESSAGE_CORA.md');
  try {
    const raw = fs.readFileSync(docPath, 'utf-8');
    const match = raw.match(/```\s*\n([\s\S]*?)\n```/);
    cachedSystemMessageCora = match ? match[1].trim() : raw.trim();
  } catch (e) {
    console.warn('[IA] No se pudo cargar SYSTEM_MESSAGE_CORA.md:', (e as Error).message);
    cachedSystemMessageCora = 'Eres CORA, la IA del sistema de gestión de riesgos. Responde en español con los datos que recibes en el contexto (RIESGOS, PROCESOS, CONTROLES, PLANES).';
  }
  return cachedSystemMessageCora;
}

let mongoClient: MongoClient | null = null;
let mongoDb: Db | null = null;
let conversacionesCol: Collection | null = null;

async function getMongo() {
  if (!mongoClient) {
    if (!MONGODB_URI) throw new Error('MONGODB_URI no configurado');
    mongoClient = new MongoClient(MONGODB_URI);
    await mongoClient.connect();
    mongoDb = mongoClient.db(MONGODB_DB_NAME);
    conversacionesCol = mongoDb.collection(COLECCION_CONVERSACIONES);
  }
  return { db: mongoDb as Db, conversaciones: conversacionesCol as Collection };
}

// --- Helper Functions ---

async function getRiesgosResumen(userId: number, takeRows = 100) {
  const asignaciones = await prisma.procesoResponsable.findMany({
    where: { usuarioId: userId, modo: { in: ['director', 'proceso'] } },
    select: { procesoId: true },
  });
  const ids = Array.from(new Set(asignaciones.map(a => a.procesoId)));
  if (!ids.length) return [];

  const riesgos = await prisma.riesgo.findMany({
    where: { procesoId: { in: ids } },
    select: {
      numeroIdentificacion: true,
      numero: true,
      descripcion: true,
      clasificacion: true,
      proceso: { select: { nombre: true, sigla: true } },
      evaluacion: {
        select: {
          nivelRiesgo: true,
          nivelRiesgoResidual: true,
          riesgoInherente: true,
          riesgoResidual: true,
        },
      },
    },
    take: takeRows,
  });

  return riesgos.map((r) => {
    const idRiesgo = r.numeroIdentificacion || String(r.numero) || 'R';
    const procesoNombre = r.proceso?.nombre || 'N/A';
    const nivel = r.evaluacion?.nivelRiesgo?.trim() || 'Sin calificar';
    const nivelRes = r.evaluacion?.nivelRiesgoResidual?.trim();
    const scoreInh = r.evaluacion?.riesgoInherente ?? null;
    const scoreRes = r.evaluacion?.riesgoResidual ?? null;

    const partesNivel: string[] = [];
    if (nivelRes) {
      // Inherente / Residual con posible valor numérico
      if (nivel) {
        partesNivel.push(
          `Inherente: ${nivel}${scoreInh != null ? ` (puntaje: ${scoreInh})` : ''}`,
        );
      }
      partesNivel.push(
        `Residual: ${nivelRes}${scoreRes != null ? ` (puntaje: ${scoreRes})` : ''}`,
      );
    } else if (nivel) {
      partesNivel.push(
        `Nivel: ${nivel}${scoreInh != null ? ` (puntaje: ${scoreInh})` : ''}`,
      );
    } else {
      partesNivel.push('Sin calificar');
    }

    const nivelStr = partesNivel.join(' | ');
    return `- ${idRiesgo} [${nivelStr}]: ${r.descripcion} (${procesoNombre})`;
  });
}

async function getProcesosResumen(userId: number) {
  const asignaciones = await prisma.procesoResponsable.findMany({
    where: { usuarioId: userId, modo: { in: ['director', 'proceso'] } },
    select: {
      modo: true,
      proceso: {
        select: {
          nombre: true,
          sigla: true,
          area: {
            select: {
              nombre: true,
            },
          },
        },
      },
    },
  });

  // Procesos únicos por sigla/nombre/área para evitar duplicados
  const lines: string[] = [];
  const seen = new Set<string>();

  for (const a of asignaciones) {
    const nombre = a.proceso?.nombre || 'Proceso sin nombre';
    const sigla = a.proceso?.sigla || '';
    const areaNombre = a.proceso?.area?.nombre || 'Área no definida';
    const rol = a.modo || 'proceso';
    const key = `${nombre}::${sigla}::${areaNombre}::${rol}`;
    if (seen.has(key)) continue;
    seen.add(key);
    const siglaPart = sigla ? ` [${sigla}]` : '';
    lines.push(`${nombre}${siglaPart} | Área: ${areaNombre} (Rol: ${rol})`);
  }

  return lines;
}

const CONTROLES_TAKE = 500;
const PLANES_TAKE = 500;

/** Salida: equilibrio calidad/velocidad (subir con IA_STREAM_MAX_OUTPUT_TOKENS si hace falta más texto). */
const IA_STREAM_MAX_OUTPUT = Math.min(
  900,
  Math.max(256, Number(process.env.IA_STREAM_MAX_OUTPUT_TOKENS) || 580),
);

/**
 * Límites con pantalla activa: sigue habiendo vista global (planes/controles por riesgo-proceso en BD),
 * sin ir a 500+500 en cada mensaje. `planesResumen` del front complementa el proceso abierto.
 */
function getContextoIATakes(screenContext?: ScreenContext): {
  riesgosTake: number;
  controlesTake: number;
  planesTake: number;
  skipContextoInterno: boolean;
} {
  if (!screenContext) {
    return {
      riesgosTake: 100,
      controlesTake: CONTROLES_TAKE,
      planesTake: PLANES_TAKE,
      skipContextoInterno: false,
    };
  }
  if (screenContext.module === 'planes') {
    const sc = screenContext.screen;
    if (sc === 'controles') {
      return { riesgosTake: 100, controlesTake: 300, planesTake: 260, skipContextoInterno: false };
    }
    if (sc === 'planes') {
      return { riesgosTake: 100, controlesTake: 220, planesTake: 380, skipContextoInterno: false };
    }
    return { riesgosTake: 90, controlesTake: 220, planesTake: 220, skipContextoInterno: false };
  }
  return { riesgosTake: 80, controlesTake: 320, planesTake: 320, skipContextoInterno: false };
}

async function getControlesResumen(
  userId: number,
  take: number = CONTROLES_TAKE,
): Promise<{ lines: string[]; total: number }> {
  if (take <= 0) return { lines: [], total: 0 };
  const asignaciones = await prisma.procesoResponsable.findMany({
    where: { usuarioId: userId, modo: { in: ['director', 'proceso'] } },
    select: { procesoId: true }
  });
  const ids = asignaciones.map(a => a.procesoId);
  const whereControles = { causaRiesgo: { riesgo: { procesoId: { in: ids } } } };
  const [total, controles] = await Promise.all([
    prisma.controlRiesgo.count({ where: whereControles }),
    prisma.controlRiesgo.findMany({
      where: whereControles,
      select: {
        descripcion: true,
        causaRiesgo: {
          select: {
            riesgo: {
              select: {
                numeroIdentificacion: true,
                numero: true,
                proceso: { select: { sigla: true, nombre: true } },
              },
            },
          },
        },
      },
      take,
    }),
  ]);
  const lines = controles.map(c => {
    const r = c.causaRiesgo.riesgo;
    const idRiesgo = r.numeroIdentificacion || String(r.numero || '') || 'Riesgo';
    const sigla = r.proceso?.sigla || '';
    const procNombre = r.proceso?.nombre || '';
    const riesgoLabel = sigla ? `${idRiesgo} [${sigla}]` : idRiesgo;
    const procLabel = procNombre ? ` (${procNombre})` : '';
    return `- Control: ${c.descripcion} -> Riesgo: ${riesgoLabel}${procLabel}`;
  });
  return { lines, total };
}

async function getPlanesResumen(
  userId: number,
  take: number = PLANES_TAKE,
): Promise<{ lines: string[]; total: number }> {
  if (take <= 0) return { lines: [], total: 0 };
  const asignaciones = await prisma.procesoResponsable.findMany({
    where: { usuarioId: userId, modo: { in: ['director', 'proceso'] } },
    select: { procesoId: true },
  });
  const procesoIds = Array.from(new Set(asignaciones.map((a) => a.procesoId)));
  if (!procesoIds.length) return { lines: [], total: 0 };

  const wherePlanes = {
    OR: [
      { riesgo: { procesoId: { in: procesoIds } } },
      { incidencia: { procesoId: { in: procesoIds } } },
      { responsable: { contains: String(userId), mode: 'insensitive' as const } },
    ],
  };

  const [total, planes] = await Promise.all([
    prisma.planAccion.count({ where: wherePlanes }),
    prisma.planAccion.findMany({
      where: wherePlanes,
      select: {
        descripcion: true,
        estado: true,
        riesgo: {
          select: {
            numeroIdentificacion: true,
            numero: true,
            proceso: { select: { sigla: true, nombre: true } },
          },
        },
        incidencia: {
          select: {
            id: true,
            proceso: { select: { sigla: true, nombre: true } },
          },
        },
      },
      take,
    }),
  ]);

  const lines = planes.map((p) => {
    if (p.riesgo) {
      const idRiesgo = p.riesgo.numeroIdentificacion || String(p.riesgo.numero || '') || 'Riesgo';
      const sigla = p.riesgo.proceso?.sigla || '';
      const procNombre = p.riesgo.proceso?.nombre || '';
      const riesgoLabel = sigla ? `${idRiesgo} [${sigla}]` : idRiesgo;
      const procesoLabel = procNombre ? ` (${procNombre})` : '';
      return `- Plan: ${p.descripcion} [${p.estado}] -> Riesgo: ${riesgoLabel}${procesoLabel}`;
    }

    const incId = p.incidencia?.id != null ? `Incidencia ${p.incidencia.id}` : 'Incidencia';
    const siglaInc = p.incidencia?.proceso?.sigla || '';
    const procInc = p.incidencia?.proceso?.nombre || '';
    const incLabel = siglaInc ? `${incId} [${siglaInc}]` : incId;
    const procLabel = procInc ? ` (${procInc})` : '';
    return `- Plan: ${p.descripcion} [${p.estado}] -> ${incLabel}${procLabel}`;
  });
  return { lines, total };
}

// Mapeo de tipos de contexto interno a etiquetas legibles
const CONTEXTO_INTERNO_LABELS: Record<string, string> = {
  INTERNO_FINANCIEROS: 'Financieros',
  INTERNO_GENTE: 'Gente',
  INTERNO_PROCESOS: 'Procesos',
  INTERNO_ACTIVOSFISICOS: 'Activos Físicos',
  INTERNO_CADENASUMINISTRO: 'Cadena de Suministro',
  INTERNO_INFORMACION: 'Información',
  INTERNO_SISTEMAS: 'Sistemas/Tecnología',
  INTERNO_PROYECTOS: 'Proyectos',
  INTERNO_IMPUESTOS: 'Impuestos',
  INTERNO_GRUPOSINTERESINTERNOS: 'Grupos de Interés Internos',
};

function normalizarTexto(text: string) {
  return text
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '');
}

/**
 * Construye el mensaje de contexto de pantalla para CORA
 */
async function buildScreenContextMessage(screenContext: ScreenContext | undefined): Promise<string | null> {
  if (!screenContext) return null;

  console.log('[CORA] Construyendo mensaje de contexto:', JSON.stringify(screenContext, null, 2)); // DEBUG

  const { module, screen, action, processId, formData } = screenContext;

  let contextMessage = `PANTALLA_ACTUAL:\n`;
  contextMessage += `Módulo: ${module}\n`;
  contextMessage += `Pantalla: ${screen}\n`;
  contextMessage += `Acción: ${action === 'create' ? 'Creando nuevo' : action === 'edit' ? 'Editando' : 'Visualizando'}\n`;
  if (formData?.procesoSigla || formData?.procesoNombre) {
    contextMessage += `Proceso en pantalla: ${[formData.procesoSigla, formData.procesoNombre].filter(Boolean).join(' — ')}\n`;
  }
  if (processId != null) {
    contextMessage += `ID proceso (sistema): ${processId}\n`;
  }
  contextMessage += `\nInstrucción: Este bloque describe la pantalla y el proceso abierto. El sistema también envía listas globales RIESGOS, CONTROLES y PLANES (BD). `;
  contextMessage += `Úsalas juntas: lo de abajo (planesResumen / controles visibles) es el detalle del proceso actual; los bloques globales permiten comparar por riesgo/proceso.\n`;

  // Planes de acción reales del proceso (todas las pestañas del módulo planes)
  if (
    module === 'planes' &&
    formData?.planesResumen &&
    Array.isArray(formData.planesResumen) &&
    formData.planesResumen.length > 0
  ) {
    contextMessage += `\n=== PLANES DE ACCIÓN REGISTRADOS EN ESTE PROCESO (datos reales de la aplicación) ===\n`;
    contextMessage += `REGLA: Para preguntas sobre planes por riesgo (ej. 1GTI), usa EXCLUSIVAMENTE esta lista. `;
    contextMessage += `Si un riesgo aparece aquí con uno o más planes, NO digas que no hay planes registrados.\n\n`;
    formData.planesResumen.forEach((r: any, idx: number) => {
      if (idx >= 40) return;
      contextMessage += `\nRiesgo ${r.riesgoId}: ${r.riesgoDescripcion || '(sin descripción)'}\n`;
      (r.planes || []).forEach((p: any, j: number) => {
        contextMessage += `  ${j + 1}. Causa: ${p.causaOriginal || '(sin causa)'}\n`;
        contextMessage += `     Descripción del plan: ${p.planDescripcion || '(sin descripción)'}\n`;
        contextMessage += `     Detalle: ${p.planDetalle || '(n/a)'}\n`;
        contextMessage += `     Responsable: ${p.responsable || '(no definido)'}\n`;
        contextMessage += `     Fecha estimada: ${p.fechaEstimada ?? 'N/A'}\n`;
        contextMessage += `     Estado: ${p.estado || '(n/a)'}\n`;
      });
    });
  }

  // Información específica según el módulo
  if (module === 'planes' && screen === 'planes') {
    contextMessage += `\nEl usuario está en la pantalla de Gestión de Planes de Acción.\n`;
    contextMessage += `IMPORTANTE: Si hay un plan en edición abajo, USA ESA INFORMACIÓN DIRECTAMENTE. NO pidas al usuario que te la proporcione.\n\n`;
    contextMessage += `Puede ayudar con:\n`;
    contextMessage += `- Evaluar planes usando el marco 5W+1H (What, Why, Who, Where, When, How)\n`;
    contextMessage += `- Sugerir mejoras en descripciones de planes\n`;
    contextMessage += `- Verificar que tengan responsable, fechas y acciones concretas\n`;
    contextMessage += `- Recomendar indicadores de seguimiento\n`;
    contextMessage += `- Validar que el plan responda al riesgo que busca mitigar\n`;
    
    if (formData?.causaEnEdicion?.formPlan) {
      const plan = formData.causaEnEdicion.formPlan;
      contextMessage += `\n=== PLAN ACTUALMENTE EN EDICIÓN ===\n`;
      contextMessage += `Descripción: ${plan.descripcion || '(vacío)'}\n`;
      contextMessage += `Detalle: ${plan.detalle || '(vacío)'}\n`;
      contextMessage += `Responsable: ${plan.responsable || '(no definido)'}\n`;
      contextMessage += `Fecha estimada: ${plan.fechaEstimada || '(no definida)'}\n`;
      contextMessage += `Estado: ${plan.estado || 'pendiente'}\n`;
      contextMessage += `Decisión: ${plan.decision || '(no definida)'}\n`;
      contextMessage += `\nCuando el usuario pregunte sobre "este plan", se refiere al plan de arriba. Evalúalo directamente sin pedir más información.\n`;
    } else {
      contextMessage += `\nNo hay ningún plan en edición actualmente.\n`;
      contextMessage += `Para evaluar un plan específico, el usuario debe:\n`;
      contextMessage += `1. Hacer clic en "Clasificar" o editar una causa\n`;
      contextMessage += `2. Seleccionar "Plan de Acción" como tipo\n`;
      contextMessage += `3. Llenar el formulario del plan\n`;
      contextMessage += `Entonces podrás ver automáticamente los datos del formulario.\n`;
    }

    if (formData?.planesActivos !== undefined) {
      contextMessage += `\nEstadísticas:\n`;
      contextMessage += `- Planes activos: ${formData.planesActivos}\n`;
      contextMessage += `- Controles activos: ${formData.controlesActivos || 0}\n`;
    }
  }

  if (module === 'planes' && screen === 'controles') {
    contextMessage += `\nEl usuario está en la pantalla de Gestión de Controles.\n`;
    
    if (formData?.causaEnEdicion?.formControl) {
      // Caso 1: Hay un control en edición
      const control = formData.causaEnEdicion.formControl;
      contextMessage += `IMPORTANTE: Hay un control en edición. USA ESA INFORMACIÓN DIRECTAMENTE.\n\n`;
      contextMessage += `=== CONTROL ACTUALMENTE EN EDICIÓN ===\n`;
      contextMessage += `Descripción: ${control.descripcion || '(vacío)'}\n`;
      contextMessage += `Tipo: ${control.tipo || 'prevención'}\n`;
      contextMessage += `\nCuando el usuario pregunte sobre "este control", se refiere al control de arriba. Evalúalo directamente sin pedir más información.\n`;
    } else if (formData?.controlesVisibles && formData.controlesVisibles.length > 0) {
      // Caso 2: Está viendo la lista de controles
      contextMessage += `El usuario está viendo la lista de controles. Puede preguntarte sobre cualquiera de ellos.\n\n`;
      contextMessage += `=== CONTROLES VISIBLES EN PANTALLA ===\n`;
      formData.controlesVisibles.forEach((r: any, idx: number) => {
        if (idx < 10) {
          contextMessage += `\nRiesgo ${r.riesgoId}: ${r.riesgoDescripcion}\n`;
          r.controles.forEach((c: any, cidx: number) => {
            if (cidx < 5) {
              contextMessage += `  - Control: ${c.descripcion} (Tipo: ${c.tipo}, Efectividad: ${c.efectividad})\n`;
            }
          });
        }
      });
      contextMessage += `\nPuedes ayudar al usuario a:\n`;
      contextMessage += `- Analizar la efectividad de los controles listados\n`;
      contextMessage += `- Sugerir mejoras en descripciones\n`;
      contextMessage += `- Recomendar controles adicionales\n`;
      contextMessage += `- Explicar diferencias entre tipos de control\n`;
    } else {
      // Caso 3: No hay controles ni en edición ni visibles
      contextMessage += `No hay controles en edición ni visibles actualmente.\n`;
    }

    if (formData?.controlesActivos !== undefined) {
      contextMessage += `\nEstadísticas:\n`;
      contextMessage += `- Controles activos: ${formData.controlesActivos}\n`;
      contextMessage += `- Planes activos: ${formData.planesActivos || 0}\n`;
    }
  }

  if (module === 'riesgos' && screen === 'identificacion') {
    contextMessage += `\nEl usuario está en la pantalla de Identificación y Calificación de Riesgos.\n`;
    
    if (formData?.riesgosVisibles && formData.riesgosVisibles.length > 0) {
      contextMessage += `\n=== RIESGOS VISIBLES EN PANTALLA ===\n`;
      contextMessage += `Página ${formData.currentPage || 1} de ${formData.totalPages || 1} (Total: ${formData.totalRiesgos || 0} riesgos)\n\n`;
      
      formData.riesgosVisibles.forEach((r: any, idx: number) => {
        contextMessage += `${idx + 1}. Riesgo ${r.id}:\n`;
        contextMessage += `   Descripción: ${r.descripcion}\n`;
        contextMessage += `   Tipología: ${r.tipologia}\n`;
        contextMessage += `   Nivel Inherente: ${r.nivelInherente}\n`;
        contextMessage += `   Causas identificadas: ${r.causas}\n\n`;
      });
    } else {
      contextMessage += `\nNo hay riesgos identificados aún para este proceso.\n`;
    }
    
    contextMessage += `\nPuedes ayudar al usuario a:\n`;
    contextMessage += `- Validar descripciones de riesgos (deben ser claras y específicas)\n`;
    contextMessage += `- Sugerir causas potenciales para cada riesgo\n`;
    contextMessage += `- Recomendar tipologías adecuadas según la descripción\n`;
    contextMessage += `- Verificar que la información esté completa\n`;
    contextMessage += `- Identificar riesgos faltantes según el tipo de proceso\n`;
    contextMessage += `- Evaluar si el nivel de riesgo inherente es coherente\n`;
  }

  if (module === 'contexto-interno') {
    const signo = formData?.signo || screen;
    contextMessage += `\nEl usuario está en la pantalla de Análisis de Contexto Interno.\n`;
    contextMessage += `Pestaña activa: ${signo === 'POSITIVO' || signo === 'positivo' ? 'Factores Positivos (Fortalezas internas)' : 'Factores Negativos (Debilidades internas)'}\n\n`;
    
    if (formData?.itemsVisibles && formData.itemsVisibles.length > 0) {
      contextMessage += `=== FACTORES ${signo.toUpperCase()} VISIBLES ===\n`;
      formData.itemsVisibles.forEach((cat: any) => {
        contextMessage += `\n${cat.categoria}:\n`;
        cat.items.forEach((item: any) => {
          contextMessage += `  - ${item.descripcion}`;
          if (item.enDofa) {
            contextMessage += ` [Ya en DOFA: ${item.dofaDimension || 'Sin dimensión'}]`;
          } else if (item.enviarADofa && item.dofaDimension) {
            contextMessage += ` [Marcado para enviar a DOFA: ${item.dofaDimension}]`;
          }
          contextMessage += `\n`;
        });
      });
    }
    
    if (formData?.totalItems !== undefined) {
      contextMessage += `\nEstadísticas:\n`;
      contextMessage += `- Total de categorías: ${formData.totalCategorias || 10}\n`;
      contextMessage += `- Categorías con datos: ${formData.categoriasConDatos || 0}\n`;
      contextMessage += `- Total de factores ${signo.toLowerCase()}: ${formData.totalItems || 0}\n`;
    }
    
    contextMessage += `\nPuedes ayudar al usuario a:\n`;
    contextMessage += `- Analizar los factores internos identificados\n`;
    contextMessage += `- Sugerir factores adicionales por categoría\n`;
    contextMessage += `- Recomendar qué factores enviar al análisis DOFA\n`;
    contextMessage += `- Evaluar si un factor es realmente positivo o negativo\n`;
    contextMessage += `- Mejorar la redacción de las descripciones\n`;
  }

  if (module === 'contexto-externo') {
    const signo = formData?.signo || screen;
    contextMessage += `\nEl usuario está en la pantalla de Análisis de Contexto Externo (PESTEL).\n`;
    contextMessage += `Pestaña activa: ${signo === 'POSITIVO' || signo === 'positivo' ? 'Factores Positivos (Oportunidades externas)' : 'Factores Negativos (Amenazas externas)'}\n\n`;
    
    if (formData?.itemsVisibles && formData.itemsVisibles.length > 0) {
      contextMessage += `=== FACTORES ${signo.toUpperCase()} VISIBLES ===\n`;
      formData.itemsVisibles.forEach((cat: any) => {
        contextMessage += `\n${cat.categoria}:\n`;
        cat.items.forEach((item: any) => {
          contextMessage += `  - ${item.descripcion}`;
          if (item.enDofa) {
            contextMessage += ` [Ya en DOFA: ${item.dofaDimension || 'Sin dimensión'}]`;
          } else if (item.enviarADofa && item.dofaDimension) {
            contextMessage += ` [Marcado para enviar a DOFA: ${item.dofaDimension}]`;
          }
          contextMessage += `\n`;
        });
      });
    }
    
    if (formData?.totalItems !== undefined) {
      contextMessage += `\nEstadísticas:\n`;
      contextMessage += `- Total de categorías PESTEL: ${formData.totalCategorias || 9}\n`;
      contextMessage += `- Categorías con datos: ${formData.categoriasConDatos || 0}\n`;
      contextMessage += `- Total de factores ${signo.toLowerCase()}: ${formData.totalItems || 0}\n`;
    }
    
    contextMessage += `\nPuedes ayudar al usuario a:\n`;
    contextMessage += `- Analizar los factores externos identificados (PESTEL)\n`;
    contextMessage += `- Sugerir factores adicionales por categoría\n`;
    contextMessage += `- Recomendar qué factores enviar al análisis DOFA\n`;
    contextMessage += `- Evaluar si un factor es realmente una oportunidad o amenaza\n`;
    contextMessage += `- Mejorar la redacción de las descripciones\n`;
  }

  if (module === 'dofa') {
    contextMessage += `\nEl usuario está en la pantalla de Matriz DOFA (Fortalezas, Oportunidades, Debilidades, Amenazas).\n\n`;
    
    if (formData?.cuadrantes && formData.cuadrantes.length > 0) {
      contextMessage += `=== MATRIZ DOFA ===\n`;
      formData.cuadrantes.forEach((cuadrante: any) => {
        if (cuadrante.total > 0) {
          contextMessage += `\n${cuadrante.nombre} (${cuadrante.total} items):\n`;
          cuadrante.items.forEach((item: string, idx: number) => {
            if (idx < 5 && item) { // Mostrar máximo 5 items por cuadrante
              contextMessage += `  ${idx + 1}. ${item}\n`;
            }
          });
          if (cuadrante.total > 5) {
            contextMessage += `  ... y ${cuadrante.total - 5} más\n`;
          }
        }
      });
    }
    
    if (formData?.totalFortalezas !== undefined) {
      contextMessage += `\nResumen:\n`;
      contextMessage += `- Fortalezas: ${formData.totalFortalezas}\n`;
      contextMessage += `- Oportunidades: ${formData.totalOportunidades}\n`;
      contextMessage += `- Debilidades: ${formData.totalDebilidades}\n`;
      contextMessage += `- Amenazas: ${formData.totalAmenazas}\n`;
    }
    
    contextMessage += `\nPuedes ayudar al usuario a:\n`;
    contextMessage += `- Analizar el balance entre los cuadrantes DOFA\n`;
    contextMessage += `- Sugerir estrategias FO, FA, DO, DA\n`;
    contextMessage += `- Identificar fortalezas o debilidades faltantes\n`;
    contextMessage += `- Evaluar si los items están en el cuadrante correcto\n`;
    contextMessage += `- Mejorar la redacción de los items\n`;
    contextMessage += `- Recomendar prioridades de acción\n`;
  }

  if (module === 'evaluacion') {
    contextMessage += `\nEl usuario está en la pantalla de Evaluación de Riesgos.\n`;
    
    if (formData?.riesgoId) {
      contextMessage += `\n=== RIESGO EN EVALUACIÓN ===\n`;
      contextMessage += `ID: ${formData.riesgoId}\n`;
      contextMessage += `Descripción: ${formData.riesgoDescripcion}\n`;
      contextMessage += `Clasificación: ${formData.clasificacion}\n`;
      contextMessage += `Pestaña activa: ${formData.tabActiva}\n\n`;
      
      if (formData.tabActiva === 'inherente-negativa' || formData.tabActiva === 'inherente-positiva') {
        const tipo = formData.tabActiva === 'inherente-negativa' ? 'Negativa' : 'Positiva';
        const impactos = formData.tabActiva === 'inherente-negativa' ? formData.impactosNegativos : formData.impactosPositivos;
        const frecuencia = formData.tabActiva === 'inherente-negativa' ? formData.frecuenciaNegativa : formData.frecuenciaPositiva;
        
        contextMessage += `=== EVALUACIÓN INHERENTE ${tipo.toUpperCase()} ===\n`;
        contextMessage += `Impactos configurados:\n`;
        if (impactos) {
          Object.entries(impactos).forEach(([dim, val]) => {
            contextMessage += `  - ${dim}: ${val}/5\n`;
          });
        }
        contextMessage += `Frecuencia: ${frecuencia}/5\n`;
        
        if (formData.nivelRiesgoNegativo && formData.tabActiva === 'inherente-negativa') {
          contextMessage += `Nivel de Riesgo: ${formData.nivelRiesgoNegativo}\n`;
          contextMessage += `Riesgo Inherente: ${formData.riesgoInherenteNegativo}\n`;
        }
        
        contextMessage += `\nRequiere controles: ${formData.requiereControles ? 'SÍ' : 'NO'}\n`;
      }
      
      if (formData.tabActiva === 'causas') {
        contextMessage += `=== CAUSAS DEL RIESGO ===\n`;
        contextMessage += `Total de causas: ${formData.totalCausas}\n`;
        if (formData.causasVisibles && formData.causasVisibles.length > 0) {
          contextMessage += `Causas visibles:\n`;
          formData.causasVisibles.forEach((c: any, idx: number) => {
            contextMessage += `  ${idx + 1}. ${c.descripcion} (Fuente: ${c.fuenteCausa})\n`;
          });
        }
      }
      
      if (formData.tabActiva === 'controles') {
        contextMessage += `=== CONTROLES DEL RIESGO ===\n`;
        contextMessage += `Total de controles: ${formData.totalControles}\n`;
        if (formData.controlesVisibles && formData.controlesVisibles.length > 0) {
          contextMessage += `Controles visibles:\n`;
          formData.controlesVisibles.forEach((c: any, idx: number) => {
            contextMessage += `  ${idx + 1}. ${c.descripcion} (Tipo: ${c.tipo}, Efectividad: ${c.efectividad})\n`;
          });
        }
      }
    }
    
    contextMessage += `\nPuedes ayudar al usuario a:\n`;
    contextMessage += `- Validar que los impactos estén correctamente evaluados\n`;
    contextMessage += `- Sugerir causas potenciales del riesgo\n`;
    contextMessage += `- Recomendar controles efectivos\n`;
    contextMessage += `- Evaluar si el nivel de riesgo es coherente\n`;
    contextMessage += `- Verificar que la evaluación esté completa\n`;
  }

  if (module === 'mapas') {
    const tipoMapa = formData?.tipoMapa === 'residual' ? 'Residual' : 'Inherente';
    contextMessage += `\nEl usuario está en la pantalla de Mapa de Riesgos (${tipoMapa}).\n`;
    
    if (formData?.filtros) {
      contextMessage += `\nFiltros aplicados:\n`;
      contextMessage += `- Clasificación: ${formData.filtros.clasificacion}\n`;
      contextMessage += `- Área: ${formData.filtros.area}\n`;
      contextMessage += `- Proceso: ${formData.filtros.proceso}\n`;
    }
    
    if (formData?.totalRiesgos !== undefined) {
      contextMessage += `\nTotal de riesgos en el mapa: ${formData.totalRiesgos}\n`;
    }
    
    if (formData?.estadisticas) {
      contextMessage += `\n=== ESTADÍSTICAS DEL MAPA ===\n`;
      contextMessage += `\nRiesgo Inherente:\n`;
      contextMessage += `- Críticos: ${formData.estadisticas.inherente.criticos}\n`;
      contextMessage += `- Altos: ${formData.estadisticas.inherente.altos}\n`;
      contextMessage += `- Medios: ${formData.estadisticas.inherente.medios}\n`;
      contextMessage += `- Bajos: ${formData.estadisticas.inherente.bajos}\n`;
      
      contextMessage += `\nRiesgo Residual:\n`;
      contextMessage += `- Críticos: ${formData.estadisticas.residual.criticos}\n`;
      contextMessage += `- Altos: ${formData.estadisticas.residual.altos}\n`;
      contextMessage += `- Medios: ${formData.estadisticas.residual.medios}\n`;
      contextMessage += `- Bajos: ${formData.estadisticas.residual.bajos}\n`;
    }
    
    if (formData?.topMitigaciones && formData.topMitigaciones.length > 0) {
      contextMessage += `\nTop 3 Mitigaciones (mayor reducción):\n`;
      formData.topMitigaciones.forEach((m: any, idx: number) => {
        contextMessage += `  ${idx + 1}. Riesgo ${m.id}: Reducción de ${m.reduccion} puntos (Nivel residual: ${m.nivelResidual})\n`;
      });
    }
    
    if (formData?.criticosPersistentes !== undefined) {
      contextMessage += `\nRiesgos críticos persistentes (aún críticos después de controles): ${formData.criticosPersistentes}\n`;
    }
    
    if (formData?.eficaciaGlobal !== undefined) {
      contextMessage += `Eficacia global de mitigación: ${formData.eficaciaGlobal}%\n`;
    }
    
    contextMessage += `\nPuedes ayudar al usuario a:\n`;
    contextMessage += `- Analizar la distribución de riesgos en el mapa\n`;
    contextMessage += `- Identificar patrones de concentración de riesgos\n`;
    contextMessage += `- Evaluar la efectividad de los controles (comparando inherente vs residual)\n`;
    contextMessage += `- Recomendar prioridades de acción según el nivel de riesgo\n`;
    contextMessage += `- Sugerir estrategias de mitigación para riesgos críticos\n`;
    contextMessage += `- Interpretar las estadísticas y tendencias del mapa\n`;
  }

  if (module === 'procesos' && screen === 'ficha') {
    contextMessage += `\nEl usuario está en la pantalla de Ficha del Proceso.\n`;
    
    if (formData?.procesoNombre) {
      contextMessage += `\n=== INFORMACIÓN DEL PROCESO ===\n`;
      contextMessage += `Proceso: ${formData.procesoNombre}\n`;
      contextMessage += `Vicepresidencia: ${formData.vicepresidencia || 'No definida'}\n`;
      contextMessage += `Gerencia: ${formData.gerencia || 'No definida'}\n`;
      contextMessage += `Sigla: ${formData.sigla || 'No definida'}\n`;
      contextMessage += `Área: ${formData.area || 'No definida'}\n`;
      contextMessage += `Responsable: ${formData.responsable || 'No definido'}\n`;
      contextMessage += `Fecha de creación: ${formData.fechaCreacion || 'No definida'}\n`;
      contextMessage += `\nObjetivo del proceso:\n${formData.objetivoProceso || '(No definido)'}\n`;
      
      if (formData.hasChanges) {
        contextMessage += `\n⚠️ Hay cambios sin guardar en el formulario.\n`;
      }
    }
    
    contextMessage += `\nPuedes ayudar al usuario a:\n`;
    contextMessage += `- Redactar o mejorar el objetivo del proceso\n`;
    contextMessage += `- Validar que la información esté completa\n`;
    contextMessage += `- Sugerir mejoras en la descripción del objetivo\n`;
    contextMessage += `- Verificar coherencia entre el objetivo y el tipo de proceso\n`;
  }

  if (module === 'dashboard' && screen === 'supervisor') {
    contextMessage += `\nEl usuario está en el Dashboard del Supervisor de Riesgos.\n`;
    
    if (formData?.filtros) {
      contextMessage += `\nFiltros aplicados:\n`;
      contextMessage += `- Proceso: ${formData.filtros.proceso}\n`;
      contextMessage += `- Número de riesgo: ${formData.filtros.numeroRiesgo}\n`;
      contextMessage += `- Origen: ${formData.filtros.origen}\n`;
      contextMessage += `- Búsqueda: ${formData.filtros.busqueda}\n`;
    }
    
    if (formData?.estadisticas) {
      contextMessage += `\n=== ESTADÍSTICAS DE RIESGOS ===\n`;
      contextMessage += `Total de riesgos: ${formData.estadisticas.totalRiesgos}\n`;
      contextMessage += `- Críticos: ${formData.estadisticas.criticos}\n`;
      contextMessage += `- Altos: ${formData.estadisticas.altos}\n`;
      contextMessage += `- Medios: ${formData.estadisticas.medios}\n`;
      contextMessage += `- Bajos: ${formData.estadisticas.bajos}\n`;
      contextMessage += `- Fuera de apetito: ${formData.estadisticas.fueraApetito}\n`;
    }
    
    if (formData?.metricas) {
      contextMessage += `\n=== MÉTRICAS OPERATIVAS ===\n`;
      contextMessage += `Incidencias: ${formData.metricas.totalIncidencias} (${formData.metricas.incidenciasAbiertas} abiertas)\n`;
      contextMessage += `Causas identificadas: ${formData.metricas.totalCausas}\n`;
      contextMessage += `Planes de acción: ${formData.metricas.totalPlanes} (${formData.metricas.planesEnProgreso} en progreso, ${formData.metricas.planesCompletados} completados)\n`;
    }
    
    if (formData?.topRiesgos && formData.topRiesgos.length > 0) {
      contextMessage += `\nTop 5 Riesgos:\n`;
      formData.topRiesgos.forEach((r: any, idx: number) => {
        contextMessage += `  ${idx + 1}. ${r.codigo}: ${r.descripcion.substring(0, 60)}... (Nivel: ${r.nivel})\n`;
      });
    }
    
    contextMessage += `\nPuedes ayudar al usuario a:\n`;
    contextMessage += `- Analizar las estadísticas y tendencias de riesgos\n`;
    contextMessage += `- Identificar áreas de mayor concentración de riesgos\n`;
    contextMessage += `- Recomendar acciones prioritarias según los niveles de riesgo\n`;
    contextMessage += `- Evaluar el progreso de los planes de acción\n`;
    contextMessage += `- Sugerir estrategias para riesgos fuera de apetito\n`;
  }

  if (module === 'riesgos' && screen === 'priorizacion') {
    contextMessage += `\nEl usuario está en la pantalla de Priorización de Riesgos.\n`;
    
    if (formData?.totalPriorizaciones !== undefined) {
      contextMessage += `\nTotal de priorizaciones: ${formData.totalPriorizaciones}\n`;
    }
    
    if (formData?.distribucionRespuestas) {
      contextMessage += `\n=== DISTRIBUCIÓN DE RESPUESTAS ===\n`;
      contextMessage += `- Evitar: ${formData.distribucionRespuestas.evitar}\n`;
      contextMessage += `- Reducir: ${formData.distribucionRespuestas.reducir}\n`;
      contextMessage += `- Compartir: ${formData.distribucionRespuestas.compartir}\n`;
      contextMessage += `- Aceptar: ${formData.distribucionRespuestas.aceptar}\n`;
    }
    
    if (formData?.priorizacionesVisibles && formData.priorizacionesVisibles.length > 0) {
      contextMessage += `\nPriorizaciones visibles (primeras 5):\n`;
      formData.priorizacionesVisibles.forEach((p: any, idx: number) => {
        contextMessage += `  ${idx + 1}. Riesgo ${p.riesgoNumero}: ${p.descripcion.substring(0, 50)}...\n`;
        contextMessage += `     Nivel: ${p.nivel} | Respuesta: ${p.respuesta} | Responsable: ${p.responsable}\n`;
      });
    }
    
    contextMessage += `\nPuedes ayudar al usuario a:\n`;
    contextMessage += `- Recomendar la respuesta más adecuada para cada riesgo (Evitar, Reducir, Compartir, Aceptar)\n`;
    contextMessage += `- Evaluar si la distribución de respuestas es equilibrada\n`;
    contextMessage += `- Sugerir responsables apropiados según el tipo de riesgo\n`;
    contextMessage += `- Validar que los riesgos críticos tengan respuestas asignadas\n`;
    contextMessage += `- Identificar riesgos que requieren atención inmediata\n`;
  }

  if (module === 'procesos' && screen === 'contexto') {
    contextMessage += `\nEl usuario está en la pantalla de Contexto Interno/Externo.\n`;
    contextMessage += `Puede ayudar con:\n`;
    contextMessage += `- Sugerir factores de contexto relevantes\n`;
    contextMessage += `- Validar que los factores sean específicos y medibles\n`;
    contextMessage += `- Recomendar cómo conectar contexto con DOFA\n`;
    contextMessage += `- Verificar balance entre factores positivos y negativos\n`;
  }

  if (module === 'procesos' && screen === 'dofa') {
    contextMessage += `\nEl usuario está en la pantalla de Análisis DOFA.\n`;
    contextMessage += `Puede ayudar con:\n`;
    contextMessage += `- Sugerir fortalezas, oportunidades, debilidades y amenazas\n`;
    contextMessage += `- Validar que los ítems DOFA sean concretos\n`;
    contextMessage += `- Recomendar estrategias basadas en el DOFA\n`;
    contextMessage += `- Verificar coherencia con el contexto interno/externo\n`;
  }

  return contextMessage;
}

async function getContextoInternoResumen(userId: number, mensaje: string) {
  const texto = normalizarTexto(mensaje);

  // Buscar procesos donde el usuario es responsable/director
  const asignaciones = await prisma.procesoResponsable.findMany({
    where: { usuarioId: userId, modo: { in: ['director', 'proceso'] } },
    select: {
      proceso: {
        select: { id: true, nombre: true, sigla: true },
      },
    },
  });

  if (!asignaciones.length) return null;

  // Intentar identificar el proceso por nombre o sigla dentro del mensaje
  const candidato = asignaciones.find((a) => {
    const nombre = a.proceso?.nombre ? normalizarTexto(a.proceso.nombre) : '';
    const sigla = a.proceso?.sigla ? normalizarTexto(a.proceso.sigla) : '';
    return (
      (nombre && texto.includes(nombre)) ||
      (sigla && texto.includes(sigla)) ||
      // fallback: si solo hay un proceso asignado, usarlo
      asignaciones.length === 1
    );
  });

  const proceso = candidato?.proceso;
  if (!proceso) return null;

  const items = await prisma.contextoItem.findMany({
    where: {
      procesoId: proceso.id,
      tipo: { startsWith: 'INTERNO_' },
    },
    orderBy: { createdAt: 'asc' },
  });

  if (!items.length) return null;

  const lineas: string[] = [];
  lineas.push(
    `Proceso: ${proceso.nombre}${proceso.sigla ? ` [${proceso.sigla}]` : ''}`,
  );

  const agrupado: Record<
    string,
    { positivos: string[]; negativos: string[] }
  > = {};

  for (const it of items) {
    const label = CONTEXTO_INTERNO_LABELS[it.tipo] || it.tipo;
    if (!agrupado[label]) {
      agrupado[label] = { positivos: [], negativos: [] };
    }
    const textoItem = `- ${it.descripcion}`;
    if (String(it.signo).toUpperCase() === 'NEGATIVO') {
      agrupado[label].negativos.push(textoItem);
    } else {
      agrupado[label].positivos.push(textoItem);
    }
  }

  Object.entries(agrupado).forEach(([label, { positivos, negativos }]) => {
    if (!positivos.length && !negativos.length) return;
    lineas.push(`\n${label.toUpperCase()}:`);
    if (positivos.length) {
      lineas.push('  POSITIVOS:');
      positivos.forEach((l) => lineas.push('  ' + l));
    }
    if (negativos.length) {
      lineas.push('  NEGATIVOS:');
      negativos.forEach((l) => lineas.push('  ' + l));
    }
  });

  return lineas.join('\n');
}

type ControlesPlanesContext = { lines: string[]; total: number };

/** Obtiene riesgos, procesos, controles y planes para el usuario. Usa Redis si está disponible (sin screenContext). */
async function getContextoIA(
  userId: number,
  message: string,
  screenContext?: ScreenContext,
): Promise<{
  riesgos: string[];
  procesos: string[];
  controles: ControlesPlanesContext;
  planes: ControlesPlanesContext;
  contextoInterno: string | null;
}> {
  const takes = getContextoIATakes(screenContext);
  const cacheKey = `${IA_CONTEXT_CACHE_PREFIX}${userId}`;

  let riesgos: string[];
  let procesos: string[];
  let controles: ControlesPlanesContext;
  let planes: ControlesPlanesContext;

  if (!screenContext) {
    const cached = await redisGet<{
      riesgos: string[];
      procesos: string[];
      controles: ControlesPlanesContext;
      planes: ControlesPlanesContext;
    }>(cacheKey);

    if (cached) {
      riesgos = cached.riesgos;
      procesos = cached.procesos;
      controles = cached.controles;
      planes = cached.planes;
    } else {
      [riesgos, procesos, controles, planes] = await Promise.all([
        getRiesgosResumen(userId, takes.riesgosTake),
        getProcesosResumen(userId),
        getControlesResumen(userId, takes.controlesTake),
        getPlanesResumen(userId, takes.planesTake),
      ]);
      await redisSet(cacheKey, { riesgos, procesos, controles, planes }, IA_CONTEXT_CACHE_TTL);
    }
  } else {
    [riesgos, procesos, controles, planes] = await Promise.all([
      getRiesgosResumen(userId, takes.riesgosTake),
      getProcesosResumen(userId),
      getControlesResumen(userId, takes.controlesTake),
      getPlanesResumen(userId, takes.planesTake),
    ]);
  }

  const contextoInterno = takes.skipContextoInterno
    ? null
    : await getContextoInternoResumen(userId, message);
  return { riesgos, procesos, controles, planes, contextoInterno };
}

export async function procesarMensajeIA(payload: IAUserMessagePayload): Promise<IAResponsePayload> {
  const t0 = Date.now();
  const { userId, userName, rol, cargo, message, conversationId, screenContext } = payload; // NUEVO: screenContext
  console.log(`[IA] Petición para ${userName} (${userId}) - Pantalla: ${screenContext?.module}/${screenContext?.screen} - Prompt: ${PROMPT_ID}`);

  const { conversaciones } = await getMongo();
  const now = new Date();

  let conv: any = null;
  if (conversationId) {
    try {
      conv = await conversaciones.findOne({ _id: new ObjectId(conversationId), userId });
    } catch { conv = null; }
  }
  if (!conv) {
    const res = await conversaciones.insertOne({ userId, createdAt: now, updatedAt: now, messages: [] });
    conv = { _id: res.insertedId, messages: [] };
  }

  const shortHistory = (conv.messages || []).slice(-10);
  const numericUserId = Number(userId);
  const contextoData: ContextoMensaje[] = [];

  // System message desde el doc del repo (primer mensaje al modelo, como está en la base)
  contextoData.push({
    role: 'developer',
    content: getSystemMessageCora(),
  });

  const nombreReal = userName?.trim() || 'Usuario';
  const rolReal = rol?.trim() || 'Usuario';
  const cargoReal = cargo?.trim() || '';
  contextoData.push({
    role: 'developer',
    content: `USUARIO_ACTUAL:\nNombre: ${nombreReal}\nRol: ${rolReal}\nCargo: ${cargoReal || 'No especificado'}\nUsa siempre estos valores al responder. No escribas {{nombre_usuario}}, {{rol}} ni {{cargo}}.`,
  });

  // Pantalla primero: el modelo sabe dónde está y qué proceso mira antes del volumen global
  if (screenContext) {
    const screenContextMessage = await buildScreenContextMessage(screenContext);
    if (screenContextMessage) {
      contextoData.push({
        role: 'developer',
        content: screenContextMessage,
      });
    }
  }

  if (numericUserId > 0) {
    const { riesgos, procesos, controles, planes, contextoInterno } = await getContextoIA(
      numericUserId,
      message,
      screenContext,
    );

    if (riesgos.length) contextoData.push({ role: 'developer', content: 'RIESGOS:\n' + riesgos.join('\n') });
    if (procesos.length) contextoData.push({ role: 'developer', content: 'PROCESOS:\n' + procesos.join('\n') });

    if (controles.lines?.length || controles.total > 0) {
      contextoData.push({
        role: 'developer',
        content:
          `CONTROLES (vista global en BD; asociados a riesgo y proceso):\n` +
          `Total en el sistema: ${controles.total} controles.\n` +
          `${controles.lines?.join('\n') ?? ''}`,
      });
    }

    if (planes.lines?.length || planes.total > 0) {
      contextoData.push({
        role: 'developer',
        content:
          `PLANES (tabla PlanAccion; vista global por riesgo/proceso):\n` +
          `Total en el sistema: ${planes.total} planes de acción.\n` +
          `${planes.lines?.join('\n') ?? ''}`,
      });
    }

    if (contextoInterno) contextoData.push({ role: 'developer', content: 'CONTEXTO_INTERNO:\n' + contextoInterno });
  }

  try {
    const answer = await generarRespuestaConResponses({
      userId,
      userName,
      rol,
      cargo,
      contextoData,
      shortHistory,
      message,
    });

    const updateMsgs = [
      ...shortHistory,
      { role: 'user', content: message, createdAt: now },
      { role: 'assistant', content: answer, createdAt: new Date() },
    ];

    // Guardado asíncrono optimizado
    conversaciones
      .updateOne(
        { _id: conv._id },
        { $set: { updatedAt: new Date(), messages: updateMsgs.slice(-20) } },
      )
      .catch(console.error);

    console.log(`[IA] Respuesta lista en ${Date.now() - t0}ms`);
    return { conversationId: String(conv._id), answer };
  } catch (error: any) {
    console.error('[IA] Error en OpenAI:', error?.message || error);
    throw error;
  }
}

type ContextoMensaje = { role: string; content: string };

async function generarRespuestaConResponses(opts: {
  userId: string;
  userName?: string | null;
  rol?: string | null;
  cargo?: string | null;
  contextoData: ContextoMensaje[];
  shortHistory: any[];
  message: string;
}) {
  const { userId, userName, rol, cargo, contextoData, shortHistory, message } = opts;

  const input = [
    ...contextoData.map((m) => ({
      role: m.role,
      content: m.content,
    })),
    ...shortHistory.map((m: any) => ({
      role: m.role || 'user',
      content: m.content || '',
    })),
    {
      role: 'user',
      content: message,
    },
  ];

  const response = await openai.responses.create({
    model: 'gpt-4.1-mini',
    // Cast a any para evitar problemas de typings con prompt_id
    prompt: {
      ...({
        id: PROMPT_ID,
        variables: {
          user_id: userId,
          nombre_usuario: userName ?? '',
          rol: rol ?? '',
          cargo: cargo ?? '',
        },
      } as any),
    },
    input,
    max_output_tokens: IA_STREAM_MAX_OUTPUT,
    temperature: 0.35,
  });

  // La SDK agrega output_text con todo el texto generado
  const answer =
    // @ts-ignore - propiedad de conveniencia de la SDK
    (response as any).output_text ||
    (response.output &&
      response.output[0] &&
      (response.output[0] as any).content &&
      (response.output[0] as any).content[0]?.text) ||
    'Lo siento, no pude generar una respuesta.';

  return answer;
}

export async function procesarMensajeIAStream(
  payload: IAUserMessagePayload,
  onDelta: (chunk: string) => void,
): Promise<IAResponsePayload> {
  const t0 = Date.now();
  const { userId, userName, rol, cargo, message, conversationId, screenContext } = payload; // NUEVO: screenContext
  console.log(`[IA] [stream] Petición para ${userName} (${userId}) - Pantalla: ${screenContext?.module}/${screenContext?.screen} - Prompt: ${PROMPT_ID}`);

  const { conversaciones } = await getMongo();
  const now = new Date();

  let conv: any = null;
  if (conversationId) {
    try {
      conv = await conversaciones.findOne({ _id: new ObjectId(conversationId), userId });
    } catch {
      conv = null;
    }
  }
  if (!conv) {
    const res = await conversaciones.insertOne({
      userId,
      createdAt: now,
      updatedAt: now,
      messages: [],
    });
    conv = { _id: res.insertedId, messages: [] };
  }

  const shortHistory = (conv.messages || []).slice(-10);
  const numericUserId = Number(userId);
  const contextoData: ContextoMensaje[] = [];

  // System message desde el doc del repo (primer mensaje al modelo, como está en la base)
  contextoData.push({
    role: 'developer',
    content: getSystemMessageCora(),
  });

  const nombreReal = userName?.trim() || 'Usuario';
  const rolReal = rol?.trim() || 'Usuario';
  const cargoReal = cargo?.trim() || '';
  contextoData.push({
    role: 'developer',
    content: `USUARIO_ACTUAL:\nNombre: ${nombreReal}\nRol: ${rolReal}\nCargo: ${cargoReal || 'No especificado'}\nUsa siempre estos valores al responder. No escribas {{nombre_usuario}}, {{rol}} ni {{cargo}}.`,
  });

  if (screenContext) {
    const screenContextMessage = await buildScreenContextMessage(screenContext);
    if (screenContextMessage) {
      contextoData.push({
        role: 'developer',
        content: screenContextMessage,
      });
    }
  }

  if (numericUserId > 0) {
    const { riesgos, procesos, controles, planes, contextoInterno } = await getContextoIA(
      numericUserId,
      message,
      screenContext,
    );

    if (riesgos.length)
      contextoData.push({ role: 'developer', content: 'RIESGOS:\n' + riesgos.join('\n') });
    if (procesos.length)
      contextoData.push({ role: 'developer', content: 'PROCESOS:\n' + procesos.join('\n') });

    if (controles.lines?.length || controles.total > 0) {
      contextoData.push({
        role: 'developer',
        content:
          `CONTROLES (vista global en BD; asociados a riesgo y proceso):\n` +
          `Total en el sistema: ${controles.total} controles.\n` +
          `${controles.lines?.join('\n') ?? ''}`,
      });
    }

    if (planes.lines?.length || planes.total > 0) {
      contextoData.push({
        role: 'developer',
        content:
          `PLANES (tabla PlanAccion; vista global por riesgo/proceso):\n` +
          `Total en el sistema: ${planes.total} planes de acción.\n` +
          `${planes.lines?.join('\n') ?? ''}`,
      });
    }

    if (contextoInterno)
      contextoData.push({ role: 'developer', content: 'CONTEXTO_INTERNO:\n' + contextoInterno });
  }

  try {
    const input = [
      ...contextoData.map((m) => ({
        role: m.role,
        content: m.content,
      })),
      ...shortHistory.map((m: any) => ({
        role: m.role || 'user',
        content: m.content || '',
      })),
      {
        role: 'user',
        content: message,
      },
    ];

    // stream: true debe ir en el body (primer argumento), no en options
    const stream = await openai.responses.create({
      model: 'gpt-4.1-mini',
      stream: true,
      prompt: {
        ...({
          id: PROMPT_ID,
          variables: {
            user_id: userId,
            nombre_usuario: userName ?? '',
            rol: rol ?? '',
            cargo: cargo ?? '',
          },
        } as any),
      },
      input,
      max_output_tokens: IA_STREAM_MAX_OUTPUT,
      temperature: 0.35,
    });

    let fullAnswer = '';

    if (stream == null || typeof (stream as any)[Symbol.asyncIterator] !== 'function') {
      throw new Error('La API no devolvió un stream iterable. Verifica que stream: true esté en el body.');
    }

    for await (const event of stream as AsyncIterable<{ type?: string; delta?: string }>) {
      const t = (event as { type?: string })?.type;
      // Texto del asistente (Responses API). No usar .endsWith('.delta') genérico: hay otros deltas (p. ej. reasoning).
      if (t === 'response.output_text.delta' || t === 'response.text.delta') {
        const delta: string = (event as { delta?: string }).delta ?? '';
        if (delta) {
          fullAnswer += delta;
          onDelta(delta);
        }
      }
    }

    const updateMsgs = [
      ...shortHistory,
      { role: 'user', content: message, createdAt: now },
      { role: 'assistant', content: fullAnswer, createdAt: new Date() },
    ];

    conversaciones
      .updateOne(
        { _id: conv._id },
        { $set: { updatedAt: new Date(), messages: updateMsgs.slice(-20) } },
      )
      .catch(console.error);

    console.log(`[IA] [stream] Respuesta lista en ${Date.now() - t0}ms`);
    return { conversationId: String(conv._id), answer: fullAnswer };
  } catch (error: any) {
    console.error('[IA] [stream] Error en OpenAI:', error?.message || error);
    throw error;
  }
}

export async function obtenerConversacionesUsuario(userId: string) {
  const { conversaciones } = await getMongo();
  // Optimizamos la carga trayendo solo el título y el ÚLTIMO mensaje para el preview
  const docs = await conversaciones.find(
    { userId },
    { 
      projection: { title: 1, updatedAt: 1, messages: { $slice: -1 } },
      sort: { updatedAt: -1 },
      limit: 30 
    }
  ).toArray();

  return docs.map(d => {
    const lastMsg = (d.messages && d.messages.length > 0) ? d.messages[0].content : '';
    return {
      id: d._id.toString(),
      title: d.title || null,
      preview: lastMsg ? lastMsg.substring(0, 60) + (lastMsg.length > 60 ? '...' : '') : 'Nueva Conversación',
      updatedAt: d.updatedAt
    };
  });
}

export async function eliminarConversacion(id: string, userId: string) {
  const { conversaciones } = await getMongo();
  try { return (await conversaciones.deleteOne({ _id: new ObjectId(id), userId })).deletedCount > 0; } catch { return false; }
}

export async function renombrarConversacion(id: string, userId: string, title: string) {
  const { conversaciones } = await getMongo();
  try { return (await conversaciones.updateOne({ _id: new ObjectId(id), userId }, { $set: { title, updatedAt: new Date() } })).modifiedCount > 0; } catch { return false; }
}

export async function obtenerConversacion(id: string, userId: string) {
  const { conversaciones } = await getMongo();
  try { return await conversaciones.findOne({ _id: new ObjectId(id), userId }); } catch { return null; }
}

export interface IAUserMessagePayload { userId: string; userName?: string | null; rol?: string | null; cargo?: string | null; message: string; conversationId?: string; screenContext?: ScreenContext; }
export interface IAResponsePayload { conversationId: string; answer: string; }

export interface ScreenContext {
  module: string;
  screen: string;
  action: 'create' | 'edit' | 'view';
  processId?: number;
  riskId?: number;
  formData?: Record<string, any>;
  route?: string;
}


