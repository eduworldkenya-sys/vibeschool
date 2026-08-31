begin;

-- Convert the published Form 4 History & Government corpus into the reusable
-- VibeSchool five-layer learning loop without replacing substantive prose.
-- Existing block ids/content remain canonical; this migration adds metadata
-- and only inserts missing diagnostic/context blocks.

with target as (
  select id
  from public.vibe_publications
  where title = 'Vibe History & Government Form 4'
    and status = 'published'
  order by published_at desc nulls last
  limit 1
), rebuilt as (
  select c.id,
         jsonb_agg(
           jsonb_set(
             b.elem,
             '{meta}',
             coalesce(b.elem->'meta','{}'::jsonb) ||
             jsonb_build_object(
               'learning_layer',
               case
                 when c.number = 1 and b.elem->'meta'->>'learning_layer' is not null
                   then b.elem->'meta'->>'learning_layer'
                 when b.ord <= 2 then 'orient'
                 when lower(coalesce(b.elem->>'content','')) ~ '(kcse|quick revision|exam practice|depth practice|marking scheme)'
                   or b.elem->>'type' = 'activity' then 'extend'
                 when b.elem->>'type' in ('question','interactive')
                   or lower(coalesce(b.elem->>'content','')) ~ '(check your|checkpoint|misconception|quick check)' then 'apply'
                 when lower(coalesce(b.elem->>'content','')) ~ '(kenya|kenyan|east africa|african context|local impact)' then 'connect'
                 else 'comprehend'
               end
             ),
             true
           )
           order by b.ord
         ) as next_blocks
  from public.vibe_chapters c
  join target t on t.id = c.publication_id
  cross join lateral jsonb_array_elements(c.blocks) with ordinality as b(elem,ord)
  group by c.id
)
update public.vibe_chapters c
set blocks = r.next_blocks,
    updated_at = now()
from rebuilt r
where c.id = r.id;

-- Reference WWI: explicit misconception + Kenya/East Africa connection.
update public.vibe_chapters c
set blocks = c.blocks || jsonb_build_array(
  jsonb_build_object(
    'id','ww1-connect-kenya','type','callout',
    'content','Kenya and the wider East African region were drawn into the First World War through the East African campaign, military recruitment, carrier labour, requisitioning and economic disruption. African communities experienced the conflict differently from European battlefronts, and wartime service and hardship later contributed to changing political awareness. When explaining impact, distinguish direct wartime effects from the longer-term growth of anti-colonial politics; the war did not itself end colonial rule.',
    'meta',jsonb_build_object('learning_layer','connect','context','Kenya and East Africa')
  ),
  jsonb_build_object(
    'id','ww1-misconception-sarajevo','type','callout',
    'content','Misconception alert: Sarajevo was the immediate trigger, not a complete explanation of why a European crisis became a world war. A strong answer separates the assassination and July Crisis from longer-term nationalism, imperial rivalry, militarism, alliance commitments and Balkan instability.',
    'meta',jsonb_build_object('learning_layer','apply','kind','misconception')
  )
), updated_at = now()
where c.title = 'The First World War (1914–1918)'
  and c.publication_id in (
    select id
    from public.vibe_publications
    where title = 'Vibe History & Government Form 4'
      and status = 'published'
    order by published_at desc nulls last
    limit 1
  )
  and not exists (select 1 from jsonb_array_elements(c.blocks) b where b->>'id'='ww1-connect-kenya');

-- One real formative checkpoint per remaining unit. These are deliberately
-- distinct from end-of-unit KCSE practice, which belongs to EXTEND.
update public.vibe_chapters c
set blocks = c.blocks || case c.number
  when 2 then jsonb_build_array(
    jsonb_build_object('id','league-checkpoint-collective-security','type','question','content','Checkpoint: Why did collective security depend on member states being willing to act against an aggressor? In your answer, connect this weakness to either the Manchurian or Abyssinian crisis.','meta',jsonb_build_object('learning_layer','apply','diagnostic',true)),
    jsonb_build_object('id','league-connect-africa','type','callout','content','African connection: the League’s credibility was damaged sharply by its failure to stop Fascist Italy’s invasion of Ethiopia (Abyssinia) in 1935. The crisis mattered far beyond Europe because Ethiopia was an independent African state and League member. The mandates system also placed former German colonies under new mandatory powers, showing that post-war international cooperation did not mean the end of colonial rule.','meta',jsonb_build_object('learning_layer','connect','context','Africa and Ethiopia'))
  )
  when 3 then jsonb_build_array(jsonb_build_object('id','ww2-checkpoint-versaille','type','question','content','Checkpoint: Why is the Treaty of Versailles an incomplete explanation for the outbreak of the Second World War? Name two later developments that turned grievance into renewed war.','meta',jsonb_build_object('learning_layer','apply','diagnostic',true,'misconception_target','Versailles alone caused the Second World War')))
  when 4 then jsonb_build_array(jsonb_build_object('id','ir-checkpoint-un','type','question','content','Checkpoint: The United Nations has more institutions than the League of Nations. Why does institutional design alone not guarantee international peace? Use one example involving great-power interests or the Security Council.','meta',jsonb_build_object('learning_layer','apply','diagnostic',true)))
  when 5 then jsonb_build_array(jsonb_build_object('id','ca-checkpoint-oau-au','type','question','content','Checkpoint: Give one important continuity and one important difference between the OAU and the AU. Why is it inaccurate to describe the AU as simply the OAU with a new name?','meta',jsonb_build_object('learning_layer','apply','diagnostic',true)))
  when 6 then jsonb_build_array(jsonb_build_object('id','np-checkpoint-philosophy-policy','type','question','content','Checkpoint: Choose African Socialism, Harambee, Ujamaa or Humanism. State one principle and one policy or practice used to put that principle into action. Why must a historical answer distinguish ideals from implementation?','meta',jsonb_build_object('learning_layer','apply','diagnostic',true)))
  when 7 then jsonb_build_array(jsonb_build_object('id','dk-checkpoint-independence','type','question','content','Checkpoint: Why did political independence in 1963 not automatically remove inherited economic and regional inequalities in Kenya? Give two examples of challenges the post-independence state still had to address.','meta',jsonb_build_object('learning_layer','apply','diagnostic',true)))
  when 8 then jsonb_build_array(
    jsonb_build_object('id','da-checkpoint-single-story','type','question','content','Checkpoint: Why is it misleading to describe post-independence Africa as having one common political or economic experience? Use two contrasting country examples.','meta',jsonb_build_object('learning_layer','apply','diagnostic',true,'misconception_target','All African states followed the same post-independence path')),
    jsonb_build_object('id','da-connect-kenya','type','callout','content','Kenya as a comparison point: Kenya can be used alongside states such as Ghana, Tanzania, Nigeria or the Democratic Republic of Congo to test broad claims about post-independence Africa. Compare political institutions, economic choices, external pressures and social outcomes rather than assuming that one national experience represents the whole continent.','meta',jsonb_build_object('learning_layer','connect','context','Kenya compared with Africa'))
  )
  when 9 then jsonb_build_array(jsonb_build_object('id','la-checkpoint-devolution','type','question','content','Checkpoint: What is the difference between the former local-authority system and county government under the Constitution of Kenya 2010? Identify one difference in legal status, functions or finance.','meta',jsonb_build_object('learning_layer','apply','diagnostic',true)))
  when 10 then jsonb_build_array(
    jsonb_build_object('id','pf-checkpoint-revenue-borrowing','type','question','content','Checkpoint: Why are taxation, government borrowing and public expenditure related but not identical ideas? Explain what each does in a public-finance system.','meta',jsonb_build_object('learning_layer','apply','diagnostic',true)),
    jsonb_build_object('id','pf-connect-kenya','type','callout','content','Kenyan connection: public finance operates at both national and county levels. Revenue decisions determine the resources available for services and development, while budgets show how priorities are translated into expenditure. When evaluating a budget, ask who raises the money, who receives it, what it is spent on and what accountability mechanisms are expected.','meta',jsonb_build_object('learning_layer','connect','context','Kenyan public finance'))
  )
  when 11 then jsonb_build_array(jsonb_build_object('id','cg-checkpoint-systems','type','question','content','Checkpoint: Why is it wrong to assume that a parliamentary system is automatically more democratic than a presidential system, or vice versa? Name two institutional criteria that should be compared instead.','meta',jsonb_build_object('learning_layer','apply','diagnostic',true,'misconception_target','System label alone determines democratic quality')))
  else '[]'::jsonb
end,
updated_at = now()
where c.publication_id in (
    select id
    from public.vibe_publications
    where title = 'Vibe History & Government Form 4'
      and status = 'published'
    order by published_at desc nulls last
    limit 1
  )
  and c.number between 2 and 11
  and not exists (select 1 from jsonb_array_elements(c.blocks) b where b->'meta'->>'learning_layer'='apply');

-- Fail closed: the current Form 4 History corpus must expose every learning
-- stage after transformation. This prevents silent partial rollout.
do $$
declare missing_count integer;
begin
  with target as (
    select id from public.vibe_publications
    where title='Vibe History & Government Form 4' and status='published'
    order by published_at desc nulls last limit 1
  ), required(layer) as (values ('orient'),('comprehend'),('apply'),('connect'),('extend')),
  present as (
    select c.id, b->'meta'->>'learning_layer' layer
    from public.vibe_chapters c
    join target t on t.id=c.publication_id
    cross join lateral jsonb_array_elements(c.blocks) b
    group by c.id,b->'meta'->>'learning_layer'
  )
  select count(*) into missing_count
  from public.vibe_chapters c
  join target t on t.id=c.publication_id
  cross join required r
  left join present p on p.id=c.id and p.layer=r.layer
  where p.id is null;

  if missing_count <> 0 then
    raise exception 'FORM4_HISTORY_LEARNING_LOOP_INCOMPLETE: % missing chapter/layer pairs', missing_count;
  end if;
end $$;

commit;
