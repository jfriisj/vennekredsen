# Troubleshooting

## Services starter ikke

Kontrollér først:

```bash
./dev.sh status
```

og derefter:

```bash
./dev.sh logs
```

API-only:

```bash
./dev.sh logs-api
```

Database-only:

```bash
./dev.sh logs-db
```

## Database-password er ændret

Hvis en eksisterende PostgreSQL-volume blev oprettet med et andet password, ændrer en ny env-værdi ikke automatisk den eksisterende databasebruger.

Ret rollen i databasen eller genopret databasen bevidst. Slet ikke volumes som første fejlsøgningstrin.

## Login virker ikke efter auth-opgradering

For eksisterende installationer, kontrollér om auth migrationen er kørt:

```bash
docker compose exec api python migrate_auth_roles.py
```

Se også [[Security and Authentication]].

## Frontend kan ikke nå API

Kontrollér:

- at `api`-containeren kører
- Nginx-log
- API-log
- at requesten går gennem `/api/`

## Wiki-validering fejler

Kør:

```bash
python tools/publish_wiki.py --verify-only
```

Validatoren fejler hvis obligatoriske sider mangler, eller et internt GitHub Wiki-link peger på en side, som ikke findes i `wiki/`.
