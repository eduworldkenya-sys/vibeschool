begin;

create or replace function public.student_twin_date_results_route(p_input text)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_uid uuid := auth.uid();
  v_text text := btrim(coalesce(p_input, ''));
  v_norm text := lower(regexp_replace(regexp_replace(v_text, '\s+', ' ', 'g'), '[?.!]+$', '', 'g'));
  v_local_now timestamp := now() at time zone 'Africa/Nairobi';
  v_today date := (now() at time zone 'Africa/Nairobi')::date;
  v_results jsonb;
  v_items jsonb := '[]'::jsonb;
  v_latest jsonb;
  v_title text;
  v_percentage text;
  v_released_at text;
begin
  if v_uid is null then raise exception 'not_authenticated'; end if;

  if v_norm ~ '^(what day is today|what date is today|what is today|which day is today|when is today|today''s date|todays date|what day is it|what date is it)$' then
    return jsonb_build_object(
      'handled', true,
      'intent', 'current_date',
      'reply', 'Today is ' || to_char(v_today, 'FMDay, FMDD FMMonth YYYY') || '.',
      'payload', jsonb_build_object(
        'date', to_char(v_today, 'YYYY-MM-DD'),
        'day', to_char(v_today, 'FMDay'),
        'timezone', 'Africa/Nairobi',
        'local_timestamp', to_char(v_local_now, 'YYYY-MM-DD"T"HH24:MI:SS')
      ),
      'requires_ai', false,
      'authoritative_mastery', false
    );
  end if;

  if v_norm ~ '(did (my )?teacher (send|release|post|publish) (my )?(result|results)|has (my )?teacher (sent|released|posted|published) (my )?(result|results)|are my results (out|released|available)|have my results been released|did i get my results|are results out|results released)' then
    v_results := public.exq_list_my_results();
    v_items := coalesce(v_results->'results', '[]'::jsonb);

    if jsonb_typeof(v_items) <> 'array' or jsonb_array_length(v_items) = 0 then
      return jsonb_build_object(
        'handled', true,
        'intent', 'results_release_status',
        'reply', 'I do not see any results released to you yet.',
        'payload', jsonb_build_object('released', false, 'results', '[]'::jsonb),
        'requires_ai', false,
        'authoritative_mastery', false
      );
    end if;

    v_latest := v_items->0;
    v_title := coalesce(nullif(v_latest->>'title', ''), 'your latest assessment');
    v_percentage := nullif(v_latest->>'percentage', '');
    v_released_at := nullif(v_latest->>'released_at', '');

    return jsonb_build_object(
      'handled', true,
      'intent', 'results_release_status',
      'reply',
        'Yes. Your latest released result is ' || v_title ||
        case when v_percentage is not null then ' at ' || v_percentage || '%.' else '.' end,
      'payload', jsonb_build_object(
        'released', true,
        'latest_result', v_latest,
        'released_at', v_released_at,
        'results', v_items
      ),
      'requires_ai', false,
      'authoritative_mastery', false
    );
  end if;

  return jsonb_build_object(
    'handled', false,
    'intent', 'not_date_or_results',
    'reply', null,
    'payload', '{}'::jsonb,
    'requires_ai', false,
    'authoritative_mastery', false
  );
end;
$$;

revoke all on function public.student_twin_date_results_route(text) from public, anon;
grant execute on function public.student_twin_date_results_route(text) to authenticated, service_role;

commit;
