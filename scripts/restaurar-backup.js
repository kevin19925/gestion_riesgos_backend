/**
 * Script para restaurar desde el backup
 */

const { Client } = require('pg');
require('dotenv').config();

async function restaurarBackup() {
    const client = new Client({
        connectionString: process.env.DATABASE_URL,
        ssl: process.env.DATABASE_URL.includes('azure') || process.env.DATABASE_URL.includes('render')
            ? { rejectUnauthorized: false }
            : false
    });

    try {
        console.log('🔌 Conectando a la base de datos...');
        await client.connect();
        console.log('✅ Conectado\n');

        console.log('🔄 Restaurando desde backup...\n');

        // Eliminar tabla actual
        await client.query('DROP TABLE IF EXISTS "ProcesoResponsable";');
        console.log('✅ Tabla actual eliminada');

        // Renombrar backup
        await client.query('ALTER TABLE "ProcesoResponsable_backup_20260227" RENAME TO "ProcesoResponsable";');
        console.log('✅ Backup restaurado');

        // Verificar
        const result = await client.query('SELECT COUNT(*) FROM "ProcesoResponsable";');
        console.log(`\n📊 Total registros restaurados: ${result.rows[0].count}\n`);

        console.log('✅ Restauración completada exitosamente\n');

    } catch (error) {
        console.error('❌ Error:', error.message);
        process.exit(1);
    } finally {
        await client.end();
    }
}

restaurarBackup();
