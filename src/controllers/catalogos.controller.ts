import { Request, Response } from 'express';
import prisma from '../prisma';

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
        const tipologias = await prisma.tipoRiesgo.findMany({
            include: { subtipos: true }
        });
        const transformed = [
            {
                id: '1',
                nombre: 'Tipologías Nivel I',
                nivel: 'I',
                categorias: tipologias.map((t: any) => ({
                    id: t.id,
                    codigo: t.codigo,
                    descripcion: t.nombre,
                    subtipos: t.subtipos.map((s: any) => ({
                        id: s.id,
                        codigo: s.codigo,
                        nombre: s.nombre,
                        descripcion: s.descripcion
                    }))
                })),
                activa: true
            }
        ];
        res.json(transformed);
    } catch (error) {
        res.status(500).json({ error: 'Error fetching tipologias' });
    }
};

export const createTipologia = async (req: Request, res: Response) => {
    try {
        const { nombre, codigo, descripcion } = req.body;
        const newTipologia = await prisma.tipoRiesgo.create({
            data: { nombre, codigo, descripcion }
        });
        res.status(201).json(newTipologia);
    } catch (error) {
        res.status(500).json({ error: 'Error creating tipologia' });
    }
};

export const updateTipologia = async (req: Request, res: Response) => {
    const id = Number(req.params.id);
    try {
        const { nombre, codigo, descripcion } = req.body;
        const updated = await prisma.tipoRiesgo.update({
            where: { id },
            data: { nombre, codigo, descripcion }
        });
        res.json(updated);
    } catch (error) {
        res.status(500).json({ error: 'Error updating tipologia' });
    }
};

export const deleteTipologia = async (req: Request, res: Response) => {
    const id = Number(req.params.id);
    try {
        await prisma.tipoRiesgo.delete({ where: { id } });
        res.status(204).send();
    } catch (error) {
        res.status(500).json({ error: 'Error deleting tipologia' });
    }
};

export const createSubtipo = async (req: Request, res: Response) => {
    try {
        const { tipoRiesgoId, nombre, descripcion, codigo } = req.body;
        if (!tipoRiesgoId || !nombre) {
            return res.status(400).json({ error: 'tipoRiesgoId y nombre son requeridos' });
        }
        const subtipo = await prisma.subtipoRiesgo.create({
            data: {
                tipoRiesgoId: Number(tipoRiesgoId),
                nombre,
                descripcion: descripcion || null,
                codigo: codigo || null
            }
        });
        res.status(201).json(subtipo);
    } catch (error) {
        res.status(500).json({ error: 'Error creating subtipo' });
    }
};

export const updateSubtipo = async (req: Request, res: Response) => {
    const id = Number(req.params.id);
    try {
        const { nombre, descripcion, codigo } = req.body;
        const updated = await prisma.subtipoRiesgo.update({
            where: { id },
            data: {
                ...(nombre && { nombre }),
                ...(descripcion !== undefined && { descripcion }),
                ...(codigo !== undefined && { codigo })
            }
        });
        res.json(updated);
    } catch (error) {
        res.status(500).json({ error: 'Error updating subtipo' });
    }
};

export const deleteSubtipo = async (req: Request, res: Response) => {
    const id = Number(req.params.id);
    try {
        await prisma.subtipoRiesgo.delete({ where: { id } });
        res.status(204).send();
    } catch (error) {
        res.status(500).json({ error: 'Error deleting subtipo' });
    }
};

export const getConfiguraciones = async (req: Request, res: Response) => {
    console.log('GET /catalogos/configuraciones');
    try {
        const configs = await prisma.configuracion.findMany();
        console.log(`Found ${configs.length} configurations`);
        res.json(configs);
    } catch (error) {
        console.error('Error in getConfiguraciones:', error);
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
        console.error('Error in createConfiguracion:', error);
        res.status(500).json({ error: 'Error creating configuracion' });
    }
};

export const getMapaConfig = async (req: Request, res: Response) => {
    console.log('GET /catalogos/mapa-config');
    try {
        const mapaConfigs = await prisma.mapaConfig.findFirst({
            where: { id: 1 }
        });
        console.log('Mapa config found:', mapaConfigs ? 'Yes' : 'No');

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
        console.error('Error in getMapaConfig:', error);
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
        res.status(500).json({ error: 'Error deleting objetivo' });
    }
};

export const getFormulas = async (req: Request, res: Response) => {
    try {
        const formulas = await prisma.formula.findMany();
        res.json(formulas);
    } catch (error) {
        res.status(500).json({ error: 'Error fetching formulas' });
    }
};

export const getFrecuencias = async (req: Request, res: Response) => {
    const frecuencias = [
        { id: '1', label: 'Raro', descripcion: 'mayor a anual' },
        { id: '2', label: 'Improbable', descripcion: 'mayor a trimestral y hasta anual' },
        { id: '3', label: 'Posible', descripcion: 'mayor a mensual y hasta trimestral' },
        { id: '4', label: 'Probable', descripcion: 'mayor a diaria y hasta mensual' },
        { id: '5', label: 'Esperado', descripcion: 'diaria o varias veces al día' },
    ];
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
    const fuentes = [
        { id: '1', codigo: '1', nombre: 'Personas' },
        { id: '2', codigo: '2', nombre: 'Proceso' },
        { id: '3', codigo: '3', nombre: 'Legal' },
        { id: '4', codigo: '4', nombre: 'Infraestructura' },
        { id: '5', codigo: '5', nombre: 'Externos' },
    ];
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
    const origenes = [
        { id: '1', codigo: '1', nombre: 'Talleres internos' },
        { id: '2', codigo: '2', nombre: 'Auditoría HHI' },
        { id: '3', codigo: '3', nombre: 'Auditorías Externas' },
        { id: '4', codigo: '4', nombre: 'SGSI' },
        { id: '5', codigo: '5', nombre: 'SSO' },
    ];
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
    console.log('GET /catalogos/tipos-proceso');
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
    const consecuencias = [
        { id: '1', codigo: '1', nombre: 'Negativa' },
        { id: '2', codigo: '2', nombre: 'Positiva' },
    ];
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
    console.log('GET /catalogos/impactos');
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
            console.error('Error in getImpactos:', error);
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
        res.status(500).json({ error: 'Error deleting impacto tipo' });
    }
};

export const updateFrecuencias = async (req: Request, res: Response) => {
    const data = req.body as { label: string; descripcion: string }[];
    if (!Array.isArray(data)) {
        return res.status(400).json({ error: 'Formato invalido' });
    }
    try {
        await prisma.$transaction([
            prisma.frecuenciaCatalog.deleteMany({}),
            prisma.frecuenciaCatalog.createMany({
                data: data.map((f) => ({ label: f.label, descripcion: f.descripcion }))
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
    console.log('GET /catalogos/ejes-mapa');
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
    console.log('Returning ejes:', JSON.stringify(ejes));
    res.json(ejes);
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
    console.log('PUT /catalogos/mapa-config - type:', type, 'data:', data);

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

        console.log('Mapa config updated successfully');
        // Return the parsed ejes object, not the DB record
        res.json(ejesObj);
    } catch (error) {
        console.error('Error updating mapa config:', error);
        res.status(500).json({ error: 'Error updating mapa config' });
    }
};

export const getVicepresidencias = async (req: Request, res: Response) => {
    // Return hardcoded or dynamic lists for now since there is no model
    const vps = [
        { id: 1, nombre: 'Vicepresidencia Ejecutiva', sigla: 'VPE' },
        { id: 2, nombre: 'Vicepresidencia de Operaciones', sigla: 'VPO' },
        { id: 3, nombre: 'Vicepresidencia Comercial', sigla: 'VPC' },
        { id: 4, nombre: 'Vicepresidencia Financiera', sigla: 'VPF' },
        { id: 5, nombre: 'Vicepresidencia de Tecnología', sigla: 'VPT' },
        { id: 6, nombre: 'Vicepresidencia de Talento Humano', sigla: 'VPTH' },
    ];
    res.json(vps);
};
