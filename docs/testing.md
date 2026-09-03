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

## 4. Chat History Isolation Testing

Chat history is restricted to authenticated users and is isolated by
user_id.

### 4.1 Authenticated Chat History Request

An authenticated user requests their registered chat session using a valid JWT.

**Request**

```http
GET /chat/history/registered-test-session-20260830-001
Authorization: Bearer <JWT>
```

**Result**

- Status: 200 OK
- User_id: 25
- Chat history returned

**Verification**

The request was successfully authenticated using the JWT, and the chat
history associated with the authenticated user was returned.

This confirms that authenticated users can retrieve their own chat history.

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
```

**Expected Behavior**

The file should be successfully shared with the selected user.

A corresponding file_permissions record should be created.

**Expected Permission Record**

```text
file_id              = ID of the shared file
shared_with_user_id  = ID of the recipient
permission           = READ
```

The sharing operation should also create an audit record when audit logging
is enabled for the operation.

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

- Status: 200 OK
- Content-Type: application/json
- Body: JSON object containing the created share-link details

```json
{
  "id": 4,
  "file_id": 39,
  "url": "/files/shared/whzMMBelaOF-QzTc_wizUF4hwzgndVaXvSIlcs_sNVk",
  "expires_at": null,
  "max_downloads": 1,
  "download_count": 0
}
```

The generated share-link token must be a long, cryptographically secure, randomly generated value.

Once created, the share link can be accessed through the share-link endpoint without requiring a JWT. The token itself is used to authorize access to the shared file.

---

### 7.3 Share-Link Database Verification

After creating the share link, verify that the corresponding record has been persisted correctly in the database.

**Verification Command:**

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

The newly created share link should be stored with the expected file ID, token, expiration settings, download limit, download count, and creator ID.

| id | file_id | token | expires_at | max_downloads | download_count | created_by | created_at |
|----|---------|-------|------------|---------------|----------------|------------|------------|
| 4 | 39 | `<random-secure-token>` | `NULL` | 1 | 0 | 34 | `2026-09-02 05:15:42+00` |

The following values should be verified:

```text
file_id         = ID of the file
token           = securely generated random token
expires_at      = requested expiration or NULL
max_downloads   = requested limit or NULL
download_count  = 0 immediately after creation
created_by      = authenticated user's ID
created_at      = timestamp  
```

> Note: The token and created_at values are generated at runtime, so the exact  values will differ. 
> The token stored in the database should correspond to the token returned in the API response.

---

### 7.4 Valid Share-Link Download

A valid share link should allow the file to be downloaded without an
Authorization header.

**Expected Request:**

```http
GET /files/shared/{token}
```

No JWT should be supplied.

**Expected Result:**

- Status: 200 OK

The file should be successfully decrypted and returned.

This confirms that share-link authentication is independent of normal JWT
file-download authorization.

---

### 7.5 Share-Link Download Count

Before downloading the file:

```bash
docker compose exec -T postgres psql \
  -U chatbot \
  -d chatbot \
  -c "SELECT id, download_count
      FROM shared_links
      WHERE id = 4;"
```

**Expected Result:**

 - download_count = 0

After one successful share-link download:

- download_count = 1

The download count should increase only after the file has been successfully
retrieved and decrypted.

---

### 7.6 Maximum Download Limit

Create a share link with:

```json
{
  "expires_at": null,
  "max_downloads": 1
}
```

Perform the following requests:

Download #1 → HTTP 200 OK
Download #2 → HTTP 410 Gone

**Expected response** for the second request:

```json
{
  "detail": "Share link download limit reached"
}
```

**Verify the database:**

docker compose exec -T postgres psql \
  -U chatbot \
  -d chatbot \
  -c "SELECT id, download_count, max_downloads
      FROM shared_links
      WHERE id = 4;"

**Expected:**

| download_count | max_downloads |
|----------------|---------------|
| 1              | 1             |

---

### 7.7 Share-Link Expiration

Create a share link with an expiration time in the past.

Example:

```json
{
  "expires_at": "2026-09-01T10:00:00",
  "max_downloads": null
}
```

Attempt to access the link:

```http
GET /files/shared/{token}
```

**Expected Result:**

- Status: HTTP 410 Gone

**Response:**

```json
{
  "detail": "Share link has expired"
}
```

The download count must remain unchanged.

**Verify:**

```bash
docker compose exec -T postgres psql \
  -U chatbot \
  -d chatbot \
  -c "SELECT download_count
      FROM shared_links
      WHERE id = 6;"
```

**Expected:**

download_count - 0

This confirms that an expired link is rejected before a download is counted.

The count must not increase after the limit has been reached.

---

### 7.8 Invalid Share-Link Token

Request a token that does not exist:

```http
GET /files/shared/does-not-exist
```

**Expected Result:**

- Status: HTTP 404 Not Found

**Expected Response:**

```json
{
  "detail": "Share link not found"
}
```

---

### 7.9 Unauthorized Share-Link Creation

A non-owner must not be able to create a share link for another user's file.

**Example:**

Authenticated user = 35
File owner         = 1
File ID            = 35

The non-owner attempts:

```http
POST /files/35/share-link
Authorization: Bearer <USER_35_JWT>
```

**Actual Result:**

- Status: HTTP 403 Forbidden

The File Service log confirms:

```text
Share-link authorization: user=35, file_owner=1, file_id=35
INFO: ... "POST /files/35/share-link HTTP/1.1" 403 Forbidden
```

**Expected Response:**

```json
{
  "detail": "Only owner can create share links"
}
```

**Verification:**

The authorization check compares:

file.owner_id

against:

current_user_id

Only the file owner is currently permitted to create a share link.

This confirms that possession of a valid JWT alone does not grant permission
to create a share link for another user's file.

---

### 7.10 Share-Link Access Does Not Require JWT

A share link should be usable without:

```http
Authorization: Bearer <JWT>
```

The following should succeed when the link is valid:

```http
GET /files/shared/{token}
```

This is intentionally different from:

```http
GET /files/{file_id}/download
```

The normal download endpoint requires authenticated authorization, while the
share-link endpoint uses the secure share token as the access credential.

---

### 7.11 File Deletion and Share-Link Cascade

**Create:**

```text
File
  |
  +-- Shared Link
```

Delete the file through the File Service.

**Verify:**

```bash
docker compose exec -T postgres psql \
  -U chatbot \
  -d chatbot \
  -c "SELECT *
      FROM shared_links
      WHERE file_id = <FILE_ID>;"
```

**Expected Result:**

0 rows

This verifies:

```text
files.id
   |
   +---- shared_links.file_id
          ON DELETE CASCADE
```

---

### 7.12 Share-Link Test Summary

The current share-link implementation has been verified for:


- Create valid share link          → **PASS**
- Valid anonymous link download    → **PASS**
- Download count increment         → **PASS**
- Maximum download enforcement     → **PASS**
- Expired link rejection           → **PASS**
- Invalid token rejection          → **PASS**
- Unauthorized link creation      → **PASS** (`403 Forbidden`)
- File deletion cascade            → **PASS**

File sharing should allow an authorized user to share a file with another
registered user.

**Share a File**

Share a file with another user through the File Service.

**Expected Behavior**

The file should be successfully shared with the selected user.

An audit log entry should be created for the sharing operation.

**Expected Audit Record**

```text
action   = SHARE
user_id  = ID of the user who performed the share
file_id  = ID of the shared file
```

The user_id identifies the user who performed the sharing operation, while
file_id identifies the file that was shared.

---

## 9. Audit Log Testing

The File Service records file-related operations in the
`file_access_logs` table.

Audit logging currently records the user, file, action, IP address, and time
for operations performed by authenticated users.

## 9.1 Verify Download Log

Download file ID `25` as an authenticated user.

After the download, query the audit log:

```bash
docker compose exec -T postgres psql \
  -U chatbot \
  -d chatbot \
  -c "SELECT id, file_id, user_id, action, ip_address, access_time
      FROM file_access_logs
      WHERE file_id = 25
      ORDER BY id DESC;"
```

**Expected Result:**

A corresponding audit record should be present with:

```text
action      = DOWNLOAD
file_id     = 25
user_id     = ID of the authenticated user who downloaded the file
ip_address  = IP address observed by the application
access_time = Timestamp when the download was recorded
```

For example:

### Access Log Record

| id | file_id | user_id | action | ip_address | access_time |
|----|---------|---------|--------|------------|-------------|
| 59 | 25 | 23 | `DOWNLOAD` | `172.20.0.1` | `2026-08-29 21:56:59.445285+00` |

> **IP Address:** Nginx is configured to forward the client IP using the
> `X-Real-IP` and `X-Forwarded-For` headers. The recorded `ip_address` reflects
> the address observed by the application. In the current Docker deployment,
> `172.20.0.1` is the Nginx container address. If the application uses the
> direct connection address rather than the forwarded headers, it will record
> the Nginx container IP instead of the original client IP.

> **Timestamp:** PostgreSQL is configured with the `Etc/UTC` timezone.
> Therefore, `access_time` is displayed in UTC. The `+00` suffix indicates
> UTC (`UTC+00:00`). To convert the timestamp to IST, add 5 hours and 30
> minutes.

---

### 9.2 Verify Share Log

After sharing a file with another user, query the audit logs for the file.

```bash
docker compose exec -T postgres psql \
  -U chatbot \
  -d chatbot \
  -c "SELECT id, file_id, user_id, action, ip_address, access_time
      FROM file_access_logs
      WHERE file_id = 25
      ORDER BY id DESC;"
```

**Expected Result:**

A corresponding record should contain:

```text
action      = SHARE
file_id     = 25
user_id     = ID of the user who performed the share
access_time = Timestamp when the share was recorded
```

---

### 9.3 Share-Link Download Audit Status

Share-link downloads are different from authenticated downloads.

**share-link request:**

```http
GET /files/shared/{token}
```

does not contain an authenticated user identity.

The current file_access_logs schema contains:

```text
user_id INTEGER NOT NULL
```

Therefore, the current audit implementation cannot safely record an
anonymous share-link download with:

```text
user_id = NULL
```

and should not insert a fabricated user ID.

The current share-link implementation therefore tracks download usage through:

```text
shared_links.download_count
```

but does not yet provide a complete anonymous audit record in
file_access_logs.

This is a known limitation of the current audit schema.

**Future Share-Link Audit Design**

A future implementation should distinguish between authenticated downloads
and share-link downloads.

Possible approaches include adding an access method:

```text
access_method = AUTHENTICATED
access_method = SHARE_LINK
```

and allowing:

```text
user_id = NULL
```

for anonymous **share-link access**.

For example:

```text
file_id       = 39
user_id       = NULL
action        = DOWNLOAD
access_method = SHARE_LINK
ip_address    = <observed IP>
access_time   = <timestamp>
```

Another option is to record the **share-link ID**.

```text
file_id       = 39
user_id       = NULL
share_link_id = 4
action        = DOWNLOAD
ip_address    = <observed IP>
access_time   = <timestamp>
```

The second approach provides stronger traceability because it identifies
which specific share link was used.

This should be implemented as a separate schema/design change rather than
forcing the current user_id column to contain an incorrect identity.

---

### 9.4 Verify Multiple File Operations

Perform multiple operations on the same file, such as:

```text
UPLOAD
SHARE
DOWNLOAD
```

Then query:

```bash
docker compose exec -T postgres psql \
  -U chatbot \
  -d chatbot \
  -c "SELECT id, file_id, user_id, action, ip_address, access_time
      FROM file_access_logs
      WHERE file_id = 25
      ORDER BY id DESC;"
```

The audit log should contain separate records for the operations that are
currently implemented by the File Service.

---

### 9.5 Current Audit Limitations

The current file_access_logs.user_id column is:

```text
NOT NULL
```

This is appropriate for authenticated file operations but prevents the
current audit table from representing an anonymous share-link recipient.

Do not use the share-link creator's created_by value as the user_id of a
share-link downloader. The creator and downloader may be completely
different people.

The share-link creator is stored separately in:

```text
shared_links.created_by
```

while actual anonymous link usage is currently represented only by:

```text
shared_links.download_count
```

A future audit enhancement can add explicit share-link access tracking.