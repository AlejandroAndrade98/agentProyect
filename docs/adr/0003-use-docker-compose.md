# ADR 0003: Use Docker Compose for All Services
**Status:** Accepted
**Date:** 2026-05-06

## Context
The app must be deployable on different environments, including a local Mac Mini, and be easily migratable to the cloud.

## Decision
Dockerize all components (Web, API, Worker, DB, Redis) using Docker Compose from day one.

## Rationale
- Ensures "it works on my machine" consistency.
- Simplifies the setup of PostgreSQL and Redis.
- Allows easy scaling and future migration to Kubernetes or ECS.
