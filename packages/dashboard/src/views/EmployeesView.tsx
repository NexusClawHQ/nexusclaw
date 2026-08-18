import type { Translator } from '../i18n';
import type { AgentSummary } from '../api';
import { EmptyState, formatPercent } from '../components/ui';

/** Employee card wall (AC-5.1): avatar / name / duty / audit-derived stats. */
export function EmployeesView({
  t,
  agents,
  loading,
  onOpen,
  onNew,
}: {
  t: Translator;
  agents: AgentSummary[];
  loading: boolean;
  onOpen: (id: string) => void;
  onNew: () => void;
}) {
  return (
    <section className="view">
      <div className="view-head">
        <div>
          <h2>{t('emp.title')}</h2>
          <p className="muted">{t('emp.subtitle')}</p>
        </div>
        <button className="primary" onClick={onNew}>
          + {t('emp.new.button')}
        </button>
      </div>
      {loading ? (
        <p className="muted">{t('common.loading')}</p>
      ) : agents.length === 0 ? (
        <EmptyState t={t} label={t('emp.empty')} />
      ) : (
        <div className="card-wall">
          {agents.map((agent) => (
            <button className="employee-card" key={agent.id} onClick={() => onOpen(agent.id)}>
              <span className="avatar" aria-hidden="true">
                {agent.name.slice(0, 1).toUpperCase()}
              </span>
              <span className="employee-name">{agent.name}</span>
              <span className={`chip ${agent.status === 'active' ? 'ok' : 'muted'}`}>
                {agent.status}
              </span>
              {agent.description && <p className="employee-desc">{agent.description}</p>}
              <dl className="employee-stats">
                <div>
                  <dt>{t('emp.stats.executions')}</dt>
                  <dd>{agent.stats.totalExecutions}</dd>
                </div>
                <div>
                  <dt>{t('emp.stats.success')}</dt>
                  <dd>{formatPercent(agent.stats.successRate)}</dd>
                </div>
                <div>
                  <dt>{t('emp.stats.approvals')}</dt>
                  <dd>{formatPercent(agent.stats.approvalRate)}</dd>
                </div>
                <div>
                  <dt>{t('emp.stats.l3')}</dt>
                  <dd>{agent.stats.l3EscalationCount}</dd>
                </div>
              </dl>
            </button>
          ))}
        </div>
      )}
    </section>
  );
}
