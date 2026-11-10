# SmartChat AI Platform

A production-style AI chatbot platform built using **Rasa**, **FastAPI**, **PostgreSQL**, **Docker Compose**, and **Nginx**.

SmartChat combines conversational AI, secure authentication, encrypted file
management, administrative dashboards and analytics, and a modular microservice architecture.

---

# Project Highlights

- 🤖 AI chatbot powered by Rasa Open Source
- 🔐 JWT authentication and role-based authorization
- 📁 Encrypted file upload, download, and sharing
- 🗄  PostgreSQL database
- 🐳 Dockerized microservices
- 🌐 Nginx reverse proxy
- ⚡ FastAPI REST APIs
- 📊 Administrative dashboard with application activity insights
- 📈 Chat and message analytics
- 👥 User and conversation activity monitoring
- 📚 Modular frontend and backend architecture
- 🔒 Internal-only backend service networking through Docker Compose
- 💾 Persistent Docker volume for encrypted file storage
- 📦 Containerized deployment without development source-code bind mounts
- 📖 API documentation access through Nginx reverse proxy
- 📤 Support for file uploads up to 100 MB
- 🕒 Recent user activity tracking based on latest conversation timestamps

---

# Technology Stack

| Category | Technologies |
|----------|--------------|
| Backend | Python, FastAPI, SQLAlchemy |
| AI | Rasa Open Source |
| Database | PostgreSQL |
| Frontend | HTML, CSS, JavaScript |
| Charts   | Chart.js |
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
   │ http://localhost
   ▼
Nginx :80
   │
   ├──────────────► Auth Service :8000
   │                    │
   │                    └──────────► PostgreSQL :5432
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
                         └──────────► Persistent Docker Volume
                                      (Encrypted File Storage)
```

The Auth Service also provides the administrative dashboard and analytics APIs used by the frontend to display application statistics, recent activity, and chat activity.

For detailed service interactions, authentication, database relationships,
encryption, authorization, and request flows, see Architecture.

### Internal Service Networking

Nginx acts as the primary browser-facing entry point.

Backend services communicate through the internal Docker Compose network.
The Auth Service and File Service expose their ports internally using Docker
Compose `expose` configuration rather than publishing those ports directly
to the host.

This reduces direct host-level access to backend services and centralizes
normal browser-facing application traffic through Nginx.

The following services communicate internally:

- Auth Service: Port 8000
- File Service: Port 8001
- Rasa: Port 5005
- Rasa SDK: Port 5055
- PostgreSQL: Port 5432

---

# Features

## Authentication

- User registration controlled by the public registration setting
- User login
- Password hashing
- JWT token generation and validation
- Role-based access control
- User administration
- Administrative system settings
- Administrative system logs and CSV export

## Admin Dashboard

The admin dashboard provides a centralized overview of application activity.

### Dashboard statistics

The dashboard displays:

- Total registered users
- Total conversations
- Total messages
- Active users

An **active user** is currently defined as a user who has at least one conversation in the system.

### Activity overview

The dashboard includes a seven-day activity view showing:

- Daily conversations
- Daily messages
- Activity labels based on the configured analytics timezone

Charts are rendered in the frontend using **Chart.js**.

### Recent activity

The dashboard provides quick access to:

- Five users with the most recent conversation activity
- Five most recent conversations
- Usernames and roles
- Latest conversation activity timestamps
- Conversation timestamps
- Conversation/session identifiers

#### Recent users sorting

Recent users are retrieved by their latest conversation activity. Only users with at least one conversation are included; the five most recently active users are returned with a `last_activity` timestamp.

The dashboard uses SQLAlchemy aggregation with `MAX(ChatHistory.timestamp)`
to determine each user's most recent conversation timestamp.

Users without conversations are excluded from this list.

The recent users API response includes:

| Field | Description |
|-------|-------------|
| `id` | User ID |
| `username` | Username |
| `role` | User role |
| `last_activity` | Timestamp of the user's latest conversation |

This provides administrators with a more meaningful view of recently
active users rather than simply displaying users in registration order.

## Chatbot

- Rasa conversational AI
- Custom Rasa actions
- Authenticated chat sessions
- Persistent chat history
- Per-user chat-history isolation
- Session-based conversation tracking
- Configurable application name
- Configurable maximum message length
- Administrative maintenance mode
- Runtime message-length counter in the chat UI

SmartChat does not support guest or unauthenticated chatbot sessions.

## Analytics

The administrative analytics section provides application usage insights, including:

- Total users
- Active users
- Chat/conversation activity
- Unique users participating in conversations
- Message activity
- Top users
- Hourly chat activity
- Configurable date ranges and presets

The chat activity analytics now reports **messages** instead of session counts.

Daily chat activity contains:

| Metric | Description |
|----------|--------------|
| Chats | Number of conversations |
| Users | Number of unique users |
| Messages | Number of messages associated with conversations |

Date-based analytics use the configured `ANALYTICS_TIMEZONE` to ensure activity is grouped according to the application's analytics timezone.

## File Management

- File upload
- File download
- File encryption
- File deletion
- File sharing
- Permission management
- Audit logging
- Per-user file ownership

### File Storage and Upload Configuration

The File Service supports:

- File uploads up to 100 MB
- Encrypted file storage
- Persistent Docker volume-based storage
- File downloads through Nginx
- File deletion and sharing operations

Nginx is configured with:

```nginx
client_max_body_size 100M;
```

### File Service Health Endpoints

The File Service provides health endpoints for monitoring application availability and database connectivity.

| Endpoint | Description | Accessibility |
|----------|-------------|---------------|
| `/` | File Service status | Internal   |
| `/health` | Application health | Through Nginx at /files/health |
| `/health/db` | Database connectivity check | Internal to the File Service|

**Note**: The application health endpoint is accessible through the Nginx reverse proxy at http://localhost/files/health. The database health endpoint is currently accessible internally within the File Service container and is not exposed through Nginx.

---

# Project Structure

```text
SmartChat-AI-Platform/
├── auth_service/      # Authentication, administration, and user management
│   ├── app/
│   │   ├── routes/
│   │   │   ├── admin.py       # Admin dashboard and administration endpoints
│   │   │   ├── admin_analytics.py # Administrative analytics endpoints
│   │   │   ├── admin_system.py # Settings and administrative log endpoints
│   │   │   └── register.py    # Public user registration endpoint
│   │   └── models/
│   │       └── system.py      # System settings and administrative audit logs
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
│   │   ├── admin.css
│   │   ├── analytics.css
│   │   └── dashboard.css      # Admin dashboard styling
│   └── js/
│       ├── admin.js            # Admin application controller
│       ├── admin_state.js      # Admin navigation state
│       ├── admin_ui.js         # Admin UI rendering
│       ├── analytics.js        # Analytics functionality
│       ├── analytics.controller.js
│       ├── analytics.events.js
│       ├── app.js              # User chat application and runtime settings
│       ├── dashboard.js        # Dashboard initialization
│       ├── dashboard.charts.js # Dashboard chart rendering
│       ├── dashboard.service.js # Dashboard API service
│       ├── login.js            # Login and registration-link behavior
│       └── register.js         # User registration form behavior
│
├── nginx/                     # Nginx reverse proxy and API routing
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
├── docker-compose.yml         # Docker Compose orchestration and persistent
├── .env.example               # Example environment configuration
├── .gitignore
├── README.md
└── LICENSE
```

**Persistent storage:** Encrypted uploaded files are maintained in the
`chatbot-project_file_uploads` Docker volume and are not dependent on
container filesystem persistence.

The application uses Docker volumes for persistent database, Rasa model,
and uploaded-file storage.

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

## Persistent Docker Storage

SmartChat uses Docker named volumes to maintain important application data
across container recreation.

The following persistent volumes are configured:

| Volume | Purpose |
|--------|---------|
| `chatbot-project_postgres_data` | PostgreSQL database storage |
| `chatbot-project_rasa_models` | Trained Rasa models |
| `chatbot-project_file_uploads` | Encrypted uploaded files |

Create the volumes if they do not already exist:

```bash
docker volume create chatbot-project_postgres_data
docker volume create chatbot-project_rasa_models
docker volume create chatbot-project_file_uploads
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

## Deployment Verification

```bash
docker compose ps
```

A successful deployment should include containers similar to:

- postgres
- auth
- file_service
- rasa_sdk
- rasa
- nginx

## Check container logs

```bash
docker compose logs -f
```

## Check individual services

```bash
docker compose logs auth
docker compose logs file_service
docker compose logs nginx
docker compose logs rasa
docker compose logs rasa_sdk
docker compose logs postgres
```

## Check the File Service

Verify application health through the Nginx reverse proxy:

```bash
curl http://localhost/files/health
```

Expected response:

```json
{
  "status": "healthy"
}
```


Check database connectivity from inside the File Service container to verify database health:

```bash
docker compose exec file_service python -c "import urllib.request; print(urllib.request.urlopen('http://localhost:8001/health/db').read().decode())"
```

Expected response:

```json
{
  "database": "connected",
  "result": 1
}
```

**Note**: The application health endpoint is accessible through Nginx at `/files/health`. The database health endpoint `/health/db` is currently accessible internally within the File Service container and is not exposed through the 
`/files/health/db` Nginx route.

---

## Application Access

The normal browser-facing application is:

```http
http://localhost
```

Nginx provides the normal browser-facing API routes:

| Route      | Purpose                  |
|------------|--------------------------|
| `/auth/*`  | Authentication, administration, user, and analytics APIs |
| `/rasa/*`  | Rasa conversational API  |
| `/files/*` | File-management API      |

Individual backend ports may also be published for development and
troubleshooting.

Typical development endpoints include:

```http
http://localhost/auth/docs
http://localhost/files/docs
```

These direct backend endpoints are intended for development and testing. Normal
browser application traffic should use Nginx on host port 80.

---

## Admin Dashboard and Analytics

Administrators can access the dashboard after authentication.

The admin interface is organized into the following sections:

- **Dashboard** — application overview and recent activity
- **Users** — user administration
- **Chat History** — conversation history
- **Analytics** — detailed usage and activity analytics

### Dashboard data flow

The dashboard follows a service/event-based frontend architecture:

```text
Admin Navigation
       │
       ▼
Dashboard Section
       │
       ▼
Dashboard Service
       │
       ▼
GET /admin/dashboard
       │
       ▼
Auth Service
       │
       ├── User statistics
       ├── Conversation statistics
       ├── Message statistics
       ├── Active users
       ├── Recent users
       ├── Recent conversations
       └── Seven-day activity
       │
       ▼
Dashboard Events
       │
       ▼
Admin UI + Chart.js
```

The dashboard uses separate frontend modules for API access, initialization, chart rendering, and UI updates.

Dashboard loading and error states are also communicated through the admin event system.

### Analytics activity model

The analytics chat activity endpoint reports three daily metrics:

- `chats` — distinct conversations
- `users` — distinct users
- `messages` — total messages

The previous session-based activity metric has been replaced with message counts to provide a more direct view of chatbot usage.

---

# Security

SmartChat uses JWT-based authentication for protected APIs.

Authenticated users can access only resources authorized for their account.

Chat history is scoped by both the conversation session_id and the
authenticated user's identity.

Administrative endpoints require appropriate administrative authorization.

Uploaded files are encrypted using unique Fernet file encryption keys. The
file keys are protected using the server-side `FILE_MASTER_KEY`.

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

The admin dashboard provides application statistics, seven-day activity charts, recent users, and recent conversations.

![Admin](docs/images/admin-dashboard.png)

---

## Admin Users

![Admin](docs/images/admin-users.png)

---

## Admin Chat History

![Admin](docs/images/admin-chathistory.png)

---

## Admin Analytics

![Admin](docs/images/admin-analytics.png)

---

## Admin Settings

![Admin](docs/images/admin-settings.png)

---

## Admin Logs

![Admin](docs/images/admin-logs.png)

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
- Advanced dashboard filtering
- Additional administrative analytics
- Real-time activity monitoring

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

## Latest implementation notes

The current Compose configuration exposes Nginx on host port `80` (`http://localhost`). PostgreSQL, Auth Service, File Service, Rasa, and the Rasa SDK retain their internal ports (`5432`, `8000`, `8001`, `5005`, and `5055`) but are not published to the host. Use Nginx routes or `docker compose exec` for diagnostics.

The File Service upload directory is persisted in the named Docker volume `chatbot-project_file_uploads`, mounted at `/app/uploads`. The PostgreSQL data and Rasa model volumes remain external volumes named `chatbot-project_postgres_data` and `chatbot-project_rasa_models`. Runtime source bind mounts for Auth, Rasa, and Rasa SDK were removed; rebuild images after changing their source code.

Auth Service API Documentation: Auth Service Swagger UI is accessible through Nginx at /auth/docs, with its OpenAPI specification available at /auth/openapi.json. The API documentation can be accessed through the browser-facing Nginx entry point without directly publishing the Auth Service port to the host.

File Service API Documentation: File Service Swagger UI is exposed through Nginx at `/files/docs`, with its OpenAPI document at `/files/openapi.json`. 

Authentication hardening and administration safeguards:
- Auth Service refuses to start unless `SECRET_KEY` is configured and at least 32 characters long.
- Protected routes handle a missing Bearer credential as `401 Authentication required`; invalid or expired JWTs return `401`.
- Admin role updates accept only `user` or `admin`, and the final administrator cannot be demoted.
- The login page uses the role returned in the JWT, not the role selected or stored by the browser, to choose the post-login destination.
- The dashboard's five recent users are selected by latest conversation timestamp; users with no conversations are excluded and each record includes `last_activity`.

The File Service uses `psycopg[binary]` (Psycopg 3) in its dependency manifest. Its SQLAlchemy default database URL uses the Compose hostname `postgres`, not container-local `localhost`.
