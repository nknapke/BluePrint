-- Crew day-hours patch: daily + weekly overtime
-- Date: 2026-02-22
-- Purpose:
--   Apply BOTH overtime rules:
--   1) Daily overtime after 8 paid hours/day
--   2) Weekly overtime after 40 paid base hours/week (Mon-Sun)
--
-- Notes:
--   - Lunch deduction rule stays the same.
--   - Weekly overtime is applied on remaining straight-time minutes after daily OT split.
--   - No double-counting between daily and weekly OT.

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
    sum(case when cm.pay_type = 'lead' then 1 else 0 end)::int as lead_minutes,
    sum(case when cm.pay_type = 'regular' then 1 else 0 end)::int as regular_minutes,
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
deduct_regular as (
  select
    lp.*,
    least(lp.regular_minutes, lp.unpaid_lunch_minutes) as deduct_regular_minutes,
    greatest(
      lp.unpaid_lunch_minutes - least(lp.regular_minutes, lp.unpaid_lunch_minutes),
      0
    ) as remaining_after_regular
  from lunch_plan lp
),
deduct_lead as (
  select
    dr.*,
    least(dr.lead_minutes, dr.remaining_after_regular) as deduct_lead_minutes
  from deduct_regular dr
),
day_paid as (
  select
    dl.location_id,
    dl.work_date,
    dl.crew_id,
    date_trunc('week', dl.work_date::timestamp)::date as week_start,
    greatest(dl.regular_minutes - dl.deduct_regular_minutes, 0)::int as regular_paid_minutes,
    greatest(dl.lead_minutes - dl.deduct_lead_minutes, 0)::int as lead_paid_minutes,
    (
      greatest(dl.regular_minutes - dl.deduct_regular_minutes, 0)
      + greatest(dl.lead_minutes - dl.deduct_lead_minutes, 0)
    )::int as paid_day_minutes
  from deduct_lead dl
),
daily_split as (
  select
    dp.*,
    least(dp.paid_day_minutes, 480)::int as daily_base_minutes,
    least(dp.regular_paid_minutes, least(dp.paid_day_minutes, 480))::int as regular_daily_base_minutes,
    least(
      dp.lead_paid_minutes,
      greatest(
        0,
        least(dp.paid_day_minutes, 480)
        - least(dp.regular_paid_minutes, least(dp.paid_day_minutes, 480))
      )
    )::int as lead_daily_base_minutes
  from day_paid dp
),
weekly_base_window as (
  select
    ds.*,
    coalesce(
      sum(ds.daily_base_minutes) over (
        partition by ds.location_id, ds.crew_id, ds.week_start
        order by ds.work_date
        rows between unbounded preceding and 1 preceding
      ),
      0
    )::int as prior_week_base_minutes
  from daily_split ds
),
weekly_split as (
  select
    wb.*,
    greatest(0, 2400 - wb.prior_week_base_minutes)::int as weekly_base_capacity_minutes,
    least(
      wb.daily_base_minutes,
      greatest(0, 2400 - wb.prior_week_base_minutes)
    )::int as weekly_base_minutes_for_day
  from weekly_base_window wb
),
final_split as (
  select
    ws.location_id,
    ws.work_date,
    ws.crew_id,
    ws.paid_day_minutes,
    least(ws.regular_daily_base_minutes, ws.weekly_base_minutes_for_day)::int as regular_base_minutes,
    least(
      ws.lead_daily_base_minutes,
      greatest(
        0,
        ws.weekly_base_minutes_for_day
        - least(ws.regular_daily_base_minutes, ws.weekly_base_minutes_for_day)
      )
    )::int as lead_base_minutes,
    greatest(
      ws.regular_paid_minutes
      - least(ws.regular_daily_base_minutes, ws.weekly_base_minutes_for_day),
      0
    )::int as regular_ot_minutes,
    greatest(
      ws.lead_paid_minutes
      - least(
          ws.lead_daily_base_minutes,
          greatest(
            0,
            ws.weekly_base_minutes_for_day
            - least(ws.regular_daily_base_minutes, ws.weekly_base_minutes_for_day)
          )
        ),
      0
    )::int as lead_ot_minutes
  from weekly_split ws
)
select
  fs.location_id,
  fs.work_date,
  fs.crew_id,
  round(fs.paid_day_minutes::numeric / 60.0, 2) as total_hours,
  round(fs.lead_base_minutes::numeric / 60.0, 2) as lead_hours,
  round(fs.regular_base_minutes::numeric / 60.0, 2) as hours,
  round(fs.regular_ot_minutes::numeric / 60.0, 2) as regular_overtime_hours,
  round(fs.lead_ot_minutes::numeric / 60.0, 2) as lead_overtime_hours
from final_split fs;

grant select on public.v_crew_day_hours to anon, authenticated, service_role;

commit;
