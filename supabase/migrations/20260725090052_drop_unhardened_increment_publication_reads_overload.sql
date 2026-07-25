-- The single-arg overload increment_publication_reads(uuid) predates the
-- hardening migration and has none of its protections: no auth.uid()
-- derivation, no 24h dedup check, no published-status gate. Repo-wide grep
-- found exactly one call site and it already used the two-arg form.
drop function if exists public.increment_publication_reads(uuid);
