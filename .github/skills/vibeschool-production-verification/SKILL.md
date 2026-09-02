---
name: vibeschool-production-verification
description: Verify the actual deployed VibeSchool revision and affected production contracts after merge/deploy.
---
# Production Verification
Do not infer production from merge or preview success. Resolve deployed revision/version and environment, verify configuration and migration parity, then exercise the affected production contract or user journey with bounded safe probes. Confirm error/rollback/observability posture where relevant. External-provider state must be observed, not fabricated. Report PRODUCTION_VERIFIED only for the exact scope supported by current evidence.
