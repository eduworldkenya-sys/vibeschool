create or replace function public.get_vibetextbook_reader(publication_id_input uuid)
returns jsonb language plpgsql stable security definer set search_path to 'public', 'auth' as $function$
declare
  publication_row public.vibe_publications%rowtype;
  current_user_id uuid := auth.uid();
  viewer_is_author boolean := false;
  author_display_name text;
  chapter_payload jsonb;
  resume_payload jsonb;
begin
  select * into publication_row from public.vibe_publications where id=publication_id_input;
  if not found or publication_row.format <> 'vibetextbook' then return jsonb_build_object('ok',false,'reason','not_found'); end if;
  viewer_is_author := current_user_id is not null and current_user_id=publication_row.author_id;
  if publication_row.status <> 'published' and not viewer_is_author then return jsonb_build_object('ok',false,'reason','not_found'); end if;
  select coalesce(p.full_name,'Anonymous') into author_display_name from public.profiles p where p.id=publication_row.author_id;
  author_display_name := coalesce(author_display_name,'Anonymous');
  select coalesce(jsonb_agg(jsonb_build_object(
    'id',c.id,'publication_id',c.publication_id,'title',c.title,'number',c.number,'status',c.status,
    'word_count',c.word_count,'reading_time_min',c.reading_time_min,'published_at',c.published_at,
    'created_at',c.created_at,'updated_at',c.updated_at,'cbc_strand',c.cbc_strand,
    'can_read',ent.can_read,'is_bookmarked',wi.id is not null,
    'progress_percent',coalesce(rp.progress_percent,0),'completed_at',rp.completed_at,'last_read_at',rp.last_read_at,
    'curriculum',jsonb_build_object(
      'framework',publication_row.curriculum_framework,
      'grade',coalesce(cs.grade,cu.grade,publication_row.cbc_grade),
      'subject',coalesce(cu.subject,subj.name,publication_row.cbc_subject),
      'strand',coalesce(cs.name,cu.strand,c.cbc_strand),'sub_strand',coalesce(cs.sub_strand,cu.sub_strand),
      'topic',cu.topic,'term',coalesce(cs.term,cu.term),'week',coalesce(cs.week,cu.week),
      'learning_outcomes',case when c.learning_outcomes is not null and coalesce(array_length(c.learning_outcomes,1),0)>0 then c.learning_outcomes else coalesce(cs.learning_outcomes,'{}') end,
      'key_inquiry_questions',coalesce(cs.key_inquiry_questions,'{}'),'suggested_experiences',coalesce(cs.suggested_experiences,'{}'),
      'core_competencies',coalesce(cs.core_competencies,'{}'),'core_values',coalesce(cs.core_values,cs.values,'{}'),
      'source_ref',coalesce(cs.source_ref,cu.reference),'alignment_status',c.alignment_status,
      'authority',case c.alignment_status when 'verified' then 'official' when 'creator_claimed' then 'publisher' when 'pending_review' then 'publisher' else null end,
      'verified_by',c.verified_by,'verified_at',c.verified_at,
      'has_curriculum_detail',(cs.id is not null or cu.id is not null or coalesce(array_length(c.learning_outcomes,1),0)>0)
    ),
    'blocks',case when ent.can_read then case when jsonb_typeof(c.blocks)='array' then c.blocks else '[]'::jsonb end else null end
  ) order by c.number asc),'[]'::jsonb) into chapter_payload
  from public.vibe_chapters c
  left join public.vibe_reading_progress rp on rp.chapter_id=c.id and rp.publication_id=c.publication_id and rp.viewer_id=current_user_id
  left join public.vibe_workspace_items wi on wi.chapter_id=c.id and wi.publication_id=c.publication_id and wi.viewer_id=current_user_id and wi.item_type='bookmark'
  left join public.cbc_strands cs on cs.id=c.sub_strand_id
  left join public.subjects subj on subj.id=cs.subject_id
  left join public.curriculum cu on cu.id=c.curriculum_id
  left join lateral (select public.can_viewer_read_chapter(c.id,current_user_id) as can_read) ent on true
  where c.publication_id=publication_row.id and (viewer_is_author or c.status in ('published','locked'));
  if current_user_id is not null then
    select jsonb_build_object('chapter_id',rp.chapter_id,'progress_percent',rp.progress_percent,'last_read_at',rp.last_read_at)
    into resume_payload from public.vibe_reading_progress rp
    where rp.viewer_id=current_user_id and rp.publication_id=publication_row.id order by rp.last_read_at desc limit 1;
  else resume_payload := null; end if;
  return jsonb_build_object('ok',true,'reason',null,'viewer_is_author',viewer_is_author,'author_name',author_display_name,'publication',to_jsonb(publication_row),'chapters',chapter_payload,'resume',resume_payload);
end;
$function$;
revoke all on function public.get_vibetextbook_reader(uuid) from public;
grant execute on function public.get_vibetextbook_reader(uuid) to anon, authenticated, service_role;
