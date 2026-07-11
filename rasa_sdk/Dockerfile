FROM rasa/rasa-sdk:3.6.2

USER root

RUN apt-get update && \
    apt-get install -y curl net-tools && \
    rm -rf /var/lib/apt/lists/*

WORKDIR /app

COPY requirements.txt .

RUN pip install --no-cache-dir -r requirements.txt

COPY actions ./actions

USER 1001