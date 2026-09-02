---
name: vibeschool-implementation-quality
description: Senior implementation quality rules for VibeSchool application, service, database and integration code.
---
# Implementation Quality
Prefer existing canonical patterns and the smallest durable change. Use strong types and explicit boundaries. Avoid `any`, duplicated state/authority, silent fallbacks, swallowed exceptions, unsafe casts, speculative abstractions and hidden side effects. Preserve backwards compatibility unless the mission authorizes change. Keep UX persistence truth aligned: never show success before durable success. Add comments only for invariants and non-obvious rationale. Treat accessibility, mobile behavior, empty/error/loading states and observability as part of production implementation when relevant.
