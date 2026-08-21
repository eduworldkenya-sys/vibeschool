-- Priority 4 prerequisite: admit one qualification-only Finance read handler.
-- This widens the tool-contract vocabulary only; it does not enable any runtime capability.
alter table public.hq_workforce_tool_contracts
  drop constraint if exists hq_workforce_tool_contracts_handler_key_check;
alter table public.hq_workforce_tool_contracts
  add constraint hq_workforce_tool_contracts_handler_key_check check (
    handler_key = any(array[
      'work_item.triage_and_own'::text,
      'work_item.prioritize'::text,
      'content.research.external'::text,
      'content.evidence.semantic_verify'::text,
      'content.authoring.source_grounded'::text,
      'workforce.quality.assess_fixture'::text,
      'finance.reconciliation.readonly'::text
    ])
  );