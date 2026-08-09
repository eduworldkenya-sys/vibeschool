alter table public.curriculum_intelligence_proposals add column if not exists editorial_patch jsonb;
alter table public.curriculum_intelligence_proposals add column if not exists editorial_status text not null default 'not_prepared';
alter table public.curriculum_intelligence_proposals add column if not exists editorial_prepared_at timestamptz;
alter table public.curriculum_intelligence_proposals add column if not exists editorial_model text;
alter table public.curriculum_intelligence_proposals add column if not exists derivative_impacts jsonb not null default '[]'::jsonb;

do $$ begin
  alter table public.curriculum_intelligence_proposals add constraint curriculum_intelligence_editorial_status_check check (editorial_status in ('not_prepared','prepared','needs_review','invalidated'));
exception when duplicate_object then null; end $$;

create or replace function public.hq_apply_curriculum_intelligence_proposal(p_proposal_id uuid)
returns public.curriculum_intelligence_proposals
language plpgsql security definer set search_path='public','pg_temp'
as $$
declare
  p public.curriculum_intelligence_proposals%rowtype;
  c public.vibe_chapters%rowtype;
  target_seq int; target_legacy text; replacement text; new_blocks jsonb; matched int;
begin
  if not public.is_platform_owner() then raise exception 'HQ platform owner required'; end if;
  select * into p from public.curriculum_intelligence_proposals where id=p_proposal_id for update;
  if not found then raise exception 'Proposal not found'; end if;
  if p.status <> 'approved' then raise exception 'Proposal must be approved before apply'; end if;
  if p.editorial_status <> 'prepared' or p.editorial_patch is null then raise exception 'Editorial patch must be prepared before apply'; end if;
  if p.chapter_id is null then raise exception 'Proposal has no target chapter'; end if;
  if coalesce(p.editorial_patch->>'operation','') <> 'replace_block_content' then raise exception 'Unsupported editorial patch operation'; end if;
  target_seq := nullif(p.editorial_patch->>'sequence','')::int;
  target_legacy := nullif(p.editorial_patch->>'legacy_block_id','');
  replacement := nullif(p.editorial_patch->>'content','');
  if target_seq is null or replacement is null then raise exception 'Editorial patch requires sequence and content'; end if;
  select * into c from public.vibe_chapters where id=p.chapter_id for update;
  if not found then raise exception 'Target chapter not found'; end if;
  select count(*) into matched from public.content_blocks where chapter_id=c.id and sequence=target_seq and (target_legacy is null or legacy_block_id=target_legacy);
  if matched <> 1 then raise exception 'Editorial target is stale or ambiguous'; end if;
  if coalesce(p.editorial_patch->>'expected_current','') <> coalesce((select plain_text from public.content_blocks where chapter_id=c.id and sequence=target_seq limit 1),'') then raise exception 'Editorial patch is stale; regenerate before apply'; end if;
  select jsonb_agg(case when ordinality::int=target_seq then jsonb_set(value,'{content}',to_jsonb(replacement),true) else value end order by ordinality)
    into new_blocks from jsonb_array_elements(c.blocks) with ordinality;
  if new_blocks is null then raise exception 'Target chapter has no blocks'; end if;
  update public.vibe_chapters set blocks=new_blocks,updated_at=now(),alignment_status='creator_claimed',content_pack_version=coalesce(content_pack_version,0)+1 where id=c.id;
  perform public.ce_reconcile_chapter_content_blocks(c.id);
  update public.content_derivatives set status='stale',updated_at=now(),quality=coalesce(quality,'{}'::jsonb)||jsonb_build_object('invalidated_by_curriculum_intelligence',p.id,'invalidated_at',now()) where source_chapter_id=c.id and status <> 'stale';
  update public.curriculum_intelligence_proposals set status='applied',applied_by=auth.uid(),applied_at=now(),updated_at=now() where id=p.id returning * into p;
  insert into public.curriculum_intelligence_audit(proposal_id,actor_id,action,before_state,after_state,note) values(p.id,auth.uid(),'applied',jsonb_build_object('chapter_id',c.id,'target_sequence',target_seq),jsonb_build_object('chapter_id',c.id,'content_pack_version',coalesce(c.content_pack_version,0)+1),'Applied prepared editorial patch and invalidated chapter derivatives');
  return p;
end; $$;
revoke all on function public.hq_apply_curriculum_intelligence_proposal(uuid) from public,anon;
grant execute on function public.hq_apply_curriculum_intelligence_proposal(uuid) to authenticated;
