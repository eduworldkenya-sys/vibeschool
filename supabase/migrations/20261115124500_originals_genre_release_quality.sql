-- Genre-aware Originals release checks. All non-Original curriculum checks remain unchanged.
-- Owner review and author publication authority are intentionally unmodified.
-- Rollback: restore public.ce_run_publication_release_check(uuid) from
-- supabase/migrations/20261109122500_mumbi2_release_gate_consistency.sql.
CREATE OR REPLACE FUNCTION public.ce_run_publication_release_check(p_publication_id uuid)
 RETURNS TABLE(check_code text, status text, score numeric, details jsonb)
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
declare ch record; wc int; oc int; rc int; td int; ib int; ab int; canonical_ai int; delivery_ai int; ai int; stale_derivatives int; research_blockers int; rights_blockers int; expected_interactive boolean; v_publication_status text; v_pub record; v_is_original boolean; v_total int; v_distinct_numbers int; v_min_number int; v_max_number int; v_block_count int; v_text_blocks int; v_distinct_ids int; v_invalid_blocks int; v_unsafe_blocks int; v_actual_words int; v_text text; v_stale_derivatives int;
begin
 if current_user not in ('service_role','postgres') and not public.is_platform_owner() then raise exception 'HQ platform owner required'; end if;
 select vp.status into v_publication_status from public.vibe_publications vp where vp.id=p_publication_id; if not found then raise exception 'Publication not found'; end if;
 select vp.* into v_pub from public.vibe_publications vp where vp.id=p_publication_id;
 v_is_original:=
   v_pub.format='ebook'
   and v_pub.genre in ('fiction','children','romance','thriller','biography','poetry','self_help')
   and not coalesce(v_pub.cbc_aligned,false)
   and nullif(btrim(coalesce(v_pub.cbc_subject,'')),'') is null
   and nullif(btrim(coalesce(v_pub.cbc_grade,'')),'') is null
   and not exists (
     select 1 from public.vibe_chapters vc
     join public.chapter_learning_outcome_links cl on cl.chapter_id=vc.id
     where vc.publication_id=p_publication_id
   );
 delete from public.publication_release_checks where publication_id=p_publication_id;
 select count(*) into research_blockers
 from public.curriculum_intelligence_proposals cip
 left join lateral (
   select crj.status research_status,crj.evidence_score
   from public.curriculum_research_jobs crj
   where crj.proposal_id=cip.id order by crj.created_at desc limit 1
 ) latest on true
 where cip.publication_id=p_publication_id
   and cip.status in ('pending_review','approved')
   and (cip.verification_status<>'verified' or coalesce(latest.research_status,'missing')<>'evidence_ready' or coalesce(latest.evidence_score,0)<.80);
 select count(*) into rights_blockers
 from public.curriculum_content_rights ccr
 join public.curriculum_intelligence_proposals cip on cip.id=ccr.proposal_id
 where cip.publication_id=p_publication_id and ccr.rights_class='unknown_review_required';
 insert into public.publication_release_checks(publication_id,chapter_id,check_code,status,score,details) values
 (p_publication_id,null,'research_evidence',case when research_blockers=0 then 'pass' else 'fail' end,case when research_blockers=0 then 100 else 0 end,jsonb_build_object('blocking_proposals',research_blockers,'minimum_evidence_score',0.80)),
 (p_publication_id,null,'rights_clearance',case when rights_blockers=0 then 'pass' else 'fail' end,case when rights_blockers=0 then 100 else 0 end,jsonb_build_object('unknown_rights_sources',rights_blockers));

 -- Noncurricular Originals are books, not curriculum outcome packages.
 -- Preserve eight independent checks/chapter + two global checks so the
 -- authenticated owner review, content fingerprint and publish gates stay intact.
 if v_is_original then
   select count(*),count(distinct number),min(number),max(number)
     into v_total,v_distinct_numbers,v_min_number,v_max_number
     from public.vibe_chapters where publication_id=p_publication_id;

   for ch in select vc.* from public.vibe_chapters vc where vc.publication_id=p_publication_id order by vc.number,vc.id loop
     -- Always inspect the actual reader blocks, not a claimed word count.
     select count(*),
            count(*) filter(where value->>'type' in ('paragraph','heading1','heading2','heading3','quote','bulletList','numberedList')
                             and nullif(btrim(coalesce(value->>'content','')),'') is not null),
            count(distinct nullif(btrim(coalesce(value->>'id','')),'')),
            count(*) filter(where nullif(btrim(coalesce(value->>'id','')),'') is null
                             or nullif(btrim(coalesce(value->>'content','')),'') is null
                             or coalesce(value->>'type','') not in
                               ('paragraph','heading1','heading2','heading3','quote','bulletList','numberedList','divider','image')
                             or (value->>'type'='image' and not (
                                 (value->>'content') ~ '^https://[^[:space:]]+
  wc:=coalesce(ch.word_count,0);
  select count(*) filter(where cb.block_type='interactive'),count(*) filter(where cb.is_assessable) into ib,ab from public.content_blocks cb where cb.chapter_id=ch.id and (cb.status='published' or (v_publication_status='draft' and cb.status='draft'));
  select count(*) into oc from public.chapter_learning_outcome_links cl where cl.chapter_id=ch.id;
  select count(*) into rc from public.learning_resources lr where lr.chapter_id=ch.id and lr.status='active';
  select count(*) into td from public.content_derivatives cd where cd.source_chapter_id=ch.id and cd.audience='teacher' and cd.status='approved';
  select count(*) into stale_derivatives from public.content_derivatives cd where cd.source_chapter_id=ch.id and cd.status='stale';
  select count(distinct gai.id) into canonical_ai
  from public.generated_assessment_items gai
  join public.generated_assessments ga on ga.id=gai.assessment_id
  join public.content_assessment_blueprints cab on cab.id=ga.blueprint_id
  join public.content_assessment_sources cas on cas.blueprint_id=cab.id
  join public.learning_resources lr on lr.id=cas.resource_id
  where lr.chapter_id=ch.id and lr.publication_id=p_publication_id
    and ga.status in ('approved','published')
    and gai.source_block_id in (select cb.id from public.content_blocks cb where cb.chapter_id=ch.id and (cb.status='published' or (v_publication_status='draft' and cb.status='draft')));
  select count(*) into delivery_ai from public.assessment_items aii
  where aii.source_block_id in (select cb.id from public.content_blocks cb where cb.chapter_id=ch.id and (cb.status='published' or (v_publication_status='draft' and cb.status='draft'))) and aii.status='approved';
  ai:=canonical_ai+delivery_ai;
  expected_interactive:=exists(select 1 from public.content_blocks cb where cb.chapter_id=ch.id and (cb.status='published' or (v_publication_status='draft' and cb.status='draft')) and cb.block_type='interactive') or coalesce(ch.blocks,'[]'::jsonb)::text ~* 'interactive|simulation|lab|experiment|diagram';
  insert into public.publication_release_checks(publication_id,chapter_id,check_code,status,score,details) values
  (p_publication_id,ch.id,'depth',case when wc>=1200 then 'pass' when wc>=900 then 'warn' else 'fail' end,least(100,wc/12.0),jsonb_build_object('word_count',wc,'target',1200)),
  (p_publication_id,ch.id,'curriculum_outcomes',case when oc>0 then 'pass' else 'fail' end,case when oc>0 then 100 else 0 end,jsonb_build_object('mapped_outcomes',oc)),
  (p_publication_id,ch.id,'canonical_resource',case when rc>0 then 'pass' else 'fail' end,case when rc>0 then 100 else 0 end,jsonb_build_object('active_resources',rc)),
  (p_publication_id,ch.id,'teacher_guide',case when td>0 then 'pass' else 'fail' end,case when td>0 then 100 else 0 end,jsonb_build_object('approved_teacher_derivatives',td)),
  (p_publication_id,ch.id,'assessment',case when ai>=6 then 'pass' when ai>=3 then 'warn' else 'fail' end,least(100,ai*100.0/6),jsonb_build_object('canonical_approved_items',canonical_ai,'delivery_approved_items',delivery_ai,'target',6)),
  (p_publication_id,ch.id,'interactive',case when expected_interactive and ib=0 then 'fail' when ib>0 then 'pass' else 'warn' end,case when ib>0 then 100 when expected_interactive then 0 else 70 end,jsonb_build_object('published_interactive_blocks',ib,'expected_from_content',expected_interactive)),
  (p_publication_id,ch.id,'assessable_blocks',case when ab>=2 then 'pass' else 'fail' end,least(100,ab*50.0),jsonb_build_object('published_assessable_blocks',ab,'target',2)),
  (p_publication_id,ch.id,'derivative_freshness',case when stale_derivatives=0 then 'pass' else 'fail' end,case when stale_derivatives=0 then 100 else 0 end,jsonb_build_object('stale_derivatives',stale_derivatives));
 end loop;
 return query select prc.check_code,prc.status,prc.score,prc.details from public.publication_release_checks prc where prc.publication_id=p_publication_id order by prc.chapter_id nulls first,prc.check_code;
end $function$

                                 or (value->>'content') ~ '^/[A-Za-z0-9]'
                               ))),
            count(*) filter(where coalesce(value->>'content','') ~*
                 '<[[:space:]]*(script|iframe|object|embed|svg|form|input)([[:space:]>])|on[a-z]+[[:space:]]*=|javascript:|data:text/html')
       into v_block_count,v_text_blocks,v_distinct_ids,v_invalid_blocks,v_unsafe_blocks
       from jsonb_array_elements(case when jsonb_typeof(ch.blocks)='array' then ch.blocks else '[]'::jsonb end);

     select coalesce(string_agg(coalesce(value->>'content',''),' ' order by ord),'')
       into v_text
       from jsonb_array_elements(case when jsonb_typeof(ch.blocks)='array' then ch.blocks else '[]'::jsonb end)
         with ordinality as b(value,ord)
       where value->>'type' in ('paragraph','heading1','heading2','heading3','quote','bulletList','numberedList');
     select count(*) into v_actual_words
       from regexp_split_to_table(btrim(regexp_replace(v_text,'<[^>]+>',' ','g')),'[[:space:]]+') t(word)
       where t.word <> '';
     select count(*) into v_stale_derivatives
       from public.content_derivatives d where d.source_chapter_id=ch.id and d.status='stale';

     insert into public.publication_release_checks(publication_id,chapter_id,check_code,status,score,details) values
       (p_publication_id,ch.id,'depth',
        case when v_actual_words>=100 and v_text_blocks>=3 then 'pass' else 'fail' end,
        case when v_actual_words>=100 and v_text_blocks>=3 then 100 else 0 end,
        jsonb_build_object('actual_words',v_actual_words,'minimum_words',100,'readable_blocks',v_text_blocks)),
       (p_publication_id,ch.id,'chapter_structure',
        case when v_total>0 and v_total=v_pub.chapter_count
                and v_distinct_numbers=v_total and v_min_number=1 and v_max_number=v_total
                and nullif(btrim(coalesce(ch.title,'')),'') is not null then 'pass' else 'fail' end,
        case when v_total>0 and v_total=v_pub.chapter_count
                and v_distinct_numbers=v_total and v_min_number=1 and v_max_number=v_total
                and nullif(btrim(coalesce(ch.title,'')),'') is not null then 100 else 0 end,
        jsonb_build_object('chapter_number',ch.number,'chapters',v_total,'declared_chapters',v_pub.chapter_count)),
       (p_publication_id,ch.id,'readable_blocks',
        case when v_block_count>=3 and v_text_blocks>=3 and v_invalid_blocks=0 then 'pass' else 'fail' end,
        case when v_block_count>=3 and v_text_blocks>=3 and v_invalid_blocks=0 then 100 else 0 end,
        jsonb_build_object('blocks',v_block_count,'readable',v_text_blocks,'invalid',v_invalid_blocks)),
       (p_publication_id,ch.id,'block_identity',
        case when v_block_count>=3 and v_distinct_ids=v_block_count then 'pass' else 'fail' end,
        case when v_block_count>=3 and v_distinct_ids=v_block_count then 100 else 0 end,
        jsonb_build_object('blocks',v_block_count,'distinct_block_ids',v_distinct_ids)),
       (p_publication_id,ch.id,'content_safety',
        case when v_unsafe_blocks=0 then 'pass' else 'fail' end,
        case when v_unsafe_blocks=0 then 100 else 0 end,
        jsonb_build_object('unsafe_blocks',v_unsafe_blocks)),
       (p_publication_id,ch.id,'word_count_accuracy',
        case when abs(coalesce(ch.word_count,0)-v_actual_words)
                  <= greatest(20,ceil(v_actual_words*0.20)) and v_actual_words>=100
                  and coalesce(ch.reading_time_min,0)>=1 then 'pass' else 'fail' end,
        case when abs(coalesce(ch.word_count,0)-v_actual_words)
                  <= greatest(20,ceil(v_actual_words*0.20)) and v_actual_words>=100
                  and coalesce(ch.reading_time_min,0)>=1 then 100 else 0 end,
        jsonb_build_object('declared',ch.word_count,'actual',v_actual_words,'reading_time_min',ch.reading_time_min)),
       (p_publication_id,ch.id,'editorial_metadata',
        case when length(btrim(coalesce(v_pub.title,'')))>=6
                  and length(btrim(coalesce(v_pub.description,'')))>=80
                  and v_pub.author_id is not null
                  and v_pub.language in ('en','sw','mixed')
                  and coalesce(v_pub.pricing->>'type','') in ('free','paid','freemium','donation','school_license')
                  then 'pass' else 'fail' end,
        case when length(btrim(coalesce(v_pub.title,'')))>=6
                  and length(btrim(coalesce(v_pub.description,'')))>=80
                  and v_pub.author_id is not null
                  and v_pub.language in ('en','sw','mixed')
                  and coalesce(v_pub.pricing->>'type','') in ('free','paid','freemium','donation','school_license')
                  then 100 else 0 end,
        jsonb_build_object('genre',v_pub.genre,'format',v_pub.format,'curriculum_aligned',v_pub.cbc_aligned)),
       (p_publication_id,ch.id,'derivative_freshness',
        case when v_stale_derivatives=0 then 'pass' else 'fail' end,
        case when v_stale_derivatives=0 then 100 else 0 end,
        jsonb_build_object('stale_derivatives',v_stale_derivatives));
   end loop;
   return query select prc.check_code,prc.status,prc.score,prc.details
     from public.publication_release_checks prc
     where prc.publication_id=p_publication_id
     order by prc.chapter_id nulls first,prc.check_code;
   return;
 end if;
 for ch in select vc.* from public.vibe_chapters vc where vc.publication_id=p_publication_id order by vc.number loop
  wc:=coalesce(ch.word_count,0);
  select count(*) filter(where cb.block_type='interactive'),count(*) filter(where cb.is_assessable) into ib,ab from public.content_blocks cb where cb.chapter_id=ch.id and (cb.status='published' or (v_publication_status='draft' and cb.status='draft'));
  select count(*) into oc from public.chapter_learning_outcome_links cl where cl.chapter_id=ch.id;
  select count(*) into rc from public.learning_resources lr where lr.chapter_id=ch.id and lr.status='active';
  select count(*) into td from public.content_derivatives cd where cd.source_chapter_id=ch.id and cd.audience='teacher' and cd.status='approved';
  select count(*) into stale_derivatives from public.content_derivatives cd where cd.source_chapter_id=ch.id and cd.status='stale';
  select count(distinct gai.id) into canonical_ai
  from public.generated_assessment_items gai
  join public.generated_assessments ga on ga.id=gai.assessment_id
  join public.content_assessment_blueprints cab on cab.id=ga.blueprint_id
  join public.content_assessment_sources cas on cas.blueprint_id=cab.id
  join public.learning_resources lr on lr.id=cas.resource_id
  where lr.chapter_id=ch.id and lr.publication_id=p_publication_id
    and ga.status in ('approved','published')
    and gai.source_block_id in (select cb.id from public.content_blocks cb where cb.chapter_id=ch.id and (cb.status='published' or (v_publication_status='draft' and cb.status='draft')));
  select count(*) into delivery_ai from public.assessment_items aii
  where aii.source_block_id in (select cb.id from public.content_blocks cb where cb.chapter_id=ch.id and (cb.status='published' or (v_publication_status='draft' and cb.status='draft'))) and aii.status='approved';
  ai:=canonical_ai+delivery_ai;
  expected_interactive:=exists(select 1 from public.content_blocks cb where cb.chapter_id=ch.id and (cb.status='published' or (v_publication_status='draft' and cb.status='draft')) and cb.block_type='interactive') or coalesce(ch.blocks,'[]'::jsonb)::text ~* 'interactive|simulation|lab|experiment|diagram';
  insert into public.publication_release_checks(publication_id,chapter_id,check_code,status,score,details) values
  (p_publication_id,ch.id,'depth',case when wc>=1200 then 'pass' when wc>=900 then 'warn' else 'fail' end,least(100,wc/12.0),jsonb_build_object('word_count',wc,'target',1200)),
  (p_publication_id,ch.id,'curriculum_outcomes',case when oc>0 then 'pass' else 'fail' end,case when oc>0 then 100 else 0 end,jsonb_build_object('mapped_outcomes',oc)),
  (p_publication_id,ch.id,'canonical_resource',case when rc>0 then 'pass' else 'fail' end,case when rc>0 then 100 else 0 end,jsonb_build_object('active_resources',rc)),
  (p_publication_id,ch.id,'teacher_guide',case when td>0 then 'pass' else 'fail' end,case when td>0 then 100 else 0 end,jsonb_build_object('approved_teacher_derivatives',td)),
  (p_publication_id,ch.id,'assessment',case when ai>=6 then 'pass' when ai>=3 then 'warn' else 'fail' end,least(100,ai*100.0/6),jsonb_build_object('canonical_approved_items',canonical_ai,'delivery_approved_items',delivery_ai,'target',6)),
  (p_publication_id,ch.id,'interactive',case when expected_interactive and ib=0 then 'fail' when ib>0 then 'pass' else 'warn' end,case when ib>0 then 100 when expected_interactive then 0 else 70 end,jsonb_build_object('published_interactive_blocks',ib,'expected_from_content',expected_interactive)),
  (p_publication_id,ch.id,'assessable_blocks',case when ab>=2 then 'pass' else 'fail' end,least(100,ab*50.0),jsonb_build_object('published_assessable_blocks',ab,'target',2)),
  (p_publication_id,ch.id,'derivative_freshness',case when stale_derivatives=0 then 'pass' else 'fail' end,case when stale_derivatives=0 then 100 else 0 end,jsonb_build_object('stale_derivatives',stale_derivatives));
 end loop;
 return query select prc.check_code,prc.status,prc.score,prc.details from public.publication_release_checks prc where prc.publication_id=p_publication_id order by prc.chapter_id nulls first,prc.check_code;
end $function$
;
