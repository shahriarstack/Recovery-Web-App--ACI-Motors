const express = require('express');
const { Pool } = require('pg');
const cors = require('cors');
require('dotenv').config();

const app = express();
const port = process.env.PORT || 3000;

app.use(cors());
app.use(express.json({ limit: '50mb' })); // Increase limit for bulk operations

const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
});

// GET complete database state (mirrors Store.get())
app.get('/api/db', async (req, res) => {
    try {
        const users = await pool.query('SELECT * FROM users');
        const territories = await pool.query('SELECT * FROM territories');
        const targets = await pool.query('SELECT * FROM targets');
        const projections = await pool.query('SELECT * FROM projections');
        const collections = await pool.query('SELECT * FROM collections');
        const offroad_vehicles = await pool.query('SELECT * FROM offroad_vehicles');
        const settlements = await pool.query('SELECT * FROM settlements');
        const unlocksResult = await pool.query('SELECT * FROM admin_unlocks');
        const vehicle_performance = await pool.query('SELECT * FROM vehicle_performance');

        const unlocks = {};
        unlocksResult.rows.forEach(row => {
            unlocks[row.territory_id] = row.unlock_until;
        });

        res.json({
            users: users.rows,
            territories: territories.rows,
            targets: targets.rows,
            projections: projections.rows,
            collections: collections.rows,
            offroad_vehicles: offroad_vehicles.rows,
            settlements: settlements.rows,
            unlocks: unlocks,
            vehicle_performance: vehicle_performance.rows
        });
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Failed to fetch database state' });
    }
});

// Update or Create an item in a specific collection
app.post('/api/update', async (req, res) => {
    const { collection, item } = req.body;
    const table = collection; // mapping collection name to table name

    try {
        const keys = Object.keys(item).filter(k => k !== 'id');
        const values = keys.map(k => item[k]);

        if (item.id && !String(item.id).startsWith('new_')) {
            // UPDATE
            const setClause = keys.map((k, i) => `${k} = $${i + 1}`).join(', ');
            await pool.query(`UPDATE ${table} SET ${setClause} WHERE id = $${keys.length + 1}`, [...values, item.id]);
            res.json(item);
        } else {
            // INSERT
            const columns = keys.join(', ');
            const placeholders = keys.map((_, i) => `$${i + 1}`).join(', ');
            const result = await pool.query(`INSERT INTO ${table} (${columns}) VALUES (${placeholders}) RETURNING id`, values);
            item.id = result.rows[0].id;
            res.json(item);
        }
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: err.message });
    }
});

// Delete an item
app.delete('/api/delete', async (req, res) => {
    const { collection, id } = req.body;
    try {
        await pool.query(`DELETE FROM ${collection} WHERE id = $1`, [id]);
        res.json({ success: true });
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: err.message });
    }
});

// Bulk Save for Targets/Territories (from Setup Page)
app.post('/api/sync-targets', async (req, res) => {
    const { territories, targets } = req.body;
    const client = await pool.connect();
    try {
        await client.query('BEGIN');

        if (territories && territories.length > 0) {
            const values = [];
            const params = [];
            let pIdx = 1;
            for (const t of territories) {
                values.push(`($${pIdx++}, $${pIdx++}, $${pIdx++}, $${pIdx++})`);
                params.push(t.id, t.name, t.part, t.officer);
            }
            await client.query(`
                INSERT INTO territories (id, name, part, officer) 
                VALUES ${values.join(', ')}
                ON CONFLICT (id) DO UPDATE SET name = EXCLUDED.name, part = EXCLUDED.part, officer = EXCLUDED.officer
            `, params);
        }

        if (targets && targets.length > 0) {
            const values = [];
            const params = [];
            let pIdx = 1;
            for (const t of targets) {
                values.push(`($${pIdx++}, $${pIdx++}, $${pIdx++}, $${pIdx++}, $${pIdx++}, $${pIdx++}, $${pIdx++}, $${pIdx++}, $${pIdx++}, $${pIdx++}, $${pIdx++}, $${pIdx++}, $${pIdx++}, $${pIdx++})`);
                params.push(t.territory_id, t.month, t.files, t.proj_files, t.amount, t.proj_reg, t.proj_adv, t.lm_np_target_amount, t.lm_np_target_files, t.total_od, t.od_growth_sply, t.per_file_od, t.six_plus_od_files, t.six_plus_od_growth_splm);
            }
            await client.query(`
                INSERT INTO targets (territory_id, month, files, proj_files, amount, proj_reg, proj_adv, lm_np_target_amount, lm_np_target_files, total_od, od_growth_sply, per_file_od, six_plus_od_files, six_plus_od_growth_splm)
                VALUES ${values.join(', ')}
                ON CONFLICT (territory_id, month) DO UPDATE SET 
                    files = EXCLUDED.files, proj_files = EXCLUDED.proj_files, amount = EXCLUDED.amount,
                    proj_reg = EXCLUDED.proj_reg, proj_adv = EXCLUDED.proj_adv, lm_np_target_amount = EXCLUDED.lm_np_target_amount,
                    lm_np_target_files = EXCLUDED.lm_np_target_files, total_od = EXCLUDED.total_od, od_growth_sply = EXCLUDED.od_growth_sply,
                    per_file_od = EXCLUDED.per_file_od, six_plus_od_files = EXCLUDED.six_plus_od_files, six_plus_od_growth_splm = EXCLUDED.six_plus_od_growth_splm
            `, params);
        }

        await client.query('COMMIT');
        res.json({ success: true });
    } catch (err) {
        await client.query('ROLLBACK');
        res.status(500).json({ error: err.message });
    } finally {
        client.release();
    }
});

// Bulk Save for Users
app.post('/api/sync-users', async (req, res) => {
    const { users } = req.body;
    const client = await pool.connect();
    try {
        await client.query('BEGIN');
        // Delete all officers first (simple approach for this app's user sync)
        await client.query("DELETE FROM users WHERE role = 'officer'");
        
        const officerUsers = users.filter(u => u.role === 'officer');
        if (officerUsers.length > 0) {
            const values = [];
            const params = [];
            let paramIdx = 1;
            
            for (const u of officerUsers) {
                values.push(`($${paramIdx++}, $${paramIdx++}, $${paramIdx++}, $${paramIdx++}, $${paramIdx++})`);
                params.push(u.username, u.officerName, u.role, u.password, u.territoryId);
            }
            
            const query = `
                INSERT INTO users (username, officer_name, role, password, territory_id) 
                VALUES ${values.join(', ')}
            `;
            await client.query(query, params);
        }
        
        await client.query('COMMIT');
        res.json({ success: true });
    } catch (err) {
        await client.query('ROLLBACK');
        res.status(500).json({ error: err.message });
    } finally {
        client.release();
    }
});

// Bulk Save for Vehicle Performance
app.post('/api/sync-vehicle-perf', async (req, res) => {
    const { data } = req.body;
    const client = await pool.connect();
    try {
        await client.query('BEGIN');
        await client.query("DELETE FROM vehicle_performance");
        if (data && data.length > 0) {
            const values = [];
            const params = [];
            let pIdx = 1;
            for (const v of data) {
                values.push(`($${pIdx++}, $${pIdx++}, $${pIdx++}, $${pIdx++}, $${pIdx++}, $${pIdx++}, $${pIdx++}, $${pIdx++}, $${pIdx++}, $${pIdx++})`);
                params.push(v.customerId, v.customerName, v.model, v.km1, v.km2, v.earning, v.overdueNo, v.overdueAmt, v.extra1, v.extra2);
            }
            await client.query(`
                INSERT INTO vehicle_performance (customer_id, customer_name, model, km1, km2, earning, overdue_no, overdue_amt, extra1, extra2)
                VALUES ${values.join(', ')}
            `, params);
        }
        await client.query('COMMIT');
        res.json({ success: true });
    } catch (err) {
        await client.query('ROLLBACK');
        res.status(500).json({ error: err.message });
    } finally {
        client.release();
    }
});

// Handle Unlocks
app.post('/api/unlock', async (req, res) => {
    const { territoryId, unlockUntil } = req.body;
    try {
        await pool.query(`
            INSERT INTO admin_unlocks (territory_id, unlock_until) VALUES ($1, $2)
            ON CONFLICT (territory_id) DO UPDATE SET unlock_until = EXCLUDED.unlock_until
        `, [territoryId, unlockUntil]);
        res.json({ success: true });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

app.delete('/api/delete', async (req, res) => {
    const { collection, id } = req.body;
    
    // Prevent SQL injection by validating the collection name against known tables
    const validTables = ['collections', 'projections', 'offroad_vehicles', 'settlements'];
    if (!validTables.includes(collection)) {
        return res.status(400).json({ error: "Invalid collection specified for deletion" });
    }

    try {
        await pool.query(`DELETE FROM ${collection} WHERE id = $1`, [id]);
        res.json({ success: true });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

app.listen(port, () => {
    console.log(`Neon Backend running on port ${port}`);
});
