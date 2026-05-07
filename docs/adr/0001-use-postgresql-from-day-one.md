# ADR 0001: Use PostgreSQL from Day One
**Status:** Accepted
**Date:** 2026-05-06

## Context
Need a reliable database for a multi-tenant SaaS. Options considered: SQLite (fast prototyping), MySQL, PostgreSQL.

## Decision
Use PostgreSQL 16 from the very first commit.

## Rationale
- Strong support for complex relations and indexing.
- Better handling of JSONB for AI suggestions.
- Standard for production SaaS.
- Avoids the "migration pain" from SQLite to a real DB later.
