# Troubleshooting

## localStorage token returns null

### Problem

The following command returns `null`:

```javascript
localStorage.getItem("token")
```
**Cause**

The application stores the JWT using the key:

```text
authToken
```
Therefore, attempting to retrieve the token using token returns null.

**Correct command**

Use the key configured by the application:

```javascript
localStorage.getItem("authToken")
```

**Inspect all browser storage**

To inspect all values currently stored in localStorage, run:

```javascript
Object.fromEntries(Object.entries(localStorage))
```

Expected:

```text
{
  role: "...",
  authToken: "...",
  username: "..."
}
```
If authToken is not present, verify that the user has successfully logged-in
and that the authentication response is storing the JWT in localStorage.

## File access log shows 172.20.0.1

**Problem**

The audit log contains an IP address such as:

```text
ip_address = 172.20.0.1
```

**Cause**

The application is running inside Docker, and requests may pass through Nginx
before reaching the backend service.

As a result, the IP address recorded by the backend may represent the Docker
gateway or proxy rather than the original client IP.

**Investigation**

Check the Docker networks:

```bash
docker network ls
docker network inspect <network_name>
```

Inspect the proxy headers being forwarded by Nginx:

```text
X-Forwarded-For
X-Real-IP
```

If the original client IP needs to be recorded, Nginx and the backend should be
configured to forward and correctly interpret the appropriate proxy headers.

The application should only trust forwarded client-IP headers from known,
trusted proxies. Otherwise, clients may be able to spoof the reported IP
address.