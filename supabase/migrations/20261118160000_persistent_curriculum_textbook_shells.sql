begin;
-- Extend the existing publication identity; no new content store or publication authority.
alter table public.vibe_publications
 add column if not exists curriculum_shell_key text,
 add column if not exists curriculum_shell_subject_id uuid references public.subjects(id) on delete restrict;
create unique index if not exists vibe_publications_curriculum_shell_identity
 on public.vibe_publications(author_id, cbc_grade, curriculum_shell_key)
 where curriculum_shell_key is not null;

-- authorization-test: ensure_curriculum_textbook_shell is SECURITY INVOKER and author-scoped.
-- A draft may exist with zero chapters and no mapped subject. No release occurs here.
create or replace function public.ensure_curriculum_textbook_shell(
 p_grade text, p_subject text, p_connect boolean default true, p_author_id uuid default null
) returns jsonb language plpgsql security invoker set search_path = '' as $$
declare
 v_uid uuid := coalesce(auth.uid(),p_author_id);
 v_grade text := regexp_replace(lower(btrim(coalesce(p_grade,''))), '[[:space:]]+', '', 'g');
 v_display_grade text;
 v_subject text := regexp_replace(btrim(coalesce(p_subject,'')), '[[:space:]]+', ' ', 'g');
 v_key text;
 v_subject_id uuid;
 v_matching_subjects integer;
 v_book public.vibe_publications%rowtype;
 v_number integer;
 v_added integer := 0;
 v_count integer;
 unit record;
begin
 -- Existing privileged SQL operators may explicitly identify an eligible author. No browser impersonation.
 if (auth.uid() is null and current_user <> 'postgres') or
    (auth.uid() is not null and p_author_id is not null and p_author_id <> auth.uid()) then
  raise exception 'textbook_author_required' using errcode='42501';
 end if;
 if v_uid is null or not exists(select 1 from public.profiles where id=v_uid and role in ('teacher','admin')) then
  raise exception 'textbook_author_required' using errcode='42501';
 end if;
 if v_grade ~ '^grade([1-9]|1[012])$' then v_display_grade := 'Grade ' || substring(v_grade from 6);
 elsif v_grade ~ '^form[1-4]$' then v_display_grade := 'Form ' || substring(v_grade from 5);
 elsif v_grade in ('pp1','pp2') then v_display_grade := upper(v_grade);
 elsif v_grade='playgroup' then v_display_grade := 'Playgroup';
 else raise exception 'invalid_school_grade'; end if;
 if v_subject='' or length(v_subject)>160 then raise exception 'invalid_subject_label'; end if;
 v_key := lower(v_subject);
 perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(v_uid::text || ':' || v_grade || ':' || v_key,0));
 select * into v_book from public.vibe_publications
 where author_id=v_uid and cbc_grade=v_grade and curriculum_shell_key=v_key for update;
 if not found then
  insert into public.vibe_publications(author_id,format,title,genre,status,cbc_grade,cbc_subject,cbc_aligned,curriculum_framework,curriculum_shell_key,chapter_count,tags)
  values(v_uid,'vibetextbook',v_display_grade || ' ' || v_subject,'academic','draft',v_grade,v_subject,false,'CBC',v_key,0,array['VibeSchool Originals'])
  returning * into v_book;
 end if;
 if not p_connect or v_book.status <> 'draft' then
  return jsonb_build_object('publication_id',v_book.id,'status',v_book.status,'connected',v_book.curriculum_shell_subject_id is not null,'added',0,'chapters',v_book.chapter_count);
 end if;
 v_subject_id := v_book.curriculum_shell_subject_id;
 if v_subject_id is null then
  -- Never silently map a religious option to generic Religious Education, or guess a subject.
  select count(*) into v_matching_subjects from public.subjects s where s.school_id is null and lower(regexp_replace(btrim(s.name),'[[:space:]]+',' ','g'))=v_key;
  if v_matching_subjects=1 then
   select s.id into v_subject_id from public.subjects s where s.school_id is null and lower(regexp_replace(btrim(s.name),'[[:space:]]+',' ','g'))=v_key;
  end if;
 end if;
 if v_subject_id is not null then
  update public.vibe_publications set curriculum_shell_subject_id=v_subject_id where id=v_book.id;
  select coalesce(max(number),0) into v_number from public.vibe_chapters where publication_id=v_book.id;
  -- The existing chapter row has one canonical sub-strand FK. Chapters are grouped by cbc_strand.
  -- Unpaced, unique canonical identities only; never invent or choose between duplicate mappings.
  for unit in
   select c.id,c.name,c.sub_strand
   from public.cbc_strands c
   where c.subject_id=v_subject_id and c.grade=v_display_grade and c.term is null and c.week is null
     and not exists(select 1 from public.cbc_strands d where d.id<>c.id and d.subject_id=c.subject_id and d.grade=c.grade
       and d.term is null and d.week is null and lower(btrim(d.name))=lower(btrim(c.name))
       and lower(btrim(coalesce(d.sub_strand,'')))=lower(btrim(coalesce(c.sub_strand,''))))
   order by c.strand_order nulls last,c.sub_strand_order nulls last,c.name,c.sub_strand,c.id
  loop
   if not exists(select 1 from public.vibe_chapters where publication_id=v_book.id and sub_strand_id=unit.id) then
    v_number := v_number+1;
    insert into public.vibe_chapters(publication_id,title,number,blocks,status,cbc_strand,sub_strand_id,alignment_status)
    values(v_book.id,coalesce(nullif(btrim(unit.sub_strand),''),unit.name),v_number,'[]'::jsonb,'draft',unit.name,unit.id,'unclaimed');
    v_added := v_added+1;
   end if;
  end loop;
 end if;
 select count(*) into v_count from public.vibe_chapters where publication_id=v_book.id;
 update public.vibe_publications set chapter_count=v_count,updated_at=now() where id=v_book.id;
 return jsonb_build_object('publication_id',v_book.id,'status',v_book.status,'connected',v_subject_id is not null,'added',v_added,'chapters',v_count);
end $$;
revoke all on function public.ensure_curriculum_textbook_shell(text,text,boolean,uuid) from public,anon;
grant execute on function public.ensure_curriculum_textbook_shell(text,text,boolean,uuid) to authenticated;

-- Empty structures cannot become released learning content through the existing all-chapter publication lifecycle.
-- A shell's identity remains stable; this guard does not change any legacy publication.
create or replace function public.guard_curriculum_textbook_shell() returns trigger
language plpgsql security invoker set search_path = '' as $$
begin
 if old.curriculum_shell_key is not null then
  if new.curriculum_shell_key is distinct from old.curriculum_shell_key or new.author_id is distinct from old.author_id
     or new.cbc_grade is distinct from old.cbc_grade or new.cbc_subject is distinct from old.cbc_subject
     or new.format is distinct from old.format
     or (old.curriculum_shell_subject_id is not null and new.curriculum_shell_subject_id is distinct from old.curriculum_shell_subject_id)
  then raise exception 'curriculum_textbook_shell_identity_immutable'; end if;
  if new.status='published' and old.status<>'published' and (
      not exists(select 1 from public.vibe_chapters c where c.publication_id=old.id)
      or exists(select 1 from public.vibe_chapters c where c.publication_id=old.id and
        not exists(select 1 from jsonb_array_elements(c.blocks) b where nullif(btrim(coalesce(b->>'content','')),'') is not null))
    ) then raise exception 'curriculum_textbook_shell_has_empty_sections'; end if;
 end if;
 return new;
end $$;
drop trigger if exists guard_curriculum_textbook_shell on public.vibe_publications;
create trigger guard_curriculum_textbook_shell before update on public.vibe_publications
 for each row execute function public.guard_curriculum_textbook_shell();
commit;
