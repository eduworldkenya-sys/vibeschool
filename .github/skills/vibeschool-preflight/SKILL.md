---
name: vibeschool-preflight
description: Run focused local/static verification before expensive VibeSchool CI or deployment gates.
---
# Preflight
Before CI, run the narrowest relevant tests plus typecheck, lint, build/compile and changed-file/domain validation required by the blast radius. Check migration syntax/reconstruction, contract compatibility and authorization negative paths when applicable. Preflight is not certification; it exists to catch cheap failures early and conserve CI/deployment resources without weakening required later gates.
