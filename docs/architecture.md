# SmartChat AI Platform — Architecture

## 1. Architecture Overview

SmartChat AI Platform uses a containerized microservice architecture.

The platform separates frontend delivery, authentication, conversational AI,
file management, and persistent storage into independent services.

Nginx is the primary browser-facing gateway. Backend services communicate over
the private Docker Compose network using service names.

```text
                           Browser
                              │
                              │ HTTP :8081
                              ▼
                    ┌────────────────────┐
                    │       Nginx        │
                    │ Reverse Proxy      │
                    │ Frontend Gateway   │
                    └─────────┬──────────┘
                              │
              ┌───────────────┼────────────────┐
              │               │                │
              ▼               ▼                ▼
      ┌──────────────┐ ┌──────────────┐ ┌────────────────┐
      │ Auth Service │ │ Rasa Server  │ │  File Service  │
      │   :8000      │ │   :5006      │ │     :8001      │
      └──────┬───────┘ └──────┬───────┘ └───────┬────────┘
             │                │                 │
             │                ▼                 │
             │        ┌──────────────┐          │
             │        │  Rasa SDK    │          │
             │        │    :5055     │          │
             │        └──────────────┘          │
             │                                  │
             └───────────────┬──────────────────┘
                             │
                             ▼
                    ┌──────────────────┐
                    │   PostgreSQL     │
                    │      :5432       │
                    └──────────────────┘
```

The File Service also communicates with encrypted runtime file storage.

---

## 2. Service Architecture

The platform consists of the following primary services:

| Service     | Responsibility                      | Internal Address    |
|-------------|-------------------------------------|---------------------|
| nginx       | Frontend delivery and reverse proxy | `nginx`             |
| auth        | Authentication and authorization    | `auth:8000`         |
| file_service| Secure file management              | `file_service:8001` |
| rasa        | Conversational AI                   | `rasa:5006`         |
| rasa_sdk    | Custom Rasa actions                 | `rasa_sdk:5055`     |
| postgres    | Persistent database                 | `postgres:5432`     |

The services communicate through the Docker Compose network.

The browser normally communicates only with Nginx.

---

## 3. Network Architecture

The normal browser-facing endpoint is:

```http
http://localhost:8081
```

Nginx routes requests according to their path.

| Browser Route | Destination          | Purpose                      |
|---------------|----------------------|------------------------------|
| `/`           | Nginx                | Frontend static files        |
| `/auth/*`     | `auth:8000`          | Authentication and user APIs |
| `/rasa/*`     | `rasa:5006`          | Rasa conversational API      |
| `/files/*`    | `file_service:8001`  | File-management API          |

The internal Docker addresses are not browser-facing URLs.

For example:

```text
Browser
   │
   ▼
Nginx :8081
   │
   ├──► auth:8000
   ├──► rasa:5006
   └──► file_service:8001
```

Published backend ports may be used for development and troubleshooting but
are not required for normal application traffic.

---

## 4. Nginx and Frontend

Nginx performs two primary roles:

- Serves frontend static files.

- Reverse-proxies API requests to backend services.

The browser therefore has a single application entry point:

```text
Browser
   │
   ▼
Nginx :8081
   │
   ├──► Frontend files
   ├──► Auth Service
   ├──► Rasa
   └──► File Service
```

This provides a unified browser-facing endpoint while keeping backend services
logically separated.

---

## 5. Authentication Architecture

The Authentication Service is implemented using FastAPI.

Its responsibilities include:

- User registration
- User login
- Password hashing
- JWT generation and validation
- Role-based authorization
- User administration
- User lifecycle management

After successful authentication, the Auth Service issues a JWT.

Protected requests use:

```http
Authorization: Bearer <JWT>
```

The JWT contains authentication information such as:

- User ID
- Username
- Role
- Expiration time

The frontend stores the JWT using the authToken key in browser localStorage.

The authorization flow is:

```text
Request
   │
   ▼
JWT Validation
   │
   ▼
Authenticated User
   │
   ▼
Authorization Check
   │
   ├──► Authorized
   │
   └──► Rejected
```

User-specific resources are authorized using the authenticated user's identity.

---

## 6. Chat Architecture

Rasa provides the conversational AI layer.

The Rasa deployment consists of:

- Rasa Server
- Rasa SDK
- Rasa model artifacts
- NLU, rules, stories, and domain configuration

The request flow is:

```text
Browser
   │
   │ /rasa/*
   ▼
Nginx :8081
   │
   ▼
Rasa :5006
   │
   └──► Rasa SDK :5055
              │
              ▼
         Custom Actions
```

### Chat Sessions

SmartChat supports authenticated chatbot sessions only.

Each chat session belongs to an authenticated user and contains multiple
messages.

The logical relationship is:

```text
User
 │
 │ 1:N
 ▼
chat_history
 │
 │ 1:N
 ▼
chat_messages
```

**chat_history** represents the conversation/session.

**chat_messages** stores the individual messages belonging to that session.

A **chat_history** record contains:

```text
id
user_id
session_id
timestamp
```

A **chat_messages** record contains:

```text
id
chat_id
role
content
created_at
```

Supported message roles are:

- user
- chatbot

The database relationship is:

```text
chat_messages.chat_id
        │
        │ FK
        ▼
chat_history.id
```

with:

```text
ON DELETE CASCADE
```

Therefore, deleting a chat-history record also deletes its associated
messages.

### Chat Isolation

Chat-history access is scoped to the authenticated user.

```text
JWT
 │
 ▼
authenticated user_id
 │
 ├──► session_id
 │
 ▼
authorized chat history
```

A user cannot access another user's chat history by supplying another user's
session identifier.

---

## 7. File Service Architecture

The File Service is implemented using FastAPI.

Its responsibilities include:

- File upload
- File download
- File deletion
- File encryption and decryption
- File sharing
- Permission management
- File ownership checks
- Audit logging

The request path is:

```text
Browser
   │
   │ /files/*
   ▼
Nginx :8081
   │
   ▼
File Service :8001
   │
   ├──► PostgreSQL
   │
   └──► Encrypted File Storage
```

---

## 8. File Encryption and Sharing

Uploaded files are encrypted using a unique Fernet encryption key.

The file encryption key is protected using the server-side
**FILE_MASTER_KEY**.

```text
Uploaded File
      │
      ▼
Generate unique Fernet key
      │
      ▼
Encrypt file
      │
      ▼
Encrypted File Storage
```

The encryption key is wrapped using **FILE_MASTER_KEY**:

```text
File Encryption Key
      │
      ▼
Wrapped using FILE_MASTER_KEY
      │
      ▼
PostgreSQL
      │
      ▼
encryption_keys
```

The architecture therefore separates encrypted file contents from their
protected encryption keys.

### File Sharing

The File Service supports two sharing mechanisms:

- Direct user-to-user sharing through file_permissions.
- Share-link access through shared_links.

Direct sharing requires authenticated authorization.

Share-link access uses a share-link token and does not require a JWT.

```text
File Owner
    │
    ├──► Direct Permission
    │       └──► file_permissions
    │
    └──► Share Link
            └──► shared_links
```

Both mechanisms ultimately access the same encrypted file storage.

---

## 9. Database Architecture

PostgreSQL is the primary persistent data store.

It is available internally as:

```text
postgres:5432
```

PostgreSQL stores application data associated with:

- Users
- Chat sessions
- Chat messages
- Files
- Encryption keys
- File permissions
- Share links
- Audit logs

PostgreSQL is not intended to be directly accessed by the browser.

---

## 10. Database Relationships

The primary database relationships are:

```text
users
  │
  ├── 1:N ──► chat_history
  │               │
  │               └── 1:N ──► chat_messages
  │
  ├── 1:N ──► files
  │               │
  │               ├── 1:N ──► encryption_keys
  │               ├── 1:N ──► file_permissions
  │               ├── 1:N ──► shared_links
  │               └── 1:N ──► file_access_logs
  │
  ├── 1:N ──► file_permissions
  │
  └── 1:N ──► file_access_logs

shared_links
  │
  └── 1:N ──► file_access_logs
```

### Chat Deletion Cascade

The chat-specific foreign-key relationships are:

```text
chat_history.user_id
    ─────► users.id
            ON DELETE CASCADE

chat_messages.chat_id
    ─────► chat_history.id
            ON DELETE CASCADE
```

Therefore, deleting a user cascades to the user's chat-history records, and
deleting a chat-history record cascades to its associated chat messages.

```text
Delete User
    │
    ▼
chat_history records
    │
    ▼
chat_messages records
```

This ensures that user deletion does not leave orphaned chat sessions or
messages.

### Cross-Service User References

- The Auth Service owns the **users** table and is the authoritative source for
user identity.

- The File Service stores references to Auth Service users in its own tables.

- The File Service does not depend on the Auth Service's SQLAlchemy **users**
model. User identity is handled through the Auth Service/API.

- PostgreSQL currently enforces the relevant foreign-key relationships to
**users.id**, including **ON DELETE CASCADE**.

---

## 11. Audit Logging

The File Service records successful file-related operations in the
**file_access_logs** table.

The audit log contains:

- file_id
- user_id
- share_link_id
- access_method
- action
- ip_address
- user_agent
- access_time

Supported access methods are:

- AUTHENTICATED
- SHARE_LINK

The access context is:

```text
AUTHENTICATED
    user_id       = authenticated user's ID
    share_link_id = NULL

SHARE_LINK
    user_id       = NULL
    share_link_id = ID of the share link
```

The database enforces this invariant using the:

- ck_file_access_logs_access_context

CHECK constraint.

The audit flow is:

```text
File Operation
      │
      ▼
Authenticate / Validate Access
      │
      ▼
Authorization
      │
      ▼
Perform Operation
      │
      ▼
Record Successful Audit Event
      │
      ▼
file_access_logs
```

Typical audited operations include:

- UPLOAD
- SHARE
- DOWNLOAD

Only successful file operations are recorded.

---

## 12. Storage Architecture

The platform uses persistent Docker volumes for PostgreSQL data and Rasa
trained models.

```text
Docker Volumes
      │
      ├──► PostgreSQL Data
      │
      └──► Rasa Model Artifacts
```

Encrypted uploaded files are stored separately in File Service runtime
storage:

```text
file_service/uploads/
```

The encrypted files are excluded from version control.

Database deletion does not automatically remove physical encrypted files from
this runtime storage. Application-level cleanup is therefore required for
complete file deletion.

---

## 13. Configuration and Secrets

Environment-specific configuration is supplied through .env.

Important configuration values include:

```text
DATABASE_URL
SECRET_KEY
FILE_MASTER_KEY
POSTGRES_HOST
POSTGRES_PORT
POSTGRES_USER
POSTGRES_PASSWORD
POSTGRES_DB
```

Production secrets must not be committed to version control.

The most security-sensitive values are:

```text
SECRET_KEY
FILE_MASTER_KEY
POSTGRES_PASSWORD
```

**FILE_MASTER_KEY** is particularly important because it protects the stored
file encryption keys.

---

## 14. Security Boundaries

### Authentication

Protected endpoints require a valid JWT.

```text
Request
   │
   ▼
JWT Validation
   │
   ├──► Valid ──────► Continue
   │
   └──► Invalid ────► Reject
```

### Chat Data Isolation

Chat history is scoped to the authenticated user:

```text
authenticated user_id
        +
session_id
        │
        ▼
authorized chat history
```

### File Authorization

File access requires appropriate authentication and authorization:

```text
JWT / Share Link
       │
       ▼
Access Identity
       │
       ▼
Ownership / Permission / Link Validation
       │
       ├──► Authorized ──► File Operation
       │
       └──► Unauthorized ──► Reject
```

### File Encryption

File contents and encryption keys are protected separately:

```text
File
 │
 ▼
Encrypted File
 │
 └──► Encrypted File Storage
```
```text
File Encryption Key
 │
 ▼
Wrapped using FILE_MASTER_KEY
 │
 ▼
PostgreSQL
```

---

## 15. End-to-End Request Flows

### Authentication

```text
Browser
   │
   │ Login
   ▼
Nginx
   │
   ▼
Auth Service
   │
   ▼
PostgreSQL
   │
   ▼
JWT
   │
   ▼
Browser
```

### Chat

```text
Browser
   │
   │ JWT + chat request
   ▼
Nginx
   │
   ▼
Rasa
   │
   ├──► Rasa SDK
   │
   └──► Chat processing
```

Chat-history persistence and retrieval are scoped to the authenticated user.

### File Upload

```text
Browser
   │
   │ JWT + file
   ▼
Nginx
   │
   ▼
File Service
   │
   ├──► Validate JWT
   ├──► Generate encryption key
   ├──► Encrypt file
   ├──► Store encrypted file
   ├──► Wrap encryption key
   ├──► Store metadata and wrapped key
   └──► Record audit event
```

### File Download

```text
Browser
   │
   │ JWT or share-link token
   ▼
Nginx
   │
   ▼
File Service
   │
   ├──► Validate access
   ├──► Check authorization
   ├──► Retrieve encrypted file
   ├──► Retrieve wrapped key
   ├──► Unwrap file key
   ├──► Decrypt file
   └──► Return file
```

---

## 16. Architectural Principles

SmartChat follows these architectural principles:

- **Separation of concerns** — authentication, file management, and
conversational AI are separate services.
- **Single browser-facing gateway** — Nginx provides the normal application
entry point.
- **Private service networking** — backend services communicate using Docker
Compose service names.
- **Authenticated access** — protected functionality requires JWT
authentication.
- **Per-user isolation** — chat history is scoped to the authenticated user.
- **Encrypted file storage** — uploaded files are encrypted before storage.
- **Protected encryption keys** — file encryption keys are wrapped using
**FILE_MASTER_KEY**.
- **Persistent storage** — PostgreSQL and Rasa models use persistent storage.
- **Auditable operations** — successful file operations are recorded in audit
logs.
- **Database-enforced audit integrity** — audit records enforce valid access
contexts.
- **Traceable sharing** — share-link access retains the specific share-link
identifier used.
- **Development/production separation** — published backend ports support
troubleshooting while normal browser traffic uses Nginx.