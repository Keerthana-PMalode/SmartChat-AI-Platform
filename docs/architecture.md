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
             │        └──────┬───────┘          │
             │               │                  │
             └───────────────┼──────────────────┘
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
   │ /auth/*
   ▼
Nginx :8081
   │
   ▼
auth:8000
```

Backend services communicate using Docker Compose service names rather than
localhost.

---

## 4. Nginx and Frontend

Nginx performs two primary roles:

- Serves frontend static files.

- Reverse-proxies API requests to backend services.

The browser sends application requests to Nginx:

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

This provides a single application entry point while keeping backend services
logically separated.

Individual backend ports may be published by Docker Compose for development
and troubleshooting, but they are not required for normal application traffic.

---

## 5. Authentication Architecture

The Authentication Service is implemented using FastAPI.

Its responsibilities include:

- User registration
- User login
- Password hashing
- JWT generation
- JWT validation
- Role-based authorization
- User administration
- User deletion and account lifecycle management

After successful authentication, the Auth Service issues a JWT.

The frontend sends the token with protected API requests:

```http
Authorization: Bearer <JWT>
```

The authentication flow is:

```text
Browser
   │
   │ Login credentials
   ▼
Nginx :8081
   │
   ▼
Auth Service :8000
   │
   ├──► Validate credentials
   ├──► Verify password
   └──► Generate JWT
             │
             ▼
          Browser
             │
             ▼
       Store authToken
             │
             ▼
Authorization: Bearer <JWT>
```

The JWT contains authentication information such as:

- User ID
- Username
- Role
- Expiration time

The frontend stores the token using the authToken key in browser
localStorage.

---

## 6. Authorization Model

Protected resources are accessed only after JWT validation.

The authenticated user's identity is derived from the validated token.

```text
Authorization: Bearer <JWT>
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
       ┌──────┴──────┐
       ▼             ▼
   Authorized     Rejected
```

Authorization is applied to user-specific resources such as chat history and
files.

---

## 7. Chatbot Architecture

Rasa provides the conversational AI layer.

The Rasa deployment consists of:

- Rasa Server
- Rasa SDK
- Rasa model artifacts
- NLU, rules, stories, and domain configuration

The request flow is:

```
Browser
   │
   │ /rasa/*
   ▼
Nginx :8081
   │
   ▼
Rasa :5006
   │
   ├──► Dialogue / NLU processing
   │
   └──► Rasa SDK :5055
             │
             ▼
        Custom Actions
```

The Rasa SDK provides custom actions used by the Rasa Server.

---

## 8. Authenticated Chat Sessions

SmartChat does not support guest or unauthenticated chatbot sessions.

A chatbot session is associated with an authenticated registered user.

The logical relationship is:

```text
User
 │
 │ 1:N
 ▼
Chat
 │
 │ 1:N
 ▼
Chat Message
```

A chat contains a session_id identifying an individual conversation.

Chat records are associated with the authenticated user's user_id.

---

## 9. Chat History Isolation

Chat-history operations require a valid JWT.

### Save Chat History

```text
POST /chat/history
        │
        ▼
JWT Validation
        │
        ▼
current_user.id
        │
        ▼
Create Chat History
        │
        ├──► user_id
        ├──► session_id
        ├──► message
        └──► response
```

### Retrieve Chat History

```text
GET /chat/history/{session_id}
        │
        ▼
JWT Validation
        │
        ▼
current_user.id
        │
        ▼
Query:
session_id = requested session
AND
user_id = authenticated user
        │
        ▼
Return user's chat history
```

The combination of session_id and authenticated user_id prevents a user
from retrieving another user's chat history by supplying another user's
session ID.

Unauthenticated requests are rejected.

---

## 10. File Service Architecture

The File Service is implemented using FastAPI.

It provides:

- File upload
- File download
- File deletion
- File encryption
- File decryption
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

## 11. File Ownership and Sharing

Each file is associated with an owning user.

Authorized users may share files with other registered users.

The sharing flow is:

```text
File Owner
    │
    │ Share File
    ▼
File Service
    │
    ├──► Validate JWT
    ├──► Verify ownership / authorization
    ├──► Create permission
    └──► Record audit event
```

Before protected file operations such as downloading, the File Service checks
whether the authenticated user owns the file or has an appropriate permission.

---

## 12. File Encryption Architecture

Uploaded files are encrypted using a unique Fernet encryption key.

The file encryption key is not stored as plaintext in the database.

The encryption process is:

```text
Uploaded File
      │
      ▼
Generate unique Fernet file key
      │
      ▼
Encrypt file using Fernet
      │
      ▼
Store encrypted file
      │
      ▼
Wrap file key using FILE_MASTER_KEY
      │
      ▼
Store wrapped key
      │
      ▼
encryption_keys
```

The server-side FILE_MASTER_KEY protects the stored file encryption keys.

The architecture therefore separates encrypted file contents from their
protected encryption keys.

---

## 13. File Decryption Architecture

When an authorized user downloads a file:

```text
Browser
   │
   │ GET /files/{id}/download
   │ Authorization: Bearer <JWT>
   ▼
Nginx
   │
   ▼
File Service
   │
   ├──► Validate JWT
   ├──► Identify authenticated user
   ├──► Check ownership / permission
   ├──► Retrieve encrypted file
   ├──► Retrieve wrapped key
   ├──► Unwrap key using FILE_MASTER_KEY
   ├──► Decrypt file
   └──► Return original file
```

This ensures that decryption occurs only after authentication and
authorization checks.

---

## 14. Database Architecture

PostgreSQL is the primary persistent data store.

The database is available internally as:

```text
postgres:5432
```

It stores application data associated with:

- Users
- Chats
- Chat messages
- Files
- Encryption keys
- Permissions
- Audit logs

PostgreSQL is not intended to be directly accessed by the browser.

---

## 15. Database Relationships

The primary data relationships are:
```text

                         ┌─────────────────────┐
                         │       users         │
                         ├─────────────────────┤
                         │ id (PK)             │
                         │ username            │
                         │ hashed_password     │
                         │ role                │
                         └──────────┬──────────┘
                                    │
             ┌──────────────────────┼─────────────────────────┐
             │                      │                         │
             │ 1:N                  │ 1:N                     │ 1:N
             ▼                      ▼                         ▼
   ┌─────────────────┐    ┌─────────────────┐      ┌────────────────────┐
   │  chat_history   │    │      files      │      │ file_access_logs   │
   ├─────────────────┤    ├─────────────────┤      ├────────────────────┤
   │ id (PK)         │    │ id (PK)         │      │ id (PK)            │
   │ user_id (FK)    │    │ owner_id (FK)   │      │ user_id (FK)       │
   │ session_id      │    │ ...             │      │ file_id (FK)       │
   │ message         │    └────────┬────────┘      │ action             │
   │ response        │             │               └────────────────────┘
   └────────┬────────┘             │
            │                      │ 1:N
            │ 1:N                  │
            ▼                      │
   ┌─────────────────┐             │
   │  chat_messages  │             │
   ├─────────────────┤             │
   │ id (PK)         │             │
   │ chat_id (FK)    │             │
   │ role            │             │
   │ content         │             │
   └─────────────────┘             │
                                   │
                         ┌─────────┴──────────┐
                         │                    │
                         │ 1:N                │ 1:N
                         ▼                    ▼
                ┌─────────────────┐   ┌─────────────────────┐
                │ encryption_keys │   │ file_permissions    │
                ├─────────────────┤   ├─────────────────────┤
                │ id (PK)         │   │ id (PK)             │
                │ file_id (FK)    │   │ file_id (FK)        │
                │ key_algorithm   │   │ shared_by (FK)      │
                │ encrypted_key   │   │ shared_with_user_id │
                └─────────────────┘   └─────────────────────┘
```

The exact cardinality of relationships should be considered authoritative only
if it is enforced by the application's database schema.

### Cross-Service User References

The Auth Service owns the `users` table and is the authoritative source for
user identity data.

The File Service stores references to Auth Service users in its own database
tables. PostgreSQL enforces the corresponding foreign-key relationships to
`users.id`, including `ON DELETE CASCADE`.

At the application layer, the File Service does not depend on the Auth
Service's SQLAlchemy `users` model. User identity and user information are
handled through the Auth Service/API.

Detailed implementation guidance is documented in `development.md`.

---

## 16. Audit Logging

File-related operations can be recorded in the file_access_logs table.

Audit records may contain:

- User ID
- File ID
- Action
- IP address
- Access time

Typical operations include:

```text
UPLOAD
SHARE
DOWNLOAD
```

The audit flow is:

```text
File Operation
      │
      ▼
File Service
      │
      ├──► Authorization
      ├──► Perform operation
      └──► Record audit event
                  │
                  ▼
          file_access_logs
```

When the application runs behind Docker and Nginx, the backend may observe a
Docker gateway or proxy address instead of the original client IP.

If original client IP logging is required, Nginx and the backend must be
configured to securely forward and interpret trusted proxy headers such as:

```text
X-Forwarded-For
X-Real-IP
```

Only trusted proxy sources should be permitted to provide client-IP
information.

---

## 17. Storage Architecture

The platform uses persistent Docker volumes for PostgreSQL data and Rasa
trained models.

```text
Docker Volumes
      │
      ├──► PostgreSQL Data
      │
      └──► Rasa Model Artifacts
```

The documented volumes are:

```text
chatbot-project_postgres_data
chatbot-project_rasa_models
```

Encrypted uploaded files are stored in File Service runtime storage and are
excluded from version control.

The runtime upload directory is:

```text
file_service/uploads/
```

---

## 18. Configuration and Secrets
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

- SECRET_KEY
- FILE_MASTER_KEY
- POSTGRES_PASSWORD

FILE_MASTER_KEY is particularly important because it protects the wrapped
file encryption keys.

---

## 19. Security Boundaries

The architecture provides several security boundaries.

### Authentication

Protected endpoints require a valid JWT.

```text
Request
   │
   ▼
JWT Validation
   │
   ├── Valid ──────► Continue
   │
   └── Invalid ────► Reject
```

### Chat Data Isolation

Chat history is scoped to the authenticated user:

```text
session_id
     +
authenticated user_id
     │
     ▼
Authorized chat history
```

### File Authorization

File access requires both authentication and appropriate authorization:

```text
JWT
 │
 ▼
Authenticated User
 │
 ▼
Ownership / Permission Check
 │
 ├── Authorized ──► File Operation
 │
 └── Unauthorized ──► Reject
```

### File Encryption

File contents and encryption keys are protected separately:

```text
File
 │
 ▼
Encrypted File
 │
 └──────────────────► Encrypted File Storage
```
```text
File Encryption Key
 │
 ▼
Wrapped with FILE_MASTER_KEY
 │
 ▼
PostgreSQL
```

---

## 20. Development and Production Traffic

The architecture distinguishes normal browser traffic from development
access.

Normal application traffic follows:

```text
Browser
   │
   ▼
localhost:8081
   │
   ▼
Nginx
   │
   ├──► auth:8000
   ├──► rasa:5006
   └──► file_service:8001
```

Development and troubleshooting may use published host ports such as:

```http
Auth Service:  http://localhost:8000/docs
File Service:  http://localhost:8001/docs
Rasa Server:   http://localhost:5006/
```

These published ports are convenience endpoints and should not be confused
with the internal Docker service addresses.

---

## 21. End-to-End Request Flows

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

Chat-history persistence and retrieval are subject to authenticated
user-scoped authorization.

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
   │ JWT + file ID
   ▼
Nginx
   │
   ▼
File Service
   │
   ├──► Validate JWT
   ├──► Check ownership / permission
   ├──► Retrieve encrypted file
   ├──► Retrieve wrapped key
   ├──► Unwrap file key
   ├──► Decrypt file
   └──► Return file
```

---

## 22. Architectural Principles

SmartChat follows these architectural principles:

- Separation of concerns — authentication, file management, and
conversational AI are separate services.
- Single browser-facing gateway — Nginx provides the normal application
entry point.
- Private service networking — backend services communicate using Docker
Compose service names.
- Authenticated access — protected application functionality requires JWT
authentication.
- Per-user isolation — chat history is scoped to the authenticated user.
- Encrypted file storage — uploaded files are encrypted before storage.
- Protected encryption keys — file encryption keys are wrapped using
FILE_MASTER_KEY.
- Persistent storage — PostgreSQL and Rasa models use persistent storage.
- Auditable operations — file-related operations can be recorded in audit
logs.
- Development/production separation — published backend ports support
troubleshooting while normal browser traffic uses Nginx.

---

## 23. Architecture Summary

The SmartChat AI Platform can be summarized as:

```text
Browser
   │
   ▼
Nginx :8081
   │
   ├──► Auth Service :8000
   │       │
   │       └──► PostgreSQL
   │
   ├──► Rasa :5006
   │       │
   │       └──► Rasa SDK :5055
   │
   └──► File Service :8001
           │
           ├──► PostgreSQL
           │
           └──► Encrypted File Storage
```

Authentication is provided through JWTs, chat history is isolated by
authenticated user identity, files are encrypted using per-file Fernet keys,
and those keys are protected using FILE_MASTER_KEY.

Docker Compose provides service orchestration and private service networking,
while Nginx provides the unified browser-facing application gateway.