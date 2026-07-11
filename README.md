<<<<<<< HEAD
# SmartChat AI Platform

A production-style AI chatbot platform built using **Rasa**, **FastAPI**, **PostgreSQL**, **Docker Compose**, and **Nginx**.

The platform combines conversational AI, secure authentication, encrypted file management, and a scalable microservice architecture.

---

# Project Highlights

- 🤖 AI Chatbot powered by Rasa Open Source
- 🔐 JWT Authentication & Role-Based Authorization
- 📁 Encrypted File Upload & Sharing
- 🗄 PostgreSQL Database
- 🐳 Dockerized Microservices
- 🌐 Nginx Reverse Proxy
- ⚡ FastAPI REST APIs
- 📚 Modular Project Architecture

---

# Technology Stack

| Category | Technologies |
|----------|--------------|
| Backend | Python, FastAPI, SQLAlchemy |
| AI | Rasa Open Source |
| Database | PostgreSQL |
| Frontend | HTML, CSS, JavaScript |
| Containerization | Docker, Docker Compose |
| Web Server | Nginx |
| Authentication | JWT |

---

# System Architecture

The application follows a containerized microservice architecture.

![System Architecture](docs/images/system-architecture.png)

---

# Running Containers

The entire platform runs as independent Docker containers orchestrated using Docker Compose.

The following screenshot shows the complete application stack running successfully.

| Container | Purpose |
|-----------|---------|
| postgres | PostgreSQL Database |
| auth_service | Authentication & JWT APIs |
| file_service | Secure File Storage Service |
| rasa_sdk | Custom Rasa Actions |
| rasa_server | Conversational AI Engine |
| rasa_nginx | Reverse Proxy & Frontend |

![Docker Containers](docs/images/docker-ps.png)

---

# Database Design

The database schema consists of authentication, chatbot history, secure file storage, and permission management.

![Database ER Diagram](docs/images/database-erd.png)

---

# Chat History Relationship

Authenticated and guest conversations are stored efficiently using either a registered user or a session identifier.

![Chat History ER Diagram](docs/images/chat-history-erd.png)

---

# Project Structure

![Project Structure](docs/images/project-structure.png)

---

# Features

## Authentication

- User Registration
- Login
- JWT Token Generation
- Password Hashing
- Role-based Access Control

---

## Chatbot

- Rasa Conversational AI
- Custom Actions
- Chat History
- Guest Sessions
- Authenticated Users

---

## File Management

- Upload
- Download
- File Encryption
- Sharing
- Permission Management
- Audit Logging

---

## Infrastructure

- Docker Compose
- PostgreSQL
- Nginx Reverse Proxy
- REST APIs
- Container Networking

---

# Screenshots

## Login

![Login](docs/images/login-page.png)

---

## Chatbot

<!--
TODO: Re-enable the login page screenshot once it's updated.
![Chatbot](docs/images/chatbot-ui.png)
-->

---

## Admin Dashboard

<!--
TODO: Re-enable the login page screenshot once it's updated.
![Admin](docs/images/admin-dashboard.png)
-->

---

## File Manager

<!--
TODO: Re-enable the login page screenshot once it's updated.
![Files](docs/images/file-management.png)
-->

---

# Getting Started

## Clone Repository

```bash
git clone https://github.com/Keerthana-PMalode/SmartChat-AI-Platform.git
cd SmartChat-AI-Platform
```

---

## Configure Environment

Copy

```
.env.example
```

to

```
.env
```

Update

```
DATABASE_URL
SECRET_KEY
POSTGRES_USER
POSTGRES_PASSWORD
POSTGRES_DB
```

---

## Start Containers

```bash
docker compose up --build
```

---

# Services

| Service | URL |
|----------|-----|
| Frontend | http://localhost:8081 |
| Auth API | http://localhost:8000 |
| File API | http://localhost:8001 |
| Rasa API | http://localhost:5006 |

---

---

# Service Verification

After starting all containers with Docker Compose, verify that each service is running correctly.

## Frontend

Open the application in your browser:

```
http://localhost:8081
```

or

```
http://localhost:8081/login.html
```

The login page should be displayed successfully.

---

## Authorization Service

The Authorization Service can be verified by opening:

```
http://localhost:8000/
```

A response similar to the following confirms that the service is running correctly:

```json
{
  "detail": "Not Found"
}
```

This response is expected because the root (`/`) endpoint is intentionally not implemented.

To explore and test the available authentication and authorization APIs, open the FastAPI Swagger documentation:

```
http://localhost:8000/docs
```

From the Swagger UI, you can test endpoints such as:

- User Registration
- User Login
- JWT Token Generation
- User Administration
- Chat History APIs

---

## File Service

Verify the File Service by opening:

```
http://localhost:8001/
```

A response similar to the following is expected:

```json
{
  "detail": "Not Found"
}
```

The interactive API documentation is available at:

```
http://localhost:8001/docs
```

You can test:

- File Upload
- File Download
- File Sharing
- Permission Management
- Audit APIs

---

## Rasa Server

Verify the Rasa server by opening:

```
http://localhost:5006/
```

or

```
http://localhost:5006/version
```

The `/version` endpoint returns the installed Rasa version, confirming that the conversational AI server is operational.

---

## Running Containers

You can verify that all services are running using:

```bash
docker ps
```

A successful deployment should show containers similar to:

- postgres
- auth_service
- file_service
- rasa_sdk
- rasa_server
- rasa_nginx

See the deployment screenshot below.

![Docker Containers](docs/images/docker-ps.png)

---

# Documentation

Additional documentation is available in the **docs/** folder.

* Architecture
* API Documentation
* Deployment Guide

---

# Future Enhancements

* Kubernetes
* CI/CD
* Redis
* OAuth2
* WebSockets
* Monitoring
* Unit Testing

---

# Author

**Keerthana P. Malode**

Computer Science & Engineering (IoT)

Interested in

* Backend Development
* AI Applications
* Distributed Systems
* Cloud & DevOps
* Conversational AI

---

# License

MIT License
