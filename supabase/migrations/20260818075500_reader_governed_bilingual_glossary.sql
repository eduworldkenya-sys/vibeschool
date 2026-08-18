begin;

-- Reader glossary authority: explanations are editorial/source-governed content,
-- never generated ad hoc by the reader. Direct table access stays closed; readers
-- use the entitlement-aware lookup RPC only.

create table if not exists public.vibe_reader_glossary_terms (
  id uuid primary key default gen_random_uuid(),
  publication_id uuid references public.vibe_publications(id) on delete cascade,
  chapter_id uuid references public.vibe_chapters(id) on delete cascade,
  term text not null,
  normalized_term text not null,
  definition_en text not null,
  term_sw text,
  explanation_sw text,
  source_label text not null,
  source_url text,
  source_kind text not null default 'editorial'
    check (source_kind in ('kicd','publisher','editorial','reference')),
  status text not null default 'draft'
    check (status in ('draft','published','retired')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (length(btrim(term)) between 1 and 160),
  check (normalized_term = lower(btrim(term))),
  check (length(btrim(definition_en)) between 1 and 5000),
  check (term_sw is null or length(btrim(term_sw)) between 1 and 160),
  check (explanation_sw is null or length(btrim(explanation_sw)) between 1 and 5000),
  check (length(btrim(source_label)) between 1 and 500),
  check (source_url is null or length(source_url) <= 2000),
  check (chapter_id is null or publication_id is not null)
);

create index if not exists vibe_reader_glossary_lookup_idx
  on public.vibe_reader_glossary_terms (normalized_term, status, publication_id, chapter_id);

alter table public.vibe_reader_glossary_terms enable row level security;

revoke all on table public.vibe_reader_glossary_terms from public, anon, authenticated;
grant all on table public.vibe_reader_glossary_terms to service_role;

create or replace function public.get_reader_term_explanation(
  p_chapter_id uuid,
  p_term text
)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $function$
declare
  v_viewer_id uuid := auth.uid();
  v_publication_id uuid;
  v_term text := lower(btrim(coalesce(p_term, '')));
  v_item public.vibe_reader_glossary_terms%rowtype;
begin
  if p_chapter_id is null or length(v_term) < 1 or length(v_term) > 160 then
    return jsonb_build_object('ok', false, 'reason', 'invalid_input');
  end if;

  select c.publication_id
  into v_publication_id
  from public.vibe_chapters c
  where c.id = p_chapter_id;

  if v_publication_id is null then
    return jsonb_build_object('ok', false, 'reason', 'chapter_not_found');
  end if;

  if not public.can_viewer_read_chapter(p_chapter_id, v_viewer_id) then
    return jsonb_build_object('ok', false, 'reason', 'not_entitled');
  end if;

  select g.*
  into v_item
  from public.vibe_reader_glossary_terms g
  where g.status = 'published'
    and g.normalized_term = v_term
    and (g.publication_id is null or g.publication_id = v_publication_id)
    and (g.chapter_id is null or g.chapter_id = p_chapter_id)
  order by
    case when g.chapter_id = p_chapter_id then 0 else 1 end,
    case when g.publication_id = v_publication_id then 0 else 1 end,
    g.updated_at desc
  limit 1;

  if not found then
    return jsonb_build_object(
      'ok', true,
      'found', false,
      'term', p_term,
      'reason', 'no_verified_definition'
    );
  end if;

  return jsonb_strip_nulls(jsonb_build_object(
    'ok', true,
    'found', true,
    'term', v_item.term,
    'definition_en', v_item.definition_en,
    'term_sw', v_item.term_sw,
    'explanation_sw', v_item.explanation_sw,
    'source_label', v_item.source_label,
    'source_url', v_item.source_url,
    'source_kind', v_item.source_kind,
    'updated_at', v_item.updated_at
  ));
end;
$function$;

revoke all on function public.get_reader_term_explanation(uuid,text)
  from public, anon, authenticated;
grant execute on function public.get_reader_term_explanation(uuid,text)
  to anon, authenticated, service_role;

comment on table public.vibe_reader_glossary_terms is
'Governed English/Kiswahili reader glossary. Published rows require explicit source attribution; reader clients have no direct table access.';

comment on function public.get_reader_term_explanation(uuid,text) is
'Entitlement-aware exact-term glossary lookup. Returns only published, source-attributed editorial definitions; never fabricates a translation or explanation.';

commit;
