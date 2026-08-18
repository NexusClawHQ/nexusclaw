import { useEffect, useState } from 'react';

import { fetchRecentEvents, type OutboxEventView } from '../api';
import type { Translator } from '../i18n';
import { EmptyState, formatWhen, JsonBlock } from '../components/ui';

/** Cross-execution outbox event feed (newest last, oldest first reading
 *  top-down like a log): started → step → paused → resumed → completed →
 *  cancelled, with the full JSON payload of every event. */
export function EventStreamView({
  t,
  token,
  lang,
}: {
  t: Translator;
  token: string;
  lang: string;
}) {
  const [events, setEvents] = useState<OutboxEventView[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    const load = () =>
      fetchRecentEvents(token, 50)
        .then((rows) => {
          if (!cancelled) setEvents(rows);
        })
        .catch(() => {
          if (!cancelled) setEvents([]);
        })
        .finally(() => {
          if (!cancelled) setLoading(false);
        });
    void load();
    const timer = window.setInterval(load, 5000);
    return () => {
      cancelled = true;
      window.clearInterval(timer);
    };
  }, [token]);

  // Newest-first from the API; display oldest-first like a log.
  const ordered = [...events].reverse();

  return (
    <section className="view">
      <h2>{t('stream.title')}</h2>
      <p className="muted">{t('stream.subtitle')}</p>
      {loading ? (
        <p className="muted">{t('common.loading')}</p>
      ) : ordered.length === 0 ? (
        <EmptyState t={t} label={t('stream.empty')} />
      ) : (
        <div className="event-stream">
          {ordered.map((event) => (
            <details className="event-row" key={event.id}>
              <summary>
                <code>{event.eventType}</code>
                <span className="chip muted">{event.topic}</span>
                <span className="muted">{formatWhen(event.createdAt, lang)}</span>
              </summary>
              <JsonBlock value={event.payload} />
            </details>
          ))}
        </div>
      )}
    </section>
  );
}
