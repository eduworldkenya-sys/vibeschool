---
name: vibeschool-root-cause-debugging
description: Systematic reproduce-trace-root-cause-repair workflow for VibeSchool defects and failing CI.
---
# Root Cause Debugging
Reproduce on the exact affected revision/environment. Bind logs/errors to the failing path. Trace UI -> service -> API/RPC -> database/provider as applicable. Separate cause from symptom and environment/tool failure from product failure. Form falsifiable hypotheses, reject disproven ones, repair the earliest durable cause, add a regression that detects the failure, then rerun affected verification. Blind retries and cosmetic patches are forbidden.
