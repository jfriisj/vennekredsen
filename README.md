# Vennekredsen for Hashøjskolen

Moderne hjemmeside til vennekredsen for Hashøjskolen - et intuitivt system til at administrere og håndtere ansøgninger om støtte med fokus på brugeroplevelse og sikkerhed.

## ✨ Features

- 🎨 **Modern UI/UX**: Responziv design med glassmorphism effekter og micro-interaktioner
- 📝 **Smart Ansøgningsformular**: Wizard-baseret form med trinvis vejledning og validering
- 👥 **Admin Panel**: Komplet brugerstyring med rolle-baseret adgang
- 🔐 **Sikkerhed**: JWT-baseret autentificering og sikkerhedsscanning
- 📱 **Mobil-venlig**: Fuldt responziv design til alle enheder
- 🚀 **CI/CD Pipeline**: Automatiserede kvalitetstjek og deployment

## 🚀 Quick Start

### Development Setup
```bash
# Clone repository
git clone https://github.com/jfriisj/vennekredsen.git
cd vennekredsen

# Start development environment (builds from local Dockerfiles)
./dev.sh start

# Create admin user
./dev.sh create-admin

# View application
# Frontend: http://localhost:85 (same as production)
# API: http://localhost:5000
# Admin: http://localhost:85/admin-login.html
```

### Production Deployment
```bash
# Build and start all services
docker-compose up -d
```

## 🏗️ Architecture

- **Frontend**: Modern HTML5/CSS3/JavaScript med Bootstrap 4, FontAwesome og Google Fonts
- **Backend**: Python Flask REST API med comprehensive admin functionality
- **Database**: PostgreSQL med automatiserede migrationer og backup
- **Container**: Docker-baseret deployment med multi-stage builds
- **CI/CD**: GitHub Actions med omfattende kvalitetskontrol
- **Security**: JWT authentication, input validation, vulnerability scanning

## 📁 Project Structure

```
├── api/                         # Python Flask API
│   ├── app.py                  # Main application med admin endpoints
│   ├── requirements.txt        # Python dependencies
│   ├── tests/                  # API tests med coverage
│   ├── init.sql               # Database schema
│   └── Dockerfile             # Optimeret API container
├── frontend/                   # Frontend application
│   ├── html/                  # Moderne responsive HTML sider
│   │   ├── index.html         # Hovedside med hero sektion
│   │   ├── ansogning.html     # Smart wizard form
│   │   ├── admin-panel.html   # Admin dashboard
│   │   ├── style.css          # Modern CSS med custom properties
│   │   └── ...                # Øvrige sider
│   ├── nginx.conf             # Nginx konfiguration
│   └── Dockerfile             # Frontend container
├── scripts/                    # Development og quality scripts
│   └── check-api-quality.sh   # Comprehensive quality checks
├── .github/workflows/          # CI/CD pipelines
│   └── code-quality.yml       # Automated quality gates
└── docker-compose.yml          # Local development setup
```

## 🔧 Development

### Code Quality
Vi opretholder høje kodestandards med automatiserede tjek:

```bash
# Run all quality checks locally
./scripts/check-api-quality.sh

# Eller individuelt:
cd api/

# Python kode kvalitet
python -m black .              # Code formatting
python -m isort .              # Import organization  
python -m flake8 .             # Linting
python -m mypy app.py          # Type checking
python -m bandit -r .          # Security scanning
python -m safety check         # Dependency security

# Frontend kvalitet
cd ../frontend/html/
npx eslint *.js               # JavaScript linting
npx prettier --check .        # Code formatting check
npx stylelint *.css           # CSS linting
```

### Environment Variables
```bash
# Required for production
POSTGRES_DB=vennekredsen
POSTGRES_USER=your_user
POSTGRES_PASSWORD=your_password
JWT_SECRET=your_jwt_secret
INTERNAL_TOKEN=your_internal_token
```

### Development Workflow
```bash
# Start development environment
./dev.sh start                # Start all services with local builds

# Development tasks
./dev.sh create-admin         # Create admin user
./dev.sh logs                 # View all logs  
./dev.sh shell-api           # Access API container
./dev.sh shell-db            # Access database
./dev.sh test                # Run tests

# Maintenance
./dev.sh build               # Rebuild services
./dev.sh clean               # Clean and reset environment
./dev.sh tools               # Start with pgAdmin
```

### Admin Setup
```bash
# Create first admin user (run once)
./dev.sh create-admin

# Or manually in container:
docker-compose exec api python create_admin.py
```

## 🛡️ Security

### Authentication & Authorization
- 🔐 **JWT-based admin authentication** med secure token handling
- 👥 **Role-based access control** for admin funktioner
- 🔑 **Password hashing** med bcrypt for sikker lagring
- 🚪 **Session management** med automatisk logout

### Security Measures  
- 🛡️ **Input validation** og sanitization på alle endpoints
- 💉 **SQL injection protection** via SQLAlchemy ORM
- 🔍 **Dependency vulnerability scanning** med Safety CLI
- 🚨 **Security headers** og CORS konfiguration
- 📊 **Security scanning** med Bandit static analysis

### Quality Gates
- ✅ **Bandit**: Security vulnerability scanning
- ✅ **Safety**: Dependency security checking
- ✅ **MyPy**: Static type checking
- ✅ **Flake8**: Code linting og style checking
- ✅ **ESLint**: JavaScript quality checking
- ✅ **Hadolint**: Docker best practices
- ✅ **Trivy**: Container vulnerability scanning

## 🧪 Testing

```bash
# Start test database
docker-compose up -d db

# Run API tests with coverage
cd api/
python -m pytest -v --cov=. --cov-report=html --cov-report=xml

# View coverage report
open htmlcov/index.html
```

### Test Coverage
- **Current Coverage**: ~40% (targeting 80%+)
- **API Endpoints**: Health check og application submission
- **Database Models**: Ansoegninger og Admin tables
- **Authentication**: JWT token generation og validation

## 📊 CI/CD Pipeline

### GitHub Actions Workflow
Vores automated pipeline sikrer kvalitet på hver commit:

```yaml
# Quality Gates (alle skal bestå):
- Black (code formatting)
- isort (import organization)  
- Flake8 (linting)
- MyPy (type checking)
- Bandit (security scanning)
- Safety (dependency security)
- ESLint (JavaScript quality)
- Prettier (frontend formatting)
- HTML validation
- Stylelint (CSS quality)
- Trivy (container security)
- Hadolint (Dockerfile best practices)
```

### Deployment Process
1. **Code Push** → Triggers automated quality checks
2. **Quality Gates** → All checks must pass
3. **Security Scans** → Vulnerability assessment
4. **Build Images** → Docker containers
5. **Deploy** → Production environment

## 🎨 Frontend Features

### Modern Design System
- 🎨 **CSS Custom Properties** for consistent theming
- ✨ **Glassmorphism Effects** med backdrop-filter
- 🌈 **Gradient Backgrounds** og modern color palette
- 🔄 **Micro-interactions** og smooth animations
- 📱 **Responsive Design** med mobile-first approach

### User Experience
- 🧙‍♂️ **Wizard Form**: Step-by-step ansøgningsprocess
- ✅ **Real-time Validation**: Instant feedback til brugere
- 📊 **Progress Indicators**: Tydelig fremgang gennem form
- 🚀 **Loading States**: Professional loading animations
- 📱 **Touch-friendly**: Optimeret til mobile enheder

## 🤝 Contributing

### Development Workflow
1. **Fork** repository
2. **Create feature branch**: `git checkout -b feature/amazing-feature`
3. **Make changes** med focus på kvalitet
4. **Run quality checks**: `./scripts/check-api-quality.sh`
5. **Commit changes**: `git commit -m 'Add amazing feature'`
6. **Push branch**: `git push origin feature/amazing-feature`
7. **Create Pull Request** med detailed beskrivelse

### Code Standards
- ✅ **Python**: Follow PEP 8, type hints, docstrings
- ✅ **JavaScript**: ESLint rules, moderne ES6+ syntax
- ✅ **CSS**: BEM methodology, mobile-first responsive
- ✅ **HTML**: Semantic markup, accessibility compliance
- ✅ **Git**: Conventional commits, descriptive messages

All PRs must pass CI/CD quality gates before merging.

## 📄 License

This project is licensed under the MIT License - see [LICENSE](LICENSE) for details.

## 📧 Support

For spørgsmål eller support, kontakt:
- **Project Owner**: [jfriisj](https://github.com/jfriisj)
- **Issues**: [GitHub Issues](https://github.com/jfriisj/vennekredsen/issues)

---

**Vennekredsen for Hashøjskolen** - Moderne, sikker og brugervenlig platform til støtteansøgninger 🎓
