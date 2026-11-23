'use client';

import { useEffect, useRef, useState } from 'react';
import { programme, scheduleLabel, timeLabel } from '../lib/programme.mjs';

function Mark() {
  return <svg aria-hidden="true" viewBox="0 0 48 40" width="38" height="32"><path fill="currentColor" d="M12 4h35L36 14H23l-3 6h14L24 30h-9l-3 7H2z"/></svg>;
}

function Icon({ name }) {
  const paths = {
    arrow: 'M4 12h15m-6-6 6 6-6 6',
    close: 'm6 6 12 12M18 6 6 18',
    tick: 'm4 12 5 5L20 6',
    ticket: 'M3 6h18v4a2 2 0 0 0 0 4v4H3v-4a2 2 0 0 0 0-4Zm12 2v2m0 4v2',
    clock: 'M12 2.8a9.2 9.2 0 1 1 0 18.4 9.2 9.2 0 1 1 0-18.4Zm0 4.7V12l3.5 2',
  };
  return <svg aria-hidden="true" viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" strokeWidth="1.65" strokeLinecap="round" strokeLinejoin="round"><path d={paths[name]}/></svg>;
}

function storageKey(scope) { return 'fieldwork.ticket.v1/' + scope + '/'; }
function keyFor(scope, session) { return storageKey(scope) + session.slug + '/' + Date.parse(session.starts_at); }
function readTickets(scope) {
  const found = {};
  for (let i = 0; i < localStorage.length; i++) {
    const key = localStorage.key(i);
    if (!key?.startsWith(storageKey(scope))) continue;
    try {
      const ticket = JSON.parse(localStorage.getItem(key));
      if (ticket && programme.some(w => w.slug === ticket.slug) && Number.isFinite(Date.parse(ticket.starts_at)) &&
          typeof ticket.id === 'string' && key === keyFor(scope, ticket)) found[key] = ticket;
    } catch { /* Ignore a damaged entry without hiding other tickets. */ }
  }
  return found;
}

function availability(session, local, ticket) {
  if (!session) return { open: false, label: 'Unscheduled' };
  if (Date.parse(session.starts_at) <= Date.now()) return { open: false, label: 'Session closed' };
  const n = Math.max(0, session.capacity - session.reserved - Number(local && ticket?.confirmed === true));
  if (ticket?.confirmed) return { open: n > 0, label: 'Seat confirmed' };
  return { open: n > 0, label: n === 0 ? 'Fully booked' : n === 1 ? '1 seat left' : n + ' seats left' };
}

function SessionFacts({ session, workshop }) {
  return <dl className="facts">
    <div><dt>Date</dt><dd>{scheduleLabel(session.starts_at, 'short')}</dd></div>
    <div><dt>Start</dt><dd>{timeLabel(session.starts_at)}</dd></div>
    <div><dt>Duration</dt><dd>{workshop.duration} min</dd></div>
    <div><dt>Room</dt><dd>{workshop.room}</dd></div>
  </dl>;
}

function SeatLabel({ state }) {
  return <span className={'seat-label' + (state.open ? '' : ' closed')}><i aria-hidden="true"/>{state.label}</span>;
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
  const featured = programme[0];
  const first = state.sessions.find(s => s.slug === featured.slug);
  const confirmedTickets = Object.values(tickets).filter(t => t.confirmed).sort((a,b) => Date.parse(a.starts_at)-Date.parse(b.starts_at));
  const ticketFor = session => session && tickets[keyFor(state.scope, session)];
  const ticket = ticketFor(selected);
  const workshop = programme.find(w => w.slug === selected?.slug);
  const current = state.sessions.find(s => s.slug === selected?.slug && Date.parse(s.starts_at) === Date.parse(selected.starts_at));
  const active = current ?? selected;

  useEffect(() => {
    function sync() {
      try { setTickets(readTickets(state.scope)); } catch { setTickets({}); }
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
    if ((view === 'ticket' || view === 'cancel') && selected && !ticket?.confirmed) {
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
      const record = saved ?? { id: crypto.randomUUID(), slug: selected.slug, starts_at: selected.starts_at, confirmed: false };
      if (cancel && !saved) { setTickets(readTickets(state.scope)); setView('list'); return; }
      if (!cancel && saved?.confirmed) { setTickets(readTickets(state.scope)); setView('ticket'); return; }
      if (local && !cancel && !availability(selected, true, saved).open) {
        throw new Error('Booking has closed for this session. Choose another workshop.');
      }
      if (!cancel && !saved) localStorage.setItem(key, JSON.stringify(record));
      if (!local) {
        const res = await fetch('/api/booking', {
          method: cancel ? 'DELETE' : 'POST', headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ slug: record.slug, id: record.id, startsAt: record.starts_at }),
          signal: AbortSignal.timeout(18000),
        });
        const result = await res.json().catch(() => null);
        if (!result || typeof result !== 'object') {
          throw new Error('The studio could not confirm the request. Try again here with the same ticket.');
        }
        if (!res.ok) {
          if (res.status === 409) {
            localStorage.removeItem(key);
            setTickets(readTickets(state.scope));
            const refreshed = await fetch('/api/workshop', { cache: 'no-store' }).then(r => r.json()).catch(() => null);
            if (refreshed?.mode === 'connected') setState(refreshed);
          }
          throw new Error(result.error || 'The studio could not confirm this request.');
        }
        setState(s => ({ ...s, sessions: s.sessions.map(row => row.slug === result.session.slug ? result.session : row) }));
      }
      if (cancel) localStorage.removeItem(key);
      else localStorage.setItem(key, JSON.stringify({ ...record, confirmed: true }));
      setTickets(readTickets(state.scope));
      setView(cancel ? 'released' : 'ticket');
    }
    try {
      if (navigator.locks?.request) await navigator.locks.request(key, run);
      else await run();
    } catch (err) {
      setError(err.name === 'SecurityError' || err.name === 'QuotaExceededError'
        ? 'Allow browser storage to keep and manage your ticket.'
        : err instanceof TypeError || err.name === 'TimeoutError'
          ? 'The studio could not confirm the request. Try again here with the same ticket.'
          : err.message);
    } finally { setPending(false); inFlight.current = false; }
  }

  const stateFor = session => availability(session, local, ticketFor(session));
  const featuredState = stateFor(first);
  const action = (session, workshopTitle) => {
    const compact = Boolean(workshopTitle);
    const owned = ticketFor(session);
    const enabled = session && (compact || owned || stateFor(session).open);
    return <button className={compact ? 'row-action' : 'primary'} disabled={!enabled} onClick={() => choose(session)}
      aria-label={compact ? 'View ' + workshopTitle : undefined}>
      {compact ? <Icon name="arrow"/> : <>{owned?.confirmed ? 'View your ticket' : owned ? 'Resume reservation' : 'Reserve a seat'}<Icon name="arrow"/></>}
    </button>;
  };
  return <>
    <a href="#programme" className="skip">Skip to programme</a>
    <header className="topbar"><div className="wrap bar-inner">
      <a href="#top" className="brand" aria-label="Fieldwork Studio home"><Mark/>Fieldwork<span className="brand-studio">Studio</span></a>
      <nav aria-label="Main"><a href="#programme" className="workshop-link">Workshops</a><button className="tickets-nav" aria-label={confirmedTickets.length ? 'My tickets, ' + confirmedTickets.length + (confirmedTickets.length === 1 ? ' ticket' : ' tickets') : 'My tickets'} onClick={() => open('list')}><Icon name="ticket"/>My tickets{confirmedTickets.length > 0 && <span className="ticket-count" aria-hidden="true">{confirmedTickets.length}</span>}</button></nav>
    </div></header>
    <main className="wrap" id="top">
      {state.incompleteSetup && <p className="notice" role="status">Browser demo. To share bookings, connect both the Supabase project URL and its server key.</p>}
      {state.setup && <p className="notice" role="status">Browser demo. {state.setup === 'schema'
        ? <>To open studio bookings, run <code>supabase/migrations/20261122222124_workshop_capacity.sql</code> and then <code>supabase/seed.sql</code> in the Supabase SQL Editor.</>
        : <>Your project has no scheduled workshops for this programme. Run <code>supabase/seed.sql</code> in the Supabase SQL Editor to open studio bookings.</>}</p>}
      <section className="hero" aria-labelledby="featured-title">
        <div className="hero-copy">
          <p className="eyebrow"><span className="short-line"/>Featured workshop</p>
          <h1 id="featured-title">{featured.title}</h1>
          <p className="lead">{featured.summary || featured.description}</p>
          <div className="session-line"><span>{featured.discipline} studio</span><span><Icon name="clock"/>{featured.duration} min</span></div>
          <div className="action-line">{action(first)}<SeatLabel state={featuredState}/></div>
        </div>
        <figure className="cover">
          <img className="cover-art" src={'/studies/' + featured.slug + '.webp'} alt={featured.alt} width="1280" height="880" fetchPriority="high"/>
          <figcaption><span>Study {featured.number}</span><span>{featured.technique}</span></figcaption>
        </figure>
      </section>
      <section id="programme" aria-labelledby="programme-title" className="programme">
        <div className="programme-heading"><h2 id="programme-title">Workshop programme</h2><span className="mode">{local ? 'Browser demo' : state.mode === 'connected' ? 'Studio bookings' : 'Bookings unavailable'}</span></div>
        {state.mode === 'unavailable' && <p role="status" className="notice">The studio could not load availability. <a href="/">Reload programme</a></p>}
        {programme.map(w => {
          const session = state.sessions.find(s => s.slug === w.slug);
          return <article className="row" key={w.slug}>
            <img src={'/studies/' + w.slug + '.webp'}
              srcSet={`/studies/thumbs/${w.slug}-96.webp 96w, /studies/thumbs/${w.slug}-192.webp 192w`}
              sizes="(max-width: 700px) 64px, (max-width: 959px) 76px, 92px"
              onError={e => e.currentTarget.removeAttribute('srcset')}
              alt="" width="92" height="65" loading="lazy"/>
            <div className="row-name"><p className="discipline">{w.discipline}</p><h3>{session ? <button onClick={() => choose(session)}>{w.title}</button> : w.title}</h3></div>
            <div className="row-time">{session && <><strong>{scheduleLabel(session.starts_at, 'short')}</strong><span>{timeLabel(session.starts_at)} · {w.duration} min</span></>}</div>
            <SeatLabel state={stateFor(session)}/>{action(session, w.title)}
          </article>;
        })}
      </section>
    </main>
    <footer className="wrap"><span className="footer-brand"><Mark/>Fieldwork Studio</span><span>{local ? 'Demo reservations stay in this browser.' : 'Workshop reservations'}</span></footer>
    <dialog ref={dialog} aria-labelledby="dialog-title" onCancel={e => { e.preventDefault(); if (!pending) close(); }}
      onClick={e => { if (e.target === dialog.current && !pending) { const b = dialog.current.getBoundingClientRect(); if (e.clientX < b.left || e.clientX > b.right || e.clientY < b.top || e.clientY > b.bottom) close(); } }}>
      {view && <div className="dialog-body">
        <div className="dialog-top"><span className="brand"><Mark/>Fieldwork</span><button className="icon-btn" aria-label="Close" disabled={pending} onClick={close}><Icon name="close"/></button></div>
        {view === 'list' ? <>
          <h2 id="dialog-title" ref={title} tabIndex="-1">My tickets</h2>
          {confirmedTickets.length === 0 ? <><p className="dialog-lead">Your workshop tickets will appear here once you reserve a seat in this browser.</p><button className="primary" onClick={() => { close(); document.getElementById('programme').scrollIntoView(); }}>Browse workshops<Icon name="arrow"/></button></> :
            <div className="ticket-list">{confirmedTickets.map(t => <button key={t.id} onClick={() => open('ticket', t)}><span><strong>{programme.find(w => w.slug === t.slug).title}</strong><small>{scheduleLabel(t.starts_at, 'short')} · {timeLabel(t.starts_at)}</small></span><Icon name="arrow"/></button>)}</div>}
        </> : view === 'released' ? <>
          <p className="eyebrow">Cancellation</p><h2 id="dialog-title" ref={title} tabIndex="-1">Seat released</h2>
          <p className="dialog-lead">Your reservation for {workshop.title} has been cancelled.</p><button className="primary" onClick={close}>Back to programme<Icon name="arrow"/></button>
        </> : workshop && active && <>
          <p className="eyebrow">{view === 'ticket' ? 'Reservation confirmed' : view === 'cancel' ? 'Cancel reservation' : workshop.discipline + ' workshop'}</p>
          <h2 id="dialog-title" ref={title} tabIndex="-1">{view === 'cancel' ? 'Release this seat?' : workshop.title}</h2>
          {view !== 'cancel' && <div className="dialog-figure"><img src={'/studies/'+workshop.slug+'.webp'} width="1280" height="880" alt={workshop.alt}/></div>}
          {view === 'reserve' && <p className="dialog-lead">{workshop.description}</p>}
          {view === 'cancel' && <p className="dialog-lead">This cancels your {workshop.title} reservation and returns one seat to the programme.</p>}
          <SessionFacts session={active} workshop={workshop}/>
          {view === 'ticket' && ticket && <div className="reference"><span>Ticket reference</span><strong>{ticket.id.slice(0,8).toUpperCase()}</strong></div>}
          {view !== 'cancel' && <p className="storage-note">{local ? 'Demo ticket. Your reservation stays in this browser.' : 'Keep this browser to manage your guest ticket.'}</p>}
          {error && <p role="alert" className="notice">{error}</p>}
          {view === 'reserve' && <button className="primary wide" disabled={pending || (!stateFor(active).open && !ticket)} onClick={() => transact(false)}>{pending ? 'Confirming…' : !stateFor(active).open && !ticket ? 'Booking closed' : 'Confirm reservation'}<Icon name="arrow"/></button>}
          {view === 'ticket' && <div className="dialog-actions"><button className="primary" onClick={close}>Done<Icon name="tick"/></button>{Date.parse(active.starts_at) > Date.now() && <button className="text-button" onClick={() => open('cancel', active)}>Cancel reservation</button>}</div>}
          {view === 'cancel' && <div className="dialog-actions"><button className="primary" disabled={pending} onClick={() => transact(true)}>{pending ? 'Releasing…' : 'Release seat'}</button><button className="text-button" disabled={pending} onClick={() => open('ticket', active)}>Keep ticket</button></div>}
        </>}
      </div>}
    </dialog>
  </>;
}
