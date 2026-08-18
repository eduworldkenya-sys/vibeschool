# HQ Reference-Responsive Redesign Handover — 2026-08-19

## Objective
Rebuild VibeSchool HQ to match the supplied desktop + phone command-center references rather than a generic card dashboard.

## UX direction implemented
- Desktop-first command center uses a persistent left navigation rail, dense but readable operating canvas, dark navy surfaces, restrained semantic color, and three-column analytical zones.
- Mobile uses a dedicated top bar and fixed five-item bottom navigation with the Live action emphasized, matching the supplied phone reference.
- Metric hierarchy: key metrics -> live overview -> quick actions -> operating intelligence -> geographic/financial intelligence -> governed authority.
- Charts include live activity, performance trend, financial trend, school performance donut, subject mastery bars and geographic intelligence visualization.
- Touch targets, mobile overflow, responsive grids and safe-area bottom spacing are implemented for phone usage.

## Data truth
No new database schema was introduced. Production Supabase was read-only verified for these required RPCs:
- hq_check_owner_access
- hq_get_control_health_v2
- hq_get_product_controls
- hq_get_seven_day_owner_report
- hq_run_operating_cycle
- hq_workforce_list_decisions

The home dashboard remains source-backed by the existing owner report, product controls, control health and workforce decision RPCs. Offline fallback remains last-known certified snapshot only.

## Security preserved
- HQ continues to use the isolated `hqSupabase` client.
- Owner access continues through `hq_check_owner_access` in the HQ layout.
- No public or ordinary app Supabase client was introduced into the HQ command center.
- No production authority was broadened.

## Files changed
- `components/hq/HQShell.tsx`
- `app/hq/page.tsx`
- `docs/HQ_REFERENCE_RESPONSIVE_HANDOVER_20260819.md`

## Release rule
Merge only after exact-head TypeScript/production build and repository contract gates pass. Do not manually trigger Vercel during implementation; let deployment follow only from the final merged commit according to repository configuration.
