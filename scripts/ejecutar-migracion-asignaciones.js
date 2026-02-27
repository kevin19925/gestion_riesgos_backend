/**
 * Script para ejecutar la migración de asignaciones independientes por modo
 * Ejecutar con: node scripts/ejecutar-migracion-asignaciones.js
 */

const { Client } = require('pg');
const fs = require('fs');
const path = require('path');
require('dotenv').config();

async function ejecutarMigracion() {
    const client = new Client({
        connectionString: process.env.DATABASE_URL,
        ssl: process.env.DATABASE_URL.includes('azure') || process.env.DATABASE_URL.includes('render')
            ? { rejectUnauthorized: false }
            : false
    });

    try {
        console.log('🔌 Conectando a la base de datos...');
        await client.connect();
        console.log('✅ Conectado exitosamente\n');

        console.log('📋 Ejecutando migración de asignaciones independientes...\n');
        console.log('=' .repeat(60));

        // Paso 1: Eliminar constraint antiguo PRIMERO
        console.log('1️⃣  Eliminando constraint único antiguo...');
        await client.query(`
            ALTER TABLE "ProcesoResponsable" 
            DROP CONSTRAINT IF EXISTS "ProcesoResponsable_procesoId_usuarioId_key";
        `);
        console.log('   ✅ Constraint antiguo eliminado\n');

        // Paso 2: Duplicar registros para modo "director"
        console.log('2️⃣  Duplicando registros para modo "director"...');
        const result1 = await client.query(`
            INSERT INTO "ProcesoResponsable" ("procesoId", "usuarioId", "modo", "createdAt")
            SELECT 
                "procesoId", 
                "usuarioId", 
                'director', 
                "createdAt"
            FROM "ProcesoResponsable"
            WHERE modo = 'ambos' OR modo IS NULL;
        `);
        console.log(`   ✅ ${result1.rowCount} registros creados para modo "director"\n`);

        // Paso 3: Duplicar registros para modo "proceso"
        console.log('3️⃣  Duplicando registros para modo "proceso"...');
        const result2 = await client.query(`
            INSERT INTO "ProcesoResponsable" ("procesoId", "usuarioId", "modo", "createdAt")
            SELECT 
                "procesoId", 
                "usuarioId", 
                'proceso', 
                "createdAt"
            FROM "ProcesoResponsable"
            WHERE modo = 'ambos' OR modo IS NULL;
        `);
        console.log(`   ✅ ${result2.rowCount} registros creados para modo "proceso"\n`);

        // Paso 4: Eliminar registros antiguos
        console.log('4️⃣  Eliminando registros antiguos con modo "ambos" o NULL...');
        const result3 = await client.query(`
            DELETE FROM "ProcesoResponsable" 
            WHERE modo = 'ambos' OR modo IS NULL;
        `);
        console.log(`   ✅ ${result3.rowCount} registros antiguos eliminados\n`);

        // Paso 5: Agregar nuevo constraint
        console.log('5️⃣  Agregando nuevo constraint único (procesoId, usuarioId, modo)...');
        await client.query(`
            ALTER TABLE "ProcesoResponsable" 
            ADD CONSTRAINT "ProcesoResponsable_procesoId_usuarioId_modo_key" 
            UNIQUE ("procesoId", "usuarioId", "modo");
        `);
        console.log('   ✅ Nuevo constraint agregado\n');

        // Paso 6: Hacer campo modo obligatorio
        console.log('6️⃣  Haciendo campo "modo" obligatorio (NOT NULL)...');
        await client.query(`
            ALTER TABLE "ProcesoResponsable" 
            ALTER COLUMN "modo" SET NOT NULL;
        `);
        console.log('   ✅ Campo "modo" ahora es obligatorio\n');

        console.log('=' .repeat(60));
        console.log('\n✅ Migración completada exitosamente\n');

        // Verificar resultado
        console.log('🔍 Verificando resultado...\n');

        const verificacion = await client.query(`
            SELECT 
                modo,
                COUNT(*) as cantidad
            FROM "ProcesoResponsable"
            GROUP BY modo
            ORDER BY modo;
        `);

        console.log('📊 Distribución de registros por modo:');
        verificacion.rows.forEach(row => {
            console.log(`   ${row.modo}: ${row.cantidad} registros`);
        });

        // Verificar constraint
        const constraint = await client.query(`
            SELECT 
                tc.constraint_name,
                STRING_AGG(kcu.column_name, ', ' ORDER BY kcu.ordinal_position) as columns
            FROM information_schema.table_constraints tc
            JOIN information_schema.key_column_usage kcu 
                ON tc.constraint_name = kcu.constraint_name
                AND tc.table_schema = kcu.table_schema
            WHERE tc.table_name = 'ProcesoResponsable'
            AND tc.constraint_type = 'UNIQUE'
            GROUP BY tc.constraint_name
            ORDER BY tc.constraint_name;
        `);

        console.log('\n🔐 Constraints únicos:');
        constraint.rows.forEach(row => {
            console.log(`   ${row.constraint_name}: (${row.columns})`);
        });

        // Verificar campo modo es NOT NULL
        const columna = await client.query(`
            SELECT 
                column_name,
                is_nullable,
                data_type
            FROM information_schema.columns
            WHERE table_name = 'ProcesoResponsable'
            AND column_name = 'modo';
        `);

        console.log('\n📝 Campo modo:');
        if (columna.rows.length > 0) {
            const col = columna.rows[0];
            console.log(`   Tipo: ${col.data_type}`);
            console.log(`   Nullable: ${col.is_nullable}`);
            console.log(`   ${col.is_nullable === 'NO' ? '✅' : '❌'} Campo es obligatorio (NOT NULL)`);
        }

        console.log('\n' + '='.repeat(60));
        console.log('🎉 MIGRACIÓN COMPLETADA EXITOSAMENTE');
        console.log('='.repeat(60));
        console.log('\n📋 Próximos pasos:');
        console.log('   1. Ejecutar: npx prisma generate');
        console.log('   2. Reiniciar el servidor backend');
        console.log('   3. Probar en el frontend\n');

    } catch (error) {
        console.error('\n❌ ERROR durante la migración:');
        console.error(error.message);
        console.error('\n⚠️  La migración falló. Detalles del error:');
        console.error(error);
        console.error('\n💡 Puedes ejecutar el rollback con:');
        console.error('   node scripts/ejecutar-rollback-asignaciones.js\n');
        process.exit(1);
    } finally {
        await client.end();
        console.log('🔌 Conexión cerrada');
    }
}

// Ejecutar
console.log('\n' + '='.repeat(60));
console.log('🚀 MIGRACIÓN: Asignaciones Independientes por Modo');
console.log('='.repeat(60));
console.log('\nEste script modificará la tabla ProcesoResponsable para permitir');
console.log('asignaciones independientes entre Modo Director y Modo Proceso.\n');

ejecutarMigracion();
