---
name: vibeschool-completion-gate
description: Prevent premature completion/readiness claims while VibeSchool mission requirements or evidence remain unresolved.
---
# Completion Gate
A mission cannot be called complete while a mandatory requirement is UNKNOWN, PENDING, FAIL, BLOCKED, stale, contradicted or unvisited. NOT_APPLICABLE requires a reason. Evidence must match the exact scope and revision. Narrative confidence cannot upgrade IMPLEMENTED to VERIFIED, CERTIFIED, MERGED or PRODUCTION_VERIFIED. Surface the highest proven state and unresolved blockers instead.
