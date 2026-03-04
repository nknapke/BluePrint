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

create table if not exists public.departments (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  created_at timestamptz not null default now()
);

create unique index if not exists departments_name_unique_idx
  on public.departments (lower(name));

create table if not exists public.inventory_items (
  id uuid primary key default gen_random_uuid(),
  department_id uuid not null references public.departments(id) on delete cascade,
  name text not null,
  photo_url text,
  notes text,
  low_stock_threshold integer check (low_stock_threshold is null or low_stock_threshold >= 0),
  created_by uuid,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index if not exists inventory_items_department_name_unique_idx
  on public.inventory_items (department_id, lower(name));

create index if not exists inventory_items_department_idx
  on public.inventory_items (department_id);

drop trigger if exists inventory_items_set_updated_at on public.inventory_items;
create trigger inventory_items_set_updated_at
before update on public.inventory_items
for each row
execute function public.inventory_set_updated_at();

create table if not exists public.inventory_locations (
  id uuid primary key default gen_random_uuid(),
  department_id uuid not null references public.departments(id) on delete cascade,
  name text not null,
  notes text,
  created_by uuid,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index if not exists inventory_locations_department_name_unique_idx
  on public.inventory_locations (department_id, lower(name));

create index if not exists inventory_locations_department_idx
  on public.inventory_locations (department_id);

drop trigger if exists inventory_locations_set_updated_at on public.inventory_locations;
create trigger inventory_locations_set_updated_at
before update on public.inventory_locations
for each row
execute function public.inventory_set_updated_at();

create table if not exists public.inventory_stock_levels (
  id uuid primary key default gen_random_uuid(),
  department_id uuid not null references public.departments(id) on delete cascade,
  item_id uuid not null references public.inventory_items(id) on delete cascade,
  location_id uuid not null references public.inventory_locations(id),
  quantity integer not null default 0 check (quantity >= 0),
  last_updated_at timestamptz not null default now(),
  last_updated_by uuid,
  constraint inventory_stock_levels_item_location_unique unique (item_id, location_id)
);

create index if not exists inventory_stock_levels_department_idx
  on public.inventory_stock_levels (department_id);

create index if not exists inventory_stock_levels_item_idx
  on public.inventory_stock_levels (item_id);

create index if not exists inventory_stock_levels_location_idx
  on public.inventory_stock_levels (location_id);

create index if not exists inventory_stock_levels_last_updated_idx
  on public.inventory_stock_levels (last_updated_at desc);

create table if not exists public.inventory_events (
  id uuid primary key default gen_random_uuid(),
  department_id uuid references public.departments(id) on delete set null,
  item_id uuid references public.inventory_items(id) on delete set null,
  location_id uuid references public.inventory_locations(id) on delete set null,
  event_type text not null,
  delta integer not null default 0,
  new_quantity integer check (new_quantity is null or new_quantity >= 0),
  actor_id uuid,
  created_at timestamptz not null default now()
);

create index if not exists inventory_events_department_idx
  on public.inventory_events (department_id);

create index if not exists inventory_events_item_idx
  on public.inventory_events (item_id);

create index if not exists inventory_events_location_idx
  on public.inventory_events (location_id);

create index if not exists inventory_events_created_at_idx
  on public.inventory_events (created_at desc);

create or replace view public.v_inventory_item_summaries as
with department_locations as (
  select
    l.department_id,
    count(*)::integer as department_location_count
  from public.inventory_locations l
  group by l.department_id
),
stock_rollup as (
  select
    s.item_id,
    sum(s.quantity)::integer as total_inventory,
    count(*)::integer as stock_row_count,
    count(*) filter (where s.quantity > 0)::integer as nonzero_location_count,
    max(s.last_updated_at) as stock_last_updated_at,
    string_agg(
      distinct l.name,
      ' • ' order by l.name
    ) filter (where s.quantity > 0) as search_location_names
  from public.inventory_stock_levels s
  join public.inventory_locations l
    on l.id = s.location_id
  group by s.item_id
),
latest_actor as (
  select distinct on (s.item_id)
    s.item_id,
    s.last_updated_by
  from public.inventory_stock_levels s
  order by s.item_id, s.last_updated_at desc, s.id desc
)
select
  i.id,
  i.department_id,
  i.name,
  i.photo_url,
  i.notes,
  i.low_stock_threshold,
  i.created_by,
  i.created_at,
  i.updated_at,
  coalesce(sr.total_inventory, 0) as total_inventory,
  coalesce(dl.department_location_count, 0) as location_count,
  coalesce(sr.nonzero_location_count, 0) as populated_location_count,
  coalesce(sr.stock_row_count, 0) as stock_row_count,
  coalesce(sr.search_location_names, '') as search_location_names,
  greatest(i.updated_at, coalesce(sr.stock_last_updated_at, i.updated_at)) as recently_updated_at,
  la.last_updated_by
from public.inventory_items i
left join stock_rollup sr
  on sr.item_id = i.id
left join department_locations dl
  on dl.department_id = i.department_id
left join latest_actor la
  on la.item_id = i.id;

grant select, insert, update, delete on public.departments to anon, authenticated, service_role;
grant select, insert, update, delete on public.inventory_items to anon, authenticated, service_role;
grant select, insert, update, delete on public.inventory_locations to anon, authenticated, service_role;
grant select, insert, update, delete on public.inventory_stock_levels to anon, authenticated, service_role;
grant select, insert on public.inventory_events to anon, authenticated, service_role;
grant select on public.v_inventory_item_summaries to anon, authenticated, service_role;

insert into public.departments (name)
select 'Props'
where not exists (
  select 1
  from public.departments d
  where lower(d.name) = 'props'
);

commit;
