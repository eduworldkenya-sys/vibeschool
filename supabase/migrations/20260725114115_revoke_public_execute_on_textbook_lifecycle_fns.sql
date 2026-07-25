revoke all on function public.publish_textbook(uuid) from public;
revoke all on function public.unpublish_textbook(uuid) from public;
revoke all on function public.remove_textbook_from_vibelearn(uuid) from public;
revoke all on function public.reconcile_textbook_index(uuid) from public;

grant execute on function public.publish_textbook(uuid) to authenticated;
grant execute on function public.unpublish_textbook(uuid) to authenticated;
grant execute on function public.remove_textbook_from_vibelearn(uuid) to authenticated;
grant execute on function public.reconcile_textbook_index(uuid) to authenticated;
