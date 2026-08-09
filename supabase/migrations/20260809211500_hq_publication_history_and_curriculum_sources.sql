-- Owner-wide revision and curriculum-source visibility/review for HQ Studio.
create or replace function public.hq_list_publication_revisions(p_limit integer default 300)
returns table(id uuid,publication_id uuid,publication_title text,publication_format text,revision_number integer,reason text,created_by uuid,created_at timestamptz)
language plpgsql security definer set search_path=public as $$
begin perform public.hq_assert_owner(); return query select r.id,r.publication_id,p.title,p.format,r.revision_number,r.reason,r.created_by,r.created_at from publication_revisions r join vibe_publications p on p.id=r.publication_id order by r.created_at desc limit least(greatest(p_limit,1),1000); end $$;

create or replace function public.hq_list_curriculum_imports(p_limit integer default 300)
returns table(id uuid,created_by uuid,source_type text,authority_name text,source_url text,source_ref text,curriculum_name text,grade text,subject text,version_label text,status text,created_at timestamptz,updated_at timestamptz,verified_by uuid,verified_at timestamptz)
language plpgsql security definer set search_path=public as $$
begin perform public.hq_assert_owner(); return query select c.id,c.created_by,c.source_type,c.authority_name,c.source_url,c.source_ref,c.curriculum_name,c.grade,c.subject,c.version_label,c.status,c.created_at,c.updated_at,c.verified_by,c.verified_at from curriculum_imports c order by c.updated_at desc limit least(greatest(p_limit,1),1000); end $$;

create or replace function public.hq_register_curriculum_source(p_authority_name text,p_curriculum_name text,p_grade text,p_subject text,p_source_url text default null,p_source_ref text default null,p_version_label text default null,p_notes text default null)
returns uuid language plpgsql security definer set search_path=public as $$
declare v_id uuid; begin perform public.hq_assert_owner(); if nullif(btrim(coalesce(p_authority_name,'')),'') is null or nullif(btrim(coalesce(p_curriculum_name,'')),'') is null or nullif(btrim(coalesce(p_grade,'')),'') is null or nullif(btrim(coalesce(p_subject,'')),'') is null then raise exception 'Authority, curriculum, grade and subject are required'; end if; insert into curriculum_imports(created_by,source_type,authority_name,source_url,source_ref,curriculum_name,grade,subject,version_label,status,payload) values(auth.uid(),'official',btrim(p_authority_name),nullif(btrim(coalesce(p_source_url,'')),''),nullif(btrim(coalesce(p_source_ref,'')),''),btrim(p_curriculum_name),btrim(p_grade),btrim(p_subject),nullif(btrim(coalesce(p_version_label,'')),''),'draft',jsonb_build_object('notes',nullif(btrim(coalesce(p_notes,'')),''))) returning id into v_id; return v_id; end $$;

create or replace function public.hq_review_curriculum_import(p_id uuid,p_status text)
returns void language plpgsql security definer set search_path=public as $$
begin perform public.hq_assert_owner(); if p_status not in ('reviewed','verified','rejected') then raise exception 'Invalid review status'; end if; update curriculum_imports set status=p_status,verified_by=case when p_status='verified' then auth.uid() else verified_by end,verified_at=case when p_status='verified' then now() else verified_at end,updated_at=now() where id=p_id; if not found then raise exception 'Curriculum import not found'; end if; end $$;

revoke all on function public.hq_list_publication_revisions(integer) from public,anon;
revoke all on function public.hq_list_curriculum_imports(integer) from public,anon;
revoke all on function public.hq_register_curriculum_source(text,text,text,text,text,text,text,text) from public,anon;
revoke all on function public.hq_review_curriculum_import(uuid,text) from public,anon;
grant execute on function public.hq_list_publication_revisions(integer) to authenticated;
grant execute on function public.hq_list_curriculum_imports(integer) to authenticated;
grant execute on function public.hq_register_curriculum_source(text,text,text,text,text,text,text,text) to authenticated;
grant execute on function public.hq_review_curriculum_import(uuid,text) to authenticated;
