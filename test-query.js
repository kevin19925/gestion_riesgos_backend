const { Pool } = require('pg');
const pool = new Pool({
    connectionString: 'postgresql://admin_comware:Js8qM8lkV5p2k5AZxo3ml6QaoPazxjhU@dpg-d6594i56ubrc738u5tk0-a.oregon-postgres.render.com/riesgos_db_cv8c',
    ssl: { rejectUnauthorized: false }
});
pool.query('SELECT * FROM "Cargo"').then(r => {
    console.log('Count:', r.rowCount);
    pool.end();
}).catch(e => {
    console.error(e);
    pool.end();
});
