-- Crew day-hours patch
-- Date: 2026-02-21
-- Purpose:
--   1) Keep hours calculation in Supabase (no app-side payroll math).
--   2) Split non-lead pay by minute:
--      - Department lead on duty at that minute => regular pay.
--      - Department lead off duty at that minute => lead pay.
--   3) Preserve overtime split after first 8 hours of each shift.

begin;

create or replace view public.v_crew_day_hours as
with shift_base as (
  select
    s.location_id,
    s.work_date,
    s.crew_id,
    upper(btrim(coalesce(s.day_description, ''))) as day_desc,
    coalesce(c.is_department_lead, false) as is_department_lead,
    nullif(
      trim(
        regexp_replace(
          lower(regexp_replace(coalesce(c.home_department, ''), '[^a-zA-Z0-9]+', ' ', 'g')),
          '\s+',
          ' ',
          'g'
        )
      ),
      ''
    ) as dept_key,
    (
      extract(hour from s.start_time)::int * 60
      + extract(minute from s.start_time)::int
    ) as start_minute,
    (
      extract(hour from s.end_time)::int * 60
      + extract(minute from s.end_time)::int
    ) as end_minute
  from public.crew_work_shifts s
  join public.crew_roster c
    on c.location_id = s.location_id
   and c.id = s.crew_id
  where s.start_time is not null
    and s.end_time is not null
),
valid_shifts as (
  select
    sb.location_id,
    sb.work_date,
    sb.crew_id,
    sb.day_desc,
    sb.is_department_lead,
    sb.dept_key,
    sb.start_minute,
    sb.end_minute,
    case
      when sb.end_minute > sb.start_minute then sb.end_minute - sb.start_minute
      when sb.end_minute < sb.start_minute then (sb.end_minute + 1440) - sb.start_minute
      else 1440
    end as duration_minutes
  from shift_base sb
  where sb.day_desc not in ('OFF', 'PTO')
),
dept_has_lead as (
  select distinct
    c.location_id,
    nullif(
      trim(
        regexp_replace(
          lower(regexp_replace(coalesce(c.home_department, ''), '[^a-zA-Z0-9]+', ' ', 'g')),
          '\s+',
          ' ',
          'g'
        )
      ),
      ''
    ) as dept_key
  from public.crew_roster c
  where coalesce(c.is_department_lead, false) = true
),
lead_on_duty as (
  select
    vs.location_id,
    vs.work_date,
    vs.dept_key,
    ((vs.start_minute + g.m) % 1440) as minute_of_day
  from valid_shifts vs
  join generate_series(0, 1439) as g(m)
    on g.m < vs.duration_minutes
  where vs.is_department_lead = true
    and vs.dept_key is not null
  group by
    vs.location_id,
    vs.work_date,
    vs.dept_key,
    ((vs.start_minute + g.m) % 1440)
),
worker_minutes as (
  select
    vs.location_id,
    vs.work_date,
    vs.crew_id,
    vs.dept_key,
    vs.is_department_lead,
    (g.m >= 480) as is_overtime,
    ((vs.start_minute + g.m) % 1440) as minute_of_day,
    (dhl.dept_key is not null) as has_designated_lead
  from valid_shifts vs
  join generate_series(0, 1439) as g(m)
    on g.m < vs.duration_minutes
  left join dept_has_lead dhl
    on dhl.location_id = vs.location_id
   and dhl.dept_key = vs.dept_key
),
classified_minutes as (
  select
    wm.location_id,
    wm.work_date,
    wm.crew_id,
    wm.is_overtime,
    case
      when wm.is_department_lead then 'lead'
      when wm.has_designated_lead and lod.minute_of_day is null then 'lead'
      else 'regular'
    end as pay_type
  from worker_minutes wm
  left join lead_on_duty lod
    on lod.location_id = wm.location_id
   and lod.work_date = wm.work_date
   and lod.dept_key = wm.dept_key
   and lod.minute_of_day = wm.minute_of_day
)
select
  cm.location_id,
  cm.work_date,
  cm.crew_id,
  round(count(*)::numeric / 60.0, 2) as total_hours,
  round(
    sum(case when cm.pay_type = 'lead' and not cm.is_overtime then 1 else 0 end)::numeric / 60.0,
    2
  ) as lead_hours,
  round(
    sum(case when cm.pay_type = 'regular' and not cm.is_overtime then 1 else 0 end)::numeric / 60.0,
    2
  ) as hours,
  round(
    sum(case when cm.pay_type = 'regular' and cm.is_overtime then 1 else 0 end)::numeric / 60.0,
    2
  ) as regular_overtime_hours,
  round(
    sum(case when cm.pay_type = 'lead' and cm.is_overtime then 1 else 0 end)::numeric / 60.0,
    2
  ) as lead_overtime_hours
from classified_minutes cm
group by
  cm.location_id,
  cm.work_date,
  cm.crew_id;

grant select on public.v_crew_day_hours to anon, authenticated, service_role;

commit;
