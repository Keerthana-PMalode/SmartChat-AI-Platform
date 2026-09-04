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

## Chat History Development

The chat history also belongs to an authenticated user. The database
relationships are:

```text
users
  │
  │ users.id ← chat_history.user_id
  │           ON DELETE CASCADE
  ▼
chat_history
  │
  │ chat_history.id ← chat_messages.chat_id
  │                   ON DELETE CASCADE
  ▼
chat_messages
```

- **chat_history.user_id** references **users.id** with **ON DELETE CASCADE**.
- **chat_messages.chat_id** references **chat_history.id** with **ON DELETE CASCADE**.
- Deleting a user deletes the user's chat-history records.
- Deleting a chat-history record deletes its associated chat messages.

The **chat_history** table represents the conversation/session:

```text
id
user_id
session_id
timestamp
```

The **chat_messages** table stores individual messages:

``` text
id
chat_id
role
content
created_at
```

SmartChat currently supports these message roles:

```text
user
chatbot
```

For example, a stored conversation may appear in PostgreSQL as:

**chat_history**

 id |   session_id     | user_id | timestamp
----:|----------------:|--------:|-------------------------------
  1 |  chat_test_UserA |      38 | 2026-09-04 12:53:54.622459+00

with related messages:

**chat_messages**

 id | chat_id |  role   |  content  | created_at
----:|--------:|--------:|----------:|------------------------------
  1 |       1 | user    | Hiiiii    | 2026-09-04 12:53:54.622459+00
  2 |       1 | chatbot | Helloooo  | 2026-09-04 12:53:54.622459+00

The relationship is:

```text
chat_messages.chat_id
        │
        ▼
chat_history.id
```

with:

```text
ON DELETE CASCADE
```

Therefore, deleting a chat-history record automatically deletes its
associated messages.

---

## Inspect Chat History

To inspect chat sessions:

```bash
docker compose exec -T postgres psql \
  -U chatbot \
  -d chatbot \
  -c "SELECT id, session_id, user_id, timestamp
      FROM chat_history
      ORDER BY id DESC;"
```
To inspect messages:

```bash
docker compose exec -T postgres psql \
  -U chatbot \
  -d chatbot \
  -c "SELECT id, chat_id, role, content, created_at
      FROM chat_messages
      ORDER BY id DESC;"
```

To inspect a complete conversation:

```bash
docker compose exec -T postgres psql \
  -U chatbot \
  -d chatbot \
  -c "SELECT h.id AS chat_id,
             h.session_id,
             h.user_id,
             h.timestamp,
             m.id AS message_id,
             m.role,
             m.content,
             m.created_at
      FROM chat_history h
      LEFT JOIN chat_messages m
        ON m.chat_id = h.id
      WHERE h.id = <CHAT_ID>
      ORDER BY m.id;"
```
---

## Store Chat

The Store Chat operation creates a chat-history record and the corresponding
message records.

Conceptually:

```text
Store Chat
    │
    ▼
chat_history
    │
    ├──► chat_messages(role = user)
    │
    └──► chat_messages(role = chatbot)
```
The resulting API response contains the chat session metadata together with
its messages.

---

## Chat Message Roles

The current application uses:

```text
user
chatbot
```

The role should be stored in **chat_messages.role**, while the actual message
text is stored in **chat_messages.content**.

Do not add **message** or **response** columns to **chat_history** for the current chat-history implementation.

---

## Chat Deletion

Because of the foreign-key cascade:

```text
chat_history.id
      │
      ▼
chat_messages.chat_id
      │
      └── ON DELETE CASCADE
```

deleting a chat session automatically removes its associated messages.

This can be verified with:

```bash
docker compose exec -T postgres psql \
  -U chatbot \
  -d chatbot \
  -c "DELETE FROM chat_history
      WHERE id = <CHAT_ID>;"
```

Then:

```bash
docker compose exec -T postgres psql \
  -U chatbot \
  -d chatbot \
  -c "SELECT *
      FROM chat_messages
      WHERE chat_id = <CHAT_ID>;"
```

Expected result:

```text
0 rows
```

The above SQL command is intended only to verify the database-level
`ON DELETE CASCADE` behavior.

For normal application testing, chat deletion should be performed through the
application/API rather than directly against PostgreSQL.

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

The current database schema defines foreign-key relationships from the
applicable File Service user-reference columns to `users.id`, with
`ON DELETE CASCADE`. 

These database constraints provide referential integrity and
cascading deletion independently of whether the corresponding relationship
is represented as a SQLAlchemy ORM foreign key.

---

## Audit Log Verification

The File Service records successful file-related operations in the
`file_access_logs` table.

Phase 2 audit logging distinguishes between authenticated access and
share-link access using the `access_method` field.

The audit context is:

```text
AUTHENTICATED
    user_id       = required
    share_link_id = NULL

SHARE_LINK
    user_id       = NULL
    share_link_id = required
```

To inspect recent audit records:

```bash
docker compose exec -T postgres psql \
  -U chatbot \
  -d chatbot \
  -c "SELECT id, file_id, user_id, share_link_id,
      access_method, action, ip_address, access_time
      FROM file_access_logs
      ORDER BY id DESC;"
```

To inspect the audit history for a specific file:

```bash
docker compose exec -T postgres psql \
  -U chatbot \
  -d chatbot \
  -c "SELECT id, file_id, user_id, share_link_id,
      access_method, action, ip_address, access_time
      FROM file_access_logs
      WHERE file_id = 25
      ORDER BY id DESC;"
```

Successful authenticated downloads are recorded with:

```text
user_id       = authenticated user's ID
share_link_id = NULL
access_method = AUTHENTICATED
```

Successful share-link downloads are recorded with:

```text
user_id       = NULL
share_link_id = ID of the share link
access_method = SHARE_LINK
```

The database enforces these access-context relationships through the
ck_file_access_logs_access_context CHECK constraint.

For detailed audit-log test procedures, see the Testing Guide.

---

## User Deletion

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

The **chat_messages.chat_id** foreign key references **chat_history.id** with **ON DELETE CASCADE**.

The relevant relationships include:

```text
users
 │
 ├── 1:N ──► chat_history
 │             │
 │             │ ON DELETE CASCADE
 │             ▼
 │         chat_messages
 │
 ├── 1:N ──► files
 │             │
 │             ├──► encryption_keys
 │             ├──► file_permissions
 │             └──► file_access_logs
 │
 ├── 1:N ──► file_access_logs
 │
 └── 1:N ──► file_permissions
```

When a user is deleted, PostgreSQL performs the configured cascading deletes.

For example, deleting a user who owns files causes the owned files to be
deleted. The dependent records associated with those files, such as
encryption keys, permissions, and file-access logs, are then removed through
their corresponding cascade relationships.

User-associated chat history is removed through the `chat_history.user_id`
foreign key. Associated `chat_messages` records are then removed through the
`chat_messages.chat_id` → `chat_history.id` `ON DELETE CASCADE` relationship.

User-associated audit records are removed through their applicable foreign-key
relationships.

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
       ├──► Cascade chat_history
       │       │
       │       └──► Cascade chat_messages
       │
       ├──► Cascade owned files
       │       ├──► encryption keys
       │       ├──► permissions
       │       └──► file access logs
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
    (SELECT count(*)
     FROM chat_history
     WHERE user_id = <USER_ID>) AS chat_history,

    (SELECT count(*)
     FROM chat_messages m
     JOIN chat_history h ON h.id = m.chat_id
     WHERE h.user_id = <USER_ID>) AS chat_messages,

    (SELECT count(*)
     FROM files
     WHERE owner_id = <USER_ID>) AS files,

    (SELECT count(*)
     FROM file_access_logs
     WHERE user_id = <USER_ID>) AS access_logs,

    (SELECT count(*)
     FROM file_permissions
     WHERE shared_by = <USER_ID>) AS permissions_owned,

    (SELECT count(*)
     FROM file_permissions
     WHERE shared_with_user_id = <USER_ID>) AS permissions_received;"
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

### Important Note

> - Current policy: hard delete user and associated application data. 
> - Production retention requirements have not yet been finalized.

It does not currently implement:

- Soft deletion
- User-data retention periods
- Legal hold handling
- Recovery of deleted users
- Separate audit retention after user deletion
- Production-grade asynchronous storage cleanup

These concerns should be addressed before defining a production data-retention
and account-deletion policy.