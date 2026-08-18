import { useEffect, useState } from 'react';

import { fetchApprovalHistory, type ApprovalHistoryEntry } from '../api';
import type { Translator } from '../i18n';
import { EmptyState, formatWhen, RiskBadge } from '../components/ui';

/** Decided approvals — the audit-chain side of the approvals queue.
 *  Every decision (approved / rejected), its coaching comment and the
 *  operator who made it. Read-only, derived from approval instances. */
export function ApprovalHistoryView({
  t,
  token,
  lang,
}: {
  t: Translator;
  token: string;
  lang: string;
}) {
  const [entries, setEntries] = useState<ApprovalHistoryEntry[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    fetchApprovalHistory(token, 50)
      .then((rows) => {
        if (!cancelled) setEntries(rows);
      })
      .catch(() => {
        if (!cancelled) setEntries([]);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [token]);

  return (
    <section className="view">
      <h2>{t('history.title')}</h2>
      <p className="muted">{t('history.subtitle')}</p>
      {loading ? (
        <p className="muted">{t('common.loading')}</p>
      ) : entries.length === 0 ? (
        <EmptyState t={t} label={t('history.empty')} />
      ) : (
        entries.map((entry) => (
          <div className="panel" key={entry.id}>
            <div className="panel-head">
              <span className={`chip ${entry.decision === 'APPROVED' ? 'ok' : 'bad'}`}>
                {entry.decision === 'APPROVED' ? t('history.approved') : t('history.rejected')}
              </span>
              <span className="mono">{entry.toolName}</span>
              <RiskBadge riskLevel={entry.riskLevel} />
              <span className="muted" style={{ marginLeft: 'auto' }}>
                {formatWhen(entry.decidedAt, lang)}
              </span>
            </div>
            {entry.comment && (
              <p className="history-comment">“{entry.comment}”</p>
            )}
            <p className="muted" style={{ margin: '6px 0 0', fontSize: 12 }}>
              {t('history.by')} {entry.actorName ?? '—'} ·{' '}
              {t('history.submitted')} {formatWhen(entry.submittedAt, lang)}
            </p>
          </div>
        ))
      )}
    </section>
  );
}
