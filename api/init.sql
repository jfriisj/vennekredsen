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
    password_hash VARCHAR(128) NOT NULL
);

-- Insert admin user with pre-hashed password
-- Password 'Rosa2009' hashed with SHA-256
INSERT INTO admins (username, password_hash) 
VALUES ('jonfriis', '5c99a65f3d32e8bc2fa9086b93162887de716073ef3933cf3bc3e9eee6a1ede6')
ON CONFLICT (username) DO NOTHING;