# Development Notes

This document contains development and troubleshooting commands for the
SmartChat AI Platform. The application is designed to run using Docker
Compose, with Nginx serving as the normal browser-facing entry point.

## Development Environment

SmartChat AI Platform runs as a set of Docker Compose services.

The normal browser-facing application URL is:

```http
http://localhost:8081
```

---

## Development Service URLs

The following services expose host ports for development and troubleshooting:

| Service      | Browser / Host URL | Purpose |
|--------------|--------------------|-------------------------|
| Frontend     | http://localhost:8081 | Browser-facing application |
| Auth Service | http://localhost:8081/auth/ | Authentication and user APIs |
| File Service | http://localhost:8081/files/ | File management APIs |
| Rasa         | http://localhost:8081/rasa/ | Conversational AI API |
| PostgreSQL   | Not browser-accessible | Database access |

Normal browser application traffic should go through Nginx at
http://localhost:8081.

The backend services communicate internally using Docker Compose service
names:

```text
auth:8000
file_service:8001
rasa:5006
rasa_sdk:5055
postgres:5432
```

---

## Start the Application

Build the Docker images and start all services:

```bash
docker compose up --build
```

To run the services in detached mode:

```bash
docker compose up --build -d
```

---

## Stop the Application

Stop and remove the running containers:

```bash
docker compose down
```
Docker volumes are not removed by this command.

---

## View Running Containers

Check the status of the Docker Compose services:

```bash
docker compose ps
```

Alternatively:

```bash
docker ps
```

---

## View Service Logs

View logs for an individual service:

```bash
docker compose logs -f auth
docker compose logs -f file_service
docker compose logs -f nginx
docker compose logs -f rasa
```

To view logs for all services:

```bash
docker compose logs -f
```

---

## Database Access

Open a PostgreSQL shell inside the PostgreSQL container:

```bash
docker compose exec -T postgres psql \
  -U chatbot \
  -d chatbot
```

For a single SQL query, use:

```bash
docker compose exec -T postgres psql \
  -U chatbot \
  -d chatbot \
  -c "SELECT * FROM users;"
```

---

## Database Backup

Create a PostgreSQL database dump from the running container:

```bash
docker compose exec -T postgres pg_dump \
  -U chatbot \
  -d chatbot > backup.sql
```

The generated backup.sql file is created on the host machine in the current
directory.

Database backups should be handled carefully and should not be committed to
version control if they contain real user or application data.

---

## Authentication Development

The frontend stores the JWT in browser localStorage using the key
authToken.

To inspect the stored token during development, open the browser Developer
Tools Console while accessing the application and run:

```javascript
localStorage.getItem("authToken")
```

To inspect the available localStorage keys and values:

```javascript
Object.fromEntries(Object.entries(localStorage))
```

The JWT is sent to protected APIs using the HTTP Authorization header:

```http
Authorization: Bearer <JWT>
```

The token should be treated as sensitive authentication data and should not be
committed to source control or shared in logs, screenshots, or documentation.

---

## File Service Development

Uploaded files are stored in the File Service runtime storage directory:

```text
file_service/uploads/
```

Uploaded files are encrypted before being stored.

The per-file encryption key is protected using the server-side:

```text
FILE_MASTER_KEY
```

The FILE_MASTER_KEY should be configured through the environment and must
not be committed to version control.

---

## Audit Log Verification

The File Service records file-related operations in the
file_access_logs table.

To inspect recent file access records:

```bash
docker compose exec -T postgres psql \
  -U chatbot \
  -d chatbot \
  -c "SELECT id, file_id, user_id, action, ip_address, access_time
      FROM file_access_logs
      ORDER BY id DESC;"
```

To inspect the audit history for a specific file:

```bash
docker compose exec -T postgres psql \
  -U chatbot \
  -d chatbot \
  -c "SELECT id, file_id, user_id, action, ip_address, access_time
      FROM file_access_logs
      WHERE file_id = 25
      ORDER BY id DESC;"
```

The ip_address field records the address observed by the application. When
requests pass through Docker or Nginx, the recorded address may represent a
Docker gateway or proxy rather than the original client IP.

For detailed audit-log test procedures, see the Testing Guide.