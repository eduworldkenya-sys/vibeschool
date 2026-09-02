---
name: vibeschool-concurrency-safety
description: Protect concurrent VibeSchool engineering work. Use before changing shared routes, migrations, contracts, schemas, or files and before reconciliation/merge.
---
# VibeSchool Concurrency Safety

1. Resolve exact current main and active PRs.
2. Map file overlap plus semantic overlap: routes, tables, RPCs, migrations, types, authority, user journeys and shared components.
3. Work only on an isolated branch/worktree from current main.
4. Never overwrite newer canonical work or force-update another lane.
5. When overlap exists, preserve both valid intents by reconciling against current main; do not replay stale files wholesale.
6. Re-check main and overlapping PRs before exact-head certification.
7. Treat base movement or conflicting concurrent changes as certification invalidation requiring reconciliation and affected re-verification.
8. Merge only the exact certified head and only with explicit merge authorization.
