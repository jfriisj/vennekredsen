# Development

## Source of truth

GitHub er source of truth for committed kode, issues, pull requests, CI og dokumentation.

Den detaljerede arbejdsproces findes i:

- [docs/DEVELOPMENT_WORKFLOW.md](https://github.com/jfriisj/vennekredsen/blob/main/docs/DEVELOPMENT_WORKFLOW.md)
- [docs/CODE_QUALITY.md](https://github.com/jfriisj/vennekredsen/blob/main/docs/CODE_QUALITY.md)

## Normal arbejdsgang

```text
issue
  -> fokuseret feature branch
  -> implementation
  -> targeted validation
  -> quality gates
  -> integration/browser validation
  -> PR/CI
  -> merge
```

## Lokal udvikling

```bash
./dev.sh start
```

Se alle dev-kommandoer med:

```bash
./dev.sh help
```

## Quality commands

```bash
make check-api
make check-frontend
make check-wiki
make check-quality
```

Ved fejlsøgning bør den mindste relevante test køres først.

## Wiki-dokumentation

Wiki-kilden ligger i `wiki/`.

Valider lokalt med:

```bash
python tools/publish_wiki.py --verify-only
```

eller:

```bash
make check-wiki
```

Wiki'en publiceres fra `main`; GitHub Wiki er derfor en derived presentation layer og ikke en separat source of truth.
