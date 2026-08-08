create or replace function public.student_get_adaptive_teaching_turn(
  p_outcome_id uuid,
  p_stage integer,
  p_learner_reply text
)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_stage integer := greatest(0, least(3, coalesce(p_stage, 0)));
  v_reply text := lower(trim(coalesce(p_learner_reply, '')));
  v_intervention jsonb;
  v_mode text;
  v_prompt text;
  v_next integer;
  v_signal text;
begin
  if auth.uid() is null then raise exception 'not_authenticated'; end if;
  if p_outcome_id is null then raise exception 'outcome_required'; end if;

  v_intervention := public.student_get_adaptive_intervention(p_outcome_id);

  if v_reply = '' then
    v_signal := 'no_response';
    v_mode := 'socratic_question';
    v_prompt := 'What do you already know about this idea, and which part feels uncertain?';
    v_next := v_stage;
  elsif v_reply ~ '(i do not know|i don''t know|dont know|not sure|confused|no idea|stuck)' then
    v_signal := 'uncertain';
    v_mode := 'hint';
    v_prompt := 'Let’s make it smaller. Which word, condition, quantity, or relationship in the problem looks most important?';
    v_next := least(3, v_stage + 1);
  elsif length(v_reply) < 18 then
    v_signal := 'thin_response';
    v_mode := 'socratic_question';
    v_prompt := 'Say a little more: why do you think that step or idea is relevant?';
    v_next := v_stage;
  elsif v_stage < 2 then
    v_signal := 'engaged_reasoning';
    v_mode := 'socratic_question';
    v_prompt := 'Good. What would be the next smallest step, and how could you check that it is valid?';
    v_next := v_stage + 1;
  elsif v_stage = 2 then
    v_signal := 'ready_for_scaffold';
    v_mode := 'hint';
    v_prompt := 'Use your reasoning so far to attempt one complete step. I’ll help you check the logic, not just give the answer.';
    v_next := 3;
  else
    v_signal := 'worked_example_ready';
    v_mode := 'worked_example';
    v_prompt := 'Compare your approach with a worked example, then explain one thing you would do differently on a similar question.';
    v_next := 3;
  end if;

  return jsonb_build_object(
    'stage', v_stage,
    'next_stage', v_next,
    'mode', v_mode,
    'prompt', v_prompt,
    'learner_signal', v_signal,
    'intervention', v_intervention,
    'mastery_write_allowed', false,
    'one_question_at_a_time', true
  );
end;
$$;

revoke all on function public.student_get_adaptive_teaching_turn(uuid, integer, text) from public, anon;
grant execute on function public.student_get_adaptive_teaching_turn(uuid, integer, text) to authenticated;
