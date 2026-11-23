import { programme, scheduleLabel, timeLabel } from '../lib/programme.mjs';
import { Icon, Mark } from './studio-icons';

function SessionFacts({ session, workshop }) {
  return (
    <dl className="facts">
      <div>
        <dt>Date</dt>
        <dd>{scheduleLabel(session.starts_at, 'short')}</dd>
      </div>
      <div>
        <dt>Start</dt>
        <dd>{timeLabel(session.starts_at)}</dd>
      </div>
      <div>
        <dt>Duration</dt>
        <dd>{workshop.duration} min</dd>
      </div>
      <div>
        <dt>Room</dt>
        <dd>{workshop.room}</dd>
      </div>
    </dl>
  );
}

function TicketList({ title, confirmedTickets, browseWorkshops, open }) {
  return (
    <>
      <h2 id="dialog-title" ref={title} tabIndex="-1">
        My tickets
      </h2>
      {confirmedTickets.length === 0 ? (
        <>
          <p className="dialog-lead">
            Your workshop tickets will appear here once you reserve a seat in
            this browser.
          </p>
          <button className="primary" onClick={browseWorkshops}>
            Browse workshops
            <Icon name="arrow" />
          </button>
        </>
      ) : (
        <div className="ticket-list">
          {confirmedTickets.map((t) => (
            <button key={t.id} onClick={() => open('ticket', t)}>
              <span>
                <strong>
                  {programme.find((w) => w.slug === t.slug).title}
                </strong>
                <small>
                  {scheduleLabel(t.starts_at, 'short')} ·{' '}
                  {timeLabel(t.starts_at)}
                </small>
              </span>
              <Icon name="arrow" />
            </button>
          ))}
        </div>
      )}
    </>
  );
}

function Released({ title, workshop, close }) {
  return (
    <>
      <p className="eyebrow">Cancellation</p>
      <h2 id="dialog-title" ref={title} tabIndex="-1">
        Seat released
      </h2>
      <p className="dialog-lead">
        Your reservation for {workshop.title} has been cancelled.
      </p>
      <button className="primary" onClick={close}>
        Back to programme
        <Icon name="arrow" />
      </button>
    </>
  );
}

function SessionStep({
  title,
  view,
  pending,
  workshop,
  active,
  ticket,
  local,
  error,
  canConfirm,
  close,
  open,
  transact,
}) {
  return (
    <>
      <p className="eyebrow">
        {view === 'ticket'
          ? 'Reservation confirmed'
          : view === 'cancel'
            ? 'Cancel reservation'
            : workshop.discipline + ' workshop'}
      </p>
      <h2
        id="dialog-title"
        ref={title}
        tabIndex="-1"
        aria-label={
          view === 'ticket'
            ? `Reservation confirmed: ${workshop.title}`
            : undefined
        }
      >
        {view === 'cancel' ? 'Release this seat?' : workshop.title}
      </h2>
      {view !== 'cancel' && (
        <div className="dialog-figure">
          <img
            src={'/studies/' + workshop.slug + '.webp'}
            width="960"
            height="560"
            alt={workshop.alt}
          />
        </div>
      )}
      {view === 'reserve' && (
        <p className="dialog-lead">{workshop.description}</p>
      )}
      {view === 'cancel' && (
        <p className="dialog-lead">
          This cancels your {workshop.title} reservation and returns one seat to
          the programme.
        </p>
      )}
      <SessionFacts session={active} workshop={workshop} />
      {view === 'ticket' && ticket && (
        <div className="reference">
          <span>Ticket reference</span>
          <strong>{ticket.id.slice(0, 8).toUpperCase()}</strong>
        </div>
      )}
      {view !== 'cancel' && (
        <p className="storage-note">
          {local
            ? 'Demo ticket. Your reservation stays in this browser.'
            : 'Keep this browser to manage your guest ticket.'}
        </p>
      )}
      {error && (
        <p role="alert" className="notice">
          {error}
        </p>
      )}
      {view === 'reserve' && (
        <button
          className="primary wide"
          disabled={pending || !canConfirm}
          onClick={() => transact(false)}
        >
          {pending
            ? 'Confirming…'
            : !canConfirm
              ? 'Booking closed'
              : 'Confirm reservation'}
          <Icon name="arrow" />
        </button>
      )}
      {view === 'ticket' && (
        <div className="dialog-actions">
          <button className="primary" onClick={close}>
            Done
            <Icon name="tick" />
          </button>
          {Date.parse(active.starts_at) > Date.now() && (
            <button
              className="text-button"
              onClick={() => open('cancel', active)}
            >
              Cancel reservation
            </button>
          )}
        </div>
      )}
      {view === 'cancel' && (
        <div className="dialog-actions">
          <button
            className="primary"
            disabled={pending}
            onClick={() => transact(true)}
          >
            {pending ? 'Releasing…' : 'Release seat'}
          </button>
          <button
            className="text-button"
            disabled={pending}
            onClick={() => open('ticket', active)}
          >
            Keep ticket
          </button>
        </div>
      )}
    </>
  );
}

export function BookingDialog({
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
  canConfirm,
  transact,
}) {
  function cancelDialog(event) {
    event.preventDefault();
    if (!pending) close();
  }

  function closeOnBackdrop(event) {
    if (pending || event.target !== dialog.current) return;
    const bounds = dialog.current.getBoundingClientRect();
    const outside =
      event.clientX < bounds.left ||
      event.clientX > bounds.right ||
      event.clientY < bounds.top ||
      event.clientY > bounds.bottom;
    if (outside) close();
  }

  let content;
  if (view === 'list')
    content = (
      <TicketList
        title={title}
        confirmedTickets={confirmedTickets}
        browseWorkshops={browseWorkshops}
        open={open}
      />
    );
  else if (view === 'released' && workshop)
    content = <Released title={title} workshop={workshop} close={close} />;
  else if (view && workshop && active)
    content = (
      <SessionStep
        {...{
          title,
          view,
          pending,
          workshop,
          active,
          ticket,
          local,
          error,
          canConfirm,
          close,
          open,
          transact,
        }}
      />
    );

  return (
    <dialog
      ref={dialog}
      aria-labelledby="dialog-title"
      onCancel={cancelDialog}
      onClick={closeOnBackdrop}
    >
      {view && (
        <div className="dialog-body">
          <div className="dialog-top">
            <span className="brand">
              <Mark />
              Fieldwork
            </span>
            <button
              className="icon-btn"
              aria-label="Close"
              disabled={pending}
              onClick={close}
            >
              <Icon name="close" />
            </button>
          </div>
          {content}
        </div>
      )}
    </dialog>
  );
}
