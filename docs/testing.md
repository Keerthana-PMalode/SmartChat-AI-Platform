# SmartChat AI Platform — Testing Guide

## 1. Purpose and testing strategy

Test SmartChat across service boundaries: frontend → Nginx → Auth Service/File Service/Rasa → PostgreSQL and file storage. Prioritize authentication, authorization, user isolation, encrypted file handling, share-link behavior, settings enforcement, and persisted chat/message correctness.

The supplied project files include `rasa/tests/test_stories.yml`. No complete repository-wide automated test configuration or frontend test runner was identifiable from the supplied archive, so this guide distinguishes executable project-provided test assets from recommended manual/API scenarios. Do not assume a particular `pytest`, npm, or CI command exists unless it is present in the checked-out project.

## 2. Test environment setup

1. Use a disposable development database and development-only secrets.
2. Confirm `docker compose config` succeeds, then start the stack with the repository's documented Compose workflow.
3. Confirm containers with `docker compose ps` and inspect service logs.
4. Use `http://localhost:8081/` for browser-facing checks in the previously documented local setup. Direct API docs may be available at `http://localhost:8000/docs` and `http://localhost:8001/docs` if those ports are published in the current Compose file.
5. Prepare at least two normal users (A and B) and one administrator. Use synthetic chat messages and disposable test files.
6. Verify database initialization and File Service Alembic state before testing persistence-sensitive features.

Do not test deletion, encryption-key migration, or schema changes against production data. Back up data before testing migration procedures.

## 3. Test levels

- **Unit/component:** focused functions such as token verification, encryption/decryption, validation, date-range helpers, and file-service operations. Use a test framework only if installed/configured; otherwise run through a small isolated harness rather than inventing a repository command.
- **API/integration:** call FastAPI endpoints through OpenAPI docs or an HTTP client against the running development services.
- **Frontend:** exercise pages in a browser and inspect Network/Console panels.
- **Service integration:** verify Nginx routing, database connectivity, Rasa-to-SDK communication, and storage persistence.
- **Regression:** repeat the security and core-flow scenarios after changing related code.

## 4. Authentication and registration

| Scenario | Steps | Expected result |
|---|---|---|
| Valid login | `POST /auth/login` with a valid username/password | `200`; response contains `access_token` and `session_id`. |
| Wrong password | Login with a known username and wrong password | `401 Invalid credentials`; no token issued. |
| Unknown username | Login with an unknown username | `401 Invalid credentials`. |
| New session per login | Log in twice as the same user | Each successful response has a newly generated session UUID; each JWT includes the corresponding session. |
| Invalid JWT | Send malformed/tampered token to a protected route | `401`; request is not processed as an authenticated user. |
| Expired JWT | Use an expired token | `401 Invalid or expired token`. |
| Missing JWT | Omit `Authorization` on protected endpoint | Authentication is rejected, normally `401`. |
| Token validation endpoint | `POST /auth/validate-token` with valid and invalid token values | `200` with `valid: true` plus identity claims for a valid token; `{"valid":false}` for invalid/expired token. |
| Password storage | Register a test user and inspect only the stored password-hash field in a controlled DB | Password is not stored as plaintext. Do not print real hashes into shared logs. |

### Registration-specific scenarios

| Scenario | Steps | Expected result |
|---|---|---|
| Registration enabled | `POST /auth/register` with unused username/password | `200`, success message; account has role `user`; password is hashed. |
| Duplicate username | Register same username again | `409 Username already exists.` |
| Registration disabled | Admin sets `allow_user_registration=false`; attempt registration | `403 User registration is currently disabled.` |
| Invalid request | Omit required fields or send wrong types | FastAPI validation error, normally `422`. |

## 5. Authorization and administrative APIs

| Scenario | Steps | Expected result |
|---|---|---|
| Non-admin dashboard access | Call `/auth/admin/dashboard` as normal user | `403 Admin access required`. |
| Missing/invalid JWT on admin route | Call any admin endpoint without a valid token | `401`; admin handler is not executed. |
| Admin user listing | Call `/auth/admin/users` as admin | `200` JSON array of users. |
| Duplicate admin-created user | `POST /auth/admin/users` with existing username | Current handler returns `400 Username already exists`. |
| Role update missing user | `PUT /auth/admin/users/{unknown_id}/role` | `404 User not found`. |
| Prevent self-deletion | Admin attempts `DELETE /auth/admin/users/{own_id}` | `400 Cannot delete your own account`. |
| Prevent deleting last admin | With one admin, attempt to delete that admin from another admin account where possible in a disposable fixture | `400 Cannot remove the last administrator`. |
| Admin audit trail | Create user/change role/delete permitted test user | Corresponding administrative audit event is recorded. |
| Admin chat-user association | Request `/auth/admin/users/{user_id}/chats/{chat_id}/messages` with mismatched user/chat IDs | `404 Chat not found`; messages are not disclosed. |
| Admin chat deletion | Delete a test session via `/auth/admin/chat/history/{session_id}` | Success detail returned; associated messages are removed according to configured relationships. |

## 6. Chat, message persistence, and isolation

### Core chat persistence

1. Log in as User A and retain the JWT/session returned by login.
2. `POST /auth/chat/history` with `{"message":"test message","response":"test reply"}`.
3. Confirm a conversation is created for User A and the JWT session, with separate `user` and `chatbot` message rows.
4. Submit another turn under the same token and verify the existing conversation is reused.
5. Omit `response` and verify the user message persists without an extra chatbot message.
6. Restart the relevant container and confirm persisted records remain when using the same database volume.

Expected response is a conversation object with identifiers, session/user IDs, timestamp, and message collection. The exact timestamps are generated by the application/database.

### Chat-history isolation

- **User A reads own history:** `GET /auth/chat/history` with A's token returns only A's conversations for the session in that JWT.
- **User B cannot read A's history:** log in as B and call the current-session history route; B's JWT scope must not return A's records.
- **No history:** for a valid user/session with no saved conversation, current implementation returns `404 No chat history found for this session`.
- **No client-controlled session:** verify that a request body cannot override the session ID; the save schema does not accept client-supplied `session_id` or `sender` as the authority.
- **Admin inspection:** admin chat-list/detail endpoints may retrieve conversations across users, but a chat ID must match the path's user ID before messages are returned.

### Maintenance mode and message length

| Scenario | Setup/action | Expected result |
|---|---|---|
| Maintenance enabled, normal user | Set `maintenance_mode=true`; submit `POST /auth/chat/history` | `503` with maintenance message. |
| Maintenance enabled, admin | Submit chat-history write as admin | Current handler does not block admin users in this check. |
| Message at configured limit | Set `max_message_length=N`; send a message of length N | Accepted if otherwise valid. |
| Message over limit | Send N+1 characters | `400` with maximum-length message. |
| Missing/invalid stored max length | Use a controlled DB fixture with missing/non-integer setting | Handler falls back to 5000. |

Note: this route persists supplied user and response text; it is not itself the Rasa inference endpoint. Test chatbot inference separately through the Rasa route.

## 7. File upload, encryption, and download

### Upload

1. Log in and send `POST /files/upload` with multipart field `file` and a small synthetic file.
2. Expect `200` JSON containing `id`, original `filename`, and `status`.
3. Verify metadata is in the database and the stored object is encrypted bytes, not a plaintext copy.
4. Upload a file larger than 100 MiB in a controlled test environment. Expect application `413`; Nginx has a configured 100 MiB body limit, which may reject the request at the proxy first.
5. Test missing file field; expect request validation failure.

### Encryption/decryption

- Upload a known file, download it as its owner, and compare downloaded bytes/hash with the original.
- Verify encrypted storage bytes differ from plaintext for a representative non-empty file.
- Verify wrapped file-key metadata exists in the `encryption_keys` model/table for new-format records.
- Test missing `FILE_MASTER_KEY` in a disposable environment: encryption-key operations should fail rather than silently use an insecure key.
- Test a wrong master key only against disposable data; decryption should fail and the API should not expose cryptographic exception details.
- Test missing stored object and missing key record; authenticated download currently reports `404` for a missing object and `500` for missing key/decryption errors.

Never run key-migration scripts against live data without reading their source, taking a backup of both DB and encrypted files, and rehearsing the migration on a copy.

## 8. File permissions, sharing, and share links

### Owner and recipient permissions

1. Upload a file as User A.
2. Download as A: expect success.
3. Attempt download as User B before sharing: expect `403 Access denied`.
4. A calls `POST /files/{file_id}/share` with `{"user_id":<B_ID>,"permission":"READ"}`.
5. Download as B: expect success and decrypted content.
6. Attempt to share A's file as B: expect `403 Only owner can share`.
7. Attempt access to a nonexistent file: expect `404`.
8. Verify the share operation creates the expected permission record and relevant audit event as implemented.

### Share links

1. Owner creates a link using `POST /files/{file_id}/share-link` with `{"expires_at":null,"max_downloads":1}`.
2. Expect response with link ID, file ID, relative URL, expiry, max download count, and initial `download_count=0`.
3. Open `GET /files/shared/{token}` without a JWT; the token is the credential.
4. For a valid link, expect a file download, download count increment, and audit event with `access_method=SHARE_LINK`.
5. Use an unknown token: expect `404`.
6. Use an expired link: expect `410`.
7. Use a link whose download limit has been reached: expect `410`.
8. Attempt link creation as a non-owner: expect `403`.
9. Attempt to create a link with expiration in the past: expect `400`.

**Implementation caveat:** The current `GET /files/shared/{token}` source has an expiration-check branch that should be verified when `expires_at` is `null`; include a regression test and fix the branch before relying on non-expiring links in production.

## 9. File audit logging

- Authenticated successful download should create a `DOWNLOAD` audit record with `access_method=AUTHENTICATED` and request metadata.
- Successful share-link download should create a `DOWNLOAD` audit record with `access_method=SHARE_LINK`, share-link ID, and no authenticated user ID.
- Verify denied or failed operations do not create a misleading successful-download event.
- Check action, file ID, user ID, share-link ID, access method, timestamp, IP and user-agent fields as defined by the model/schema. A Docker gateway IP may be observed instead of the original browser IP; see `docs/troubleshooting.md`.

## 10. Dashboard and analytics

### Dashboard (`GET /auth/admin/dashboard`)

- Admin can load the dashboard; normal user receives `403`.
- Compare total users/conversations/messages to controlled database counts.
- Confirm `active_users` means distinct users with at least one conversation, not a recent-activity window.
- Confirm recent users are limited to five and ordered by descending user ID.
- Confirm recent conversations are limited to five and newest first.
- Verify the activity payload has seven calendar-day labels and corresponding conversation/message arrays; backend timezone is `Asia/Kolkata`.

### Analytics (`/auth/admin/analytics/*`)

Test `/overview`, `/chat-activity`, `/message-activity`, `/top-users`, `/chat-statistics`, and `/hourly-activity` as admin and as a non-admin.

- Omitted dates default to the last 30 inclusive calendar days ending today in `Asia/Kolkata`.
- A custom `start_date`/`end_date` returns metrics for the requested inclusive range.
- Empty days in daily activity arrays are represented with zero values.
- Invalid date strings should be rejected by request validation.
- `top-users` `limit` defaults to 10; values outside 1–100 should fail validation.
- Compare message totals with `chat_messages` joined to conversations according to the backend query. Do not assume the selected period filters individual message creation timestamps: the current queries scope messages through their parent conversation timestamp.

## 11. Settings and registration policy

- `GET /auth/admin/settings/public` works without a JWT and returns only `application_name`, `max_message_length`, `maintenance_mode`, and `allow_user_registration`.
- Confirm no unrelated/internal settings are leaked by the public endpoint.
- `GET /auth/admin/settings` and `PUT /auth/admin/settings` require admin; a non-admin receives `403`.
- Update each field with valid data and confirm serialized response types (boolean flags, integer message limit, string application name).
- Test `application_name` boundaries 1 and 100 characters; `max_message_length` boundaries 1 and 100000; reject out-of-range/unknown fields per schema.
- Verify each settings update produces an audit event.
- Verify `allow_user_registration=false` blocks new registration and `maintenance_mode=true` blocks non-admin chat-history writes.

## 12. Audit-log UI and CSV export

- Admin can list logs at `GET /auth/admin/logs`; non-admin cannot.
- Test `page` minimum 1 and `page_size` range 1–200.
- Filter by `level` and case-insensitive `search`; confirm results are newest first and totals/pagination reflect the filtered query.
- `GET /auth/admin/logs/export` returns a CSV download named `system_logs.csv` with columns `Timestamp`, `User`, `Level`, `Action`, `Details` and applies the same level/search filters.
- `POST /auth/admin/logs` accepts levels `info`, `warning`, `error`; invalid levels or missing action return `400`.
- Verify sensitive data (passwords, JWTs, master keys) is not included in audit details.

## 13. Frontend testing

Test the user flows in the browser and inspect the Network and Console panels:

- login success/failure and token storage under `localStorage.authToken`;
- registration enabled/disabled behavior and duplicate usernames;
- chat message submission, response display, length validation, and maintenance state;
- history refresh and session isolation;
- admin navigation and API failures for non-admin users;
- dashboard cards/charts against API payloads;
- analytics date filters, loading/error/empty states;
- user management, settings save, log search/pagination/CSV export;
- upload progress/error handling, list/download/delete, direct sharing and share-link flow.

Frontend role checks are not security controls. Confirm the backend rejects forbidden requests even if a user manually changes browser storage or calls an endpoint directly.

## 14. Rasa and custom-action testing

The repository's explicit Rasa story regression file is `rasa/tests/test_stories.yml`. It should be run with the Rasa test workflow supported by the version pinned in `rasa/Dockerfile`/requirements. Inspect the installed Rasa version and its CLI help before choosing a command; no exact test command is asserted here because the archive does not provide a project-level test script.

- Ensure stories use current intents, entities, responses, and action names in `domain.yml` and `data/`.
- Train/validate NLU changes with the configured Rasa tooling and representative examples.
- Test action-server reachability from Rasa using the service name and port in `rasa/endpoints.yml`.
- Test custom actions in `rasa_sdk/actions/` for expected slot/event/response behavior and database failure handling.
- Confirm auth/session-related actions do not trust arbitrary client-supplied user IDs or session IDs.
- Review Rasa logs and SDK logs separately when an intent is parsed but the custom action fails.

## 15. PostgreSQL and migrations

- Verify initialization on a brand-new disposable volume: `postgres/init.sql` and `postgres/seed.sql` are initialization scripts and generally run only when the data directory is empty.
- Verify restart persistence by stopping/restarting containers without deleting volumes.
- Check the current File Service Alembic revision using the documented container command `docker compose exec file_service alembic current`.
- Apply pending File Service migrations in a test environment with `docker compose exec file_service alembic upgrade head`.
- Test migrations on an empty database and a copy of representative existing data. Verify constraints, foreign keys, encryption-key rows, share links, file-access audits, and chat/message records after migration.
- Auth Service currently calls SQLAlchemy `create_all()` at startup; do not assume it applies alterations to existing tables as a versioned migration would.

## 16. Docker and deployment smoke tests

1. `docker compose config` parses successfully.
2. `docker compose ps` shows expected services running.
3. Review `docker compose logs --tail=200 <service>` for startup/import/configuration failures.
4. Browser `http://localhost:8081/` loads login page; static files resolve.
5. Nginx forwards `/auth/`, `/rasa/`, `/files/` to the correct service.
6. Login/register work and JWT-protected APIs reject missing/invalid tokens.
7. File Service health route `/health` and database health route `/health/db` respond if accessed directly; note they may not be exposed through Nginx.
8. Upload/download round trip preserves bytes and stored file is encrypted.
9. Chat history survives container restart using persistent DB storage.
10. Rasa responds and custom actions reach the SDK.
11. Admin settings/logs/dashboard/analytics reject non-admin requests.
12. A database and file-storage backup can be restored in a separate environment.

## 17. Regression checklist before merging

- [ ] Valid/invalid/expired JWT behavior unchanged.
- [ ] `require_admin` guards all admin-only routes.
- [ ] Cross-user chat history and file access remain isolated.
- [ ] Registration toggle, maintenance mode, and message-length limit work.
- [ ] Dashboard/analytics counts and date ranges remain correct.
- [ ] File encryption/decryption and `FILE_MASTER_KEY` handling work.
- [ ] Direct `READ` permission and share-link expiry/download limits work.
- [ ] File and admin audit events are correct and contain no secrets.
- [ ] Alembic migration upgrades a representative database safely.
- [ ] Nginx routes and frontend module flows remain functional.
- [ ] Documentation is updated for any API/config/schema behavior changes.
