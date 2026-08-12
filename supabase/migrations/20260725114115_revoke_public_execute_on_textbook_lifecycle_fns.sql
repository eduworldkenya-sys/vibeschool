revoke all on function public.publish_textbook(uuid) from public;
revoke all on function public.unpublish_textbook(uuid) from public;
revoke all on function public.remove_textbook_from_vibelearn(uuid) from public;

grant execute on function public.publish_textbook(uuid) to authenticated;
grant execute on function public.unpublish_textbook(uuid) to authenticated;
grant execute on function public.remove_textbook_from_vibelearn(uuid) to authenticated;

-- The historical production ledger may contain reconcile_textbook_index(uuid),
-- while a data-free blank rebuild can legitimately omit it when there are no
-- production publication rows to reconcile. Keep the privilege hardening
-- fail-safe without requiring that production-data helper to exist.
do $$
begin
  if to_regprocedure('public.reconcile_textbook_index(uuid)') is not null then
    revoke all on function public.reconcile_textbook_index(uuid) from public;
    grant execute on function public.reconcile_textbook_index(uuid) to authenticated;
  end if;
end
$$;
