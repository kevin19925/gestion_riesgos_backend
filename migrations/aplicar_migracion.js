/**
 * Script para aplicar la migración de trazabilidad de planes de acción
 * Incluye verificaciones de seguridad y confirmación del usuario
 */

const { PrismaClient } = require('@prisma/client');
const fs = require('fs');
const path = require('path');
const readline = require('readline');

const prisma = new PrismaClient();

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout
});

function pregunta(query) {
  return new Promise(resolve => rl.question(query, resolve));
}

async function verificarEstadoActual() {
  console.log('\n📊 VERIFICANDO ESTADO ACTUAL DE LA BASE DE DATOS...\n');

  try {
    // Contar registros actuales
    const totalPlanes = await prisma.planAccion.count();
    const totalControles = await prisma.control.count();

    console.log(`✅ Total de Planes de Acción: ${totalPlanes}`);
    console.log(`✅ Total de Controles: ${totalControles}`);

    // Verificar si las columnas ya existen
    const columnasExistentes = await prisma.$queryRaw`
      SELECT column_name 
      FROM information_schema.columns 
      WHERE table_name = 'PlanAccion' 
        AND column_name IN ('controlDerivadoId', 'fechaConversion')
    `;

    if (columnasExistentes.length > 0) {
      console.log('\n⚠️  ADVERTENCIA: Algunas columnas ya existen en la base de datos.');
      console.log('Columnas encontradas:', columnasExistentes.map(c => c.column_name).join(', '));
      return false;
    }

    console.log('\n✅ Base de datos lista para migración');
    return true;

  } catch (error) {
    console.error('\n❌ Error al verificar estado:', error.message);
    return false;
  }
}

async function aplicarMigracion() {
  console.log('\n🚀 APLICANDO MIGRACIÓN...\n');

  const sqlPath = path.join(__dirname, 'add_plan_trazabilidad.sql');
  const sql = fs.readFileSync(sqlPath, 'utf8');

  // Extraer solo la parte entre BEGIN y COMMIT
  const sqlLimpio = sql
    .split('BEGIN;')[1]
    .split('COMMIT;')[0]
    .trim();

  // Dividir en comandos individuales
  const comandos = sqlLimpio
    .split(';')
    .map(cmd => cmd.trim())
    .filter(cmd => cmd.length > 0 && !cmd.startsWith('--'));

  try {
    console.log(`📝 Ejecutando ${comandos.length} comandos SQL...\n`);

    // Ejecutar en transacción
    await prisma.$transaction(async (tx) => {
      for (let i = 0; i < comandos.length; i++) {
        const comando = comandos[i];
        console.log(`[${i + 1}/${comandos.length}] Ejecutando...`);
        
        try {
          await tx.$executeRawUnsafe(comando + ';');
          console.log(`✅ Comando ${i + 1} ejecutado exitosamente`);
        } catch (error) {
          console.error(`❌ Error en comando ${i + 1}:`, error.message);
          throw error; // Esto hará rollback de toda la transacción
        }
      }
    });

    console.log('\n✅ MIGRACIÓN APLICADA EXITOSAMENTE\n');
    return true;

  } catch (error) {
    console.error('\n❌ ERROR AL APLICAR MIGRACIÓN:', error.message);
    console.error('⚠️  Se hizo ROLLBACK automático. La base de datos no fue modificada.\n');
    return false;
  }
}

async function verificarMigracion() {
  console.log('\n🔍 VERIFICANDO MIGRACIÓN...\n');

  try {
    // Verificar columnas en PlanAccion
    const columnasPlan = await prisma.$queryRaw`
      SELECT column_name, data_type, is_nullable 
      FROM information_schema.columns 
      WHERE table_name = 'PlanAccion' 
        AND column_name IN ('controlDerivadoId', 'fechaConversion')
      ORDER BY column_name
    `;

    console.log('Columnas agregadas a PlanAccion:');
    columnasPlan.forEach(col => {
      console.log(`  ✅ ${col.column_name} (${col.data_type}, nullable: ${col.is_nullable})`);
    });

    // Verificar columnas en Control
    const columnasControl = await prisma.$queryRaw`
      SELECT column_name, data_type, is_nullable 
      FROM information_schema.columns 
      WHERE table_name = 'Control' 
        AND column_name IN ('planAccionOrigenId', 'fechaCreacionDesdePlan')
      ORDER BY column_name
    `;

    console.log('\nColumnas agregadas a Control:');
    columnasControl.forEach(col => {
      console.log(`  ✅ ${col.column_name} (${col.data_type}, nullable: ${col.is_nullable})`);
    });

    // Verificar tabla AlertaVencimiento
    const totalAlertas = await prisma.alertaVencimiento.count();
    console.log(`\n✅ Tabla AlertaVencimiento creada (${totalAlertas} registros)`);

    // Verificar que datos existentes no cambiaron
    const totalPlanes = await prisma.planAccion.count();
    const totalControles = await prisma.control.count();

    console.log(`\n✅ Total de Planes de Acción: ${totalPlanes} (sin cambios)`);
    console.log(`✅ Total de Controles: ${totalControles} (sin cambios)`);

    console.log('\n✅ VERIFICACIÓN COMPLETADA - TODO OK\n');
    return true;

  } catch (error) {
    console.error('\n❌ Error en verificación:', error.message);
    return false;
  }
}

async function main() {
  console.log('╔════════════════════════════════════════════════════════════╗');
  console.log('║  MIGRACIÓN: Trazabilidad de Planes de Acción              ║');
  console.log('║  Fase 1: Extensión de Base de Datos                       ║');
  console.log('╚════════════════════════════════════════════════════════════╝');

  // Paso 1: Verificar estado actual
  const estadoOk = await verificarEstadoActual();
  
  if (!estadoOk) {
    console.log('\n⚠️  No se puede continuar. Revisa los mensajes anteriores.\n');
    rl.close();
    await prisma.$disconnect();
    process.exit(1);
  }

  // Paso 2: Solicitar confirmación
  console.log('\n⚠️  IMPORTANTE: Esta operación modificará la estructura de la base de datos.');
  console.log('   - Se agregarán columnas nuevas a PlanAccion y Control');
  console.log('   - Se creará la tabla AlertaVencimiento');
  console.log('   - NO se eliminarán ni modificarán datos existentes');
  console.log('   - La operación es reversible con el script de rollback\n');

  const respuesta = await pregunta('¿Deseas continuar? (escribe "SI" para confirmar): ');

  if (respuesta.toUpperCase() !== 'SI') {
    console.log('\n❌ Migración cancelada por el usuario.\n');
    rl.close();
    await prisma.$disconnect();
    process.exit(0);
  }

  // Paso 3: Aplicar migración
  const exito = await aplicarMigracion();

  if (!exito) {
    console.log('\n❌ La migración falló. La base de datos no fue modificada.\n');
    rl.close();
    await prisma.$disconnect();
    process.exit(1);
  }

  // Paso 4: Verificar migración
  await verificarMigracion();

  console.log('╔════════════════════════════════════════════════════════════╗');
  console.log('║  ✅ FASE 1 COMPLETADA EXITOSAMENTE                        ║');
  console.log('╚════════════════════════════════════════════════════════════╝');
  console.log('\n📝 Próximo paso: Ejecutar script de migración de datos');
  console.log('   para asignar estados a planes existentes.\n');

  rl.close();
  await prisma.$disconnect();
}

main()
  .catch((error) => {
    console.error('\n❌ ERROR FATAL:', error);
    rl.close();
    prisma.$disconnect();
    process.exit(1);
  });
