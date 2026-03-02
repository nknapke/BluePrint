-- Crew week-hours view
-- Date: 2026-02-22
-- Purpose:
--   Move weekly hour aggregation into Supabase so UI reads DB-computed totals.
--
-- Outputs per location/week/crew:
--   total_hours             -> worked hours from shift IN/OUT (raw)
--   paid_hours              -> paid hours after lunch deductions
--   lead_hours              -> paid lead base hours
--   regular_hours           -> paid regular base hours
--   regular_overtime_hours  -> paid regular overtime hours
--   lead_overtime_hours     -> paid lead overtime hours

begin;

drop view if exists public.v_crew_week_hours;

create view public.v_crew_week_hours as
with week_worked as (
  select
    dwh.location_id,
    date_trunc('week', dwh.work_date::timestamp)::date as week_start,
    dwh.crew_id,
    round(sum(coalesce(dwh.worked_hours, 0))::numeric, 2) as total_hours
  from public.v_crew_day_worked_hours dwh
  group by dwh.location_id, date_trunc('week', dwh.work_date::timestamp)::date, dwh.crew_id
),
week_paid as (
  select
    dh.location_id,
    date_trunc('week', dh.work_date::timestamp)::date as week_start,
    dh.crew_id,
    round(sum(coalesce(dh.total_hours, 0))::numeric, 2) as paid_hours,
    round(sum(coalesce(dh.lead_hours, 0))::numeric, 2) as lead_hours,
    round(sum(coalesce(dh.hours, 0))::numeric, 2) as regular_hours,
    round(sum(coalesce(dh.regular_overtime_hours, 0))::numeric, 2) as regular_overtime_hours,
    round(sum(coalesce(dh.lead_overtime_hours, 0))::numeric, 2) as lead_overtime_hours
  from public.v_crew_day_hours dh
  group by dh.location_id, date_trunc('week', dh.work_date::timestamp)::date, dh.crew_id
)
select
  coalesce(ww.location_id, wp.location_id) as location_id,
  coalesce(ww.week_start, wp.week_start) as week_start,
  (coalesce(ww.week_start, wp.week_start) + 6)::date as week_end,
  coalesce(ww.crew_id, wp.crew_id) as crew_id,
  coalesce(ww.total_hours, 0)::numeric(10,2) as total_hours,
  coalesce(wp.paid_hours, 0)::numeric(10,2) as paid_hours,
  coalesce(wp.lead_hours, 0)::numeric(10,2) as lead_hours,
  coalesce(wp.regular_hours, 0)::numeric(10,2) as regular_hours,
  coalesce(wp.regular_overtime_hours, 0)::numeric(10,2) as regular_overtime_hours,
  coalesce(wp.lead_overtime_hours, 0)::numeric(10,2) as lead_overtime_hours
from week_worked ww
full outer join week_paid wp
  on wp.location_id = ww.location_id
 and wp.week_start = ww.week_start
 and wp.crew_id = ww.crew_id;

grant select on public.v_crew_week_hours to anon, authenticated, service_role;

commit;
