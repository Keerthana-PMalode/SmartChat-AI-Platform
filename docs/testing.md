# Testing Guide

## 1. Environment Verification

## 2. Authentication Testing

## 3. JWT Authorization Testing

## 4. Chat History Isolation Testing

## 5. File Upload Testing

## 6. File Download Testing

## 7. File Sharing Testing

## 8. File Permission Testing

## 9. Audit Log Testing

## 10. Encryption Testing

## 11. IP Address Logging Testing

## 12. Nginx Routing Testing

## 13. Database Verification

## 14. Docker Service Testing

## 15. Security Testing

## 16. Session-Aware Chat Testing

## 17. Administrative Chat History Testing

## 18. Administrative Users UI Testing

## 19. Admin Frontend Navigation and Session Cleanup Testing

## 20. Updated Verification Summary

---

## 4. Chat History Isolation Testing

Chat history is restricted to authenticated users and is isolated by
`user_id`.

### 4.0 Chat History Storage Model

Chat history is stored using:

```text
chat_history
    │
    └── 1:N
          ▼
     chat_messages
```

A chat_history record contains:

```text
id
user_id
session_id
timestamp
```

A chat_messages record contains:

```text
id
chat_id
role
content
created_at
```

The supported roles are:

```text
user
chatbot
```

For example, storing user message:

```text
Hiiiii
```

Chatbot response:

```text
Helloooo
```
should produce:

chat_history

```text
id = 1
user_id = 38
session_id = "chat_test_UserA"
```

chat_messages

```text
id = 1
chat_id = 1
role = "user"
content = "Hiiiii"

id = 2
chat_id = 1
role = "chatbot"
content = "Helloooo"
```

### 4.0.1 Verify Chat Persistence

After a successful Store Chat request, verify the chat-history record:

```bash
docker compose exec -T postgres psql \
  -U chatbot \
  -d chatbot \
  -c "SELECT id, session_id, user_id, timestamp
      FROM chat_history
      ORDER BY id DESC
      LIMIT 10;"
```

Then verify its messages:

```bash
docker compose exec -T postgres psql \
  -U chatbot \
  -d chatbot \
  -c "SELECT id, chat_id, role, content, created_at
      FROM chat_messages
      WHERE chat_id = <CHAT_ID>
      ORDER BY id;"
```

**Expected Result:**

The chat-history record should contain the authenticated user's ID and the
requested session ID.

The associated chat_messages records should contain:

```text
role = user
content = original user message

and:

role = chatbot
content = chatbot response
```

### 4.0.2 Verify Chat-to-Message Relationship

Verify that every returned message belongs to the expected chat:

```bash
docker compose exec -T postgres psql \
  -U chatbot \
  -d chatbot \
  -c "SELECT h.id AS chat_id,
             h.session_id,
             h.user_id,
             m.id AS message_id,
             m.chat_id,
             m.role,
             m.content
      FROM chat_history h
      JOIN chat_messages m
        ON m.chat_id = h.id
      WHERE h.id = <CHAT_ID>
      ORDER BY m.id;"
```

**Expected Result:**

| chat_id | session_id | user_id | message_id | chat_id | role | content |
|---:|---|---:|---:|---:|---|---|
| 1 | chat_test_UserA | 38 | 1 | 1 | user | Hiiiii |
| 1 | chat_test_UserA | 38 | 2 | 1 | chatbot | Helloooo |

### 4.0.3 Verify Chat Message Cascade

The chat_messages.chat_id foreign key references
chat_history.id using ON DELETE CASCADE.

Create or identify a test chat and record its message count:

```bash
docker compose exec -T postgres psql \
  -U chatbot \
  -d chatbot \
  -c "SELECT count(*)
      FROM chat_messages
      WHERE chat_id = <CHAT_ID>;"
```

Delete the chat-history record through the appropriate application/API
operation.

Then verify:

```bash
docker compose exec -T postgres psql \
  -U chatbot \
  -d chatbot \
  -c "SELECT count(*)
      FROM chat_messages
      WHERE chat_id = <CHAT_ID>;"
```

**Expected Result:**

- 0

This confirms that deleting the parent chat_history record also deletes
the associated chat_messages records.

### 4.0.4 Verify API Response Structure

A successful Store Chat request should return the chat session together with
its associated messages.

Example:

```json
{
  "id": 1,
  "session_id": "chat_test_UserA",
  "user_id": 38,
  "timestamp": "2026-09-04T12:53:54.622459Z",
  "messages": [
    {
      "id": 1,
      "chat_id": 1,
      "role": "user",
      "content": "Hiiiii",
      "created_at": "2026-09-04T12:53:54.622459Z"
    },
    {
      "id": 2,
      "chat_id": 1,
      "role": "chatbot",
      "content": "Helloooo",
      "created_at": "2026-09-04T12:53:54.622459Z"
    }
  ]
}
```

The response confirms that:

- The chat is associated with the expected user_id.
- The requested session_id is preserved.
- Individual user and chatbot messages are stored separately.
- Each message references the parent chat through chat_id.

---

### 4.1 Authenticated Chat History Request

The server extracts both the user_id and session_id from the authenticated
JWT. The client does not provide the session ID as part of the request URL.

**Request**

```http
GET /chat/history
Authorization: Bearer <JWT>
```
The chat-history isolation model is:

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
```

**Result**

- Status: 200 OK
- User ID: 1
- Session ID: 618dd92e-84cd-47fd-8869-63d18ada80f3
- Chat history returned successfully
- Chat ID: 24
- Messages returned: 2

** Response **

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

**Verification**

The request was successfully authenticated using the JWT. The server extracted
the authenticated user's user_id and session_id and returned the
ChatHistory record matching both values.

The returned conversation contains:

```text
chat_history.id = 24
chat_history.user_id = 1
chat_history.session_id = 618dd92e-84cd-47fd-8869-63d18ada80f3
```

The conversation contains two associated messages:

```text
Message 65
    chat_id = 24
    role    = user
    content = Hiiiiiiiiiiiiiiiiiiiiiii

Message 66
    chat_id = 24
    role    = chatbot
    content = Helloooooooooooooooooooooooooooooooooooo
```

This confirms that authenticated users can retrieve the chat history associated
with their own authenticated user ID and session ID.

It also confirms that the current API uses the JWT-derived session rather than
accepting a client-supplied session_id in the request URL.

---

### 4.2 Unauthenticated Chat History Request

The same chat-history endpoint was accessed without providing a JWT.

**Request**

```http
GET /chat/history/registered-test-session-20260830-001
```

**Result**

```json
HTTP 401 Unauthorized
{
  "detail": "Not authenticated"
}
```

**Verification**

The request was rejected because no valid JWT was provided.

This confirms that unauthenticated or guest users cannot access chat history.

---

### 4.3 Cross-User Chat History Isolation

User A creates a chat session:

```http
session_id = abc123
user_id = User A
```

User B attempts to retrieve User A's chat history:

```http
GET /chat/history/abc123
Authorization: Bearer <User B JWT>
```

**Expected Result**

User B cannot retrieve User A's chat history.

The backend scopes the chat-history query to both:

```text
session_id = requested session
AND
user_id = authenticated user's ID
```

Since abc123 belongs to User A, no chat history is returned for User B.

**Result**

```json
HTTP/1.1 404 Not Found
{
  "detail": "No chat history found for this session"
}
```

This prevents an authenticated user from retrieving another user's chat
history by supplying that user's session_id.

---

## 7. File Sharing Testing

File sharing supports two distinct mechanisms:

1. Direct user-to-user sharing through `file_permissions`.
2. Share-link access through `shared_links`.

These mechanisms use different authorization models and should be tested
independently.

### 7.1 Direct User-to-User File Sharing

An authorized file owner can share a file with another registered user.

**Request**

```http
POST /files/{file_id}/share
Authorization: Bearer <OWNER_JWT>
Content-Type: application/json

{
  "user_id": 35,
  "permission": "READ"
}
```

**Expected Behavior**

The file should be successfully shared with the selected user.

A corresponding file_permissions record should be created.

**Expected Permission Record**

```text
file_id              = ID of the shared file
shared_with_user_id  = ID of the recipient
permission           = READ
shared_by            = ID of the user performing the share
```

The sharing operation should also create an audit record.

**Expected Audit Record**

```text
action        = SHARE
file_id       = ID of the shared file
user_id       = ID of the user who performed the share
share_link_id = NULL
access_method = AUTHENTICATED
```

---

### 7.2 Share-Link Creation

An authenticated file owner can create a share link for a file.

**Example Request:**

```http
POST /files/{file_id}/share-link
Authorization: Bearer <OWNER_JWT>
Content-Type: application/json

{
  "expires_at": null,
  "max_downloads": 1
}
```

**Expected Response:**

- Status: HTTP 200 OK
- Content-Type: application/json
- Body contains the created share-link details.

```json
{
  "id": 26,
  "file_id": 41,
  "url": "/files/shared/<secure-token>",
  "expires_at": null,
  "max_downloads": 1,
  "download_count": 0
}
```

The generated share-link token must be a long, cryptographically secure, randomly generated value.

The share link can subsequently be accessed without a JWT. The token itself
acts as the access credential.

---

### 7.3 Share-Link Database Verification

After creating a share link, verify that the record has been persisted.

```bash
docker compose exec -T postgres psql \
  -U chatbot \
  -d chatbot \
  -c "SELECT id, file_id, token, expires_at, max_downloads,
      download_count, created_by, created_at
      FROM shared_links
      ORDER BY id DESC;"
```

**Expected Result:**

For example:

The newly created share link should be stored with the expected file ID, token, expiration settings, download limit, download count, and creator ID.

| id | file_id | token | expires_at | max_downloads | download_count | created_by | created_at |
|----|---------|-------|------------|---------------|----------------|------------|------------|
| 4 | 39 | `<random-secure-token>` | `NULL` | 1 | 0 | 34 | `2026-09-02 05:15:42+00` |

Verify:

```text
file_id         = ID of the file
token           = securely generated random token
expires_at      = requested expiration or NULL
max_downloads   = requested limit or NULL
download_count  = 0 immediately after creation
created_by      = authenticated user's ID
created_at      = creation timestamp  
```

The token stored in the database must correspond to the token returned by the API.

---

### 7.4 Valid Share-Link Download

A valid share link should allow the file to be downloaded without an
Authorization header.

**Request:**

```http
GET /files/shared/{token}
```

No JWT should be supplied.

**Expected Result:**

- HTTP 200 OK

The encrypted file should be successfully read, decrypted, and returned.

A successful share-link download must also create an audit record.

---

### 7.5 Share-Link Download Count

Before downloading the file:

```bash
docker compose exec -T postgres psql \
  -U chatbot \
  -d chatbot \
  -c "SELECT id, download_count
      FROM shared_links
      WHERE id = <SHARE_LINK_ID>;"
```

**Expected Result:**

 - download_count = 0

After one successful share-link download:

- download_count = 1

The count must increase only after the encrypted file has been successfully
read and decrypted.

---

### 7.6 Share-Link Download Audit

After a successful share-link download, verify the audit record.

```bash
docker compose exec -T postgres psql \
  -U chatbot \
  -d chatbot \
  -c "SELECT id, file_id, user_id, share_link_id,
      access_method, action, ip_address, user_agent, access_time
      FROM file_access_logs
      WHERE share_link_id = <SHARE_LINK_ID>
      ORDER BY id DESC;"
```

**Expected Result:**

```text
user_id       = NULL
share_link_id = actual share-link ID
access_method = SHARE_LINK
action        = DOWNLOAD
```

For example:

| id | file_id | user_id | share_link_id | access_method | action     | ip_address   | access_time                       |
|----|---------|---------|---------------|---------------|------------|--------------|-----------------------------------|
| 63 | 25      | NULL    | 7             | SHARE_LINK    | `DOWNLOAD` | `172.20.0.1` | `2026-09-02 23:30:15.123456+00` |

The share-link ID provides traceability to the specific link that was used.

The downloader remains anonymous because no JWT identity is associated with
the request.

---

### 7.7 Maximum Download Limit

Create a share link with:

```json
{
  "expires_at": null,
  "max_downloads": 1
}
```

Perform:

Download #1 → HTTP 200 OK
Download #2 → HTTP 410 Gone

**Expected response** for the second request:

```json
{
  "detail": "Share link download limit reached"
}
```

Verify:

```bash
docker compose exec -T postgres psql \
  -U chatbot \
  -d chatbot \
  -c "SELECT id, download_count, max_downloads
      FROM shared_links
      WHERE id = <SHARE_LINK_ID>;"
```

**Expected:**

| download_count | max_downloads |
|----------------|---------------|
| 1              | 1             |

The second request must not create a new **SHARE_LINK** audit record.

---

### 7.8 Share-Link Expiration

Create a share link with an expiration time in the past.

For example:

```json
{
  "expires_at": "2026-09-01T10:00:00Z",
  "max_downloads": null
}
```

The API should reject creation because the expiration time is not in the
future.

**Expected Result:**

- HTTP 400 Bad Request

```json
{
  "detail": "Expiration time must be in the future"
}
```

For an already-created link whose expiration time has subsequently passed,
attempt:

```http
GET /files/shared/{token}
```

**Expected Result:**

- HTTP 410 Gone

```json
{
  "detail": "Share link has expired"
}
```

The following must remain unchanged:

- download_count

No new SHARE_LINK audit record should be created.

---

### 7.9 Invalid Share-Link Token

Request a token that does not exist:

```http
GET /files/shared/does-not-exist
```

**Expected Result:**

- HTTP 404 Not Found

```json
{
  "detail": "Share link not found"
}
```

No share-link audit record should be created.

---

### 7.10 Failed Share-Link Download

Temporarily change the storage_path for a share-linked file so that the
physical encrypted file does not exist.

**Request:**

```http
GET /files/shared/{token}
```

**Expected Result**

- HTTP 404 Not Found

```json
{
  "detail": "Stored file not found"
}
```

Verify:

- download_count = unchanged

and verify that no new **SHARE_LINK** audit record was created.

This confirms that only successful file access is audited.

---

### 7.11 Unauthorized Share-Link Creation

A non-owner must not be able to create a share link for another user's file.

Example:

```text
Authenticated user = 35
File owner         = 1
File ID            = 35
```

**Request:**

```http
POST /files/35/share-link
Authorization: Bearer <USER_35_JWT>
```

**Expected Result:**

- HTTP 403 Forbidden

```json
{
  "detail": "Only owner can create share links"
}
```

The authorization check compares:

- file.owner_id

against:

- current_user_id

Only the file owner may create a share link.

---

### 7.12 Share-Link Access Does Not Require JWT

A valid share link must work without:

```http
Authorization: Bearer <JWT>
```

The following is intentionally unauthenticated:

```http
GET /files/shared/{token}
```

This differs from:

```http
GET /files/{file_id}/download
```

The normal download endpoint requires authenticated authorization, while the
share-link endpoint uses the secure share token as its access credential.

---

### 7.13 File Deletion and Share-Link Cascade

**Create:**

```text
File
  |
  +-- Shared Link
```

Delete the file through the File Service.

Verify:

```bash
docker compose exec -T postgres psql \
  -U chatbot \
  -d chatbot \
  -c "SELECT *
      FROM shared_links
      WHERE file_id = <FILE_ID>;"
```

**Expected Result:**

- 0 rows

This verifies:

```text
files.id
   |
   +---- shared_links.file_id
          ON DELETE CASCADE
```

---

### 7.14 File Sharing Test Summary

The current share-link implementation has been verified for:

- Create valid share link          → **PASS**
- Valid anonymous link download    → **PASS**
- Download count increment         → **PASS**
- Maximum download enforcement     → **PASS**
- Expired link rejection           → **PASS**
- Invalid token rejection          → **PASS**
- Missing storage file → **PASS**
- Unauthorized link creation → **PASS**
- Share-link audit record → **PASS**
- Failed share-link download creates no audit record → **PASS**
- Expired link creates no audit record → **PASS**
- Maximum-download rejection creates no audit record → **PASS**
- File deletion cascade            → **PASS**

---

## 9. Audit Log Testing

The File Service records successful file-related operations in the
`file_access_logs` table. 

Phase 2 introduces explicit access-context tracking for authenticated and
share-link downloads.

The audit schema distinguishes:

```text
AUTHENTICATED
SHARE_LINK
```

The database also enforces the relationship between the access method and
the associated identity.

### 9.1 Audit Schema

The file_access_logs table contains:

```text
file_id
user_id
share_link_id
access_method
action
ip_address
user_agent
access_time
```

The access context follows these rules:

```text
AUTHENTICATED
    user_id       = required
    share_link_id = NULL

SHARE_LINK
    user_id       = NULL
    share_link_id = required
```

user_id is therefore nullable because anonymous share-link downloads
must be represented with:

```text
user_id = NULL
```

These rules are enforced at the database level by the 
ck_file_access_logs_access_context CHECK constraint.

This prevents invalid combinations from being inserted directly into the
database.

---

### 9.2 Verify Authenticated Download Audit

Download a file through:

```http
GET /files/{file_id}/download
Authorization: Bearer <JWT>
```

After the download, query:

```bash
docker compose exec -T postgres psql \
  -U chatbot \
  -d chatbot \
  -c "SELECT id, file_id, user_id, share_link_id,
      access_method, action, ip_address, access_time
      FROM file_access_logs
      WHERE file_id = <FILE_ID>
      ORDER BY id DESC;"
```

**Expected Result:**

A successful authenticated download should contain:

```text
user_id       = authenticated user's ID
share_link_id = NULL
access_method = AUTHENTICATED
action        = DOWNLOAD
```

For example:

| id  | file_id | user_id | share_link_id | access_method | action   | ip_address  | access_time                       |
|-----:|--------:|--------:|--------------:|---------------|----------|-------------|-----------------------------------|
| 120  | 41      | 35    | NULL            | AUTHENTICATED    | DOWNLOAD | `172.20.0.1` | `2026-08-29 21:56:59.445285+00` |

The authenticated user's identity is recorded directly in user_id.

---

### 9.3 Verify Share-Link Download Audit

Download a file using:

```http
GET /files/shared/{token}
```

No JWT is required.

After a successful download, query:

```bash
docker compose exec -T postgres psql \
  -U chatbot \
  -d chatbot \
  -c "SELECT id, file_id, user_id, share_link_id,
      access_method, action, ip_address, user_agent, access_time
      FROM file_access_logs
      WHERE share_link_id = <SHARE_LINK_ID>
      ORDER BY id DESC;"
```

**Expected Result:**

```text
user_id       = NULL
share_link_id = actual share-link ID
access_method = SHARE_LINK
action        = DOWNLOAD
```

For example:

| id | file_id | user_id | share_link_id | access_method | action     | ip_address   | access_time                       |
|----|---------|---------|---------------|---------------|------------|--------------|-----------------------------------|
| 63 | 25      | NULL    | 7             | SHARE_LINK    | `DOWNLOAD` | `172.20.0.1` | `2026-09-02 23:30:15.123456+00` |

This identifies the exact share link used without incorrectly assigning the
share-link creator as the downloader.

---

### 9.4 Verify Share Operation Audit

After sharing a file with another user, query:

```bash
docker compose exec -T postgres psql \
  -U chatbot \
  -d chatbot \
  -c "SELECT id, file_id, user_id, share_link_id,
      access_method, action, ip_address, access_time
      FROM file_access_logs
      WHERE file_id = <FILE_ID>
      AND action = 'SHARE'
      ORDER BY id DESC;"
```

**Expected Result:**

```text
action        = SHARE
file_id       = ID of the shared file
user_id       = ID of the user who performed the share
share_link_id = NULL
access_method = AUTHENTICATED
```

The SHARE operation is performed by an authenticated user, so it uses the
authenticated access context.

---

### 9.5 Successful Access Is Audited

The system audits successful file access rather than every attempted
request.

For example:

```text
Successful authenticated download
    → audit record created

Successful share-link download
    → audit record created

Missing storage file
    → no audit record

Expired share link
    → no audit record

Maximum downloads reached
    → no audit record

Invalid share-link token
    → no audit record
```

This ensures that the audit log represents actual successful access rather
than merely attempted requests.

---

### 9.6 Share-Link Download Count and Audit Record

A successful share-link download has two independent effects:

```text
shared_links.download_count
        +
file_access_logs audit record
```

For example, after the first successful download:

- shared_links.download_count = 1

and:

```text
file_access_logs:
    access_method = SHARE_LINK
    share_link_id = <ID>
    user_id       = NULL
    action        = DOWNLOAD
```

Both should be verified after a successful request.

A rejected request must not modify the download count or create a successful
access audit record.

---

### 9.7 Verify Audit Context Invariants

**Run:**

```bash
docker compose exec -T postgres psql \
  -U chatbot \
  -d chatbot \
  -c "SELECT access_method,
      COUNT(*) AS count,
      COUNT(*) FILTER (WHERE user_id IS NULL) AS user_id_null,
      COUNT(*) FILTER (WHERE share_link_id IS NULL) AS share_link_id_null
      FROM file_access_logs
      GROUP BY access_method
      ORDER BY access_method;"
```

**Expected structure:**

access_method | user_id_null | share_link_id_null
--------------:|-------------:|------------------
AUTHENTICATED |      0       |         all
SHARE_LINK    |     all      |          0

For the current data, for example:

access_method | count | user_id_null | share_link_id_null
--------------:|------:|-------------:|-------------------
AUTHENTICATED |   9   |      0       |         9
SHARE_LINK    |   5   |      5       |         0

The exact counts will vary depending on the tests performed.

---

### 9.8 Database-Level Audit Constraint

The database enforces the following access-context rules:

```text
AUTHENTICATED
    user_id IS NOT NULL
    share_link_id IS NULL

SHARE_LINK
    user_id IS NULL
    share_link_id IS NOT NULL
```

The constraint is:

- ck_file_access_logs_access_context

It protects the audit invariant even when records are inserted or modified
outside the application's **create_audit_log()** service.

The Phase 2 migration is therefore a required part of the audit schema.

---

### 9.9 Audit Log IP Address

The audit log records the IP address observed by the application.

The authenticated download endpoint receives the request information through
FastAPI's **Request** object.

The current Docker deployment may show the reverse-proxy/container address,
such as:

```text
172.20.0.1
```

rather than the original client address, depending on the proxy and
application configuration.

Verify:

```bash
docker compose exec -T postgres psql \
  -U chatbot \
  -d chatbot \
  -c "SELECT id, action, access_method, ip_address, access_time
      FROM file_access_logs
      ORDER BY id DESC
      LIMIT 20;"
```

---

### 9.10 Audit Log Timestamp

access_time is generated by PostgreSQL.

The current database uses **UTC**, so timestamps may appear with:

```text
+00
```

The value represents UTC.

For **IST**

```text
IST = UTC + 05:30
```

---

### 9.11 Audit Test Summary

The Phase 2 audit implementation has been verified for:

- Authenticated download audit → **PASS**
- Share-link download audit → **PASS**
- Authenticated download stores **user_id** → **PASS**
- Authenticated download stores **share_link_id** = NULL → **PASS**
- Share-link download stores **user_id = NULL** → **PASS**
- Share-link download stores actual **share_link_id** → **PASS**
- Share-link download stores **access_method = SHARE_LINK** → **PASS**
- Authenticated download stores **access_method = AUTHENTICATED** → **PASS**
- SHARE operation audit → **PASS**
- Failed storage access creates no audit record → **PASS**
- Expired link creates no audit record → **PASS**
- Maximum-download rejection creates no audit record → **PASS**
- Database access-context constraint → **PASS**
- Share-link download count increments only on successful access → **PASS**

---

## 16. Session-Aware Chat Testing

### 16.1 Verify New Session ID on Login

Login with valid credentials through `POST /login`.

Expected response:

```json
{
  "access_token": "<JWT>",
  "session_id": "<UUID>"
}
```

Verify that the returned `session_id` is non-empty and that the same session identifier is represented in the JWT `session_id` claim.

### 16.2 Verify Session ID Is Not Client-Supplied

Send `POST /chat/history` with only:

```json
{
  "message": "session test",
  "response": "ok"
}
```

The request should succeed with a valid JWT. The persisted `chat_history.session_id` must equal the session ID extracted from that JWT.

A client-provided `session_id` or `sender` is no longer part of the `ChatCreate` request contract.

### 16.3 Verify Conversation Reuse

Using one login/session, submit two or more chat turns. Query:

```bash
docker compose exec -T postgres psql \
  -U chatbot \
  -d chatbot \
  -c "SELECT id, session_id, user_id, timestamp
      FROM chat_history
      WHERE user_id = <USER_ID>
      ORDER BY id DESC;"
```

Expected: one `chat_history` row for that user/session, with multiple related `chat_messages` rows.

### 16.4 Verify New Login Creates a New Session

Log out and authenticate again. Confirm that the new login receives a different `session_id`. Messages saved after the new login should be associated with the new session rather than the previous conversation.

### 16.5 Verify Cross-User Isolation

Attempt to request another user's session history while authenticated as a different user.

Expected:

- no cross-user chat records are returned;
- the database query remains scoped by both session ID and authenticated user ID.

---

## 17. Administrative Chat History Testing

### 17.1 Admin Chat Summary

Authenticate as an administrator and request:

```http
GET /admin/chats
Authorization: Bearer <ADMIN_JWT>
```

Expected response items contain:

```text
id
user_id
user
date
session_id
messages
status
```

Verify that the list is ordered by conversation timestamp descending and that `messages` matches the number of `chat_messages` rows belonging to each chat.

### 17.2 Admin Chat Message Retrieval

Select a valid chat and request:

```http
GET /admin/users/<USER_ID>/chats/<CHAT_ID>/messages
Authorization: Bearer <ADMIN_JWT>
```

Expected:

- HTTP 200 OK;
- messages belong to the requested chat;
- messages are ordered by message ID ascending;
- each message exposes `id`, `chat_id`, `role`, `content`, and `created_at`.

### 17.3 Admin Chat Ownership Check

Use a valid `CHAT_ID` with a different `USER_ID`.

Expected:

```text
404 Not Found
Chat not found
```

This verifies that the message endpoint does not return a chat merely because the chat ID exists. The chat must also belong to the requested user.

### 17.4 Get User Chats

The get_user_chats() operation retrieves the chat-history records belonging to a specific user.

The API endpoint is:

```http
GET /admin/users/{user_id}/chats
Authorization: Bearer <ADMIN_JWT>
```

When accessed through the Nginx /auth/ prefix:

```http
GET /auth/admin/users/{user_id}/chats
Authorization: Bearer <ADMIN_JWT>
```

#### *Purpose*

This endpoint is different from:

```http
GET /admin/chats
```

`GET /admin/chats` retrieves the administrative chat-history summary/list, whereas:

```http
GET /admin/users/{user_id}/chats
```

specifically retrieves the chats associated with the supplied `user_id`.

#### *Administrator Test*

Authenticate as an administrator and identify an existing user:

```http
GET /admin/users
Authorization: Bearer <ADMIN_JWT>
```

Select a valid user ID, for example:

USER_ID = <USER_ID>

Then request:

```http
GET /admin/users/<USER_ID>/chats
Authorization: Bearer <ADMIN_JWT>
```

#### *Expected Result*

The request should return:

```text
200 OK
```

The returned chat-history records must belong to the requested user.

For each returned chat, verify that:

```text
chat_history.user_id == <USER_ID>
```

The response must not contain chat histories belonging to another user.

#### *User With No Chats*

Repeat the test using a valid user who has no chat-history records.

Expected behavior:

```text
200 OK
[]
```

or the application's documented empty collection representation.

The endpoint should not return another user's chat history simply because the requested user has no chats.

#### *User Isolation Verification*

Create or identify two users:

```text
User A
User B
```

Create chat history for both users.

Then call:

```http
GET /admin/users/<USER_A_ID>/chats
Authorization: Bearer <ADMIN_JWT>
```

Verify that only User A's chat histories are returned.

Repeat:

```http
GET /admin/users/<USER_B_ID>/chats
Authorization: Bearer <ADMIN_JWT>
```

Verify that only User B's chat histories are returned.

#### *Invalid User ID*

Call the endpoint with a user ID that does not exist:

```http
GET /admin/users/<NON_EXISTENT_USER_ID>/chats
Authorization: Bearer <ADMIN_JWT>
```

Verify that the API returns the application's documented not-found response, normally:

```text
404 Not Found
```

#### *Non-Admin Authorization*

Repeat the request using a valid ordinary-user JWT:

```http
GET /admin/users/<USER_ID>/chats
Authorization: Bearer <ORDINARY_USER_JWT>
```

Expected:

```text
403 Forbidden
```

This confirms that `get_user_chats()` is protected by the administrator authorization requirement and cannot be invoked by an ordinary authenticated user.

#### *Relationship Verification*

The endpoint should follow the database relationship:

```text
users.id
   │
   ▼
chat_history.user_id
   │
   ▼
chat_history
```

The test therefore verifies both:

The requested user_id is used to filter chat histories.
The endpoint does not accidentally return all chat histories.
This test should be kept separate from the `/admin/chats` test so that user-specific filtering is explicitly covered.

### 17.5 Non-Admin Access

Call `/admin/chats` and `/admin/users/{user_id}/chats/{chat_id}/messages` using a valid ordinary-user JWT.

For example:

```http
GET /admin/chats
Authorization: Bearer <ORDINARY_USER_JWT>
```

and:

```http
GET /admin/users/{user_id}/chats/{chat_id}/messages
Authorization: Bearer <ORDINARY_USER_JWT>
```

Both requests should be rejected with:

```text
403 Forbidden
```

This confirms that administrative chat-history endpoints cannot be accessed by ordinary authenticated users because the endpoints require `require_admin`.

### 17.6 Admin UI Chat View

In the Admin UI:

1. Navigate to **Chat History**.
2. Confirm the summary table loads.
3. Select **View** for a conversation.
4. Confirm the Chat Details modal opens.
5. Verify Chat ID, Session ID, and Date.
6. Verify user and chatbot messages are displayed in order.
7. Close the modal using the close control and by clicking the modal backdrop.

### 17.7 Chat History Cache and Refresh

Navigate to Chat History twice without forcing refresh. The second load should use the in-memory cache when available.

After creating or changing relevant data, trigger the Admin refresh flow and verify that a new request is made and the displayed list is updated.

---

## 18. Administrative Users UI Testing

### 18.1 User Sorting

Load the Users section and verify that users are displayed in ascending numeric ID order.

### 18.2 User Search

Search using values from the user ID, username, email, and role fields. Verify that matching users remain visible and that the page resets to page 1 after search changes.

### 18.3 User Pagination

With more than ten users, verify:

- ten users are displayed per page;
- previous/next controls are disabled at the corresponding boundaries;
- the active page is highlighted;
- the footer reports the displayed range and total count.

### 18.4 User Refresh

Use the Refresh button in the Users section. Verify that the cache is bypassed and fresh data is rendered.

### 18.5 Safe HTML Rendering

Use test values containing HTML metacharacters in user/chat/log fields and verify that they are rendered as text rather than interpreted as HTML. This validates the frontend `escapeHtml()` utility used by the updated renderers.

---

## 19. Admin Frontend Navigation and Session Cleanup Testing

### 19.1 Hash Navigation

Open an Admin URL containing a section hash such as `#users` or `#chat-history`. Verify that the corresponding panel is selected during initialization.

Change sections and verify that the URL hash, active navigation item, and visible content panel remain synchronized.

### 19.2 Logout Cleanup

Initiate logout and cancel the confirmation. Verify that the user remains in the Admin UI. Confirm logout and verify that:

- `authToken` is removed;
- `username` is removed;
- `role` is removed;
- the browser is redirected to `/login.html`.

---

## 20. Updated Verification Summary

The recent Git changes introduce the following verification targets in addition to the existing authentication, chat-isolation, file, sharing, audit, encryption, routing, database, and Docker tests:

| Area | Verification target |
|------|---------------------|
| Login | New UUID session returned and embedded in JWT |
| Chat persistence | Session derived from JWT |
| Chat persistence | Existing conversation reused for same user/session |
| Admin chat list | Conversation summaries and message counts |
| Admin chat view | User/chat ownership check and ordered messages |
| Admin authorization | Ordinary users rejected from admin chat APIs |
| Admin UI | Chat-history modal and message rendering |
| Admin UI | Chat-history caching and refresh |
| Users UI | Sorting, search, pagination, refresh |
| Frontend security | HTML escaping for rendered data |
| Navigation | Hash-based section restoration and navigation |
| Logout | Authentication/session-related localStorage cleanup |