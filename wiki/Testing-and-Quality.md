# Testing and Quality

Den autoritative beskrivelse af quality gates findes i:

[docs/CODE_QUALITY.md](https://github.com/jfriisj/vennekredsen/blob/main/docs/CODE_QUALITY.md)

## Hurtige kommandoer

```bash
make check-api
make check-frontend
make check-wiki
make check-quality
```

API-tests:

```bash
./dev.sh test
```

Frontendens browser-tests ligger i `frontend/tests/playwright/` og dækker både offentlige og beskyttede flows.

## CI

`.github/workflows/code-quality.yml` kører relevante checks ved ændringer i kode, scripts, quality-konfiguration og wiki-kilder.

Quality workflowet omfatter:

- Black
- isort
- Flake8
- MyPy på `app.py`
- Bandit
- Safety
- Pytest med coverage-rapport
- ESLint
- Prettier
- html-validate
- Stylelint
- Trivy
- Hadolint
- wiki source/link validation

Ikke alle værktøjer er blocking på samme måde; workflow-konfigurationen er source of truth for den aktuelle gate.
