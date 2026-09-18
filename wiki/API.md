# API

API'et er et Flask-API eksponeret under `/api/`.

Denne side er et navigations-overblik, ikke en erstatning for kode og tests.

## Offentlige områder

Den aktuelle API indeholder offentlige endpoints til blandt andet:

- oprettelse af støtteansøgning
- events
- godkendte projekter
- offentlige site settings
- offentligt site-media
- login

## Autentificerede member-områder

Bearer-token bruges til beskyttede endpoints.

Autentificerede områder omfatter blandt andet aktuel brugeridentitet via `/api/me`, medlemsressourcer og inventory-endpoints under `/api/inventory/*`.

Inventory understøtter blandt andet list/create/update, lageropdatering, aktiv/arkiveret status, permanent sletning af arkiverede varer og import.

## Admin-områder

Admin-only endpoints omfatter blandt andet admin-login til kompatibilitet med admin-frontenden, brugeradministration, events, ansøgningsadministration, redigerbart website-indhold og site-media administration.

Admin-authorization håndhæves server-side; et gyldigt member-token giver ikke automatisk admin-adgang.

## Routing

Nginx proxyer `/api/` til Flask-servicen på det interne Docker-netværk.

Ved ændringer i API-kontrakten skal kode og automatiske tests betragtes som autoritative, og denne side opdateres sammen med ændringen.
