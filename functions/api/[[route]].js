import { Pool } from '@neondatabase/serverless';

export async function onRequest(context) {
    const { request, env } = context;
    const url = new URL(request.url);
    const path = url.pathname;

    // Ignore non-API routes if accidentally hit this worker
    if (!path.startsWith('/api')) {
        return env.ASSETS.fetch(request);
    }

    // Set up Neon Database Pool using environment variables that you'll configure in Cloudflare manually
    const pool = new Pool({ connectionString: env.DATABASE_URL });

    try {
        // --- GET DB STATE ---
        if (request.method === 'GET' && path === '/api/db') {
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

            return new Response(JSON.stringify({
                users: users.rows,
                territories: territories.rows,
                targets: targets.rows,
                projections: projections.rows,
                collections: collections.rows,
                offroad_vehicles: offroad_vehicles.rows,
                settlements: settlements.rows,
                unlocks: unlocks,
                vehicle_performance: vehicle_performance.rows
            }), {
                headers: { 'Content-Type': 'application/json' }
            });
        }

        // --- UPDATE OR CREATE ITEM ---
        if (request.method === 'POST' && path === '/api/update') {
            const { collection, item } = await request.json();
            const table = collection;

            const keys = Object.keys(item).filter(k => k !== 'id');
            const values = keys.map(k => item[k]);

            if (item.id && !String(item.id).startsWith('new_')) {
                const setClause = keys.map((k, i) => `${k} = $${i + 1}`).join(', ');
                await pool.query(`UPDATE ${table} SET ${setClause} WHERE id = $${keys.length + 1}`, [...values, item.id]);
                return new Response(JSON.stringify(item), { headers: { 'Content-Type': 'application/json' } });
            } else {
                const columns = keys.join(', ');
                const placeholders = keys.map((_, i) => `$${i + 1}`).join(', ');
                const result = await pool.query(`INSERT INTO ${table} (${columns}) VALUES (${placeholders}) RETURNING id`, values);
                item.id = result.rows[0].id;
                return new Response(JSON.stringify(item), { headers: { 'Content-Type': 'application/json' } });
            }
        }

        // --- DELETE ITEM ---
        if (request.method === 'DELETE' && path === '/api/delete') {
            const { collection, id } = await request.json();
            await pool.query(`DELETE FROM ${collection} WHERE id = $1`, [id]);
            return new Response(JSON.stringify({ success: true }), { headers: { 'Content-Type': 'application/json' } });
        }

        // --- SYNC TARGETS ---
        if (request.method === 'POST' && path === '/api/sync-targets') {
            const { territories, targets } = await request.json();
            // Serverless Neon doesn't easily maintain long explicit transactions, but we can do sequential queries
            await pool.query('BEGIN');
            try {
                for (const t of territories) {
                    await pool.query(`
                        INSERT INTO territories (id, name, part, officer) 
                        VALUES ($1, $2, $3, $4)
                        ON CONFLICT (id) DO UPDATE SET name = EXCLUDED.name, part = EXCLUDED.part, officer = EXCLUDED.officer
                    `, [t.id, t.name, t.part, t.officer]);
                }
                for (const t of targets) {
                    await pool.query(`
                        INSERT INTO targets (territory_id, month, files, proj_files, amount, proj_reg, proj_adv, lm_np_target_amount, lm_np_target_files, total_od, od_growth_sply, per_file_od, six_plus_od_files, six_plus_od_growth_splm)
                        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14)
                        ON CONFLICT (territory_id, month) DO UPDATE SET 
                            files = EXCLUDED.files, proj_files = EXCLUDED.proj_files, amount = EXCLUDED.amount,
                            proj_reg = EXCLUDED.proj_reg, proj_adv = EXCLUDED.proj_adv, lm_np_target_amount = EXCLUDED.lm_np_target_amount,
                            lm_np_target_files = EXCLUDED.lm_np_target_files, total_od = EXCLUDED.total_od, od_growth_sply = EXCLUDED.od_growth_sply,
                            per_file_od = EXCLUDED.per_file_od, six_plus_od_files = EXCLUDED.six_plus_od_files, six_plus_od_growth_splm = EXCLUDED.six_plus_od_growth_splm
                    `, [t.territory_id, t.month, t.files, t.proj_files, t.amount, t.proj_reg, t.proj_adv, t.lm_np_target_amount, t.lm_np_target_files, t.total_od, t.od_growth_sply, t.per_file_od, t.six_plus_od_files, t.six_plus_od_growth_splm]);
                }
                await pool.query('COMMIT');
                return new Response(JSON.stringify({ success: true }), { headers: { 'Content-Type': 'application/json' } });
            } catch (err) {
                await pool.query('ROLLBACK');
                throw err;
            }
        }

        // --- SYNC USERS ---
        if (request.method === 'POST' && path === '/api/sync-users') {
            const { users } = await request.json();
            await pool.query('BEGIN');
            try {
                await pool.query("DELETE FROM users WHERE role = 'officer'");
                for (const u of users) {
                    if (u.role === 'officer') {
                        await pool.query(`INSERT INTO users (username, officer_name, role, password, territory_id) VALUES ($1, $2, $3, $4, $5)`,
                            [u.username, u.officerName, u.role, u.password, u.territoryId]);
                    }
                }
                await pool.query('COMMIT');
                return new Response(JSON.stringify({ success: true }), { headers: { 'Content-Type': 'application/json' } });
            } catch (err) {
                await pool.query('ROLLBACK');
                throw err;
            }
        }

        // --- SYNC VEHICLE PERFORMANCE ---
        if (request.method === 'POST' && path === '/api/sync-vehicle-perf') {
            const { data } = await request.json();
            await pool.query('BEGIN');
            try {
                await pool.query("DELETE FROM vehicle_performance");
                for (const v of data) {
                    await pool.query(`
                        INSERT INTO vehicle_performance (customer_id, customer_name, model, km1, km2, earning, overdue_no, overdue_amt, extra1, extra2)
                        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
                    `, [v.customerId, v.customerName, v.model, v.km1, v.km2, v.earning, v.overdueNo, v.overdueAmt, v.extra1, v.extra2]);
                }
                await pool.query('COMMIT');
                return new Response(JSON.stringify({ success: true }), { headers: { 'Content-Type': 'application/json' } });
            } catch (err) {
                await pool.query('ROLLBACK');
                throw err;
            }
        }

        // --- ADMIN UNLOCK ---
        if (request.method === 'POST' && path === '/api/unlock') {
            const { territoryId, unlockUntil } = await request.json();
            await pool.query(`
                INSERT INTO admin_unlocks (territory_id, unlock_until) VALUES ($1, $2)
                ON CONFLICT (territory_id) DO UPDATE SET unlock_until = EXCLUDED.unlock_until
            `, [territoryId, unlockUntil]);
            return new Response(JSON.stringify({ success: true }), { headers: { 'Content-Type': 'application/json' } });
        }

        return new Response('API Not Found', { status: 404 });
    } catch (error) {
        console.error('API Error:', error);
        return new Response(JSON.stringify({ error: error.message }), {
            status: 500,
            headers: { 'Content-Type': 'application/json' }
        });
    }
}
