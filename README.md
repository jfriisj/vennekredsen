# Vennekredsen for Hashøjskolen

Moderne hjemmeside til Vennekredsen for Hashøjskolen.
Projektet indeholder en offentlig hjemmeside, en ansøgningsformular i flere trin og et admin-flow til behandling af ansøgninger.

## Features

- Moderne frontend i HTML/CSS/JavaScript med responsivt design
- Wizard-baseret ansøgningsformular med trinvis validering
- Admin-login med JWT og beskyttede admin-endpoints
- Administration af ansøgninger, admin-brugere og årlige event-datoer
- Offentlig visning af godkendte projekter uden persondata
- Docker-baseret udvikling, test og deployment

## Arkitektur

- Frontend: statiske sider i `frontend/html/`, serveret af Nginx
- Backend: Flask API i `api/app.py` med SQLAlchemy
- Database: PostgreSQL 15 med schema-init fra `api/init.sql`
- Lokal drift: `docker-compose.local.yml` (build fra lokale Dockerfiles)
- Produktion: `docker-compose.yml` (prebuildede images fra GHCR)

## Quick Start (Udvikling)

Forudsat at du har Docker og `docker-compose` installeret.

```bash
# Clone repository
git clone https://github.com/jfriisj/vennekredsen.git
cd vennekredsen

# Start lokal udvikling
./dev.sh start

# Opret første admin-bruger
./dev.sh create-admin
```

Bemærk: Hvis `.env.dev.local` mangler, opretter `dev.sh` den automatisk ud fra `.env.dev`.

Adresser lokalt:

- Frontend: `http://localhost:85`
- API: `http://localhost:5000`
- Admin login: `http://localhost:85/admin-login.html`
- Admin panel: `http://localhost:85/admin-panel.html`

## Dev-kommandoer

```bash
./dev.sh start        # Start services
./dev.sh stop         # Stop services
./dev.sh restart      # Restart services
./dev.sh logs         # Logs fra alle services
./dev.sh logs-api     # Kun API logs
./dev.sh logs-db      # Kun database logs
./dev.sh shell-api    # Shell i API container
./dev.sh shell-db     # psql shell i database container
./dev.sh test         # Kør API tests i container
./dev.sh build        # Rebuild services
./dev.sh clean        # Stop + fjern volumes + rebuild
./dev.sh tools        # Start inkl. pgAdmin på http://localhost:5050
./dev.sh status       # Vis container-status
```

## Code Quality

Korte kommandoer via `Makefile`:

```bash
make check-quality
make check-api
make check-frontend
make fix-format
```

Direkte scripts:

```bash
./scripts/check-all-quality.sh
./scripts/check-api-quality.sh
./scripts/check-frontend-quality.sh
./scripts/fix-api-format.sh
./scripts/fix-frontend-format.sh
```

API-quality checks inkluderer Black, isort, Flake8, Bandit og Safety.
Frontend-quality checks inkluderer ESLint, Prettier, html-validate og Stylelint.

## Testing

```bash
# Hurtigste vej
./dev.sh test

# Eller direkte i api/
cd api
python -m pytest -v --cov=. --cov-report=html --cov-report=xml
```

Coverage-rapport genereres i `api/htmlcov/index.html`.

## Miljøvariabler

Udvikling:

- Template: `.env.dev`
- Lokal override: `.env.dev.local`
- `dev.sh` bruger `--env-file .env.dev.local`

Produktion (`.env.local`):

```bash
POSTGRES_DB=vennekredsen_prod
POSTGRES_USER=vennekredsen_user
POSTGRES_PASSWORD=<stærkt-password>
JWT_SECRET=<lang-random-secret>
INTERNAL_TOKEN=<cloudflare-tunnel-token>
```

## Produktion

`docker-compose.yml` peger pa GHCR-image-tags (`ghcr.io/jfriisj/vennekredsen/...`) og kan samtidig bygges lokalt med `--build`.

```bash
# Start produktion med lokale miljovariabler
docker compose --env-file .env.local -f docker-compose.yml up -d

# Tving lokal rebuild af API/frontend (fx efter Dockerfile-ændringer)
docker compose --env-file .env.local -f docker-compose.yml up -d --build
```

## API Overblik

Offentlige endpoints:

- `POST /api/ansoegning` opretter en ny ansøgning
- `GET /api/events` returnerer datoer for årlige events
- `GET /api/approved-projects` returnerer godkendte projekter uden persondata

Admin endpoints (kræver Bearer JWT):

- `POST /api/admin/login`
- `GET /api/admin/ansoegninger`
- `PUT /api/admin/ansoegning/<id>/status`
- `DELETE /api/admin/ansoegning/<id>`
- `GET /api/admin/users`
- `POST /api/admin/users`
- `DELETE /api/admin/users/<user_id>`
- `PUT /api/admin/change-password`
- `GET /api/admin/events`
- `PUT /api/admin/events`

## CI/CD

Workflows i `.github/workflows/`:

- `code-quality.yml`: Python/frontend quality, tests, Trivy og Hadolint
- `docker-build-push.yml`: build af frontend/API images og push til GHCR på `main`

## Projektstruktur

```text
.
|- api/
|  |- app.py
|  |- create_admin.py
|  |- init.sql
|  |- requirements.txt
|  |- requirements-dev.txt
|  `- tests/
|- frontend/
|  |- html/
|  |- nginx.conf
|  `- package.json
|- scripts/
|  |- check-all-quality.sh
|  |- check-api-quality.sh
|  |- check-frontend-quality.sh
|  |- fix-api-format.sh
|  `- fix-frontend-format.sh
|- dev.sh
|- docker-compose.local.yml
|- docker-compose.yml
`- Makefile
```

## Troubleshooting

- Hvis DB-password i `.env.dev.local` er ændret, men data-volumen er gammel:
  - Kør SQL i databasen: `ALTER ROLE dev_user WITH PASSWORD '<ny_password>';`

## Contributing

```bash
# Opret branch
git checkout -b feature/min-ændring

# Kør checks
make check-quality

# Commit og push
git commit -m "feat: beskrivelse"
git push origin feature/min-ændring
```

Alle PRs skal bestå quality checks i CI.

## License

Projektet er licenseret under MIT License.

## Support

- Project Owner: [jfriisj](https://github.com/jfriisj)
- Issues: [GitHub Issues](https://github.com/jfriisj/vennekredsen/issues)
