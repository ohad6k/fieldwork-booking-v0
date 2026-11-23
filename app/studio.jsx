'use client';

import { useEffect, useRef, useState } from 'react';
import { programme } from '../lib/programme.mjs';
import { BookingDialog } from './booking-dialog';
import { Icon } from './studio-icons';
import { StudioHeader, WorkshopCard } from './studio-programme';

function storageKey(scope) {
  return 'fieldwork.ticket.v1/' + scope + '/';
}
function keyFor(scope, session) {
  return storageKey(scope) + session.slug + '/' + Date.parse(session.starts_at);
}
function readTickets(scope) {
  const found = {};
  for (let i = 0; i < localStorage.length; i++) {
    const key = localStorage.key(i);
    if (!key?.startsWith(storageKey(scope))) continue;
    try {
      const ticket = JSON.parse(localStorage.getItem(key));
      if (
        ticket &&
        programme.some((w) => w.slug === ticket.slug) &&
        Number.isFinite(Date.parse(ticket.starts_at)) &&
        typeof ticket.id === 'string' &&
        key === keyFor(scope, ticket)
      )
        found[key] = ticket;
    } catch {
      /* Ignore a damaged entry without hiding other tickets. */
    }
  }
  return found;
}

function availability(session, local, ticket) {
  if (!session) return { open: false, label: 'Unscheduled' };
  if (Date.parse(session.starts_at) <= Date.now())
    return { open: false, label: 'Session closed' };
  const n = Math.max(
    0,
    session.capacity -
      session.reserved -
      Number(local && ticket?.confirmed === true),
  );
  if (ticket?.confirmed) return { open: n > 0, label: 'Seat confirmed' };
  return {
    open: n > 0,
    last: n === 1,
    label:
      n === 0 ? 'Fully booked' : n === 1 ? '1 seat left' : n + ' seats left',
  };
}

export default function Studio({ initial }) {
  const [state, setState] = useState(initial);
  const [tickets, setTickets] = useState({});
  const [view, setView] = useState(null);
  const [selected, setSelected] = useState(null);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState('');
  const dialog = useRef(null);
  const title = useRef(null);
  const inFlight = useRef(false);
  const opener = useRef(null);
  const local = state.mode === 'demo';
  const schedule = programme
    .map((workshop) => {
      const session = state.sessions.find(
        (session) => session.slug === workshop.slug,
      );
      return {
        workshop,
        session,
        startsAt: session ? Date.parse(session.starts_at) : Infinity,
      };
    })
    .sort((a, b) => a.startsAt - b.startsAt);
  const confirmedTickets = Object.values(tickets)
    .filter((t) => t.confirmed)
    .sort((a, b) => Date.parse(a.starts_at) - Date.parse(b.starts_at));
  const ticketFor = (session) =>
    session && tickets[keyFor(state.scope, session)];
  const ticket = ticketFor(selected);
  const workshop = programme.find((w) => w.slug === selected?.slug);
  const current = state.sessions.find(
    (s) =>
      s.slug === selected?.slug &&
      Date.parse(s.starts_at) === Date.parse(selected.starts_at),
  );
  const active = current ?? selected;

  useEffect(() => {
    function sync() {
      try {
        setTickets(readTickets(state.scope));
      } catch {
        setTickets({});
      }
    }
    sync();
    window.addEventListener('storage', sync);
    return () => window.removeEventListener('storage', sync);
  }, [state.scope]);

  useEffect(() => {
    if (!view) return;
    if (!dialog.current.open) dialog.current.showModal();
    title.current?.focus({ preventScroll: true });
  }, [view, selected]);

  useEffect(() => {
    if (
      (view === 'ticket' || view === 'cancel') &&
      selected &&
      !ticket?.confirmed
    ) {
      setView('list');
    }
  }, [view, selected, ticket]);

  function open(nextView, session) {
    if (!view) opener.current = document.activeElement;
    setSelected(session ?? null);
    setError('');
    setView(nextView);
  }
  function close() {
    dialog.current?.close();
    setView(null);
    setError('');
    opener.current?.focus({ preventScroll: true });
  }
  function choose(session) {
    if (!session) return;
    open(ticketFor(session)?.confirmed ? 'ticket' : 'reserve', session);
  }
  async function transact(cancel) {
    if (inFlight.current || !selected) return;
    inFlight.current = true;
    setPending(true);
    setError('');
    const key = keyFor(state.scope, selected);
    async function run() {
      const saved = readTickets(state.scope)[key];
      const record = saved ?? {
        id: crypto.randomUUID(),
        slug: selected.slug,
        starts_at: selected.starts_at,
        confirmed: false,
      };
      if (cancel && !saved) {
        setTickets(readTickets(state.scope));
        setView('list');
        return;
      }
      if (!cancel && saved?.confirmed) {
        setTickets(readTickets(state.scope));
        setView('ticket');
        return;
      }
      if (local && !cancel && !availability(selected, true, saved).open) {
        throw new Error(
          'Booking has closed for this session. Choose another workshop.',
        );
      }
      if (!cancel && !saved) localStorage.setItem(key, JSON.stringify(record));
      if (!local) {
        const res = await fetch('/api/booking', {
          method: cancel ? 'DELETE' : 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            slug: record.slug,
            id: record.id,
            startsAt: record.starts_at,
          }),
          signal: AbortSignal.timeout(18000),
        });
        const result = await res.json().catch(() => null);
        if (!result || typeof result !== 'object') {
          throw new Error(
            'The studio could not confirm the request. Try again here with the same ticket.',
          );
        }
        if (!res.ok) {
          if (res.status === 409) {
            localStorage.removeItem(key);
            setTickets(readTickets(state.scope));
            const refreshed = await fetch('/api/workshop', {
              cache: 'no-store',
            })
              .then((r) => r.json())
              .catch(() => null);
            if (refreshed?.mode === 'connected') setState(refreshed);
          }
          throw new Error(
            result.error || 'The studio could not confirm this request.',
          );
        }
        setState((s) => ({
          ...s,
          sessions: s.sessions.map((row) =>
            row.slug === result.session.slug ? result.session : row,
          ),
        }));
      }
      if (cancel) localStorage.removeItem(key);
      else
        localStorage.setItem(
          key,
          JSON.stringify({ ...record, confirmed: true }),
        );
      setTickets(readTickets(state.scope));
      setView(cancel ? 'released' : 'ticket');
    }
    try {
      if (navigator.locks?.request) await navigator.locks.request(key, run);
      else await run();
    } catch (err) {
      setError(
        err.name === 'SecurityError' || err.name === 'QuotaExceededError'
          ? 'Allow browser storage to keep and manage your ticket.'
          : err instanceof TypeError || err.name === 'TimeoutError'
            ? 'The studio could not confirm the request. Try again here with the same ticket.'
            : err.message,
      );
    } finally {
      setPending(false);
      inFlight.current = false;
    }
  }

  function browseWorkshops() {
    close();
    document.getElementById('programme').scrollIntoView();
    document.getElementById('programme-title').focus({ preventScroll: true });
  }

  return (
    <>
      <a href="#programme" className="skip">
        Skip to programme
      </a>
      <StudioHeader
        ticketCount={confirmedTickets.length}
        onTickets={() => open('list')}
      />
      <main className="wrap">
        <div className="programme-intro">
          <h1>Workshop programme</h1>
          <p>Small-group classes in paper, print and textiles.</p>
        </div>
        {state.incompleteSetup && (
          <p className="notice" role="status">
            Browser demo. To share bookings, connect both the Supabase project
            URL and its server key.
          </p>
        )}
        {state.setup && (
          <p className="notice" role="status">
            Browser demo.{' '}
            {state.setup === 'schema' ? (
              <>
                To open studio bookings, run{' '}
                <code>
                  supabase/migrations/20261122222124_workshop_capacity.sql
                </code>{' '}
                and then <code>supabase/seed.sql</code> in the Supabase SQL
                Editor.
              </>
            ) : (
              <>
                Your project has no scheduled workshops for this programme. Run{' '}
                <code>supabase/seed.sql</code> in the Supabase SQL Editor to
                open studio bookings.
              </>
            )}
          </p>
        )}
        <section
          id="programme"
          aria-labelledby="programme-title"
          className="programme"
        >
          <div className="programme-heading">
            <h2 id="programme-title" tabIndex={-1}>
              Upcoming sessions
            </h2>
          </div>
          {state.mode === 'unavailable' && (
            <p role="status" className="notice">
              The studio could not load availability.{' '}
              <a href="/">Reload programme</a>
            </p>
          )}
          <div className="workshops">
            {schedule.map(({ workshop, session }) => (
              <WorkshopCard
                key={workshop.slug}
                workshop={workshop}
                session={session}
                seats={availability(session, local, ticketFor(session))}
                ticket={ticketFor(session)}
                onChoose={choose}
              />
            ))}
          </div>
        </section>
        {local && (
          <p className="mode-note">
            <Icon name="info" />
            Demo reservations stay in this browser.
          </p>
        )}
      </main>
      <BookingDialog
        {...{
          dialog,
          title,
          view,
          pending,
          close,
          browseWorkshops,
          open,
          confirmedTickets,
          workshop,
          active,
          ticket,
          local,
          error,
          transact,
        }}
        canConfirm={availability(active, local, ticket).open || Boolean(ticket)}
      />
    </>
  );
}
