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
    password_hash VARCHAR(128) NOT NULL
);

CREATE TABLE event_dates (
    event_key VARCHAR(50) PRIMARY KEY,
    event_datetime TIMESTAMP NOT NULL,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Insert admin user with pre-hashed password
-- Password 'Rosa2009' hashed with SHA-256
INSERT INTO admins (username, email, password_hash) 
VALUES ('admin', 'admin@vennekredsen.local', '9a0db62a511cc3a0c3251992d4c373f17ba4b61279d6a9c52290390072d7f891');

INSERT INTO event_dates (event_key, event_datetime)
VALUES
    ('sommerfest', '2026-09-18 18:00:00'),
    ('julefest', '2026-11-27 17:30:00'),
    ('fastelavn', '2027-02-05 17:30:00');
