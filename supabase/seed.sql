-- Run once after the migration. Re-running preserves existing sessions and bookings.
insert into public.workshops (slug, capacity, offset_hours, starts_at)
select s.slug, s.capacity, s.offset_hours, public.next_workshop_start(s.offset_hours, now())
from (values
  ('folded-forms', 6, 10),
  ('relief-printing', 8, 14),
  ('thread-structures', 8, 34)
) as s(slug, capacity, offset_hours)
on conflict (slug) do nothing;

-- Deterministic sample tickets give the paper workshop one remaining seat.
insert into public.workshop_reservations (workshop_slug, booking_id)
select s.slug, 'studio-seed-' || n
from (values ('folded-forms', 5), ('relief-printing', 4), ('thread-structures', 2)) as s(slug, booked)
cross join lateral generate_series(1, s.booked) as n
where not exists (select 1 from public.workshop_reservations r
  where r.workshop_slug = s.slug and r.booking_id = 'studio-seed-' || n);
