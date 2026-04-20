/**
 * Script de diagnóstico para verificar riesgos positivos y medidas de administración
 */

const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function diagnostico() {
  try {
    console.log('=== DIAGNÓSTICO DE MEDIDAS DE ADMINISTRACIÓN ===\n');

    // 1. Verificar si existe la tabla MedidaAdministracion
    console.log('1. Verificando tabla MedidaAdministracion...');
    try {
      const countMedidas = await prisma.medidaAdministracion.count();
      console.log(`   ✓ Tabla existe. Total de medidas: ${countMedidas}\n`);
    } catch (error) {
      console.log(`   ✗ Error al acceder a la tabla: ${error.message}\n`);
      return;
    }

    // 2. Contar riesgos positivos
    console.log('2. Contando riesgos positivos...');
    const riesgosPositivos = await prisma.riesgo.count({
      where: { clasificacion: 'POSITIVA' }
    });
    console.log(`   Total de riesgos positivos: ${riesgosPositivos}\n`);

    // 3. Listar algunos riesgos positivos con sus causas
    console.log('3. Listando riesgos positivos con causas...');
    const riesgosConCausas = await prisma.riesgo.findMany({
      where: { clasificacion: 'POSITIVA' },
      include: {
        causas: true,
        proceso: { select: { id: true, nombre: true } }
      },
      take: 5
    });

    if (riesgosConCausas.length === 0) {
      console.log('   ⚠ No se encontraron riesgos positivos en la base de datos.\n');
    } else {
      riesgosConCausas.forEach((riesgo, idx) => {
        console.log(`   ${idx + 1}. Riesgo ID: ${riesgo.id}`);
        console.log(`      Proceso: ${riesgo.proceso?.nombre || 'N/A'}`);
        console.log(`      Descripción: ${riesgo.descripcion.substring(0, 80)}...`);
        console.log(`      Causas: ${riesgo.causas.length}`);
        if (riesgo.causas.length > 0) {
          riesgo.causas.forEach((causa, cidx) => {
            console.log(`         - Causa ${cidx + 1} (ID: ${causa.id}): ${causa.descripcion.substring(0, 60)}...`);
          });
        }
        console.log('');
      });
    }

    // 4. Verificar medidas existentes
    console.log('4. Verificando medidas de administración existentes...');
    const medidas = await prisma.medidaAdministracion.findMany({
      include: {
        causaRiesgo: {
          include: {
            riesgo: {
              select: { id: true, descripcion: true }
            }
          }
        }
      },
      take: 5
    });

    if (medidas.length === 0) {
      console.log('   ⚠ No hay medidas de administración registradas.\n');
    } else {
      console.log(`   Total de medidas: ${medidas.length}`);
      medidas.forEach((medida, idx) => {
        console.log(`   ${idx + 1}. Medida ID: ${medida.id}`);
        console.log(`      Causa ID: ${medida.causaRiesgoId}`);
        console.log(`      Evaluación: ${medida.evaluacion || 'N/A'}`);
        console.log(`      Factor Reducción: ${medida.factorReduccion || 'N/A'}`);
        console.log('');
      });
    }

    // 5. Verificar un proceso específico (Gestión Estratégica)
    console.log('5. Buscando proceso "Gestión Estratégica"...');
    const procesoEstrategico = await prisma.proceso.findFirst({
      where: {
        nombre: {
          contains: 'Estratégica',
          mode: 'insensitive'
        }
      },
      include: {
        riesgos: {
          where: { clasificacion: 'POSITIVA' },
          include: {
            causas: true
          }
        }
      }
    });

    if (procesoEstrategico) {
      console.log(`   ✓ Proceso encontrado: ${procesoEstrategico.nombre} (ID: ${procesoEstrategico.id})`);
      console.log(`   Riesgos positivos en este proceso: ${procesoEstrategico.riesgos.length}`);
      if (procesoEstrategico.riesgos.length > 0) {
        procesoEstrategico.riesgos.forEach((riesgo, idx) => {
          console.log(`      ${idx + 1}. ${riesgo.descripcion.substring(0, 60)}... (${riesgo.causas.length} causas)`);
        });
      }
    } else {
      console.log('   ⚠ No se encontró el proceso "Gestión Estratégica".\n');
    }

    console.log('\n=== FIN DEL DIAGNÓSTICO ===');

  } catch (error) {
    console.error('Error en el diagnóstico:', error);
  } finally {
    await prisma.$disconnect();
  }
}

diagnostico();
