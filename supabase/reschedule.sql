-- In the SQL Editor, open a new weekend programme after booking has closed.
-- Future workshops keep their dates and tickets. Past tickets keep their original dates.
update public.workshops w
set starts_at = public.next_workshop_start(w.offset_hours, now())
where w.offset_hours is not null and w.starts_at <= now()
returning w.slug, w.starts_at, w.capacity, w.reserved;
