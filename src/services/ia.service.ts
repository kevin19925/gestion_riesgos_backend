import OpenAI from 'openai';
import { MongoClient, Db, Collection, ObjectId } from 'mongodb';
import prisma from '../prisma';

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

const MONGODB_URI = process.env.MONGODB_URI!;
const MONGODB_DB_NAME = process.env.MONGODB_DB_NAME || 'cora_riesgos';
const COLECCION_CONVERSACIONES = process.env.COLECCION_CONVERSACIONES || 'conversaciones';
const PROMPT_ID = process.env.PROMPT_ID!;

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
      numeroIdentificacion: true, numero: true, descripcion: true,
      proceso: { select: { nombre: true, sigla: true } }
    },
    take: 50
  });
  return riesgos.map(r => `- ${r.numeroIdentificacion || r.numero || 'R'}: ${r.descripcion} (${r.proceso?.nombre || 'N/A'})`);
}

async function getProcesosResumen(userId: number) {
  const asignaciones = await prisma.procesoResponsable.findMany({
    where: { usuarioId: userId, modo: { in: ['director', 'proceso'] } },
    select: { proceso: { select: { nombre: true, sigla: true } }, modo: true }
  });
  return asignaciones.map(a => `${a.proceso?.nombre} [${a.proceso?.sigla}] (Rol: ${a.modo})`);
}

async function getControlesResumen(userId: number) {
  const asignaciones = await prisma.procesoResponsable.findMany({
    where: { usuarioId: userId, modo: { in: ['director', 'proceso'] } },
    select: { procesoId: true }
  });
  const ids = asignaciones.map(a => a.procesoId);
  const controles = await prisma.controlRiesgo.findMany({
    where: { causaRiesgo: { riesgo: { procesoId: { in: ids } } } },
    select: { descripcion: true, causaRiesgo: { select: { riesgo: { select: { numeroIdentificacion: true, numero: true } } } } },
    take: 20
  });
  return controles.map(c => `- Control: ${c.descripcion} (Riesgo: ${c.causaRiesgo.riesgo.numeroIdentificacion || c.causaRiesgo.riesgo.numero})`);
}

async function getPlanesResumen(userId: number) {
  const planes = await prisma.planAccion.findMany({
    where: { responsable: { contains: String(userId) } },
    select: { descripcion: true, estado: true },
    take: 20
  });
  return planes.map(p => `- Plan: ${p.descripcion} [${p.estado}]`);
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
  if (numericUserId > 0) {
    // Siempre consultamos la base para este usuario, sin depender de palabras clave,
    // para forzar que la IA tenga contexto real de RIESGOS/PROCESOS/CONTROLES/PLANES/CONTEXTO INTERNO.
    const [riesgos, procesos, controles, planes, contextoInterno] = await Promise.all([
      getRiesgosResumen(numericUserId),
      getProcesosResumen(numericUserId),
      getControlesResumen(numericUserId),
      getPlanesResumen(numericUserId),
      getContextoInternoResumen(numericUserId, message),
    ]);

    if (riesgos.length) contextoData.push({ role: 'developer', content: 'RIESGOS:\n' + riesgos.join('\n') });
    if (procesos.length) contextoData.push({ role: 'developer', content: 'PROCESOS:\n' + procesos.join('\n') });
    if (controles.length) contextoData.push({ role: 'developer', content: 'CONTROLES:\n' + controles.join('\n') });
    if (planes.length) contextoData.push({ role: 'developer', content: 'PLANES:\n' + planes.join('\n') });
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
    temperature: 0.6,
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
  if (numericUserId > 0) {
    const [riesgos, procesos, controles, planes, contextoInterno] = await Promise.all([
      getRiesgosResumen(numericUserId),
      getProcesosResumen(numericUserId),
      getControlesResumen(numericUserId),
      getPlanesResumen(numericUserId),
      getContextoInternoResumen(numericUserId, message),
    ]);

    if (riesgos.length)
      contextoData.push({ role: 'developer', content: 'RIESGOS:\n' + riesgos.join('\n') });
    if (procesos.length)
      contextoData.push({ role: 'developer', content: 'PROCESOS:\n' + procesos.join('\n') });
    if (controles.length)
      contextoData.push({ role: 'developer', content: 'CONTROLES:\n' + controles.join('\n') });
    if (planes.length)
      contextoData.push({ role: 'developer', content: 'PLANES:\n' + planes.join('\n') });
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

    const stream = await openai.responses.create(
      {
        model: 'gpt-4.1-mini',
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
        temperature: 0.6,
      },
      { stream: true },
    );

    let fullAnswer = '';

    // Recorremos los eventos semánticos de streaming
    for await (const event of stream as any) {
      if (event.type === 'response.output_text.delta') {
        const delta: string = event.delta;
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


