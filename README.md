# SmartChat AI Platform

A production-style AI chatbot platform built using **Rasa**, **FastAPI**, **PostgreSQL**, **Docker Compose**, and **Nginx**.

SmartChat combines conversational AI, secure authentication, encrypted file
management, and a modular microservice architecture.

---

# Project Highlights

- 🤖 AI chatbot powered by Rasa Open Source
- 🔐 JWT authentication and role-based authorization
- 📁 Encrypted file upload, download, and sharing
- 🗄 PostgreSQL database
- 🐳 Dockerized microservices
- 🌐 Nginx reverse proxy
- ⚡ FastAPI REST APIs
- 📚 Modular project architecture

---

# Technology Stack

| Category | Technologies |
|----------|--------------|
| Backend | Python, FastAPI, SQLAlchemy |
| AI | Rasa Open Source |
| Database | PostgreSQL |
| Frontend | HTML, CSS, JavaScript |
| Containerization | Docker, Docker Compose |
| Web Server | Nginx |
| Authentication | JWT |

---

# Architecture Overview

SmartChat uses a containerized microservice architecture.

Nginx is the primary browser-facing entry point. It serves the frontend and
reverse-proxies requests to the authentication, chatbot, and file-management
services over the Docker Compose network.

## Architecture diagram

```text
Browser
   │
   │ localhost:8081
   ▼
Nginx
   │
   ├──────────────► Auth Service :8000
   │                    │
   │                    └──────────► PostgreSQL
   │
   ├──────────────► Rasa :5006
   │                    │
   │                    ▼
   │                 Rasa SDK :5055
   │                    │
   │                    └──────────► PostgreSQL
   │
   └──────────────► File Service :8001
                         │
                         ├──────────► PostgreSQL
                         │
                         └──────────► Encrypted File Storage
```

For detailed service interactions, authentication, database relationships,
encryption, authorization, and request flows, see Architecture.

---

# Features

## Authentication

- User registration
- User login
- Password hashing
- JWT token generation and validation
- Role-based access control
- User administration

## Chatbot

- Rasa conversational AI
- Custom Rasa actions
- Authenticated chat sessions
- Persistent chat history
- Per-user chat-history isolation
- Session-based conversation tracking

SmartChat does not support guest or unauthenticated chatbot sessions.

## File Management

- File upload
- File download
- File encryption
- File deletion
- File sharing
- Permission management
- Audit logging
- Per-user file ownership

---

# Project Structure

```text
SmartChat-AI-Platform/
│
├── auth_service/              # Authentication and user management
│   ├── app/
│   └── scripts/
│
├── file_service/              # Secure encrypted file management
│   ├── app/
│   │   └── models/
│   ├── alembic/
│   └── scripts/
│
├── frontend/                  # HTML, CSS, and JavaScript frontend
│   ├── assets/
│   ├── css/
│   └── js/
│
├── nginx/                     # Nginx reverse proxy configuration
│
├── postgres/                  # Database initialization and seed scripts
│
├── rasa/                      # Rasa conversational AI
│   ├── data/
│   ├── tests/
│   ├── models/
│   ├── config.yml
│   ├── domain.yml
│   ├── credentials.yml
│   └── endpoints.yml
│
├── rasa_sdk/                  # Custom Rasa actions
│   └── actions/
│
├── docs/                      # Project documentation
│   ├── architecture.md
│   ├── api.md
│   ├── deployment.md
│   ├── development.md
│   ├── testing.md
│   └── troubleshooting.md
│
├── scripts/                   # Development and database helper scripts
│
├── docker-compose.yml         # Docker Compose orchestration
├── .env.example               # Example environment configuration
├── .gitignore
├── README.md
└── LICENSE
```

**file_service/uploads/** is runtime storage for encrypted uploaded files and is excluded from version control.

---

# Getting Started

SmartChat is designed to run entirely inside Docker containers using Docker
Compose. A local Python virtual environment is not required.

## Prerequisites

Install:

- Docker Desktop on Windows/macOS, or Docker Engine on Linux
- Docker Compose
- Git

Verify Docker:

```bash
docker --version
docker compose version
```

## Clone the Repository

```bash
git clone https://github.com/Keerthana-PMalode/SmartChat-AI-Platform.git
cd SmartChat-AI-Platform
```

## Configure the Environment

Create the environment file:

```bash
cp .env.example .env
```

On Windows PowerShell:

```powershell
copy .env.example .env
```

Configure the required values:

```text
DATABASE_URL=postgresql://chatbot:chatbot@postgres:5432/chatbot
SECRET_KEY=change_this_to_a_long_random_secret
FILE_MASTER_KEY=change_this_to_a_secure_fernet_key

POSTGRES_HOST=postgres
POSTGRES_PORT=5432
POSTGRES_USER=chatbot
POSTGRES_PASSWORD=chatbot
POSTGRES_DB=chatbot
```

Use strong production secrets and never commit .env to version control.

**FILE_MASTER_KEY** must be a securely generated Fernet key because it protects
the stored file encryption keys.

## Create Docker Volumes

Create the persistent volumes:

```bash
docker volume create chatbot-project_postgres_data
docker volume create chatbot-project_rasa_models
```

Verify them:

```bash
docker volume ls
```

## Build and Start the Application

```bash
docker compose up --build
```

## Apply Database Migrations

The File Service uses Alembic for database migrations.

```bash
docker compose exec file_service alembic upgrade head
```

## Verify the Containers

```bash
docker ps
```

A successful deployment should include containers similar to:

- postgres
- auth
- file_service
- rasa_sdk
- rasa
- nginx

---

## Application Access

The normal browser-facing application is:

```http
http://localhost:8081
```

The login page is:

```http
http://localhost:8081/login.html
```

Nginx provides the normal browser-facing API routes:

| Route      | Purpose                  |
|------------|--------------------------|
| `/auth/*`  | Authentication and user APIs |
| `/rasa/*`  | Rasa conversational API  |
| `/files/*` | File-management API      |

Individual backend ports may also be published for development and
troubleshooting.

Typical development endpoints include:

```http
http://localhost:8000/docs
http://localhost:8001/docs
http://localhost:5006/
```

These direct backend endpoints are intended for development and testing. Normal
browser application traffic should use Nginx on port 8081.

---

# Security

SmartChat uses JWT-based authentication for protected APIs.

Authenticated users can access only resources authorized for their account.
Chat history is scoped by both the conversation session_id and the
authenticated user's identity.

Uploaded files are encrypted using unique Fernet file encryption keys. The
file keys are protected using the server-side FILE_MASTER_KEY.

File-related operations can be recorded in audit logs.

For the detailed security and authorization architecture, see
Architecture.

---

# Screenshots

## Login

![Login](docs/images/login-page.png)

---

## Chatbot

![Chatbot](docs/images/chatbot-ui.png)

---

## Admin Dashboard

![Admin](docs/images/admin-dashboard.png)

---

## File Manager

![Files](docs/images/file-management.png)

---

## Docker Containers

![Docker Containers](docs/images/docker-ps.png)

---

# Documentation

Detailed project documentation is available in the docs/ directory.

- [Architecture](docs/architecture.md)
- [API Documentation](docs/api.md)
- [Deployment Guide](docs/deployment.md)
- [Development Guide](docs/development.md)
- [Testing Guide](docs/testing.md)
- [Troubleshooting Guide](docs/troubleshooting.md)

---

# Future Enhancements

- Kubernetes deployment
- CI/CD integration
- Redis
- OAuth2
- WebSockets
- Monitoring
- Expanded unit testing

---

# Author

**Keerthana P. Malode**

Computer Science & Engineering (IoT)

Areas of interest:

- Backend development
- AI applications
- Distributed systems
- Cloud and DevOps
- Conversational AI

---

# License

MIT License