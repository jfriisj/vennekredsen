# Features

Denne side beskriver funktioner, som findes på den aktuelle `main`-branch. Planlagte GitHub issues er ikke dokumenteret som implementerede funktioner.

## Offentlig hjemmeside

Den offentlige del omfatter blandt andet:

- forside
- information om Vennekredsen
- tilmelding
- støtteansøgning
- kommende events
- visning af godkendte/støttede projekter
- dynamisk hjemmesideindhold og site-media

## Støtteansøgninger

Besøgende kan sende støtteansøgninger gennem webformularen. Autentificerede brugere kan arbejde med ansøgninger gennem de beskyttede flows, mens administrative handlinger kræver de relevante rettigheder.

## Medlemsområde

`member` og `admin` kan logge ind i det beskyttede medlemsområde. Medlemsområdet fungerer som indgang til interne ressourcer.

## Inventory

Inventory er et fælles varekatalog med blandt andet varenavn, kategori, enhed, standardbutik, lagerantal, noter, aktiv/arkiveret status og tidspunkt for seneste optælling.

Det understøtter søgning, filtre, lageroptælling, import, arkivering og permanent sletning af allerede arkiverede varer.

## Indkøbsberegner

Der findes en beskyttet indkøbsberegner, som er tilgængelig fra medlemsområdet.

Den nuværende implementering og dens tests er source of truth. Videreudvikling af en inventory-baseret version spores separat i GitHub Issues.

## Administration og redigerbart indhold

Admin-funktionerne omfatter blandt andet brugeradministration, ansøgningsadministration, events, redigerbart hjemmesideindhold og site-media.

## Testdækning

Frontendens Playwright-suite indeholder flows for offentlige sider, medlemsområde, inventory, indkøbsberegner, admin-indhold, site-media og visual audit.
