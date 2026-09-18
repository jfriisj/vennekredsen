# Getting Started

## Forudsætninger

- Git
- Docker med Docker Compose
- en ledig lokal frontend-port (standard `85`)
- en ledig lokal API-port (standard `5000`)

## Lokal udvikling

```bash
git clone https://github.com/jfriisj/vennekredsen.git
cd vennekredsen
./dev.sh start
```

Hvis `.env.dev.local` ikke findes, opretter `dev.sh` den ud fra `.env.dev`.

Lokale adresser:

- frontend: `http://localhost:85`
- API: `http://localhost:5000`
- member login: `http://localhost:85/member-login.html`
- admin login: `http://localhost:85/admin-login.html`

## Første administrator

En frisk database opretter ikke en standardadministrator.

```bash
./dev.sh create-admin
```

Kommandoen kører det interaktive script i API-containeren.

## Nyttige kommandoer

```bash
./dev.sh status
./dev.sh logs
./dev.sh test
make check-quality
make check-wiki
```

`./dev.sh clean` sletter Docker-volumes og dermed lokal persistent data. Brug den kun når et bevidst reset er ønsket.

Se [[Development]] og [[Testing and Quality]] for den normale arbejds- og valideringsproces.
