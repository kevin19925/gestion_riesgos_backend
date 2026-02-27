require('dotenv').config();
const { Pool } = require('pg');
const fs = require('fs');
const path = require('path');

const pool = new Pool({
  connectionString: process.env.DATABASE_URL
});

async function createTables() {
  const client = await pool.connect();
  try {
    const sql = fs.readFileSync(
      path.join(__dirname, 'prisma', 'create-configuracion-residual-tables.sql'),
      'utf8'
    );
    
    console.log('🔧 Creando tablas de Configuración Residual...');
    await client.query(sql);
    console.log('✅ Tablas creadas exitosamente');
  } catch (error) {
    console.error('❌ Error:', error.message);
    throw error;
  } finally {
    client.release();
    await pool.end();
  }
}

createTables();
