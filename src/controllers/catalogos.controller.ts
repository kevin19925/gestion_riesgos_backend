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
    res.json(frecuencias);
};

export const getFuentes = async (req: Request, res: Response) => {
    const fuentes = [
        { id: '1', codigo: '1', nombre: 'Personas' },
        { id: '2', codigo: '2', nombre: 'Proceso' },
        { id: '3', codigo: '3', nombre: 'Legal' },
        { id: '4', codigo: '4', nombre: 'Infraestructura' },
        { id: '5', codigo: '5', nombre: 'Externos' },
    ];
    res.json(fuentes);
};

export const getOrigenes = async (req: Request, res: Response) => {
    const origenes = [
        { id: '1', codigo: '1', nombre: 'Talleres internos' },
        { id: '2', codigo: '2', nombre: 'Auditoría HHI' },
        { id: '3', codigo: '3', nombre: 'Auditorías Externas' },
        { id: '4', codigo: '4', nombre: 'SGSI' },
        { id: '5', codigo: '5', nombre: 'SSO' },
    ];
    res.json(origenes);
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
    res.json(consecuencias);
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
    res.json(impactos);
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
