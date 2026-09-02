---
name: vibeschool-supabase-safety
description: Mandatory safety workflow for VibeSchool Supabase/Postgres schema, migration, RPC, RLS, auth, grant, and production-data work.
---
# VibeSchool Supabase Safety

Before design, establish actual schema, migration ledger, RPC/function signatures, grants, RLS policies and relevant production data shape. Never invent a table, column, RPC or policy from memory.

For every write path verify authenticated identity, school/tenant binding, role/authority, cross-tenant denial, least privilege, idempotency/concurrency where applicable, fixed safe search_path for privileged functions, and browser/service-role separation.

Never disable or weaken RLS to make a feature work. SECURITY DEFINER requires explicit internal authorization and minimal grants. Test positive and adversarial negative paths. Validate migrations on reconstruction/current schema and reconcile repository migration versions with production truth. Production mutation must be explicitly authorized, bounded, evidence-backed and followed by verification.
