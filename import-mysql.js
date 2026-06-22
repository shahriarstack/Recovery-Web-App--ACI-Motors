const mysql = require('mysql2/promise');
const fs = require('fs');
require('dotenv').config();

// We expect the new MySQL credentials in the .env file
const dbConfig = {
    host: process.env.DB_HOST,
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    database: process.env.DB_NAME,
    port: process.env.DB_PORT || 3306
};

// Check if credentials are set
if (!dbConfig.host || !dbConfig.user || !dbConfig.database) {
    console.error("Error: Please set DB_HOST, DB_USER, DB_PASSWORD, and DB_NAME in your .env file first.");
    process.exit(1);
}

const backupFilePath = 'neon_database_backup.json';
if (!fs.existsSync(backupFilePath)) {
    console.error(`Error: Backup file '${backupFilePath}' not found. Run 'node export-neon.js' first.`);
    process.exit(1);
}

const backupData = JSON.parse(fs.readFileSync(backupFilePath, 'utf8'));

// Insertion order matters to avoid Foreign Key constraint violations
const tablesInOrder = [
    'territories', // Referenced by users, targets, projections, collections, offroad_vehicles, settlements, admin_unlocks
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

// Helper to clean dates and format for MySQL (YYYY-MM-DD)
function cleanValue(table, column, val) {
    if (val === null || val === undefined) {
        return null;
    }
    
    // Check if it's a date column
    const dateColumns = {
        'projections': ['date'],
        'collections': ['date'],
        'offroad_vehicles': ['in_date', 'solve_date'],
        'settlements': ['date']
    };
    
    if (dateColumns[table] && dateColumns[table].includes(column)) {
        if (typeof val === 'string') {
            return val.split('T')[0]; // Convert "2026-06-01T00:00:00.000Z" to "2026-06-01"
        }
    }
    
    // Convert boolean to 1/0 for safety
    if (typeof val === 'boolean') {
        return val ? 1 : 0;
    }
    
    return val;
}

async function importDatabase() {
    console.log("Connecting to MySQL database...");
    const connection = await mysql.createConnection(dbConfig);
    console.log("Connected successfully!");

    try {
        // Disable foreign keys temporarily during import to be absolutely safe
        await connection.query('SET FOREIGN_KEY_CHECKS = 0');
        console.log("Disabled foreign key checks for import speed and safety.");

        for (const table of tablesInOrder) {
            const rows = backupData[table];
            if (!rows || rows.length === 0) {
                console.log(`Skipping table '${table}' (no data found in backup).`);
                continue;
            }

            console.log(`Importing ${rows.length} rows into table '${table}'...`);

            // Find all columns in the first row
            const columns = Object.keys(rows[0]);
            
            // Build the query: INSERT INTO table (`col1`, `col2`) VALUES ?
            const escapedColumns = columns.map(col => `\`${col}\``).join(', ');
            const query = `INSERT INTO \`${table}\` (${escapedColumns}) VALUES ?`;

            // Prepare the values array
            const values = rows.map(row => 
                columns.map(col => cleanValue(table, col, row[col]))
            );

            // Execute bulk insert
            // mysql2 driver supports bulk insert when we pass values as [values] (nested array)
            await connection.query(query, [values]);
            console.log(`Successfully imported table '${table}'.`);
        }

        // Re-enable foreign keys
        await connection.query('SET FOREIGN_KEY_CHECKS = 1');
        console.log("Re-enabled foreign key checks.");
        console.log("\nMySQL Import Complete! All your Neon data has been migrated.");
    } catch (err) {
        console.error("Import failed:", err);
    } finally {
        await connection.end();
    }
}

importDatabase();
