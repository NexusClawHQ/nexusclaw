import type { Translator } from '../i18n';
import type { AgentSummary, ExecutionSummary, PendingApproval } from '../api';
import { EmptyState, formatPercent, StatusChip } from '../components/ui';

const DAY_MS = 86_400_000;

function dayKey(iso: string): string {
  return iso.slice(0, 10);
}

function lastNDays(n: number): string[] {
  const out: string[] = [];
  const now = new Date();
  for (let i = n - 1; i >= 0; i--) {
    const d = new Date(now.getTime() - i * DAY_MS);
    out.push(d.toISOString().slice(0, 10));
  }
  return out;
}

const STATUS_BARS: Array<{ status: string; className: string }> = [
  { status: 'done', className: 'bar-ok' },
  { status: 'failed', className: 'bar-bad' },
  { status: 'guardrail_pending', className: 'bar-warn' },
  { status: 'running', className: 'bar-info' },
  { status: 'pending', className: 'bar-muted' },
];

/** Governance insights — the audit chain, aggregated (front-end only).
 *  Every number below is derived from the feed; nothing is fabricated.
 *  Charts are plain CSS — zero chart dependencies. */
export function InsightsView({
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
  const days = lastNDays(7);
  const byDay = new Map<string, number>();
  for (const row of executions) {
    const key = dayKey(row.createdAt);
    byDay.set(key, (byDay.get(key) ?? 0) + 1);
  }
  const maxDay = Math.max(1, ...days.map((d) => byDay.get(d) ?? 0));

  const byStatus = new Map<string, number>();
  for (const row of executions) {
    byStatus.set(row.status, (byStatus.get(row.status) ?? 0) + 1);
  }
  const total = executions.length;

  const stats: Array<{ label: string; value: string }> = [
    { label: t('insights.stat.executions'), value: String(total) },
    { label: t('insights.stat.pending'), value: String(approvals.length) },
    {
      label: t('insights.stat.successRate'),
      value: agents.length ? formatPercent(agents[0].stats?.successRate ?? null) : '—',
    },
    {
      label: t('insights.stat.l3'),
      value: agents.length ? String(agents[0].stats?.l3EscalationCount ?? 0) : '0',
    },
  ];

  return (
    <section className="view">
      <h2>{t('insights.title')}</h2>
      <p className="muted">{t('insights.subtitle')}</p>

      <div className="stat-grid">
        {stats.map((card) => (
          <div className="stat-card" key={card.label}>
            <span className="stat-value">{card.value}</span>
            <span className="stat-label">{card.label}</span>
          </div>
        ))}
      </div>

      {total === 0 ? (
        <div className="panel">
          <EmptyState t={t} label={t('insights.empty')} />
          <div className="cta-row">
            <button className="primary" onClick={() => onGo('run')}>
              {t('overview.cta.run')} →
            </button>
          </div>
        </div>
      ) : (
        <>
          <div className="panel">
            <h3>{t('insights.trend.title')}</h3>
            <div className="bar-chart" role="img" aria-label={t('insights.trend.title')}>
              {days.map((d) => {
                const count = byDay.get(d) ?? 0;
                const height = count === 0 ? 2 : Math.max(8, Math.round((count / maxDay) * 100));
                return (
                  <div className="bar-col" key={d} title={`${d}: ${count}`}>
                    <div className="bar" style={{ height: `${height}%` }} />
                    <span className="bar-label">{d.slice(5)}</span>
                  </div>
                );
              })}
            </div>
          </div>

          <div className="split">
            <div className="panel">
              <h3>{t('insights.status.title')}</h3>
              {STATUS_BARS.map(({ status, className }) => {
                const count = byStatus.get(status) ?? 0;
                if (count === 0) return null;
                const width = Math.round((count / total) * 100);
                return (
                  <div className="dist-row" key={status}>
                    <StatusChip status={status} t={t} />
                    <div className="dist-track">
                      <div className={`dist-fill ${className}`} style={{ width: `${width}%` }} />
                    </div>
                    <span className="mono dist-count">{count}</span>
                  </div>
                );
              })}
              {byStatus.size === 0 && <p className="muted">{t('insights.status.empty')}</p>}
            </div>

            <div className="panel">
              <h3>{t('insights.agents.title')}</h3>
              {agents.length === 0 ? (
                <p className="muted">{t('insights.agents.empty')}</p>
              ) : (
                agents.map((agent) => (
                  <div className="dist-row" key={agent.id}>
                    <span className="mono">{agent.name}</span>
                    <div className="dist-track">
                      <div
                        className="dist-fill bar-ok"
                        style={{
                          width: `${Math.round((agent.stats?.successRate ?? 0) * 100)}%`,
                        }}
                      />
                    </div>
                    <span className="mono dist-count">
                      {formatPercent(agent.stats?.successRate ?? null)}
                    </span>
                  </div>
                ))
              )}
              <p className="muted" style={{ marginTop: 8, fontSize: 12 }}>
                {t('insights.source')}
              </p>
            </div>
          </div>
        </>
      )}
    </section>
  );
}
