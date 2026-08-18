import { useEffect, useState } from 'react';

import { fetchAgentDetail, type AgentDetail } from '../api';
import type { Translator } from '../i18n';
import { EmptyState, RiskBadge } from '../components/ui';

/** Governance policy view (AC-7.1/7.2): read-only sensitiveOps rendering. */
export function PolicyView({
  t,
  token,
  agents,
}: {
  t: Translator;
  token: string;
  agents: Array<{ id: string; name: string }>;
}) {
  const [details, setDetails] = useState<AgentDetail[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    Promise.all(agents.map((agent) => fetchAgentDetail(token, agent.id)))
      .then((rows) => {
        if (!cancelled) setDetails(rows.filter((row): row is AgentDetail => row !== null));
      })
      .catch(() => {
        if (!cancelled) setDetails([]);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [token, agents]);

  return (
    <section className="view">
      <h2>{t('policy.title')}</h2>
      <p className="muted">{t('policy.subtitle')}</p>
      <div className="verdict-bar policy">🛡 {t('policy.denyDefault')}</div>
      {loading ? (
        <p className="muted">{t('common.loading')}</p>
      ) : details.length === 0 ? (
        <EmptyState t={t} label={t('emp.empty')} />
      ) : (
        details.map((detail) => (
          <div className="panel" key={detail.id}>
            <h3>
              {detail.name} <span className="muted">· {t('policy.perEmployee')}</span>
            </h3>
            {detail.guardrailRules?.sensitiveOps?.length ? (
              <table>
                <thead>
                  <tr>
                    <th>{t('policy.col.tool')}</th>
                    <th>{t('policy.col.operation')}</th>
                    <th>{t('policy.col.risk')}</th>
                    <th>{t('policy.col.action')}</th>
                    <th>{t('policy.col.description')}</th>
                  </tr>
                </thead>
                <tbody>
                  {detail.guardrailRules.sensitiveOps.map((rule, index) => (
                    <tr key={index}>
                      <td className="mono">{rule.toolPattern ?? '—'}</td>
                      <td>{rule.operation}</td>
                      <td>
                        <RiskBadge riskLevel={rule.riskLevel} />
                      </td>
                      <td>
                        <span className="chip info">{rule.action}</span>
                      </td>
                      <td>{rule.description ?? '—'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            ) : (
              <p className="muted">{t('policy.empty')}</p>
            )}
          </div>
        ))
      )}
    </section>
  );
}
