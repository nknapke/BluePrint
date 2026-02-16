-- Planner view schema patch (corrected)
-- Date: 2026-02-16
-- Purpose: Ensure planner attendee/review views expose all columns required by the UI.

begin;

create or replace view public.v_plan_day_effective_attendees as
with day_ctx as (
  select
    d.id as day_id,
    d.plan_id,
    d.plan_date,
    d.training_group_id,
    p.location_id
  from public.training_plan_days d
  join public.training_plans p
    on p.id = d.plan_id
),
first_show as (
  select distinct on (si.location_id, si.show_date)
    si.location_id,
    si.show_date as work_date,
    si.id as first_show_id
  from public.show_instances si
  order by
    si.location_id,
    si.show_date,
    coalesce(si.sort_order, 2147483647),
    si.show_time nulls last,
    si.id
),
assignment_for_day as (
  select distinct on (dc.day_id, wra.crew_id)
    dc.day_id,
    wra.crew_id,
    coalesce(wra.is_working, false) as is_working,
    wra.track_id
  from day_ctx dc
  left join first_show fs
    on fs.location_id = dc.location_id
   and fs.work_date = dc.plan_date
  join public.work_roster_assignments wra
    on wra.location_id = dc.location_id
   and wra.work_date = dc.plan_date
  order by
    dc.day_id,
    wra.crew_id,
    case
      when fs.first_show_id is not null and wra.show_id = fs.first_show_id then 0
      when wra.show_id is null then 1
      else 2
    end,
    wra.id
),
required_training as (
  select
    a.id as attendee_id,
    a.day_id,
    a.crew_id,
    afd.track_id,
    td.id as training_id,
    coalesce(td.expires_after_weeks, 0)::int as expires_after_weeks
  from public.training_plan_day_attendees a
  join day_ctx dc
    on dc.day_id = a.day_id
  left join assignment_for_day afd
    on afd.day_id = a.day_id
   and afd.crew_id = a.crew_id
  join public.track_training_requirements trq
    on trq.track_id = afd.track_id
   and coalesce(trq.is_requirement_active, true)
   and (trq.location_id = dc.location_id or trq.location_id is null)
  join public.training_definitions td
    on td.id = trq.training_id
   and td.training_group_id = dc.training_group_id
   and coalesce(td.is_training_active, true)
   and (td.location_id = dc.location_id or td.location_id is null)
),
record_eval as (
  select
    rt.attendee_id,
    rt.day_id,
    rt.crew_id,
    rt.track_id,
    rt.training_id,
    rt.expires_after_weeks,
    ctr.last_completed::date as last_completed,
    case
      when ctr.id is null or ctr.last_completed is null then true
      else false
    end as no_prior_training,
    case
      when rt.expires_after_weeks <= 0 then false
      when ctr.id is null or ctr.last_completed is null then true
      else (ctr.last_completed::date + make_interval(weeks => rt.expires_after_weeks))::date < dc.plan_date
    end as is_out_of_date,
    case
      when rt.expires_after_weeks <= 0 then false
      when ctr.id is null or ctr.last_completed is null then false
      else (ctr.last_completed::date + make_interval(weeks => rt.expires_after_weeks))::date < (dc.plan_date - interval '30 day')::date
    end as is_extreme_overdue
  from required_training rt
  join day_ctx dc
    on dc.day_id = rt.day_id
  left join public.crew_training_records ctr
    on ctr.crew_id = rt.crew_id
   and ctr.track_id = rt.track_id
   and ctr.training_id = rt.training_id
   and coalesce(ctr.is_record_active, true)
   and (ctr.location_id = dc.location_id or ctr.location_id is null)
),
reason_rollup as (
  select
    re.attendee_id,
    re.day_id,
    re.crew_id,
    re.track_id,
    bool_or(re.is_out_of_date) as is_out_of_date,
    bool_or(re.no_prior_training) as no_prior_training,
    bool_or(re.is_extreme_overdue) as is_extreme_overdue,
    max(re.last_completed) as actual_last_completed
  from record_eval re
  group by
    re.attendee_id,
    re.day_id,
    re.crew_id,
    re.track_id
)
select
  a.id as attendee_id,
  a.day_id,
  dc.location_id,
  a.crew_id,
  a.included,
  a.source,
  coalesce(afd.is_working, false) as is_working,
  afd.track_id,
  trk.track_name,
  coalesce(rr.is_out_of_date, false) as is_out_of_date,
  coalesce(rr.no_prior_training, false) as no_prior_training,
  coalesce(rr.is_extreme_overdue, false) as is_extreme_overdue,
  case
    when a.included
      and coalesce(afd.is_working, false)
      and (
        coalesce(rr.is_out_of_date, false)
        or coalesce(rr.no_prior_training, false)
        or coalesce(rr.is_extreme_overdue, false)
      )
    then dc.plan_date
    else rr.actual_last_completed
  end as simulated_last_completed,
  rr.actual_last_completed,
  cr.crew_name,
  cr.status as crew_status
from public.training_plan_day_attendees a
join day_ctx dc
  on dc.day_id = a.day_id
left join assignment_for_day afd
  on afd.day_id = a.day_id
 and afd.crew_id = a.crew_id
left join public.crew_roster cr
  on cr.id = a.crew_id
left join public.track_definitions trk
  on trk.id = afd.track_id
left join reason_rollup rr
  on rr.attendee_id = a.id
 and rr.day_id = a.day_id;

create or replace view public.v_plan_day_attendee_review as
select
  e.attendee_id,
  e.day_id,
  e.location_id,
  e.crew_id,
  e.crew_name,
  e.crew_status,
  e.included,
  e.source,
  e.is_working,
  e.track_id,
  e.track_name,
  e.is_out_of_date,
  e.no_prior_training,
  e.is_extreme_overdue,
  e.simulated_last_completed,
  e.actual_last_completed
from public.v_plan_day_effective_attendees e;

grant select on public.v_plan_day_effective_attendees to anon, authenticated, service_role;
grant select on public.v_plan_day_attendee_review to anon, authenticated, service_role;

commit;
