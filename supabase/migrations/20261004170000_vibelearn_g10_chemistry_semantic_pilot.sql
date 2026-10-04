begin;

-- VibeLearn Grade 10 Chemistry semantic pilot.
--
-- This migration deliberately separates three authority classes:
--   1) direct semantic mirrors of already-verified KICD outcomes -> active;
--   2) pedagogical prerequisite hypotheses -> draft;
--   3) research-backed misconception hypotheses -> draft.
--
-- It does not publish or certify the draft Chemistry textbook, does not change
-- resource visibility, and does not claim KICD approval for editorial/research
-- knowledge.

create or replace function public.curriculum_sync_g10_chemistry_vibelearn_semantics()
returns jsonb
language plpgsql
security definer
set search_path = ''
as $function$
declare
  v_concepts integer := 0;
  v_links integer := 0;
  v_relation_candidates integer := 0;
  v_misconception_candidates integer := 0;
begin
  -- Only exact, owner-verified official outcomes may produce active concept
  -- mirrors. Verification/provenance are inherited from the authoritative
  -- outcome; no new curriculum assertion is created here.
  with seed(concept_key,title,semantic_type,outcome_code) as (
    values
      ('chem.g10.atomic-structure','Atomic structure','concept','CHEM-G10-1.2-A'),
      ('chem.g10.relative-atomic-mass','Relative atomic mass','procedure','CHEM-G10-1.2-B'),
      ('chem.g10.electron-arrangement-sp','Electron arrangement using s and p notation','procedure','CHEM-G10-1.2-C'),
      ('chem.g10.periodic-position-from-electrons','Periodic-table position from electron arrangement','principle','CHEM-G10-1.3-A'),
      ('chem.g10.ion-formation','Ion formation','concept','CHEM-G10-1.3-B'),
      ('chem.g10.compound-formulae','Deriving formulae of compounds','procedure','CHEM-G10-1.3-C'),
      ('chem.g10.balanced-equations','Balancing chemical equations','procedure','CHEM-G10-1.3-D'),
      ('chem.g10.chemical-bonding','Chemical bonding','concept','CHEM-G10-1.4-A'),
      ('chem.g10.bonding-structure-properties','Bonding, structure and physical properties','principle','CHEM-G10-1.4-B')
  ),
  verified_source as (
    select
      s.*,
      o.id as outcome_id,
      o.outcome_text,
      o.source_ref,
      o.verified_by,
      o.verified_at,
      c.global_subject_id as subject_id
    from seed s
    join public.curriculum_learning_outcomes o
      on o.outcome_code = s.outcome_code
     and o.status = 'verified'
     and o.source_type = 'official'
     and o.verified_by is not null
     and o.verified_at is not null
     and nullif(btrim(coalesce(o.source_ref,'')),'') is not null
    join public.curriculum c on c.id = o.curriculum_id
    where c.global_subject_id is not null
  )
  insert into public.curriculum_concepts(
    subject_id,concept_key,title,description,semantic_type,authority_class,
    source_ref,status,verified_by,verified_at
  )
  select
    vs.subject_id,
    vs.concept_key,
    vs.title,
    'Direct semantic mirror of verified curriculum outcome '||vs.outcome_code||': '||vs.outcome_text,
    vs.semantic_type,
    'official_term',
    vs.source_ref,
    'active',
    vs.verified_by,
    vs.verified_at
  from verified_source vs
  on conflict(concept_key) do nothing;

  get diagnostics v_concepts = row_count;

  with seed(concept_key,outcome_code,relationship) as (
    values
      ('chem.g10.atomic-structure','CHEM-G10-1.2-A','primary'),
      ('chem.g10.relative-atomic-mass','CHEM-G10-1.2-B','primary'),
      ('chem.g10.electron-arrangement-sp','CHEM-G10-1.2-C','primary'),
      ('chem.g10.periodic-position-from-electrons','CHEM-G10-1.3-A','primary'),
      ('chem.g10.ion-formation','CHEM-G10-1.3-B','primary'),
      ('chem.g10.compound-formulae','CHEM-G10-1.3-C','primary'),
      ('chem.g10.balanced-equations','CHEM-G10-1.3-D','primary'),
      ('chem.g10.chemical-bonding','CHEM-G10-1.4-A','primary'),
      ('chem.g10.bonding-structure-properties','CHEM-G10-1.4-B','primary'),
      ('chem.g10.bonding-structure-properties','CHEM-G10-1.4-C','supporting')
  ),
  verified_source as (
    select
      s.*,
      o.id as outcome_id,
      o.source_ref,
      o.verified_by,
      o.verified_at,
      cc.id as concept_id
    from seed s
    join public.curriculum_learning_outcomes o
      on o.outcome_code = s.outcome_code
     and o.status = 'verified'
     and o.source_type = 'official'
     and o.verified_by is not null
     and o.verified_at is not null
     and nullif(btrim(coalesce(o.source_ref,'')),'') is not null
    join public.curriculum_concepts cc
      on cc.concept_key = s.concept_key
     and cc.status = 'active'
     and cc.verified_at is not null
  )
  insert into public.curriculum_outcome_concepts(
    outcome_id,concept_id,relationship,relevance_weight,authority_class,
    source_ref,status,verified_by,verified_at
  )
  select
    vs.outcome_id,
    vs.concept_id,
    vs.relationship,
    case when vs.relationship='primary' then 1.0 else 0.85 end,
    'official_derived',
    vs.source_ref,
    'active',
    vs.verified_by,
    vs.verified_at
  from verified_source vs
  on conflict(outcome_id,concept_id,relationship) do nothing;

  get diagnostics v_links = row_count;

  -- Search aliases are naming aids only; they do not add new curriculum claims.
  insert into public.curriculum_concept_aliases(concept_id,alias,locale,alias_type)
  select cc.id,a.alias,'en-KE',a.alias_type
  from (
    values
      ('chem.g10.atomic-structure','structure of the atom','search_term'),
      ('chem.g10.relative-atomic-mass','RAM','abbreviation'),
      ('chem.g10.electron-arrangement-sp','electron configuration','synonym'),
      ('chem.g10.periodic-position-from-electrons','periodic table position','search_term'),
      ('chem.g10.ion-formation','formation of ions','search_term'),
      ('chem.g10.compound-formulae','chemical formulae','search_term'),
      ('chem.g10.balanced-equations','balancing equations','search_term'),
      ('chem.g10.chemical-bonding','bond types','search_term'),
      ('chem.g10.bonding-structure-properties','structure property relationship','search_term')
  ) as a(concept_key,alias,alias_type)
  join public.curriculum_concepts cc on cc.concept_key=a.concept_key
  on conflict(concept_id,locale,normalized_alias) do nothing;

  -- Prerequisites are pedagogical claims. Populate them as review candidates,
  -- not active truth. Sources support the direction, but a VibeSchool reviewer
  -- must explicitly verify before learners are sequenced by them.
  with relation_seed(from_key,to_key,source_ref) as (
    values
      ('chem.g10.atomic-structure','chem.g10.electron-arrangement-sp',
       'https://edu.rsc.org/cpd/how-to-teach-atomic-structure-at-14-16/4020896.article'),
      ('chem.g10.electron-arrangement-sp','chem.g10.periodic-position-from-electrons',
       'https://edu.rsc.org/cpd/everything-you-need-to-teach-atomic-structure-and-periodicity-at-post-16/4018373.article'),
      ('chem.g10.electron-arrangement-sp','chem.g10.ion-formation',
       'https://edu.rsc.org/cpd/everything-you-need-to-teach-atomic-structure-and-periodicity-at-post-16/4018373.article'),
      ('chem.g10.ion-formation','chem.g10.compound-formulae',
       'https://drive.google.com/file/d/1R293rOfFoxio7GqwY-mVAolmLDnnHnQ2/preview'),
      ('chem.g10.compound-formulae','chem.g10.balanced-equations',
       'https://drive.google.com/file/d/1R293rOfFoxio7GqwY-mVAolmLDnnHnQ2/preview'),
      ('chem.g10.electron-arrangement-sp','chem.g10.chemical-bonding',
       'https://pubs.rsc.org/en/content/articlehtml/2018/rp/c8rp00035b'),
      ('chem.g10.chemical-bonding','chem.g10.bonding-structure-properties',
       'https://pubs.rsc.org/en/content/articlehtml/2018/rp/c8rp00035b')
  )
  insert into public.curriculum_concept_relations(
    from_concept_id,to_concept_id,relation_type,strength,source_ref,status
  )
  select f.id,t.id,'prerequisite',1.0,rs.source_ref,'draft'
  from relation_seed rs
  join public.curriculum_concepts f on f.concept_key=rs.from_key
  join public.curriculum_concepts t on t.concept_key=rs.to_key
  on conflict(from_concept_id,to_concept_id,relation_type) do nothing;

  get diagnostics v_relation_candidates = row_count;

  -- Research-supported misconceptions remain draft until independent content
  -- review. Wording is intentionally diagnostic and avoids asserting that any
  -- individual learner holds the misconception without learner evidence.
  with misconception_seed(
    concept_key,misconception_code,misconception_text,correction_text,
    diagnostic_guidance,source_ref
  ) as (
    values
      (
        'chem.g10.atomic-structure',
        'chem.g10.atomic-structure.rigid-shells',
        'Treats electron shells or orbitals as rigid physical tracks followed by electrons.',
        'Use shell/orbital diagrams as models of energy and probable electron location, not literal fixed paths.',
        'Ask the learner what a shell/orbital diagram represents and whether an electron follows the drawn line as a fixed path.',
        'https://edu.rsc.org/cpd/how-to-teach-atomic-structure-at-14-16/4020896.article'
      ),
      (
        'chem.g10.electron-arrangement-sp',
        'chem.g10.electron-arrangement.full-shell-purpose',
        'Explains ion or bond formation mainly as atoms needing or wanting a full outer shell.',
        'Separate the useful full-shell pattern from causal explanation; use electron arrangement together with electrostatic and energetic reasoning.',
        'Ask why an ion or bond forms, then check whether the explanation relies only on atoms wanting a complete shell.',
        'https://edu.rsc.org/cpd/everything-you-need-to-teach-atomic-structure-and-periodicity-at-post-16/4018373.article'
      ),
      (
        'chem.g10.chemical-bonding',
        'chem.g10.ionic-bond.transfer-only',
        'Describes an ionic bond as the electron-transfer event rather than the electrostatic attraction between resulting oppositely charged ions.',
        'Distinguish ion formation by electron transfer from ionic bonding: the bond is the electrostatic attraction among oppositely charged ions.',
        'After a learner describes sodium and chlorine electron transfer, ask what holds the resulting ions together in the solid.',
        'https://pubs.rsc.org/en/content/articlehtml/2018/rp/c8rp00035b'
      ),
      (
        'chem.g10.chemical-bonding',
        'chem.g10.ionic-compound.discrete-molecules',
        'Treats an ionic solid such as sodium chloride as separate NaCl molecules or isolated ion pairs.',
        'Represent ionic solids as extended lattices in which each ion interacts with several oppositely charged neighbours.',
        'Ask the learner to draw a small region of solid sodium chloride and explain whether one sodium ion is bonded to only one chloride ion.',
        'https://pubs.acs.org/doi/10.1021/ed400700q'
      )
  )
  insert into public.curriculum_misconceptions(
    concept_id,misconception_code,misconception_text,correction_text,
    diagnostic_guidance,authority_class,source_ref,status
  )
  select
    cc.id,
    ms.misconception_code,
    ms.misconception_text,
    ms.correction_text,
    ms.diagnostic_guidance,
    'research_supported',
    ms.source_ref,
    'draft'
  from misconception_seed ms
  join public.curriculum_concepts cc on cc.concept_key=ms.concept_key
  on conflict(misconception_code) do nothing;

  get diagnostics v_misconception_candidates = row_count;

  with link_seed(misconception_code,outcome_code,relationship,source_ref) as (
    values
      ('chem.g10.atomic-structure.rigid-shells','CHEM-G10-1.2-A','diagnostic_target',
       'https://edu.rsc.org/cpd/how-to-teach-atomic-structure-at-14-16/4020896.article'),
      ('chem.g10.atomic-structure.rigid-shells','CHEM-G10-1.2-C','may_block',
       'https://edu.rsc.org/cpd/how-to-teach-atomic-structure-at-14-16/4020896.article'),
      ('chem.g10.electron-arrangement.full-shell-purpose','CHEM-G10-1.3-B','diagnostic_target',
       'https://edu.rsc.org/cpd/everything-you-need-to-teach-atomic-structure-and-periodicity-at-post-16/4018373.article'),
      ('chem.g10.electron-arrangement.full-shell-purpose','CHEM-G10-1.4-A','may_block',
       'https://pubs.rsc.org/en/content/articlehtml/2018/rp/c8rp00035b'),
      ('chem.g10.ionic-bond.transfer-only','CHEM-G10-1.4-A','diagnostic_target',
       'https://pubs.rsc.org/en/content/articlehtml/2018/rp/c8rp00035b'),
      ('chem.g10.ionic-bond.transfer-only','CHEM-G10-1.4-B','may_block',
       'https://pubs.rsc.org/en/content/articlehtml/2018/rp/c8rp00035b'),
      ('chem.g10.ionic-compound.discrete-molecules','CHEM-G10-1.4-A','diagnostic_target',
       'https://pubs.acs.org/doi/10.1021/ed400700q'),
      ('chem.g10.ionic-compound.discrete-molecules','CHEM-G10-1.4-B','may_block',
       'https://pubs.acs.org/doi/10.1021/ed400700q')
  )
  insert into public.curriculum_misconception_outcomes(
    misconception_id,outcome_id,relationship,relevance_weight,source_ref,status
  )
  select
    cm.id,
    o.id,
    ls.relationship,
    1.0,
    ls.source_ref,
    'draft'
  from link_seed ls
  join public.curriculum_misconceptions cm on cm.misconception_code=ls.misconception_code
  join public.curriculum_learning_outcomes o
    on o.outcome_code=ls.outcome_code
   and o.status='verified'
  on conflict(misconception_id,outcome_id,relationship) do nothing;

  -- Existing canonical Grade 10 Chemistry chapter resources were missing the
  -- representation metadata the lesson sequencer needs. Repair metadata only;
  -- preserve draft publication status, resource status and visibility.
  update public.learning_resources lr
  set
    sub_strand_id = coalesce(lr.sub_strand_id,c.sub_strand_id),
    asset_kind = coalesce(lr.asset_kind,'learner_notes'),
    purpose = coalesce(lr.purpose,'teach'),
    material_variant = coalesce(lr.material_variant,'curriculum_chapter'),
    updated_at = clock_timestamp()
  from public.curriculum c
  where lr.curriculum_id=c.id
    and lr.source_type='chapter'
    and lr.status='active'
    and lower(coalesce(lr.subject,''))='chemistry'
    and replace(lower(coalesce(lr.grade,'')),' ','')='grade10'
    and lr.title in (
      'Introduction to Chemistry','The Atom','The Periodic Table',
      'Chemical Bonding','Periodicity','Acids and Bases','Introduction to Salts'
    );

  return jsonb_build_object(
    'ok',true,
    'active_concepts_inserted',v_concepts,
    'active_outcome_concept_links_inserted',v_links,
    'draft_prerequisite_candidates_inserted',v_relation_candidates,
    'draft_misconception_candidates_inserted',v_misconception_candidates,
    'publication_or_certification_changed',false
  );
end;
$function$;

revoke all on function public.curriculum_sync_g10_chemistry_vibelearn_semantics()
  from public,anon,authenticated;
grant execute on function public.curriculum_sync_g10_chemistry_vibelearn_semantics()
  to service_role;

-- Keep future exact Grade 10 Chemistry verification events reconciled without
-- exposing a browser mutation API.
create or replace function public.curriculum_sync_g10_chemistry_vibelearn_semantics_trigger()
returns trigger
language plpgsql
security definer
set search_path = ''
as $function$
begin
  perform public.curriculum_sync_g10_chemistry_vibelearn_semantics();
  return new;
end;
$function$;

revoke all on function public.curriculum_sync_g10_chemistry_vibelearn_semantics_trigger()
  from public,anon,authenticated;

drop trigger if exists curriculum_sync_g10_chemistry_vibelearn_semantics
  on public.curriculum_learning_outcomes;
create trigger curriculum_sync_g10_chemistry_vibelearn_semantics
after insert or update of status,verified_by,verified_at
on public.curriculum_learning_outcomes
for each row
when (
  new.status='verified'
  and new.outcome_code like 'CHEM-G10-%'
)
execute function public.curriculum_sync_g10_chemistry_vibelearn_semantics_trigger();

-- Run once for the already-verified production cohort.
select public.curriculum_sync_g10_chemistry_vibelearn_semantics();

-- Student product recommendations must treat the established curriculum
-- lifecycle consistently with the teacher VibeLearn projection: active and
-- verified outcomes are both usable; draft/rejected/archived are not.
create or replace function public.student_get_learning_product_recommendations(p_limit integer default 5)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $function$
declare
  v_uid uuid := auth.uid();
  v_student_id uuid;
  v_student_count integer := 0;
  v_limit integer := least(greatest(coalesce(p_limit,5),1),10);
  v_rows jsonb;
begin
  if v_uid is null then
    raise exception 'authentication_required';
  end if;

  select count(*)::integer,min(s.id)
  into v_student_count,v_student_id
  from public.students s
  where s.profile_id = v_uid
    and s.deleted_at is null;

  if v_student_count = 0 then
    raise exception 'learner_identity_not_found';
  end if;
  if v_student_count <> 1 then
    raise exception 'ambiguous_learner_identity';
  end if;

  with weak_outcomes as (
    select m.outcome_id,
           m.mastery_score,
           m.evidence_count,
           greatest(0,100-coalesce(m.mastery_score,0))::numeric as need_weight
    from public.student_outcome_mastery m
    join public.curriculum_learning_outcomes o on o.id = m.outcome_id
    where m.student_id = v_student_id
      and m.mastery_score is not null
      and m.mastery_score < 70
      and m.evidence_count > 0
      and o.status in ('active','verified')
  ), candidate_paths as (
    select l.product_id,
           w.outcome_id,
           w.evidence_count,
           w.mastery_score,
           w.need_weight * l.coverage_weight *
             case l.relationship
               when 'remediates' then 1.20
               when 'practises' then 1.10
               when 'teaches' then 1.00
               when 'supports' then 0.90
               when 'prerequisite' then 0.85
               when 'assesses' then 0.60
               else 0.50
             end as path_score,
           'outcome'::text as match_type
    from weak_outcomes w
    join public.learning_product_curriculum_links l on l.outcome_id = w.outcome_id

    union all

    select l.product_id,
           w.outcome_id,
           w.evidence_count,
           w.mastery_score,
           w.need_weight * oc.relevance_weight * l.coverage_weight *
             case l.relationship
               when 'remediates' then 1.20
               when 'practises' then 1.10
               when 'teaches' then 1.00
               when 'supports' then 0.90
               when 'prerequisite' then 0.85
               when 'assesses' then 0.60
               else 0.50
             end as path_score,
           'concept'::text as match_type
    from weak_outcomes w
    join public.curriculum_outcome_concepts oc
      on oc.outcome_id = w.outcome_id
     and oc.status = 'active'
     and oc.verified_at is not null
    join public.curriculum_concepts c
      on c.id = oc.concept_id
     and c.status = 'active'
     and c.verified_at is not null
    join public.learning_product_concept_links l on l.concept_id = c.id
  ), qualified as (
    select cp.product_id,
           sum(cp.path_score) as score,
           count(distinct cp.outcome_id) as weak_outcome_count,
           sum(cp.evidence_count) as evidence_count,
           min(cp.mastery_score) as lowest_mastery,
           array_agg(distinct cp.match_type order by cp.match_type) as match_types
    from candidate_paths cp
    group by cp.product_id
  ), saleable as (
    select q.*,
           p.sku,
           p.title,
           p.product_type,
           min(o.amount_kes) as price_kes
    from qualified q
    join public.learning_products p
      on p.id = q.product_id
     and p.status = 'active'
     and p.rights_status = 'cleared'
    join public.learning_product_offers o
      on o.product_id = p.id
     and o.status = 'active'
     and o.pricing_model = 'one_time'
     and o.amount_kes is not null
     and o.amount_kes > 0
     and (o.starts_at is null or o.starts_at <= now())
     and (o.ends_at is null or o.ends_at > now())
    group by q.product_id,q.score,q.weak_outcome_count,q.evidence_count,q.lowest_mastery,q.match_types,p.sku,p.title,p.product_type
    order by q.score desc,q.evidence_count desc,p.title
    limit v_limit
  )
  select coalesce(jsonb_agg(
    jsonb_build_object(
      'product_id',s.product_id,
      'sku',s.sku,
      'title',s.title,
      'product_type',s.product_type,
      'price_kes',s.price_kes,
      'score',round(s.score,2),
      'weak_outcome_count',s.weak_outcome_count,
      'evidence_count',s.evidence_count,
      'lowest_mastery',s.lowest_mastery,
      'match_types',s.match_types,
      'reason_code','recorded_outcome_weakness'
    ) order by s.score desc,s.evidence_count desc,s.title
  ),'[]'::jsonb)
  into v_rows
  from saleable s;

  return jsonb_build_object(
    'ok',true,
    'student_id',v_student_id,
    'evidence_policy',jsonb_build_object(
      'requires_recorded_mastery',true,
      'minimum_evidence_count',1,
      'mastery_threshold',70,
      'missing_data_is_not_weakness',true,
      'learner_identity_must_be_unambiguous',true
    ),
    'recommendations',v_rows
  );
end;
$function$;

revoke all on function public.student_get_learning_product_recommendations(integer)
  from public,anon;
grant execute on function public.student_get_learning_product_recommendations(integer)
  to authenticated,service_role;

commit;
