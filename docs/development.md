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

### Cross-Service User IDs

The Auth Service owns the `users` table.

The File Service stores references to Auth Service users as integer ID
columns such as `owner_id`, `user_id`, `shared_by`, `shared_with_user_id`,
and `created_by`.

These columns are defined and stored in the File Service database, but the
user identities they reference are owned by the Auth Service.

Do not import the Auth Service's `users` SQLAlchemy model or create
application-level ORM relationships to that model.

When adding or modifying user-reference fields in File Service models,
preserve the service boundary. User identity and user information should be
validated through the Auth Service/API rather than through direct use of the
Auth Service's ORM models.

The shared PostgreSQL database currently enforces foreign-key constraints
from File Service user-reference columns to `users.id`, with `ON DELETE
CASCADE`. These database constraints provide referential integrity and
cascading deletion independently of whether the corresponding relationship
is represented as a SQLAlchemy ORM foreign key.

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

---

## User Deletion


### User Deletion

User deletion is currently implemented as a **hard delete**.

An administrator can delete another user through:

```http
DELETE /users/{user_id}
```

The deletion is performed by the Auth Service. Before deleting the user, the
endpoint:

- Verifies that the target user exists.
- Prevents an administrator from deleting their own account.
- Prevents deletion of the last administrator.
- Deletes the user from the users table.
- Relies on PostgreSQL foreign-key ON DELETE CASCADE constraints to remove
dependent records.

The current endpoint returns the deleted user's ID and username:

```text
{
  "status": "deleted",
  "user_id": 33,
  "username": "chat_test_user"
}
```

The username is saved before the SQLAlchemy user object is deleted so that it
can safely be returned in the response.

### Current Cascade Behavior

The current database schema uses PostgreSQL foreign-key cascade rules for
user-related records.

The relevant relationships include:

```text
users
 │
 ├──► chat_history
 │       user_id
 │
 ├──► files
 │       owner_id
 │       │
 │       ├──► encryption_keys
 │       │       file_id
 │       │
 │       ├──► file_permissions
 │       │       file_id
 │       │
 │       └──► file_access_logs
 │               file_id
 │
 ├──► file_access_logs
 │       user_id
 │
 └──► file_permissions
         shared_by
         shared_with_user_id
```

When a user is deleted, PostgreSQL performs the configured cascading deletes.

For example, deleting a user who owns files causes the owned files to be
deleted. The dependent records associated with those files, such as
encryption keys, permissions, and file-access logs, are then removed through
their corresponding cascade relationships.

User-associated chat history and user-associated audit records are also
removed through their direct foreign-key relationships.

### Current Deletion Flow

```text
Admin
  │
  │ DELETE /users/{user_id}
  ▼
Auth Service
  │
  ├──► Validate administrator JWT
  │
  ├──► Locate target user
  │
  ├──► Prevent self-deletion
  │
  ├──► Prevent deletion of last administrator
  │
  └──► DELETE users row
             │
             ▼
        PostgreSQL
             │
             ├──► Cascade chat history
             ├──► Cascade owned files
             │       │
             │       ├──► Cascade encryption keys
             │       ├──► Cascade file permissions
             │       └──► Cascade file access logs
             │
             ├──► Cascade user file permissions
             └──► Cascade user access logs
```

### Verify User Deletion

Before deletion, identify the user:

```bash
docker compose exec -T postgres psql \
  -U chatbot \
  -d chatbot \
  -c "SELECT id, username, role
      FROM users
      WHERE username = 'chat_test_user';"
```

Check the user's related records:

```bash
docker compose exec -T postgres psql \
  -U chatbot \
  -d chatbot \
  -c "SELECT
      (SELECT count(*) FROM chat_history WHERE user_id = <USER_ID>) AS chat_history,
      (SELECT count(*) FROM files WHERE owner_id = <USER_ID>) AS files,
      (SELECT count(*) FROM file_access_logs WHERE user_id = <USER_ID>) AS access_logs,
      (SELECT count(*) FROM file_permissions WHERE shared_by = <USER_ID>) AS permissions_owned,
      (SELECT count(*) FROM file_permissions WHERE shared_with_user_id = <USER_ID>) AS permissions_received;"
```

Delete the user through the application endpoint rather than directly through
PostgreSQL:

```http
DELETE /users/<USER_ID>
Authorization: Bearer <ADMIN_JWT>
```

After deletion, verify that the user no longer exists:

```bash
docker compose exec -T postgres psql \
  -U chatbot \
  -d chatbot \
  -c "SELECT id, username, role
      FROM users
      WHERE id = <USER_ID>;"
```

Then verify that the related records have also been removed:

```bash
docker compose exec -T postgres psql \
  -U chatbot \
  -d chatbot \
  -c "SELECT count(*) FROM chat_history
      WHERE user_id = <USER_ID>;

      SELECT count(*) FROM files
      WHERE owner_id = <USER_ID>;

      SELECT count(*) FROM file_access_logs
      WHERE user_id = <USER_ID>;

      SELECT count(*) FROM file_permissions
      WHERE shared_by = <USER_ID>;

      SELECT count(*) FROM file_permissions
      WHERE shared_with_user_id = <USER_ID>;"
```

Expected result for each count is:

```text
0
```

### Important Storage Consideration

Database cascade deletion removes database records. It does not by itself
remove encrypted files from the File Service's filesystem storage.

The application currently stores encrypted files under:

```text
file_service/uploads/
```

Therefore, when a user's files records are deleted through PostgreSQL,
the corresponding .enc files must also be considered.

A future production implementation should ensure that deletion of a file
database record and deletion of its physical encrypted object are handled
consistently. This may require an application-level file cleanup mechanism,
rather than relying solely on PostgreSQL ON DELETE CASCADE.

**"Important Storage Consideration"**

PostgreSQL test proved:

```text
users              → deleted
chat_history       → deleted
files              → deleted
file_permissions   → deleted
file_access_logs   → deleted
```

But actual encrypted objects live separately in:

```text
file_service/uploads/*.enc
```

PostgreSQL cannot know that 30 or 31 corresponded to a particular .enc file unless application explicitly performs that cleanup.

So current implementation has successfully demonstrated database-level cascading deletion, but it has not yet demonstrated complete user-data deletion from all storage.

## Current Data-Deletion Policy

The current development implementation intentionally uses hard deletion.
Hard deletion is not inherently unproduction-ready. It is a valid production policy if the product intentionally wants account deletion to erase the user's application data.

**Important Noe**
> Current policy: hard delete user and associated application data. Production retention requirements have not yet been finalized.

It does not currently implement:

- Soft deletion
- User-data retention periods
- Legal hold handling
- Recovery of deleted users
- Separate audit retention after user deletion
- Production-grade asynchronous storage cleanup

These concerns should be addressed before defining a production data-retention
and account-deletion policy.

