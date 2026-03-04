begin;

create extension if not exists pgcrypto;

create or replace function public.inventory_set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create table if not exists public.inventory_actors (
  id uuid primary key default gen_random_uuid(),
  display_name text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists inventory_actors_display_name_idx
  on public.inventory_actors (lower(display_name));

drop trigger if exists inventory_actors_set_updated_at on public.inventory_actors;
create trigger inventory_actors_set_updated_at
before update on public.inventory_actors
for each row
execute function public.inventory_set_updated_at();

grant select, insert, update, delete on public.inventory_actors to anon, authenticated, service_role;

commit;
