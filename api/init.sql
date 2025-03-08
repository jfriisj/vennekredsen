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
VALUES ('jonfriis', '9a0db62a511cc3a0c3251992d4c373f17ba4b61279d6a9c52290390072d7f891')
ON CONFLICT (username) DO NOTHING;