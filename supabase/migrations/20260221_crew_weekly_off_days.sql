-- Crew roster patch
-- Date: 2026-02-21
-- Purpose: Store each crew member's two standard weekly days off.

begin;

alter table if exists public.crew_roster
  add column if not exists weekly_off_day_1 smallint,
  add column if not exists weekly_off_day_2 smallint;

alter table if exists public.crew_roster
  drop constraint if exists crew_roster_weekly_off_day_1_chk;
alter table if exists public.crew_roster
  drop constraint if exists crew_roster_weekly_off_day_2_chk;
alter table if exists public.crew_roster
  drop constraint if exists crew_roster_weekly_off_days_distinct_chk;

alter table if exists public.crew_roster
  add constraint crew_roster_weekly_off_day_1_chk
    check (weekly_off_day_1 is null or (weekly_off_day_1 between 0 and 6));
alter table if exists public.crew_roster
  add constraint crew_roster_weekly_off_day_2_chk
    check (weekly_off_day_2 is null or (weekly_off_day_2 between 0 and 6));
alter table if exists public.crew_roster
  add constraint crew_roster_weekly_off_days_distinct_chk
    check (
      weekly_off_day_1 is null
      or weekly_off_day_2 is null
      or weekly_off_day_1 <> weekly_off_day_2
    );

commit;
