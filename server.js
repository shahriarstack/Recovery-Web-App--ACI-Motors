const express = require('express');
const mysql = require('mysql2/promise');
const cors = require('cors');
require('dotenv').config();

const app = express();
const port = process.env.PORT || 3000;

app.use(cors());
app.use(express.json({ limit: '50mb' })); // Increase limit for bulk operations
app.use(express.static(__dirname));

// Create MySQL database connection pool
const pool = mysql.createPool({
    host: process.env.DB_HOST,
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    database: process.env.DB_NAME,
    port: parseInt(process.env.DB_PORT || '3306', 10),
    waitForConnections: true,
    connectionLimit: 10,
    queueLimit: 0
});

// Run database migrations on startup
async function runMigrations() {
    try {
        console.log("Running MySQL startup migrations...");
        // Ensure territory_id can hold multiple comma-separated IDs for Area Heads
        await pool.query('ALTER TABLE users MODIFY COLUMN territory_id VARCHAR(1000)').catch(err => console.log("Migration Notice (users):", err.message));
        // Create system_settings if not exists
        await pool.query('CREATE TABLE IF NOT EXISTS system_settings (`key` VARCHAR(255) PRIMARY KEY, `value` TEXT)').catch(err => console.log("Migration Notice (system_settings):", err.message));
        // Safe column additions (catch and ignore if column already exists)
        await pool.query('ALTER TABLE collections ADD COLUMN active_month VARCHAR(7)').catch(() => {});
        await pool.query('ALTER TABLE projections ADD COLUMN active_month VARCHAR(7)').catch(() => {});
        await pool.query('ALTER TABLE projections ADD COLUMN timestamp BIGINT').catch(() => {});
        console.log("Migrations check completed.");
    } catch (err) {
        console.error("Migration Error during startup:", err);
    }
}
runMigrations();

// GET complete database state (mirrors Store.get())
app.get('/api/db', async (req, res) => {
    try {
        const [
            [users], [territories], [targets], [projections], [collections],
            [offroad_vehicles], [settlements], [unlocksResult], [vehicle_performance], [system_settings]
        ] = await Promise.all([
            pool.query('SELECT * FROM users'),
            pool.query('SELECT * FROM territories'),
            pool.query('SELECT * FROM targets'),
            pool.query('SELECT * FROM projections'),
            pool.query('SELECT * FROM collections'),
            pool.query('SELECT * FROM offroad_vehicles'),
            pool.query('SELECT * FROM settlements'),
            pool.query('SELECT * FROM admin_unlocks'),
            pool.query('SELECT * FROM vehicle_performance'),
            pool.query('SELECT * FROM system_settings').catch(() => [[]])
        ]);

        const unlocks = {};
        unlocksResult.forEach(row => {
            unlocks[row.territory_id] = row.unlock_until;
        });

        res.json({
            users: users,
            territories: territories,
            targets: targets,
            projections: projections,
            collections: collections,
            offroad_vehicles: offroad_vehicles,
            settlements: settlements,
            unlocks: unlocks,
            vehicle_performance: vehicle_performance,
            system_settings: system_settings
        });
    } catch (err) {
        console.error("Failed to fetch database state:", err);
        res.status(500).json({ error: 'Failed to fetch database state' });
    }
});

// Update or Create an item in a specific collection
app.post('/api/update', async (req, res) => {
    const { collection, item } = req.body;
    const table = collection; // mapping collection name to table name

    // Prevent SQL injection by validating the collection name against known tables
    const validTables = ['collections', 'projections', 'offroad_vehicles', 'settlements', 'territories', 'users'];
    if (!validTables.includes(table)) {
        return res.status(400).json({ error: "Invalid collection specified for update" });
    }

    try {
        const keys = Object.keys(item).filter(k => k !== 'id');
        const values = keys.map(k => {
            let val = item[k];
            // Format JS Dates or ISO Strings to MySQL Date format (YYYY-MM-DD)
            const dateColumns = {
                'projections': ['date'],
                'collections': ['date'],
                'offroad_vehicles': ['in_date', 'solve_date'],
                'settlements': ['date']
            };
            if (dateColumns[table] && dateColumns[table].includes(k) && typeof val === 'string') {
                return val.split('T')[0];
            }
            return val;
        });

        if (item.id && !String(item.id).startsWith('new_')) {
            // UPDATE
            const setClause = keys.map(k => `\`${k}\` = ?`).join(', ');
            await pool.query(`UPDATE \`${table}\` SET ${setClause} WHERE id = ?`, [...values, item.id]);
            res.json(item);
        } else {
            // INSERT
            const columns = keys.map(k => `\`${k}\``).join(', ');
            const placeholders = keys.map(() => '?').join(', ');
            const [result] = await pool.query(`INSERT INTO \`${table}\` (${columns}) VALUES (${placeholders})`, values);
            item.id = result.insertId;
            res.json(item);
        }
    } catch (err) {
        console.error("Update error:", err);
        res.status(500).json({ error: err.message });
    }
});

// Delete an item
app.delete('/api/delete', async (req, res) => {
    const { collection, id } = req.body;
    const validTables = ['collections', 'projections', 'offroad_vehicles', 'settlements', 'territories', 'users'];
    if (!validTables.includes(collection)) {
        return res.status(400).json({ error: "Invalid collection specified for deletion" });
    }

    try {
        await pool.query(`DELETE FROM \`${collection}\` WHERE id = ?`, [id]);
        res.json({ success: true });
    } catch (err) {
        console.error("Delete error:", err);
        res.status(500).json({ error: err.message });
    }
});

// Bulk Save for Targets/Territories (from Setup Page)
app.post('/api/sync-targets', async (req, res) => {
    const { territories, targets, deletedTerritoryIds } = req.body;
    const connection = await pool.getConnection();
    try {
        await connection.beginTransaction();

        if (deletedTerritoryIds && deletedTerritoryIds.length > 0) {
            await connection.query('DELETE FROM territories WHERE id IN (?)', [deletedTerritoryIds]);
        }

        if (territories && territories.length > 0) {
            const values = territories.map(t => [t.id, t.name, t.part, t.officer]);
            await connection.query(`
                INSERT INTO territories (id, name, part, officer) 
                VALUES ?
                ON DUPLICATE KEY UPDATE name = VALUES(name), part = VALUES(part), officer = VALUES(officer)
            `, [values]);
        }

        if (targets && targets.length > 0) {
            const values = targets.map(t => [
                t.territory_id, t.month, t.files, t.proj_files, t.amount, t.proj_reg, t.proj_adv,
                t.lm_np_target_amount, t.lm_np_target_files, t.total_od, t.od_growth_sply,
                t.per_file_od, t.six_plus_od_files, t.six_plus_od_growth_splm
            ]);
            await connection.query(`
                INSERT INTO targets (
                    territory_id, month, files, proj_files, amount, proj_reg, proj_adv,
                    lm_np_target_amount, lm_np_target_files, total_od, od_growth_sply,
                    per_file_od, six_plus_od_files, six_plus_od_growth_splm
                )
                VALUES ?
                ON DUPLICATE KEY UPDATE 
                    files = VALUES(files), proj_files = VALUES(proj_files), amount = VALUES(amount),
                    proj_reg = VALUES(proj_reg), proj_adv = VALUES(proj_adv),
                    lm_np_target_amount = VALUES(lm_np_target_amount), lm_np_target_files = VALUES(lm_np_target_files),
                    total_od = VALUES(total_od), od_growth_sply = VALUES(od_growth_sply),
                    per_file_od = VALUES(per_file_od), six_plus_od_files = VALUES(six_plus_od_files),
                    six_plus_od_growth_splm = VALUES(six_plus_od_growth_splm)
            `, [values]);
        }

        await connection.commit();
        res.json({ success: true });
    } catch (err) {
        await connection.rollback();
        console.error("Sync Targets Error:", err);
        res.status(500).json({ error: err.message });
    } finally {
        connection.release();
    }
});

// Bulk Save for Users
app.post('/api/sync-users', async (req, res) => {
    const { users } = req.body;
    const connection = await pool.getConnection();
    try {
        await connection.beginTransaction();
        
        // Delete all officers first
        await connection.query("DELETE FROM users WHERE role = 'officer'");
        
        const officerUsers = users.filter(u => u.role === 'officer');
        if (officerUsers.length > 0) {
            const values = officerUsers.map(u => [u.username, u.officerName, u.role, u.password, u.territoryId]);
            await connection.query(`
                INSERT INTO users (username, officer_name, role, password, territory_id) 
                VALUES ?
            `, [values]);
        }
        
        await connection.commit();
        res.json({ success: true });
    } catch (err) {
        await connection.rollback();
        console.error("Sync Users Error:", err);
        res.status(500).json({ error: err.message });
    } finally {
        connection.release();
    }
});

// Bulk Save for Vehicle Performance
app.post('/api/sync-vehicle-perf', async (req, res) => {
    const { data } = req.body;
    const connection = await pool.getConnection();
    try {
        await connection.beginTransaction();
        await connection.query("DELETE FROM vehicle_performance");
        if (data && data.length > 0) {
            const values = data.map(v => [
                v.customerId, v.customerName, v.model, v.km1, v.km2, v.earning, v.overdueNo, v.overdueAmt, v.extra1, v.extra2
            ]);
            await connection.query(`
                INSERT INTO vehicle_performance (customer_id, customer_name, model, km1, km2, earning, overdue_no, overdue_amt, extra1, extra2)
                VALUES ?
            `, [values]);
        }
        await connection.commit();
        res.json({ success: true });
    } catch (err) {
        await connection.rollback();
        console.error("Sync Vehicle Perf Error:", err);
        res.status(500).json({ error: err.message });
    } finally {
        connection.release();
    }
});

// Save System Settings
app.post('/api/settings', async (req, res) => {
    const { key, value } = req.body;
    try {
        await pool.query('INSERT INTO system_settings (`key`, `value`) VALUES (?, ?) ON DUPLICATE KEY UPDATE `value` = VALUES(`value`)', [key, value]);
        res.json({ success: true });
    } catch (err) {
        console.error("Settings Save Error:", err);
        res.status(500).json({ error: `DB Error: ${err.message}` });
    }
});

// Handle Unlocks
app.post('/api/unlock', async (req, res) => {
    const { territoryId, unlockUntil } = req.body;
    try {
        await pool.query(`
            INSERT INTO admin_unlocks (territory_id, unlock_until) VALUES (?, ?)
            ON DUPLICATE KEY UPDATE unlock_until = VALUES(unlock_until)
        `, [territoryId, unlockUntil]);
        res.json({ success: true });
    } catch (err) {
        console.error("Unlock save error:", err);
        res.status(500).json({ error: err.message });
    }
});

app.listen(port, () => {
    console.log(`MySQL Backend running on port ${port}`);
});
