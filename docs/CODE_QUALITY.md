# Code Quality

Dette dokument beskriver de quality checks, som er konfigureret i repositoryet. GitHub Actions-konfigurationen er source of truth for den aktuelle CI-gate.

## Hurtige kommandoer

Kør fra repository-roden:

```bash
make check-api
make check-frontend
make check-wiki
make check-quality
```

Formatting kan rettes med:

```bash
make fix-api
make fix-frontend
make fix-format
```

## API / Python

API-quality scriptet og CI anvender:

- Black
- isort
- Flake8
- MyPy
- Bandit
- Safety
- Pytest med coverage-rapport

Direkte lokal kørsel:

```bash
./scripts/check-api-quality.sh
```

CI installerer `api/requirements.txt` og `api/requirements-dev.txt`, kører Black/isort/Flake8, MyPy på `app.py`, Bandit, Safety og hele Pytest-suiten.

`api/setup.cfg` er source of truth for Flake8-, MyPy- og Pytest-konfiguration. Repositoryet håndhæver aktuelt ikke et generelt krav om type hints på alle funktioner eller en fast 80 % coverage-threshold.

## Frontend

Frontend-quality anvender:

- ESLint
- Prettier
- html-validate
- Stylelint

Direkte lokal kørsel:

```bash
./scripts/check-frontend-quality.sh
```

Eller fra `frontend/`:

```bash
npm run lint
npm run format:check
npm run validate:html
npx stylelint "html/**/*.css"
```

## Wiki

Repository-backed wiki valideres med:

```bash
python tools/publish_wiki.py --verify-only
```

eller:

```bash
make check-wiki
```

Validatoren kræver:

- `wiki/Home.md`
- `wiki/_Sidebar.md`
- `wiki/_Footer.md`
- at interne `[[Wiki Links]]` peger på eksisterende sider

CI kører samme validering ved ændringer i wiki-kilden eller publish-værktøjet.

## Browser-tests

Playwright-tests ligger i:

```text
frontend/tests/playwright/
```

De dækker blandt andet offentlige sider, member area, inventory, purchase calculator, admin content, site media og visual audit.

Browser/integration tests køres målrettet efter den normale validation-rækkefølge beskrevet i `docs/DEVELOPMENT_WORKFLOW.md`.

## Security og Docker checks

CI indeholder desuden:

- Trivy filesystem scan
- Hadolint for API- og frontend-Dockerfiles

Se `.github/workflows/code-quality.yml` for blocking/non-blocking adfærd. Nogle security-reporting trin bruger `continue-on-error`; det må ikke beskrives som en blocking gate, hvis workflowet ikke håndhæver det.

## Pre-commit

Repositoryet indeholder `.pre-commit-config.yaml`.

Installation:

```bash
pip install pre-commit
pre-commit install
```

Manuel kørsel:

```bash
pre-commit run --all-files
```

## Validation-princip

Følg normalt:

```text
targeted validation
-> relevante quality gates
-> integration/browser
-> full regression
-> PR/CI
```

Hvis en nødvendig test fejler, stop den bredere validation, ret årsagen og kør samme test igen.

Gør ikke gates grønne med skjulte fallbacks, `|| true` på nødvendige checks, irrelevante skips eller mocks der fjerner den funktionalitet, som skal testes.
