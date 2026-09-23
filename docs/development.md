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

### Current Data-Deletion Policy

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

---

## Administrative Chat History Development

The Admin application now loads chat-history summaries when the `chat-history` section is selected. The controller delegates retrieval to `chat_history.service.js`, which caches the result and emits `chat-history:loading`, `chat-history:loaded`, and `chat-history:error` events.

### Admin Chat History API

#### Get All Chat History

The Admin application retrieves the chat-history summaries using:

```http
GET /admin/chats
Authorization: Bearer <ADMIN_JWT>
```

When accessed through the Nginx `/auth/` prefix:

```http
GET /auth/admin/chats
Authorization: Bearer <ADMIN_JWT>
```

#### Get User Chats

The Admin application can retrieve the chat histories belonging to a
specific user using:

```http
GET /admin/users/{user_id}/chats
Authorization: Bearer <ADMIN_JWT>
```

When accessed through the Nginx `/auth/` prefix:

```http
GET /auth/admin/users/{user_id}/chats
Authorization: Bearer <ADMIN_JWT>
```

The `{user_id}` identifies the user whose chat histories are being requested.

The endpoint is administrator-only and should return only the chat histories
associated with the requested user.

#### Get Chat Messages

When an administrator selects a chat-history row, the application retrieves
the messages belonging to that conversation using:

```http
GET /admin/users/{user_id}/chats/{chat_id}/messages
Authorization: Bearer <ADMIN_JWT>
```

When accessed through the Nginx `/auth/` prefix:

```http
GET /auth/admin/users/{user_id}/chats/{chat_id}/messages
Authorization: Bearer <ADMIN_JWT>
```

The UI verifies the presence of both `user_id` and `chat_id` before requesting
the messages.

The returned messages are rendered in the Chat Details modal and are
displayed in ascending message-ID order.

### Admin Chat History Deletion

#### Delete Chat History

The Admin API provides an endpoint for deleting an entire chat-history
session:

```http
DELETE /admin/chat/history/{session_id}
Authorization: Bearer <ADMIN_JWT>
```

When accessed through the Nginx `/auth/` prefix:

```http
DELETE /auth/admin/chat/history/{session_id}
Authorization: Bearer <ADMIN_JWT>
```

The endpoint requires an authenticated administrator. The request must contain
a valid JWT with administrator privileges.

The `{session_id}` identifies the chat session to be deleted.

#### Deletion Behavior

The operation deletes the corresponding `chat_history` record.

Because
`chat_messages.chat_id` references `chat_history.id` with:

```text
ON DELETE CASCADE
```

deleting the chat-history record also deletes all messages associated with
that conversation.

The deletion relationship is:

```text
DELETE /admin/chat/history/{session_id}
              │
              ▼
        chat_history
              │
              │ ON DELETE CASCADE
              ▼
        chat_messages
```

Therefore, deleting a chat-history session removes both the
`chat_history` record and its associated `chat_messages` records.

#### Authorization

The endpoint is an administrative operation and must not be accessible to an
ordinary authenticated user.

An administrator request should succeed when the supplied session ID
identifies an existing chat history.

An ordinary-user JWT should receive:

```text
403 Forbidden
```

because the endpoint requires administrative privileges.

#### Session Lookup

The endpoint identifies the chat history using the supplied `session_id`.

The implementation should ensure that the intended chat-history record is
selected before deletion and that the operation does not unintentionally
delete another user's conversation when a session ID is supplied.

#### Expected Result

For a successful deletion, the API returns a successful HTTP response
indicating that the chat history was deleted.

After deletion, the corresponding `chat_history` record should no longer
exist, and its associated `chat_messages` records should also be absent
because of the database cascade.

#### Database Verification

Before deletion:

```bash
SELECT id, session_id, user_id
FROM chat_history
WHERE session_id = '<SESSION_ID>';
```

Check the associated messages:

```bash
SELECT m.id, m.chat_id, m.role, m.content
FROM chat_messages m
JOIN chat_history h
  ON h.id = m.chat_id
WHERE h.session_id = '<SESSION_ID>';
```

After calling:

```http
DELETE /admin/chat/history/{session_id}
```

repeat both queries.

Expected result:

```text
chat_history: 0 rows

chat_messages: 0 rows
```

This verifies both application-level deletion and the database-level
`ON DELETE CASCADE` behavior.

### Chat History Cache

`fetchChatHistory()` uses an in-memory module cache. Calling
`fetchChatHistory(false)` reuses the cached list when available;
`fetchChatHistory(true)` performs a new API request.

```text
Admin navigates to Chat History
        │
        ▼
chat_history.service.js
        │
        ├── cache hit ──► chat-history:loaded
        │
        └── cache miss ─► GET /admin/chats
                              │
                              ▼
                         update cache
                              │
                              ▼
                       chat-history:loaded
```

### Admin User List Development

The Users UI maintains separate `allUsers` and `filteredUsers` collections
and a `currentUsersPage` value.

Users are sorted by numeric ID after retrieval. Search matches ID, username,
email, or role, and the UI supports pagination through the retrieved user
list.

The Refresh action emits `users:refresh-requested`, causing the service to
bypass its cache.

The exact number of users displayed per page has not yet been explicitly
verified and should not be treated as a confirmed behavior until tested.

The user renderer escapes displayed values before inserting them into HTML.
The same `escapeHtml()` utility is used for `chat-history` and `audit-log`
rendering.

#### Admin Users API Response Behavior

The Admin Users endpoint is currently:

```http
GET /admin/users
Authorization: Bearer <ADMIN_JWT>
```

When exposed through the Nginx `/auth/` prefix, the externally accessible URL
is:

```http
GET /auth/admin/users
Authorization: Bearer <ADMIN_JWT>
```

The endpoint currently exposes the serialized ORM user model in its response
rather than returning a separately defined, explicitly restricted
user-response schema.

This means changes to the underlying ORM model or its serialization behavior
may affect the API response.

##### Development Consideration

The current implementation should be treated as an implementation detail
that requires review before production hardening.

The response should eventually use an explicit response schema containing only
fields that are intentionally exposed to administrators.

In particular, authentication-related, internal, or sensitive ORM fields
should not be exposed merely because they exist on the SQLAlchemy model.

Until this is addressed, changes to the User ORM model should be reviewed for
their potential effect on:

```http
GET /admin/users
```

and its externally exposed route:

```http
GET /auth/admin/users
```

#### Admin Users Pagination

The Users UI implements pagination, but the exact number of users displayed
per page has not yet been explicitly verified.

The current documentation therefore does not define a fixed page size.

The pagination behavior should be explicitly tested before documenting the
number of users displayed on each page.

### Admin Navigation State

The Admin state module maintains an explicit allow-list of valid sections:
`dashboard`, `users`, `chat-history`, and `analytics`. `setCurrentSection()`
returns `false` and leaves the current section unchanged when an invalid section
is supplied.

### Admin Navigation and Session Cleanup

The Admin controller restores the initial section from `window.location.hash`
after initialization.

The UI uses hash changes to emit navigation events and uses EventBus to update
the active section and visible panel.

Logout continues to require confirmation before redirecting to
`/login.html`. The controller clears `authToken`, `username`, and `role` from
localStorage before redirecting.

---

## Session-Aware Chat Development

Successful login now creates a new UUID session ID for every login. The value is inserted into the JWT as `session_id` and is also returned to the frontend:

```json
{
  "access_token": "<JWT>",
  "session_id": "<UUID>"
}
```

The chat save endpoint no longer takes `session_id` or `sender` from the request schema. `get_current_session()` validates the bearer token and extracts `session_id` from the JWT. 

### Chat History API Endpoints

The authenticated chat-history API is exposed through the Auth Service:

```http
POST /chat/history
GET  /chat/history
```

Both endpoints require a valid JWT:

```http
Authorization: Bearer <JWT>
```

The client does not provide session_id in the request URL. The server
extracts the session ID from the authenticated JWT.

### Store Chat

```http
POST /chat/history
Authorization: Bearer <JWT>
Content-Type: application/json
```

Request body:

```json
{
  "message": "Hiiiiiiiiiiiiiiiiiiiiiiii",
  "response": "Helloooooooooooooooooooooooooooooooooooo"
}
```

The server extracts:

```text
user_id    ← authenticated JWT
session_id ← authenticated JWT
```

Chat persistence then searches by:

```text
ChatHistory.session_id == authenticated session_id
AND
ChatHistory.user_id == authenticated user.id
```

A conversation record is created only when that combination does not already
exist. Each request adds a user message and, when supplied, a chatbot message
to the existing conversation.

### Chat Session Uniqueness Constraint

The session-aware chat design requires a single chat_history record for each
authenticated user/session combination.

The intended uniqueness rule is:

```text
(user_id, session_id)
```

A user may have multiple chat sessions, and different users may have different
chat sessions, but the same combination of:

```text
user_id + session_id
```

must identify only one chat_history record.

Conceptually:

```text
UNIQUE (user_id, session_id)
```

This constraint should be enforced at the database level rather than relying
only on application-level lookup logic.

The application currently searches for an existing conversation using:

```text
ChatHistory.user_id == authenticated user.id
AND
ChatHistory.session_id == authenticated session_id
```

The database uniqueness constraint should provide an additional guarantee
against duplicate chat-history records being created for the same
user/session combination, including during concurrent requests.

#### Current Status

The (user_id, session_id) database uniqueness constraint has been identified
as required for the session-aware chat-history design.

It remains to be implemented/verified in the database schema.

Until the constraint is implemented, application-level lookup prevents normal
duplicate creation, but database-level uniqueness is not yet enforcing the
invariant.

### Get Chat History

```http
GET /chat/history
Authorization: Bearer <JWT>
```

The server again extracts user_id and session_id from the JWT and returns
the chat history matching both values.

The isolation model is:

```text
GET /chat/history
        │
        ▼
JWT
 ├── user_id
 └── session_id
        │
        ▼
ChatHistory
 WHERE user_id = JWT.user_id
 AND session_id = JWT.session_id
        │
        ▼
ChatMessage
 WHERE chat_id = ChatHistory.id
```

A successful response contains the conversation metadata and its associated
messages:

```json
[
  {
    "id": 24,
    "session_id": "618dd92e-84cd-47fd-8869-63d18ada80f3",
    "user_id": 1,
    "timestamp": "2026-09-10T15:22:11.121607Z",
    "messages": [
      {
        "id": 65,
        "chat_id": 24,
        "role": "user",
        "content": "Hiiiiiiiiiiiiiiiiiiiiiiii",
        "created_at": "2026-09-10T15:22:11.121607Z"
      },
      {
        "id": 66,
        "chat_id": 24,
        "role": "chatbot",
        "content": "Helloooooooooooooooooooooooooooooooooooo",
        "created_at": "2026-09-10T15:22:11.121607Z"
      }
    ]
  }
]
```

### Session-Based Conversation Reuse

This means repeated messages in one login session are grouped under one
chat_history record instead of creating a new conversation record for every
message.

The relationship is:

```text
One login session
      │
      ▼
session_id
      │
      ▼
chat_history
      │
      ├──► chat_messages (user)
      │
      ├──► chat_messages (chatbot)
      │
      └──► additional messages
```

A fresh login receives a new session ID, so messages saved after the new login
are associated with the new session rather than the previous conversation.

### Development Verification

After login, inspect the response and confirm that a UUID-like session_id is
returned. Decode the JWT during development and confirm the same value is
present in the session_id claim.

Then:

1. Send multiple POST /chat/history requests during the same login
session.
2. Verify that all messages reference the same chat_history.id.
3. Send GET /chat/history using the same JWT.
4. Verify that the conversation and all associated messages are returned.
5. Log out and authenticate again.
6. Confirm that the new login receives a different session_id.
7. Save another message and verify that it is associated with the new session.

---

## Administrative Dashboard Development

The Admin Dashboard is now a data-backed section rather than a static
placeholder. The existing `GET /admin/dashboard` endpoint returns the data
required by the dashboard UI.

### Dashboard API Response

The response includes:

- `stats.users` — total users.
- `stats.conversations` — total `chat_history` records.
- `stats.messages` — total `chat_messages` records.
- `stats.active_users` — distinct users with at least one conversation.
- `recent_users` — up to five users ordered by descending user ID.
- `recent_conversations` — up to five conversations ordered by descending
  conversation timestamp.
- `activity` — seven calendar days of conversation and message counts.

The dashboard activity calculation uses the `Asia/Kolkata` analytics timezone.
Conversation counts are based on `ChatHistory.timestamp`; message counts are
calculated by joining `ChatMessage` to `ChatHistory` through `chat_id` and using
the same conversation timestamp window.

### Dashboard Frontend

The dashboard is implemented through:

- `dashboard.js`
- `dashboard.service.js`
- `dashboard.charts.js`
- `dashboard.css`
- Chart.js is loaded in `frontend/admin.html` from the jsDelivr CDN for dashboard chart rendering.
- dashboard rendering in `admin_ui.js`

`admin.js` initializes the dashboard section and calls `fetchDashboard()` when
Dashboard navigation is selected. Dashboard state is communicated through
`dashboard:loading`, `dashboard:loaded`, and `dashboard:error` events.

The dashboard displays four summary cards, activity charts, recent users, and
recent conversations. Usernames and roles rendered into dashboard HTML are
escaped before insertion.

### Dashboard Development Verification

For local development:

1. Sign in with an administrator account.
2. Open the Admin **Dashboard** section.
3. Verify the four summary values are populated.
4. Verify the activity charts display the last seven days.
5. Verify recent users and recent conversations are displayed.
6. Confirm a failed dashboard request produces the documented error state
   rather than leaving stale loading values.

---

## Administrative Analytics Development

The Admin application includes an analytics section backed by
`auth_service/app/routes/admin_analytics.py`. The router is mounted by the
Auth Service at:

```text
/auth/admin/analytics
```

All analytics endpoints require administrator authorization.

### Analytics Date Range

The backend uses `Asia/Kolkata` as the analytics timezone. The optional
`start_date` and `end_date` parameters use `YYYY-MM-DD` values.

When no end date is supplied, the current date in `Asia/Kolkata` is used.
When no start date is supplied, the default range starts 29 days before the
selected end date.

The range is converted into timezone-aware start/end datetime boundaries
before database filtering.

### Analytics Endpoints

The analytics router provides:

```text
GET /admin/analytics/overview
GET /admin/analytics/chat-activity
GET /admin/analytics/message-activity
GET /admin/analytics/top-users
GET /admin/analytics/chat-statistics
GET /admin/analytics/hourly-activity
```

`top-users` accepts `limit`, constrained to 1–100 and defaulting to 10.

### Analytics Frontend

The Admin analytics implementation is split across:

```text
frontend/js/analytics.js
frontend/js/analytics.controller.js
frontend/js/analytics.events.js
frontend/js/analytics.service.js
frontend/css/analytics.css
```

`analytics.service.js` maintains the selected date range and requests the six
datasets in parallel. `analytics.controller.js` handles initialization,
date presets, filtering, refresh, export, and rendering. EventBus events
coordinate loading, loaded, error, refresh, and export states.

The analytics export is generated client-side as CSV from the fetched
overview, daily chat activity, and top-user data.

### Analytics Development Verification

For local development:

1. Sign in with an administrator account.
2. Open the Admin **Analytics** section.
3. Verify the default date range is populated.
4. Confirm the analytics requests are sent through `/auth/admin/analytics`.
5. Apply a custom date range and verify that the same range is used by the
   analytics requests.
6. Refresh the analytics section and verify that fresh requests are issued.
7. Export the analytics and verify that a CSV file is generated.

---

## Pending Development and Hardening Items

The following items have been identified during development and testing and
are intentionally recorded here until they are implemented and verified.

### 1. Admin Users ORM Response Schema

Current behavior:

```http
GET /admin/users
```

currently exposes the serialized ORM user model.

Required follow-up:

Introduce an explicit response schema so that the API exposes only fields
intentionally approved for administrative use.

`Status`: Pending.

### 2. Chat Session Uniqueness Constraint

The session-aware chat model requires:

```text
UNIQUE (user_id, session_id)
```

on chat_history.

Required follow-up:

Add and verify a database-level uniqueness constraint for the combination of:

```text
user_id
session_id
```

This should prevent duplicate chat-history records for the same user/session,
including under concurrent requests.

`Status`: Pending.

### 3. get_user_chats() Test Coverage

The following endpoint requires an explicit test:

```http
GET /admin/users/{user_id}/chats
```

The test must verify:

- Administrator access succeeds.
- Only the requested user's chats are returned.
- A user with no chats returns an empty collection.
- A nonexistent user produces the documented not-found response.
- An `ordinary-user JWT` receives `403 Forbidden`.
- Chat histories belonging to other users are not returned.

`Status`: Pending verification.

### 4. delete_chat_history() Test Coverage

The administrative chat-history deletion endpoint is:

```http
DELETE /admin/chat/history/{session_id}
```

The test should verify:

- Administrator authorization.
- Successful deletion of the requested chat history.
- Associated chat_messages are deleted through `ON DELETE CASCADE`.
- The deleted session is no longer returned by `chat-history` queries.
- An `ordinary-user JWT` receives `403 Forbidden`.
- Behavior for a nonexistent session is documented and verified.

`Status`: Pending verification.

### 5. Physical Encrypted-File Cleanup

Database-level user deletion and cascading deletion have been demonstrated,
but PostgreSQL does not automatically remove encrypted files stored under:

```text
file_service/uploads/*.enc
```

Required follow-up:

Implement and verify application-level cleanup of physical encrypted storage
when the corresponding database records are deleted.

`Status`: Pending.

### 6. Admin Users Pagination Size

The Admin Users UI implements pagination, but the exact number of users
displayed per page has not yet been explicitly tested and documented.

Required follow-up:

Verify the actual pagination behavior by testing with enough users to span
multiple pages and confirm:

- Number of users displayed on each page.
- Behavior when the total number of users is less than one page.
- Behavior on the final partially filled page.
- Page navigation behavior.
- Interaction between search filtering and pagination.
- Refresh behavior after pagination.

Once verified, document the confirmed page size in the Admin User List
Development section and the corresponding testing section.

`Status`: Pending verification.


**Tracking Rule** - 
Items in this section should remain until the corresponding implementation
and test verification have been completed.

When an item is completed, update the relevant development/testing sections
and remove or mark the item as completed here.

---