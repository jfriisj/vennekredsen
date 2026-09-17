CREATE TABLE ansoegninger (
    id SERIAL PRIMARY KEY,
    navn TEXT NOT NULL,
    email TEXT NOT NULL,
    belob INTEGER NOT NULL,
    beskrivelse TEXT NOT NULL,
    oprettet TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    status VARCHAR(20) DEFAULT 'pending'
);

CREATE TABLE admins (
    id SERIAL PRIMARY KEY,
    username VARCHAR(50) UNIQUE NOT NULL,
    email VARCHAR(120) UNIQUE NOT NULL,
    password_hash VARCHAR(255) NOT NULL,
    role VARCHAR(20) NOT NULL DEFAULT 'member',
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    CONSTRAINT admins_role_check CHECK (role IN ('member', 'admin'))
);

CREATE TABLE event_dates (
    event_key VARCHAR(50) PRIMARY KEY,
    event_datetime TIMESTAMP NOT NULL,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE inventory_items (
    id SERIAL PRIMARY KEY,
    name VARCHAR(160) NOT NULL,
    normalized_name VARCHAR(160) UNIQUE NOT NULL,
    category VARCHAR(100) NOT NULL,
    unit VARCHAR(50) NOT NULL,
    default_store VARCHAR(120) NOT NULL DEFAULT '',
    stock_quantity DOUBLE PRECISION NOT NULL DEFAULT 0,
    note TEXT NOT NULL DEFAULT '',
    active BOOLEAN NOT NULL DEFAULT TRUE,
    last_counted_at TIMESTAMP NULL,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE site_settings (
    id INTEGER PRIMARY KEY,
    hero_heading VARCHAR(120) NOT NULL,
    hero_subheading VARCHAR(500) NOT NULL,
    intro_text VARCHAR(1000) NOT NULL,
    announcement_text VARCHAR(500) NOT NULL DEFAULT '',
    announcement_visible BOOLEAN NOT NULL DEFAULT FALSE,
    updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- No default administrator is inserted here.
-- Create the first admin interactively with: ./dev.sh create-admin

INSERT INTO event_dates (event_key, event_datetime)
VALUES
    ('sommerfest', '2026-09-18 18:00:00'),
    ('julefest', '2026-11-27 17:30:00'),
    ('fastelavn', '2027-02-05 17:30:00');
