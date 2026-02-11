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
    console.log('🌱 INICIANDO SEED CON IDS AUTOINCREMENT...\n')

    // 1. LIMPIEZA TOTAL
    console.log('🧹 Limpiando datos existentes...')
    try {
        await prisma.eventoMaterializado.deleteMany({});
        await prisma.benchmarking.deleteMany({});
        await prisma.planAccion.deleteMany({});
        await prisma.priorizacionRiesgo.deleteMany({});
        await prisma.controlRiesgo.deleteMany({});
        await prisma.causaRiesgo.deleteMany({});
        await prisma.evaluacionRiesgo.deleteMany({});
        await prisma.riesgo.deleteMany({});
        await prisma.dofaItem.deleteMany({});
        await prisma.normatividad.deleteMany({});
        await prisma.contexto.deleteMany({});
        await prisma.observacion.deleteMany({});
        await prisma.historialCambioProceso.deleteMany({});
        await prisma.proceso.deleteMany({});
        await prisma.area.deleteMany({});
        await prisma.usuario.deleteMany({});
        await prisma.cargo.deleteMany({});
        await prisma.gerencia.deleteMany({});
        console.log('✅ Limpieza completada\n')
    } catch (e) {
        console.warn('⚠️  Advertencia en limpieza:', e)
    }

    // 2. CREAR CARGOS
    console.log('👥 Creando cargos...')
    const cargoAdmin = await prisma.cargo.create({ data: { nombre: 'Administrador', descripcion: 'Administrador total del sistema' } });
    const cargoGerente = await prisma.cargo.create({ data: { nombre: 'Gerente General', descripcion: 'Máxima autoridad de la empresa' } });
    const cargoDirector = await prisma.cargo.create({ data: { nombre: 'Director Financiero', descripcion: 'Responsable de las finanzas corporativas' } });
    const cargoAnalista = await prisma.cargo.create({ data: { nombre: 'Analista TH', descripcion: 'Analista de Talento Humano' } });

    // 3. CREAR USUARIOS
    console.log('👤 Creando usuarios...')
    const userAdmin = await prisma.usuario.create({
        data: {
            nombre: 'Andrés Martínez',
            email: 'admin@comware.com.ec',
            password: 'comware123',
            role: 'admin',
            cargoId: cargoAdmin.id,
            activo: true
        }
    });

    const userGerente = await prisma.usuario.create({
        data: {
            nombre: 'Carlos Ayala',
            email: 'gerente@comware.com.ec',
            password: 'comware123',
            role: 'gerente_general',
            cargoId: cargoGerente.id,
            activo: true
        }
    });

    const userMarco = await prisma.usuario.create({
        data: {
            nombre: 'Marco Alvarado',
            email: 'marco@comware.com.ec',
            password: 'comware123',
            role: 'dueño_procesos',
            cargoId: cargoDirector.id,
            activo: true
        }
    });

    const userKatherine = await prisma.usuario.create({
        data: {
            nombre: 'Katherine Chavez',
            email: 'katherine@comware.com.ec',
            password: 'comware123',
            role: 'dueño_procesos',
            cargoId: cargoAnalista.id,
            activo: true
        }
    });

    // 4. CREAR GERENCIAS
    console.log('🏢 Creando gerencias...')
    await prisma.gerencia.createMany({
        data: [
            { nombre: 'Gerencia General', sigla: 'GG', subdivision: 'Directiva' },
            { nombre: 'Gerencia Financiera', sigla: 'GF', subdivision: 'Administrativa' },
            { nombre: 'Gerencia de Talento Humano', sigla: 'GTH', subdivision: 'Apoyo' },
            { nombre: 'Gerencia de Operaciones', sigla: 'GO', subdivision: 'Operativa' }
        ]
    });

    // 5. CREAR ÁREAS
    console.log('🏢 Creando áreas...')
    const areaFinanciera = await prisma.area.create({
        data: {
            nombre: 'Gestión Financiera y Administrativa',
            descripcion: 'Área responsable de la planificación y gestión financiera',
            directorId: userMarco.id,
            activo: true
        }
    });

    const areaTH = await prisma.area.create({
        data: {
            nombre: 'Gestión de Talento Humano',
            descripcion: 'Área responsable de la gestión del capital humano',
            directorId: userKatherine.id,
            activo: true
        }
    });

    // 6. CREAR PROCESOS
    console.log('📋 Creando procesos...')
    const procesoFinanciero = await prisma.proceso.create({
        data: {
            nombre: 'Planificación Financiera',
            descripcion: 'Proceso de planificación y control presupuestal',
            objetivo: 'Garantizar la sostenibilidad financiera mediante una adecuada planificación y control de recursos',
            tipo: 'Estratégico',
            responsableId: userMarco.id,
            areaId: areaFinanciera.id,
            vicepresidencia: 'Vicepresidencia Financiera',
            gerencia: 'Gerencia de Tesorería y Finanzas',
            estado: 'aprobado',
            activo: true,
            analisis: 'Proceso crítico para la sostenibilidad organizacional.',
            documentoNombre: 'Manual_Planificacion_Financiera.pdf'
        }
    });

    const procesoTH = await prisma.proceso.create({
        data: {
            nombre: 'Gestión de Talento Humano',
            descripcion: 'Proceso de selección, desarrollo y retención del talento',
            objetivo: 'Atraer, desarrollar y retener el mejor talento',
            tipo: 'Apoyo',
            responsableId: userKatherine.id,
            areaId: areaTH.id,
            vicepresidencia: 'Vicepresidencia Administrativa',
            gerencia: 'Gerencia de Talento Humano',
            estado: 'aprobado',
            activo: true,
            analisis: 'Proceso fundamental para el desarrollo organizacional.',
            documentoNombre: 'Manual_Gestion_TH.pdf'
        }
    });

    // 7. RIESGOS Y EVALUACIONES
    console.log('🎯 Creando riesgos y evaluaciones...')
    const riesgo1 = await prisma.riesgo.create({
        data: {
            procesoId: procesoFinanciero.id,
            numero: 1,
            numeroIdentificacion: '1GF',
            descripcion: 'Desviación significativa en la ejecución presupuestal',
            clasificacion: 'Negativa',
            zona: 'Financiera',
            tipologiaNivelI: 'Operacional',
            tipologiaNivelII: 'Presupuestal',
            causaRiesgo: 'Proyecciones inexactas',
            fuenteCausa: 'Interna',
            origen: 'Interno',
            gerencia: 'Gerencia Financiera',
            siglaGerencia: 'GF'
        }
    });

    await prisma.evaluacionRiesgo.create({
        data: {
            riesgoId: riesgo1.id,
            probabilidad: 3,
            impactoPersonas: 1,
            impactoLegal: 2,
            impactoAmbiental: 1,
            impactoProcesos: 4,
            impactoReputacion: 3,
            impactoEconomico: 5,
            impactoTecnologico: 2,
            impactoGlobal: 5,
            impactoMaximo: 5,
            riesgoInherente: 15,
            nivelRiesgo: 'Alto',
            evaluadoPor: userMarco.nombre
        }
    });

    const causa1 = await prisma.causaRiesgo.create({
        data: {
            riesgoId: riesgo1.id,
            descripcion: 'Proyecciones desactualizadas',
            fuenteCausa: 'Interna',
            frecuencia: 'Probable',
            seleccionada: true
        }
    });

    await prisma.controlRiesgo.create({
        data: {
            causaRiesgoId: causa1.id,
            descripcion: 'Sistema de alertas presupuestales',
            tipoControl: 'AUTOMATICO',
            responsable: 'Director Financiero',
            puntajeControl: 85,
            evaluacionPreliminar: 'Efectivo',
            evaluacionDefinitiva: 'Efectivo',
            disminuyeFrecuenciaImpactoAmbas: 'AMBAS'
        }
    });

    console.log('✅ SEED COMPLETADO EXITOSAMENTE');
}

main()
    .catch((e) => {
        console.error(e)
        process.exit(1)
    })
    .finally(async () => {
        await prisma.$disconnect()
    })
