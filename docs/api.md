# SmartChat AI Platform — API Reference

This reference documents routes verified in the supplied Auth Service and File Service source. Browser-facing URLs include the Nginx prefixes. The Auth Service internally defines routes without `/auth`; Nginx maps `/auth/...` to the Auth Service. File Service routes are under `/files`. Rasa is exposed through `/rasa/`.

> **Source scope:** The supplied ZIP contains the application source and existing `docs/api.md`, but does not contain `docker-compose.yml`, `.env.example`, or a root `README.md`. The external service ports and proxy paths below also use project context supplied earlier. Treat any deployment-specific URL/port as configurable if your local Compose file differs.

## Conventions

- Send `Authorization: Bearer <JWT>` to protected Auth Service and File Service endpoints.
- Login creates a new UUID `session_id` for each successful login. The JWT contains `user_id`, `sub` (username), `role`, `session_id`, and an expiration approximately 60 minutes after issue.
- Admin endpoints use `require_admin`; non-admin authenticated users receive `403`.
- FastAPI validation errors generally return `422` for malformed/missing request fields. Exact error response bodies may vary by endpoint.
- Public settings are intentionally unauthenticated but are restricted to an allowlist.

## Authentication and registration

### `POST /auth/login`

Authenticates a user and creates an application session.

**Authentication/role:** Public.

**Request JSON**

```json
{"username":"<username>","password":"<password>"}
```

**Success `200 OK`**

```json
{"access_token":"<JWT>","session_id":"<UUID>"}
```

**Errors:** `401` for an unknown username or incorrect password (`Invalid credentials`); `422` for request validation errors.

**Behavior:** Passwords are checked against the stored password hash. Each successful login receives a fresh session ID; chat-history endpoints derive the session from the JWT rather than trusting a client-supplied session ID.

### `POST /auth/register`

Creates a normal user account.

**Authentication/role:** Public, subject to the `allow_user_registration` setting.

**Request JSON**

```json
{"username":"new_user","password":"<password>"}
```

**Success `200 OK`**

```json
{"status":"success","message":"Registration successful."}
```

**Errors:** `403` if registration is disabled; `409` if the username already exists; `422` for invalid input.

**Behavior:** The password is hashed before persistence and the role is set to `user`. The setting defaults to enabled when no persisted value exists.

### `POST /auth/validate-token`

Checks a token supplied in the request body. This endpoint is distinct from the Bearer-token dependencies used by protected routes.

**Authentication/role:** Public; token is supplied in JSON.

**Request JSON**

```json
{"token":"<JWT>"}
```

**Response `200 OK`**

Valid token:

```json
{"valid":true,"user_id":1,"username":"example","role":"user"}
```

Invalid/expired token:

```json
{"valid":false}
```

**Important:** This endpoint reports token claims; protected endpoints additionally load the user from the database and enforce role checks where applicable.

## Chat history and message persistence

The Auth Service persists conversations in `chat_history` and individual messages in `chat_messages`. A conversation is associated with a user and the session ID in the JWT. Message roles used by the current persistence path are `user` and `chatbot`.

### `POST /auth/chat/history`

Stores a user message and, when supplied, its chatbot response.

**Authentication/role:** Authenticated user; any role. Non-admin users are blocked during maintenance mode.

**Request JSON**

```json
{"message":"Hello","response":"Hi!"}
```

`response` is optional. Do not send `session_id` or `sender`; these are not accepted as the source of identity/session for this route.

**Success `200 OK`:** A `ChatResponse` object representing the conversation, with fields such as `id`, `session_id`, `user_id`, `timestamp`, and `messages`. Each message includes `id`, `chat_id`, `role`, `content`, and `created_at`.

**Errors:** `401` for invalid/expired JWT or missing required token claims; `400` if `message` exceeds configured `max_message_length`; `503` for non-admin users when `maintenance_mode` is enabled; `422` for invalid request shape.

**Behavior:** Defaults maximum message length to 5000 characters if the setting is missing or invalid. Reuses the conversation matching both authenticated user ID and JWT session ID; creates a conversation on the first turn. Persists the user message and persists `response` only when it is truthy/present.

### `GET /auth/chat/history`

Returns the authenticated user's conversations for the session represented by the JWT.

**Authentication/role:** Authenticated user; any role.

**Parameters:** None. Session and user identity come from the JWT.

**Success `200 OK`:** JSON array of `ChatResponse` conversation objects, ordered by conversation timestamp ascending. Each conversation includes associated messages.

**Errors:** `401` for invalid/expired JWT or missing user/session claims; `404` when no history exists for the authenticated user and session (`No chat history found for this session`).

**Isolation:** Query filters on both `user_id` and `session_id`. Supplying another user's session ID in a URL is not part of this route and cannot override JWT-derived scope.

## Administrative API

All routes in this section require a valid JWT and the `admin` role via `require_admin`, unless explicitly marked public. A non-admin receives `403` (`Admin access required`).

### Dashboard

#### `GET /auth/admin/dashboard`

Returns dashboard summary data.

**Parameters/body:** None.

**Success `200 OK`**

```json
{
  "status":"success",
  "admin":"admin_username",
  "role":"admin",
  "stats":{"users":0,"conversations":0,"messages":0,"active_users":0},
  "recent_users":[{"id":1,"username":"username","role":"user"}],
  "recent_conversations":[{"id":1,"user_id":1,"user":"username","date":"<timestamp>","session_id":"<UUID>"}],
  "activity":{"labels":["Sep 17"],"conversations":[0],"messages":[0]}
}
```

**Semantics:** `active_users` means distinct users with at least one conversation, not activity in the last 24 hours. `recent_users` contains up to five users ordered by descending user ID; `recent_conversations` contains up to five conversations ordered newest first. `activity` covers seven calendar days in `Asia/Kolkata`, with conversation counts based on `chat_history.timestamp` and message counts based on messages joined to those conversations.

### User administration

#### `GET /auth/admin/users`

Lists user records. Admin only. No query parameters. Returns a JSON array of user objects. `401` for invalid authentication; `403` for non-admin.

#### `POST /auth/admin/users`

Creates a user from an admin request. Admin only.

**Request:** `CreateUserRequest` with `username`, `password`, and `role` (see `auth_service/app/schemas/admin.py` for the exact schema constraints).

**Success:** JSON representation of the created user. Password is hashed; the operation records an audit event.

**Errors:** `400` when username already exists; `422` for schema validation; `403` for non-admin.

#### `PUT /auth/admin/users/{user_id}/role`

Changes a user's role. Admin only.

**Path:** `user_id` integer.

**Request:** `UpdateRoleRequest` containing the new `role`; consult `auth_service/app/schemas/admin.py` for allowed values.

**Success:** The current handler commits the change and refreshes the user; the response body is not explicitly returned by the route.

**Errors:** `404` if the user does not exist; `422` for invalid input. The change is audit-logged.

#### `DELETE /auth/admin/users/{user_id}`

Permanently deletes a user account. Admin only.

**Success `200 OK`**

```json
{"status":"deleted","user_id":1,"username":"deleted_user"}
```

**Errors:** `404` if missing; `400` if attempting to delete the current admin, the last administrator, or a user still referenced by records; `403` for non-admin. Database cascades apply only where configured. This does not itself guarantee removal of separate physical files from file storage.

#### `GET /auth/admin/users/search?q={query}`

Case-insensitive partial username search. Admin only. Required query parameter `q`. Returns a JSON array of matching user records.

### Administrative chat history

#### `GET /auth/admin/chats`

Lists conversation summaries with pagination and optional search.

**Query parameters:** `page` (integer, default `1`, minimum `1`), `page_size` (integer, default `20`, range `1–100`), `search` (optional string matching chat ID, user ID, username, or session ID).

**Success `200 OK`**

```json
{"items":[{"id":1,"user_id":1,"user":"username","date":"<timestamp>","session_id":"<UUID>","messages":2,"status":"Completed"}],"page":1,"page_size":20,"total":1,"total_pages":1}
```

#### `GET /auth/admin/users/{user_id}/chats`

Lists conversations for the specified user, newest first. Admin only. `user_id` is an integer path parameter. Returns a JSON array of chat response objects. `404` if the user does not exist.

#### `GET /auth/admin/users/{user_id}/chats/{chat_id}/messages`

Returns messages for a specific conversation in ascending message ID order. Admin only. The handler first checks that the `chat_id` belongs to the supplied `user_id`.

**Success:** JSON array of message objects (`id`, `chat_id`, `role`, `content`, `created_at`). **Error:** `404` with `Chat not found` if the association does not exist.

#### `DELETE /auth/admin/chat/history/{session_id}`

Deletes conversation records for the specified session. Admin only.

**Success:** `{"detail":"Chat history for session '<session_id>' has been deleted"}`.

**Errors:** `404` if no history exists for the session; `403` for non-admin. Associated message deletion depends on configured database relationships/cascades.

## Analytics API

All analytics routes require admin authorization and accept optional ISO date query parameters `start_date=YYYY-MM-DD` and `end_date=YYYY-MM-DD`. Analytics use `Asia/Kolkata`. If `end_date` is omitted, it defaults to today; if `start_date` is omitted, it defaults to 29 days before the selected end date (a 30-day inclusive range). Invalid dates are rejected by FastAPI validation.

### `GET /auth/admin/analytics/overview`

Returns an object containing `start_date`, `end_date`, `total_users`, `active_users`, `total_chats`, `total_sessions`, `total_messages`, `average_messages_per_chat`, and `today_chats`. `total_users` is the overall user count; period-sensitive counts are calculated from conversations/messages in the selected range. `today_chats` uses the current analytics timezone.

### `GET /auth/admin/analytics/chat-activity`

Returns a JSON array with one item per day in the inclusive selected range: `date`, `chats`, `users`, and `messages`. Days without data are included with zero counts.

### `GET /auth/admin/analytics/message-activity`

Returns a JSON array with one item per day: `date` and `messages`, including zero-count days.

### `GET /auth/admin/analytics/top-users`

Returns users ranked by activity within the selected date range. Optional `limit` defaults to `10` and must be `1–100`. Each item includes user identity and chat/message counts as implemented by the query.

### `GET /auth/admin/analytics/chat-statistics`

Returns aggregate chat statistics for the selected date range. See `auth_service/app/routes/admin_analytics.py` for the exact response fields because this endpoint's response is defined directly by the route rather than a shared response schema.

### `GET /auth/admin/analytics/hourly-activity`

Returns chat activity grouped by hour for the selected date range. Exact field names are defined in `auth_service/app/routes/admin_analytics.py`.

**Errors for analytics:** `401` invalid/expired JWT; `403` non-admin; `422` invalid query values.

## System settings

### `GET /auth/admin/settings/public`

Public, unauthenticated endpoint for settings needed by login, registration, and chatbot pages. Only the allowlisted keys are returned; internal/unrecognized settings are not exposed.

**Success `200 OK`**

```json
{"application_name":"ChatBot","max_message_length":5000,"maintenance_mode":false,"allow_user_registration":true}
```

Missing values use defaults. Types: `application_name` string, `max_message_length` integer, the two flags boolean.

### `GET /auth/admin/settings`

Admin only. Returns all persisted settings plus defaults for known settings:

```json
{"status":"success","settings":{"application_name":"ChatBot","max_message_length":5000,"maintenance_mode":false,"allow_user_registration":true}}
```

### `PUT /auth/admin/settings`

Admin only. Updates one or more known settings.

**Supported request fields:**

- `application_name`: string, 1–100 characters
- `max_message_length`: integer, 1–100000
- `maintenance_mode`: boolean
- `allow_user_registration`: boolean

Unknown fields are rejected by the request schema. Send only fields to change.

**Success `200 OK`**

```json
{"status":"success","updated":["maintenance_mode"]}
```

The handler records an administrative audit event. When maintenance mode is enabled, non-admin chat-history writes return `503`; admin users are not blocked by this check. Registration returns `403` when registration is disabled. The public settings endpoint continues to expose only the four allowlisted settings.

## Administrative audit logs

### `GET /auth/admin/logs`

Admin only. Lists audit records newest first.

**Query parameters:** `page` default `1` (minimum `1`); `page_size` default `50` (range `1–200`); `level` default `all`; `search` optional case-insensitive search across action, details, and username.

**Response:**

```json
{"items":[{"id":1,"timestamp":"<timestamp>","user_id":1,"user":"admin","level":"info","action":"Updated system settings","details":"maintenance_mode"}],"page":1,"page_size":50,"total":1,"total_pages":1}
```

The accepted level filtering is based on stored values; `all` disables the level filter.

### `GET /auth/admin/logs/export`

Admin only. Accepts the same `level` and `search` filters as the log list and streams a CSV download named `system_logs.csv`. Columns: `Timestamp`, `User`, `Level`, `Action`, `Details`.

### `POST /auth/admin/logs`

Creates a manual audit log entry. Admin only.

**Request JSON**

```json
{"level":"info","action":"Operational note","details":"Optional detail"}
```

Allowed levels are `info`, `warning`, and `error`; `action` is required and `details` is optional. Invalid levels or missing action return `400`. The exact schema is in `auth_service/app/schemas/admin.py`.

## File management API

The File Service authenticates JWTs independently using the configured `SECRET_KEY`. File ownership and permissions are enforced in the service. Files are encrypted before storage; download endpoints decrypt only after authorization.

### `GET /files` and `GET /files/`

Lists files visible to the authenticated user. The root and slash forms are implemented; the empty path variant is excluded from the OpenAPI schema. Requires Bearer JWT. Returns a JSON array of `FileResponse` objects. Invalid/expired JWT returns `401`.

### `POST /files/upload`

Uploads and encrypts a file.

**Authentication:** Bearer JWT required.

**Request:** `multipart/form-data` with required field `file`.

**Success `200 OK`**

```json
{"id":41,"filename":"report.pdf","status":"<stored status>"}
```

**Errors:** `413` when file content exceeds 100 MiB; `401` for invalid/expired JWT; `422` if the file field is missing/invalid. Nginx is configured with a 100 MiB client body limit; proxy and application limits should remain aligned.

### `GET /files/{file_id}/download`

Downloads and decrypts a file.

**Authentication:** Bearer JWT required. Owner access is allowed; a non-owner requires a matching `file_permissions` record with `READ` permission.

**Success `200 OK`:** Raw file bytes with the stored MIME type (or `application/octet-stream`) and `Content-Disposition: attachment` using the original filename.

**Errors:** `401` invalid/expired JWT; `403` if neither owner nor an authorized `READ` recipient; `404` missing file, missing stored file; `500` missing encryption key or decryption failure.

### `DELETE /files/{file_id}`

Deletes a file through the file service. Requires Bearer JWT. The service's `delete_file` operation enforces user scope; a missing/inaccessible record returns `404`. Success:

```json
{"message":"File deleted successfully","id":41}
```

Review `file_service/app/services/file_service.py` for storage cleanup behavior before relying on deletion as a secure physical erasure guarantee.

### `POST /files/{file_id}/share`

Shares a file directly with another registered user. Requires Bearer JWT and ownership of the file.

**Request JSON**

```json
{"user_id":35,"permission":"READ"}
```

**Success `200 OK`**

```json
{"message":"File shared","file_id":41,"shared_with":35,"permission":"READ"}
```

**Errors:** `404` file not found; `403` if the caller is not the owner; `422` invalid request. Supported permission values should be taken from `file_service/app/schemas/file.py`; the current download authorization specifically checks `READ`.

### `POST /files/{file_id}/share-link`

Creates a token-based share link. Requires Bearer JWT and file ownership.

**Request JSON**

```json
{"expires_at":null,"max_downloads":1}
```

Both fields are governed by `ShareLinkCreate`; `expires_at` may be null, and `max_downloads` may be null for no configured count limit.

**Success `200 OK`**

```json
{"id":26,"file_id":41,"url":"/files/shared/<secure-token>","expires_at":null,"max_downloads":1,"download_count":0}
```

The token is generated using `secrets.token_urlsafe(32)`. A supplied expiration must be in the future; otherwise `400`. Missing file returns `404`; non-owner returns `403`.

### `GET /files/shared/{token}`

Downloads a file using the share-link token. No JWT is required; possession of the token is the access credential.

**Success `200 OK`:** Decrypted file bytes as an attachment. A successful download increments `download_count` and records a `SHARE_LINK` download audit event.

**Errors:** `404` unknown token or missing file; `410` expired link or exhausted download limit; `500` missing encryption key or decryption failure. **Implementation note:** The current route's expiration check should be exercised in tests when `expires_at` is null; inspect/fix that branch before treating unlimited/no-expiry links as production-ready.

## File service utility routes

These are direct File Service routes and may not be proxied through Nginx unless separately configured.

| Method | Route | Authentication | Purpose / response |
|---|---|---|---|
| `GET` | `/` | Public | `{"service":"File Encryption Service","status":"running"}` |
| `GET` | `/health` | Public | `{"status":"healthy"}` |
| `GET` | `/health/db` | Database connectivity check | Executes `SELECT 1`; returns `{"database":"connected","result":1}` on success or a failure object. Do not expose this diagnostic publicly in production. |

## Error and security notes

- `401 Unauthorized`: missing/invalid/expired JWT or missing identity/session claims.
- `403 Forbidden`: authenticated but lacks required role, ownership, or file permission.
- `404 Not Found`: requested record is missing or intentionally not visible in the caller's scope.
- `409 Conflict`: registration username already exists.
- `410 Gone`: share link expired or download limit reached.
- `413 Payload Too Large`: upload exceeds 100 MiB.
- `422 Unprocessable Entity`: FastAPI request validation failure.
- `503 Service Unavailable`: non-admin attempts to persist a chat turn during maintenance mode.

For exact Pydantic field constraints and complete response schemas, consult the route and schema modules cited above. Do not infer additional routes from frontend labels or architecture diagrams alone.
