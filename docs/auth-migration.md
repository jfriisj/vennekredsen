# Authentication migration (MVP 2.0)

This document covers the one-time authentication upgrade introduced for issue #5.

## What changes

- Passwords created or changed by the application are stored with Argon2id.
- Users have one of two roles: `member` or `admin`.
- Users can be active or inactive.
- Existing rows remain in the historical `admins` table to avoid a destructive table rename during the MVP.
- Existing SHA-256 password hashes are accepted only as a migration path. After the first successful login, that password is immediately re-hashed with Argon2id.

## Existing database

After deploying the new API image/code, run the idempotent schema migration once:

```bash
docker compose exec api python migrate_auth_roles.py
```

Existing users are assigned the `admin` role and remain active. The command can safely be run again; already-added columns are detected and skipped.

Then log in once with each existing administrator that should remain usable. A successful login upgrades that account's old password hash to Argon2id.

## Fresh database

No default administrator or password is inserted by `api/init.sql`.

Create the first administrator interactively:

```bash
./dev.sh create-admin
```

The admin email and password must be supplied by the operator. Passwords must be at least 8 characters.

## Login endpoints

- `POST /api/login` accepts active `member` and `admin` users.
- `POST /api/admin/login` accepts active `admin` users and remains compatible with the existing admin frontend.
- `GET /api/me` returns the authenticated user's identity and role.

Admin endpoints reject authenticated members with HTTP 403.
