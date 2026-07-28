alter table scheme_of_work
  add column content_status text
  generated always as (
    case
      when objectives is not null and key_inquiry_question is not null then 'complete'
      when objectives is not null or key_inquiry_question is not null then 'partial'
      else 'missing'
    end
  ) stored;

comment on column scheme_of_work.content_status is
  'Derived flag: complete/partial/missing based on objectives + key_inquiry_question presence. Used by UI/print export to show a pending-content state instead of a blank dash.';
