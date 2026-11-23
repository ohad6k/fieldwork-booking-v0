// Display settings. Booking dates and weekly recurrence are stored in UTC.
export const STUDIO_LOCALE = 'en-GB';
export const STUDIO_TIME_ZONE = 'Europe/London';

export const programme = [
  {
    slug: 'folded-forms', number: '01', title: 'Folded forms', discipline: 'Paper',
    summary: 'Fold a single sheet of paper into a freestanding sculptural ring.',
    description: 'Turn a single sheet of paper into a freestanding sculpture. Learn a radial accordion fold, then shape your own edition.',
    material: 'Paper and bone folder', technique: 'Radial pleating', room: 'Paper studio',
    duration: 90, offsetHours: 10, capacity: 6, reserved: 5,
    alt: 'Hands score an accordion fold into white paper with a bone folder.',
  },
  {
    slug: 'relief-printing', number: '02', title: 'Relief printing', discipline: 'Print',
    summary: 'Carve a block of curved lines and pull a relief print by hand.',
    description: 'Carve a field of curved lines into a printing block. Ink the surface and pull a small series of relief prints by hand.',
    material: 'Lino, ink and paper', technique: 'Block printing', room: 'Print studio',
    duration: 120, offsetHours: 14, capacity: 8, reserved: 4,
    alt: 'A hand rolls dark ink onto a carved block beside a curved-line print.',
  },
  {
    slug: 'thread-structures', number: '03', title: 'Thread structures', discipline: 'Textile',
    summary: 'Wind one continuous thread around a ring of pins to draw a curve.',
    description: 'Build a curved form from straight threads. Set out a ring of pins, then wind a continuous line around the frame.',
    material: 'Cotton, pins and board', technique: 'String geometry', room: 'Textile studio',
    duration: 90, offsetHours: 34, capacity: 8, reserved: 2,
    alt: 'Hands pull white cotton thread around pins arranged in a curve.',
  },
];

export function demoSessions(now = new Date()) {
  const saturday = new Date(now);
  saturday.setUTCHours(0, 0, 0, 0);
  saturday.setUTCDate(saturday.getUTCDate() - (saturday.getUTCDay() + 1) % 7);
  return programme.map(({ slug, capacity, reserved, offsetHours }) => {
    const nextStart = new Date(saturday.getTime() + offsetHours * 3600000);
    if (nextStart <= now) nextStart.setUTCDate(nextStart.getUTCDate() + 7);
    return { slug, capacity, reserved, starts_at: nextStart.toISOString() };
  });
}

export function scheduleLabel(iso, style = 'long') {
  return new Intl.DateTimeFormat(STUDIO_LOCALE, {
    timeZone: STUDIO_TIME_ZONE, weekday: style, month: style, day: 'numeric',
  }).format(new Date(iso));
}

export function timeLabel(iso) {
  const local = new Intl.DateTimeFormat(STUDIO_LOCALE, {
    timeZone: STUDIO_TIME_ZONE, hour: '2-digit', minute: '2-digit', hourCycle: 'h23',
  }).format(new Date(iso));
  return local + ' ' + STUDIO_TIME_ZONE.split('/').at(-1).replaceAll('_', ' ');
}
