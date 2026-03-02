alter table public.crew_roster
add column if not exists employment_type text;

update public.crew_roster
set employment_type = 'Full-Time'
where coalesce(btrim(employment_type), '') = '';

update public.crew_roster
set employment_type = case
  when lower(btrim(employment_type)) in ('on-call', 'on call', 'oncall') then 'On-Call'
  else 'Full-Time'
end;

alter table public.crew_roster
alter column employment_type set default 'Full-Time';

alter table public.crew_roster
alter column employment_type set not null;

alter table public.crew_roster
drop constraint if exists crew_roster_employment_type_check;

alter table public.crew_roster
add constraint crew_roster_employment_type_check
check (employment_type in ('Full-Time', 'On-Call'));
