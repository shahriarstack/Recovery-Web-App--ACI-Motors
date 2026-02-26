-- SQL Schema for Recovery WebApp

-- Users table
CREATE TABLE IF NOT EXISTS users (
    id SERIAL PRIMARY KEY,
    username VARCHAR(100) UNIQUE NOT NULL,
    officer_name VARCHAR(255),
    role VARCHAR(20) DEFAULT 'officer',
    password VARCHAR(255) NOT NULL,
    territory_id VARCHAR(50)
);

-- Territories table
CREATE TABLE IF NOT EXISTS territories (
    id VARCHAR(50) PRIMARY KEY,
    name VARCHAR(255) NOT NULL,
    part CHAR(1) NOT NULL,
    officer VARCHAR(100)
);

-- Targets table
CREATE TABLE IF NOT EXISTS targets (
    id SERIAL PRIMARY KEY,
    territory_id VARCHAR(50) REFERENCES territories(id) ON DELETE CASCADE,
    month VARCHAR(7) NOT NULL, -- Format: YYYY-MM
    files INT DEFAULT 0,
    proj_files INT DEFAULT 0,
    amount DECIMAL(15, 2) DEFAULT 0,
    proj_reg DECIMAL(15, 2) DEFAULT 0,
    proj_adv DECIMAL(15, 2) DEFAULT 0,
    lm_np_target_amount DECIMAL(15, 2) DEFAULT 0,
    lm_np_target_files INT DEFAULT 0,
    total_od DECIMAL(15, 2) DEFAULT 0,
    od_growth_sply DECIMAL(5, 2) DEFAULT 0,
    per_file_od DECIMAL(15, 2) DEFAULT 0,
    six_plus_od_files INT DEFAULT 0,
    six_plus_od_growth_splm DECIMAL(5, 2) DEFAULT 0,
    UNIQUE(territory_id, month)
);

-- Projections table
CREATE TABLE IF NOT EXISTS projections (
    id SERIAL PRIMARY KEY,
    territory_id VARCHAR(50) REFERENCES territories(id) ON DELETE CASCADE,
    date DATE NOT NULL,
    regular_amount DECIMAL(15, 2) DEFAULT 0,
    advance_amount DECIMAL(15, 2) DEFAULT 0,
    amount DECIMAL(15, 2) DEFAULT 0,
    file_count INT DEFAULT 0,
    UNIQUE(territory_id, date)
);

-- Collections history table
CREATE TABLE IF NOT EXISTS collections (
    id SERIAL PRIMARY KEY,
    territory_id VARCHAR(50) REFERENCES territories(id) ON DELETE CASCADE,
    date DATE NOT NULL,
    customer_code VARCHAR(100),
    file_id VARCHAR(100),
    customer_name VARCHAR(255),
    receipt VARCHAR(100),
    amount DECIMAL(15, 2) NOT NULL,
    regular_amount DECIMAL(15, 2) DEFAULT 0,
    advance_amount DECIMAL(15, 2) DEFAULT 0,
    mode VARCHAR(50),
    is_lm_np BOOLEAN DEFAULT FALSE,
    timestamp BIGINT
);

-- Offroad Vehicles Monitor table
CREATE TABLE IF NOT EXISTS offroad_vehicles (
    id SERIAL PRIMARY KEY,
    territory_id VARCHAR(50) REFERENCES territories(id) ON DELETE CASCADE,
    customer_code VARCHAR(100),
    reason VARCHAR(100),
    location VARCHAR(255),
    remarks TEXT,
    in_date DATE NOT NULL,
    solve_date DATE,
    status VARCHAR(20) DEFAULT 'Active' -- Active / Solved
);

-- Settlements & Early Closures table
CREATE TABLE IF NOT EXISTS settlements (
    id SERIAL PRIMARY KEY,
    territory_id VARCHAR(50) REFERENCES territories(id) ON DELETE CASCADE,
    date DATE NOT NULL,
    customer_code VARCHAR(100),
    type VARCHAR(50), -- Early Settlement / Credit Note / etc.
    amount DECIMAL(15, 2) NOT NULL,
    remarks TEXT
);

-- Admin Unlocks table
CREATE TABLE IF NOT EXISTS admin_unlocks (
    territory_id VARCHAR(50) PRIMARY KEY REFERENCES territories(id) ON DELETE CASCADE,
    unlock_until BIGINT NOT NULL
);

-- Vehicle Performance table
CREATE TABLE IF NOT EXISTS vehicle_performance (
    id SERIAL PRIMARY KEY,
    customer_id VARCHAR(100) UNIQUE NOT NULL,
    customer_name VARCHAR(255),
    model VARCHAR(100),
    km1 DECIMAL(15, 2),
    km2 DECIMAL(15, 2),
    earning DECIMAL(15, 2),
    overdue_no INT,
    overdue_amt DECIMAL(15, 2),
    extra1 TEXT,
    extra2 TEXT
);

-- Seed Initial User if not exists
INSERT INTO users (username, officer_name, role, password) 
VALUES ('admin', 'System Admin', 'admin', '1234')
ON CONFLICT (username) DO NOTHING;
