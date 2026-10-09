# SmartChat AI Platform — Deployment Guide

## 1. Purpose and Scope

This guide documents how to deploy, configure, verify, maintain, and troubleshoot the SmartChat AI Platform using the repository's Docker Compose configuration.

It complements the existing project documentation:

* `README.md` — project overview, features, and quick start.

* `architecture.md` — service architecture, components, and internal design.

* `deployment.md` — deployment prerequisites, configuration, storage, startup, migrations, verification, backups, security, and operational procedures.

The guide distinguishes the current implementation from recommended production hardening. Recommendations are not claims that additional security controls or infrastructure have already been implemented.

> Deployment status: The supplied Compose configuration provides a containerized deployment suitable for local development, testing, and deployment validation. It should not be considered production-hardened without reviewing its published ports, secrets, TLS configuration, Rasa debug settings, CORS policy, persistent storage, and operational controls.

## 2. Deployment Architecture

SmartChat AI Platform combines a browser-based frontend, backend APIs, conversational AI services, and PostgreSQL storage. Docker Compose connects the containers through a bridge network named `chatbot_network`.

### 2.1 Architecture diagram

```
                          Browser
                             |
                             | HTTP :8081
                             v
                      +--------------+
                      |    Nginx     |
                      | Static UI    |
                      | Reverse Proxy|
                      +------+-------+
                             |
             +---------------+----------------+
             |               |                |
             v               v                v
      +-------------+  +-------------+  +-------------+
      | Auth Service|  | Rasa Server |  | File Service|
      | FastAPI     |  | :5006       |  | :8001       |
      | :8000       |  +------+------+  +------+------+
      +------+------+         |                 |
             |                v                 |
             |         +-------------+          |
             |         |   Rasa SDK  |          |
             |         |    :5055    |          |
             |         +------+------+          |
             |                |                 |
             +----------------+-----------------+
                              |
                              v
                       +-------------+
                       | PostgreSQL  |
                       |    :5432    |
                       +-------------+

  Persistent storage:
    PostgreSQL data       -> chatbot-project_postgres_data
    Rasa model artifacts  -> chatbot-project_rasa_models
    Encrypted file data   -> ./file_service/uploads/
```

The diagram represents the principal services and storage relationships. Actual database access depends on each component's implementation and configuration.

### 2.2 Docker Compose services

The current `docker-compose.yml` defines six services.

| Service        | Build or image              | Responsibility                                                                               | Internal address    |
| -------------- | --------------------------- | -------------------------------------------------------------------------------------------- | ------------------- |
| `nginx`        | `nginx:latest`              | Serves the static frontend and routes browser API requests                                   | `nginx:80`          |
| `auth`         | `./auth_service/Dockerfile` | FastAPI authentication and application APIs, including user and administrative functionality | `auth:8000`         |
| `file_service` | `./file_service/Dockerfile` | File upload/download, encrypted file storage, and file-related operations                    | `file_service:8001` |
| `rasa`         | `./rasa/Dockerfile`         | Conversational AI server and HTTP API                                                        | `rasa:5006`         |
| `rasa_sdk`     | `./rasa_sdk/Dockerfile`     | Custom Rasa action server                                                                    | `rasa_sdk:5055`     |
| `postgres`     | `postgres:16`               | Relational database                                                                          | `postgres:5432`     |

Backend services communicate using Docker Compose service names, not `localhost`. For example, the database hostname within the Compose network is `postgres`, and its internal port is `5432`.

The `chatbot_network` bridge network allows these containers to communicate. It does not, by itself, prevent access through host ports published by Docker.

### 2.3 Service dependencies and startup order

The supplied configuration defines these dependencies:

* `auth` depends on `postgres`.

* `file_service` depends on `postgres`.

* `rasa_sdk` depends on `auth`.

* `rasa` depends on `rasa_sdk`.

* `nginx` depends on `rasa`, `auth`, and `file_service`.

Docker Compose uses `depends_on` to control startup ordering. It does not necessarily guarantee that a dependency has completed initialization and is ready to accept requests. For example, PostgreSQL may still be initializing when an API container starts.

If an initial request fails, inspect the relevant service logs and retry once the dependency is ready.

## 3. System Prerequisites

Install the following on the deployment host:

* Git — to clone and update the repository.

* Docker Desktop — on Windows or macOS; or Docker Engine and Docker Compose on Linux.

* Internet connectivity — to retrieve container images and build dependencies when required.

* Sufficient disk space — for Docker images, PostgreSQL data, Rasa model artifacts, logs, and encrypted uploaded files.

Verify Docker and Compose:

Bash

```
docker --version
docker compose version
```

Confirm that Docker is running before proceeding.

A local Python virtual environment is not required to deploy the application because its services run in containers. Python may optionally be used locally to generate secrets.

## 4. Repository Setup

Clone the repository and enter its root directory:

Bash

```
git clone https://github.com/Keerthana-PMalode/SmartChat-AI-Platform.git
cd SmartChat-AI-Platform
```

Run Docker Compose commands from the repository root, where `docker-compose.yml` and the environment configuration are located.

### 4.1 Create the environment file

Copy the example configuration.

Linux/macOS:

Bash

```
cp .env.example .env
```

Windows PowerShell:

PowerShell

```
Copy-Item .env.example .env
```

Edit `.env` using a local text editor and replace placeholder values before starting the application.

Security requirement: `.env` contains secrets and must not be committed to Git. Keep it protected on the deployment host and verify that it is excluded from version control.

### 4.2 Deployment-relevant repository paths

| Path                          | Purpose                                                                         |
| ----------------------------- | ------------------------------------------------------------------------------- |
| `docker-compose.yml`          | Defines services, build contexts, ports, volumes, dependencies, and the network |
| `.env.example`                | Template for environment variables                                              |
| `.env`                        | Local deployment configuration and secrets                                      |
| `auth_service/`               | Authentication and application API source                                       |
| `file_service/`               | File-management API, Alembic migrations, scripts, and upload storage            |
| `rasa/`                       | Rasa configuration, dialogue data, endpoints, and model directory               |
| `rasa_sdk/actions/`           | Custom Rasa action implementations                                              |
| `frontend/`                   | Static HTML, CSS, JavaScript, and frontend assets                               |
| `nginx/nginx.conf`            | Nginx routing configuration                                                     |
| `postgres/init.sql`           | PostgreSQL first-initialization script                                          |
| `postgres/seed.sql`           | PostgreSQL initial seed data                                                    |
| `postgres/current_schema.sql` | Schema reference file                                                           |
| `scripts/backup_db.sh`        | Database backup helper                                                          |
| `scripts/build.sh`            | Project build helper                                                            |
| `scripts/start.sh`            | Project startup helper                                                          |
| `scripts/stop.sh`             | Project shutdown helper                                                         |

The Docker deployment does not require a local `.venv/` directory. Python virtual environments, `__pycache__/`, and other runtime-generated files are development artifacts rather than prerequisites for starting the containers.

The `file_service/uploads/` directory is runtime storage. Uploaded files must not be committed to Git.

## 5. Environment Configuration and Secrets

The supplied `.env.example` documents the following variables:

dotenv

```
DATABASE_URL=postgresql://chatbot:chatbot@postgres:5432/chatbot

SECRET_KEY=replace_with_a_random_secret
FILE_MASTER_KEY=replace_with_a_generated_fernet_key

POSTGRES_HOST=postgres
POSTGRES_PORT=5432
POSTGRES_USER=chatbot
POSTGRES_PASSWORD=chatbot
POSTGRES_DB=chatbot
```

### 5.1 Environment variable reference

| Variable            | Purpose                                                                       | Requirement                                                                     |
| ------------------- | ----------------------------------------------------------------------------- | ------------------------------------------------------------------------------- |
| `DATABASE_URL`      | Database connection string used by the services                               | Match the PostgreSQL hostname, port, database, and credentials                  |
| `SECRET_KEY`        | Application secret used by authentication-related code                        | Replace the placeholder with a strong, randomly generated secret                |
| `FILE_MASTER_KEY`   | Fernet key used to protect stored file-encryption keys                        | Use a valid, securely generated Fernet key and retain a protected recovery copy |
| `POSTGRES_HOST`     | Database hostname used by components that read individual connection settings | Use `postgres` within the Compose network                                       |
| `POSTGRES_PORT`     | Database port used by components that read individual connection settings     | Use `5432` within the Compose network                                           |
| `POSTGRES_USER`     | PostgreSQL initialization user                                                | Configure a deployment-specific user                                            |
| `POSTGRES_PASSWORD` | PostgreSQL initialization password                                            | Replace the example with a strong, unique password                              |
| `POSTGRES_DB`       | PostgreSQL database name                                                      | Match the database named in `DATABASE_URL`                                      |

The `chatbot` credentials shown in the example are placeholders for setup purposes. They are not appropriate production credentials.

When changing the PostgreSQL user, password, or database, update `DATABASE_URL` consistently. If a password contains URI-reserved characters, ensure it is encoded correctly in the connection string.

### 5.2 Generate a strong application secret

A local Python installation can generate a high-entropy secret using the standard library:

Bash

```
python -c "import secrets; print(secrets.token_urlsafe(48))"
```

Use `python3` instead of `python` if that is the executable name on your system. Copy the generated value into `.env` as `SECRET_KEY`.

This command is only a local secret-generation method; it does not mean the application must be run outside Docker.

### 5.3 Generate a valid Fernet key

If the `cryptography` package is available in your local Python environment, generate a Fernet key with:

Bash

```
python -c "from cryptography.fernet import Fernet; print(Fernet.generate_key().decode())"
```

The command requires `cryptography` to be installed in that local environment. Do not assume it is installed. If it is unavailable, use an approved, trusted key-generation process that produces a valid Fernet key.

Do not replace the key with an arbitrary password or manually constructed string.

### 5.4 Protect `FILE_MASTER_KEY`

The File Service stores encrypted file contents separately from PostgreSQL. The database holds associated metadata and wrapped file-encryption keys; the master key is required to unwrap those keys.

```
Uploaded file
     |
     v
Encrypted file contents
     |
     +----------------------> file_service/uploads/
     |
     v
File encryption key
     |
     v
Wrapped using FILE_MASTER_KEY
     |
     v
Stored key metadata in PostgreSQL
```

> Critical: Losing `FILE_MASTER_KEY` can make existing encrypted uploads impossible to decrypt. Replacing it after files have been encrypted may also make existing wrapped keys unusable unless a supported key-migration procedure is performed.

Store a protected recovery copy separately from the application host. Restrict access to the key and include it in a carefully controlled recovery plan. Do not commit it to Git or include it in an ordinary application log.

### 5.5 PostgreSQL credentials and persistent data

The PostgreSQL service uses `POSTGRES_USER`, `POSTGRES_PASSWORD`, and `POSTGRES_DB` when initializing a new data directory.

Because PostgreSQL data persists in `chatbot-project_postgres_data`, changing these variables later does not automatically recreate database roles, change existing passwords, or rename an existing database. Plan credential changes using an appropriate database administration procedure and verify that the application connection string matches the actual database configuration.

Do not remove the PostgreSQL volume merely to apply a changed environment variable.

## 6. Persistent Storage

Before starting the application, prepare the persistent volumes and upload directory.

### 6.1 Create the external Docker volumes

The Compose file declares two external volumes:

* `chatbot-project_postgres_data`

* `chatbot-project_rasa_models`

Because these are marked `external: true`, Docker Compose expects them to exist already.

Create them:

Bash

```
docker volume create chatbot-project_postgres_data
docker volume create chatbot-project_rasa_models
```

Verify the volumes:

Bash

```
docker volume ls
```

| Volume                          | Container mount            | Purpose                             |
| ------------------------------- | -------------------------- | ----------------------------------- |
| `chatbot-project_postgres_data` | `/var/lib/postgresql/data` | Persistent PostgreSQL database data |
| `chatbot-project_rasa_models`   | `/app/models`              | Persistent Rasa model artifacts     |

> Data-loss warning: Do not delete these volumes during routine troubleshooting, restarting, or updating. They contain persistent application data and model artifacts. Destructive storage operations should only be considered deliberately, with verified backups and a clear understanding of their consequences.

### 6.2 Prepare File Service storage

The File Service uses a host-directory bind mount:

```
Host:      file_service/uploads/
Container: /app/uploads
```

Ensure the directory exists.

Linux/macOS:

Bash

```
mkdir -p file_service/uploads
```

Windows PowerShell:

PowerShell

```
New-Item -ItemType Directory -Force -Path "file_service/uploads"
```

Confirm that Docker can access the directory and that the container has suitable read/write permissions.

Encrypted file contents reside in this directory, while related metadata and wrapped encryption keys are stored in PostgreSQL. Preserve both locations during backup, restoration, and migration.

### 6.3 Persistence requirements

| Data                     | Storage location                                | Must be preserved?                                   |
| ------------------------ | ----------------------------------------------- | ---------------------------------------------------- |
| PostgreSQL database      | External volume `chatbot-project_postgres_data` | Yes                                                  |
| Rasa models              | External volume `chatbot-project_rasa_models`   | Preserve according to the model recovery/update plan |
| Encrypted uploaded files | `file_service/uploads/` on the host             | Yes                                                  |
| Master encryption key    | Secret configuration/recovery storage           | Yes                                                  |
| Deployment configuration | `.env` and other relevant configuration files   | Preserve securely                                    |

A database backup alone is not sufficient to restore uploaded files. The encrypted file contents, database records, and correct master key must be available together.

## 7. PostgreSQL Initialization and Seed Data

The PostgreSQL service mounts these files into the PostgreSQL initialization directory:

| Repository file     | Container path                            |
| ------------------- | ----------------------------------------- |
| `postgres/init.sql` | `/docker-entrypoint-initdb.d/01-init.sql` |
| `postgres/seed.sql` | `/docker-entrypoint-initdb.d/02-seed.sql` |

The numeric prefixes establish the initialization order: `01-init.sql` followed by `02-seed.sql`.

PostgreSQL normally executes these initialization scripts when it initializes an empty data directory for the first time. If `chatbot-project_postgres_data` already contains an initialized database, editing `init.sql` or `seed.sql` will not automatically rerun the scripts.

For changes to an existing database, use a reviewed database migration or administration procedure appropriate to the change. Do not assume that restarting the container replays initialization scripts.

> Warning: Removing the PostgreSQL data volume can destroy the database and its persistent records. Never use volume removal as the default way to troubleshoot missing schema or seed data.

## 8. File Service Database Migrations

The File Service uses Alembic to manage database schema revisions.

After the containers are running and PostgreSQL is reachable, apply the migrations:

Bash

```
docker compose exec file_service alembic upgrade head
```

This command applies the available migrations up to the latest revision defined by the checked-out File Service code.

To inspect the current migration revision:

Bash

```
docker compose exec file_service alembic current
```

The `exec` commands require the `file_service` container to be running. If it is not running, inspect the service state and logs first.

### Migration procedure

1. Review the application changes and the associated migration files.

2. Confirm that PostgreSQL is available and the configured connection settings are correct.

3. Ensure a current database backup exists before a production migration.

4. Start the services and wait for the database and File Service to initialize.

5. Apply `alembic upgrade head`.

6. Inspect the migration result and service logs.

7. Test file-management operations and other relevant application behavior.

Migrations should be applied deliberately during deployment and updates. Review their effect on existing data before running them against a production database. Do not invent revision IDs or manually mark migrations as applied without an appropriate recovery plan.

## 9. Build and Start the Application

Run commands from the repository root.

### 9.1 Deployment preparation

Before starting, confirm that:

* Docker and Docker Compose are available.

* `.env` exists and contains valid configuration.

* Example secrets have been replaced.

* Both external Docker volumes have been created.

* `file_service/uploads/` exists and is accessible to Docker.

### 9.2 Start in the foreground

For the first deployment, use:

Bash

```
docker compose up --build
```

This builds the services with local Dockerfiles where configured, pulls the specified images as needed, creates the Compose network, and starts the application.

Foreground mode is useful for the first startup because build and initialization output remains visible in the terminal.

### 9.3 Start in detached mode

To run the services in the background:

Bash

```
docker compose up --build -d
```

The `-d` option runs containers in detached mode. The `--build` option requests image builds before startup.

For a local or production-like deployment, detached mode is convenient after initial validation, but it does not itself make the application production-hardened.

### 9.4 Recommended deployment order

1. Install prerequisites and clone the repository.

2. Create and configure `.env`.

3. Generate and protect the application and encryption secrets.

4. Create both external Docker volumes.

5. Ensure `file_service/uploads/` exists.

6. Build and start the services.

7. Verify container state and review logs.

8. Apply the File Service Alembic migrations.

9. Open the frontend through Nginx.

10. Test authentication, chatbot interaction, file management, and administrative functionality where available.

11. Confirm persistence and backup arrangements.

This sequence prepares persistent resources before startup, checks that the services are available, and applies migrations only after the database can be reached.

## 10. Container and Service Verification

### 10.1 Check Compose service state

Bash

```
docker compose ps
```

List running Docker containers:

Bash

```
docker ps
```

The expected service set is:

* `postgres`

* `auth`

* `file_service`

* `rasa_sdk`

* `rasa`

* `nginx`

A container shown as running is a useful initial check, but it does not prove that the application is fully operational. Confirm that services finish initialization, that required dependencies are available, and that application smoke tests pass.

### 10.2 Review logs

Show the combined logs:

Bash

```
docker compose logs
```

Follow log output continuously:

Bash

```
docker compose logs -f
```

Inspect an individual service:

Bash

```
docker compose logs postgres
docker compose logs auth
docker compose logs file_service
docker compose logs rasa_sdk
docker compose logs rasa
docker compose logs nginx
```

Use the logs to identify database connection errors, migration failures, model-loading problems, API startup failures, and Nginx upstream errors.

Press `Ctrl+C` to stop following logs. This exits the log-following command; it does not stop the containers.

## 11. Application Access and Nginx Routing

### 11.1 Browser-facing URLs

The normal browser-facing entry point is:

* Main frontend: `http://localhost:8081`

* Login page: `http://localhost:8081/login.html`

Nginx serves the frontend files from `frontend/` and loads its routing configuration from `nginx/nginx.conf`.

### 11.2 Browser route overview

The documented routing structure is:

| Browser path | Destination           | Purpose                                   |
| ------------ | --------------------- | ----------------------------------------- |
| `/`          | Nginx static frontend | Frontend pages and assets                 |
| `/auth/*`    | `auth:8000`           | Authentication and application/admin APIs |
| `/rasa/*`    | `rasa:5006`           | Rasa API                                  |
| `/files/*`   | `file_service:8001`   | File-management API                       |

Nginx and the backend containers communicate over `chatbot_network`. Refer to the repository's `nginx/nginx.conf` for the exact routing and proxy configuration; this guide does not assume additional routes beyond the documented paths.

### 11.3 Published host ports

The current Compose configuration publishes the following ports:

| Host port | Service                    | Intended use                    |
| --------- | -------------------------- | ------------------------------- |
| `8081`    | Nginx, container port `80` | Normal browser access           |
| `5432`    | PostgreSQL                 | Development and troubleshooting |
| `8000`    | Auth Service               | Development and troubleshooting |
| `8001`    | File Service               | Development and troubleshooting |
| `5055`    | Rasa SDK                   | Development and troubleshooting |
| `5006`    | Rasa server                | Development and troubleshooting |

The normal browser-facing port is `8081`. The other ports are published by the current Compose configuration but are not required for ordinary browser access through Nginx.

Useful direct development/troubleshooting URLs include:

* Auth Service API documentation: `http://localhost:8000/docs`

* File Service API documentation: `http://localhost:8001/docs`

* Rasa server root: `http://localhost:5006/`

These URLs are not a substitute for checking the actual service behavior, and this guide does not assume that the Rasa root path is a dedicated health-check endpoint.

> Security warning: Published Docker ports may be accessible from other hosts depending on the host network, Docker configuration, firewall, and security-group rules. Restrict access to backend ports that do not need to be reachable externally.

## 12. Application Smoke Testing

After startup and migration, verify the application through its frontend and existing documented operations. Do not assume that an undocumented endpoint exists.

### 12.1 Basic verification checklist

* Nginx loads the frontend at `http://localhost:8081`.

* The login page loads at `/login.html`.

* A valid user can authenticate.

* Authenticated requests to protected functionality succeed.

* Chatbot requests reach Rasa and return a response.

* Rasa can communicate with the Rasa SDK for custom actions.

* Chat history is saved and remains available after a container restart.

* File upload succeeds for an authorized user.

* Uploaded file contents are stored under `file_service/uploads/`.

* The stored uploaded-file contents are encrypted.

* An authorized user can download a file and receive its decrypted contents.

* File authorization and sharing behavior work as expected.

* The admin dashboard loads when an admin account is available.

* Analytics loads when an admin account is available.

* PostgreSQL data persists after restarting application containers.

* Service logs contain no unresolved startup, database, migration, or model-loading errors.

### 12.2 Persistence testing

Choose a known, non-sensitive record or test file and verify that it remains available after restarting the application containers.

Bash

```
docker compose restart
```

After the services finish restarting, repeat the relevant tests.

Do not delete or recreate the persistent volumes as part of persistence testing. The objective is to verify that the configured storage survives container restarts.

## 13. Authentication and Deployment Security

The platform uses JWT authentication for protected application functionality. Deployment security depends on both the application configuration and the host environment.

### 13.1 Required precautions

* Replace the example `SECRET_KEY` with a strong, randomly generated value.

* Use a valid, securely generated `FILE_MASTER_KEY`.

* Replace example PostgreSQL credentials with strong, unique credentials.

* Keep `.env` out of source control.

* Restrict access to the deployment host and secret configuration.

* Protect PostgreSQL and backend API ports from unnecessary external access.

* Protect database backups and encrypted file-storage backups.

* Preserve the master key securely for disaster recovery.

* Use HTTPS/TLS before exposing the application beyond a trusted local environment.

* Review Rasa debug and CORS settings before public deployment.

### 13.2 Current versus recommended exposure

The current Compose configuration publishes all six host ports listed in Section 11.3. For normal browser usage, only the Nginx entry point is needed.

For an internet-facing deployment, prefer Nginx as the public-facing gateway and restrict access to PostgreSQL, Auth Service, File Service, Rasa SDK, and Rasa server ports unless a specific operational requirement justifies exposure.

The Docker bridge network supports communication between services; it is not a replacement for host firewall rules, network access controls, TLS, or secret management.

## 14. Production Hardening

This section contains recommendations for a more secure production deployment. These controls should not be assumed to exist in the current Compose configuration.

### 14.1 HTTPS/TLS and network exposure

* Configure HTTPS/TLS termination at Nginx or an appropriately configured upstream load balancer.

* Restrict published backend ports to trusted administrative or application access.

* Restrict PostgreSQL network exposure to the services and administrators that require it.

* Review host firewall rules and cloud security-group policies.

* Confirm that public traffic reaches the application through the intended gateway.

* Verify the target environment's Nginx routing and TLS configuration.

### 14.2 Secrets and storage

* Replace all placeholder secrets and sample database credentials.

* Use restricted file permissions or an approved secret-management mechanism for `.env`.

* Keep secret material, database backups, and uploaded files out of Git.

* Store a recovery copy of `FILE_MASTER_KEY` separately from the application host.

* Encrypt and restrict access to backups.

* Test restoration of PostgreSQL data and encrypted file contents together.

### 14.3 Review Rasa runtime settings

The current Rasa command in `docker-compose.yml` includes:

```
--cors "*"
--debug
```

These settings require review before public production deployment.

* Restrict CORS to the origins required by the deployment rather than allowing every origin by default.

* Disable unnecessary debug behavior in the production configuration.

* Verify the actual Rasa command and configuration after making any environment-specific changes.

Do not assume that the current debug and CORS settings are suitable for an internet-facing production environment.

### 14.4 Operational reliability

Consider implementing and testing the following controls as part of production preparation:

* Container image pinning: Replace floating image tags such as `nginx:latest` with reviewed, controlled versions.

* Health checks: Define appropriate service health checks and a recovery strategy. `depends_on` alone does not establish application readiness.

* Resource limits: Evaluate CPU, memory, database, model-loading, and storage requirements for expected workloads.

* Log monitoring: Establish a process for reviewing service failures and security-relevant events.

* Backup scheduling: Schedule and test database and encrypted-file backups.

* Update controls: Review code changes and database migrations before deployment.

* Network controls: Remove unnecessary public port exposure and validate firewall rules.

* Recovery planning: Document access to secrets and persistent data, and test recovery procedures.

These are recommendations for hardening the deployment, not claims that a monitoring platform, orchestration system, or automated recovery service is currently implemented.

## 15. Backup and Restore Strategy

A complete recovery strategy must account for the database, encrypted file contents, encryption key, and relevant deployment configuration.

### 15.1 Required backup components

| Component                 | Location or source                      | Why it matters                                                               |
| ------------------------- | --------------------------------------- | ---------------------------------------------------------------------------- |
| PostgreSQL data           | `chatbot-project_postgres_data`         | Contains application records, file metadata, and wrapped encryption-key data |
| Encrypted uploaded files  | `file_service/uploads/`                 | Contains the physical encrypted file contents                                |
| `FILE_MASTER_KEY`         | Protected secret/recovery storage       | Required to unwrap stored file-encryption keys                               |
| Environment configuration | `.env` and other relevant configuration | Required to reproduce the intended deployment securely                       |
| Rasa model artifacts      | `chatbot-project_rasa_models`           | Preserve when required by the model recovery and deployment plan             |

The repository includes `scripts/backup_db.sh` as a database backup helper. Review the script before using it in an operational procedure. This guide does not assume undocumented command-line arguments, output filenames, retention policies, or restore functionality.

The repository also contains backup artifacts under `backups/`. Treat database dumps and backup artifacts as sensitive because they may contain application data.

### 15.2 Why a database backup is not enough

The File Service separates encrypted file contents from their database metadata.

```
PostgreSQL backup
  ├── File metadata
  ├── Encryption-key metadata
  └── Wrapped encryption keys

Encrypted file-storage backup
  └── Physical encrypted file contents

Protected recovery material
  └── FILE_MASTER_KEY
```

Restoring only PostgreSQL may restore metadata and wrapped keys without restoring the corresponding physical files. Restoring only the encrypted upload directory may leave the database metadata and wrapped keys unavailable. Restoring both without the correct master key may still prevent decryption.

Back up these components as a coordinated set and protect the backups from unauthorized access.

### 15.3 Restore considerations

A restore procedure should be tested in a controlled environment before it is relied upon for disaster recovery.

1. Identify the correct database backup and encrypted-file backup.

2. Retrieve the corresponding protected `FILE_MASTER_KEY`.

3. Restore PostgreSQL data using the repository's reviewed database recovery procedure.

4. Restore the encrypted upload directory while preserving the expected file layout and permissions.

5. Configure the application with the correct database connection and master key.

6. Start the services and inspect their logs.

7. Test file retrieval and decryption using authorized test data.

8. Verify that ordinary application functionality works.

Do not assume that a database backup script automatically backs up the upload directory or master key.

## 16. Updating the Application

Updates should preserve persistent data and account for database schema changes.

### 16.1 Recommended update procedure

1. Review the incoming code changes, configuration changes, and database migration files.

2. Confirm that current backups exist and are recoverable.

3. Retrieve the intended repository revision:

   Bash

   ```
   git pull
   ```

4. Build the updated service images:

   Bash

   ```
   docker compose build
   ```

5. Start or recreate the services using the new images:

   Bash

   ```
   docker compose up -d
   ```

6. Apply File Service migrations if required by the update:

   Bash

   ```
   docker compose exec file_service alembic upgrade head
   ```

7. Verify service state and review logs:

   Bash

   ```
   docker compose ps
   docker compose logs
   ```

8. Repeat the application smoke tests in Section 12.

### 16.2 When to use a combined build and start

For a simpler update procedure, the build and startup steps can be combined:

Bash

```
docker compose up --build -d
```

Use this when you want Compose to build images before starting the updated application. Separate `docker compose build` and `docker compose up -d` steps are useful when you want to inspect the build result before recreating or starting services.

Review database migrations for compatibility with existing data before applying them. Do not delete persistent volumes as part of a normal application update.

## 17. Restart and Shutdown

### 17.1 Restart running services

Bash

```
docker compose restart
```

This restarts the existing Compose containers. Use it when a restart is needed without intentionally removing the Compose application.

After restarting, verify the service state and repeat relevant smoke tests.

### 17.2 Stop and remove the Compose application

Bash

```
docker compose down
```

This stops and removes the Compose-managed containers and network. The external volumes declared in the supplied configuration are not removed by this command.

To start the application again, use the appropriate startup command from Section 9.

> Data safety: Avoid `docker compose down -v` as a routine operation. The project uses external persistent volumes, and persistent data must be handled deliberately. Never remove storage as a default troubleshooting or update step.

## 18. Troubleshooting

Start with container state and logs:

Bash

```
docker compose ps
docker compose logs
```

Then inspect the service associated with the failure.

| Symptom                                        | Checks and recommended action                                                                                                                                                                                                                                                          |
| ---------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Containers do not start                        | Confirm Docker is running, `.env` exists, the external volumes have been created, and the image builds completed. Inspect `docker compose ps` and the logs for the failing service.                                                                                                    |
| PostgreSQL connection errors                   | Check the PostgreSQL container and its logs. Verify `DATABASE_URL`, `POSTGRES_HOST`, `POSTGRES_PORT`, `POSTGRES_USER`, `POSTGRES_PASSWORD`, and `POSTGRES_DB`. Confirm the hostname is `postgres` within Compose and that the existing database credentials match the configuration.   |
| PostgreSQL schema or seed data appears missing | Check whether the data directory was already initialized. `init.sql` and `seed.sql` normally run only when PostgreSQL initializes an empty data directory; changing these files does not replay them against an existing volume.                                                       |
| Alembic migration fails                        | Inspect `docker compose logs file_service`. Confirm PostgreSQL is reachable and that the database URL is correct. Review the migration error before retrying `docker compose exec file_service alembic upgrade head`. Do not delete the database volume to bypass a migration problem. |
| Nginx returns `502 Bad Gateway`                | Inspect Nginx, Auth Service, Rasa, and File Service logs. Check service names, `chatbot_network`, container startup, and whether the upstream services have finished initializing.                                                                                                     |
| Rasa does not respond                          | Inspect `docker compose logs rasa` and `docker compose logs rasa_sdk`. Check model availability in the Rasa model volume, review `rasa/endpoints.yml`, and verify that the SDK and its dependencies have started.                                                                      |
| File upload or download fails                  | Inspect File Service logs. Confirm `file_service/uploads/` exists and is writable, database connectivity works, authorization is correct, and `FILE_MASTER_KEY` is configured properly.                                                                                                |
| Existing files cannot be decrypted             | Verify that the original `FILE_MASTER_KEY` is being used. Changing it may make existing wrapped keys unusable unless a supported migration has been performed.                                                                                                                         |
| Frontend loads but API calls fail              | Check the browser developer console, Nginx routing, backend logs, JWT authentication, and use of `/auth`, `/rasa`, and `/files`. Confirm that the browser is accessing Nginx through port `8081`.                                                                                      |
| API fails shortly after startup                | Check whether a dependency is still initializing. `depends_on` controls startup order but does not necessarily guarantee readiness. Inspect logs and retry after the dependency is available.                                                                                          |

### 18.1 File encryption key migration utilities

The repository contains these File Service scripts:

* `file_service/scripts/migrate_encryption_keys.py`

* `file_service/scripts/migrate_wrapped_keys_to_encryption_keys.py`

They are project-provided migration utilities. Review their source code and intended usage before executing them. Their exact invocation and effects should not be inferred from their filenames alone.

### 18.2 Data-safety rule

Do not delete Docker volumes, remove database files, or recreate persistent storage to resolve a startup failure. First identify the error, inspect logs, preserve backups, and understand the consequences of any destructive operation.

## 19. Deployment Validation Checklist

Use this checklist before considering a deployment validated.

### Environment and configuration

- [ ] Docker and Docker Compose are installed and working.

- [ ] Repository is cloned at the intended revision.

- [ ] `.env` is created and excluded from version control.

- [ ] `SECRET_KEY` is configured with a strong random value.

- [ ] `FILE_MASTER_KEY` is valid and securely backed up.

- [ ] PostgreSQL credentials are appropriate for the environment.

- [ ] `DATABASE_URL` matches the actual database configuration.

### Storage and database

- [ ] `chatbot-project_postgres_data` exists.

- [ ] `chatbot-project_rasa_models` exists.

- [ ] `file_service/uploads/` exists and is accessible to Docker.

- [ ] PostgreSQL initialization behavior is understood.

- [ ] Required File Service Alembic migrations are applied.

- [ ] Database backup and restore procedures are documented.

- [ ] Encrypted file-storage backups are configured.

- [ ] `FILE_MASTER_KEY` recovery material is protected separately.

### Application behavior

- [ ] Containers are built and running.

- [ ] Service logs have been reviewed.

- [ ] Nginx is accessible on port `8081`.

- [ ] Login page loads and authentication works.

- [ ] JWT-protected functionality has been tested.

- [ ] Chatbot requests reach Rasa and return responses.

- [ ] Rasa custom actions work through the Rasa SDK.

- [ ] Chat history persistence has been tested.

- [ ] File upload and encryption have been tested.

- [ ] Authorized file download and decryption have been tested.

- [ ] Admin dashboard has been tested where an admin account is available.

- [ ] Analytics has been tested where an admin account is available.

- [ ] PostgreSQL data persists after a container restart.

### Production preparation

- [ ] HTTPS/TLS is configured before external production exposure.

- [ ] Unnecessary public backend ports are restricted.

- [ ] PostgreSQL network access is restricted.

- [ ] Rasa CORS and debug settings have been reviewed.

- [ ] Image versions and update procedures have been reviewed.

- [ ] Log review and incident-response procedures are defined.

- [ ] Backup recovery has been tested in a controlled environment.

Deployment principle: Preserve persistent data, protect the encryption key, review migrations deliberately, and verify the complete application through Nginx and its actual functionality. A successful container startup is only the first step toward a reliable deployment.
