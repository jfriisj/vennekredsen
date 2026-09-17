# AI-assistent instruktioner

## Formål

Denne fil beskriver, hvordan en AI-assistent skal arbejde med dette repository. GitHub skal bruges som **source of truth** for committed kode, issues, pull requests, CI og dokumentation.

Læs først:

- `README.md` for projektets formål og drift
- `docs/DEVELOPMENT_WORKFLOW.md` for arbejds- og valideringsflow
- `docs/CODE_QUALITY.md` for quality gates og værktøjer
- det relevante GitHub issue for acceptance criteria
- den aktuelle feature branch/PR, hvis arbejdet allerede er startet

Repository: `jfriisj/vennekredsen`

## GitHub først

Hvis information findes i GitHub, skal den læses direkte derfra. Bed ikke brugeren kopiere repo-filer, issue-tekst, PR-diff eller CI-output ind i chatten, medmindre informationen kun findes lokalt.

Ved konflikt mellem samtalekontekst, antagelser og repository-indhold skal GitHub-indholdet vægte højest.

Brug `main` som baseline, medmindre et aktivt issue/PR bevidst arbejdes på en feature branch.

## GitHub vs. lokal working tree

GitHub er source of truth for committed/pushed kode. Lokal working tree er source of truth for ikke-pushede ændringer.

Bed kun brugeren kontrollere lokale filer/diffs, når lokale ændringer kan afvige fra GitHub. Foretræk små checks:

```bash
git status --short
```

eller:

```bash
git diff
```

Bed ikke om hele filer uden behov.

## Issue-baseret arbejde

For implementeringsopgaver:

1. Læs issue og acceptance criteria direkte på GitHub.
2. Inspicér relevant kode, arkitektur, branch og PR-status.
3. Afgræns den mindste komplette implementation.
4. Hold arbejdet på en fokuseret feature branch.
5. Lav kode og tests.
6. Følg `docs/DEVELOPMENT_WORKFLOW.md`.
7. Brug quality gates fra `docs/CODE_QUALITY.md`.
8. Merge først når relevant lokal validation og CI er grøn.
9. Verificér efter merge, at issue er lukket og eventuel tracker/status er opdateret.

Bland ikke senere eller unrelated issues ind uden behov for acceptance criteria.

## Arbejdsdeling

AI-assistenten skal som udgangspunkt selv:

- læse og ændre repository-indhold via GitHub
- analysere issues, PR'er, diffs, reviews og CI
- implementere rettelser på feature branch
- tilføje/opdatere tests
- analysere brugerens lokale validation-output
- rette fundne fejl direkte i GitHub

Brugeren bruges primært til lokal validation:

- `git pull`
- Docker Compose og runtime
- backend/frontend tests
- browser/Playwright/manual UI
- database/persistence
- lokale credentials
- hardware/netværk
- ikke-pushede ændringer

Målet er, at brugeren ikke fungerer som manuel mellemmand mellem AI-assistenten og GitHub.

## Validation

Følg normalt:

**code → targeted validation → quality gates → integration/browser → full regression → PR/CI**

Kør små, målrettede tests først og fail fast. Hvis en nødvendig test fejler, ret fejlen før bredere validation.

Undgå skjulte fallbacks, `|| true`, irrelevante skips eller mocks, der får defekt funktionalitet til at se grøn ud.

Issue acceptance criteria bestemmer den endelige validation.

Ved fejlsøgning: giv helst **én konkret lokal kommando ad gangen**. Antag at brugeren allerede står i repository-mappen, medmindre andet fremgår.

## Git og Docker

Før PR/merge bør working tree kontrolleres med:

```bash
git status --short
```

Kontrollér at genererede reports, test-results, screenshots, secrets og lokale `.env`-filer ikke utilsigtet stages.

Undgå destruktive Git-kommandoer uden klart behov.

Slet ikke persistente Docker-volumes som standard. Brug ikke:

```bash
docker compose down -v
```

medmindre datatab/reset udtrykkeligt er ønsket.

## Kommunikation

Svar på dansk, medmindre brugeren ønsker andet.

Vær kort og konkret. Forklar kort hvad der verificeres nu, brug GitHub-data direkte, og bed kun om lokal handling når det lokale miljø faktisk er nødvendigt.

Fortsæt ikke på antagelser, hvis repository, issue, PR eller CI kan give et sikkert svar.