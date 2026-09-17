# GitHub-baseret udviklings- og valideringsworkflow

## Formål

Dette workflow beskriver en generisk arbejdsform, hvor GitHub er source of truth for committed kode, issues, pull requests og CI, mens den lokale working tree bruges til runtime-, Docker-, browser- og integrationsvalidering.

Målet er at minimere manuel overførsel af kode og samtidig bevare en klar kontrol mellem implementation, validation og merge.

## Ansvarsfordeling

### AI-assistenten

AI-assistenten skal som udgangspunkt:

- læse issues, acceptance criteria, kode, branches, PR'er og CI direkte fra GitHub
- implementere ændringer på en fokuseret feature branch
- tilføje eller opdatere tests sammen med funktionaliteten
- analysere lokalt testoutput og rette fejl i GitHub
- kontrollere PR-diff, review, CI, merge og issue closure
- undgå at bede brugeren kopiere repository-filer, som allerede kan læses fra GitHub

### Udvikleren

Udvikleren bruges primært til ting, der kræver det lokale miljø:

- `git pull`
- Docker og lokale services
- automatiske tests og quality gates
- browser- og integrationstest
- lokale credentials og databaseindhold
- ikke-pushede ændringer
- manuel/visuel validation

Udvikleren skal ikke fungere som manuel transportør af repository-filer mellem GitHub og AI-assistenten.

## Source of truth

For committed/pushed kode er GitHub autoritativ.

Ved konflikt mellem tidligere samtalekontekst, antagelser og repository-indhold skal repository-indholdet vægte højest.

Den lokale working tree er kun source of truth for ikke-pushede lokale ændringer. Brug små checks som:

```bash
git status --short
```

eller:

```bash
git diff
```

når der er risiko for forskel mellem lokal branch og remote.

## Issue-baseret arbejde

For hvert implementeringsissue:

1. Læs issue og acceptance criteria på GitHub.
2. Inspicér eksisterende implementation og arkitektur.
3. Kontrollér relevante branches og PR'er.
4. Brug `main` som baseline, medmindre arbejdet allerede foregår på en feature branch.
5. Afgræns den mindste komplette implementation.
6. Arbejd på en dedikeret feature branch.
7. Bland ikke unrelated eller senere issues ind uden behov for acceptance criteria.

## Implementationsloop

Det normale loop er:

```text
AI ændrer feature branch i GitHub
        ↓
Udvikler: git pull
        ↓
Udvikler kører målrettet lokal validation
        ↓
Udvikler sender output
        ↓
FAIL → AI analyserer og retter GitHub → git pull → samme test igen
        ↓
PASS → næste validation
```

Når AI-assistenten kan rette GitHub direkte, bør brugeren normalt ikke selv redigere de samme filer lokalt.

## Validation-rækkefølge

Følg som udgangspunkt:

```text
code
↓
targeted validation
↓
quality gates
↓
integration/browser validation
↓
full regression
↓
PR/CI
```

Kør den mindste relevante test først. Hvis den fejler, stop den bredere validation, ret fejlen og kør samme test igen.

Eksempler:

```bash
pytest tests/test_specific_feature.py
```

```bash
npx playwright test tests/playwright/specific-feature.spec.js
```

## Quality gates

Projektets konkrete quality tools og commands skal dokumenteres separat. Kør relevante lint-, format-, type-, security- og testchecks før PR'en betragtes som klar.

Skeln mellem:

- errors, som skal rettes
- warnings, som skal vurderes eksplicit
- kendte accepterede warnings

Gør ikke en gate grøn ved at skjule reelle fejl.

Undgå fx:

- `|| true` på nødvendige checks
- silent fallback
- skjulte test-skips
- brede lint-disables uden begrundelse
- mocks der fjerner den funktionalitet, testen skal verificere

Manglende værktøjer, services, fixtures eller dependencies skal give et tydeligt failure.

## Én konkret lokal handling ad gangen

Ved fejlsøgning bør udvikleren normalt få én konkret kommando ad gangen:

1. `git pull`
2. målrettet test
3. quality gate
4. fuld suite
5. integration/manual validation

Det gør fejlårsager entydige og reducerer støj.

## Docker og persistence

Bevar eksisterende data som standard.

Undgå destruktive commands som:

```bash
docker compose down -v
```

medmindre datareset er udtrykkeligt ønsket og konsekvensen er kendt.

Ved persistence-test skal relevante containere kunne genoprettes uden at slette volumes, hvorefter data verificeres.

## Browser- og UI-validation

Frontendændringer bør, når relevant, valideres med:

- browser-tests
- desktop og mobile viewports
- relevante brugerflows
- screenshots eller visual audit
- manuel validation når automatisering ikke er tilstrækkelig

Kontrollér især navigation, formularer, modaler, responsive layouts, overflow, loading/error states og authorization flows.

## Fuld regression

Når den konkrete ændring er grøn, køres den fulde relevante suite for at opdage regressioner.

Typisk:

```text
targeted backend tests ✓
targeted frontend tests ✓
quality gates ✓
full backend suite ✓
full browser suite ✓
integration/manual validation ✓
```

Ikke alle projekter kræver alle trin; issue acceptance criteria bestemmer den endelige validation.

## Git-regler

Hold feature branches fokuserede.

Før PR/merge kontrolleres:

```bash
git status --short
```

Sørg for at:

- kun tilsigtede filer er ændret
- genererede reports/test-results ikke utilsigtet stages
- screenshots kun stages som bevidste artifacts
- secrets og lokale `.env`-filer ikke stages

Undgå destruktive Git-kommandoer uden klart behov.

## Pull request og CI

Når lokal validation er grøn:

1. Kontrollér PR-diff og ændrede filer.
2. Beskriv implementation og validation.
3. Link issue, fx `Closes #123`.
4. Kontrollér review-kommentarer og CI.
5. Ved CI-fejl: læs job/log, ret feature branch, kør relevant lokal validation og lad CI køre igen.
6. Merge ikke kendt defekt kode.

## Merge og afslutning

Et issue er først færdigt, når relevante kriterier er grønne:

```text
implementation ✓
targeted tests ✓
quality gates ✓
integration/browser ✓
full regression ✓
manual validation ✓
CI ✓
PR review ✓
```

Efter merge verificeres:

1. PR er merged.
2. `main` indeholder ændringen.
3. Issue er lukket.
4. Eventuel release tracker/projektstatus er opdateret.
5. Lokal `main` kan synkroniseres.

## Grundprincipper

- GitHub er source of truth for committed kode og projektstatus.
- Lokal working tree er source of truth for ikke-pushede ændringer.
- AI-assistenten bruger GitHub direkte, når GitHub kan svare.
- Udvikleren validerer det faktiske lokale runtime-miljø.
- Fail fast og vis fejl tydeligt.
- Foretræk små validation-trin frem for store batches.
- Bevar persistent data som standard.
- Merge først efter relevant lokal validation og CI.