-- Planner function patch
-- Date: 2026-02-16
-- Purpose: Keep planning look-ahead window fixed at 14 days (no expansion).

begin;

create or replace function public.generate_training_plan_v1(
  p_location_id bigint,
  p_start_date date
)
returns bigint
language plpgsql
as $function$
declare
  v_plan_id bigint;
  v_end_date date := p_start_date + 13;
  v_day date;
  v_day_id bigint;

  v_window_days int := 14;

  v_best_group_id bigint;
  v_best_score numeric;
  v_best_people int;
  v_best_extreme int;
  v_best_reason text;
begin
  -- Create or reset plan header
  insert into public.training_plans (location_id, start_date, end_date, status, title)
  values (p_location_id, p_start_date, v_end_date, 'Draft', 'Auto Plan v1')
  on conflict (location_id, start_date) do update
    set end_date = excluded.end_date,
        status = 'Draft',
        title = excluded.title,
        updated_at = now()
  returning id into v_plan_id;

  -- Ensure day rows exist
  insert into public.training_plan_days
    (plan_id, location_id, plan_date, status)
  select
    v_plan_id,
    p_location_id,
    d::date,
    'Planned'
  from generate_series(p_start_date, v_end_date, interval '1 day') d
  on conflict (plan_id, plan_date) do nothing;

  -- Temp table for sequential simulation
  create temporary table if not exists tmp_sim_records (
    record_id bigint primary key,
    location_id bigint not null,
    crew_id bigint not null,
    track_id int not null,
    training_id int not null,
    expires_after_weeks int not null,
    due_soon_days int not null,
    last_completed date null
  ) on commit drop;

  truncate table tmp_sim_records;

  insert into tmp_sim_records (
    record_id,
    location_id,
    crew_id,
    track_id,
    training_id,
    expires_after_weeks,
    due_soon_days,
    last_completed
  )
  select
    r.id,
    r.location_id,
    r.crew_id,
    r.track_id,
    r.training_id,
    coalesce(td.expires_after_weeks, 0),
    coalesce(td.due_soon_days, 14),
    r.last_completed
  from public.crew_training_records r
  join public.training_definitions td
    on td.id = r.training_id
   and td.location_id = r.location_id
  where r.location_id = p_location_id
    and r.is_record_active = true;

  v_day := p_start_date;

  while v_day <= v_end_date loop
    select id into v_day_id
    from public.training_plan_days
    where plan_id = v_plan_id and plan_date = v_day;

    -- Score groups and pick best (fixed 14-day look-ahead)
    with need_rows as (
      select
        td.training_group_id as group_id,
        sr.record_id,
        sr.crew_id,
        sr.training_id,
        case
          when sr.last_completed is null then null::date
          when sr.expires_after_weeks is null or sr.expires_after_weeks = 0 then null::date
          else sr.last_completed + (sr.expires_after_weeks * 7)
        end as due_date,
        case
          when sr.last_completed is null then 'Training Due'
          when sr.expires_after_weeks is null or sr.expires_after_weeks = 0 then 'Training Complete'
          when (sr.last_completed + (sr.expires_after_weeks * 7)) < v_day then 'Training Overdue'
          when (sr.last_completed + (sr.expires_after_weeks * 7)) <= (v_day + v_window_days) then 'Training Due'
          else 'Training Complete'
        end as status_label,
        case
          when sr.last_completed is null then null::int
          when sr.expires_after_weeks is null or sr.expires_after_weeks = 0 then 0
          else greatest(0, (v_day - (sr.last_completed + (sr.expires_after_weeks * 7)))::int)
        end as days_overdue,
        case
          when sr.last_completed is null then null::int
          when sr.expires_after_weeks is null or sr.expires_after_weeks = 0 then null::int
          else greatest(0, ((sr.last_completed + (sr.expires_after_weeks * 7)) - v_day)::int)
        end as days_until_due
      from tmp_sim_records sr
      join public.training_definitions td
        on td.id = sr.training_id
       and td.location_id = sr.location_id
      join public.work_roster_assignments w
        on w.location_id = sr.location_id
       and w.crew_id = sr.crew_id
       and w.work_date = v_day
       and w.is_working = true
       and w.track_id is not null
       and w.track_id = sr.track_id
      join public.v_first_show_for_day fs
        on fs.location_id = w.location_id
       and fs.show_date = w.work_date
       and w.show_id = fs.show_id
      join public.crew_roster c
        on c.id = w.crew_id
       and c.location_id = w.location_id
       and c.status = 'Active'
      join public.crew_track_signoffs s
        on s.crew_id = w.crew_id
       and s.location_id = w.location_id
       and s.track_id = w.track_id
       and s.is_signoff_active = true
       and s.signoff_status in ('Yes','Training')
      join public.v_track_requires_group trg
        on trg.location_id = sr.location_id
       and trg.track_id = w.track_id
       and trg.training_group_id = td.training_group_id
      where sr.location_id = p_location_id
        and td.is_training_active = true
        and td.training_group_id is not null
        and (
          sr.last_completed is null
          or (sr.last_completed + (sr.expires_after_weeks * 7)) <= (v_day + v_window_days)
        )
    ),
    scored_items as (
      select
        group_id,
        crew_id,
        record_id,
        public.urgency_score(v_day, due_date, days_overdue, days_until_due, status_label) as u,
        case when coalesce(days_overdue, 0) >= 30 then 1 else 0 end as is_extreme
      from need_rows
    ),
    group_rollup as (
      select
        g.id as group_id,
        count(distinct s.crew_id) as people_helped,
        sum(s.is_extreme) as extreme_count,
        max(s.u) as base_u,
        count(*) as need_count
      from public.training_groups g
      left join scored_items s
        on s.group_id = g.id
      where g.location_id = p_location_id
        and g.active = true
      group by g.id
      having count(s.record_id) > 0
    ),
    group_bonus as (
      select
        s.group_id,
        sum(s.u) - max(s.u) as sum_others_u
      from scored_items s
      group by s.group_id
    ),
    group_scored as (
      select
        r.group_id,
        r.people_helped,
        r.extreme_count,
        r.base_u,
        (0.20 * (coalesce(b.sum_others_u, 0)) / sqrt(1 + r.need_count::numeric)) as bonus_u,
        (8 * ln(1 + r.people_helped::numeric)) as eff_u,
        (
          r.base_u
          + (0.20 * (coalesce(b.sum_others_u, 0)) / sqrt(1 + r.need_count::numeric))
          + (8 * ln(1 + r.people_helped::numeric))
        ) as total_score
      from group_rollup r
      left join group_bonus b on b.group_id = r.group_id
    ),
    top5 as (
      select *
      from group_scored
      order by total_score desc
      limit 5
    )
    select
      t.group_id,
      t.total_score,
      t.people_helped,
      t.extreme_count,
      (
        'best score=' || round(t.total_score, 1)::text ||
        ', people=' || t.people_helped::text ||
        ', extreme=' || t.extreme_count::text ||
        ', window=' || v_window_days::text || 'd'
      ) as reason
    into v_best_group_id, v_best_score, v_best_people, v_best_extreme, v_best_reason
    from top5 t
    order by t.total_score desc
    limit 1;

    -- Update plan day
    update public.training_plan_days
    set
      training_group_id = v_best_group_id,
      status = 'Planned',
      people_affected = coalesce(v_best_people, 0),
      extreme_overdue_count = coalesce(v_best_extreme, 0),
      reasoning_summary = v_best_reason,
      updated_at = now()
    where id = v_day_id;

    -- Rebuild Auto attendees and persist reason snapshot
    delete from public.training_plan_day_attendees
    where day_id = v_day_id and source = 'Auto';

    with auto_rows as (
      select distinct
        w2.crew_id,
        w2.track_id
      from public.work_roster_assignments w2
      join public.v_first_show_for_day fs
        on fs.location_id = w2.location_id
       and fs.show_date = w2.work_date
       and w2.show_id = fs.show_id
      join public.crew_roster c
        on c.id = w2.crew_id
       and c.location_id = w2.location_id
      join public.crew_track_signoffs s
        on s.crew_id = w2.crew_id
       and s.location_id = w2.location_id
       and s.track_id = w2.track_id
      join public.v_track_requires_group trg
        on trg.location_id = s.location_id
       and trg.track_id = s.track_id
      where w2.location_id = p_location_id
        and w2.work_date = v_day
        and w2.is_working = true
        and w2.track_id is not null
        and c.status = 'Active'
        and s.is_signoff_active = true
        and s.signoff_status in ('Yes','Training')
        and trg.training_group_id = v_best_group_id
    )
    insert into public.training_plan_day_attendees (
      day_id,
      location_id,
      crew_id,
      included,
      source,
      is_out_of_date,
      no_prior_training,
      is_extreme_overdue,
      simulated_last_completed,
      actual_last_completed
    )
    select
      v_day_id,
      p_location_id,
      ar.crew_id,
      true,
      'Auto'::public.attendee_source,
      coalesce(f.is_out_of_date, false),
      coalesce(f.no_prior_training, false),
      coalesce(f.is_extreme_overdue, false),
      case
        when coalesce(f.is_out_of_date, false)
          or coalesce(f.no_prior_training, false)
          or coalesce(f.is_extreme_overdue, false)
        then v_day
        else f.actual_last_completed
      end as simulated_last_completed,
      f.actual_last_completed
    from auto_rows ar
    left join lateral (
      select
        bool_or(
          case
            when sr.expires_after_weeks <= 0 then false
            when sr.last_completed is null then true
            else (sr.last_completed + (sr.expires_after_weeks * 7)) < v_day
          end
        ) as is_out_of_date,
        bool_or(sr.last_completed is null) as no_prior_training,
        bool_or(
          case
            when sr.expires_after_weeks <= 0 then false
            when sr.last_completed is null then false
            else (sr.last_completed + (sr.expires_after_weeks * 7)) < (v_day - 30)
          end
        ) as is_extreme_overdue,
        max(sr.last_completed) as actual_last_completed
      from tmp_sim_records sr
      join public.training_definitions td
        on td.id = sr.training_id
       and td.location_id = p_location_id
       and td.training_group_id = v_best_group_id
       and td.is_training_active = true
      where sr.location_id = p_location_id
        and sr.crew_id = ar.crew_id
        and sr.track_id = ar.track_id
    ) f on true
    on conflict (day_id, crew_id) do update
      set
        is_out_of_date = excluded.is_out_of_date,
        no_prior_training = excluded.no_prior_training,
        is_extreme_overdue = excluded.is_extreme_overdue,
        simulated_last_completed = excluded.simulated_last_completed,
        actual_last_completed = excluded.actual_last_completed,
        updated_at = now();

    -- Sequential simulation: assume people who need this group's training complete it today
    update tmp_sim_records sr
    set last_completed = v_day
    from public.training_definitions td
    join public.work_roster_assignments w
      on w.location_id = p_location_id
     and w.work_date = v_day
     and w.is_working = true
     and w.track_id is not null
    join public.v_first_show_for_day fs
      on fs.location_id = w.location_id
     and fs.show_date = w.work_date
     and w.show_id = fs.show_id
    join public.crew_roster c
      on c.id = w.crew_id
     and c.location_id = w.location_id
     and c.status = 'Active'
    join public.crew_track_signoffs s
      on s.crew_id = w.crew_id
     and s.location_id = w.location_id
     and s.track_id = w.track_id
     and s.is_signoff_active = true
     and s.signoff_status in ('Yes','Training')
    join public.v_track_requires_group trg
      on trg.location_id = p_location_id
     and trg.track_id = w.track_id
     and trg.training_group_id = v_best_group_id
    where sr.location_id = p_location_id
      and sr.crew_id = w.crew_id
      and sr.track_id = w.track_id
      and sr.training_id = td.id
      and td.location_id = p_location_id
      and td.training_group_id = v_best_group_id
      and td.is_training_active = true
      and (
        sr.last_completed is null
        or (sr.last_completed + (sr.expires_after_weeks * 7)) <= (v_day + v_window_days)
      );

    v_day := v_day + 1;
  end loop;

  return v_plan_id;
end;
$function$;

commit;
