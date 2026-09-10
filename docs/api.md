# SmartChat AI Platform — API Reference

This document reflects the current FastAPI Auth Service routes and the recent session-aware chat and administrative chat-history changes. The Auth Service is exposed through Nginx under `/auth`.

## Authentication

### POST /login

Authenticates a user and creates a new application session.

**Request**

```json
{
  "username": "<username>",
  "password": "<password>"
}
```

**Successful response**

```json
{
  "access_token": "<JWT>",
  "session_id": "<UUID>"
}
```

A new UUID session ID is generated for every successful login. The JWT contains the user ID, username (`sub`), role, session ID, and a 60-minute expiration.

**Failure:** `401 Unauthorized` with `Invalid credentials`.

### Authorization Header

Protected endpoints use:

```http
Authorization: Bearer <JWT>
```

The current-session dependency validates the JWT and requires the `session_id` claim.

---

## Chat API

### POST /chat/history

Stores a chat turn for the authenticated user and the session represented by the JWT.

**Request**

```json
{
  "message": "Hello",
  "response": "Hi!"
}
```

`response` is optional. The request schema no longer accepts client-supplied `session_id` or `sender` fields.

**Processing model**

1. Authenticate the user from the JWT.
2. Extract the session ID from the JWT.
3. Find an existing `chat_history` row matching the authenticated user and session.
4. Create the conversation only when it does not already exist.
5. Store the user message.
6. Store the chatbot response when `response` is present.

**Response model**

```json
{
  "id": 1,
  "session_id": "<UUID>",
  "user_id": 1,
  "timestamp": "<timestamp>",
  "messages": [
    {
      "id": 1,
      "chat_id": 1,
      "role": "user",
      "content": "Hello",
      "created_at": "<timestamp>"
    }
  ]
}
```

### GET /chat/history/{session_id}

Returns chat history for the authenticated user and the requested session ID. Results are ordered by conversation timestamp ascending.

The authenticated user ID is included in the database filter, so a session ID belonging to another user does not grant access to that user's history.

**Failure:** `404 Not Found` when no chat history exists for the authenticated user and requested session.

---

## Administrative API

All `/admin/*` endpoints require administrator authorization through `require_admin`.

### GET /admin/dashboard

Returns administrative dashboard statistics including users, chats, distinct active sessions, and chats created today.

### GET /admin/users

Returns the user list.

### POST /admin/users

Creates a user from an administrator request. The supplied password is hashed before storage.

### PUT /admin/users/{user_id}/role

Updates a user's role.

### DELETE /admin/users/{user_id}

Administrators can permanently delete a user account.

The operation prevents:

- an administrator from deleting their own account;
- deletion of the last administrator account.

The endpoint returns the deleted user ID and username on success. Database cascades remove associated database records where configured. Physical encrypted files are separate storage objects and are not removed merely by a database cascade.

### GET /admin/users/search?q={query}

Searches users by username using a case-insensitive partial match.

### GET /admin/chats

Returns administrative chat-history summaries ordered by newest conversation timestamp first. Each item contains:

```json
{
  "id": 1,
  "user_id": 1,
  "user": "username",
  "date": "<timestamp>",
  "session_id": "<UUID>",
  "messages": 2,
  "status": "Completed"
}
```

The message count is calculated from `chat_messages` for each conversation. The username is obtained through the `ChatHistory` → `User` join.

### GET /admin/users/{user_id}/chats/{chat_id}/messages

Returns all messages for one administrative chat view. The query first verifies that the supplied `chat_id` belongs to the supplied `user_id`. Messages are then returned in ascending `ChatMessage.id` order.

**Failure:** `404 Not Found` with `Chat not found` when the chat/user association does not exist.

The endpoint is used by the Admin Chat Details modal to display message role, content, and creation time.

### GET /admin/users/{user_id}/chats

Retrieves all chat conversations belonging to the specified user from an administrator context.

The endpoint uses the user_id path parameter to identify the user and returns the user's chat history/conversation records. It does not accept or create a session_id from the client.

This endpoint is intended for administrative retrieval and is distinct from the user chat persistence endpoint, POST /chat/history, which derives the authenticated user's session_id from the JWT.

### DELETE /admin/chat/history/{session_id}

Deletes chat-history records associated with the specified session. Associated messages are removed through the configured database relationship.

---

## Delete User

### DELETE /users/{user_id}

Administrators can permanently delete a user account.

User deletion is a hard delete. When a user is deleted, PostgreSQL
cascading foreign-key constraints automatically remove data owned by
or directly associated with that user.

The following data is deleted:

- User account
- Chat history
- Files owned by the user
- File access logs
- File permissions
- Shared links created by the user

The API prevents:

- An administrator from deleting their own account
- Deletion of the last administrator account

The operation is permanent and cannot be undone through the application.

---

## Frontend API Client

The Admin frontend uses `frontend/js/admin_api.js` with:

- base URL `/auth`;
- JSON request bodies;
- bearer-token injection from `localStorage.authToken`;
- a 10-second request timeout;
- one retry for retryable GET failures such as timeout/network errors;
- automatic token removal and redirect to `/login.html` on HTTP 401.

The client exposes `get`, `post`, `put`, `patch`, and `delete` helpers.

---

## Current API Design Notes

- Session identity for normal chat persistence is server-derived from the JWT.
- Chat messages are stored in `chat_messages`; conversation metadata is stored in `chat_history`.
- A conversation is reused for repeated messages within the same authenticated user/session.
- Administrative chat discovery and message retrieval are separate endpoints.
- Administrative endpoints require an administrator role.
- Share-link file access remains intentionally unauthenticated and is outside the Auth Service chat API changes documented here.