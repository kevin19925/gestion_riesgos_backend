const { Pool } = require('pg');
require('dotenv').config();

const url = process.env.DATABASE_URL;

console.log('🔍 Probando conexión a PostgreSQL...');
console.log('📍 Host:', url.match(/@([^:]+)/)?.[1]);
console.log('📍 Database:', url.match(/\/([^?]+)/)?.[1]);

const pool = new Pool({
    connectionString: url,
    connectionTimeoutMillis: 30000,
    ssl: {
        rejectUnauthorized: false
    }
});

async function testConnection() {
    try {
        console.log('\n⏳ Intentando conectar...');
        const start = Date.now();
        
        const client = await pool.connect();
        const duration = Date.now() - start;
        
        console.log(`✅ Conexión exitosa en ${duration}ms`);
        
        const result = await client.query('SELECT NOW(), version()');
        console.log('📅 Hora del servidor:', result.rows[0].now);
        console.log('🗄️  Versión PostgreSQL:', result.rows[0].version.split(' ')[0] + ' ' + result.rows[0].version.split(' ')[1]);
        
        client.release();
        await pool.end();
        
        console.log('\n✅ Test completado exitosamente');
        process.exit(0);
    } catch (error) {
        console.error('\n❌ Error de conexión:', error.message);
        console.error('📋 Código de error:', error.code);
        console.error('📋 Detalles:', error);
        await pool.end();
        process.exit(1);
    }
}

testConnection();
