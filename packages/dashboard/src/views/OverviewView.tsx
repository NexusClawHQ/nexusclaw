import type { Translator } from '../i18n';
import type { AgentSummary, ExecutionSummary, PendingApproval } from '../api';
import { EmptyState, formatPercent } from '../components/ui';

/** Front-end aggregation of the existing feed — zero new backend queries
 *  (spec design §2.2). Every number is feed-derived, nothing fabricated. */
export function OverviewView({
  t,
  agents,
  executions,
  approvals,
  onGo,
}: {
  t: Translator;
  agents: AgentSummary[];
  executions: ExecutionSummary[];
  approvals: PendingApproval[];
  onGo: (section: 'run' | 'approvals') => void;
}) {
  const done = executions.filter((row) => row.status === 'done').length;
  const cards: Array<{ label: string; value: string }> = [
    { label: t('overview.executions'), value: String(executions.length) },
    { label: t('overview.pending'), value: String(approvals.length) },
    { label: t('overview.done'), value: String(done) },
    { label: t('overview.governedEvents'), value: String(approvals.length + done) },
  ];

  return (
    <section className="view">
      <h2>{t('overview.title')}</h2>
      <p className="muted">{t('overview.subtitle')}</p>
      <div className="stat-grid">
        {cards.map((card) => (
          <div className="stat-card" key={card.label}>
            <span className="stat-value">{card.value}</span>
            <span className="stat-label">{card.label}</span>
          </div>
        ))}
      </div>
      <div className="cta-row">
        <button className="primary" onClick={() => onGo('run')}>
          {t('overview.cta.run')} →
        </button>
        {approvals.length > 0 && (
          <button onClick={() => onGo('approvals')}>
            {t('overview.cta.approvals')} ({approvals.length}) →
          </button>
        )}
      </div>
      <div className="panel">
        <h3>{t('overview.recent')}</h3>
        {executions.length === 0 ? (
          <EmptyState t={t} />
        ) : (
          <table>
            <tbody>
              {executions.slice(0, 5).map((row) => (
                <tr key={row.id}>
                  <td className="mono">{(row.rawInput ?? '').slice(0, 48)}</td>
                  <td>{row.status}</td>
                  <td className="muted">{row.durationMs == null ? '—' : `${row.durationMs} ms`}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
      {agents.length > 0 && (
        <div className="panel">
          <h3>{t('emp.title')}</h3>
          <p className="muted">
            {agents[0].name} · {t('emp.stats.success')}{' '}
            {formatPercent(agents[0].stats?.successRate ?? null)}
          </p>
        </div>
      )}
    </section>
  );
}
