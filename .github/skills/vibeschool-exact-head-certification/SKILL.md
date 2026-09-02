---
name: vibeschool-exact-head-certification
description: Enforce current-main freshness, exact-head CI, stale-evidence invalidation and exact-head merge discipline.
---
# Exact-Head Certification
Use current main -> isolated branch -> implementation/preflight -> PR -> exact-head required CI -> freshness check -> exact verified-head merge -> post-merge verification. Any relevant head or base movement invalidates stale evidence and requires affected reconciliation/reverification. Historical green checks cannot authorize a changed candidate. Use expected-head merge guards where available.
