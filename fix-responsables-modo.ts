/**
 * Script para arreglar responsables sin campo "modo"
 * 
 * Este script asigna modo="proceso" a todos los responsables que tengan modo NULL
 * 
 * Ejecutar: npx ts-node fix-responsables-modo.ts
 */

import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function fixResponsables() {
  console.log('========================================');
  console.log('ARREGLANDO: Responsables sin modo');
  console.log('========================================\n');

  try {
    // 1. Contar responsables sin modo
    console.log('1. Buscando responsables sin modo...');
    const responsablesSinModo = await prisma.$queryRaw<any[]>`
      SELECT id, "procesoId", "usuarioId", modo
      FROM "ProcesoResponsable"
      WHERE modo IS NULL
    `;
    
    console.log(`   Encontrados: ${responsablesSinModo.length} responsables sin modo\n`);

    if (responsablesSinModo.length === 0) {
      console.log('✅ No hay responsables sin modo. Todo está correcto.\n');
      return;
    }

    // 2. Mostrar algunos ejemplos
    console.log('2. Ejemplos de responsables sin modo:');
    responsablesSinModo.slice(0, 5).forEach((r: any) => {
      console.log(`   - ID: ${r.id}, Proceso: ${r.procesoId}, Usuario: ${r.usuarioId}, Modo: ${r.modo}`);
    });
    console.log('');

    // 3. Preguntar confirmación (en producción, comentar esto)
    console.log('3. Aplicando fix...');
    console.log('   Asignando modo="proceso" a todos los responsables sin modo...\n');

    // 4. Actualizar todos los registros sin modo
    const resultado = await prisma.$executeRaw`
      UPDATE "ProcesoResponsable"
      SET modo = 'proceso'
      WHERE modo IS NULL
    `;

    console.log(`✅ Actualizados ${resultado} registros\n`);

    // 5. Verificar
    console.log('4. Verificando...');
    const responsablesSinModoAhora = await prisma.$queryRaw<any[]>`
      SELECT COUNT(*) as count
      FROM "ProcesoResponsable"
      WHERE modo IS NULL
    `;
    
    const count = responsablesSinModoAhora[0]?.count || 0;
    console.log(`   Responsables sin modo ahora: ${count}\n`);

    if (count === 0) {
      console.log('========================================');
      console.log('✅ FIX COMPLETADO EXITOSAMENTE');
      console.log('========================================\n');
      console.log('Próximos pasos:');
      console.log('   1. Invalidar caché de Redis (reiniciar backend)');
      console.log('   2. Refrescar el frontend');
      console.log('   3. Verificar que los responsables se muestren correctamente\n');
    } else {
      console.log('⚠️  Aún quedan responsables sin modo. Revisar manualmente.\n');
    }

  } catch (error: any) {
    console.error('❌ Error durante el fix:', error.message);
    console.error('Detalles:', error);
    
    // Si el error es porque la columna no existe
    if (error.message.includes('column') && error.message.includes('does not exist')) {
      console.log('\n⚠️  PROBLEMA: La columna "modo" no existe en la tabla ProcesoResponsable');
      console.log('\nSOLUCIÓN:');
      console.log('   1. Ejecutar migraciones de Prisma:');
      console.log('      npx prisma migrate deploy');
      console.log('   2. O crear la columna manualmente:');
      console.log('      ALTER TABLE "ProcesoResponsable" ADD COLUMN modo VARCHAR(20);');
      console.log('      UPDATE "ProcesoResponsable" SET modo = \'proceso\' WHERE modo IS NULL;');
      console.log('      ALTER TABLE "ProcesoResponsable" ALTER COLUMN modo SET NOT NULL;\n');
    }
  } finally {
    await prisma.$disconnect();
  }
}

fixResponsables();
