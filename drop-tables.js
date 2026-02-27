require('dotenv').config();
const { Pool } = require('pg');

const pool = new Pool({
  connectionString: process.env.DATABASE_URL
});

async function dropTables() {
  const client = await pool.connect();
  try {
    console.log('🗑️  Eliminando tablas...');
    await client.query(`
      DROP TABLE IF EXISTS "RangoNivelRiesgoResidual" CASCADE;
      DROP TABLE IF EXISTS "OpcionCriterioResidual" CASCADE;
      DROP TABLE IF EXISTS "TablaMitigacionResidual" CASCADE;
      DROP TABLE IF EXISTS "RangoEvaluacionResidual" CASCADE;
      DROP TABLE IF EXISTS "PesoCriterioResidual" CASCADE;
      DROP TABLE IF EXISTS "ConfiguracionResidual" CASCADE;
    `);
    console.log('✅ Tablas eliminadas');
  } catch (error) {
    console.error('❌ Error:', error.message);
  } finally {
    client.release();
    await pool.end();
  }
}

dropTables();
