/**
 * 🌱 SEED COMPLETO - Sistema de Gestión de Riesgos
 * Carga TODOS los datos de la aplicación desde mockData
 * Usuarios, Áreas, Procesos, Riesgos, Evaluaciones, Catálogos
 * 
 * Uso: npm run seed
 */

import 'dotenv/config'
import { Pool } from 'pg'
import { PrismaPg } from '@prisma/adapter-pg'
import { PrismaClient } from '@prisma/client'

const connectionString = (process.env.DATABASE_URL || '').replace(/^\"|\"$/g, '');

if (!connectionString) {
    console.error('❌ DATABASE_URL no está configurada')
    process.exit(1)
}

const pool = new Pool({
    connectionString,
    ssl: { rejectUnauthorized: false }
})
const adapter = new PrismaPg(pool)
const prisma = new PrismaClient({ adapter })

// ============================================
// DATOS MAESTROS DEL SISTEMA
// ============================================

const USUARIOS_DATA = [
    { nombre: 'Carlos Ayala', email: 'cayala@comware.com.co', role: 'gerente_general', cargo: 'Director General', activo: false },
    { nombre: 'Marco Alvarado', email: 'marco@comware.com.co', role: 'dueño_procesos', cargo: 'Director Financiero', activo: true },
    { nombre: 'Ulpiano Muñoz', email: 'ulpiano@comware.com.co', role: 'dueño_procesos', cargo: 'Director Comercial', activo: true },
    { nombre: 'Katherine Chavez', email: 'katherine@comware.com.co', role: 'dueño_procesos', cargo: 'Analista Talento Humano', activo: true },
    { nombre: 'Jessica Guanoluisa', email: 'jessica@comware.com.co', role: 'dueño_procesos', cargo: 'Ingeniera Soporte', activo: true },
    { nombre: 'Luis Terán', email: 'luis@comware.com.co', role: 'dueño_procesos', cargo: 'Analista Helpdesk', activo: true },
    { nombre: 'Daniela Rodriguez', email: 'daniela@comware.com.co', role: 'dueño_procesos', cargo: 'Asistente Legal', activo: true },
    { nombre: 'Juan José Maldonado', email: 'juanjose@comware.com.co', role: 'gerente_general', cargo: 'Director General', activo: true },
    { nombre: 'Andrés Martínez', email: 'andres@comware.com.co', role: 'admin', cargo: 'Administrador', activo: true },
    { nombre: 'Carlos Rodríguez', email: 'carlos@comware.com.co', role: 'supervisor', cargo: 'Supervisor Riesgos', activo: true },
]

const AREAS_DATA = [
    { nombre: 'Gestión Financiera y Administrativa', descripcion: 'Procesos financieros y administrativos' },
    { nombre: 'Talento Humano', descripcion: 'Recursos humanos' },
    { nombre: 'Comercial', descripcion: 'Procesos comerciales y ventas' },
    { nombre: 'Tecnología', descripcion: 'Tecnología e infraestructura TI' },
    { nombre: 'Dirección', descripcion: 'Dirección estratégica' },
]

const PROCESOS_DATA = [
    {
        nombre: 'Planificación Financiera',
        descripcion: 'Gestión de planificación y presupuesto financiero',
        objetivo: 'Planificar y gestionar recursos financieros',
        tipo: 'Operacional',
        vicepresidencia: 'Vicepresidencia Financiera',
        gerencia: 'Gerencia Tesorería',
        estado: 'aprobado'
    },
    {
        nombre: 'Gestión de Talento Humano',
        descripcion: 'Gestión de recursos humanos y talento',
        objetivo: 'Gestionar eficientemente capital humano',
        tipo: 'Apoyo',
        vicepresidencia: 'Vicepresidencia Talento',
        gerencia: 'Gerencia TH',
        estado: 'aprobado'
    },
    {
        nombre: 'Gestión de TICS',
        descripcion: 'Gestión de tecnologías de información',
        objetivo: 'Gestionar infraestructura tecnológica',
        tipo: 'Apoyo',
        vicepresidencia: 'Vicepresidencia Tecnología',
        gerencia: 'Gerencia TICS',
        estado: 'aprobado'
    },
    {
        nombre: 'Ciberseguridad',
        descripcion: 'Gestión de ciberseguridad',
        objetivo: 'Proteger activos digitales',
        tipo: 'Operacional',
        vicepresidencia: 'Vicepresidencia Tecnología',
        gerencia: 'Gerencia Ciberseguridad',
        estado: 'aprobado'
    },
]

async function main() {
    console.log('🌱 INICIANDO SEED COMPLETO DEL SISTEMA...')
    console.log(`📅 Fecha: ${new Date().toISOString()}`)
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n')

    try {
        // 1. LIMPIEZA TOTAL
        console.log('🧹 Limpiando base de datos...')
        await Promise.all([
            prisma.eventoMaterializado.deleteMany({}),
            prisma.benchmarking.deleteMany({}),
            prisma.documento.deleteMany({}),
            prisma.planAccion.deleteMany({}),
            prisma.priorizacionRiesgo.deleteMany({}),
            prisma.controlRiesgo.deleteMany({}),
            prisma.causaRiesgo.deleteMany({}),
            prisma.evaluacionRiesgo.deleteMany({}),
            prisma.riesgo.deleteMany({}),
            prisma.dofaItem.deleteMany({}),
            prisma.normatividad.deleteMany({}),
            prisma.contexto.deleteMany({}),
            prisma.observacion.deleteMany({}),
            prisma.historialCambioProceso.deleteMany({}),
            prisma.proceso.deleteMany({}),
            prisma.area.deleteMany({}),
            prisma.usuario.deleteMany({}),
            prisma.cargo.deleteMany({}),
            prisma.objetivo.deleteMany({}),
            prisma.subtipoRiesgo.deleteMany({}),
            prisma.tipoRiesgo.deleteMany({}),
            prisma.gerencia.deleteMany({}),
            prisma.impactoNivel.deleteMany({}),
            prisma.impactoTipo.deleteMany({}),
            prisma.frecuenciaCatalog.deleteMany({}),
            prisma.fuenteCatalog.deleteMany({}),
            prisma.origenCatalog.deleteMany({}),
            prisma.consecuenciaCatalog.deleteMany({}),
        ])
        console.log('✅ Base datos limpiada\n')

        // 2. CREAR CARGOS
        console.log('👥 Creando cargos...')
        const cargoMap: Record<string, number> = {}
        const cargosUnicos = Array.from(new Set(USUARIOS_DATA.map(u => u.cargo)))
        for (const cargoNombre of cargosUnicos) {
            const cargo = await prisma.cargo.create({
                data: { nombre: cargoNombre, descripcion: cargoNombre }
            })
            cargoMap[cargoNombre] = cargo.id
        }
        console.log(`✅ ${Object.keys(cargoMap).length} cargos creados\n`)

        // 3. CREAR USUARIOS
        console.log('👤 Creando usuarios...')
        const usuariosMap: Record<string, number> = {}
        for (const userData of USUARIOS_DATA) {
            const user = await prisma.usuario.create({
                data: {
                    nombre: userData.nombre,
                    email: userData.email,
                    password: 'comware123',
                    role: userData.role,
                    cargoId: cargoMap[userData.cargo],
                    activo: userData.activo
                }
            })
            usuariosMap[userData.nombre] = user.id
        }
        console.log(`✅ ${Object.keys(usuariosMap).length} usuarios creados\n`)

        // 4. CREAR GERENCIAS
        console.log('🏢 Creando gerencias...')
        const gerenciasData = [
            { nombre: 'Gerencia Financiera', sigla: 'GF', subdivision: 'Vicepresidencia Financiera' },
            { nombre: 'Gerencia Talento Humano', sigla: 'GTH', subdivision: 'Vicepresidencia Talento' },
            { nombre: 'Gerencia Tecnología', sigla: 'GT', subdivision: 'Vicepresidencia Tecnología' },
            { nombre: 'Gerencia Ciberseguridad', sigla: 'GCS', subdivision: 'Vicepresidencia Tecnología' },
        ]
        const gerencias = await prisma.gerencia.createMany({ data: gerenciasData })
        console.log(`✅ ${gerenciasData.length} gerencias creadas\n`)

        // 5. CREAR ÁREAS
        console.log('🏢 Creando áreas...')
        const areasMap: Record<string, number> = {}
        const userMarcoId = usuariosMap['Marco Alvarado']
        for (const areaData of AREAS_DATA) {
            const area = await prisma.area.create({
                data: {
                    nombre: areaData.nombre,
                    descripcion: areaData.descripcion,
                    directorId: areaData.nombre.includes('Talento') ? usuariosMap['Katherine Chavez'] : userMarcoId,
                    activo: true
                }
            })
            areasMap[areaData.nombre] = area.id
        }
        console.log(`✅ ${Object.keys(areasMap).length} áreas creadas\n`)

        // 6. CREAR CATÁLOGOS - Tipos de Riesgo
        console.log('📚 Creando tipos de riesgo...')
        const tipoRiesgoEstrategico = await prisma.tipoRiesgo.create({
            data: {
                codigo: '1',
                nombre: 'Estratégico',
                descripcion: 'Riesgos de plan estratégico',
                subtipos: {
                    create: [
                        { nombre: 'talento humano', descripcion: 'Falta de talento clave' },
                        { nombre: 'alianzas', descripcion: 'Alianzas ineficientes' },
                    ]
                }
            }
        })

        const tipoRiesgoOperacional = await prisma.tipoRiesgo.create({
            data: {
                codigo: '2',
                nombre: 'Operacional',
                descripcion: 'Riesgos en procesos y operaciones',
                subtipos: {
                    create: [
                        { nombre: 'proceso', descripcion: 'Fallas en procesos' },
                        { nombre: 'sistemas', descripcion: 'Fallas en TI' },
                        { nombre: 'personas', descripcion: 'Riesgos de personas' },
                    ]
                }
            }
        })

        const tipoRiesgoFinanciero = await prisma.tipoRiesgo.create({
            data: {
                codigo: '3',
                nombre: 'Financiero',
                descripcion: 'Riesgos financieros',
                subtipos: {
                    create: [
                        { nombre: 'presupuestal', descripcion: 'Desviaciones presupuestales' },
                        { nombre: 'liquidez', descripcion: 'Problemas de liquidez' },
                    ]
                }
            }
        })

        const tipoRiesgoCumplimiento = await prisma.tipoRiesgo.create({
            data: {
                codigo: '4',
                nombre: 'Cumplimiento',
                descripcion: 'Riesgos normativo',
                subtipos: {
                    create: [
                        { nombre: 'legal', descripcion: 'Riesgos legales' },
                        { nombre: 'regulatorio', descripcion: 'Riesgos regulatorios' },
                    ]
                }
            }
        })

        console.log('✅ Tipos de riesgo creados\n')

        // 7. CREAR OBJETIVOS
        console.log('🎯 Creando objetivos...')
        const objetivosData = [
            { codigo: '1', descripcion: 'Maximizar rentabilidad' },
            { codigo: '13', descripcion: 'Aplicar estándares de seguridad' },
            { codigo: '16', descripcion: 'Gestionar desempeño personal' },
            { codigo: '17', descripcion: 'Asegurar continuidad operacional' },
            { codigo: '18', descripcion: 'Retener talento clave' },
        ]
        const objetivos = await prisma.objetivo.createMany({ data: objetivosData as any })
        const allObjetivos = await prisma.objetivo.findMany()
        console.log(`✅ ${allObjetivos.length} objetivos creados\n`)

        // 7.1 CREAR FRECUENCIAS
        console.log('⏱️  Creando frecuencias...')
        const frecuenciasData = [
            { label: 'Raro', descripcion: 'mayor a anual' },
            { label: 'Improbable', descripcion: 'mayor a trimestral y hasta anual' },
            { label: 'Posible', descripcion: 'mayor a mensual y hasta trimestral' },
            { label: 'Probable', descripcion: 'mayor a diaria y hasta mensual' },
            { label: 'Esperado', descripcion: 'diaria o varias veces al dia' },
        ]
        await prisma.frecuenciaCatalog.createMany({ data: frecuenciasData })
        console.log(`✅ ${frecuenciasData.length} frecuencias creadas\n`)

        // 7.2 CREAR FUENTES
        console.log('🧩 Creando fuentes...')
        const fuentesData = [
            { nombre: 'Personas' },
            { nombre: 'Proceso' },
            { nombre: 'Legal' },
            { nombre: 'Infraestructura' },
            { nombre: 'Externos' },
        ]
        await prisma.fuenteCatalog.createMany({ data: fuentesData })
        console.log(`✅ ${fuentesData.length} fuentes creadas\n`)

        // 7.3 CREAR ORIGENES
        console.log('🧭 Creando origenes...')
        const origenesData = [
            { codigo: '1', nombre: 'Talleres internos' },
            { codigo: '2', nombre: 'Auditoria HHI' },
            { codigo: '3', nombre: 'Auditorias Externas' },
            { codigo: '4', nombre: 'SGSI' },
            { codigo: '5', nombre: 'SSO' },
        ]
        await prisma.origenCatalog.createMany({ data: origenesData })
        console.log(`✅ ${origenesData.length} origenes creados\n`)

        // 7.4 CREAR CONSECUENCIAS
        console.log('⚠️  Creando consecuencias...')
        const consecuenciasData = [
            { codigo: '1', nombre: 'Negativa' },
            { codigo: '2', nombre: 'Positiva' },
        ]
        await prisma.consecuenciaCatalog.createMany({ data: consecuenciasData })
        console.log(`✅ ${consecuenciasData.length} consecuencias creadas\n`)

        // 7.5 CREAR IMPACTOS (TIPOS Y NIVELES)
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
        const procesosMap: Record<string, number> = {}
        const procesosCrear = PROCESOS_DATA.map(p => ({
            ...p,
            responsableId: usuariosMap['Marco Alvarado'],
            areaId: areasMap[p.vicepresidencia?.includes('Talento') ? 'Talento Humano' : 'Gestión Financiera y Administrativa'] || areasMap['Gestión Financiera y Administrativa'],
            activo: true
        }))

        for (const procData of procesosCrear) {
            const proc = await prisma.proceso.create({ data: procData as any })
            procesosMap[proc.nombre] = proc.id
        }
        console.log(`✅ ${Object.keys(procesosMap).length} procesos creados\n`)

        // 9. CREAR RIESGOS Y EVALUACIONES
        console.log('🎯 Creando riesgos...')
        const riesgosData = [
            {
                procesoId: procesosMap['Gestión de Talento Humano'],
                numero: 1,
                numeroIdentificacion: '1GTH',
                descripcion: 'Falta de personal capacitado en procesos críticos',
                clasificacion: 'Negativa',
                zona: 'Operacional',
                tipologiaNivelI: 'Operacional',
                tipologiaNivelII: 'Falta de capacitación',
                tipoRiesgoId: tipoRiesgoOperacional.id,
                causaRiesgo: 'Personas',
                fuenteCausa: 'Interna',
                origen: 'Talleres internos',
                gerencia: 'Gerencia TH',
                siglaGerencia: 'GTH',
                objetivoId: allObjetivos[3]?.id,
            },
            {
                procesoId: procesosMap['Gestión de Talento Humano'],
                numero: 2,
                numeroIdentificacion: '2GTH',
                descripcion: 'Incumplimiento normativo en contratación laboral',
                clasificacion: 'Negativa',
                zona: 'Cumplimiento',
                tipologiaNivelI: 'Cumplimiento',
                tipologiaNivelII: 'Normativo',
                tipoRiesgoId: tipoRiesgoCumplimiento.id,
                causaRiesgo: 'Legal',
                fuenteCausa: 'Externa',
                origen: 'Regulación',
                gerencia: 'Gerencia TH',
                siglaGerencia: 'GTH',
                objetivoId: allObjetivos[4]?.id,
            },
            {
                procesoId: procesosMap['Gestión de Talento Humano'],
                numero: 3,
                numeroIdentificacion: '3GTH',
                descripcion: 'Pérdida de talento clave por falta planes retención',
                clasificacion: 'Negativa',
                zona: 'Estratégico',
                tipologiaNivelI: 'Estratégico',
                tipologiaNivelII: 'Retención',
                tipoRiesgoId: tipoRiesgoEstrategico.id,
                causaRiesgo: 'Personas',
                fuenteCausa: 'Mercado',
                origen: 'Mercado laboral',
                gerencia: 'Gerencia TH',
                siglaGerencia: 'GTH',
                objetivoId: allObjetivos[4]?.id,
            },
        ]

        const riesgos = []
        for (const rData of riesgosData) {
            const r = await prisma.riesgo.create({ data: rData as any })
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
                evaluadoPor: 'Sistema'
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
                evaluadoPor: 'Sistema'
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
                evaluadoPor: 'Sistema'
            }
        ]

        for (const evalData of evaluacionesData) {
            await prisma.evaluacionRiesgo.create({ data: evalData as any })
        }
        console.log(`✅ ${evaluacionesData.length} evaluaciones creadas\n`)

        // 11. CREAR CAUSAS Y CONTROLES
        console.log('⚠️  Creando causas y controles...')
        const causasData = [
            { riesgoId: riesgos[0].id, descripcion: 'Falta programas capacitación', fuenteCausa: 'Interna', frecuencia: 'Probable' },
            { riesgoId: riesgos[0].id, descripcion: 'Rotación personal sin transferencia', fuenteCausa: 'Interna', frecuencia: 'Probable' },
            { riesgoId: riesgos[1].id, descripcion: 'Desactualización normativas', fuenteCausa: 'Externa', frecuencia: 'Probable' },
            { riesgoId: riesgos[2].id, descripcion: 'Falta planes carrera', fuenteCausa: 'Interna', frecuencia: 'Probable' },
        ]

        for (const causaData of causasData) {
            const causa = await prisma.causaRiesgo.create({ data: causaData as any })

            // Agregar control a la causa
            await prisma.controlRiesgo.create({
                data: {
                    causaRiesgoId: causa.id,
                    descripcion: `Control para: ${causaData.descripcion}`,
                    tipoControl: 'AUTOMATICO',
                    responsable: 'Gestor Riesgos',
                    puntajeControl: 75,
                    evaluacionPreliminar: 'Efectivo',
                    evaluacionDefinitiva: 'Efectivo'
                }
            })
        }
        console.log(`✅ ${causasData.length} causas y controles creados\n`)

        // 12. CREAR PRIORIZACIONES
        console.log('📌 Creando priorizaciones...')
        for (const riesgo of riesgos) {
            await prisma.priorizacionRiesgo.create({
                data: {
                    riesgoId: riesgo.id,
                    calificacionFinal: 15,
                    respuesta: 'Mitigar',
                    responsable: 'Gestor Riesgos',
                    puntajePriorizacion: 3.5,
                    planesAccion: {
                        create: [{
                            descripcion: `Plan acción para mitigar riesgo ${riesgo.numero}`,
                            responsable: 'Gestor Riesgos',
                            fechaInicio: new Date('2024-02-01'),
                            fechaFin: new Date('2024-03-01'),
                            estado: 'Pendiente'
                        }]
                    }
                }
            })
        }
        console.log(`✅ Priorizaciones creadas\n`)

        // RESUMEN FINAL
        console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━')
        console.log('✅✅✅ SEED COMPLETADO EXITOSAMENTE ✅✅✅')
        console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n')
        console.log('📊 DATOS CARGADOS:')
        console.log(`  ✅ ${Object.keys(usuariosMap).length} Usuarios`)
        console.log(`  ✅ ${Object.keys(areasMap).length} Áreas`)
        console.log(`  ✅ ${Object.keys(procesosMap).length} Procesos`)
        console.log(`  ✅ ${riesgos.length} Riesgos`)
        console.log(`  ✅ ${evaluacionesData.length} Evaluaciones`)
        console.log(`  ✅ 4 Tipos de Riesgo`)
        console.log(`  ✅ ${allObjetivos.length} Objetivos`)
        console.log(`  ✅ ${causasData.length} Causas de Riesgo\n`)

    } catch (e) {
        console.error('❌ Error crítico en seed:', e)
        process.exit(1)
    }
}

main()
    .catch((e) => {
        console.error('❌ Error:', e)
        process.exit(1)
    })
    .finally(async () => {
        await prisma.$disconnect()
        console.log('🔌 Desconexión completada\n')
    })
