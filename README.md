# Vennekredsen for Hashøjskolen

Hjemmeside til vennekredsen for Hashøjskolen - et system til at administrere og håndtere ansøgninger om støtte.

## 🚀 Quick Start

### Development Setup
```bash
# Install development dependencies
make install-dev

# Install pre-commit hooks
make install-hooks

# Run quality checks
make check-quality

# Start development environment
make up
```

### Production Deployment
```bash
# Build and start all services
docker-compose up -d
```

## 🏗️ Architecture

- **Frontend**: Static HTML/CSS/JavaScript served via Nginx
- **API**: Python Flask REST API with PostgreSQL
- **Database**: PostgreSQL with automated migrations
- **Deployment**: Docker containers with GitHub Actions CI/CD

## 📁 Project Structure

```
├── api/                    # Python Flask API
│   ├── app.py             # Main application
│   ├── requirements.txt   # Python dependencies
│   ├── requirements-dev.txt # Development dependencies
│   ├── tests/             # API tests
│   └── Dockerfile         # API container
├── frontend/               # Frontend application
│   ├── html/              # HTML, CSS, JS files
│   ├── package.json       # Frontend dependencies
│   └── Dockerfile         # Frontend container
├── scripts/                # Quality check scripts
├── docs/                   # Documentation
└── docker-compose.yml     # Local development setup
```

## 🔧 Development

### Code Quality
We maintain high code quality standards with automated checks:

```bash
# Run all quality checks
make check-quality

# Fix formatting issues
make fix-format

# Run tests
make test
```

See [Code Quality Documentation](docs/CODE_QUALITY.md) for detailed information.

### Available Commands
```bash
make help                  # Show all available commands
make install-dev           # Install development dependencies
make check-quality         # Run all quality checks
make fix-format           # Fix code formatting
make test                 # Run tests
make build                # Build Docker images
make up                   # Start services
make down                 # Stop services
make clean                # Clean temporary files
```

## 🛡️ Security

- JWT-based authentication for admin functions
- Input validation and sanitization
- SQL injection protection via SQLAlchemy
- Dependency vulnerability scanning
- Security headers and CORS configuration

## 🧪 Testing

```bash
# Run API tests with coverage
make test-api

# Run frontend quality checks
make check-frontend
```

## 📊 Quality Gates

Our CI/CD pipeline ensures:
- ✅ Zero linting errors
- ✅ Consistent code formatting  
- ✅ No security vulnerabilities
- ✅ Minimum test coverage
- ✅ Valid HTML/CSS
- ✅ Type safety (Python)

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Run quality checks: `make check-quality`
5. Fix any issues: `make fix-format`
6. Submit a pull request

All PRs must pass quality gates before merging.

## 📄 License

This project is licensed under the MIT License.
