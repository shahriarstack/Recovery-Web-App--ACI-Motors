const { Pool } = require('pg');
const fs = require('fs');
require('dotenv').config();

const pool = new Pool({
    connectionString: process.env.DATABASE_URL
});

async function initDb() {
    try {
        console.log('Reading schema.sql...');
        const sql = fs.readFileSync('schema.sql', 'utf8');
        console.log('Executing schema.sql...');
        await pool.query(sql);
        console.log('Schema executed successfully.');
    } catch (err) {
        console.error('Error executing schema:', err);
    } finally {
        pool.end();
    }
}

initDb();
