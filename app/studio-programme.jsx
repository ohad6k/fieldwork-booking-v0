import { scheduleLabel, timeLabel } from '../lib/programme.mjs';
import { Icon, Mark } from './studio-icons';

export function StudioHeader({ ticketCount, onTickets }) {
  return (
    <header className="topbar" id="top">
      <div className="wrap bar-inner">
        <a href="#top" className="brand" aria-label="Fieldwork Studio home">
          <span className="brand-mark">
            <Mark />
          </span>
          Fieldwork Studio
        </a>
        <nav aria-label="Main">
          <a href="#programme" className="workshop-link" aria-current="page">
            Workshops
          </a>
          <button
            className="tickets-nav"
            aria-label={
              ticketCount
                ? `My tickets, ${ticketCount} ${ticketCount === 1 ? 'ticket' : 'tickets'}`
                : 'My tickets'
            }
            onClick={onTickets}
          >
            <Icon name="ticket" />
            My tickets
            {ticketCount > 0 && (
              <span className="ticket-count" aria-hidden="true">
                {ticketCount}
              </span>
            )}
          </button>
        </nav>
      </div>
    </header>
  );
}

export function WorkshopCard({ workshop, session, seats, ticket, onChoose }) {
  const action = ticket?.confirmed
    ? 'View ticket'
    : ticket
      ? 'Resume'
      : seats.open
        ? 'Reserve'
        : 'Details';

  return (
    <article className="workshop-card" aria-labelledby={workshop.slug}>
      <img
        className="workshop-photo"
        src={`/studies/${workshop.slug}.webp`}
        alt=""
        width="960"
        height="560"
      />
      <div className="workshop-info">
        <div className="session">
          {session ? (
            <time dateTime={session.starts_at}>
              <strong>{scheduleLabel(session.starts_at, 'short')}</strong>
              <span>
                {timeLabel(session.starts_at)} · {workshop.duration} min
              </span>
            </time>
          ) : (
            <span>{workshop.discipline} workshop</span>
          )}
        </div>
        <h3 id={workshop.slug}>{workshop.title}</h3>
        <p>{workshop.summary || workshop.description}</p>
      </div>
      <div className="workshop-action">
        <span className="seat-label" data-highlight={seats.last || undefined}>
          <span aria-hidden="true" className="seat-dot" />
          {seats.label}
        </span>
        <button
          className={seats.open && !ticket ? 'primary' : 'secondary'}
          disabled={!session}
          onClick={() => onChoose(session)}
          aria-label={`${action} ${workshop.title}`}
        >
          {action}
          <Icon name="arrow" />
        </button>
      </div>
    </article>
  );
}
