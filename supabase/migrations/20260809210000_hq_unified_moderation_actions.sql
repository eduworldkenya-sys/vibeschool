-- Owner-only actions for the unified HQ moderation queue.
create or replace function public.hq_decide_moderation_item(p_source text,p_id uuid,p_decision text,p_reason text default null)
returns void language plpgsql security definer set search_path=public as $$
begin
  perform public.hq_assert_owner();
  if p_source='exam_flag' then
    if p_decision not in ('reviewed','dismissed') then raise exception 'Invalid exam flag decision'; end if;
    update exam_flags set status=p_decision where id=p_id;
  elsif p_source='incident' then
    if p_decision not in ('acknowledged','resolved') then raise exception 'Invalid incident decision'; end if;
    update hq_incidents set status=p_decision,
      acknowledged_at=case when p_decision='acknowledged' then coalesce(acknowledged_at,now()) else acknowledged_at end,
      resolved_at=case when p_decision='resolved' then now() else resolved_at end,
      recovery_evidence=case when nullif(btrim(coalesce(p_reason,'')),'') is not null then coalesce(recovery_evidence,'{}'::jsonb)||jsonb_build_object('owner_note',btrim(p_reason),'owner_note_at',now()) else recovery_evidence end
    where id=p_id;
  elsif p_source='assessment_request' then
    if p_decision not in ('approved','rejected') then raise exception 'Invalid assessment moderation decision'; end if;
    update assessment_moderation_requests set status=p_decision,reviewed_by=auth.uid(),reviewed_at=now(),review_reason=nullif(btrim(coalesce(p_reason,'')),'') where id=p_id and status='pending';
  else raise exception 'Unknown moderation source'; end if;
  if not found then raise exception 'Moderation item not found or no longer actionable'; end if;
end $$;
revoke all on function public.hq_decide_moderation_item(text,uuid,text,text) from public,anon;
grant execute on function public.hq_decide_moderation_item(text,uuid,text,text) to authenticated;
