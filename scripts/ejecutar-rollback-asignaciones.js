/**
 * Script para revertir la migración de asignaciones independientes
 * USAR SOLO SI LA MIGRACIÓN FALLA O NECESITAS REVERTIR
 * Ejecutar con: node scripts/ejecutar-rollback-asignaciones.js
 */

const { Client } = require('pg');
const fs = require('fs');
const path = require('path');
const readline = require('readline');
require('dotenv').config();

async function preguntarConfirmacion() {
    const rl = readline.createInterface({
        input: process.stdin,
        output: process.stdout
    });

    return new Promise((resolve) => {
        rl.question('\n⚠️  ¿Estás seguro de que quieres REVERTIR la migración? (escribe "SI" para confirmar): ', (answer) => {
            rl.close();
            resolve(answer.toUpperCase() === 'SI');
        });
    });
}

async function ejecutarRollback() {
    console.log('\n' + '='.repeat(60));
    console.log('🔄 ROLLBACK: Revertir Asignaciones Independientes');
    console.log('='.repeat(60));
    console.log('\nEste script revertirá los cambios y restaurará el modo "ambos".\n');

    const confirmado = await preguntarConfirmacion();

    if (!confirmado) {
        console.log('\n❌ Rollback cancelado por el usuario.\n');
        process.exit(0);
    }

    const client = new Client({
        connectionString: process.env.DATABASE_URL,
        ssl: process.env.DATABASE_URL.includes('azure') || process.env.DATABASE_URL.includes('render')
            ? { rejectUnauthorized: false }
            : false
    });

    try {
        console.log('\n🔌 Conectando a la base de datos...');
        await client.connect();
        console.log('✅ Conectado exitosamente\n');

        // Leer el archivo SQL de rollback
        const sqlPath = path.join(__dirname, '02-rollback-migracion.sql');
        const sqlContent = fs.readFileSync(sqlPath, 'utf8');

        console.log('📋 Ejecutando rollback...\n');
        console.log('=' .repeat(60));

        // Ejecutar el rollback
        await client.query(sqlContent);

        console.log('=' .repeat(60));
        console.log('\n✅ Rollback completado exitosamente\n');

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
            console.log(`   ${row.modo || 'NULL'}: ${row.cantidad} registros`);
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

        console.log('\n' + '='.repeat(60));
        console.log('🎉 ROLLBACK COMPLETADO EXITOSAMENTE');
        console.log('='.repeat(60));
        console.log('\nEl sistema ha vuelto al estado anterior (modo "ambos").\n');
        console.log('📋 Próximos pasos:');
        console.log('   1. Ejecutar: npx prisma generate');
        console.log('   2. Reiniciar el servidor backend');
        console.log('   3. El frontend volverá a sincronizar automáticamente\n');

    } catch (error) {
        console.error('\n❌ ERROR durante el rollback:');
        console.error(error.message);
        console.error('\n⚠️  El rollback falló. Detalles del error:');
        console.error(error);
        console.error('\n💡 Puedes restaurar desde el backup manualmente:');
        console.error('   DROP TABLE "ProcesoResponsable";');
        console.error('   ALTER TABLE "ProcesoResponsable_backup_20260227" RENAME TO "ProcesoResponsable";\n');
        process.exit(1);
    } finally {
        await client.end();
        console.log('🔌 Conexión cerrada');
    }
}

// Ejecutar
ejecutarRollback();
