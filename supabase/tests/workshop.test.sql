begin;
create extension if not exists pgtap with schema extensions;
set local search_path = public, extensions;
select plan(20);
select is(public.next_workshop_start(10, '2026-11-23 00:00Z'), '2026-11-28 10:00Z'::timestamptz, 'Monday selects the coming Saturday');
select is(public.next_workshop_start(10, '2026-11-27 18:00Z'), '2026-11-28 10:00Z'::timestamptz, 'Friday still selects the coming Saturday');
select is(public.next_workshop_start(10, '2026-11-28 10:00Z'), '2026-12-05 10:00Z'::timestamptz, 'The morning workshop rolls at its start');
select is(public.next_workshop_start(14, '2026-11-28 10:00Z'), '2026-11-28 14:00Z'::timestamptz, 'The afternoon workshop remains available that day');
insert into public.workshops (slug, capacity, offset_hours, starts_at) values
  ('test-monday-class', 4, 58, now() - interval '1 week'),
  ('test-one-off', 4, null, now() - interval '1 week');
update public.workshops w set starts_at = public.next_workshop_start(w.offset_hours, now())
where w.offset_hours is not null and w.starts_at <= now() and w.slug in ('test-monday-class','test-one-off');
select is((select starts_at from public.workshops where slug = 'test-monday-class'),
  public.next_workshop_start(58, now()), 'A custom recurring workshop advances by its stored offset');
select is((select starts_at from public.workshops where slug = 'test-one-off'),
  now() - interval '1 week', 'A one-off workshop keeps its date');
insert into public.workshops (slug, capacity) values ('test-limited-workshop', 1);

select lives_ok($$insert into public.workshop_reservations (workshop_slug, booking_id) values ('test-limited-workshop', 'first')$$, 'A guest can take the last seat');
select throws_ok($$insert into public.workshop_reservations (workshop_slug, booking_id) values ('test-limited-workshop', 'second')$$, 'P0001', 'Booking closed', 'The next booking is rejected');
select is((select reserved from public.workshops where slug = 'test-limited-workshop'), 1, 'The rejected booking does not take a seat');
select throws_ok($$update public.workshops set starts_at = now() + interval '3 weeks' where slug = 'test-limited-workshop'$$, 'P0001', 'This upcoming session has reservations', 'An upcoming session with a ticket keeps its date');
delete from public.workshop_reservations where workshop_slug = 'test-limited-workshop' and booking_id = 'first';
select is((select reserved from public.workshops where slug = 'test-limited-workshop'), 0, 'Cancelling releases the seat');
select lives_ok($$update public.workshops set starts_at = now() + interval '3 weeks' where slug = 'test-limited-workshop'$$, 'An empty upcoming session can move');
select throws_ok($$insert into public.workshop_reservations values ('test-limited-workshop', 'stale', now() + interval '1 hour')$$, 'P0001', 'Booking closed', 'A stale schedule cannot take a seat');
select ok(not has_table_privilege('anon', 'public.workshop_reservations', 'SELECT'), 'Guests cannot list tickets');
select ok(not has_table_privilege('authenticated', 'public.workshop_reservations', 'DELETE'), 'Browser roles cannot cancel directly');
select ok(has_table_privilege('service_role', 'public.workshop_reservations', 'INSERT'), 'The server can book on behalf of a guest');

-- Initialise a historical snapshot; transaction time is fixed throughout this test.
insert into public.workshops (slug, capacity, reserved, starts_at) values ('test-past', 2, 1, now() - interval '1 week');
alter table public.workshop_reservations disable trigger reserve_slug;
insert into public.workshop_reservations values ('test-past', 'old-ticket', now() - interval '1 week');
alter table public.workshop_reservations enable trigger reserve_slug;
update public.workshops set starts_at = now() + interval '1 week' where slug = 'test-past';
select is((select reserved from public.workshops where slug = 'test-past'), 0, 'A replacement date starts empty');
select is((select count(*) from public.workshop_reservations where workshop_slug = 'test-past' and starts_at = now() - interval '1 week'), 1::bigint, 'The past ticket retains its original date');
insert into public.workshop_reservations (workshop_slug, booking_id) values ('test-past', 'new-ticket');
delete from public.workshop_reservations where workshop_slug = 'test-past' and booking_id = 'old-ticket';
select is((select reserved from public.workshops where slug = 'test-past'), 1, 'Removing a historical ticket preserves the replacement session count');
select throws_ok($$update public.workshops set starts_at = now() - interval '1 day' where slug = 'test-past'$$, 'P0001', 'Choose a future start time', 'Dates can only move to the future');
select * from finish();
rollback;
