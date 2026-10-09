# SmartChat AI Platform — Troubleshooting Guide

This guide covers the current Docker Compose configuration and the application behaviors documented in the repository. Diagnose the failing service first, prefer read-only inspection, and make the smallest reversible change. Do not delete persistent data, reset the database, remove uploaded files, or replace encryption keys as routine troubleshooting steps.

> **Configuration source of truth:** the root `docker-compose.yml` and `.env.example` determine the configured services, ports, mounts, dependencies, and environment variables. Application-specific behavior should be checked against the relevant source file when it is not described here. Compose configuration alone does not prove an API's exact status codes or application semantics.

## 1. Initial diagnostics

Run commands from the repository root, where `docker-compose.yml` and `.env` are located.

```bash
# Validate and render the Compose configuration. Treat output as sensitive if it
# includes interpolated secrets; do not publish it unredacted.
docker compose config --quiet
docker compose config --services

# Inspect service state and recent logs.
docker compose ps -a
docker compose logs --tail=200 postgres
docker compose logs --tail=200 auth
docker compose logs --tail=200 file_service
docker compose logs --tail=200 rasa_sdk
docker compose logs --tail=200 rasa
docker compose logs --tail=200 nginx

# Follow one service's logs while reproducing an issue.
docker compose logs -f --tail=100 <service>
```

The valid Compose service names are `postgres`, `auth`, `file_service`, `rasa_sdk`, `rasa`, and `nginx`. A service name is not necessarily the same as its generated container name.

For local browser checks, the configured Nginx entry point is `http://localhost:8081`. The Compose file also publishes direct host ports for the backend services and PostgreSQL; these direct ports are useful for local diagnosis but should not be exposed to untrusted networks in a production deployment.

**Do not share** `.env`, full environment dumps, JWTs, passwords, database URLs containing credentials, private keys, `SECRET_KEY`, or `FILE_MASTER_KEY` in logs, screenshots, issue reports, or chat messages.

## 2. Docker startup and container failures

### Compose fails before containers start

**Symptoms:** `docker compose up` reports a parsing, interpolation, build-context, mount, or volume error.

**Possible causes:**

- `.env` is missing or contains invalid/missing interpolation variables.
- The command is being run from the wrong directory.
- A configured build context, Dockerfile, bind-mounted file, or directory is missing.
- One or both external named volumes have not been created.
- A host port is already occupied.

**Diagnostics:**

```bash
docker compose config --quiet
docker compose config --services
docker volume ls
docker ps --format "table {{.Names}}\t{{.Ports}}"
```

Check that `auth_service/Dockerfile`, `file_service/Dockerfile`, `rasa_sdk/Dockerfile`, `rasa/Dockerfile`, `frontend/`, `nginx/nginx.conf`, `postgres/init.sql`, and `postgres/seed.sql` exist at the configured paths.

**Recommended recovery:** create `.env` from `.env.example`, fill in required values, ensure required external volumes exist, and rerun configuration validation. Resolve port conflicts by stopping the conflicting local process or deliberately changing the Compose port mapping and any dependent documentation/client URLs.

### A container exits or restarts repeatedly

**Symptoms:** `docker compose ps -a` shows an exited or repeatedly restarting service.

**Possible causes:** startup exception, missing dependency, invalid environment value, database connection failure, missing Rasa model, Python import/dependency problem, or configuration-file error.

**Diagnostics:**

```bash
docker compose ps -a
docker compose logs --tail=200 <service>
docker compose images
```

**Recommended recovery:** address the first meaningful error in the failing service's logs. If source code or dependencies changed, rebuild the affected service, for example:

```bash
docker compose up --build -d auth
```

Replace `auth` with the affected service name. Rebuilds do not normally remove named volumes or host bind-mounted data, but review any changed mounts before applying them.

### A dependency starts, but the dependent service cannot connect

**Symptoms:** a service starts and then logs connection-refused or timeout errors.

**Possible causes:** Compose startup ordering is mistaken for application readiness; PostgreSQL or an upstream service is still initializing; the dependent service uses the wrong hostname or port.

**Diagnostics:** check `docker compose ps -a` and the logs of both the dependent and upstream services.

**Recommended recovery:** wait for the upstream service to become ready, then restart only the dependent service if it does not recover automatically. The current Compose file uses `depends_on` without health checks or readiness conditions; startup order does **not** guarantee that a dependency is accepting connections.

## 3. Services, ports, dependencies, and network

The current Compose configuration publishes these ports:

| Service | Host → container port | Purpose / notes |
|---|---:|---|
| `postgres` | `5432:5432` | PostgreSQL; internal clients should use `postgres:5432`. |
| `auth` | `8000:8000` | Authentication, chat-history, and administration API. |
| `file_service` | `8001:8001` | File-management API. |
| `rasa_sdk` | `5055:5055` | Custom action server; configured command is `start --actions actions`. |
| `rasa` | `5006:5006` | Rasa HTTP API; starts with API enabled, wildcard CORS, and debug mode. |
| `nginx` | `8081:80` | Static frontend and reverse proxy. |

All services join the `chatbot_network` bridge network. Docker may prefix the network's actual resource name with the Compose project name. Inside this network, use Compose DNS names such as `postgres`, `auth`, `file_service`, `rasa_sdk`, and `rasa`; do not use `localhost` to reach another container. `localhost` inside a container refers to that same container.

The configured dependency relationships are:

- `auth` depends on `postgres`.
- `file_service` depends on `postgres`.
- `rasa_sdk` depends on `auth`.
- `rasa` depends on `rasa_sdk`.
- `nginx` depends on `rasa`, `auth`, and `file_service`.

The Compose file does not declare a `depends_on` relationship from `rasa_sdk` to PostgreSQL directly, even though it injects PostgreSQL connection settings into that service. If action code queries the database during startup or request handling, check PostgreSQL readiness separately.

## 4. Environment variables and secrets

The current `.env.example` defines:

```dotenv
DATABASE_URL=postgresql://chatbot:chatbot@postgres:5432/chatbot
SECRET_KEY=replace_with_a_random_secret
FILE_MASTER_KEY=replace_with_a_generated_fernet_key
POSTGRES_HOST=postgres
POSTGRES_PORT=5432
POSTGRES_USER=chatbot
POSTGRES_PASSWORD=chatbot
POSTGRES_DB=chatbot
```

### What each variable controls

| Variable | Purpose and expected value |
|---|---|
| `DATABASE_URL` | Database URL consumed by File Service through explicit Compose interpolation and by the services that read it. The hostname should be `postgres` for container-to-container access; database, username, and password must match the initialized database. |
| `SECRET_KEY` | Secret used by the application for JWT signing/validation. Use a high-entropy secret and keep it consistent across services that validate the same tokens. |
| `FILE_MASTER_KEY` | Fernet-compatible master key used by the file-encryption key-wrapping implementation. Preserve it securely and back it up with the encrypted files and database metadata. |
| `POSTGRES_HOST` | Database hostname used by components that consume individual PostgreSQL settings; inside Compose, use `postgres`. |
| `POSTGRES_PORT` | Internal PostgreSQL port, currently `5432`. |
| `POSTGRES_USER` | Initial PostgreSQL user supplied to the database container. |
| `POSTGRES_PASSWORD` | Password for the configured PostgreSQL user. The sample value is for local setup only and must not be used as a production credential. |
| `POSTGRES_DB` | Initial database name. It must agree with the database name in `DATABASE_URL` when the application is intended to use that database. |

### Compose interpolation and `env_file` are different

Compose substitutes `${VARIABLE}` expressions while it parses the Compose file. By default, Compose uses a root `.env` file for this interpolation; `.env.example` is only a template and is **not** automatically loaded as `.env`. The `env_file: ./.env` entries inject variables into the environment of `auth`, `file_service`, `rasa_sdk`, and `rasa`. They do not replace the need for Compose interpolation values.

The current file explicitly interpolates `POSTGRES_USER`, `POSTGRES_PASSWORD`, and `POSTGRES_DB` for the PostgreSQL container; `DATABASE_URL` for File Service; and the individual `POSTGRES_*` values for `rasa_sdk`. Keep these values defined in the root `.env` as shown in `.env.example`.

**Symptoms:** warnings about unset variables, empty configuration, database authentication failure, invalid JWTs, or file-decryption errors.

**Diagnostics:**

```bash
# Check only whether required keys are present, without printing their values.
# Run in a shell that supports this syntax (bash/sh).
for name in DATABASE_URL SECRET_KEY FILE_MASTER_KEY POSTGRES_HOST POSTGRES_PORT POSTGRES_USER POSTGRES_PASSWORD POSTGRES_DB; do
  if grep -qE "^[[:space:]]*${name}=" .env 2>/dev/null; then
    printf '%s: present\n' "$name"
  else
    printf '%s: MISSING\n' "$name"
  fi
done

docker compose config --quiet
```

The presence check does not validate whether a value is correct, strong, or mutually consistent. Do not use `cat .env` or publish the rendered output of `docker compose config` to demonstrate configuration.

**Recommended recovery:**

1. If `.env` does not exist, copy `.env.example` to `.env`.
2. Replace the placeholder `SECRET_KEY` with a randomly generated high-entropy secret.
3. Generate a valid Fernet key for `FILE_MASTER_KEY` using the project's supported cryptographic dependency and secure procedure; do not use the literal placeholder.
4. Set a unique PostgreSQL password and ensure `DATABASE_URL` matches the actual database credentials and name.
5. Restart/recreate affected containers so the updated environment is injected.

**Warnings:** Changing `SECRET_KEY` invalidates previously issued JWTs. Changing `FILE_MASTER_KEY` without a verified key-rotation/rewrapping procedure can make existing encrypted files inaccessible. Never generate a replacement key simply to clear an encryption error; first locate the original key backup and confirm which key version wrapped the stored file keys.

## 5. PostgreSQL connectivity, initialization, and persistence

### Connection refused, timeout, or hostname lookup failure

**Symptoms:** Auth Service, File Service, or an action reports database connection errors.

**Possible causes:** PostgreSQL is still initializing, the `postgres` container is unhealthy/exited, `DATABASE_URL` or `POSTGRES_*` settings disagree, a container uses `localhost`, or a service is not attached to the expected network.

**Diagnostics:**

```bash
docker compose ps postgres
docker compose logs --tail=200 postgres
docker compose exec postgres pg_isready
```

From a container on `chatbot_network`, the database host is `postgres` and the internal port is `5432`. Host tools can use `localhost:5432` because Compose publishes that port, provided the host port is available.

**Recommended recovery:** wait until PostgreSQL accepts connections; verify the database URL and individual credentials without exposing their values; then retry the dependent request. If credentials were changed after the database was initialized, changing the Compose environment alone does not necessarily change the password stored inside the existing PostgreSQL cluster. Use an authenticated, reviewed database administration procedure to reconcile it.

### Initialization or seed scripts did not take effect

The Compose file mounts these files read-only into PostgreSQL's initialization directory:

- `./postgres/init.sql` → `/docker-entrypoint-initdb.d/01-init.sql`
- `./postgres/seed.sql` → `/docker-entrypoint-initdb.d/02-seed.sql`

PostgreSQL image initialization scripts ordinarily run when the data directory is initialized for the first time. Editing the scripts does not automatically re-run them against an existing persistent data directory.

**Diagnostics:** check that the host files exist, inspect PostgreSQL startup logs, and query the intended database to verify its schema/data. Use a read-only database client or a carefully scoped SQL query.

**Recommended recovery:** for an existing database, apply an appropriate migration or a reviewed SQL change. Do not remove the data volume merely to force initialization scripts to execute again.

### Database data appears missing after restart

**Possible causes:** the expected volume was not mounted, the wrong Compose project/database is being inspected, initialization used another volume, or data was modified/deleted.

The Compose file declares `chatbot-project_postgres_data` as an **external named volume**, mounted at `/var/lib/postgresql/data`. External volumes must already exist; Compose does not create them automatically.

**Diagnostics:**

```bash
docker volume ls
docker volume inspect chatbot-project_postgres_data
docker compose ps postgres
docker inspect "$(docker compose ps -q postgres)"
```

Review the container's `Mounts` section and verify the exact volume name and destination. Be aware that the last command requires a running/created `postgres` container and returns broader metadata; do not post unredacted inspect output if it includes sensitive environment information.

**Recommended recovery:** stop and identify the intended environment before changing mounts. If the expected external volume is missing, restore it from a verified backup or create a new empty volume only when provisioning a genuinely new environment. Creating a volume with the expected name does not recover data from a missing volume.

**Warning — data loss:** `docker compose down -v`, `docker volume rm`, or deleting/reinitializing the database data directory can permanently remove database state. Do not run these commands as routine troubleshooting.

## 6. Alembic migrations and schema mismatches

**Symptoms:** File Service reports missing tables/columns, fails to query file metadata or permissions, or reports a migration revision mismatch.

**Possible causes:** migrations have not been applied to the intended database, the application code and schema are from different revisions, or a migration partially failed.

**Diagnostics:**

```bash
docker compose logs --tail=200 file_service
docker compose exec file_service alembic current
docker compose exec file_service alembic history
```

**Recommended recovery:**

1. Confirm the File Service is connected to the intended database.
2. Back up the database and verify that the backup is readable.
3. Inspect migration files under `file_service/alembic/versions/` and review the expected schema changes.
4. Apply the project's migration sequence when appropriate:

   ```bash
   docker compose exec file_service alembic upgrade head
   ```

5. Recheck `alembic current`, service logs, and the failing operation.

Do not delete `alembic_version`, manually stamp a revision, or rerun a partially applied migration without understanding the schema and data effects. If the migration fails, preserve the error and inspect the migration operations before retrying.

The Auth Service startup path uses SQLAlchemy metadata table creation in the current source; this should not be treated as a substitute for versioned migrations when changing an existing schema. If Auth tables are missing, inspect its startup logs, model imports, database URL, and actual schema before attempting manual DDL.

## 7. Authentication, JWT, registration, and admin authorization

### Login fails for an existing user

**Possible causes:** wrong credentials, database connection issue, wrong database, malformed user record, or frontend request routed to the wrong URL.

**Diagnostics:** inspect `auth` logs, the browser Network panel, and the configured database. Avoid exposing passwords or token values in reports.

**Recommended recovery:** verify the account exists in the intended database and use the normal login flow. The current login handler returns a generic invalid-credentials response for an unknown username or an incorrect password; do not rely on different messages to distinguish these cases.

### Protected API returns 401

**Possible causes:** missing/malformed Bearer token, expired JWT, inconsistent signing secret, or missing required token claims.

**Diagnostics and recovery:**

- Confirm the client sends `Authorization: Bearer <JWT>`.
- Inspect the browser Network panel to verify the request URL and response; never copy the token into a ticket.
- The frontend uses local-storage key `authToken` in the documented implementation. If it is absent, use the normal login flow rather than manually inserting a token.
- Log in again if the token has expired. The current implementation's JWT lifetime is 60 minutes.
- Check that Auth Service and File Service receive the same `SECRET_KEY` and compatible JWT validation configuration.
- Verify the request includes the claims required by that endpoint. Current chat routes use `user_id` and `session_id`; inspect the route/dependency implementation if the failure persists.

Changing `SECRET_KEY` invalidates existing tokens. Avoid changing it in response to one user's token problem unless the key is actually compromised or incorrect.

### Admin endpoint returns 403

**Possible causes:** the token is valid but the server-side role is not `admin`, the token contains an old role claim, or a file operation failed its ownership/permission check.

**Diagnostics:** check the account's persisted role and the `require_admin` dependency in `auth_service/app/core/dependencies.py`; compare the role represented by a freshly issued token. A frontend role value or local-storage edit does not grant server-side privileges.

**Recommended recovery:** correct the role through the authorized administrative process, then sign in again to obtain a token reflecting the current role. Do not weaken or bypass `require_admin` to make the UI load.

### Registration is disabled or duplicate registration fails

The registration route checks the persisted `allow_user_registration` setting. When the setting is absent, the current implementation defaults registration to enabled; a stored value other than case-insensitive `true` disables it.

**Diagnostics:** inspect the public settings response and the persisted settings through the authorized admin interface/API. Check `auth` logs for the exact failure.

**Recommended recovery:** if registration should be enabled, use the admin settings mechanism to set `allow_user_registration` to `true`. Do not edit database values blindly. Public registration and admin-created user operations may use different status codes for duplicate usernames; check the relevant handler rather than assuming the same response for both.

### Maintenance mode blocks chat

The current chat-history write route returns `503` for non-admin users when `maintenance_mode=true`; the implementation does not apply that block to admin users.

**Diagnostics:** inspect `GET /auth/admin/settings/public` through the configured Nginx route or direct local Auth Service port, and review Auth Service logs.

**Recommended recovery:** an authorized administrator can update the setting using the admin settings interface/API. If maintenance mode is intended, the response is expected rather than a service failure.

### Message rejected for length

The chat-history route validates message length against `max_message_length`; the current fallback is `5000` when the stored value is missing or invalid. An over-limit message returns `400` in the current implementation.

**Recommended recovery:** check the effective setting through the admin interface/public settings response and inspect the actual request body. Backend validation is authoritative; changing browser-side validation alone does not change the server limit.

### Public settings contain unexpected keys or omit expected values

The current public settings allowlist contains `application_name`, `max_message_length`, `maintenance_mode`, and `allow_user_registration`, with defaults used for missing settings. Review `PUBLIC_SETTING_KEYS` and the public settings route in `auth_service/app/routes/admin_system.py` if the response differs.

Do not resolve a public settings problem by returning every stored administrative setting to unauthenticated callers.

## 8. Chat history, sessions, and message persistence

### Chat saves but does not appear in history

**Possible causes:** the client is using a different login session, the history belongs to another user, the request failed before persistence, or the frontend is calling a different API route.

The current chat-history routes derive the user and session context from the authenticated token. Login creates a new session ID, so signing in again can create a different current session from the one associated with earlier chat history.

**Diagnostics:** inspect the browser Network panel, `auth` logs, the login response without exposing the token, and the database's conversation/message records using a read-only query. Confirm the query is scoped to the expected user and session.

**Recommended recovery:** use the expected account and login session, then reload history. Do not weaken user/session filtering to make old conversations appear.

### History endpoint reports no history

The current route can return `404 No chat history found for this session` when no conversation matches both the authenticated user and the current token session. This does not prove the database is empty; records may belong to another session.

### Messages are missing or counts differ

Check whether the conversation record exists, whether message records are associated with the expected conversation, and whether the frontend handles empty results correctly. Inspect `auth_service/app/routes/chat.py`, the chat models, and the relevant frontend chat/history services. Do not manually insert or reassign records before taking a backup and confirming the intended ownership/session relationship.

## 9. File uploads, downloads, encryption, and permissions

### Upload fails or file is missing after container recreation

The Compose file bind-mounts the host directory `./file_service/uploads` to `/app/uploads` in `file_service`. It is not a named Docker volume.

**Diagnostics:**

```bash
docker compose ps file_service
docker compose logs --tail=200 file_service
ls -la ./file_service/uploads
```

Use the appropriate directory-listing command for the host OS. Check host directory permissions, available disk space, file metadata in the database, and the service's storage path configuration.

**Recommended recovery:** ensure the host directory exists and is writable by the process in the container. If it is empty, verify that the correct repository checkout/working directory is being used; the relative bind-mount path is resolved from the Compose project configuration. Do not delete or overwrite existing encrypted objects while investigating.

### Download fails with encryption/key error

The current File Service requires `FILE_MASTER_KEY` for the key-wrapping/decryption path. A missing key or a key that differs from the one used to wrap existing file keys can prevent decryption.

**Diagnostics:** check whether the variable is present in the File Service container without printing its value; inspect File Service logs and confirm the database metadata, encrypted file object, and key records correspond to one another.

**Recommended recovery:** restore the original master key from a trusted secret backup if it was lost or changed. Review the repository's key-migration scripts and test any migration against copies of both the database and upload directory before using them.

**Warning:** generating a new `FILE_MASTER_KEY` does not decrypt files encrypted under the old key. Keep the database, encrypted file objects, and correct master key version backed up together.

### File is visible but download returns 403

The current download path checks ownership or an applicable `file_permissions` entry granting `READ`. Confirm the authenticated user ID, file owner, recipient ID, and persisted permission value. Listing a file does not by itself prove that the caller is allowed to download it.

### Direct sharing is rejected

The current `POST /files/{file_id}/share` implementation is owner-only. A non-owner is rejected; a nonexistent file is not found. Check the file ID and the caller identity before changing permissions.

### File deletion leaves disk usage behind

Database metadata deletion and physical file cleanup are separate concerns. Inspect `file_service/app/services/file_service.py` to determine the implemented cleanup behavior. If orphaned encrypted objects are suspected, compare the database records and storage directory and use a reviewed cleanup procedure after backup. Do not indiscriminately delete files from `file_service/uploads/`.

## 10. File sharing and share links

### Recipient cannot download a directly shared file

Check that the share operation targeted the correct recipient and that a `READ` permission was stored for the expected file. Confirm the recipient is logged into the correct account and sends a valid Bearer token. Review File Service logs and the file permission record.

### Share link returns not found, expired, or download limit reached

The current share-link download route uses the link token as the access credential; `GET /files/shared/{token}` does not require a JWT. Treat the token as a secret and avoid logging or sharing the complete URL.

The current implementation reports these conditions distinctly:

- `404 Share link not found`: the token is wrong, incomplete, or the link record does not exist.
- `410 Share link has expired`: the configured expiry has passed.
- `410 Share link download limit reached`: the configured maximum successful downloads has been reached.

**Diagnostics:** check the token URL for truncation without copying it into a ticket; inspect the corresponding share-link record using a read-only query and compare `download_count`, `expires_at`, and `max_downloads`. Verify the underlying file record, encrypted object, and key metadata also exist.

**Recommended recovery:** create a new link using the normal authorized flow if the old link is invalid or exhausted. Do not bypass expiry/download-limit checks in production.

**Implementation caveat:** verify the current route's `expires_at is None` branch before depending on non-expiring links. If a link with no expiry fails unexpectedly, reproduce the issue with a disposable file and test a code correction that safely handles a null expiry value.

### Link exists but download fails

A valid link can still fail if the underlying file or encryption-key record is missing, `FILE_MASTER_KEY` is wrong, or the stored file object cannot be read/decrypted. Diagnose the file-download path first. In the current implementation, successful share-link downloads update the download count and create an audit event; confirm the exact path before assuming failed downloads should be counted.

## 11. Audit logs and administrative operations

### Expected audit event is missing

Inspect the route's success path and the applicable audit service, including `auth_service/app/core/audit.py` and `file_service/app/services/audit_service.py`. Administrative user/settings operations and file operations do not necessarily use the same audit implementation.

Do not assume every failed request is audited. Verify the specific handler and whether the operation reached the point where it writes the audit record.

### Audit log page or CSV export fails

**Possible causes:** invalid/expired admin JWT, non-admin role, bad query parameters, proxy routing issue, or frontend treating CSV as JSON.

**Diagnostics:** check the browser Network panel and `auth` logs; confirm the user has the required role. In the current implementation, the audit-log `page_size` parameter is limited to 1–200, and CSV export uses the `level` and `search` filters and returns a file named `system_logs.csv`.

**Recommended recovery:** use valid query parameters and ensure the frontend handles the CSV response as a download. Check the relevant admin route and UI code if response shape or filtering differs.

### Recorded IP address appears to be a Docker gateway

Nginx and Docker networking can cause a backend to observe a proxy or gateway address rather than the original client address.

**Diagnostics:** inspect `nginx/nginx.conf` forwarded headers such as `X-Real-IP` and `X-Forwarded-For`, then check how the backend handles them.

**Recommended recovery:** configure trusted-proxy behavior deliberately if original client IP auditing is required. Only trust forwarded headers from a known proxy; clients may spoof them when they can reach a backend directly. The Compose file publishes backend ports, so production network exposure should be reviewed.

## 12. Dashboard and analytics

### Dashboard totals differ from expectations

The current dashboard's `active_users` metric means distinct users with at least one conversation; it does not mean users active during the last 24 hours. The seven-day activity chart uses `Asia/Kolkata`; conversation counts are based on `chat_history.timestamp`, and message counts are joined through the parent conversation.

**Diagnostics:** compare the API response with the same database scope, time zone, and metric definition. Check admin authorization and the browser Network panel before debugging chart rendering.

### Analytics dates or totals appear shifted

The current analytics implementation uses `Asia/Kolkata`, defaults to a 30-day inclusive range ending today, and scopes message counts through the parent conversation timestamp in the current query. Date inputs should use ISO format `YYYY-MM-DD`. Daily activity may include zero-filled days.

**Recommended recovery:** verify both date boundaries sent by the frontend, compare the API response with the intended time zone and query semantics, and inspect `auth_service/app/routes/admin_analytics.py` plus `analytics.service.js` / `analytics.controller.js` when frontend and backend expectations differ.

### Chart is blank but API responds

Inspect browser console errors, the response JSON shape, and the dashboard/analytics frontend modules. In particular, check `dashboard.charts.js`, `dashboard.service.js`, `analytics.service.js`, and `analytics.controller.js`. Confirm the UI handles empty arrays and does not parse a response body twice. Do not assume a chart issue is a database issue until the returned data is inspected.

## 13. Nginx, frontend, API routing, and CORS

### Frontend or login page does not load

The current Compose configuration mounts `./frontend` read-only at `/usr/share/nginx/html` and mounts `./nginx/nginx.conf` as the default Nginx configuration. The configured host entry point is `http://localhost:8081`.

**Diagnostics:**

```bash
docker compose ps nginx
docker compose logs --tail=200 nginx
```

Check that the expected frontend files exist under `frontend/` and that the Nginx configuration references the intended entry page. A `403` or `404` may indicate an incorrect index/try-files rule or missing file; use the current `nginx/nginx.conf` rather than relying on a remembered default.

### API returns 404 or 502 through Nginx

The existing Nginx configuration routes `/auth/` to `auth:8000`, `/rasa/` to `rasa:5006`, and `/files/` to `file_service:8001`. Verify exact prefix and `proxy_pass` behavior in `nginx/nginx.conf`; prefix stripping and application root paths must agree.

- `404` often indicates a wrong path, prefix mismatch, or missing route.
- `502` often indicates the upstream service is stopped, not ready, or unreachable from Nginx.

Check Nginx logs and the corresponding upstream service logs. Test the public Nginx URL and, for local diagnosis only, the direct host port. Do not randomly add or remove route prefixes on both sides at once.

### Browser reports a CORS error

A CORS message may indicate an origin mismatch or may mask a failed/incorrect API request. The current Auth Service source has an allowlist for `http://localhost:8081`; verify the current middleware before changing it. Rasa is started with `--cors "*"` in the current Compose command.

**Recommended recovery:** prefer same-origin frontend requests through Nginx where supported. For another development origin, update the appropriate allowlist deliberately. Do not use wildcard CORS with credentials as a shortcut. Review the Rasa wildcard CORS and debug configuration before production deployment.

### Frontend has no token or appears logged out

The documented frontend token key is `authToken`. If it is absent or invalid, use the login flow and inspect the login response and browser Network panel. Do not manually insert a production JWT or use browser storage edits to bypass authentication.

## 14. Rasa and Rasa SDK

### Rasa starts but does not respond to chat requests

The current Rasa container is built from `./rasa`, mounts `./rasa` at `/app`, and mounts external volume `chatbot-project_rasa_models` at `/app/models`. It runs with this command configuration:

```text
run --enable-api --cors "*" --debug --endpoints endpoints.yml -i 0.0.0.0 -p 5006
```

**Diagnostics:**

```bash
docker compose ps rasa
docker compose logs --tail=200 rasa
docker volume inspect chatbot-project_rasa_models
```

Check that the expected model is present in the mounted model directory and that Rasa's configuration, domain, training data, and `endpoints.yml` match the current source. Do not assume the image build includes a model if the external model volume is empty.

### Custom action server is unavailable

The `rasa_sdk` service is built from `./rasa_sdk`, mounts `./rasa_sdk/actions` at `/app/actions`, and runs `start --actions actions` on container port `5055` (published as host port `5055`). Rasa depends on `rasa_sdk`, but Compose does not wait for the action server to be ready.

**Diagnostics:**

```bash
docker compose ps rasa_sdk
docker compose logs --tail=200 rasa_sdk
docker compose logs --tail=200 rasa
```

Check `rasa/endpoints.yml` for the action endpoint and ensure it uses the Compose service hostname and internal port rather than `localhost`. Verify action names and code in `rasa_sdk/actions/actions.py`, and inspect helper modules `auth.py`, `auth_utils.py`, `database.py`, and `utils.py` as relevant.

### NLU/story tests fail after dialogue changes

Update the relevant Rasa domain, NLU, story, or rule files and the existing `rasa/tests/test_stories.yml` when expected dialogue behavior changes. Use the test command supported by the Rasa version in the container; inspect the installed CLI help rather than assuming the command syntax. Distinguish intent-classification problems from action-server, database, or API failures by checking each service's logs.

**Production review:** the current Compose command enables `--debug` and `--cors "*"`. These are development-oriented settings and should be deliberately reviewed and restricted before production use.

## 15. Docker volumes, backup, and restore

### Persistent resources in the current Compose file

| Resource | Type | Mount / use |
|---|---|---|
| `chatbot-project_postgres_data` | External named Docker volume | PostgreSQL data at `/var/lib/postgresql/data`. |
| `chatbot-project_rasa_models` | External named Docker volume | Rasa models at `/app/models`. |
| `./file_service/uploads` | Host bind mount | File Service storage at `/app/uploads`. |
| `./auth_service` | Host bind mount | Mounted at `/app` in Auth Service for development/source access. |
| `./rasa_sdk/actions` | Host bind mount | Mounted at `/app/actions` in Rasa SDK. |
| `./rasa` | Host bind mount | Mounted at `/app` in Rasa. |
| `./frontend` | Read-only host bind mount | Nginx document root `/usr/share/nginx/html`. |
| `./nginx/nginx.conf` | Read-only host file mount | Nginx virtual-host configuration. |
| `./postgres/init.sql`, `./postgres/seed.sql` | Read-only host file mounts | PostgreSQL first-initialization scripts. |

The two named volumes are declared `external: true`; they must already exist before `docker compose up`. Do not assume Compose will create them. The actual `chatbot_network` Docker resource name may include a Compose project prefix; that does not change the explicit external volume names.

**Safe inspection:**

```bash
docker volume ls
docker volume inspect chatbot-project_postgres_data
docker volume inspect chatbot-project_rasa_models
docker compose ps -a
```

If an expected external volume is missing, first confirm the active Compose project and whether the volume exists under another Docker context/host. Creating a new empty volume with the same name is not recovery of the old data.

### Backup strategy

A database dump alone is insufficient to restore encrypted file functionality. A recovery set should include, as applicable:

- PostgreSQL database backup/metadata;
- the matching encrypted objects from `file_service/uploads/`;
- the correct `FILE_MASTER_KEY` and any relevant key-version/rotation information, stored securely;
- application configuration and migration/source revision information;
- the Rasa model volume if preserving trained model state is required.

Back up the database and upload directory in a coordinated way so metadata and file objects remain consistent. Securely protect backups because they can contain user data and encrypted objects. Preserve secrets separately using the project's approved secret-storage process.

The repository includes `scripts/backup_db.sh`; inspect its content and invocation requirements before use, and verify the backup artifact rather than assuming the script completed successfully. Do not infer a restore command without inspecting the script and available tooling.

### Restore approach

Test restoration in a separate environment first:

1. Confirm the destination environment and take a backup of any data currently there.
2. Restore the database using the documented procedure for the backup format.
3. Restore the matching encrypted upload tree and the correct master key securely.
4. Verify database connectivity and apply only the migrations required for the restored revision.
5. Verify representative file downloads/decryption, permissions, share links, chat history, and audit records.
6. Confirm Rasa model availability if that volume is part of the recovery scope.

**Destructive operations:** `docker compose down -v`, `docker volume rm`, deleting `file_service/uploads/`, manually clearing `/var/lib/postgresql/data`, or initializing PostgreSQL against an empty data directory can cause permanent data loss. Replacing `FILE_MASTER_KEY` can make existing files undecryptable. Do not run these operations unless the environment is confirmed disposable or a verified, restorable backup and explicit recovery plan exist.

## 16. Safe recovery checklist

- [ ] Record the exact symptom, timestamp, service, and request path; redact credentials and tokens.
- [ ] Run `docker compose config --quiet` and `docker compose ps -a` from the repository root.
- [ ] Read recent logs for the failing service and its upstream dependencies.
- [ ] Confirm `.env` exists and required keys are present without printing secret values.
- [ ] Confirm `DATABASE_URL` and `POSTGRES_*` values agree, and container-to-container database traffic uses `postgres:5432`.
- [ ] Verify the external volumes exist and inspect their mounts before changing storage.
- [ ] For schema errors, inspect Alembic state and back up the database before applying migrations.
- [ ] For JWT failures, check token freshness and consistent `SECRET_KEY`; for file decryption failures, confirm the original `FILE_MASTER_KEY`.
- [ ] Reproduce security-sensitive problems with disposable users/files where possible; do not bypass ownership, role, expiry, or permission checks.
- [ ] Make one reversible change at a time and repeat the relevant smoke/regression test.
- [ ] Before any data-changing recovery, verify the backup artifact and the restore procedure in a separate environment.
- [ ] After recovery, verify logs, core login/chat/file flows, admin-only operations, and the affected service's status.

## 17. Configuration validation summary

Before committing a troubleshooting fix, verify that:

- All six Compose services and their host/container ports match the current Compose file.
- All eight `.env.example` variables are documented and configured where required.
- Internal database URLs use `postgres:5432`, not container-local `localhost`.
- `chatbot-project_postgres_data` and `chatbot-project_rasa_models` are identified as pre-existing external volumes.
- `./file_service/uploads` is correctly identified as a host bind mount.
- PostgreSQL initialization scripts are described as first-initialization scripts, not recurring migrations.
- `depends_on` is documented as ordering, not readiness; no Compose health checks are currently configured.
- The Rasa command, model mount, action-server command, and service dependencies match the current configuration.
- Debug mode and wildcard Rasa CORS are flagged for production review.
- Destructive commands carry explicit data-loss warnings.
- Unverified application details are checked against source before being treated as guaranteed behavior.
