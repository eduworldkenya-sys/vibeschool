-- Preserve publication-release approval across private -> public media promotion.
-- The stable object path remains identical; only the bucket visibility changes.

create or replace function public.vibepress_media_fingerprint_value(p_value text)
returns text
language sql
immutable
set search_path = public, pg_temp
as $$
  select case
    when p_value is null then null
    when p_value like 'vibepress-draft://%' then substring(p_value from length('vibepress-draft://') + 1)
    when p_value like '%/storage/v1/object/public/vibe-publication-images/%'
      then split_part(p_value, '/storage/v1/object/public/vibe-publication-images/', 2)
    when p_value like '%/storage/v1/object/public/vibe-publication-covers/%'
      then split_part(p_value, '/storage/v1/object/public/vibe-publication-covers/', 2)
    else p_value
  end
$$;

revoke all on function public.vibepress_media_fingerprint_value(text) from public, anon, authenticated, service_role;

create or replace function public.publication_release_fingerprint(p_publication_id uuid)
returns text
language sql
security definer
set search_path=public,pg_temp
stable
as $$
  select md5(
    jsonb_build_object(
      'publication',
        (to_jsonb(p) - array['total_reads','earnings_ksh','published_at','created_at','updated_at'])
        || jsonb_build_object('cover_url', public.vibepress_media_fingerprint_value(p.cover_url)),
      'chapters', coalesce((
        select jsonb_agg(
          jsonb_build_object(
            'chapter', to_jsonb(c) - array['published_at','created_at','updated_at','blocks'],
            'blocks', coalesce((
              select jsonb_agg(
                (to_jsonb(b) - array['created_at','updated_at'])
                || case
                  when b.block_type in ('image','diagram') then jsonb_build_object(
                    'payload',
                    jsonb_set(
                      b.payload,
                      '{content}',
                      to_jsonb(public.vibepress_media_fingerprint_value(b.payload->>'content')),
                      true
                    )
                  )
                  else '{}'::jsonb
                end
                order by b.sequence,b.id
              )
              from public.content_blocks b where b.chapter_id=c.id
            ),'[]'::jsonb),
            'official_outcomes', coalesce((
              select jsonb_agg(to_jsonb(o) order by o.id)
              from public.curriculum_learning_outcomes o
              where o.curriculum_id=c.curriculum_id and o.status='active' and o.source_type='official'
            ),'[]'::jsonb),
            'resources', coalesce((
              select jsonb_agg(to_jsonb(r) order by r.id)
              from public.learning_resources r where r.chapter_id=c.id
            ),'[]'::jsonb),
            'teacher_derivatives', coalesce((
              select jsonb_agg(to_jsonb(d) order by d.id)
              from public.content_derivatives d where d.source_chapter_id=c.id and d.audience='teacher'
            ),'[]'::jsonb),
            'assessment_items', coalesce((
              select jsonb_agg(to_jsonb(gai) order by gai.id)
              from public.generated_assessment_items gai
              join public.generated_assessments ga on ga.id=gai.assessment_id
              join public.content_assessment_blueprints bp on bp.id=ga.blueprint_id
              where bp.title ilike '%'||c.title||'%'
            ),'[]'::jsonb)
          ) order by c.number,c.id
        )
        from public.vibe_chapters c where c.publication_id=p.id
      ),'[]'::jsonb)
    )::text
  )
  from public.vibe_publications p
  where p.id=p_publication_id
$$;

revoke all on function public.publication_release_fingerprint(uuid) from public,anon,authenticated,service_role;
