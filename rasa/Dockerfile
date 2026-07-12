FROM rasa/rasa:3.6.21

WORKDIR /app

COPY . .

USER root

RUN pip install --no-cache-dir "sqlalchemy<2.0"

USER 1001