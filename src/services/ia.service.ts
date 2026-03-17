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

async function getRiesgosResumen(userId: number) {
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
    take: 100,
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

async function getControlesResumen(userId: number): Promise<{ lines: string[]; total: number }> {
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
      take: CONTROLES_TAKE,
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

async function getPlanesResumen(userId: number): Promise<{ lines: string[]; total: number }> {
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
      take: PLANES_TAKE,
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

/** Obtiene riesgos, procesos, controles y planes para el usuario. Usa Redis si está disponible. */
async function getContextoIA(userId: number, message: string): Promise<{
  riesgos: string[];
  procesos: string[];
  controles: ControlesPlanesContext;
  planes: ControlesPlanesContext;
  contextoInterno: string | null;
}> {
  const cacheKey = `${IA_CONTEXT_CACHE_PREFIX}${userId}`;
  const cached = await redisGet<{ riesgos: string[]; procesos: string[]; controles: ControlesPlanesContext; planes: ControlesPlanesContext }>(cacheKey);

  let riesgos: string[];
  let procesos: string[];
  let controles: ControlesPlanesContext;
  let planes: ControlesPlanesContext;

  if (cached) {
    riesgos = cached.riesgos;
    procesos = cached.procesos;
    controles = cached.controles;
    planes = cached.planes;
  } else {
    [riesgos, procesos, controles, planes] = await Promise.all([
      getRiesgosResumen(userId),
      getProcesosResumen(userId),
      getControlesResumen(userId),
      getPlanesResumen(userId),
    ]);
    await redisSet(cacheKey, { riesgos, procesos, controles, planes }, IA_CONTEXT_CACHE_TTL);
  }

  const contextoInterno = await getContextoInternoResumen(userId, message);
  return { riesgos, procesos, controles, planes, contextoInterno };
}

export async function procesarMensajeIA(payload: IAUserMessagePayload): Promise<IAResponsePayload> {
  const t0 = Date.now();
  const { userId, userName, rol, cargo, message, conversationId } = payload;
  console.log(`[IA] Petición para ${userName} (${userId}) - Prompt: ${PROMPT_ID}`);

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

  if (numericUserId > 0) {
    const { riesgos, procesos, controles, planes, contextoInterno } = await getContextoIA(numericUserId, message);

    if (riesgos.length) contextoData.push({ role: 'developer', content: 'RIESGOS:\n' + riesgos.join('\n') });
    if (procesos.length) contextoData.push({ role: 'developer', content: 'PROCESOS:\n' + procesos.join('\n') });
    if (controles.lines?.length || controles.total > 0) {
      contextoData.push({
        role: 'developer',
        content: `CONTROLES:\nTotal en el sistema: ${controles.total} controles.\n${controles.lines?.join('\n') ?? ''}`,
      });
    }
    if (planes.lines?.length || planes.total > 0) {
      contextoData.push({
        role: 'developer',
        content: `PLANES:\nTotal en el sistema: ${planes.total} planes de acción.\n${planes.lines?.join('\n') ?? ''}`,
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
    max_output_tokens: 600,
    temperature: 0.5,
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
  const { userId, userName, rol, cargo, message, conversationId } = payload;
  console.log(`[IA] [stream] Petición para ${userName} (${userId}) - Prompt: ${PROMPT_ID}`);

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

  if (numericUserId > 0) {
    const { riesgos, procesos, controles, planes, contextoInterno } = await getContextoIA(numericUserId, message);

    if (riesgos.length)
      contextoData.push({ role: 'developer', content: 'RIESGOS:\n' + riesgos.join('\n') });
    if (procesos.length)
      contextoData.push({ role: 'developer', content: 'PROCESOS:\n' + procesos.join('\n') });
    if (controles.lines?.length || controles.total > 0) {
      contextoData.push({
        role: 'developer',
        content: `CONTROLES:\nTotal en el sistema: ${controles.total} controles.\n${controles.lines?.join('\n') ?? ''}`,
      });
    }
    if (planes.lines?.length || planes.total > 0) {
      contextoData.push({
        role: 'developer',
        content: `PLANES:\nTotal en el sistema: ${planes.total} planes de acción.\n${planes.lines?.join('\n') ?? ''}`,
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
      max_output_tokens: 600,
      temperature: 0.5,
    });

    let fullAnswer = '';

    if (stream == null || typeof (stream as any)[Symbol.asyncIterator] !== 'function') {
      throw new Error('La API no devolvió un stream iterable. Verifica que stream: true esté en el body.');
    }

    for await (const event of stream as AsyncIterable<{ type?: string; delta?: string }>) {
      if (event?.type === 'response.output_text.delta') {
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

export interface IAUserMessagePayload { userId: string; userName?: string | null; rol?: string | null; cargo?: string | null; message: string; conversationId?: string; }
export interface IAResponsePayload { conversationId: string; answer: string; }


