# Code Quality Setup

This document describes the code quality tools and processes for the Vennekredsen project.

## 🎯 Overview

We use comprehensive code quality checks for both our Python API and Frontend JavaScript/HTML/CSS code to ensure:
- Consistent code formatting
- Best practices adherence
- Security vulnerability detection
- Maintainable and readable code

## 🐍 Python/API Quality Tools

### Tools Used
- **Black**: Code formatting
- **isort**: Import sorting
- **Flake8**: Linting and style checking
- **MyPy**: Static type checking
- **Bandit**: Security vulnerability scanning
- **Safety**: Dependency security checking
- **Pytest**: Testing with coverage

### Configuration Files
- `api/pyproject.toml` - Black and isort configuration
- `api/setup.cfg` - Flake8, MyPy, and Pytest configuration
- `api/requirements-dev.txt` - Development dependencies

### Running API Quality Checks

```bash
# Install development dependencies
cd api
pip install -r requirements-dev.txt

# Run all checks
./scripts/check-api-quality.sh

# Fix formatting issues
./scripts/fix-api-format.sh

# Individual tools
black .                    # Format code
isort .                    # Sort imports
flake8 .                   # Lint code
mypy .                     # Type check
bandit -r .                # Security scan
safety check               # Check dependencies
pytest --cov=.             # Run tests with coverage
```

## 🌐 Frontend Quality Tools

### Tools Used
- **ESLint**: JavaScript linting
- **Prettier**: Code formatting (HTML, CSS, JS)
- **html-validate**: HTML validation
- **Stylelint**: CSS linting

### Configuration Files
- `frontend/.eslintrc.json` - ESLint rules
- `frontend/.prettierrc.json` - Prettier formatting rules
- `frontend/.htmlvalidate.json` - HTML validation rules
- `frontend/.stylelintrc.json` - CSS linting rules
- `frontend/package.json` - NPM scripts and dependencies

### Running Frontend Quality Checks

```bash
# Install dependencies
cd frontend
npm install

# Run all checks
./scripts/check-frontend-quality.sh

# Fix formatting issues
./scripts/fix-frontend-format.sh

# Individual tools
npm run lint               # Lint JavaScript
npm run lint:fix           # Fix auto-fixable JS issues
npm run format             # Format all files
npm run format:check       # Check formatting
npm run validate:html      # Validate HTML
npx stylelint "html/**/*.css"  # Lint CSS
```

## 🔄 Automated Quality Checks

### GitHub Actions
The `.github/workflows/code-quality.yml` workflow runs automatically on:
- Push to `main` or `develop` branches
- Pull requests to `main` or `develop` branches

The workflow includes:
1. **Python Quality**: Black, isort, Flake8, MyPy, Bandit, Safety, Tests
2. **Frontend Quality**: ESLint, Prettier, HTML validation, Stylelint
3. **Security Scanning**: Trivy vulnerability scanner
4. **Docker Quality**: Hadolint for Dockerfile linting
5. **Quality Gate**: Fails if any quality checks fail

### Pre-commit Hooks
Install pre-commit hooks for local development:

```bash
# Install pre-commit
pip install pre-commit

# Install hooks
pre-commit install

# Run hooks manually
pre-commit run --all-files
```

## 🚀 Quick Start

### Run All Quality Checks
```bash
./scripts/check-all-quality.sh
```

### Fix All Formatting Issues
```bash
./scripts/fix-api-format.sh
./scripts/fix-frontend-format.sh
```

## 📊 Quality Standards

### Python Code Standards
- **Line length**: 88 characters (Black default)
- **Import sorting**: Black-compatible isort profile
- **Type hints**: Required for all functions
- **Test coverage**: Minimum 80% (configurable)
- **Security**: No high/medium severity vulnerabilities

### Frontend Code Standards
- **JavaScript**: ES6+ with ESLint recommended rules
- **HTML**: Valid HTML5 with accessibility considerations
- **CSS**: BEM methodology encouraged, no duplicate selectors
- **Formatting**: Consistent 4-space indentation for JS, 2-space for HTML/CSS

## 🔧 IDE Integration

### VS Code
Install these extensions for automatic quality checking:
- Python: `ms-python.python`
- ESLint: `dbaeumer.vscode-eslint`
- Prettier: `esbenp.prettier-vscode`
- Black Formatter: `ms-python.black-formatter`

### Configuration
Add to your VS Code `settings.json`:
```json
{
  "python.defaultInterpreterPath": "./api/venv/bin/python",
  "python.linting.enabled": true,
  "python.linting.flake8Enabled": true,
  "python.formatting.provider": "black",
  "editor.formatOnSave": true,
  "eslint.workingDirectories": ["frontend"],
  "prettier.configPath": "frontend/.prettierrc.json"
}
```

## 🆘 Troubleshooting

### Common Issues

**Import errors in tests**:
```bash
cd api
pip install -e .  # Install package in development mode
```

**Node modules not found**:
```bash
cd frontend
rm -rf node_modules package-lock.json
npm install
```

**Pre-commit hooks failing**:
```bash
pre-commit clean
pre-commit install --install-hooks
```

**Permission errors on scripts**:
```bash
chmod +x scripts/*.sh
```

## 📈 Quality Metrics

Our quality gates ensure:
- ✅ Zero linting errors
- ✅ Consistent code formatting
- ✅ No security vulnerabilities
- ✅ Minimum test coverage
- ✅ Valid HTML/CSS
- ✅ Type safety (Python)

## 🤝 Contributing

Before submitting a PR:
1. Run `./scripts/check-all-quality.sh`
2. Fix any issues with the fix scripts
3. Ensure all tests pass
4. Add tests for new functionality

The CI/CD pipeline will verify all quality checks before allowing merges.