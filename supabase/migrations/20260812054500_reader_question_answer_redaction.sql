begin;

-- Keep the existing hardened reader implementations intact, but place a
-- learner-safe redaction boundary around their block payloads. Answer keys
-- remain authoritative in content_blocks for server scoring and are never
-- returned to the learner browser.

create or replace function public.reader_sanitize_blocks(p_blocks jsonb)
returns jsonb
language sql
immutable
set search_path = ''
as $function$
  select coalesce(
    jsonb_agg(
      case
        when jsonb_typeof(x.block) = 'object'
          and x.block->>'type' = 'question'
        then
          (x.block - 'meta') || jsonb_build_object(
            'content', btrim(split_part(coalesce(x.block->>'content',''), 'Answer:', 1)),
            'meta',
              case
                when jsonb_typeof(x.block->'meta') = 'object'
                then (x.block->'meta') - 'correctAnswer' - 'answer'
                else '{}'::jsonb
              end
          )
        else x.block
      end
      order by x.ord
    ),
    '[]'::jsonb
  )
  from jsonb_array_elements(
    case when jsonb_typeof(p_blocks) = 'array' then p_blocks else '[]'::jsonb end
  ) with ordinality as x(block, ord);
$function$;

revoke all on function public.reader_sanitize_blocks(jsonb) from public, anon, authenticated;
grant execute on function public.reader_sanitize_blocks(jsonb) to service_role;

alter function public.get_vibetextbook_reader(uuid) rename to get_vibetextbook_reader_raw;
alter function public.get_public_vibetextbook_reader(uuid) rename to get_public_vibetextbook_reader_raw;

revoke all on function public.get_vibetextbook_reader_raw(uuid) from public, anon, authenticated;
revoke all on function public.get_public_vibetextbook_reader_raw(uuid) from public, anon, authenticated;
grant execute on function public.get_vibetextbook_reader_raw(uuid) to service_role;
grant execute on function public.get_public_vibetextbook_reader_raw(uuid) to service_role;

create or replace function public.get_vibetextbook_reader(publication_id_input uuid)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $function$
declare
  payload jsonb;
  sanitized_chapters jsonb;
begin
  payload := public.get_vibetextbook_reader_raw(publication_id_input);
  if coalesce(payload->>'ok','false') <> 'true' then
    return payload;
  end if;

  select coalesce(
    jsonb_agg(
      case
        when jsonb_typeof(x.chapter->'blocks') = 'array'
        then x.chapter || jsonb_build_object('blocks', public.reader_sanitize_blocks(x.chapter->'blocks'))
        else x.chapter
      end
      order by x.ord
    ),
    '[]'::jsonb
  )
  into sanitized_chapters
  from jsonb_array_elements(coalesce(payload->'chapters','[]'::jsonb)) with ordinality as x(chapter, ord);

  return jsonb_set(payload, '{chapters}', sanitized_chapters, true);
end;
$function$;

revoke all on function public.get_vibetextbook_reader(uuid) from public, anon;
grant execute on function public.get_vibetextbook_reader(uuid) to authenticated, service_role;

create or replace function public.get_public_vibetextbook_reader(publication_id_input uuid)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $function$
declare
  payload jsonb;
  sanitized_chapters jsonb;
begin
  payload := public.get_public_vibetextbook_reader_raw(publication_id_input);
  if coalesce(payload->>'ok','false') <> 'true' then
    return payload;
  end if;

  select coalesce(
    jsonb_agg(
      case
        when jsonb_typeof(x.chapter->'blocks') = 'array'
        then x.chapter || jsonb_build_object('blocks', public.reader_sanitize_blocks(x.chapter->'blocks'))
        else x.chapter
      end
      order by x.ord
    ),
    '[]'::jsonb
  )
  into sanitized_chapters
  from jsonb_array_elements(coalesce(payload->'chapters','[]'::jsonb)) with ordinality as x(chapter, ord);

  return jsonb_set(payload, '{chapters}', sanitized_chapters, true);
end;
$function$;

revoke all on function public.get_public_vibetextbook_reader(uuid) from public;
grant execute on function public.get_public_vibetextbook_reader(uuid) to anon, authenticated, service_role;

commit;
