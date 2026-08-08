create or replace function public.student_get_multimodal_teaching_sequence(p_source_type text, p_source_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_uid uuid := auth.uid();
  v_first jsonb;
  v_first_rep text;
  v_second text;
  v_third text;
begin
  if v_uid is null then raise exception 'not_authenticated'; end if;
  v_first := public.student_recommend_learning_representation(p_source_type, p_source_id);
  v_first_rep := coalesce(v_first->>'representation','immersive');
  v_second := case v_first_rep
    when 'audio_lesson' then 'visual_explainer'
    when 'visual_explainer' then 'worked_examples'
    when 'mind_map' then 'worked_examples'
    when 'worked_examples' then 'simplify'
    when 'story_mode' then 'worked_examples'
    when 'simplify' then 'visual_explainer'
    when 'flashcards' then 'simplify'
    when 'quiz' then 'worked_examples'
    when 'revision_sheet' then 'worked_examples'
    else 'worked_examples'
  end;
  v_third := case when v_first_rep='quiz' or v_second='quiz' then 'flashcards' else 'quiz' end;
  return jsonb_build_object(
    'policy','evidence_selected_then_complementary_then_retrieval',
    'source_type',p_source_type,'source_id',p_source_id,
    'learner_choice_allowed',true,'mastery_write_allowed',false,
    'recommendation',v_first,
    'stages',jsonb_build_array(
      jsonb_build_object('stage',1,'representation',v_first_rep,'intent','Start with the format Twin currently expects to help most.'),
      jsonb_build_object('stage',2,'representation',v_second,'intent','Re-express the same source through a complementary teaching mode.'),
      jsonb_build_object('stage',3,'representation',v_third,'intent','Finish with retrieval so understanding is checked, not merely viewed.')
    )
  );
end;
$$;
revoke all on function public.student_get_multimodal_teaching_sequence(text,uuid) from public;
revoke all on function public.student_get_multimodal_teaching_sequence(text,uuid) from anon;
grant execute on function public.student_get_multimodal_teaching_sequence(text,uuid) to authenticated;
