create table public.workshops (
  slug text primary key,
  capacity integer not null check (capacity > 0),
  reserved integer not null default 0 check (reserved between 0 and capacity),
  starts_at timestamptz not null default (now() + interval '14 days'),
  -- NULL denotes a one-off session. Recurring hours are counted from Saturday 00:00 UTC.
  offset_hours integer check (offset_hours between 0 and 167)
);

create table public.workshop_reservations (
  workshop_slug text not null references public.workshops (slug),
  booking_id text not null,
  starts_at timestamptz not null,
  primary key (workshop_slug, booking_id)
);

alter table public.workshops enable row level security;
alter table public.workshop_reservations enable row level security;
revoke all on public.workshops, public.workshop_reservations from public, anon, authenticated;
grant select, update on public.workshops to service_role;
grant select, insert, delete on public.workshop_reservations to service_role;

create function public.reserve_workshop_seat() returns trigger
language plpgsql set search_path = '' as $$
begin
  update public.workshops
    set reserved = reserved + 1
    where slug = new.workshop_slug and reserved < capacity
      and starts_at > now() and (new.starts_at is null or starts_at = new.starts_at)
    returning starts_at into new.starts_at;
  if not found then
    raise exception 'Booking closed';
  end if;
  return new;
end;
$$;

create function public.release_workshop_seat() returns trigger
language plpgsql set search_path = '' as $$
begin
  update public.workshops set reserved = reserved - 1
    where slug = old.workshop_slug and starts_at = old.starts_at;
  return old;
end;
$$;

create function public.reschedule_workshop() returns trigger
language plpgsql set search_path = '' as $$
begin
  if new.starts_at <= now() then
    raise exception 'Choose a future start time';
  end if;
  if old.starts_at > now() and old.reserved > 0 then
    raise exception 'This upcoming session has reservations';
  end if;
  -- Tickets carry their original date. A new session starts with an empty room.
  new.reserved := 0;
  return new;
end;
$$;

revoke execute on function public.reserve_workshop_seat(), public.release_workshop_seat(), public.reschedule_workshop()
  from public, anon, authenticated;

create trigger reserve_slug before insert on public.workshop_reservations
for each row execute function public.reserve_workshop_seat();

create trigger release_slug after delete on public.workshop_reservations
for each row execute function public.release_workshop_seat();

create trigger change_workshop_date before update of starts_at on public.workshops
for each row when (old.starts_at is distinct from new.starts_at)
execute function public.reschedule_workshop();

-- Hours are counted from Saturday 00:00 UTC. Roll each session at its own start.
create function public.next_workshop_start(offset_hours integer, as_of timestamptz)
returns timestamptz language sql immutable strict set search_path = '' as $$
  with clock as (select as_of at time zone 'UTC' as utc_now),
  schedule as (
    select utc_now, date_trunc('week', utc_now + interval '2 days') - interval '2 days' +
      offset_hours * interval '1 hour' as starts from clock
  )
  select (case when starts <= utc_now then starts + interval '7 days' else starts end)
    at time zone 'UTC' from schedule;
$$;
revoke execute on function public.next_workshop_start(integer, timestamptz) from public, anon, authenticated;
