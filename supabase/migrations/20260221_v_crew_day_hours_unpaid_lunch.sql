-- Crew day-hours patch
-- Date: 2026-02-21
-- Purpose:
--   Apply unpaid lunch deductions to paid hour buckets.
--
-- Rule implemented:
--   - If worked_minutes <= 360 (6h): 0 lunches
--   - Else lunches = floor(worked_minutes / 360)
--   - Each lunch is 30 unpaid minutes
--
-- Examples:
--   6.0h  -> 0 lunches -> 6.0 paid
--   6.5h  -> 1 lunch   -> 6.0 paid
--   7.0h  -> 1 lunch   -> 6.5 paid
--   8.0h  -> 1 lunch   -> 7.5 paid
--   12.0h -> 2 lunches -> 11.0 paid
--
-- Lunch deduction order (for pay buckets):
--   regular base -> lead base -> regular OT -> lead OT

begin;

drop view if exists public.v_crew_day_hours;

create view public.v_crew_day_hours as
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
),
minute_rollup as (
  select
    cm.location_id,
    cm.work_date,
    cm.crew_id,
    sum(case when cm.pay_type = 'lead' and not cm.is_overtime then 1 else 0 end)::int as lead_base_minutes,
    sum(case when cm.pay_type = 'regular' and not cm.is_overtime then 1 else 0 end)::int as regular_base_minutes,
    sum(case when cm.pay_type = 'regular' and cm.is_overtime then 1 else 0 end)::int as regular_ot_minutes,
    sum(case when cm.pay_type = 'lead' and cm.is_overtime then 1 else 0 end)::int as lead_ot_minutes,
    count(*)::int as total_minutes
  from classified_minutes cm
  group by cm.location_id, cm.work_date, cm.crew_id
),
lunch_plan as (
  select
    mr.*,
    case
      when mr.total_minutes <= 360 then 0
      else floor(mr.total_minutes::numeric / 360)::int
    end as lunch_break_count,
    case
      when mr.total_minutes <= 360 then 0
      else floor(mr.total_minutes::numeric / 360)::int * 30
    end as unpaid_lunch_minutes
  from minute_rollup mr
),
deduct_regular_base as (
  select
    lp.*,
    least(lp.regular_base_minutes, lp.unpaid_lunch_minutes) as deduct_regular_base_minutes,
    greatest(
      lp.unpaid_lunch_minutes - least(lp.regular_base_minutes, lp.unpaid_lunch_minutes),
      0
    ) as remaining_after_regular
  from lunch_plan lp
),
deduct_lead_base as (
  select
    dr.*,
    least(dr.lead_base_minutes, dr.remaining_after_regular) as deduct_lead_base_minutes,
    greatest(
      dr.remaining_after_regular - least(dr.lead_base_minutes, dr.remaining_after_regular),
      0
    ) as remaining_after_lead
  from deduct_regular_base dr
),
deduct_regular_ot as (
  select
    dl.*,
    least(dl.regular_ot_minutes, dl.remaining_after_lead) as deduct_regular_ot_minutes,
    greatest(
      dl.remaining_after_lead - least(dl.regular_ot_minutes, dl.remaining_after_lead),
      0
    ) as remaining_after_regular_ot
  from deduct_lead_base dl
),
deduct_lead_ot as (
  select
    dro.*,
    least(dro.lead_ot_minutes, dro.remaining_after_regular_ot) as deduct_lead_ot_minutes
  from deduct_regular_ot dro
)
select
  dlo.location_id,
  dlo.work_date,
  dlo.crew_id,
  round(
    (
      (dlo.lead_base_minutes - dlo.deduct_lead_base_minutes)
      + (dlo.regular_base_minutes - dlo.deduct_regular_base_minutes)
      + (dlo.regular_ot_minutes - dlo.deduct_regular_ot_minutes)
      + (dlo.lead_ot_minutes - dlo.deduct_lead_ot_minutes)
    )::numeric / 60.0,
    2
  ) as total_hours,
  round(
    (dlo.lead_base_minutes - dlo.deduct_lead_base_minutes)::numeric / 60.0,
    2
  ) as lead_hours,
  round(
    (dlo.regular_base_minutes - dlo.deduct_regular_base_minutes)::numeric / 60.0,
    2
  ) as hours,
  round(
    (dlo.regular_ot_minutes - dlo.deduct_regular_ot_minutes)::numeric / 60.0,
    2
  ) as regular_overtime_hours,
  round(
    (dlo.lead_ot_minutes - dlo.deduct_lead_ot_minutes)::numeric / 60.0,
    2
  ) as lead_overtime_hours
from deduct_lead_ot dlo;

grant select on public.v_crew_day_hours to anon, authenticated, service_role;

commit;
