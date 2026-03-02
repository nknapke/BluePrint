-- Crew day worked-hours view
-- Date: 2026-02-22
-- Purpose:
--   Expose per-day worked hours from shift IN/OUT on the DB side.

begin;

drop view if exists public.v_crew_day_worked_hours;

create view public.v_crew_day_worked_hours as
with shift_base as (
  select
    s.location_id,
    s.work_date::date as work_date,
    s.crew_id,
    upper(btrim(coalesce(s.day_description, ''))) as day_desc,
    (
      extract(hour from s.start_time)::int * 60
      + extract(minute from s.start_time)::int
    ) as start_minute,
    (
      extract(hour from s.end_time)::int * 60
      + extract(minute from s.end_time)::int
    ) as end_minute
  from public.crew_work_shifts s
  where s.start_time is not null
    and s.end_time is not null
)
select
  sb.location_id,
  sb.work_date,
  sb.crew_id,
  round(
    case
      when sb.end_minute > sb.start_minute
        then (sb.end_minute - sb.start_minute)::numeric / 60.0
      when sb.end_minute < sb.start_minute
        then ((sb.end_minute + 1440) - sb.start_minute)::numeric / 60.0
      else 24::numeric
    end,
    2
  ) as worked_hours
from shift_base sb
where sb.day_desc not in ('OFF', 'PTO');

grant select on public.v_crew_day_worked_hours to anon, authenticated, service_role;

commit;
