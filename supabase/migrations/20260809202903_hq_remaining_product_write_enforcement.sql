-- Extend HQ product kill-switch enforcement to remaining unambiguous product-owned writes.
-- Service-role/internal automation bypass remains intentional inside hq_enforce_product_write().

drop trigger if exists trg_hq_enforce_twin_sessions on public.twin_sessions;
create trigger trg_hq_enforce_twin_sessions before insert on public.twin_sessions for each row execute function public.hq_enforce_product_write('twin','twin.enabled');

drop trigger if exists trg_hq_enforce_twin_memory on public.twin_memory;
create trigger trg_hq_enforce_twin_memory before insert or update or delete on public.twin_memory for each row execute function public.hq_enforce_product_write('twin','twin.enabled');

drop trigger if exists trg_hq_enforce_twin_profile on public.twin_profile;
create trigger trg_hq_enforce_twin_profile before insert or update or delete on public.twin_profile for each row execute function public.hq_enforce_product_write('twin','twin.enabled');

drop trigger if exists trg_hq_enforce_vibelearn_content on public.vibelearn_content;
create trigger trg_hq_enforce_vibelearn_content before insert or update or delete on public.vibelearn_content for each row execute function public.hq_enforce_product_write('vibelearn','vibelearn.enabled');

drop trigger if exists trg_hq_enforce_vibelearn_saved on public.vibelearn_saved;
create trigger trg_hq_enforce_vibelearn_saved before insert or update or delete on public.vibelearn_saved for each row execute function public.hq_enforce_product_write('vibelearn','vibelearn.enabled');

drop trigger if exists trg_hq_enforce_vibelearn_history on public.vibelearn_history;
create trigger trg_hq_enforce_vibelearn_history before insert or update or delete on public.vibelearn_history for each row execute function public.hq_enforce_product_write('vibelearn','vibelearn.enabled');

drop trigger if exists trg_hq_enforce_school_admin_projects on public.admin_projects;
create trigger trg_hq_enforce_school_admin_projects before insert or update or delete on public.admin_projects for each row execute function public.hq_enforce_product_write('school_admin','school_admin.enabled');

drop trigger if exists trg_hq_enforce_school_admin_announcements on public.admin_announcements;
create trigger trg_hq_enforce_school_admin_announcements before insert or update or delete on public.admin_announcements for each row execute function public.hq_enforce_product_write('school_admin','school_admin.enabled');

drop trigger if exists trg_hq_enforce_school_admin_notices on public.admin_notices;
create trigger trg_hq_enforce_school_admin_notices before insert or update or delete on public.admin_notices for each row execute function public.hq_enforce_product_write('school_admin','school_admin.enabled');

drop trigger if exists trg_hq_enforce_billing_subscriptions on public.billing_subscriptions;
create trigger trg_hq_enforce_billing_subscriptions before insert or update or delete on public.billing_subscriptions for each row execute function public.hq_enforce_product_write('billing','billing.enabled');

drop trigger if exists trg_hq_enforce_billing_subscription_events on public.billing_subscription_events;
create trigger trg_hq_enforce_billing_subscription_events before insert on public.billing_subscription_events for each row execute function public.hq_enforce_product_write('billing','billing.enabled');
