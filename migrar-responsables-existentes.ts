/**
 * Script para migrar responsables existentes
 * 
 * Crea registros en ProcesoResponsable para todos los procesos
 * que tienen responsableId pero no tienen el registro correspondiente
 * 
 * Ejecutar: npx ts-node migrar-responsables-existentes.ts
 */

import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function migrarResponsables() {
  console.log('========================================');
  console.log('MIGRACIÓN: Responsables Existentes');
  console.log('========================================\n');

  try {
    // 1. Encontrar procesos con responsableId pero sin registro en ProcesoResponsable
    console.log('1. Buscando procesos con responsableId...');
    
    const procesosConResponsable = await prisma.proceso.findMany({
      where: {
        responsableId: { not: null }
      },
      select: {
        id: true,
        nombre: true,
        responsableId: true,
        responsable: {
          select: {
            nombre: true
          }
        },
        responsables: {
          where: {
            modo: 'proceso'
          },
          select: {
            id: true,
            usuarioId: true
          }
        }
      }
    });

    console.log(`   Encontrados: ${procesosConResponsable.length} procesos con responsableId\n`);

    // 2. Filtrar los que NO tienen registro en ProcesoResponsable con modo="proceso"
    const procesosSinRegistro = procesosConResponsable.filter(p => {
      const tieneRegistro = p.responsables.some(r => r.usuarioId === p.responsableId);
      return !tieneRegistro;
    });

    console.log(`   Sin registro en ProcesoResponsable: ${procesosSinRegistro.length}\n`);

    if (procesosSinRegistro.length === 0) {
      console.log('✅ Todos los procesos ya tienen sus responsables sincronizados.\n');
      return;
    }

    // 3. Mostrar algunos ejemplos
    console.log('2. Ejemplos de procesos a migrar:');
    procesosSinRegistro.slice(0, 5).forEach(p => {
      console.log(`   - Proceso ${p.id}: "${p.nombre}"`);
      console.log(`     Responsable: ${p.responsable?.nombre} (ID: ${p.responsableId})`);
    });
    console.log('');

    // 4. Crear registros en ProcesoResponsable
    console.log('3. Creando registros en ProcesoResponsable...\n');

    let creados = 0;
    let errores = 0;

    for (const proceso of procesosSinRegistro) {
      try {
        await prisma.procesoResponsable.create({
          data: {
            procesoId: proceso.id,
            usuarioId: proceso.responsableId!,
            modo: 'proceso'
          }
        });
        creados++;
        console.log(`   ✅ Proceso ${proceso.id}: ${proceso.nombre}`);
      } catch (error: any) {
        errores++;
        console.error(`   ❌ Error en proceso ${proceso.id}:`, error.message);
      }
    }

    console.log('');
    console.log('========================================');
    console.log('RESUMEN DE MIGRACIÓN');
    console.log('========================================');
    console.log(`Total de procesos con responsableId: ${procesosConResponsable.length}`);
    console.log(`Procesos sin registro: ${procesosSinRegistro.length}`);
    console.log(`Registros creados: ${creados}`);
    console.log(`Errores: ${errores}`);
    console.log('');

    if (creados > 0) {
      console.log('✅ MIGRACIÓN COMPLETADA EXITOSAMENTE\n');
      console.log('Próximos pasos:');
      console.log('   1. Reiniciar el backend para limpiar caché');
      console.log('   2. Refrescar el frontend');
      console.log('   3. Verificar que los responsables se muestren correctamente\n');
    }

    // 5. Verificación final
    console.log('4. Verificación final...');
    const procesosAhora = await prisma.proceso.findMany({
      where: {
        responsableId: { not: null }
      },
      select: {
        id: true,
        responsableId: true,
        responsables: {
          where: {
            modo: 'proceso'
          },
          select: {
            usuarioId: true
          }
        }
      }
    });

    const sinSincronizar = procesosAhora.filter(p => {
      const tieneRegistro = p.responsables.some(r => r.usuarioId === p.responsableId);
      return !tieneRegistro;
    });

    console.log(`   Procesos aún sin sincronizar: ${sinSincronizar.length}\n`);

    if (sinSincronizar.length > 0) {
      console.log('⚠️  Algunos procesos no se sincronizaron. Revisar manualmente:');
      sinSincronizar.forEach(p => {
        console.log(`   - Proceso ID: ${p.id}, ResponsableId: ${p.responsableId}`);
      });
      console.log('');
    }

  } catch (error: any) {
    console.error('❌ Error durante la migración:', error.message);
    console.error('Detalles:', error);
  } finally {
    await prisma.$disconnect();
  }
}

migrarResponsables();
