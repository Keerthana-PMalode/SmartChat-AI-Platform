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

# 4. Chat History Isolation Testing

Chat history is restricted to authenticated users and is isolated by
user_id.

## 4.1 Authenticated Chat History Request

An authenticated user requests their registered chat session using a valid JWT.

**Request**

```http
GET /chat/history/registered-test-session-20260830-001
Authorization: Bearer <JWT>
```

**Result**

```http
HTTP 200 OK
user_id: 25
chat history returned
```

**Verification**

The request was successfully authenticated using the JWT, and the chat
history associated with the authenticated user was returned.

This confirms that authenticated users can retrieve their own chat history.

---

## 4.2 Unauthenticated Chat History Request

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

## 4.3 Cross-User Chat History Isolation

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

# 7. File Sharing Testing

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

# 9. Audit Log Testing

The File Service records file-related operations in the
file_access_logs table.

Audit logging should record the user, file, action, IP address, and time of
the operation.

## 9.1 Verify Download Log

Download file ID 25 as an authenticated user.

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

**Expected Result**

A corresponding audit record should be present with:

```text
action      = DOWNLOAD
file_id     = 25
user_id     = ID of the authenticated user who downloaded the file
ip_address  = IP address observed by the application
access_time = time at which the download was recorded
```

For example:

```text

 id | file_id | user_id |  action  | ip_address |          access_time
----+---------+---------+----------+------------+-------------------------------
 59 |      25 |      23 | DOWNLOAD | 172.20.0.1 | 2026-08-29 21:56:59.445285+00
```

The recorded ip_address represents the address observed by the application.
When the application is running behind Docker/Nginx, this may be a Docker
gateway or proxy address rather than the original client IP.

## 9.2 Verify Share Log

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

**Expected Result**

A corresponding record should contain:

```text
action      = SHARE
file_id     = 25
user_id     = ID of the user who performed the share
access_time = time at which the share was recorded
```

The SHARE operation does not necessarily contain an IP address if the
current implementation does not record one for that operation.

---

## 9.3 Verify Multiple File Operations

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
