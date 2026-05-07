# ADR 0005: Use Human Review for AI Suggestions
**Status:** Accepted
**Date:** 2026-05-06

## Context
AI can hallucinate or misinterpret commercial data. Writing directly to the CRM database could corrupt the source of truth.

## Decision
Implement a "Human-in-the-Loop" workflow. AI only writes to staging tables (`AiSuggestion`/`AiExtraction`).

## Rationale
- Maintains data integrity.
- Empowers the user to correct the AI.
- Ensures that only verified information becomes part of the official business record.
