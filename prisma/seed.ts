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

// ==========================================
// SEED COMPLETO - DATOS REALES
// ==========================================

async function main() {
    console.log('🌱 INICIANDO SEED COMPLETO...\n')

    // ==========================================
    // 1. LIMPIEZA TOTAL
    // ==========================================
    console.log('🧹 Limpiando datos existentes...')
    try {
        // await prisma.documento.deleteMany({}); // Will be deleted via cascade
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
        console.log('✅ Limpieza completada\n')
    } catch (e) {
        console.warn('⚠️  Advertencia en limpieza:', e)
    }

    // ==========================================
    // 2. CREAR CARGOS Y USUARIOS (4 usuarios)
    // ==========================================
    console.log('👥 Creando usuarios...')

    const cargos = [
        { nombre: 'Administrador' },
        { nombre: 'Gerente General' },
        { nombre: 'Director Financiero' },
        { nombre: 'Analista TH' }
    ];

    for (const c of cargos) {
        await prisma.cargo.create({ data: c });
    }

    const usuarios = [
        { id: 'user-admin', nombre: 'Andrés Martínez', email: 'admin@comware.com.ec', role: 'admin', cargo: 'Administrador' },
        { id: 'user-gerente', nombre: 'Carlos Ayala', email: 'gerente@comware.com.ec', role: 'gerente_general', cargo: 'Gerente General' },
        { id: 'user-marco', nombre: 'Marco Alvarado', email: 'marco@comware.com.ec', role: 'dueño_procesos', cargo: 'Director Financiero' },
        { id: 'user-katherine', nombre: 'Katherine Chavez', email: 'katherine@comware.com.ec', role: 'dueño_procesos', cargo: 'Analista TH' }
    ];

    for (const u of usuarios) {
        const cargo = await prisma.cargo.findUnique({ where: { nombre: u.cargo } });
        await prisma.usuario.create({
            data: {
                id: u.id,
                nombre: u.nombre,
                email: u.email,
                password: 'comware123',
                role: u.role,
                cargoId: cargo!.id,
                activo: true
            }
        });
    }
    console.log('✅ 4 usuarios creados\n')

    // ==========================================
    // 3. CREAR ÁREAS
    // ==========================================
    console.log('🏢 Creando áreas...')

    const areaFinanciera = await prisma.area.create({
        data: {
            id: 'area-financiera',
            nombre: 'Gestión Financiera y Administrativa',
            descripcion: 'Área responsable de la planificación y gestión financiera',
            directorId: 'user-marco',
            activo: true
        }
    });

    const areaTH = await prisma.area.create({
        data: {
            id: 'area-th',
            nombre: 'Gestión de Talento Humano',
            descripcion: 'Área responsable de la gestión del capital humano',
            directorId: 'user-katherine',
            activo: true
        }
    });
    console.log('✅ 2 áreas creadas\n')

    // ==========================================
    // 4. CREAR PROCESOS CON TODA LA INFORMACIÓN
    // ==========================================
    console.log('📋 Creando procesos completos...\n')

    // ==========================================
    // PROCESO 1: PLANIFICACIÓN FINANCIERA
    // ==========================================
    console.log('  💰 Proceso 1: Planificación Financiera')

    const procesoFinanciero = await prisma.proceso.create({
        data: {
            id: 'proc-financiero',
            nombre: 'Planificación Financiera',
            descripcion: 'Proceso de planificación y control presupuestal',
            objetivo: 'Garantizar la sostenibilidad financiera mediante una adecuada planificación y control de recursos',
            tipo: 'Estratégico',
            responsableId: 'user-marco',
            areaId: areaFinanciera.id,
            vicepresidencia: 'Vicepresidencia Financiera',
            gerencia: 'Gerencia de Tesorería y Finanzas',
            estado: 'aprobado',
            activo: true,
            analisis: 'Proceso crítico para la sostenibilidad organizacional. Requiere controles robustos en proyecciones y ejecución presupuestal.',
            documentoNombre: 'Manual_Planificacion_Financiera_v2.pdf'
        }
    });

    // DOFA - Planificación Financiera
    const dofaFinanciero = [
        { tipo: 'FORTALEZA', descripcion: 'Equipo financiero altamente capacitado' },
        { tipo: 'FORTALEZA', descripcion: 'Sistema ERP integrado para control presupuestal' },
        { tipo: 'OPORTUNIDAD', descripcion: 'Nuevas líneas de crédito disponibles en el mercado' },
        { tipo: 'OPORTUNIDAD', descripcion: 'Incentivos fiscales para inversión en tecnología' },
        { tipo: 'DEBILIDAD', descripcion: 'Dependencia de pocos proveedores financieros' },
        { tipo: 'DEBILIDAD', descripcion: 'Procesos manuales en algunas áreas de control' },
        { tipo: 'AMENAZA', descripcion: 'Volatilidad en tasas de cambio' },
        { tipo: 'AMENAZA', descripcion: 'Cambios regulatorios en normativa financiera' },
        // Estrategias
        { tipo: 'FO', descripcion: 'Aprovechar capacitación del equipo para acceder a mejores líneas de crédito' },
        { tipo: 'FA', descripcion: 'Fortalecer sistema ERP para mitigar impacto de cambios regulatorios' },
        { tipo: 'DO', descripcion: 'Automatizar procesos manuales aprovechando incentivos fiscales' },
        { tipo: 'DA', descripcion: 'Diversificar proveedores financieros ante volatilidad del mercado' }
    ];

    for (const item of dofaFinanciero) {
        await prisma.dofaItem.create({
            data: {
                procesoId: procesoFinanciero.id,
                tipo: item.tipo,
                descripcion: item.descripcion
            }
        });
    }

    // NORMATIVIDAD - Planificación Financiera
    const normatividadFinanciero = [
        {
            numero: 1,
            nombre: 'Decreto 2420 de 2015 - Contabilidad Pública',
            estado: 'Existente',
            regulador: 'Contaduría General de la Nación',
            sanciones: 'Multas hasta 200 SMMLV',
            plazoImplementacion: 'N/A',
            cumplimiento: 'Total',
            detalleIncumplimiento: null,
            riesgoIdentificado: 'Bajo',
            clasificacion: 'Positiva',
            comentarios: 'Cumplimiento verificado en última auditoría'
        },
        {
            numero: 2,
            nombre: 'Ley 1314 de 2009 - NIIF',
            estado: 'Requerida',
            regulador: 'Ministerio de Hacienda',
            sanciones: 'Sanciones administrativas y penales',
            plazoImplementacion: '6 meses',
            cumplimiento: 'Parcial',
            detalleIncumplimiento: 'Pendiente actualización de políticas contables',
            riesgoIdentificado: 'Medio',
            clasificacion: 'Negativa',
            comentarios: 'En proceso de actualización'
        }
    ];

    for (const norm of normatividadFinanciero) {
        await prisma.normatividad.create({
            data: {
                procesoId: procesoFinanciero.id,
                ...norm
            }
        });
    }

    // CONTEXTO - Planificación Financiera
    const contextosFinanciero = [
        { tipo: 'INTERNO', descripcion: 'Cultura organizacional orientada al control y la eficiencia' },
        { tipo: 'INTERNO', descripcion: 'Infraestructura tecnológica robusta para análisis financiero' },
        { tipo: 'EXTERNO', descripcion: 'Entorno económico con alta volatilidad cambiaria' },
        { tipo: 'EXTERNO', descripcion: 'Regulación financiera en constante actualización' }
    ];

    for (const ctx of contextosFinanciero) {
        await prisma.contexto.create({
            data: {
                procesoId: procesoFinanciero.id,
                tipo: ctx.tipo,
                descripcion: ctx.descripcion
            }
        });
    }

    // BENCHMARKING - Planificación Financiera
    const benchmarkingFinanciero = [
        { entidad: 'Empresa Líder Sector', indicador: 'ROE (Return on Equity)', valor: '18%', comparacion: 'Mejor' },
        { entidad: 'Promedio Sector', indicador: 'Liquidez Corriente', valor: '1.8', comparacion: 'Igual' },
        { entidad: 'Competidor Principal', indicador: 'Margen EBITDA', valor: '22%', comparacion: 'Peor' }
    ];

    for (const bench of benchmarkingFinanciero) {
        await prisma.benchmarking.create({
            data: {
                procesoId: procesoFinanciero.id,
                ...bench
            }
        });
    }

    // DOCUMENTOS - Planificación Financiera
    // Documentos se gestionan desde el frontend

    // ==========================================
    // RIESGOS - PLANIFICACIÓN FINANCIERA
    // ==========================================
    console.log('    🎯 Creando riesgos para Planificación Financiera...')

    // RIESGO 1: Desviación Presupuestal
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
            causaRiesgo: 'Proyecciones inexactas y falta de seguimiento',
            fuenteCausa: 'Interna',
            origen: 'Interno',
            vicepresidenciaGerenciaAlta: 'Vicepresidencia Financiera',
            siglaVicepresidencia: 'VF',
            gerencia: 'Gerencia Financiera',
            siglaGerencia: 'GF'
        }
    });

    // Evaluación Riesgo 1
    await prisma.evaluacionRiesgo.create({
        data: {
            riesgoId: riesgo1.id,
            probabilidad: 3, // Posible
            impactoPersonas: 1,
            impactoLegal: 2,
            impactoAmbiental: 1,
            impactoProcesos: 4,
            impactoReputacion: 3,
            impactoEconomico: 5, // Muy grave
            impactoTecnologico: 2,
            impactoGlobal: 5,
            impactoMaximo: 5,
            riesgoInherente: 15, // 3 x 5
            nivelRiesgo: 'Alto',
            // Residual (40% mitigación)
            probabilidadResidual: 2, // 3 - 1.2 ≈ 2
            impactoResidual: 3, // 5 - 2 = 3
            riesgoResidual: 6,
            nivelRiesgoResidual: 'Medio',
            evaluadoPor: 'Marco Alvarado'
        }
    });

    // Causas Riesgo 1
    const causa1_1 = await prisma.causaRiesgo.create({
        data: {
            riesgoId: riesgo1.id,
            descripcion: 'Proyecciones basadas en datos históricos desactualizados',
            fuenteCausa: 'Interna',
            frecuencia: 'Probable',
            seleccionada: true
        }
    });

    const causa1_2 = await prisma.causaRiesgo.create({
        data: {
            riesgoId: riesgo1.id,
            descripcion: 'Falta de seguimiento mensual al presupuesto',
            fuenteCausa: 'Interna',
            frecuencia: 'Posible',
            seleccionada: false
        }
    });

    // Control para Causa 1.1
    await prisma.controlRiesgo.create({
        data: {
            causaRiesgoId: causa1_1.id,
            descripcion: 'Sistema automatizado de seguimiento presupuestal con alertas',
            tipoControl: 'AUTOMATICO',
            responsable: 'Director Financiero',
            puntajeControl: 85,
            evaluacionPreliminar: 'Efectivo',
            evaluacionDefinitiva: 'Efectivo',
            estandarizacionPorcentajeMitigacion: 40,
            disminuyeFrecuenciaImpactoAmbas: 'AMBAS',
            aplicabilidad: 10,
            cobertura: 9,
            facilidadUso: 8,
            segregacion: 9,
            naturaleza: 10,
            desviaciones: 9
        }
    });

    // Priorización Riesgo 1
    const priorizacion1 = await prisma.priorizacionRiesgo.create({
        data: {
            riesgoId: riesgo1.id,
            calificacionFinal: 15,
            respuesta: 'Mitigar',
            responsable: 'Marco Alvarado',
            puntajePriorizacion: 85
        }
    });

    // Plan de Acción Riesgo 1
    await prisma.planAccion.create({
        data: {
            priorizacionId: priorizacion1.id,
            descripcion: 'Implementar dashboard de seguimiento presupuestal en tiempo real',
            responsable: 'Marco Alvarado',
            fechaInicio: new Date('2024-02-01'),
            fechaFin: new Date('2024-04-30'),
            estado: 'En Progreso'
        }
    });

    // Evento Materializado Riesgo 1
    await prisma.eventoMaterializado.create({
        data: {
            riesgoId: riesgo1.id,
            descripcion: 'Sobrecosto del 12% en proyecto de infraestructura',
            fecha: new Date('2023-11-15'),
            impactoEconomico: 45000000,
            planAccion: 'Ajuste presupuestal y reasignación de recursos'
        }
    });

    // RIESGO 2: Liquidez Insuficiente
    const riesgo2 = await prisma.riesgo.create({
        data: {
            procesoId: procesoFinanciero.id,
            numero: 2,
            numeroIdentificacion: '2GF',
            descripcion: 'Insuficiencia de liquidez para cumplir obligaciones de corto plazo',
            clasificacion: 'Negativa',
            zona: 'Financiera',
            tipologiaNivelI: 'Financiero',
            tipologiaNivelII: 'Tesorería',
            causaRiesgo: 'Desbalance entre ingresos y egresos',
            fuenteCausa: 'Interna',
            origen: 'Interno',
            vicepresidenciaGerenciaAlta: 'Vicepresidencia Financiera',
            siglaVicepresidencia: 'VF',
            gerencia: 'Gerencia Financiera',
            siglaGerencia: 'GF'
        }
    });

    await prisma.evaluacionRiesgo.create({
        data: {
            riesgoId: riesgo2.id,
            probabilidad: 2,
            impactoPersonas: 1,
            impactoLegal: 3,
            impactoAmbiental: 1,
            impactoProcesos: 4,
            impactoReputacion: 4,
            impactoEconomico: 4,
            impactoTecnologico: 1,
            impactoGlobal: 4,
            impactoMaximo: 4,
            riesgoInherente: 8,
            nivelRiesgo: 'Medio',
            probabilidadResidual: 1,
            impactoResidual: 2,
            riesgoResidual: 2,
            nivelRiesgoResidual: 'Bajo',
            evaluadoPor: 'Marco Alvarado'
        }
    });

    const causa2_1 = await prisma.causaRiesgo.create({
        data: {
            riesgoId: riesgo2.id,
            descripcion: 'Retrasos en cobro de cartera',
            fuenteCausa: 'Externa',
            frecuencia: 'Posible',
            seleccionada: true
        }
    });

    await prisma.controlRiesgo.create({
        data: {
            causaRiesgoId: causa2_1.id,
            descripcion: 'Política de cobro anticipado con descuentos',
            tipoControl: 'PREVENTIVO',
            responsable: 'Jefe de Tesorería',
            puntajeControl: 75,
            evaluacionPreliminar: 'Efectivo',
            evaluacionDefinitiva: 'Efectivo',
            estandarizacionPorcentajeMitigacion: 40,
            disminuyeFrecuenciaImpactoAmbas: 'FRECUENCIA',
            aplicabilidad: 9,
            cobertura: 8,
            facilidadUso: 9,
            segregacion: 7,
            naturaleza: 8,
            desviaciones: 8
        }
    });

    console.log('    ✅ 2 riesgos creados para Planificación Financiera')

    // ==========================================
    // PROCESO 2: GESTIÓN DE TALENTO HUMANO
    // ==========================================
    console.log('\n  👥 Proceso 2: Gestión de Talento Humano')

    const procesoTH = await prisma.proceso.create({
        data: {
            id: 'proc-th',
            nombre: 'Gestión de Talento Humano',
            descripcion: 'Proceso de selección, desarrollo y retención del talento',
            objetivo: 'Atraer, desarrollar y retener el mejor talento para garantizar el cumplimiento de objetivos organizacionales',
            tipo: 'Apoyo',
            responsableId: 'user-katherine',
            areaId: areaTH.id,
            vicepresidencia: 'Vicepresidencia Administrativa',
            gerencia: 'Gerencia de Talento Humano',
            estado: 'aprobado',
            activo: true,
            analisis: 'Proceso fundamental para el desarrollo organizacional. Requiere enfoque en clima laboral y desarrollo de competencias.',
            documentoNombre: 'Manual_Gestion_TH_v3.pdf'
        }
    });

    // DOFA - Talento Humano
    const dofaTH = [
        { tipo: 'FORTALEZA', descripcion: 'Programa de capacitación estructurado' },
        { tipo: 'FORTALEZA', descripcion: 'Buen clima organizacional' },
        { tipo: 'OPORTUNIDAD', descripcion: 'Alianzas con universidades para prácticas' },
        { tipo: 'OPORTUNIDAD', descripcion: 'Tendencia de trabajo remoto atrae talento' },
        { tipo: 'DEBILIDAD', descripcion: 'Alta rotación en cargos operativos' },
        { tipo: 'DEBILIDAD', descripcion: 'Procesos de selección largos' },
        { tipo: 'AMENAZA', descripcion: 'Competencia por talento calificado' },
        { tipo: 'AMENAZA', descripcion: 'Cambios en legislación laboral' },
        { tipo: 'FO', descripcion: 'Fortalecer programa de prácticas universitarias' },
        { tipo: 'FA', descripcion: 'Mejorar propuesta de valor al empleado ante competencia' },
        { tipo: 'DO', descripcion: 'Implementar trabajo remoto para reducir rotación' },
        { tipo: 'DA', descripcion: 'Agilizar procesos de selección ante cambios legales' }
    ];

    for (const item of dofaTH) {
        await prisma.dofaItem.create({
            data: {
                procesoId: procesoTH.id,
                tipo: item.tipo,
                descripcion: item.descripcion
            }
        });
    }

    // NORMATIVIDAD - Talento Humano
    const normatividadTH = [
        {
            numero: 1,
            nombre: 'Código Sustantivo del Trabajo',
            estado: 'Existente',
            regulador: 'Ministerio del Trabajo',
            sanciones: 'Multas hasta 5000 SMMLV',
            plazoImplementacion: 'N/A',
            cumplimiento: 'Total',
            detalleIncumplimiento: null,
            riesgoIdentificado: 'Bajo',
            clasificacion: 'Positiva',
            comentarios: 'Cumplimiento verificado'
        },
        {
            numero: 2,
            nombre: 'Ley 1010 de 2006 - Acoso Laboral',
            estado: 'Requerida',
            regulador: 'Ministerio del Trabajo',
            sanciones: 'Sanciones penales y administrativas',
            plazoImplementacion: '3 meses',
            cumplimiento: 'Parcial',
            detalleIncumplimiento: 'Pendiente actualización de protocolo',
            riesgoIdentificado: 'Medio',
            clasificacion: 'Negativa',
            comentarios: 'En proceso de actualización'
        }
    ];

    for (const norm of normatividadTH) {
        await prisma.normatividad.create({
            data: {
                procesoId: procesoTH.id,
                ...norm
            }
        });
    }

    // CONTEXTO - Talento Humano
    const contextosTH = [
        { tipo: 'INTERNO', descripcion: 'Cultura de aprendizaje continuo' },
        { tipo: 'INTERNO', descripcion: 'Liderazgo comprometido con desarrollo del talento' },
        { tipo: 'EXTERNO', descripcion: 'Escasez de talento especializado en el mercado' },
        { tipo: 'EXTERNO', descripcion: 'Nuevas expectativas laborales de generaciones jóvenes' }
    ];

    for (const ctx of contextosTH) {
        await prisma.contexto.create({
            data: {
                procesoId: procesoTH.id,
                tipo: ctx.tipo,
                descripcion: ctx.descripcion
            }
        });
    }

    // BENCHMARKING - Talento Humano
    const benchmarkingTH = [
        { entidad: 'Empresa Líder Sector', indicador: 'Índice de Rotación', valor: '8%', comparacion: 'Mejor' },
        { entidad: 'Promedio Sector', indicador: 'Satisfacción Laboral', valor: '85%', comparacion: 'Igual' },
        { entidad: 'Competidor Principal', indicador: 'Tiempo de Contratación', valor: '45 días', comparacion: 'Peor' }
    ];

    for (const bench of benchmarkingTH) {
        await prisma.benchmarking.create({
            data: {
                procesoId: procesoTH.id,
                ...bench
            }
        });
    }

    // DOCUMENTOS - Talento Humano
    // Documentos se gestionan desde el frontend

    // ==========================================
    // RIESGOS - TALENTO HUMANO
    // ==========================================
    console.log('    🎯 Creando riesgos para Talento Humano...')

    // RIESGO 1: Alta Rotación de Personal
    const riesgo3 = await prisma.riesgo.create({
        data: {
            procesoId: procesoTH.id,
            numero: 1,
            numeroIdentificacion: '1GTH',
            descripcion: 'Alta rotación de personal clave afectando continuidad operativa',
            clasificacion: 'Negativa',
            zona: 'Talento Humano',
            tipologiaNivelI: 'Operacional',
            tipologiaNivelII: 'Recursos Humanos',
            causaRiesgo: 'Insatisfacción laboral y mejores ofertas externas',
            fuenteCausa: 'Interna',
            origen: 'Interno',
            vicepresidenciaGerenciaAlta: 'Vicepresidencia Administrativa',
            siglaVicepresidencia: 'VA',
            gerencia: 'Gerencia Talento Humano',
            siglaGerencia: 'GTH'
        }
    });

    await prisma.evaluacionRiesgo.create({
        data: {
            riesgoId: riesgo3.id,
            probabilidad: 3,
            impactoPersonas: 4,
            impactoLegal: 2,
            impactoAmbiental: 1,
            impactoProcesos: 4,
            impactoReputacion: 3,
            impactoEconomico: 3,
            impactoTecnologico: 2,
            impactoGlobal: 4,
            impactoMaximo: 4,
            riesgoInherente: 12,
            nivelRiesgo: 'Alto',
            probabilidadResidual: 2,
            impactoResidual: 2,
            riesgoResidual: 4,
            nivelRiesgoResidual: 'Bajo',
            evaluadoPor: 'Katherine Chavez'
        }
    });

    const causa3_1 = await prisma.causaRiesgo.create({
        data: {
            riesgoId: riesgo3.id,
            descripcion: 'Salarios no competitivos frente al mercado',
            fuenteCausa: 'Interna',
            frecuencia: 'Probable',
            seleccionada: true
        }
    });

    const causa3_2 = await prisma.causaRiesgo.create({
        data: {
            riesgoId: riesgo3.id,
            descripcion: 'Falta de plan de carrera claro',
            fuenteCausa: 'Interna',
            frecuencia: 'Posible',
            seleccionada: false
        }
    });

    await prisma.controlRiesgo.create({
        data: {
            causaRiesgoId: causa3_1.id,
            descripcion: 'Estudio anual de compensación y ajuste salarial',
            tipoControl: 'PREVENTIVO',
            responsable: 'Gerente TH',
            puntajeControl: 80,
            evaluacionPreliminar: 'Efectivo',
            evaluacionDefinitiva: 'Efectivo',
            estandarizacionPorcentajeMitigacion: 40,
            disminuyeFrecuenciaImpactoAmbas: 'AMBAS',
            aplicabilidad: 9,
            cobertura: 8,
            facilidadUso: 9,
            segregacion: 8,
            naturaleza: 9,
            desviaciones: 8
        }
    });

    const priorizacion3 = await prisma.priorizacionRiesgo.create({
        data: {
            riesgoId: riesgo3.id,
            calificacionFinal: 12,
            respuesta: 'Mitigar',
            responsable: 'Katherine Chavez',
            puntajePriorizacion: 80
        }
    });

    await prisma.planAccion.create({
        data: {
            priorizacionId: priorizacion3.id,
            descripcion: 'Implementar programa de retención y desarrollo de talento',
            responsable: 'Katherine Chavez',
            fechaInicio: new Date('2024-02-01'),
            fechaFin: new Date('2024-06-30'),
            estado: 'En Progreso'
        }
    });

    await prisma.eventoMaterializado.create({
        data: {
            riesgoId: riesgo3.id,
            descripcion: 'Renuncia de 3 analistas senior en el mismo mes',
            fecha: new Date('2023-10-20'),
            impactoEconomico: 18000000,
            planAccion: 'Contratación urgente y redistribución de cargas'
        }
    });

    // RIESGO 2: Incumplimiento Normativo Laboral
    const riesgo4 = await prisma.riesgo.create({
        data: {
            procesoId: procesoTH.id,
            numero: 2,
            numeroIdentificacion: '2GTH',
            descripcion: 'Incumplimiento de normativa laboral vigente',
            clasificacion: 'Negativa',
            zona: 'Legal',
            tipologiaNivelI: 'Cumplimiento',
            tipologiaNivelII: 'Legal',
            causaRiesgo: 'Desactualización en cambios normativos',
            fuenteCausa: 'Externa',
            origen: 'Externo',
            vicepresidenciaGerenciaAlta: 'Vicepresidencia Administrativa',
            siglaVicepresidencia: 'VA',
            gerencia: 'Gerencia Talento Humano',
            siglaGerencia: 'GTH'
        }
    });

    await prisma.evaluacionRiesgo.create({
        data: {
            riesgoId: riesgo4.id,
            probabilidad: 2,
            impactoPersonas: 2,
            impactoLegal: 5,
            impactoAmbiental: 1,
            impactoProcesos: 3,
            impactoReputacion: 4,
            impactoEconomico: 4,
            impactoTecnologico: 1,
            impactoGlobal: 5,
            impactoMaximo: 5,
            riesgoInherente: 10,
            nivelRiesgo: 'Alto',
            probabilidadResidual: 1,
            impactoResidual: 3,
            riesgoResidual: 3,
            nivelRiesgoResidual: 'Bajo',
            evaluadoPor: 'Katherine Chavez'
        }
    });

    const causa4_1 = await prisma.causaRiesgo.create({
        data: {
            riesgoId: riesgo4.id,
            descripcion: 'Falta de seguimiento a cambios normativos',
            fuenteCausa: 'Interna',
            frecuencia: 'Posible',
            seleccionada: true
        }
    });

    await prisma.controlRiesgo.create({
        data: {
            causaRiesgoId: causa4_1.id,
            descripcion: 'Suscripción a boletín legal y revisión trimestral',
            tipoControl: 'PREVENTIVO',
            responsable: 'Asesor Legal',
            puntajeControl: 85,
            evaluacionPreliminar: 'Efectivo',
            evaluacionDefinitiva: 'Efectivo',
            estandarizacionPorcentajeMitigacion: 40,
            disminuyeFrecuenciaImpactoAmbas: 'FRECUENCIA',
            aplicabilidad: 10,
            cobertura: 9,
            facilidadUso: 8,
            segregacion: 9,
            naturaleza: 10,
            desviaciones: 9
        }
    });

    console.log('    ✅ 2 riesgos creados para Talento Humano')

    // ==========================================
    // 5. ASIGNAR PROCESOS A TODOS LOS USUARIOS
    // ==========================================
    console.log('\n🔗 Asignando procesos a usuarios...')

    // Conectar ambos procesos a los 4 usuarios
    await prisma.proceso.update({
        where: { id: procesoFinanciero.id },
        data: {
            participantes: {
                connect: [
                    { id: 'user-admin' },
                    { id: 'user-gerente' },
                    { id: 'user-marco' },
                    { id: 'user-katherine' }
                ]
            }
        }
    });

    await prisma.proceso.update({
        where: { id: procesoTH.id },
        data: {
            participantes: {
                connect: [
                    { id: 'user-admin' },
                    { id: 'user-gerente' },
                    { id: 'user-marco' },
                    { id: 'user-katherine' }
                ]
            }
        }
    });

    console.log('✅ Ambos procesos asignados a los 4 usuarios\n')

    // ==========================================
    // RESUMEN FINAL
    // ==========================================
    console.log('\n' + '='.repeat(50))
    console.log('✅ SEED COMPLETADO EXITOSAMENTE')
    console.log('='.repeat(50))
    console.log('\n📊 RESUMEN:')
    console.log('  👥 Usuarios: 4')
    console.log('  🏢 Áreas: 2')
    console.log('  📋 Procesos: 2')
    console.log('  🎯 Riesgos: 4 (2 por proceso)')
    console.log('  📄 Documentos: 2')
    console.log('  🔍 DOFA: 24 items')
    console.log('  📜 Normatividad: 4 items')
    console.log('  🌍 Contextos: 8 items')
    console.log('  📊 Benchmarking: 6 items')
    console.log('  ⚠️  Causas: 6')
    console.log('  🛡️  Controles: 5')
    console.log('  📝 Planes de Acción: 2')
    console.log('  💥 Eventos Materializados: 2')
    console.log('\n🔐 Credenciales:')
    console.log('  Email: admin@comware.com.co | Password: comware123')
    console.log('  Email: gerente@comware.com.co | Password: comware123')
    console.log('  Email: marco@comware.com.co | Password: comware123')
    console.log('  Email: katherine@comware.com.co | Password: comware123')
    console.log('\n' + '='.repeat(50) + '\n')
}

main()
    .catch((e) => {
        console.error('❌ Error en seed:', e)
        process.exit(1)
    })
    .finally(async () => {
        await prisma.$disconnect()
    })
