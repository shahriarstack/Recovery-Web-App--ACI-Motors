const { Pool } = require('pg');
const fs = require('fs');
require('dotenv').config();

const connectionString = process.env.DATABASE_URL;

if (!connectionString) {
    console.error("Error: DATABASE_URL environment variable is not defined in your .env file.");
    process.exit(1);
}

const pool = new Pool({
    connectionString: connectionString,
    ssl: true
});

const tables = [
    'territories',
    'users',
    'targets',
    'projections',
    'collections',
    'offroad_vehicles',
    'settlements',
    'admin_unlocks',
    'vehicle_performance',
    'system_settings'
];

async function exportDatabase() {
    console.log("Starting Neon database export...");
    const backup = {};

    try {
        for (const table of tables) {
            console.log(`Exporting table: ${table}...`);
            const res = await pool.query(`SELECT * FROM ${table}`);
            backup[table] = res.rows;
            console.log(`Successfully exported ${res.rows.length} rows from ${table}`);
        }

        const backupFilePath = 'neon_database_backup.json';
        fs.writeFileSync(backupFilePath, JSON.stringify(backup, null, 2), 'utf8');
        console.log(`\nExport complete! Data saved to ${backupFilePath}`);
        console.log("Keep this file safe. You will use it to import your data into MySQL.");
    } catch (err) {
        console.error("Export failed:", err);
    } finally {
        await pool.end();
    }
}

exportDatabase();
