# ADR 0004: Use AI Provider Abstraction
**Status:** Accepted
**Date:** 2026-05-06

## Context
The AI landscape changes rapidly. Depending on a single provider (e.g., OpenAI) creates vendor lock-in and risk.

## Decision
Implement an `AiProvider` interface and an `AiService` orchestrator.

## Rationale
- Allows swapping providers (OpenAI $\to$ Anthropic $\to$ Gemini) via a single environment variable.
- Simplifies testing with mock providers.
- Enables multi-provider strategies in the future.
