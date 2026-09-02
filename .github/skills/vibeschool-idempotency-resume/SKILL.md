---
name: vibeschool-idempotency-resume
description: Make VibeSchool missions and consequential retries safe to resume across agents, chats and failures.
---
# Idempotency and Resume
Persist mission checkpoints and exact revision/evidence state outside chat. Consequential retryable actions must be idempotent, deduplicated or guarded against duplicate effects. On resume, refresh current repository/production truth, invalidate stale evidence, reacquire mutation scope/lease, and continue from the last valid checkpoint rather than trusting remembered completion.
