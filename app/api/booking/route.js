import { connection, columns } from '../../../lib/workshops';
import { programme } from '../../../lib/programme.mjs';

const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const errorResponse = (error, status) => Response.json({ error }, { status });

async function changeBooking(request, cancel) {
  if (!request.headers.get('content-type')?.startsWith('application/json')) {
    return errorResponse('Send a JSON booking request.', 415);
  }
  const body = await request.json().catch(() => null);
  if (!body || typeof body.id !== 'string' || !uuid.test(body.id) || !programme.some(w => w.slug === body.slug)
    || typeof body.startsAt !== 'string' || !Number.isFinite(Date.parse(body.startsAt))) {
    return errorResponse('Choose a scheduled workshop and try again.', 400);
  }
  try {
    const { client } = connection();
    if (!client) return errorResponse('Demo reservations are stored in your browser.', 409);
    const match = { workshop_slug: body.slug, booking_id: body.id, starts_at: new Date(body.startsAt).toISOString() };
    if (cancel) {
      const { error } = await client.from('workshop_reservations').delete().match(match)
        .abortSignal(AbortSignal.timeout(5000));
      if (error) throw new Error('Cancellation failed');
    } else {
      const { error } = await client.from('workshop_reservations')
        .insert(match)
        .abortSignal(AbortSignal.timeout(5000));
      if (error) {
        // An interrupted response or a retry with the same ticket must not claim another seat.
        const existing = await client.from('workshop_reservations').select('starts_at').match(match)
          .abortSignal(AbortSignal.timeout(5000)).maybeSingle();
        if (existing.error) throw new Error('Could not confirm ticket');
        if (!existing.data || Date.parse(existing.data.starts_at) !== Date.parse(body.startsAt)) {
          if (error.code === 'P0001') return errorResponse('Booking has closed for this session. Choose another workshop.', 409);
          throw new Error('Reservation failed');
        }
      }
    }
    const { data, error } = await client.from('workshops').select(columns)
      .eq('slug', body.slug).abortSignal(AbortSignal.timeout(5000)).single();
    if (error) throw new Error('Could not confirm availability');
    return Response.json({ session: data }, { headers: { 'Cache-Control': 'no-store' } });
  } catch {
    return errorResponse('The studio could not confirm your request. Try again with this ticket.', 503);
  }
}

export async function POST(request) { return changeBooking(request, false); }
export async function DELETE(request) { return changeBooking(request, true); }
