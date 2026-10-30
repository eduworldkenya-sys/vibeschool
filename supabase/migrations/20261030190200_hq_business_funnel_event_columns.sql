alter table public.hq_visitor_events add column if not exists event_type text not null default 'page_view' check (event_type in ('page_view','card_selected','checkout_opened','form_started'));
alter table public.hq_visitor_events add column if not exists event_label text check (event_label is null or length(event_label)<=40);
