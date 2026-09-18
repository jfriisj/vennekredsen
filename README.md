# Vennekredsen for Hashøjskolen

Hjemmeside og internt arbejdsområde for Vennekredsen for Hashøjskolen.

Projektet består af en offentlig hjemmeside, støtteansøgninger, beskyttet medlemsområde, inventory, indkøbsberegner og administrative funktioner. Frontend serveres af Nginx, backend er Flask, og data gemmes i PostgreSQL.

## Quick start

```bash
git clone https://github.com/jfriisj/vennekredsen.git
cd vennekredsen
./dev.sh start
./dev.sh create-admin
```

Frontend er som standard tilgængelig på `http://localhost:85`.

## Dokumentation

| Emne | Dokumentation |
| --- | --- |
| Projektoversigt og brug | [GitHub Wiki](https://github.com/jfriisj/vennekredsen/wiki) |
| Lokal opstart | [Getting Started](https://github.com/jfriisj/vennekredsen/wiki/Getting-Started) |
| Arkitektur | [Architecture](https://github.com/jfriisj/vennekredsen/wiki/Architecture) |
| Features | [Features](https://github.com/jfriisj/vennekredsen/wiki/Features) |
| API | [API](https://github.com/jfriisj/vennekredsen/wiki/API) |
| Deployment og drift | [Deployment and Operations](https://github.com/jfriisj/vennekredsen/wiki/Deployment-and-Operations) |
| Udviklingsworkflow | [docs/DEVELOPMENT_WORKFLOW.md](docs/DEVELOPMENT_WORKFLOW.md) |
| Code quality | [docs/CODE_QUALITY.md](docs/CODE_QUALITY.md) |
| Auth migration | [docs/auth-migration.md](docs/auth-migration.md) |

Repositoryet er source of truth. GitHub Wiki publiceres automatisk fra den versionsstyrede `wiki/`-mappe på `main`.

## Quality

```bash
make check-quality
make check-wiki
```

## License

MIT License.

## Projekt

- [Issues](https://github.com/jfriisj/vennekredsen/issues)
- [Pull requests](https://github.com/jfriisj/vennekredsen/pulls)
