# ADR 0002: Use NestJS for API and Worker
**Status:** Accepted
**Date:** 2026-05-06

## Context
Need a backend framework that ensures scalability, maintainability and strict structure.

## Decision
Use NestJS with TypeScript.

## Rationale
- Modular architecture by design.
- Strong dependency injection.
- Native support for Guards, Interceptors and Pipes (essential for Tenant isolation).
- Shared ecosystem with the Worker (BullMQ integration).
