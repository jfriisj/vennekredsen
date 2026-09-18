# Deployment and Operations

## Produktionsstack

`docker-compose.yml` definerer frontend/Nginx, Flask API, PostgreSQL 15 og Cloudflare Tunnel.

Frontend og API kan både bygges lokalt og anvende de GHCR-images, der er angivet i Compose-filen.

## Miljøfil

Start fra repositoryets eksempel:

```bash
cp .env.example .env.local
```

Sæt mindst stærke, installationsspecifikke værdier for:

- `POSTGRES_PASSWORD`
- `JWT_SECRET`
- `INTERNAL_TOKEN` når Cloudflare Tunnel bruges

Eksempelværdier og fallback-værdier i repositoryet er ikke produktionshemmeligheder og må ikke anvendes som reelle secrets.

## Start

```bash
docker compose --env-file .env.local -f docker-compose.yml up -d
```

## Persistence

PostgreSQL bruger named volume `db_data`.

En normal container recreation må ikke slette dette volume.

Undgå derfor:

```bash
docker compose down -v
```

medmindre et bevidst databasereset er ønsket.

## Upgrade

En normal opdatering er konceptuelt:

```bash
git pull
docker compose --env-file .env.local -f docker-compose.yml up -d --build
```

Ved releases med migrationscripts skal den relevante migration køres efter dokumentationen for ændringen.

## Backup og restore

Endelig produktionsvalidering af backup/restore spores i MVP deployment-issue #10.

Indtil #10 er afsluttet bør backup/restore-procedurer ikke betragtes som release-verificerede alene fordi de er beskrevet.

## Health

PostgreSQL har Compose healthcheck, og API-servicen venter på en healthy database før opstart.

Efter deployment skal de faktiske public/member/admin flows valideres gennem Nginx-routingen.
