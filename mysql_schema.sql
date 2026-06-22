-- MySQL Schema for Recovery WebApp

-- 1. Territories table (needed first for foreign key references)
CREATE TABLE IF NOT EXISTS territories (
    id VARCHAR(50) PRIMARY KEY,
    name VARCHAR(255) NOT NULL,
    part CHAR(1) NOT NULL,
    officer VARCHAR(100)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- 2. Users table
CREATE TABLE IF NOT EXISTS users (
    id INT AUTO_INCREMENT PRIMARY KEY,
    username VARCHAR(100) UNIQUE NOT NULL,
    officer_name VARCHAR(255),
    role VARCHAR(20) DEFAULT 'officer',
    password VARCHAR(255) NOT NULL,
    territory_id VARCHAR(1000)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- Seed default admin user
INSERT INTO users (username, officer_name, role, password) 
VALUES ('admin', 'System Admin', 'admin', '1234')
ON DUPLICATE KEY UPDATE username=username;

-- 3. Targets table
CREATE TABLE IF NOT EXISTS targets (
    id INT AUTO_INCREMENT PRIMARY KEY,
    territory_id VARCHAR(50),
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
    UNIQUE KEY territory_month (territory_id, month),
    CONSTRAINT fk_targets_territory FOREIGN KEY (territory_id) REFERENCES territories(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- 4. Projections table
CREATE TABLE IF NOT EXISTS projections (
    id INT AUTO_INCREMENT PRIMARY KEY,
    territory_id VARCHAR(50),
    `date` DATE NOT NULL,
    regular_amount DECIMAL(15, 2) DEFAULT 0,
    advance_amount DECIMAL(15, 2) DEFAULT 0,
    amount DECIMAL(15, 2) DEFAULT 0,
    file_count INT DEFAULT 0,
    active_month VARCHAR(7),
    `timestamp` BIGINT,
    UNIQUE KEY territory_date (territory_id, `date`),
    CONSTRAINT fk_projections_territory FOREIGN KEY (territory_id) REFERENCES territories(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- 5. Collections history table
CREATE TABLE IF NOT EXISTS collections (
    id INT AUTO_INCREMENT PRIMARY KEY,
    territory_id VARCHAR(50),
    `date` DATE NOT NULL,
    customer_code VARCHAR(100),
    file_id VARCHAR(100),
    customer_name VARCHAR(255),
    receipt VARCHAR(100),
    amount DECIMAL(15, 2) NOT NULL,
    regular_amount DECIMAL(15, 2) DEFAULT 0,
    advance_amount DECIMAL(15, 2) DEFAULT 0,
    `mode` VARCHAR(50),
    is_lm_np BOOLEAN DEFAULT FALSE,
    `timestamp` BIGINT,
    active_month VARCHAR(7),
    CONSTRAINT fk_collections_territory FOREIGN KEY (territory_id) REFERENCES territories(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- 6. Offroad Vehicles Monitor table
CREATE TABLE IF NOT EXISTS offroad_vehicles (
    id INT AUTO_INCREMENT PRIMARY KEY,
    territory_id VARCHAR(50),
    customer_code VARCHAR(100),
    reason VARCHAR(100),
    location VARCHAR(255),
    remarks TEXT,
    in_date DATE NOT NULL,
    solve_date DATE,
    `status` VARCHAR(20) DEFAULT 'Active',
    CONSTRAINT fk_offroad_vehicles_territory FOREIGN KEY (territory_id) REFERENCES territories(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- 7. Settlements & Early Closures table
CREATE TABLE IF NOT EXISTS settlements (
    id INT AUTO_INCREMENT PRIMARY KEY,
    territory_id VARCHAR(50),
    `date` DATE NOT NULL,
    customer_code VARCHAR(100),
    `type` VARCHAR(50),
    amount DECIMAL(15, 2) NOT NULL,
    remarks TEXT,
    CONSTRAINT fk_settlements_territory FOREIGN KEY (territory_id) REFERENCES territories(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- 8. Admin Unlocks table
CREATE TABLE IF NOT EXISTS admin_unlocks (
    territory_id VARCHAR(50) PRIMARY KEY,
    unlock_until BIGINT NOT NULL,
    CONSTRAINT fk_unlocks_territory FOREIGN KEY (territory_id) REFERENCES territories(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- 9. Vehicle Performance table
CREATE TABLE IF NOT EXISTS vehicle_performance (
    id INT AUTO_INCREMENT PRIMARY KEY,
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
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- 10. System settings table
CREATE TABLE IF NOT EXISTS system_settings (
    `key` VARCHAR(255) PRIMARY KEY,
    `value` TEXT
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
