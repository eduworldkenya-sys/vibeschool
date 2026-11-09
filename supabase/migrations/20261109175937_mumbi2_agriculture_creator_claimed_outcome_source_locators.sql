-- VibeSchool editorial source trace for exactly the 43 creator-claimed
-- Form Four Agriculture outcomes linked to the existing Mumbi2 publication.
-- This is independent curriculum comparison, NOT formal KICD verification.
-- Preserve source_type, status, source_ref, verified_by, verified_at, and user work.
do $verify$
declare n int; changed int; missing int;
begin
  select count(*) into n
  from public.chapter_learning_outcome_links l
  join public.vibe_chapters c on c.id=l.chapter_id
  join public.vibe_publications p on p.id=c.publication_id
  join public.profiles pr on pr.id=p.author_id
  join public.curriculum_learning_outcomes o on o.id=l.outcome_id
  where pr.full_name='Mumbi2' and p.title='Vibe Agriculture Form 4'
    and o.source_type='creator_claimed' and o.status='draft'
    and o.source_ref=('chapter:'||c.id::text);
  if n=0 and not exists(select 1 from public.vibe_publications p
    join public.profiles pr on pr.id=p.author_id
    where pr.full_name='Mumbi2' and p.title='Vibe Agriculture Form 4') then
    return; -- clean rebuild, no tenant content
  end if;
  if n<>43 then raise exception 'Expected exactly 43 original creator claims; found %',n; end if;

  update public.curriculum_learning_outcomes o
     set source_locator = (
       'Editorial source comparison, NOT curriculum verified: Kenya revised secondary syllabus vol. 2, Agriculture Form Four unit '||
       case c.number
         when 1 then '27.1/27.2 (Poultry)'
         when 2 then '28.1/28.2 (Cattle)'
         when 3 then '29.1/29.2 (Farm Power & Machinery)'
         when 4 then '30.1/30.2 (Production Economics)'
         when 5 then '31.1/31.2 (Farm Accounts)'
         when 6 then '32.1/32.2 (Marketing and Organisations)'
         when 7 then '33.1/33.2 (Agroforestry)'
       end ||
       '; independently hosted syllabus copy: https://kcserevision.com/wp-content/uploads/2025/05/SYLLABUS-ORIGINAL-FOR-MATH-PHYSICS-CHEMISTRY-BIOLOGY-AGRICULTURE-HOME-SCIENCE.pdf'
     ),
     updated_at=now()
   from public.chapter_learning_outcome_links l
   join public.vibe_chapters c on c.id=l.chapter_id
   join public.vibe_publications p on p.id=c.publication_id
   join public.profiles pr on pr.id=p.author_id
   where o.id=l.outcome_id
     and pr.full_name='Mumbi2'
     and p.title='Vibe Agriculture Form 4'
     and c.number between 1 and 7
     and o.source_type='creator_claimed'
     and o.status='draft'
     and o.verified_by is null
     and o.verified_at is null
     and o.source_ref=('chapter:'||c.id::text)
     and o.source_locator is null;
  get diagnostics changed=row_count;
  if changed not in (0,43) then
     raise exception 'Unsafe partial trace update, changed only % of 43',changed;
  end if;

  select count(*) into missing
  from public.chapter_learning_outcome_links l
  join public.vibe_chapters c on c.id=l.chapter_id
  join public.vibe_publications p on p.id=c.publication_id
  join public.profiles pr on pr.id=p.author_id
  join public.curriculum_learning_outcomes o on o.id=l.outcome_id
  where pr.full_name='Mumbi2' and p.title='Vibe Agriculture Form 4'
    and o.source_type='creator_claimed' and o.status='draft'
    and o.source_locator not like 'Editorial source comparison, NOT curriculum verified:%';
  if missing<>0 then raise exception 'Incomplete trace, % missing',missing; end if;
end $verify$;