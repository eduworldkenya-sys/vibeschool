-- Real operator controls for valuable legacy HQ Studio concepts.

create table if not exists public.hq_content_domains (
  key text primary key,
  name text not null,
  icon text,
  description text,
  tags text[] not null default '{}',
  active boolean not null default true,
  sort_order integer not null default 100,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
alter table public.hq_content_domains enable row level security;
revoke all on table public.hq_content_domains from anon;
revoke insert,update,delete,truncate,references,trigger on table public.hq_content_domains from authenticated;
grant select on table public.hq_content_domains to authenticated;
drop policy if exists hq_content_domains_owner_select on public.hq_content_domains;
create policy hq_content_domains_owner_select on public.hq_content_domains for select to authenticated using (public.is_platform_owner());

insert into public.hq_content_domains(key,name,icon,description,tags,sort_order) values
 ('health','Health','🏥','Health sciences and care pathways',array['health','medicine','nursing'],10),
 ('trade','Trade','🔧','Technical, vocational and skilled-trade learning',array['trade','tveta','technical'],20),
 ('education','Education','🎓','School curriculum, teacher and academic learning',array['education','curriculum','school'],30),
 ('transportation','Transportation','🚦','Driving, road safety and transport learning',array['transport','driving','road-safety'],40),
 ('technology','Technology','💻','Computing, engineering and digital skills',array['technology','computing','digital'],50)
on conflict(key) do nothing;

create or replace function public.hq_list_content_domains()
returns setof public.hq_content_domains language plpgsql security definer set search_path=public as $$
begin perform public.hq_assert_owner(); return query select * from public.hq_content_domains order by sort_order,name; end $$;

create or replace function public.hq_upsert_content_domain(p_key text,p_name text,p_icon text default null,p_description text default null,p_tags text[] default '{}',p_active boolean default true,p_sort_order integer default 100)
returns text language plpgsql security definer set search_path=public as $$
declare v_key text:=lower(regexp_replace(btrim(coalesce(p_key,'')),'[^a-zA-Z0-9]+','-','g')); begin
 perform public.hq_assert_owner(); if v_key='' or nullif(btrim(coalesce(p_name,'')),'') is null then raise exception 'Domain key and name are required'; end if;
 insert into public.hq_content_domains(key,name,icon,description,tags,active,sort_order,updated_at) values(v_key,btrim(p_name),nullif(btrim(coalesce(p_icon,'')),''),nullif(btrim(coalesce(p_description,'')),''),coalesce(p_tags,'{}'),p_active,p_sort_order,now())
 on conflict(key) do update set name=excluded.name,icon=excluded.icon,description=excluded.description,tags=excluded.tags,active=excluded.active,sort_order=excluded.sort_order,updated_at=now(); return v_key; end $$;

create or replace function public.hq_list_curriculum_rows(p_limit integer default 300)
returns table(id uuid,curriculum text,grade text,subject text,term integer,week integer,strand text,sub_strand text,topic text,periods integer,reference text,lesson_context jsonb)
language plpgsql security definer set search_path=public as $$
begin perform public.hq_assert_owner(); return query select c.id,c.curriculum,c.grade,c.subject,c.term,c.week,c.strand,c.sub_strand,c.topic,c.periods,c.reference,cc.lesson_context from curriculum c left join lateral (select x.lesson_context from curriculum_content x where x.curriculum_id=c.id order by x.updated_at desc nulls last limit 1) cc on true order by c.grade,c.subject,c.term,c.week,c.strand,c.sub_strand limit least(greatest(p_limit,1),1000); end $$;

create or replace function public.hq_update_curriculum_row(p_id uuid,p_topic text default null,p_periods integer default null,p_reference text default null,p_teaching_tips text default null,p_common_mistakes text default null)
returns void language plpgsql security definer set search_path=public as $$
declare v_ctx jsonb; begin
 perform public.hq_assert_owner(); update curriculum set topic=coalesce(nullif(btrim(coalesce(p_topic,'')),''),topic),periods=coalesce(p_periods,periods),reference=coalesce(nullif(btrim(coalesce(p_reference,'')),''),reference) where id=p_id; if not found then raise exception 'Curriculum row not found'; end if;
 if p_teaching_tips is not null or p_common_mistakes is not null then
   select coalesce(lesson_context,'{}'::jsonb) into v_ctx from curriculum_content where curriculum_id=p_id order by updated_at desc nulls last limit 1;
   v_ctx:=coalesce(v_ctx,'{}'::jsonb)||jsonb_strip_nulls(jsonb_build_object('teaching_tips',nullif(btrim(coalesce(p_teaching_tips,'')),''),'common_mistakes',nullif(btrim(coalesce(p_common_mistakes,'')),'')));
   insert into curriculum_content(curriculum_id,lesson_context,source,source_type,status,author_id) values(p_id,v_ctx,'hq','creator_claimed','confirmed',auth.uid())
   on conflict do nothing;
   update curriculum_content set lesson_context=v_ctx,updated_at=now() where id=(select id from curriculum_content where curriculum_id=p_id order by updated_at desc nulls last limit 1);
 end if; end $$;

create or replace function public.hq_add_curriculum_outcome(p_curriculum_id uuid,p_outcome_text text,p_bloom_level text default null)
returns uuid language plpgsql security definer set search_path=public as $$
declare v_id uuid; begin perform public.hq_assert_owner(); if nullif(btrim(coalesce(p_outcome_text,'')),'') is null then raise exception 'Outcome text is required'; end if; insert into curriculum_learning_outcomes(curriculum_id,outcome_text,source_type,status,created_by,bloom_level) values(p_curriculum_id,btrim(p_outcome_text),'creator_claimed','draft',auth.uid(),p_bloom_level) returning id into v_id; return v_id; end $$;

create or replace function public.hq_create_assessment_question(p_curriculum_id uuid,p_question_text text,p_question_type text default 'written',p_difficulty text default 'medium',p_marks numeric default 1,p_bloom_level text default null,p_correct_answer text default null,p_explanation text default null)
returns uuid language plpgsql security definer set search_path=public as $$
declare v_id uuid; begin
 perform public.hq_assert_owner(); if not exists(select 1 from curriculum where id=p_curriculum_id) then raise exception 'Curriculum row not found'; end if; if nullif(btrim(coalesce(p_question_text,'')),'') is null then raise exception 'Question text is required'; end if;
 insert into assessment_questions(curriculum_id,question_text,question_type,difficulty,marks,bloom_level,correct_answer,explanation,source_type,status,review_status,author_id)
 values(p_curriculum_id,btrim(p_question_text),p_question_type,p_difficulty,p_marks,p_bloom_level,nullif(btrim(coalesce(p_correct_answer,'')),''),nullif(btrim(coalesce(p_explanation,'')),''),'hq','draft','draft',auth.uid()) returning id into v_id; return v_id; end $$;

create or replace function public.hq_review_assessment_question(p_question_id uuid,p_review_status text)
returns void language plpgsql security definer set search_path=public as $$
begin perform public.hq_assert_owner(); if p_review_status not in ('draft','review','approved','rejected','retired') then raise exception 'Invalid review status'; end if; update assessment_questions set review_status=p_review_status,reviewed_by=case when p_review_status in ('approved','rejected','retired') then auth.uid() else reviewed_by end,reviewed_at=case when p_review_status in ('approved','rejected','retired') then now() else reviewed_at end,updated_at=now() where id=p_question_id; if not found then raise exception 'Question not found'; end if; end $$;

revoke all on function public.hq_list_content_domains() from public,anon;
revoke all on function public.hq_upsert_content_domain(text,text,text,text,text[],boolean,integer) from public,anon;
revoke all on function public.hq_list_curriculum_rows(integer) from public,anon;
revoke all on function public.hq_update_curriculum_row(uuid,text,integer,text,text,text) from public,anon;
revoke all on function public.hq_add_curriculum_outcome(uuid,text,text) from public,anon;
revoke all on function public.hq_create_assessment_question(uuid,text,text,text,numeric,text,text,text) from public,anon;
revoke all on function public.hq_review_assessment_question(uuid,text) from public,anon;
grant execute on function public.hq_list_content_domains() to authenticated;
grant execute on function public.hq_upsert_content_domain(text,text,text,text,text[],boolean,integer) to authenticated;
grant execute on function public.hq_list_curriculum_rows(integer) to authenticated;
grant execute on function public.hq_update_curriculum_row(uuid,text,integer,text,text,text) to authenticated;
grant execute on function public.hq_add_curriculum_outcome(uuid,text,text) to authenticated;
grant execute on function public.hq_create_assessment_question(uuid,text,text,text,numeric,text,text,text) to authenticated;
grant execute on function public.hq_review_assessment_question(uuid,text) to authenticated;
