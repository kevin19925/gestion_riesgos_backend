/**
 * Seed para Configuración Residual
 * 
 * Este script inserta la configuración inicial con los valores actuales hardcodeados.
 * Se ejecuta manualmente cuando estés listo.
 * 
 * Uso: npx ts-node prisma/seed-configuracion-residual.ts
 */

import prisma from '../src/prisma';

async function seedConfiguracionResidual() {
  console.log('🌱 Iniciando seed de Configuración Residual...');

  try {
    // Verificar si ya existe una configuración
    const existente = await prisma.configuracionResidual.findFirst();
    
    if (existente) {
      console.log('⚠️  Ya existe una configuración residual. Saltando seed.');
      console.log('   Si deseas recrearla, elimínala primero desde la BD.');
      return;
    }
    
    if (existente) {
      console.log('⚠️  Ya existe una configuración residual. Saltando seed.');
      console.log('   Si deseas recrearla, elimínala primero desde la BD.');
      return;
    }

    // Crear configuración con todos los datos iniciales
    const config = await prisma.configuracionResidual.create({
      data: {
        nombre: 'Configuración Principal',
        activa: true,
        descripcion: 'Configuración inicial con valores por defecto del sistema',
        
        // Pesos de Criterios
        pesosCriterios: {
          create: [
            { criterio: 'aplicabilidad', peso: 0.25, orden: 1, activo: true },
            { criterio: 'cobertura', peso: 0.25, orden: 2, activo: true },
            { criterio: 'facilidad', peso: 0.10, orden: 3, activo: true },
            { criterio: 'segregacion', peso: 0.20, orden: 4, activo: true },
            { criterio: 'naturaleza', peso: 0.20, orden: 5, activo: true },
          ]
        },

        // Rangos de Evaluación Preliminar
        rangosEvaluacion: {
          create: [
            { 
              nivelNombre: 'Inefectivo', 
              valorMinimo: 0, 
              valorMaximo: 24.99, 
              incluirMinimo: true, 
              incluirMaximo: true, 
              orden: 1, 
              activo: true 
            },
            { 
              nivelNombre: 'Baja Efectividad', 
              valorMinimo: 25, 
              valorMaximo: 45.99, 
              incluirMinimo: true, 
              incluirMaximo: true, 
              orden: 2, 
              activo: true 
            },
            { 
              nivelNombre: 'Medianamente Efectivo', 
              valorMinimo: 46, 
              valorMaximo: 64.99, 
              incluirMinimo: true, 
              incluirMaximo: true, 
              orden: 3, 
              activo: true 
            },
            { 
              nivelNombre: 'Efectivo', 
              valorMinimo: 65, 
              valorMaximo: 84.99, 
              incluirMinimo: true, 
              incluirMaximo: true, 
              orden: 4, 
              activo: true 
            },
            { 
              nivelNombre: 'Altamente Efectivo', 
              valorMinimo: 85, 
              valorMaximo: 100, 
              incluirMinimo: true, 
              incluirMaximo: true, 
              orden: 5, 
              activo: true 
            },
          ]
        },

        // Tabla de Mitigación
        tablaMitigacion: {
          create: [
            { evaluacion: 'Altamente Efectivo', porcentaje: 0.81, orden: 1, activo: true },
            { evaluacion: 'Efectivo', porcentaje: 0.61, orden: 2, activo: true },
            { evaluacion: 'Medianamente Efectivo', porcentaje: 0.33, orden: 3, activo: true },
            { evaluacion: 'Baja Efectividad', porcentaje: 0.20, orden: 4, activo: true },
            { evaluacion: 'Inefectivo', porcentaje: 0.0, orden: 5, activo: true },
          ]
        },

        // Rangos de Nivel de Riesgo Residual
        rangosNivelRiesgo: {
          create: [
            { 
              nivelNombre: 'Crítico', 
              valorMinimo: 15, 
              valorMaximo: 25, 
              incluirMinimo: true, 
              incluirMaximo: true, 
              orden: 1, 
              activo: true 
            },
            { 
              nivelNombre: 'Alto', 
              valorMinimo: 10, 
              valorMaximo: 14, 
              incluirMinimo: true, 
              incluirMaximo: true, 
              orden: 2, 
              activo: true 
            },
            { 
              nivelNombre: 'Medio', 
              valorMinimo: 5, 
              valorMaximo: 9, 
              incluirMinimo: true, 
              incluirMaximo: true, 
              orden: 3, 
              activo: true 
            },
            { 
              nivelNombre: 'Bajo', 
              valorMinimo: 1, 
              valorMaximo: 4, 
              incluirMinimo: true, 
              incluirMaximo: true, 
              orden: 4, 
              activo: true 
            },
          ]
        },

        // Opciones de Criterios
        opcionesCriterios: {
          create: [
            // Aplicabilidad
            { 
              criterio: 'aplicabilidad', 
              label: 'Cuenta con procedimientos documentados y se ejecuta según lo establecido', 
              valor: 100, 
              orden: 1, 
              activo: true 
            },
            { 
              criterio: 'aplicabilidad', 
              label: 'Cuenta con procedimientos documentados pero no se ejecuta según lo establecido', 
              valor: 70, 
              orden: 2, 
              activo: true 
            },
            { 
              criterio: 'aplicabilidad', 
              label: 'Cuenta con procedimientos no documentados y se ejecuta', 
              valor: 40, 
              orden: 3, 
              activo: true 
            },
            { 
              criterio: 'aplicabilidad', 
              label: 'No cuenta con procedimientos y no se ejecuta', 
              valor: 0, 
              orden: 4, 
              activo: true 
            },

            // Cobertura
            { 
              criterio: 'cobertura', 
              label: 'La frecuencia del control tiene una periodicidad definida y se ejecuta', 
              valor: 70, 
              orden: 1, 
              activo: true 
            },
            { 
              criterio: 'cobertura', 
              label: 'La frecuencia del control no tiene una periodicidad definida pero se ejecuta', 
              valor: 40, 
              orden: 2, 
              activo: true 
            },
            { 
              criterio: 'cobertura', 
              label: 'El control no se ejecuta', 
              valor: 0, 
              orden: 3, 
              activo: true 
            },

            // Facilidad de Uso
            { 
              criterio: 'facilidad', 
              label: 'El control es muy sencillo de ejecutar', 
              valor: 30, 
              orden: 1, 
              activo: true 
            },
            { 
              criterio: 'facilidad', 
              label: 'El control es sencillo de ejecutar', 
              valor: 20, 
              orden: 2, 
              activo: true 
            },
            { 
              criterio: 'facilidad', 
              label: 'El control es complejo de ejecutar', 
              valor: 10, 
              orden: 3, 
              activo: true 
            },
            { 
              criterio: 'facilidad', 
              label: 'El control es muy complejo de ejecutar', 
              valor: 0, 
              orden: 4, 
              activo: true 
            },

            // Segregación
            { 
              criterio: 'segregacion', 
              label: 'No (0)', 
              valor: 0, 
              orden: 1, 
              activo: true 
            },
            { 
              criterio: 'segregacion', 
              label: 'Sí (20)', 
              valor: 20, 
              orden: 2, 
              activo: true 
            },

            // Naturaleza
            { 
              criterio: 'naturaleza', 
              label: 'Automático (20)', 
              valor: 20, 
              orden: 1, 
              activo: true 
            },
            { 
              criterio: 'naturaleza', 
              label: 'Manual (10)', 
              valor: 10, 
              orden: 2, 
              activo: true 
            },
            { 
              criterio: 'naturaleza', 
              label: 'Mixto (15)', 
              valor: 15, 
              orden: 3, 
              activo: true 
            },
          ]
        }
      },
      include: {
        pesosCriterios: true,
        rangosEvaluacion: true,
        tablaMitigacion: true,
        rangosNivelRiesgo: true,
        opcionesCriterios: true,
      }
    });

    console.log('✅ Configuración Residual creada exitosamente!');
    console.log(`   ID: ${config.id}`);
    console.log(`   Pesos: ${config.pesosCriterios.length}`);
    console.log(`   Rangos Evaluación: ${config.rangosEvaluacion.length}`);
    console.log(`   Tabla Mitigación: ${config.tablaMitigacion.length}`);
    console.log(`   Rangos Nivel Riesgo: ${config.rangosNivelRiesgo.length}`);
    console.log(`   Opciones: ${config.opcionesCriterios.length}`);

  } catch (error) {
    console.error('❌ Error al crear configuración:', error);
    throw error;
  }
}

async function main() {
  try {
    await seedConfiguracionResidual();
  } catch (error) {
    console.error('Error en seed:', error);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

main();
