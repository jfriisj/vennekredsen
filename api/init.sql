CREATE TABLE ansoegninger (
    id SERIAL PRIMARY KEY,
    navn TEXT NOT NULL,
    email TEXT NOT NULL,
    belob INTEGER NOT NULL,
    beskrivelse TEXT NOT NULL,
    oprettet TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
