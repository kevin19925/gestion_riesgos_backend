import { Request, Response } from 'express';
import prisma from '../prisma';
import { redisGet, redisSet, redisDel } from '../redisClient';
import { recalcularRiesgoInherenteDesdeCausas } from './riesgos.controller';
import { getDeleteErrorMessage } from '../utils/prismaErrors';
import {
    UI_CAMPOS_HABILITACION_CLAVE,
    defaultUiCamposHabilitacion,
    getUiCamposHabilitacionFlags,
} from '../services/uiCamposHabilitacion.service';
import {
    getReglaResidualIgualInherenteSiPlanCausa,
    setReglaResidualIgualInherenteSiPlanCausa,
} from '../services/reglaResidualPlanCausa.service';

const CACHE_TTL_CATALOGOS = 300; // 5 minutos
const CACHE_KEY_TIPOLOGIAS = 'catalogos:tipologias';
const CACHE_KEY_SUBTIPOS = 'catalogos:subtipos';

export const getListasValores = async (req: Request, res: Response) => {
    // Return hardcoded or dynamic lists
    const lists = [
        {
            id: '1',
            nombre: 'Vicepresidencias/Gerencias',
            codigo: 'vicepresidencias',
            valores: ['Abastecimiento', 'Gestión de proveedores y adquisiciones', 'Gestión de proyectos e implementación', 'Gestión de Soporte y Post Venta', 'Gestión Financiera y Administrativa', 'Gestión de TIC\'s', 'Seguridad de la información', 'Gestión Talento Humano'],
            activa: true,
        },
        {
            id: '2',
            nombre: 'Zonas',
            codigo: 'zonas',
            valores: ['Nacional', 'Sur', 'Oriente', 'Occidente', 'Norte', 'Central'],
            activa: true,
        }
    ];
    res.json(lists);
};

export const getTipologias = async (req: Request, res: Response) => {
    try {
        const cached = await redisGet<any>(CACHE_KEY_TIPOLOGIAS);
        if (cached) {
            res.setHeader('Cache-Control', 'public, max-age=300');
            return res.json(cached);
        }
        const tipologias = await prisma.tipoRiesgo.findMany({
            select: {
                id: true,
                nombre: true,
                descripcion: true,
                subtipos: {
                    select: { id: true, nombre: true, descripcion: true, tipoRiesgoId: true },
                    orderBy: { id: 'asc' },
                },
            }
        });
        await redisSet(CACHE_KEY_TIPOLOGIAS, tipologias, CACHE_TTL_CATALOGOS);
        res.setHeader('Cache-Control', 'public, max-age=300');
        res.json(tipologias);
    } catch (error: any) {
        console.error('[catalogos/getTipologias]', error?.message || error);
        res.status(500).json({ error: 'Error al cargar tipologías' });
    }
};

export const createTipologia = async (req: Request, res: Response) => {
    try {
        const { nombre, descripcion } = req.body;
        const newTipologia = await prisma.tipoRiesgo.create({
            data: { nombre: String(nombre).trim(), descripcion: descripcion != null ? String(descripcion).trim() || null : null }
        });
        await redisDel(CACHE_KEY_TIPOLOGIAS);
        await redisDel(CACHE_KEY_SUBTIPOS);
        res.status(201).json(newTipologia);
    } catch (error) {
        res.status(500).json({ error: 'Error creating tipologia' });
    }
};

export const updateTipologia = async (req: Request, res: Response) => {
    const id = Number(req.params.id);
    try {
        const { nombre, descripcion } = req.body;
        const updated = await prisma.tipoRiesgo.update({
            where: { id },
            data: {
                ...(nombre != null && nombre !== '' && { nombre: String(nombre).trim() }),
                ...(descripcion !== undefined && { descripcion: descripcion != null ? String(descripcion).trim() || null : null })
            }
        });
        await redisDel(CACHE_KEY_TIPOLOGIAS);
        await redisDel(CACHE_KEY_SUBTIPOS);
        res.json(updated);
    } catch (error) {
        res.status(500).json({ error: 'Error updating tipologia' });
    }
};

export const deleteTipologia = async (req: Request, res: Response) => {
    const id = Number(req.params.id);
    try {
        await prisma.tipoRiesgo.delete({ where: { id } });
        await redisDel(CACHE_KEY_TIPOLOGIAS);
        await redisDel(CACHE_KEY_SUBTIPOS);
        res.status(204).send();
    } catch (error) {
        const msg = getDeleteErrorMessage(error, 'tipología', 'subtipos o riesgos asociados');
        const status = (error as any)?.code === 'P2025' ? 404 : (error as any)?.code === 'P2003' ? 400 : 500;
        res.status(status).json({ error: msg });
    }
};

export const getSubtipos = async (req: Request, res: Response) => {
    try {
        const cached = await redisGet<any>(CACHE_KEY_SUBTIPOS);
        if (cached) {
            res.setHeader('Cache-Control', 'public, max-age=300');
            return res.json(cached);
        }
        const subtipos = await prisma.subtipoRiesgo.findMany({
            select: { id: true, nombre: true, descripcion: true, tipoRiesgoId: true },
            orderBy: [{ tipoRiesgoId: 'asc' }, { id: 'asc' }]
        });
        await redisSet(CACHE_KEY_SUBTIPOS, subtipos, CACHE_TTL_CATALOGOS);
        res.setHeader('Cache-Control', 'public, max-age=300');
        res.json(subtipos);
    } catch (error: any) {
        console.error('[catalogos/getSubtipos]', error?.message || error);
        res.status(500).json({ error: 'Error al cargar subtipos' });
    }
};

export const createSubtipo = async (req: Request, res: Response) => {
    try {
        const { tipoRiesgoId, nombre, descripcion } = req.body;
        if (!tipoRiesgoId || !nombre) {
            return res.status(400).json({ error: 'tipoRiesgoId y nombre son requeridos' });
        }
        const tipoId = Number(tipoRiesgoId);
        const subtipo = await prisma.subtipoRiesgo.create({
            data: {
                tipoRiesgoId: tipoId,
                nombre: String(nombre).trim(),
                descripcion: descripcion != null ? String(descripcion).trim() || null : null
            }
        });
        await redisDel(CACHE_KEY_TIPOLOGIAS);
        await redisDel(CACHE_KEY_SUBTIPOS);
        res.status(201).json(subtipo);
    } catch (error: any) {
        console.error('[catalogos/createSubtipo]', error?.message || error);
        const isUnique = error?.code === 'P2002';
        const msg = isUnique ? 'Ya existe un subtipo con ese nombre en este tipo de riesgo. Elija otro nombre.' : 'Error al crear subtipo.';
        res.status(isUnique ? 400 : 500).json({ error: msg });
    }
};

export const updateSubtipo = async (req: Request, res: Response) => {
    const id = Number(req.params.id);
    try {
        const { nombre, descripcion } = req.body;
        const updated = await prisma.subtipoRiesgo.update({
            where: { id },
            data: {
                ...(nombre != null && nombre !== '' && { nombre: String(nombre).trim() }),
                ...(descripcion !== undefined && { descripcion: descripcion != null ? String(descripcion).trim() || null : null })
            }
        });
        await redisDel(CACHE_KEY_TIPOLOGIAS);
        await redisDel(CACHE_KEY_SUBTIPOS);
        res.json(updated);
    } catch (error: any) {
        console.error('[catalogos/updateSubtipo]', error?.message || error);
        const msg = (error?.code === 'P2002') ? 'Ya existe un subtipo con ese nombre en este tipo de riesgo.' : 'Error al actualizar subtipo.';
        res.status(500).json({ error: msg });
    }
};

export const deleteSubtipo = async (req: Request, res: Response) => {
    const id = Number(req.params.id);
    try {
        await prisma.subtipoRiesgo.delete({ where: { id } });
        await redisDel(CACHE_KEY_TIPOLOGIAS);
        await redisDel(CACHE_KEY_SUBTIPOS);
        res.status(204).send();
    } catch (error) {
        const msg = getDeleteErrorMessage(error, 'subtipo', 'riesgos asociados');
        const status = (error as any)?.code === 'P2025' ? 404 : (error as any)?.code === 'P2003' ? 400 : 500;
        res.status(status).json({ error: msg });
    }
};

export const getConfiguraciones = async (req: Request, res: Response) => {
    try {
        const configs = await prisma.configuracion.findMany();
        res.json(configs);
    } catch (error) {
        res.status(500).json({ error: 'Error fetching configuraciones' });
    }
};

export const createConfiguracion = async (req: Request, res: Response) => {
    const { clave, valor, tipo, descripcion } = req.body;
    if (!clave || valor === undefined || !tipo) {
        return res.status(400).json({ error: 'clave, valor y tipo son requeridos' });
    }

    try {
        const valorFinal = typeof valor === 'string' ? valor : JSON.stringify(valor);
        const created = await prisma.configuracion.create({
            data: {
                clave,
                valor: valorFinal,
                tipo,
                descripcion
            }
        });
        res.status(201).json(created);
    } catch (error) {
        res.status(500).json({ error: 'Error creating configuracion' });
    }
};

export const getMapaConfig = async (req: Request, res: Response) => {
    try {
        const mapaConfigs = await prisma.mapaConfig.findFirst({
            where: { id: 1 }
        });

        if (!mapaConfigs || !mapaConfigs.ejes) {
            // Return default structure if not found
            return res.json({
                inherente: {},
                residual: {},
                tolerancia: []
            });
        }

        // Parse the JSON ejes field
        const parsedEjes = JSON.parse(mapaConfigs.ejes);
        res.json(parsedEjes);
    } catch (error) {
        res.status(500).json({ error: 'Error fetching mapa config' });
    }
};

export const getObjetivos = async (req: Request, res: Response) => {
    try {
        const objetivos = await prisma.objetivo.findMany();
        res.json(objetivos.map((o: any) => ({
            id: o.id,
            codigo: o.codigo,
            descripcion: o.descripcion
        })));
    } catch (error) {
        res.status(500).json({ error: 'Error fetching objetivos' });
    }
};

export const createObjetivo = async (req: Request, res: Response) => {
    try {
        const { descripcion, codigo } = req.body;
        const newObj = await prisma.objetivo.create({
            data: { descripcion, codigo }
        });
        res.status(201).json(newObj);
    } catch (error) {
        res.status(500).json({ error: 'Error creating objetivo' });
    }
};

export const updateObjetivo = async (req: Request, res: Response) => {
    const id = Number(req.params.id);
    try {
        const { descripcion, codigo } = req.body;
        const updated = await prisma.objetivo.update({
            where: { id },
            data: { descripcion, codigo }
        });
        res.json(updated);
    } catch (error) {
        res.status(500).json({ error: 'Error updating objetivo' });
    }
};

export const deleteObjetivo = async (req: Request, res: Response) => {
    const id = Number(req.params.id);
    try {
        await prisma.objetivo.delete({ where: { id } });
        res.status(204).send();
    } catch (error) {
        const msg = getDeleteErrorMessage(error, 'objetivo', 'riesgos o procesos asociados');
        const status = (error as any)?.code === 'P2025' ? 404 : (error as any)?.code === 'P2003' ? 400 : 500;
        res.status(status).json({ error: msg });
    }
};

export const getFormulas = async (_req: Request, res: Response) => {
    res.json([]);
};

export const getFrecuencias = async (req: Request, res: Response) => {
    try {
        const frecuencias = await prisma.frecuenciaCatalog.findMany({
            orderBy: { id: 'asc' }
        });
        res.json(frecuencias);
    } catch (error) {
        res.status(500).json({ error: 'Error fetching frecuencias' });
    }
};

export const getFuentes = async (req: Request, res: Response) => {
    try {
        const fuentes = await prisma.fuenteCatalog.findMany({
            orderBy: { id: 'asc' }
        });
        res.json(fuentes);
    } catch (error) {
        res.status(500).json({ error: 'Error fetching fuentes' });
    }
};

export const getOrigenes = async (req: Request, res: Response) => {
    try {
        const origenes = await prisma.origenCatalog.findMany({
            orderBy: { id: 'asc' }
        });
        res.json(origenes);
    } catch (error) {
        res.status(500).json({ error: 'Error fetching origenes' });
    }
};

export const getTiposProceso = async (req: Request, res: Response) => {
    const tipos = [
        { id: '1', codigo: '1', nombre: 'Estratégico' },
        { id: '2', codigo: '2', nombre: 'Operacional' },
        { id: '3', codigo: '3', nombre: 'Apoyo' },
        { id: '4', codigo: '4', nombre: 'Cumplimiento' },
        { id: '5', codigo: '5', nombre: 'Gestión' },
    ];
    res.json(tipos);
};

export const getConsecuencias = async (req: Request, res: Response) => {
    try {
        const consecuencias = await prisma.consecuenciaCatalog.findMany({
            orderBy: { id: 'asc' }
        });
        res.json(consecuencias);
    } catch (error) {
        res.status(500).json({ error: 'Error fetching consecuencias' });
    }
};

export const getNivelesRiesgo = async (req: Request, res: Response) => {
    const niveles = [
        { id: '1', nombre: 'Muy Crítico', color: '#d32f2f' },  // theme.palette.error.dark
        { id: '2', nombre: 'Crítico', color: '#f44336' },      // theme.palette.error.main
        { id: '3', nombre: 'Alto', color: '#ff9800' },         // theme.palette.warning.main
        { id: '4', nombre: 'Medio', color: '#ffc107' },        // theme.palette.warning.light
        { id: '5', nombre: 'Bajo', color: '#4caf50' },         // theme.palette.success.main
    ];
    res.json(niveles);
};

export const getImpactos = async (req: Request, res: Response) => {
    const impactos = [
        { id: '1', tipo: 'Impacto económico', valor: 0, descripcion: '' },
        { id: '2', tipo: 'Procesos', valor: 0, descripcion: '' },
        { id: '3', tipo: 'Legal', valor: 0, descripcion: '' },
        { id: '4', tipo: 'Confidencialidad SGSI', valor: 0, descripcion: '' },
        { id: '5', tipo: 'Reputación', valor: 0, descripcion: '' },
        { id: '6', tipo: 'Disponibilidad SGSI', valor: 0, descripcion: '' },
        { id: '7', tipo: 'Personas', valor: 0, descripcion: '' },
        { id: '8', tipo: 'Integridad SGSI', valor: 0, descripcion: '' },
    ];
        try {
            const impactos = await prisma.impactoTipo.findMany({
                include: { niveles: { orderBy: { nivel: 'asc' } } },
                orderBy: { id: 'asc' }
            });
            res.json(impactos);
        } catch (error) {
            res.status(500).json({ error: 'Error fetching impactos' });
        }
};

export const createImpactoTipo = async (req: Request, res: Response) => {
    try {
        const { clave, nombre } = req.body;
        if (!clave || !nombre) {
            return res.status(400).json({ error: 'clave y nombre son requeridos' });
        }
        const impacto = await prisma.impactoTipo.create({
            data: { clave, nombre }
        });
        res.status(201).json(impacto);
    } catch (error) {
        res.status(500).json({ error: 'Error creating impacto tipo' });
    }
};

export const updateImpactoNiveles = async (req: Request, res: Response) => {
    const impactoTipoId = Number(req.params.id);
    const { niveles } = req.body as { niveles: { nivel: number; descripcion: string }[] };
    if (!impactoTipoId || !Array.isArray(niveles)) {
        return res.status(400).json({ error: 'niveles invalidos' });
    }
    try {
        await prisma.$transaction([
            prisma.impactoNivel.deleteMany({ where: { impactoTipoId } }),
            prisma.impactoNivel.createMany({
                data: niveles.map((n) => ({
                    impactoTipoId,
                    nivel: n.nivel,
                    descripcion: n.descripcion
                }))
            })
        ]);
        const updated = await prisma.impactoTipo.findUnique({
            where: { id: impactoTipoId },
            include: { niveles: { orderBy: { nivel: 'asc' } } }
        });
        res.json(updated);
    } catch (error) {
        res.status(500).json({ error: 'Error updating impacto niveles' });
    }
};

export const deleteImpactoTipo = async (req: Request, res: Response) => {
    const impactoTipoId = Number(req.params.id);
    try {
        await prisma.impactoTipo.delete({ where: { id: impactoTipoId } });
        res.status(204).send();
    } catch (error) {
        const msg = getDeleteErrorMessage(error, 'tipo de impacto', 'niveles o registros asociados');
        const status = (error as any)?.code === 'P2025' ? 404 : (error as any)?.code === 'P2003' ? 400 : 500;
        res.status(status).json({ error: msg });
    }
};

export const updateFrecuencias = async (req: Request, res: Response) => {
    const data = req.body as { label: string; descripcion: string; peso?: number }[];
    if (!Array.isArray(data)) {
        return res.status(400).json({ error: 'Formato invalido' });
    }
    try {
        await prisma.$transaction([
            prisma.frecuenciaCatalog.deleteMany({}),
            prisma.frecuenciaCatalog.createMany({
                data: data.map((f) => ({ 
                    label: f.label, 
                    descripcion: f.descripcion,
                    peso: f.peso !== undefined && f.peso !== null ? f.peso : 3 // Default 3 si no se proporciona
                }))
            })
        ]);
        const items = await prisma.frecuenciaCatalog.findMany({ orderBy: { id: 'asc' } });
        res.json(items);
    } catch (error) {
        res.status(500).json({ error: 'Error updating frecuencias' });
    }
};

export const updateFuentes = async (req: Request, res: Response) => {
    const data = req.body as { nombre: string }[];
    if (!Array.isArray(data)) {
        return res.status(400).json({ error: 'Formato invalido' });
    }
    try {
        await prisma.$transaction([
            prisma.fuenteCatalog.deleteMany({}),
            prisma.fuenteCatalog.createMany({ data: data.map((f) => ({ nombre: f.nombre })) })
        ]);
        const items = await prisma.fuenteCatalog.findMany({ orderBy: { id: 'asc' } });
        res.json(items);
    } catch (error) {
        res.status(500).json({ error: 'Error updating fuentes' });
    }
};

export const updateOrigenes = async (req: Request, res: Response) => {
    const data = req.body as { codigo?: string; nombre: string }[];
    if (!Array.isArray(data)) {
        return res.status(400).json({ error: 'Formato invalido' });
    }
    try {
        await prisma.$transaction([
            prisma.origenCatalog.deleteMany({}),
            prisma.origenCatalog.createMany({
                data: data.map((o) => ({ codigo: o.codigo || null, nombre: o.nombre }))
            })
        ]);
        const items = await prisma.origenCatalog.findMany({ orderBy: { id: 'asc' } });
        res.json(items);
    } catch (error) {
        res.status(500).json({ error: 'Error updating origenes' });
    }
};

export const updateConsecuencias = async (req: Request, res: Response) => {
    const data = req.body as { codigo?: string; nombre: string }[];
    if (!Array.isArray(data)) {
        return res.status(400).json({ error: 'Formato invalido' });
    }
    try {
        await prisma.$transaction([
            prisma.consecuenciaCatalog.deleteMany({}),
            prisma.consecuenciaCatalog.createMany({
                data: data.map((c) => ({ codigo: c.codigo || null, nombre: c.nombre }))
            })
        ]);
        const items = await prisma.consecuenciaCatalog.findMany({ orderBy: { id: 'asc' } });
        res.json(items);
    } catch (error) {
        res.status(500).json({ error: 'Error updating consecuencias' });
    }
};
export const getEjesMapa = async (req: Request, res: Response) => {
    const ejes = {
        probabilidad: [
            { id: 'p1', valor: 1, nombre: 'Muy Baja' },
            { id: 'p2', valor: 2, nombre: 'Baja' },
            { id: 'p3', valor: 3, nombre: 'Moderada' },
            { id: 'p4', valor: 4, nombre: 'Alta' },
            { id: 'p5', valor: 5, nombre: 'Muy Alta' },
        ],
        impacto: [
            { id: 'i1', valor: 1, nombre: 'Muy Bajo' },
            { id: 'i2', valor: 2, nombre: 'Bajo' },
            { id: 'i3', valor: 3, nombre: 'Moderado' },
            { id: 'i4', valor: 4, nombre: 'Alto' },
            { id: 'i5', valor: 5, nombre: 'Muy Alto' },
        ]
    };
    res.json(ejes);
};

export const getPesosImpacto = async (_req: Request, res: Response) => {
    try {
        const config = await prisma.configuracion.findUnique({
            where: { clave: 'pesos_impacto' }
        });
        
        if (config) {
            const pesos = JSON.parse(config.valor);
            res.json(pesos);
        } else {
            // Retornar valores por defecto
            const defaultPesos = [
                { key: 'economico', label: 'Impacto económico', porcentaje: 22 },
                { key: 'legal', label: 'Legal/Normativo', porcentaje: 22 },
                { key: 'reputacion', label: 'Reputacional', porcentaje: 22 },
                { key: 'procesos', label: 'Procesos', porcentaje: 14 },
                { key: 'ambiental', label: 'Ambiental', porcentaje: 10 },
                { key: 'personas', label: 'Personas', porcentaje: 10 },
                { key: 'confidencialidadSGSI', label: 'Confidencialidad SGSI', porcentaje: 0 },
                { key: 'disponibilidadSGSI', label: 'Disponibilidad SGSI', porcentaje: 0 },
                { key: 'integridadSGSI', label: 'Integridad SGSI', porcentaje: 0 },
            ];
            res.json(defaultPesos);
        }
    } catch (error) {
        res.status(500).json({ error: 'Error fetching pesos impacto' });
    }
};

export const updatePesosImpacto = async (req: Request, res: Response) => {
    const { pesos } = req.body;
    if (!Array.isArray(pesos)) {
        return res.status(400).json({ error: 'Formato inválido: se espera un array de pesos' });
    }
    
    try {
        const valor = JSON.stringify(pesos);
        const config = await prisma.configuracion.upsert({
            where: { clave: 'pesos_impacto' },
            create: {
                clave: 'pesos_impacto',
                valor,
                tipo: 'json',
                descripcion: 'Pesos (porcentajes) de las dimensiones de impacto para calcular Calificación Global Impacto'
            },
            update: {
                valor
            }
        });
        
        const pesosParsed = JSON.parse(config.valor);

        // Responder inmediatamente al cliente
        res.json(pesosParsed);

        // Ejecutar recálculo en segundo plano (no bloquea la respuesta)
        // Recalcular automáticamente la calificación de impacto global y el riesgo inherente
        // de TODOS los riesgos, porque el cambio de porcentajes afecta a todo el universo.
        setImmediate(async () => {
            try {
                const riesgos = await prisma.riesgo.findMany({
                    select: { id: true },
                    where: {
                        evaluacion: {
                            isNot: null
                        }
                    },
                    orderBy: { id: 'asc' }
                });
                if (riesgos.length === 0) return;
                const BATCH_SIZE = 50;
                for (let i = 0; i < riesgos.length; i += BATCH_SIZE) {
                    const batch = riesgos.slice(i, i + BATCH_SIZE);
                    await Promise.all(
                        batch.map(async ({ id }) => {
                            try {
                                await recalcularRiesgoInherenteDesdeCausas(id);
                            } catch (error) {
                                // ignore
                            }
                        })
                    );
                }
            } catch (error: any) {
                // No fallar la petición si el recálculo falla
            }
        });
    } catch (error) {
        res.status(500).json({ error: 'Error updating pesos impacto' });
    }
};

export const updateConfiguracion = async (req: Request, res: Response) => {
    const id = Number(req.params.id);
    const body = req.body;
    try {
        const updated = await prisma.configuracion.update({
            where: { id },
            data: body
        });
        res.json(updated);
    } catch (error) {
        res.status(500).json({ error: 'Error updating configuracion' });
    }
};

export const updateMapaConfig = async (req: Request, res: Response) => {
    const { type, data } = req.body;
    try {
        // Get existing config
        const existing = await prisma.mapaConfig.findFirst({
            where: { id: 1 }
        });

        // Parse existing ejes or create default structure
        let ejesObj = existing && existing.ejes
            ? JSON.parse(existing.ejes)
            : { inherente: {}, residual: {}, tolerancia: [] };

        // Update only the specific type
        ejesObj[type] = data;

        // Save back
        const updated = await prisma.mapaConfig.upsert({
            where: { id: 1 },
            create: {
                id: 1,
                nombre: 'Configuración por Defecto',
                ejes: JSON.stringify(ejesObj)
            },
            update: {
                ejes: JSON.stringify(ejesObj)
            }
        });
        res.json(ejesObj);
    } catch (error) {
        res.status(500).json({ error: 'Error updating mapa config' });
    }
};

/** GET público autenticado: flags para deshabilitar campos en formularios del frontend. */
export const getCamposHabilitacionUi = async (_req: Request, res: Response) => {
    try {
        const merged = await getUiCamposHabilitacionFlags();
        return res.json(merged);
    } catch (error) {
        res.status(500).json({ error: 'Error al leer habilitación de campos UI' });
    }
};

/** GET: regla “residual = inherente si hay plan en alguna causa” (cualquier usuario autenticado). */
export const getReglaResidualPlanCausa = async (_req: Request, res: Response) => {
    try {
        const activa = await getReglaResidualIgualInherenteSiPlanCausa();
        return res.json({ activa });
    } catch (error) {
        console.error('[catalogos/getReglaResidualPlanCausa]', (error as Error)?.message || error);
        res.status(500).json({ error: 'Error al leer la regla residual / planes en causa' });
    }
};

/** PUT solo admin: activa o desactiva la regla. */
export const updateReglaResidualPlanCausa = async (req: Request, res: Response) => {
    try {
        const raw = (req.body as { activa?: unknown })?.activa;
        const activa = raw === true || raw === 'true' || raw === 1 || raw === '1';
        const out = await setReglaResidualIgualInherenteSiPlanCausa(activa);
        return res.json(out);
    } catch (error) {
        console.error('[catalogos/updateReglaResidualPlanCausa]', (error as Error)?.message || error);
        res.status(500).json({ error: 'Error al guardar la regla residual / planes en causa' });
    }
};

/** PUT solo admin: actualiza flags (solo claves conocidas). */
export const updateCamposHabilitacionUi = async (req: Request, res: Response) => {
    try {
        const body = req.body as Record<string, unknown>;
        if (!body || typeof body !== 'object' || Array.isArray(body)) {
            return res.status(400).json({ error: 'Body debe ser un objeto' });
        }
        const allowed = new Set(Object.keys(defaultUiCamposHabilitacion()));
        const merged = defaultUiCamposHabilitacion();
        for (const k of allowed) {
            if (k in body) {
                merged[k] = Boolean(body[k]);
            }
        }
        await prisma.configuracion.upsert({
            where: { clave: UI_CAMPOS_HABILITACION_CLAVE },
            create: {
                clave: UI_CAMPOS_HABILITACION_CLAVE,
                valor: JSON.stringify(merged),
                tipo: 'json',
                descripcion: 'Habilitación de edición de campos en formularios (UI)',
            },
            update: {
                valor: JSON.stringify(merged),
                tipo: 'json',
                descripcion: 'Habilitación de edición de campos en formularios (UI)',
            },
        });
        res.json(merged);
    } catch (error) {
        res.status(500).json({ error: 'Error al guardar habilitación de campos UI' });
    }
};

export const getVicepresidencias = async (_req: Request, res: Response) => {
    const vps = [
        { id: 1, nombre: 'Vicepresidencia Ejecutiva' },
        { id: 2, nombre: 'Vicepresidencia de Operaciones' },
        { id: 3, nombre: 'Vicepresidencia Comercial' },
        { id: 4, nombre: 'Vicepresidencia Financiera' },
        { id: 5, nombre: 'Vicepresidencia de Tecnología' },
        { id: 6, nombre: 'Vicepresidencia de Talento Humano' },
    ];
    res.json(vps);
};
