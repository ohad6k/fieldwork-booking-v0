import { getProgramme } from '../../../lib/workshops';

export async function GET() {
  const state = await getProgramme();
  return Response.json(state, {
    status: state.mode === 'unavailable' ? 503 : 200,
    headers: { 'Cache-Control': 'no-store' },
  });
}
