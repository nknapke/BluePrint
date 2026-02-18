alter table if exists public.track_definitions
add column if not exists is_show_critical boolean not null default false;
