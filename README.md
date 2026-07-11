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

# Getting Started

---

# Docker Setup

Before starting the application, ensure that Docker and Docker Compose are installed and running on your system. This project is designed to run entirely inside Docker containers using **Docker Compose**.

> **Note**
>
> This project is fully containerized using **Docker Compose**. All Python dependencies are installed and executed inside their respective Docker containers. A local Python virtual environment (`venv`) is **not required** to build or run the application.
>
> To get started:
> 1. Configure the `.env` file.
> 2. Create the required Docker volumes.
> 3. Build and start the services using Docker Compose.
>
> This approach ensures a consistent development and deployment environment across Windows, Linux, and macOS.

## Prerequisites

- Docker Desktop (Windows/macOS) or Docker Engine (Linux)
- Docker Compose (included with Docker Desktop)
- Git

Verify the installation:

```bash
docker --version
docker compose version
```

## Clone the Repository

```bash
git clone https://github.com/Keerthana-PMalode/SmartChat-AI-Platform.git
cd SmartChat-AI-Platform
```

## Configure Environment Variables

Create an environment file by copying the example configuration:

```bash
cp .env.example .env
```

or on Windows:

```powershell
copy .env.example .env
```

Update the following values as required:

```text
DATABASE_URL=postgresql://chatbot:chatbot@postgres:5432/chatbot
SECRET_KEY=change_this_to_a_long_random_secret

POSTGRES_HOST=postgres
POSTGRES_PORT=5432
POSTGRES_USER=chatbot
POSTGRES_PASSWORD=chatbot
POSTGRES_DB=chatbot
```

> **Important:** Do not commit your `.env` file to GitHub. Only commit `.env.example`.

## Create Docker Volumes

The project uses persistent Docker volumes for PostgreSQL data and Rasa trained models.

Create them before starting the application:

```bash
docker volume create chatbot-project_postgres_data
docker volume create chatbot-project_rasa_models
```

Verify that the volumes exist:

```bash
docker volume ls
```

## Build and Start Containers

Build and start all services using Docker Compose:

```bash
docker compose up --build
```
This command:
- Builds custom service images
- Pulls required base images from Docker Hub
- Creates containers
- Creates the Docker network
- Starts all application services

## Stop Containers

Stop the running services:

```bash
docker compose down
```
This removes containers and the Docker Compose network. Docker volumes are preserved, so PostgreSQL data and Rasa models remain available.

## Verify Running Containers

```bash
docker ps
```
Expected containers:
- chatbot-project-nginx-1
- chatbot-project-rasa-1
- chatbot-project-rasa_sdk-1
- chatbot-project-file_service-1
- chatbot-project-auth-1
- chatbot-project-postgres-1

---

# Services

| Service | URL |
|----------|-----|
| Frontend | http://localhost:8081 |
| Auth API | http://localhost:8000 |
| File API | http://localhost:8001 |
| Rasa API | http://localhost:5006 |

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
