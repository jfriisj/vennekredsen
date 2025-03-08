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

