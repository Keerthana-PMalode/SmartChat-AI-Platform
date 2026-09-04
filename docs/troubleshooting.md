# Troubleshooting

## localStorage token returns null

### Problem

The following command returns `null`:

```javascript
localStorage.getItem("token")
```

### Cause

The application stores the JWT using the **authToken** key.

Therefore, retrieving the token using the **token** key returns **null**.

**Correct command**

Use:

```javascript
localStorage.getItem("authToken")
```
---

## Inspect all browser storage

To inspect all values currently stored in localStorage:

```javascript
Object.fromEntries(Object.entries(localStorage))
```

Expected output:

```text
{
  role: "...",
  authToken: "<JWT>",
  username: "..."
}
```

If **authToken** is not present, verify that the user has successfully logged in
and that the authentication response stores the JWT in **localStorage**.

---

## File access log shows 172.20.0.1

### Problem

The audit log contains an IP address such as:

```text
ip_address = 172.20.0.1
```

### Cause

The application runs inside Docker, and requests may pass through Nginx before
reaching the File Service.

As a result, the backend may observe the Docker gateway or reverse-proxy
address instead of the original client IP.

### Investigation

Check the Docker networks:

```text
docker network ls
docker network inspect <network_name>
```

Check the Nginx configuration for forwarded client-IP headers:

```text
X-Forwarded-For
X-Real-IP
```

The backend should only trust these headers when requests originate from a
known, trusted reverse proxy.

### Resolution

If the original client IP needs to be recorded, configure Nginx to forward the
client IP and configure the backend to trust those headers only from the
trusted proxy.

Do not blindly trust client-supplied X-Forwarded-For or X-Real-IP headers,
as they can be spoofed when requests bypass the trusted proxy.

---

## Service is not running

### Problem

A Docker Compose service is stopped or repeatedly restarting.

### Investigation

Check service status:

```bash
docker compose ps
```

Check the service logs:

```bash
docker compose logs -f <service_name>
```

For example:

```bash
docker compose logs -f auth
docker compose logs -f file_service
docker compose logs -f nginx
docker compose logs -f rasa
```

If the service fails during startup, inspect the logs for configuration,
database connectivity, missing environment variables, or dependency errors.