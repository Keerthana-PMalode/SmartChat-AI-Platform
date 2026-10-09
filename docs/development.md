# SmartChat AI Platform — Development Guide

This guide describes how to work on the current multi-service application while preserving its service boundaries. It is based on the supplied source tree and existing documentation. The supplied ZIP did not include the root `README.md`, `docker-compose.yml`, or `.env.example`; Compose names/ports and environment variable notes below therefore also use previously supplied project context and should be checked against the working checkout before changing deployment configuration.

## 1. System at a glance

SmartChat is a browser-based chatbot platform with authentication, persistent chat history, administration, analytics, and encrypted file management.

- **Nginx** serves the static frontend and reverse-proxies `/auth/`, `/rasa/`, and `/files/`.
- **Auth Service** is a FastAPI application responsible for registration, login/JWT creation, user/role management, chat-history persistence, public/admin system settings, analytics, and administrative audit logs.
- **File Service** is a separate FastAPI application responsible for upload, encryption, storage, file listing/deletion, downloads, direct permissions, share links, and file-access audit records.
- **Rasa** runs the conversational/NLU server and uses `rasa_sdk` for custom actions.
- **Rasa SDK** contains custom action logic and database/auth integration used by those actions.
- **PostgreSQL** stores user, system-setting, conversation/message, file metadata, encryption-key, permission, shared-link, and audit records according to the application schemas/migrations.

The frontend is primarily static HTML and JavaScript. Browser requests use Nginx-relative routes so the browser can use a single origin. Do not bypass a service's authorization checks by implementing data access directly in frontend code.

## 2. Prerequisites and setup

Use the versions pinned by the project's Dockerfiles and dependency files. At minimum, development requires:

- Git;
- Docker Engine/Desktop with the Docker Compose plugin;
- a browser with developer tools;
- a text editor/IDE;
- optionally Python and Node/browser tooling for focused local work, if needed by a particular change. The project is configured for containerized services; do not assume the full stack runs natively without Docker.

Clone or open the repository and inspect the actual root files before editing:

```bash
git status --short
git branch --show-current
```

Review `docker-compose.yml`, `.env.example`, service Dockerfiles, requirements files, and the relevant documentation. Do not commit `.env` files, real passwords, signing keys, JWT secrets, or file-encryption master keys.

## 3. Repository map

```text
auth_service/
  app/
    core/       # auth, database, dependencies, audit
    models/     # user, chat, system models
    routes/     # login, registration, token, chat, admin, analytics, settings/logs
    schemas/    # request and response validation
  scripts/      # database/user initialization helpers
file_service/
  app/
    api/        # upload, file listing/deletion, download, sharing
    core/       # config, database, dependencies, encryption, storage
    models/     # files, encryption keys, permissions, shared links, audits
    schemas/    # file and shared-link request/response models
    services/   # file operations and audit persistence
  alembic/      # migration environment and version history
  scripts/      # encryption-key migration utilities
frontend/
  *.html        # login, registration, chat, files, admin pages
  js/           # page entry points and feature modules
  js/files/     # file API and upload helpers
rasa/
  config.yml, domain.yml, data/, endpoints.yml, credentials.yml, tests/
rasa_sdk/actions/
  # custom actions and auth/database helpers
nginx/          # reverse-proxy configuration and image
postgres/       # schema, initialization, and seed SQL
scripts/        # build/start/stop/backup helper scripts
docs/           # architecture, deployment, API, testing, troubleshooting
```

Avoid modifying `.venv` or generated/cache files as part of normal source changes. The supplied archive includes a local virtual environment under `file_service/.venv`; it is not the canonical dependency manifest. Use `file_service/requirements.txt` and its Dockerfile for reproducible service dependencies.

## 4. Docker-based development workflow

Use the repository's Compose file as the authoritative orchestration contract. In the previously documented configuration, services are named `nginx`, `auth`, `file_service`, `rasa`, `rasa_sdk`, and `postgres`, connected on `chatbot_network`. Nginx serves the app on host port `8081`; direct service ports have been documented as Auth `8000`, File Service `8001`, Rasa `5006`, Rasa SDK `5055`, and PostgreSQL `5432`. Confirm the checked-out Compose file before relying on these mappings.

Typical workflow, if supported by the current Compose file:

```bash
docker compose config
docker compose up --build -d
docker compose ps
docker compose logs -f auth file_service rasa rasa_sdk nginx postgres
```

Use the browser-facing entry point `http://localhost:8081/` (login page is `/login.html`) when running the documented local stack. Direct FastAPI docs may be available at `http://localhost:8000/docs` and `http://localhost:8001/docs` if those ports are published. Do not assume those direct ports should be exposed in production.

`depends_on` orders container startup but does not by itself guarantee that PostgreSQL or another dependency is ready to accept requests. When debugging first boot, inspect the database and dependent service logs instead of assuming startup order means readiness.

To stop containers without deleting persisted data:

```bash
docker compose down
```

Avoid `docker compose down -v` during normal development because it removes Compose-managed volumes and can destroy database/model data.

## 5. Environment configuration and secrets

Use `.env.example` as a template if present in the working checkout; the uploaded archive did not include it. Previously supplied configuration identifies these important values:

- `DATABASE_URL`: SQLAlchemy connection URL; in Compose, the hostname should be the service name `postgres`, not `localhost`.
- `SECRET_KEY`: signing/verification secret used for JWTs by Auth Service and File Service. The services must use the same value for a token issued by Auth Service to be accepted by File Service.
- `FILE_MASTER_KEY`: Fernet-compatible key used to wrap/unwrap per-file encryption keys. The source raises an error if this value is absent.
- PostgreSQL variables such as `POSTGRES_USER`, `POSTGRES_PASSWORD`, `POSTGRES_DB`, plus `POSTGRES_HOST` and `POSTGRES_PORT` where consumed by a service.

For local work, create the expected `.env` from the actual template and use unique development-only secrets. Never use the source defaults (`SECRET_KEY` falls back to `secret` in the current Python source) as a production secret. Keep `FILE_MASTER_KEY` stable and backed up: losing it can make stored files undecryptable. Rotating it requires a planned key migration, not just changing the environment variable.

If a variable appears unused, inspect its call sites before removing it. The File Service `core/config.py` currently reads `DATABASE_URL` with a local fallback; encryption reads `FILE_MASTER_KEY` directly from the environment. Auth JWT logic reads `SECRET_KEY` directly.

## 6. Backend development

### Auth Service

Start with `auth_service/app/main.py` to understand router registration. The app uses FastAPI and SQLAlchemy. Important modules:

- `app/core/auth.py`: password hashing and JWT creation/verification;
- `app/core/dependencies.py`: database sessions, current-user/current-session resolution, and `require_admin`;
- `app/core/audit.py`: administrative audit log creation;
- `app/models/user.py`, `chat.py`, `system.py`: ORM models;
- `app/schemas/auth.py`, `admin.py`, `chat.py`: request/response validation;
- `app/routes/login.py`, `register.py`, `token.py`, `chat.py`: authentication and user chat flow;
- `app/routes/admin.py`: user management, dashboard, administrative chat retrieval/deletion;
- `app/routes/admin_analytics.py`: date-scoped analytics;
- `app/routes/admin_system.py`: public/admin settings and audit logs.

**Authentication contract:** login generates a new UUID session ID and returns it alongside the JWT. The JWT includes user ID, username (`sub`), role, session ID, and a 60-minute expiration. Protected routes should use the shared dependencies rather than reimplementing token parsing. Admin-only routes must use `require_admin`.

**Chat persistence contract:** user identity and session are derived from the token. `POST /chat/history` validates maintenance mode and configured message length, finds the conversation by both user ID and session ID, and persists the user message plus the optional chatbot response. `GET /chat/history` returns only the authenticated user's current token session. Do not reintroduce client-supplied identity/session fields.

**Settings contract:** defaults are defined in `admin_system.py`; public settings are filtered through `PUBLIC_SETTING_KEYS`. Add any new setting deliberately: decide whether it is public, define its type/default/validation, update the admin schema/UI, and test its runtime effect. Do not expose the entire settings table through the public endpoint.

**Audit contract:** administrative settings changes and user-management actions create audit records. Add audit events for sensitive new admin actions, but avoid writing passwords, JWTs, encryption keys, or other secrets into audit details.

### File Service

Use the service's layers rather than adding all behavior to a route:

- `app/api/upload.py`: multipart upload and 100 MiB application-level size check;
- `app/api/files.py`: authenticated file listing and deletion;
- `app/api/download.py`: owner/READ permission checks, encrypted-object retrieval, decryption, and authenticated download auditing;
- `app/api/sharing.py`: direct user sharing, share-link creation, and token-based download;
- `app/core/encryption.py`: Fernet file encryption and encryption-key wrapping with `FILE_MASTER_KEY`;
- `app/core/storage.py`: storage-related helpers;
- `app/core/dependencies.py`: JWT validation and user ID extraction;
- `app/services/file_service.py`: file operations;
- `app/services/audit_service.py`: file access audit records;
- `app/models/`: file metadata, wrapped encryption keys, permissions, shared links, and audit rows.

Uploaded content is encrypted before being stored. The database stores metadata and an encrypted/wrapped per-file key; encrypted file bytes are stored separately on disk. Keep the database and storage directory consistent during backup/restore. Never log plaintext file contents or keys. Permission changes should be tested against both direct downloads and share-link access.

### Rasa and custom actions

Rasa configuration and training data live under `rasa/`: `config.yml`, `domain.yml`, `data/nlu.yml`, `data/rules.yml`, `data/stories.yml`, `endpoints.yml`, and `tests/test_stories.yml`. Custom actions are in `rasa_sdk/actions/`:

- `actions.py`: action implementations;
- `auth.py` and `auth_utils.py`: authentication-related action helpers;
- `database.py`: database access helpers;
- `utils.py`: shared helpers.

Keep Rasa dialogue/NLU definitions separate from backend persistence and authorization. When an action needs user/session context or database access, inspect existing helper behavior and pass only the necessary values. Update stories/tests when changing intents, entities, rules, forms, or action sequencing. The SDK endpoint and action server must agree with the service name/port in `rasa/endpoints.yml` and Compose.

## 7. PostgreSQL and schema changes

`postgres/init.sql` and `postgres/seed.sql` are initialization scripts for a new/empty PostgreSQL data directory in the documented Docker setup. They are not a general migration mechanism: PostgreSQL's image runs init scripts only on first initialization. Editing them will not update an already initialized persistent volume.

The Auth Service currently calls `Base.metadata.create_all(bind=engine)` at startup. File Service schema evolution is managed through Alembic under `file_service/alembic/`. Migration files include baseline/current schema work and later revisions for normalized chat history, chat messages, encryption keys, access-audit invariants, share-link auditing, and user deletion cascades.

Use the File Service container's environment and working directory when invoking Alembic. The documented migration command is:

```bash
docker compose exec file_service alembic upgrade head
docker compose exec file_service alembic current
```

Before creating a migration:

1. Update the relevant ORM model/schema.
2. Generate or write a migration using the project's installed Alembic tooling.
3. Review generated SQL and constraints manually.
4. Test upgrade on a disposable database and on a copy of representative data.
5. Verify downgrade behavior if the migration supports it; do not assume every data migration is reversible.
6. Update tests and documentation for new columns/relationships/constraints.

Do not use `create_all()` as a substitute for an existing production migration history. Before changing initialization SQL or migration files, understand which database is being targeted and take a backup.

## 8. Frontend architecture

Frontend pages are static HTML and feature-oriented JavaScript modules. Nginx serves `frontend/` and routes API calls to backend services. Keep rendering, state, event coordination, and network access separated where the existing modules already do so.

### Authentication and user pages

- `auth.js`: shared browser authentication/token behavior;
- `login.js`, `register.js`: login and registration flows;
- `app.js`: primary chat application entry/orchestration;
- `chat.service.js`: chat API and chatbot interaction;
- `chat_history.service.js`: persisted history retrieval/presentation support;
- `users.service.js`: user-related API access;
- `settings.controller.js`: public/admin settings interaction according to page use;
- `modal_manager.js`: modal lifecycle helpers.

The browser stores the JWT under `localStorage` key `authToken` in the documented implementation; the role and username are also stored for UI behavior. Browser-side role checks are for presentation only. The backend remains the authorization boundary.

### Admin module architecture

- `admin.js`: admin page entry/orchestration;
- `admin_api.js`: administrative API requests;
- `admin_events.js`: UI/event wiring and coordination;
- `admin_state.js`: admin-page state;
- `admin_ui.js`: rendering and UI updates;
- `logs.js`: audit-log UI behavior;
- `users.service.js`: shared user operations.

Keep API URL construction and request headers in service/API modules. Keep DOM manipulation in UI modules. Keep state mutation predictable and avoid embedding database/business rules in frontend modules.

### Dashboard

- `dashboard.js`: dashboard entry/orchestration;
- `dashboard.controller.js`: dashboard behavior/controller;
- `dashboard.service.js`: dashboard API calls and data preparation;
- `dashboard.charts.js`: chart rendering;
- `dashboard.events.js`: event wiring.

Dashboard statistics are backend-derived. Do not calculate authoritative user or message counts only in the browser; use `/auth/admin/dashboard` and render its response.

### Analytics

- `analytics.js`: analytics entry/orchestration;
- `analytics.controller.js`: filters and controller logic;
- `analytics.service.js`: calls to `/auth/admin/analytics/*` endpoints;
- `analytics.events.js`: user interaction/event wiring.

Analytics date ranges use `Asia/Kolkata` in the backend. Keep the UI's date serialization in `YYYY-MM-DD` and make inclusive range behavior explicit. Analytics count messages associated with conversations in the selected period; do not silently reinterpret the backend's metric definitions.

### Files

- `files.html`: file-management page;
- `js/files/api.js`: file API access;
- `js/files/upload.js`: upload UI/flow.

Use `FormData` for uploads, preserve Bearer authorization for authenticated endpoints, and handle binary download responses as downloads rather than JSON. Share-link downloads are intentionally token-based and do not require a JWT. Never treat a link token as ordinary public metadata; it grants access to the file.

## 9. EventBus and frontend communication

The admin, dashboard, and analytics modules are split into event-oriented modules, but the precise EventBus implementation/API should be verified in the current source before extending it. Search for the existing event registration/dispatch mechanism and follow its naming/payload conventions rather than introducing a second event system. Event handlers should not make hidden network requests with inconsistent error handling; delegate requests to the relevant service module and let controllers coordinate loading/error/success state.

When adding an event:

1. Define its name and payload shape.
2. Register/unregister handlers consistently with the existing lifecycle.
3. Keep the payload free of secrets.
4. Handle duplicate dispatches and loading states.
5. Test the visible behavior and the backend call separately.

## 10. Adding or changing an API

1. Choose the owning service: identity/settings/chat/admin in Auth Service; file/storage/sharing in File Service; dialogue behavior in Rasa/SDK.
2. Add a route in the relevant `app/routes/` or `app/api/` module.
3. Define/reuse Pydantic schemas in `app/schemas/` and ORM/service layers where appropriate.
4. Apply `get_current_user`, `get_current_session`, `require_admin`, or File Service authentication/permission checks as appropriate.
5. Validate ownership and resource relationships in the backend; do not rely on frontend checks.
6. Use consistent error status codes and avoid exposing internal exceptions/secrets.
7. Add audit events for security-sensitive administrative or file-access operations.
8. Update `docs/api.md`, `docs/testing.md`, and relevant UI/service code.
9. Test success, invalid input, missing resources, unauthorized access, and cross-user access.

## 11. Logging, debugging, and code quality

Use Compose logs to investigate service startup and request failures:

```bash
docker compose ps
docker compose logs --tail=200 auth
docker compose logs --tail=200 file_service
docker compose logs --tail=200 rasa
docker compose logs --tail=200 rasa_sdk
docker compose logs --tail=200 nginx
docker compose logs --tail=200 postgres
```

Use browser developer tools for failed requests, console errors, localStorage, and network payloads. Avoid pasting JWTs or secrets into issue trackers. The current Auth Service and File Service use Python logging/HTTP exceptions inconsistently in places; improve diagnostics without exposing token material, passwords, file bytes, master keys, or SQL credentials.

Keep responsibilities separated: routes validate HTTP inputs and authorization; service modules implement file operations; models describe persisted data; schemas validate request/response shapes; frontend API modules perform requests; controllers coordinate UI behavior; UI modules render state.

## 12. Testing during development

Use the project’s existing Rasa story test file `rasa/tests/test_stories.yml` for dialogue regression. For FastAPI endpoints, use their OpenAPI docs and a local browser/API client to exercise requests against a development database. No repository-wide Python test runner or frontend test command could be verified from the supplied file list, so do not assume `pytest`, npm scripts, or a CI test command exists until the actual checkout confirms it.

At minimum, test each change with:

- a successful request;
- invalid/missing input;
- missing or expired token where protected;
- non-admin access for admin routes;
- cross-user/resource access attempts;
- persistence after a service restart when data is meant to persist;
- frontend error/loading states;
- regression tests for adjacent features.

See `docs/testing.md` for scenario-based test cases and `docs/troubleshooting.md` for diagnostics.
