/**
 * Script para diagnosticar el problema de responsables vacíos
 * 
 * Ejecutar: npx ts-node diagnosticar-responsables.ts
 */

import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function diagnosticar() {
  console.log('========================================');
  console.log('DIAGNÓSTICO: Responsables de Procesos');
  console.log('========================================\n');

  try {
    // 1. Verificar si existen registros en ProcesoResponsable
    console.log('1. Contando registros en ProcesoResponsable...');
    const totalResponsables = await prisma.procesoResponsable.count();
    console.log(`   Total de registros: ${totalResponsables}\n`);

    if (totalResponsables === 0) {
      console.log('❌ NO HAY RESPONSABLES ASIGNADOS EN LA BASE DE DATOS\n');
      console.log('Solución: Asignar responsables desde el frontend\n');
      return;
    }

    // 2. Verificar registros con modo NULL
    console.log('2. Verificando registros con modo NULL...');
    const responsablesSinModo = await prisma.procesoResponsable.findMany({
      where: { modo: null as any },
      select: {
        id: true,
        procesoId: true,
        usuarioId: true,
        modo: true
      }
    });
    console.log(`   Registros con modo NULL: ${responsablesSinModo.length}`);
    if (responsablesSinModo.length > 0) {
      console.log('   Primeros 5:', responsablesSinModo.slice(0, 5));
    }
    console.log('');

    // 3. Verificar distribución de modos
    console.log('3. Distribución de modos...');
    const responsables = await prisma.procesoResponsable.findMany({
      select: { modo: true }
    });
    const modos = responsables.reduce((acc: any, r) => {
      const modo = r.modo || 'NULL';
      acc[modo] = (acc[modo] || 0) + 1;
      return acc;
    }, {});
    console.log('   Distribución:', modos);
    console.log('');

    // 4. Verificar un proceso específico
    console.log('4. Verificando proceso ID 11 (del error)...');
    const proceso11 = await prisma.proceso.findUnique({
      where: { id: 11 },
      select: {
        id: true,
        nombre: true,
        responsableId: true,
        responsable: {
          select: {
            id: true,
            nombre: true,
            email: true
          }
        },
        responsables: {
          select: {
            id: true,
            modo: true,
            usuario: {
              select: {
                id: true,
                nombre: true,
                email: true
              }
            }
          }
        }
      }
    });

    if (!proceso11) {
      console.log('   ❌ Proceso 11 no encontrado\n');
    } else {
      console.log('   ✅ Proceso encontrado:', proceso11.nombre);
      console.log('   Responsable principal (responsableId):', proceso11.responsable?.nombre || 'NULL');
      console.log('   Responsables múltiples:', proceso11.responsables.length);
      if (proceso11.responsables.length > 0) {
        proceso11.responsables.forEach((r: any) => {
          console.log(`     - ${r.usuario.nombre} (modo: ${r.modo || 'NULL'})`);
        });
      }
      console.log('');
    }

    // 5. Verificar todos los procesos
    console.log('5. Verificando todos los procesos...');
    const procesos = await prisma.proceso.findMany({
      select: {
        id: true,
        nombre: true,
        responsables: {
          select: {
            modo: true,
            usuario: {
              select: {
                nombre: true
              }
            }
          }
        }
      },
      take: 10
    });

    console.log(`   Primeros 10 procesos:`);
    procesos.forEach(p => {
      console.log(`   - ${p.nombre} (ID: ${p.id}): ${p.responsables.length} responsables`);
      if (p.responsables.length > 0) {
        p.responsables.forEach((r: any) => {
          console.log(`       * ${r.usuario.nombre} (modo: ${r.modo || 'NULL'})`);
        });
      }
    });
    console.log('');

    // 6. Resumen
    console.log('========================================');
    console.log('RESUMEN');
    console.log('========================================');
    console.log(`Total de responsables: ${totalResponsables}`);
    console.log(`Responsables sin modo: ${responsablesSinModo.length}`);
    console.log('');

    if (responsablesSinModo.length > 0) {
      console.log('⚠️  PROBLEMA ENCONTRADO:');
      console.log('   Hay responsables sin el campo "modo" asignado');
      console.log('');
      console.log('SOLUCIÓN:');
      console.log('   Ejecutar: npx ts-node fix-responsables-modo.ts');
    } else {
      console.log('✅ Todos los responsables tienen modo asignado');
      console.log('');
      console.log('Si el frontend no los muestra, el problema puede ser:');
      console.log('   1. Caché de Redis (invalidar caché)');
      console.log('   2. Problema en el frontend al leer responsablesList');
      console.log('   3. El backend no está desplegado con el código actualizado');
    }

  } catch (error: any) {
    console.error('❌ Error durante el diagnóstico:', error.message);
    console.error('Detalles:', error);
  } finally {
    await prisma.$disconnect();
  }
}

diagnosticar();
