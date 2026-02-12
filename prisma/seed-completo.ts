import 'dotenv/config'
import { Pool } from 'pg'
import { PrismaPg } from '@prisma/adapter-pg'
import { PrismaClient } from '@prisma/client'

const connectionString = (process.env.DATABASE_URL || '').replace(/^\"|\"$/g, '');

const pool = new Pool({
    connectionString,
    ssl: { rejectUnauthorized: false }
})
const adapter = new PrismaPg(pool)
const prisma = new PrismaClient({ adapter })

async function main() {
    console.log('🌱 INICIANDO SEED COMPLETO CON DATOS REALES...\n')

    // 1. LIMPIEZA TOTAL
    console.log('🧹 Limpiando datos existentes...')
    try {
        await prisma.eventoMaterializado.deleteMany({})
        await prisma.incidencia.deleteMany({})
        await prisma.benchmarking.deleteMany({})
        await prisma.documento.deleteMany({})
        await prisma.planAccion.deleteMany({})
        await prisma.control.deleteMany({})
        await prisma.priorizacionRiesgo.deleteMany({})
        await prisma.controlRiesgo.deleteMany({})
        await prisma.causaRiesgo.deleteMany({})
        await prisma.evaluacionRiesgo.deleteMany({})
        await prisma.riesgo.deleteMany({})
        await prisma.dofaItem.deleteMany({})
        await prisma.normatividad.deleteMany({})
        await prisma.contexto.deleteMany({})
        await prisma.observacion.deleteMany({})
        await prisma.historialCambioProceso.deleteMany({})
        await prisma.proceso.deleteMany({})
        await prisma.area.deleteMany({})
        await prisma.usuario.deleteMany({})
        await prisma.cargo.deleteMany({})
        await prisma.objetivo.deleteMany({})
        await prisma.subtipoRiesgo.deleteMany({})
        await prisma.tipoRiesgo.deleteMany({})
        await prisma.gerencia.deleteMany({})
        await prisma.impactoNivel.deleteMany({})
        await prisma.impactoTipo.deleteMany({})
        await prisma.frecuenciaCatalog.deleteMany({})
        await prisma.fuenteCatalog.deleteMany({})
        await prisma.origenCatalog.deleteMany({})
        await prisma.consecuenciaCatalog.deleteMany({})
        console.log('✅ Limpieza completada\n')
    } catch (e) {
        console.warn('⚠️  Advertencia en limpieza:', e)
    }

    // 2. CREAR CARGOS
    console.log('👥 Creando cargos...')
    const cargos = await prisma.cargo.createMany({
        data: [
            { nombre: 'Administrador', descripcion: 'Administrador total del sistema' },
            { nombre: 'Gerente General', descripcion: 'Máxima autoridad de la empresa' },
            { nombre: 'Director General', descripcion: 'Director General' },
            { nombre: 'Director Financiero Administrativo', descripcion: 'Responsable de finanzas' },
            { nombre: 'Director Comercial', descripcion: 'Responsable comercial' },
            { nombre: 'Director de Soluciones de TI', descripcion: 'Director TI' },
            { nombre: 'Gerente de Servicios', descripcion: 'Gerente de Servicios' },
            { nombre: 'Contadora', descripcion: 'Contador' },
            { nombre: 'Analista de Talento Humano', descripcion: 'Analista TH' },
            { nombre: 'Coordinador de Administrativo', descripcion: 'Coordinador' },
            { nombre: 'Analista de Helpdesk', descripcion: 'Soporte' },
            { nombre: 'Ingeniera de Soporte', descripcion: 'Ingeniería' },
            { nombre: 'Jefe de Producto', descripcion: 'Producto' },
            { nombre: 'Asesor Comercial', descripcion: 'Comercial' },
            { nombre: 'Ejecutivo de Experiencia al Cliente', descripcion: 'Experiencia' },
            { nombre: 'Asistente Legal', descripcion: 'Legal' },
            { nombre: 'Asistente Administrativa', descripcion: 'Administrativa' },
            { nombre: 'Jefe Financiero', descripcion: 'Finanzas' },
            { nombre: 'Analista Contable', descripcion: 'Contabilidad' },
            { nombre: 'Lider de Servicios', descripcion: 'Servicios' },
            { nombre: 'Analista de Ventas', descripcion: 'Ventas' },
            { nombre: 'Supervisor de Riesgos', descripcion: 'Supervisor' },
        ]
    })
    const allCargos = await prisma.cargo.findMany()
    console.log(`✅ ${allCargos.length} cargos creados\n`)

    // 3. CREAR USUARIOS
    console.log('👤 Creando usuarios...')
    const usuariosData = [
        { nombre: 'Carlos Ayala', email: 'cayala@comware.com.co', role: 'gerente_general', cargoNombre: 'Director General', activo: false },
        { nombre: 'Marco Alvarado', email: 'marco@comware.com.co', role: 'dueño_procesos', cargoNombre: 'Director Financiero Administrativo', activo: true },
        { nombre: 'Ulpiano Muñoz', email: 'ulpiano@comware.com.co', role: 'dueño_procesos', cargoNombre: 'Director Comercial', activo: true },
        { nombre: 'Jaime Jara', email: 'jaime@comware.com.co', role: 'dueño_procesos', cargoNombre: 'Director de Soluciones de TI', activo: false },
        { nombre: 'Marlon Sanchez', email: 'marlon@comware.com.co', role: 'dueño_procesos', cargoNombre: 'Gerente de Servicios', activo: false },
        { nombre: 'Lizeth Chicaiza', email: 'lizeth@comware.com.co', role: 'dueño_procesos', cargoNombre: 'Contadora', activo: true },
        { nombre: 'Katherine Chavez', email: 'katherine@comware.com.co', role: 'dueño_procesos', cargoNombre: 'Analista de Talento Humano', activo: true },
        { nombre: 'Leonel Yepez', email: 'leonel@comware.com.co', role: 'dueño_procesos', cargoNombre: 'Coordinador de Administrativo', activo: false },
        { nombre: 'Luis Terán', email: 'luis@comware.com.co', role: 'dueño_procesos', cargoNombre: 'Analista de Helpdesk', activo: true },
        { nombre: 'Jessica Guanoluisa', email: 'jessica@comware.com.co', role: 'dueño_procesos', cargoNombre: 'Ingeniera de Soporte', activo: true },
        { nombre: 'Ivan Albuja', email: 'ivan@comware.com.co', role: 'dueño_procesos', cargoNombre: 'Jefe de Producto', activo: true },
        { nombre: 'Rosa Duque', email: 'rosa@comware.com.co', role: 'dueño_procesos', cargoNombre: 'Jefe de Producto', activo: false },
        { nombre: 'Nelson Ávila', email: 'nelson@comware.com.co', role: 'dueño_procesos', cargoNombre: 'Jefe de Producto', activo: true },
        { nombre: 'Wladimir Benavides', email: 'wladimir@comware.com.co', role: 'dueño_procesos', cargoNombre: 'Jefe de Producto', activo: true },
        { nombre: 'Gustavo Abad', email: 'gustavo@comware.com.co', role: 'dueño_procesos', cargoNombre: 'Asesor Comercial', activo: true },
        { nombre: 'Mónica Cabrera', email: 'monica@comware.com.co', role: 'dueño_procesos', cargoNombre: 'Asesor Comercial', activo: true },
        { nombre: 'Rodrigo Ochoa', email: 'rodrigo@comware.com.co', role: 'dueño_procesos', cargoNombre: 'Asesor Comercial', activo: false },
        { nombre: 'Alexandra Santana', email: 'alexandra@comware.com.co', role: 'dueño_procesos', cargoNombre: 'Asesor Comercial', activo: true },
        { nombre: 'Irene Alcívar', email: 'irene@comware.com.co', role: 'dueño_procesos', cargoNombre: 'Asesor Comercial', activo: true },
        { nombre: 'Diego Romero', email: 'diego@comware.com.co', role: 'dueño_procesos', cargoNombre: 'Ejecutivo de Experiencia al Cliente', activo: true },
        { nombre: 'Daniela Rodriguez', email: 'daniela@comware.com.co', role: 'dueño_procesos', cargoNombre: 'Asistente Legal', activo: true },
        { nombre: 'Jeimy Gualoto', email: 'jeimy@comware.com.co', role: 'dueño_procesos', cargoNombre: 'Asistente Administrativa', activo: false },
        { nombre: 'Vinicio Barahona', email: 'vinicio@comware.com.co', role: 'dueño_procesos', cargoNombre: 'Jefe Financiero', activo: true },
        { nombre: 'Karla Armas', email: 'karla@comware.com.co', role: 'dueño_procesos', cargoNombre: 'Analista Contable', activo: true },
        { nombre: 'Gabriela Quiroz', email: 'gabriela@comware.com.co', role: 'dueño_procesos', cargoNombre: 'Asistente Administrativa', activo: true },
        { nombre: 'Miguel Peralta', email: 'miguel@comware.com.co', role: 'dueño_procesos', cargoNombre: 'Lider de Servicios', activo: true },
        { nombre: 'Nathaly Freire', email: 'nathaly@comware.com.co', role: 'dueño_procesos', cargoNombre: 'Analista de Ventas', activo: true },
        { nombre: 'Juan José Maldonado', email: 'juanjose@comware.com.co', role: 'gerente_general', cargoNombre: 'Director General', activo: true },
        { nombre: 'Alicia Robayo', email: 'alicia@comware.com.co', role: 'dueño_procesos', cargoNombre: 'Comité de Etica', activo: true },
        { nombre: 'Andrés Martínez', email: 'andres@comware.com.co', role: 'admin', cargoNombre: 'Administrador', activo: true },
        { nombre: 'Carlos Rodríguez', email: 'carlos@comware.com.co', role: 'supervisor', cargoNombre: 'Supervisor de Riesgos', activo: true },
    ]

    const usuarios = []
    for (const userData of usuariosData) {
        const cargoId = allCargos.find(c => c.nombre === userData.cargoNombre)?.id || allCargos[0].id
        const user = await prisma.usuario.create({
            data: {
                nombre: userData.nombre,
                email: userData.email,
                password: 'comware123',
                role: userData.role,
                cargoId,
                activo: userData.activo
            }
        })
        usuarios.push(user)
    }
    console.log(`✅ ${usuarios.length} usuarios creados\n`)

    // 4. CREAR GERENCIAS
    console.log('🏢 Creando gerencias...')
    const gerenciasData = [
        { nombre: 'Gerencia de Planificación Financiera', sigla: 'GPF', subdivision: 'Vicepresidencia Financiera' },
        { nombre: 'Gerencia de Contabilidad', sigla: 'GCNT', subdivision: 'Vicepresidencia Financiera' },
        { nombre: 'Gerencia de Desarrollo Humano', sigla: 'GDH', subdivision: 'Vicepresidencia de Talento Humano' },
        { nombre: 'Gerencia de Infraestructura', sigla: 'GI', subdivision: 'Vicepresidencia de Tecnología' },
        { nombre: 'Gerencia de Ventas', sigla: 'GV', subdivision: 'Vicepresidencia Comercial' },
        { nombre: 'Gerencia de Marketing', sigla: 'GM', subdivision: 'Vicepresidencia Comercial' },
        { nombre: 'Gerencia de Operaciones', sigla: 'GO', subdivision: 'Vicepresidencia de Talento Humano' },
        { nombre: 'Gerencia de Calidad', sigla: 'GC', subdivision: 'Vicepresidencia Financiera' },
        { nombre: 'Gerencia de Compliance y Legal', sigla: 'GCL', subdivision: 'Vicepresidencia de Compliance' },
        { nombre: 'Gerencia de Seguridad y Protección', sigla: 'GSP', subdivision: 'Vicepresidencia de Compliance' },
        { nombre: 'Gerencia de Soporte Técnico', sigla: 'GST', subdivision: 'Vicepresidencia de Tecnología' },
        { nombre: 'Gerencia de Dirección Estratégica', sigla: 'GDE', subdivision: 'Vicepresidencia de Dirección' },
        { nombre: 'Gerencia de Procesos y Calidad', sigla: 'GPC', subdivision: 'Vicepresidencia de Operaciones' },
        { nombre: 'Gerencia de Logística', sigla: 'GL', subdivision: 'Vicepresidencia de Operaciones' },
        { nombre: 'Gerencia de Innovación y Tecnología', sigla: 'GIT', subdivision: 'Vicepresidencia de Tecnología' },
        { nombre: 'Gerencia de Administración', sigla: 'GA', subdivision: 'Vicepresidencia Financiera' },
    ]
    const gerencias = await prisma.gerencia.createMany({ data: gerenciasData })
    const allGerencias = await prisma.gerencia.findMany()
    console.log(`✅ ${allGerencias.length} gerencias creadas\n`)

    // 5. CREAR ÁREAS
    console.log('🏢 Creando áreas...')
    const areasData = [
        { nombre: 'Gestión Financiera y Administrativa', descripcion: 'Área responsable de procesos financieros', directorId: usuarios.find(u => u.nombre === 'Marco Alvarado')?.id },
        { nombre: 'Talento Humano', descripcion: 'Área responsable de recursos humanos', directorId: usuarios.find(u => u.nombre === 'Katherine Chavez')?.id },
        { nombre: 'Comercial', descripcion: 'Área responsable de procesos comerciales', directorId: usuarios.find(u => u.nombre === 'Ulpiano Muñoz')?.id },
        { nombre: 'Adquisiciones', descripcion: 'Área responsable de compras', directorId: usuarios.find(u => u.nombre === 'Gustavo Abad')?.id },
        { nombre: 'Compliance', descripcion: 'Área responsable de cumplimiento normativo', directorId: usuarios.find(u => u.nombre === 'Daniela Rodriguez')?.id },
        { nombre: 'Tecnología', descripcion: 'Área responsable de tecnología', directorId: usuarios.find(u => u.nombre === 'Luis Terán')?.id },
        { nombre: 'Dirección', descripcion: 'Área de dirección estratégica', directorId: usuarios.find(u => u.nombre === 'Juan José Maldonado')?.id },
    ]
    const areas = await prisma.area.createMany({ data: areasData as any })
    const allAreas = await prisma.area.findMany({ include: { director: true } })
    console.log(`✅ ${allAreas.length} áreas creadas\n`)

    // 6. CREAR CATÁLOGOS - TipoRiesgo
    console.log('📚 Creando catálogos de tipos de riesgo...')
    const tiposRiesgoData = [
        {
            codigo: '1',
            nombre: 'Estratégico',
            descripcion: 'Son los riesgos de fallar en la implementación del plan estratégico',
            subtipos: {
                create: [
                    { codigo: '1', nombre: 'alianzas', descripcion: 'Alianzas comerciales ineficientes' },
                    { codigo: '2', nombre: 'alineación estratégica', descripcion: 'Falta de alineación estratégica' },
                    { codigo: '3', nombre: 'canales de distribución', descripcion: 'Fallas en canales de distribución' },
                    { codigo: '15', nombre: 'talento humano', descripcion: 'Riesgo de falta de talento clave' }
                ]
            }
        },
        {
            codigo: '2',
            nombre: 'Operacional',
            descripcion: 'Riesgos relacionados con fallas en procesos, personas y/o tecnología',
            subtipos: {
                create: [
                    { codigo: '1', nombre: 'ambiental', descripcion: 'Riesgos asociados a daños ambientales' },
                    { codigo: '2', nombre: 'físico', descripcion: 'Riesgo de pérdida de activos físicos' },
                    { codigo: '6', nombre: 'proceso', descripcion: 'Riesgos en procesos operativos' },
                    { codigo: '9', nombre: 'sistemas', descripcion: 'Riesgos en sistemas de TI' }
                ]
            }
        },
        {
            codigo: '3',
            nombre: 'Financiero',
            descripcion: 'Riesgos relacionados con aspectos financieros',
            subtipos: {
                create: [
                    { codigo: '1', nombre: 'contable', descripcion: 'Riesgo contable' },
                    { codigo: '2', nombre: 'crédito', descripcion: 'Riesgo de crédito' },
                    { codigo: '5', nombre: 'mercado', descripcion: 'Riesgo de mercado' }
                ]
            }
        },
        {
            codigo: '4',
            nombre: 'Cumplimiento',
            descripcion: 'Riesgos relacionados con cumplimiento normativo',
            subtipos: {
                create: [
                    { codigo: '1', nombre: 'gobierno corporativo', descripcion: 'Incumplimiento de gobierno corporativo' },
                    { codigo: '3', nombre: 'legal', descripcion: 'Riesgo legal' },
                    { codigo: '5', nombre: 'regulatorio', descripcion: 'Riesgo regulatorio' }
                ]
            }
        }
    ]

    for (const tipoData of tiposRiesgoData) {
        await prisma.tipoRiesgo.create({ data: tipoData as any })
    }
    const allTiposRiesgo = await prisma.tipoRiesgo.findMany({ include: { subtipos: true } })
    console.log(`✅ ${allTiposRiesgo.length} tipos de riesgo creados\n`)

    // 7. CREAR CATÁLOGO - Objetivos
    console.log('🎯 Creando objetivos...')
    const objetivosData = [
        { codigo: '1', descripcion: 'Maximizar la rentabilidad sobre la inversión' },
        { codigo: '2', descripcion: 'Ofrecer soluciones de vanguardia para los clientes' },
        { codigo: '3', descripcion: 'Lograr que los clientes recomienden nuestros productos' },
        { codigo: '13', descripcion: 'Aplicar estándares de seguridad de la información' },
        { codigo: '16', descripcion: 'Gestionar el desempeño del personal' },
        { codigo: '17', descripcion: 'Asegurar continuidad operacional mediante personal capacitado' },
        { codigo: '18', descripcion: 'Retener el talento clave mediante planes de desarrollo' },
    ]
    const objetivos = await prisma.objetivo.createMany({ data: objetivosData as any })
    console.log(`✅ ${objetivosData.length} objetivos creados\n`)

    // 7.5 CREAR CATÁLOGOS BASE
    console.log('📚 Creando catálogos base (frecuencias, fuentes, orígenes, consecuencias)...')
    const frecuenciasData = [
        { label: 'Muy baja', descripcion: 'Ocurre muy rara vez' },
        { label: 'Baja', descripcion: 'Ocurre raramente' },
        { label: 'Media', descripcion: 'Ocurre ocasionalmente' },
        { label: 'Alta', descripcion: 'Ocurre con frecuencia' },
        { label: 'Muy alta', descripcion: 'Ocurre con mucha frecuencia' },
    ]
    await prisma.frecuenciaCatalog.createMany({ data: frecuenciasData })

    const fuentesData = [
        { nombre: 'Interna' },
        { nombre: 'Externa' },
        { nombre: 'Regulatoria' },
        { nombre: 'Tecnológica' },
        { nombre: 'Operativa' },
    ]
    await prisma.fuenteCatalog.createMany({ data: fuentesData })

    const origenesData = [
        { codigo: '1', nombre: 'Interno' },
        { codigo: '2', nombre: 'Externo' },
    ]
    await prisma.origenCatalog.createMany({ data: origenesData })

    const consecuenciasData = [
        { codigo: '1', nombre: 'Negativa' },
        { codigo: '2', nombre: 'Positiva' },
    ]
    await prisma.consecuenciaCatalog.createMany({ data: consecuenciasData })
    console.log('✅ Catálogos base creados\n')

    // 7.6 CREAR IMPACTOS (TIPOS Y NIVELES)
    console.log('📌 Creando impactos...')
    const impactosTiposData = [
        { clave: 'ambiental', nombre: 'Ambiental' },
        { clave: 'confidencialidadSGSI', nombre: 'Confidencialidad SGSI' },
        { clave: 'disponibilidadSGSI', nombre: 'Disponibilidad SGSI' },
        { clave: 'economico', nombre: 'Economico' },
        { clave: 'integridadSGSI', nombre: 'Integridad SGSI' },
        { clave: 'legal', nombre: 'Legal' },
        { clave: 'personas', nombre: 'Personas' },
        { clave: 'procesos', nombre: 'Procesos' },
        { clave: 'reputacion', nombre: 'Reputacion' },
    ]
    for (const tipo of impactosTiposData) {
        await prisma.impactoTipo.create({ data: tipo })
    }

    const impactosTipos = await prisma.impactoTipo.findMany()
    const tipoIdByClave = impactosTipos.reduce<Record<string, number>>((acc, t) => {
        acc[t.clave] = t.id
        return acc
    }, {})

    const impactosNivelesData = [
        // Ambiental
        { clave: 'ambiental', nivel: 1, descripcion: 'Sin afectacion ambiental. Sin modificaciones en el ambiente' },
        { clave: 'ambiental', nivel: 2, descripcion: 'Afectacion ambiental leve con correccion a corto plazo' },
        { clave: 'ambiental', nivel: 3, descripcion: 'Afectacion ambiental localizada con correccion a mediano plazo' },
        { clave: 'ambiental', nivel: 4, descripcion: 'Afectacion ambiental grave con correccion a largo plazo' },
        { clave: 'ambiental', nivel: 5, descripcion: 'Dano ambiental irreparable o nocivo' },

        // Confidencialidad SGSI
        { clave: 'confidencialidadSGSI', nivel: 1, descripcion: 'El activo no se expone a acceso no autorizado' },
        { clave: 'confidencialidadSGSI', nivel: 2, descripcion: 'Exposicion de informacion interna a externos' },
        { clave: 'confidencialidadSGSI', nivel: 3, descripcion: 'Acceso no autorizado a informacion confidencial' },
        { clave: 'confidencialidadSGSI', nivel: 4, descripcion: 'Exposicion de informacion confidencial a externos' },
        { clave: 'confidencialidadSGSI', nivel: 5, descripcion: 'Exposicion de informacion secreta a externos' },

        // Disponibilidad SGSI
        { clave: 'disponibilidadSGSI', nivel: 1, descripcion: 'Sin impacto en objetivos por indisponibilidad' },
        { clave: 'disponibilidadSGSI', nivel: 2, descripcion: 'Indisponibilidad sin afectar operacion' },
        { clave: 'disponibilidadSGSI', nivel: 3, descripcion: 'Retraso en cumplimiento de objetivos' },
        { clave: 'disponibilidadSGSI', nivel: 4, descripcion: 'No se cumplen objetivos por indisponibilidad' },
        { clave: 'disponibilidadSGSI', nivel: 5, descripcion: 'Perdida de confianza por indisponibilidad total' },

        // Economico
        { clave: 'economico', nivel: 1, descripcion: 'Variacion financiera hasta 2K USD' },
        { clave: 'economico', nivel: 2, descripcion: 'Variacion financiera hasta 14.5K USD' },
        { clave: 'economico', nivel: 3, descripcion: 'Variacion financiera hasta 33.8K USD' },
        { clave: 'economico', nivel: 4, descripcion: 'Variacion financiera hasta 85.9K USD' },
        { clave: 'economico', nivel: 5, descripcion: 'Variacion financiera superior a 85.9K USD' },

        // Integridad SGSI
        { clave: 'integridadSGSI', nivel: 1, descripcion: 'Sin impacto en objetivos por integridad' },
        { clave: 'integridadSGSI', nivel: 2, descripcion: 'Afectacion menor con continuidad operativa' },
        { clave: 'integridadSGSI', nivel: 3, descripcion: 'Retraso en cumplimiento por integridad' },
        { clave: 'integridadSGSI', nivel: 4, descripcion: 'No se cumplen objetivos por integridad' },
        { clave: 'integridadSGSI', nivel: 5, descripcion: 'Perdida de confianza por integridad' },

        // Legal
        { clave: 'legal', nivel: 1, descripcion: 'Queja ante autoridad administrativa' },
        { clave: 'legal', nivel: 2, descripcion: 'Observaciones con plazo de acciones' },
        { clave: 'legal', nivel: 3, descripcion: 'Multas o sanciones por incumplimiento' },
        { clave: 'legal', nivel: 4, descripcion: 'Antecedentes judiciales o administrativos' },
        { clave: 'legal', nivel: 5, descripcion: 'Intervencion por ente regulador' },

        // Personas
        { clave: 'personas', nivel: 1, descripcion: 'Lesion leve, sin incapacidad' },
        { clave: 'personas', nivel: 2, descripcion: 'Lesion menor, sin incapacidad' },
        { clave: 'personas', nivel: 3, descripcion: 'Incapacidad temporal' },
        { clave: 'personas', nivel: 4, descripcion: 'Incapacidad permanente parcial o total' },
        { clave: 'personas', nivel: 5, descripcion: 'Fatalidades o afectacion severa' },

        // Procesos
        { clave: 'procesos', nivel: 1, descripcion: 'Afectacion minima del proceso' },
        { clave: 'procesos', nivel: 2, descripcion: 'Impacto bajo en tiempo de ejecucion' },
        { clave: 'procesos', nivel: 3, descripcion: 'Impacto moderado en tiempo de ejecucion' },
        { clave: 'procesos', nivel: 4, descripcion: 'Impacto mayor con afectacion a clientes' },
        { clave: 'procesos', nivel: 5, descripcion: 'Impacto importante en continuidad del proceso' },

        // Reputacion
        { clave: 'reputacion', nivel: 1, descripcion: 'Sin afectacion de confianza' },
        { clave: 'reputacion', nivel: 2, descripcion: 'Afectacion local o interna' },
        { clave: 'reputacion', nivel: 3, descripcion: 'Noticias negativas en medios locales' },
        { clave: 'reputacion', nivel: 4, descripcion: 'Danio significativo a la marca' },
        { clave: 'reputacion', nivel: 5, descripcion: 'Perdida total de confianza del mercado' },
    ]

    for (const nivel of impactosNivelesData) {
        const impactoTipoId = tipoIdByClave[nivel.clave]
        if (!impactoTipoId) continue
        await prisma.impactoNivel.create({
            data: {
                impactoTipoId,
                nivel: nivel.nivel,
                descripcion: nivel.descripcion,
            }
        })
    }
    console.log(`✅ ${impactosTipos.length} tipos de impacto creados\n`)

    // 8. CREAR PROCESOS
    console.log('📋 Creando procesos...')
    const procesosData = [
        {
            nombre: 'Direccionamiento Estratégico',
            descripcion: 'Gestión del direccionamiento estratégico',
            objetivo: 'Definir y dirigir la estrategia organizacional',
            tipo: 'Estratégico',
            responsableId: usuarios.find(u => u.nombre === 'Marco Alvarado')?.id,
            areaId: allAreas.find(a => a.nombre === 'Dirección')?.id,
            vicepresidencia: 'Vicepresidencia de Dirección',
            gerencia: 'Gerencia de Dirección Estratégica',
            estado: 'aprobado',
            activo: true
        },
        {
            nombre: 'Planificación Financiera',
            descripcion: 'Gestión de planificación y presupuesto financiero',
            objetivo: 'Planificar y gestionar recursos financieros',
            tipo: 'Operacional',
            responsableId: usuarios.find(u => u.nombre === 'Marco Alvarado')?.id,
            areaId: allAreas.find(a => a.nombre === 'Gestión Financiera y Administrativa')?.id,
            vicepresidencia: 'Vicepresidencia Financiera',
            gerencia: 'Gerencia de Tesorería y Finanzas',
            estado: 'aprobado',
            activo: true
        },
        {
            nombre: 'Gestión de Talento Humano',
            descripcion: 'Gestión de recursos humanos y talento',
            objetivo: 'Gestionar eficientemente el capital humano',
            tipo: 'Apoyo',
            responsableId: usuarios.find(u => u.nombre === 'Katherine Chavez')?.id,
            areaId: allAreas.find(a => a.nombre === 'Talento Humano')?.id,
            vicepresidencia: 'Vicepresidencia de Talento Humano',
            gerencia: 'Gerencia de Talento Humano',
            estado: 'aprobado',
            activo: true
        },
        {
            nombre: 'Gestión de TICS',
            descripcion: 'Gestión de tecnologías de información',
            objetivo: 'Gestionar la infraestructura tecnológica',
            tipo: 'Apoyo',
            responsableId: usuarios.find(u => u.nombre === 'Luis Terán')?.id,
            areaId: allAreas.find(a => a.nombre === 'Tecnología')?.id,
            vicepresidencia: 'Vicepresidencia de Tecnología',
            gerencia: 'Gerencia de TICS',
            estado: 'aprobado',
            activo: true
        }
    ]

    const procesos = []
    for (const procesoData of procesosData) {
        const p = await prisma.proceso.create({ data: procesoData as any })
        procesos.push(p)
    }
    console.log(`✅ ${procesos.length} procesos creados\n`)

    // 9. CREAR RIESGOS Y EVALUACIONES
    console.log('🎯 Creando riesgos y evaluaciones...')
    const riesgosData = [
        {
            procesoId: procesos[2].id, // Talento Humano
            numero: 1,
            numeroIdentificacion: '1GTH',
            descripcion: 'Probabilidad de afectar continuidad por falta de personal capacitado',
            clasificacion: 'Negativa',
            zona: 'Operacional',
            tipologiaNivelI: '02 Operacional',
            tipologiaNivelII: 'Falta de actualización',
            tipoRiesgoId: allTiposRiesgo.find(t => t.nombre === 'Operacional')?.id,
            causaRiesgo: 'Personas',
            fuenteCausa: 'Talleres internos',
            origen: 'Talleres internos',
            gerencia: 'Gerencia de Talento Humano',
            siglaGerencia: 'GTH',
            objetivoId: objetivos[5]?.id // "Asegurar continuidad"
        },
        {
            procesoId: procesos[2].id, // Talento Humano
            numero: 2,
            numeroIdentificacion: '2GTH',
            descripcion: 'Riesgo de incumplimiento normativo en contratación laboral',
            clasificacion: 'Negativa',
            zona: 'Cumplimiento',
            tipologiaNivelI: '04 Cumplimiento',
            tipologiaNivelII: 'Cumplimiento regulatorio',
            tipoRiesgoId: allTiposRiesgo.find(t => t.nombre === 'Cumplimiento')?.id,
            causaRiesgo: 'Legal',
            fuenteCausa: 'Auditoría HHI',
            origen: 'Auditoría HHI',
            gerencia: 'Gerencia de Talento Humano',
            siglaGerencia: 'GTH',
            objetivoId: objetivos[6]?.id // "Retener talento"
        },
        {
            procesoId: procesos[2].id, // Talento Humano
            numero: 3,
            numeroIdentificacion: '3GTH',
            descripcion: 'Riesgo de pérdida de talento clave por falta de planes retención',
            clasificacion: 'Negativa',
            zona: 'Estratégico',
            tipologiaNivelI: '01 Estratégico',
            tipologiaNivelII: 'Retención de talento',
            tipoRiesgoId: allTiposRiesgo.find(t => t.nombre === 'Estratégico')?.id,
            causaRiesgo: 'Personas',
            fuenteCausa: 'Mercado laboral',
            origen: 'Mercado laboral',
            gerencia: 'Gerencia de Talento Humano',
            siglaGerencia: 'GTH',
            objetivoId: objetivos[6]?.id
        }
    ]

    const riesgos = []
    for (const riesgoData of riesgosData) {
        const r = await prisma.riesgo.create({ data: riesgoData as any })
        riesgos.push(r)
    }
    console.log(`✅ ${riesgos.length} riesgos creados\n`)

    // 10. CREAR EVALUACIONES
    console.log('📊 Creando evaluaciones...')
    const evaluacionesData = [
        {
            riesgoId: riesgos[0].id,
            probabilidad: 4,
            impactoPersonas: 5,
            impactoLegal: 2,
            impactoAmbiental: 1,
            impactoProcesos: 5,
            impactoReputacion: 3,
            impactoEconomico: 4,
            impactoTecnologico: 2,
            impactoGlobal: 4,
            impactoMaximo: 5,
            riesgoInherente: 20,
            nivelRiesgo: 'NIVEL CRÍTICO',
            evaluadoPor: 'Equipo TH'
        },
        {
            riesgoId: riesgos[1].id,
            probabilidad: 3,
            impactoPersonas: 3,
            impactoLegal: 5,
            impactoAmbiental: 1,
            impactoProcesos: 3,
            impactoReputacion: 4,
            impactoEconomico: 4,
            impactoTecnologico: 1,
            impactoGlobal: 4,
            impactoMaximo: 5,
            riesgoInherente: 15,
            nivelRiesgo: 'NIVEL ALTO',
            evaluadoPor: 'Equipo Compliance'
        },
        {
            riesgoId: riesgos[2].id,
            probabilidad: 4,
            impactoPersonas: 5,
            impactoLegal: 2,
            impactoAmbiental: 0,
            impactoProcesos: 4,
            impactoReputacion: 5,
            impactoEconomico: 4,
            impactoTecnologico: 2,
            impactoGlobal: 4,
            impactoMaximo: 5,
            riesgoInherente: 20,
            nivelRiesgo: 'NIVEL CRÍTICO',
            evaluadoPor: 'Equipo TH'
        }
    ]

    const evaluaciones = []
    for (const evalData of evaluacionesData) {
        const e = await prisma.evaluacionRiesgo.create({ data: evalData as any })
        evaluaciones.push(e)
    }
    console.log(`✅ ${evaluaciones.length} evaluaciones creadas\n`)

    // 11. CREAR CAUSAS Y CONTROLES
    console.log('⚠️  Creando causas y controles...')
    const causasData = [
        { riesgoId: riesgos[0].id, descripcion: 'Falta de programas de capacitación continua', fuenteCausa: 'Interna', frecuencia: 'Probable', seleccionada: true },
        { riesgoId: riesgos[0].id, descripcion: 'Rotación de personal sin transferencia', fuenteCausa: 'Interna', frecuencia: 'Probable', seleccionada: false },
        { riesgoId: riesgos[1].id, descripcion: 'Desactualización en normativas laborales', fuenteCausa: 'Externa', frecuencia: 'Probable', seleccionada: true },
        { riesgoId: riesgos[2].id, descripcion: 'Falta de planes de carrera y desarrollo', fuenteCausa: 'Interna', frecuencia: 'Probable', seleccionada: true },
        { riesgoId: riesgos[2].id, descripcion: 'Competencia del mercado laboral', fuenteCausa: 'Externa', frecuencia: 'Esperado', seleccionada: false },
    ]

    const causas = []
    for (const causaData of causasData) {
        const c = await prisma.causaRiesgo.create({ data: causaData as any })
        causas.push(c)
    }

    // Agregar controles a las primeras causas
    for (let i = 0; i < Math.min(3, causas.length); i++) {
        await prisma.controlRiesgo.create({
            data: {
                causaRiesgoId: causas[i].id,
                descripcion: `Control preventivo para: ${causasData[i].descripcion}`,
                tipoControl: 'AUTOMATICO',
                responsable: usuarios[1].nombre,
                aplicabilidad: 3,
                cobertura: 4,
                facilidadUso: 3,
                segregacion: 3,
                naturaleza: 3,
                desviaciones: 2,
                puntajeControl: 75,
                evaluacionPreliminar: 'Efectivo',
                evaluacionDefinitiva: 'Efectivo'
            }
        })
    }
    console.log(`✅ ${causas.length} causas y controles creados\n`)

    // 12. CREAR PRIORIZACIONES Y PLANES DE ACCIÓN
    console.log('📌 Creando priorizaciones...')
    for (const riesgo of riesgos) {
        const priorizacion = await prisma.priorizacionRiesgo.create({
            data: {
                riesgoId: riesgo.id,
                calificacionFinal: 15,
                respuesta: 'Mitigar',
                responsable: usuarios[1].nombre,
                puntajePriorizacion: 3.5,
                planesAccion: {
                    create: [
                        {
                            descripcion: `Plan de acción mitigation para riesgo ${riesgo.numero}`,
                            responsable: usuarios[1].nombre,
                            fechaInicio: new Date('2024-02-01'),
                            fechaFin: new Date('2024-03-01'),
                            estado: 'En Progreso'
                        }
                    ]
                }
            }
        })
    }
    console.log(`✅ Priorizaciones y planes de acción creados\n`)

    console.log('✅✅✅ SEED COMPLETO EJECUTADO EXITOSAMENTE ✅✅✅')
    console.log('\n📊 RESUMEN:')
    console.log(`  - ${usuarios.length} Usuarios`)
    console.log(`  - ${allAreas.length} Áreas`)
    console.log(`  - ${procesos.length} Procesos`)
    console.log(`  - ${riesgos.length} Riesgos`)
    console.log(`  - ${evaluaciones.length} Evaluaciones`)
    console.log(`  - ${causas.length} Causas`)
    console.log(`  - ${allTiposRiesgo.length} Tipos de Riesgo`)
    console.log(`  - ${objetivosData.length} Objetivos`)
}

main()
    .catch((e) => {
        console.error('❌ Error:', e)
        process.exit(1)
    })
    .finally(async () => {
        await prisma.$disconnect()
    })
