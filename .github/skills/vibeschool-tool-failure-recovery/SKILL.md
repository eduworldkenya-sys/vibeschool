---
name: vibeschool-tool-failure-recovery
description: Distinguish VibeSchool product defects from connector, CI, environment, timeout and external-provider failures and recover appropriately.
---
# Tool Failure Recovery
Classify failures before acting: product/code, test/contract, environment, connector/API, CI infrastructure, timeout/rate limit, stale evidence or external provider. Preserve the failing evidence and change strategy after repeated identical failure. Do not modify product code to mask a connector outage, and do not call a product defect external without proof. Resume from durable mission state after recovery.
