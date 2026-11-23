import { createClient } from '@supabase/supabase-js';
import { demoSessions, programme } from './programme.mjs';

const options = { auth: { persistSession: false, autoRefreshToken: false } };
export const columns = 'slug,capacity,reserved,starts_at';

export function connection() {
  const url = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SECRET_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) {
    return { mode: 'demo', scope: 'demo', incompleteSetup: Boolean(url || key) };
  }
  return { mode: 'connected', scope: new URL(url).host, client: createClient(url, key, options) };
}

export async function getProgramme() {
  try {
    const { client, mode, scope, incompleteSetup } = connection();
    if (!client) return { mode, scope, incompleteSetup, sessions: demoSessions() };
    const { data, error } = await client.from('workshops').select(columns)
      .in('slug', programme.map(item => item.slug)).limit(programme.length).abortSignal(AbortSignal.timeout(5000));
    if (error?.code === '42P01' || error?.code === 'PGRST205') {
      return { mode: 'demo', scope: 'demo', setup: 'schema', sessions: demoSessions() };
    }
    if (error || !data) throw new Error('Workshop query failed');
    if (data.length === 0) return { mode: 'demo', scope: 'demo', setup: 'seed', sessions: demoSessions() };
    return { mode, scope, sessions: data };
  } catch {
    return { mode: 'unavailable', scope: '', sessions: [] };
  }
}
