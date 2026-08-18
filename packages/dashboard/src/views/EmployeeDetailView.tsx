import { useEffect, useState } from 'react';

import {
  fetchAgentDetail,
  fetchModelSource,
  type AgentDetail,
  type ModelSource,
} from '../api';
import type { Translator } from '../i18n';
import {
  EmptyState,
  formatPercent,
  RiskBadge,
} from '../components/ui';

type SubTab = 'overview' | 'config' | 'exec' | 'growth';

const RISK_LEVELS = ['L0', 'L1', 'L2', 'L3', 'L4'] as const;

const LEVEL_LABEL_KEYS: Record<(typeof RISK_LEVELS)[number], Parameters<Translator>[0]> = {
  L0: 'emp.level.L0',
  L1: 'emp.level.L1',
  L2: 'emp.level.L2',
  L3: 'emp.level.L3',
  L4: 'emp.level.L4',
};

/** Employee profile (frozen mockup §5.4): hero + in-page tabs with the
 *  CONFIG sub-page as the product-grade centerpiece. Everything read-only;
 *  edit affordances surface as commercial hints, never fake controls. */
export function EmployeeDetailView({
  t,
  token,
  agentId,
  onBack,
  onOpenGrowth,
  onGoRun,
}: {
  t: Translator;
  token: string;
  agentId: string;
  onBack: () => void;
  onOpenGrowth: (agentId: string) => void;
  onGoRun: () => void;
}) {
  const [detail, setDetail] = useState<AgentDetail | null>(null);
  const [modelSource, setModelSource] = useState<ModelSource | null>(null);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);
  const [tab, setTab] = useState<SubTab>('config');

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setNotFound(false);
    fetchAgentDetail(token, agentId)
      .then((row) => {
        if (cancelled) return;
        if (row) setDetail(row);
        else setNotFound(true);
      })
      .catch(() => {
        if (!cancelled) setNotFound(true);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    fetchModelSource(token)
      .then((source) => {
        if (!cancelled) setModelSource(source);
      })
      .catch(() => {
        if (!cancelled) setModelSource(null);
      });
    return () => {
      cancelled = true;
    };
  }, [token, agentId]);

  if (loading) return <p className="muted">{t('common.loading')}</p>;
  if (notFound || !detail) return <EmptyState t={t} label={t('emp.detail.notFound')} />;

  const ops = detail.guardrailRules?.sensitiveOps ?? [];
  const maxLevel = ops.reduce<(typeof RISK_LEVELS)[number] | null>(
    (max, rule) =>
      max === null || (RISK_LEVELS.indexOf(rule.riskLevel as 'L0') ?? -1) > RISK_LEVELS.indexOf(max)
        ? ((rule.riskLevel as (typeof RISK_LEVELS)[number]) ?? max)
        : max,
    null,
  );

  const tabs: Array<{ id: SubTab; label: string }> = [
    { id: 'overview', label: t('emp.tab.overview') },
    { id: 'config', label: t('emp.tab.config') },
    { id: 'exec', label: t('emp.tab.exec') },
    { id: 'growth', label: t('emp.tab.growth') },
  ];

  return (
    <section className="view">
      <button className="ghost" onClick={onBack}>
        ← {t('emp.detail.back')}
      </button>

      <div className="panel slim detail-hero">
        <span className="avatar avatar-lg" aria-hidden="true">
          {detail.name.slice(0, 1).toUpperCase()}
        </span>
        <div className="grow">
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
            <h2 style={{ margin: 0, fontSize: 18, fontWeight: 650 }}>{detail.name}</h2>
            <span className={`chip ${detail.status === 'active' ? 'ok' : 'muted'}`}>{detail.status}</span>
            {detail.version != null && <span className="chip muted mono">v{detail.version}</span>}
          </div>
          {detail.description && (
            <p className="muted" style={{ margin: '2px 0 0' }}>
              {detail.description}
            </p>
          )}
        </div>
        <div className="detail-actions">
          <button className="primary" onClick={onGoRun}>
            ▶ {t('run.submit')}
          </button>
          <button onClick={() => onOpenGrowth(detail.id)}>
            {t('emp.detail.growthCta')} →
          </button>
        </div>
      </div>

      <div className="subtabs" role="tablist">
        {tabs.map((entry) => (
          <button
            key={entry.id}
            role="tab"
            aria-selected={tab === entry.id}
            className={tab === entry.id ? 'subtab active' : 'subtab'}
            onClick={() => setTab(entry.id)}
          >
            {entry.label}
          </button>
        ))}
      </div>

      {tab === 'overview' && (
        <div className="subsec show">
          <div className="stat-grid">
            <div className="stat-card">
              <span className="stat-value">{detail.stats.totalExecutions}</span>
              <span className="stat-label">{t('emp.stats.executions')}</span>
            </div>
            <div className="stat-card">
              <span className="stat-value">{formatPercent(detail.stats.successRate)}</span>
              <span className="stat-label">{t('emp.stats.success')}</span>
            </div>
            <div className="stat-card">
              <span className="stat-value">{formatPercent(detail.stats.approvalRate)}</span>
              <span className="stat-label">{t('emp.stats.approvals')}</span>
            </div>
            <div className="stat-card">
              <span className="stat-value">{detail.stats.l3EscalationCount}</span>
              <span className="stat-label">{t('emp.stats.l3')}</span>
            </div>
          </div>
          <div className="panel">
            <h3 style={{ margin: 0 }}>{t('emp.detail.recent')}</h3>
            {detail.recentExecutions.length === 0 ? (
              <EmptyState t={t} label={t('exec.empty')} />
            ) : (
              <table>
                <tbody>
                  {detail.recentExecutions.map((row) => (
                    <tr key={row.id}>
                      <td>{(row.rawInput ?? '').slice(0, 48)}</td>
                      <td>{row.status}</td>
                      <td className="muted">{row.durationMs == null ? '—' : `${row.durationMs} ms`}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </div>
      )}

      {tab === 'config' && (
        <div className="subsec show">
          <div className="two-col">
            <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              <div className="panel">
                <div className="panel-head">
                  <h3 style={{ margin: 0 }}>{t('emp.cfg.basic')}</h3>
                  <span className="hint-chip">{t('product.modal.commercialEdit')}</span>
                </div>
                <dl className="kv-grid">
                  <div><dt>{t('emp.cfg.name')}</dt><dd>{detail.name}</dd></div>
                  <div><dt>{t('emp.cfg.apiName')}</dt><dd className="mono">{detail.apiName ?? '—'}</dd></div>
                  <div><dt>{t('emp.cfg.type')}</dt><dd>{detail.agentType ?? '—'}</dd></div>
                  <div><dt>{t('emp.cfg.status')}</dt><dd><span className={`chip ${detail.status === 'active' ? 'ok' : 'muted'}`}>{detail.status}</span></dd></div>
                  <div><dt>{t('emp.cfg.version')}</dt><dd className="mono">{detail.version != null ? `v${detail.version}${detail.updatedAt ? ` · ${new Date(detail.updatedAt).toLocaleDateString()}` : ''}` : '—'}</dd></div>
                  <div><dt>{t('emp.cfg.role')}</dt><dd>{t('emp.cfg.roleValue')}</dd></div>
                </dl>
                <div className="divider" />
                <div className="model-chip">
                  <span className="chip muted">
                    {modelSource?.kind === 'byo_env' ? t('model.byo') : t('model.smoke')}
                  </span>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <b className="mono" style={{ fontSize: 11.5 }}>{modelSource?.modelId ?? '—'}</b>
                    <p className="muted" style={{ margin: 0, fontSize: 11.5 }}>
                      {t('emp.cfg.modelNote')}
                    </p>
                  </div>
                </div>
                <div className="commercial-inline">
                  <span className="chip warn">{t('product.badge')}</span>
                  <span style={{ fontSize: 12.5, color: 'var(--muted)' }}>{t('product.cap.modelRouting')}</span>
                </div>
              </div>
              <div className="panel">
                <div className="panel-head">
                  <h3 style={{ margin: 0 }}>{t('emp.cfg.prompt')}</h3>
                  <span className="hint-chip">{t('product.modal.commercialEdit')}</span>
                </div>
                <pre className="json" style={{ maxHeight: 120 }}>{detail.prompt ?? '—'}</pre>
                <p className="muted" style={{ margin: '6px 0 0', fontSize: 12 }}>
                  {t('emp.cfg.promptNote')}
                </p>
              </div>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              <div className="panel">
                <div className="panel-head">
                  <h3 style={{ margin: 0 }}>{t('emp.cfg.tools')}</h3>
                  <span className="chip muted">
                    {ops.length} / {ops.length} {t('emp.cfg.enabled')}
                  </span>
                </div>
                {ops.length === 0 ? (
                  <p className="muted" style={{ margin: '6px 0 0' }}>{t('policy.empty')}</p>
                ) : (
                  ops.map((rule, index) => (
                    <div className="config-row" key={index}>
                      <span
                        className="mini-icon"
                        style={{
                          background: rule.riskLevel === 'L3' ? 'var(--warn-soft)' : 'var(--info-soft)',
                          color: rule.riskLevel === 'L3' ? 'var(--warn)' : 'var(--info)',
                        }}
                      >
                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7">
                          <path d={rule.riskLevel === 'L3' ? 'M22 11.08V12a10 10 0 1 1-5.93-9.14M22 4L12 14.01l-3-3' : 'M8 6h13M8 12h13M8 18h13M3 6h.01M3 12h.01M3 18h.01'} />
                        </svg>
                      </span>
                      <div className="info">
                        <b className="mono">{rule.toolPattern ?? '—'}</b>
                        <span>{rule.description ?? rule.operation}</span>
                      </div>
                      <RiskBadge riskLevel={rule.riskLevel} />
                      <span className={`chip ${rule.action === 'approve' ? 'warn' : 'info'}`}>{rule.action}</span>
                      <span className="switch" title={t('emp.cfg.enabled')} />
                    </div>
                  ))
                )}
                <p className="muted" style={{ margin: '8px 0 0', fontSize: 12 }}>
                  {t('emp.cfg.denyNote')}
                </p>
              </div>
              <div className="panel">
                <div className="panel-head">
                  <h3 style={{ margin: 0 }}>{t('emp.cfg.autonomy')}</h3>
                  <span className="hint-chip">{t('policy.readonly')}</span>
                </div>
                <div className="level-track">
                  {RISK_LEVELS.map((level) => (
                    <div className={level === maxLevel ? 'level-step on' : 'level-step'} key={level}>
                      <b>{level}</b>
                      {t(LEVEL_LABEL_KEYS[level])}
                    </div>
                  ))}
                </div>
                {ops.length > 0 && (
                  <table style={{ marginTop: 10 }}>
                    <thead>
                      <tr>
                        <th>{t('emp.cfg.trigger')}</th>
                        <th>{t('policy.col.action')}</th>
                        <th>{t('emp.cfg.binding')}</th>
                      </tr>
                    </thead>
                    <tbody>
                      {ops.map((rule, index) => (
                        <tr key={index}>
                          <td>{rule.operation}</td>
                          <td>
                            <span className={`chip ${rule.action === 'approve' ? 'warn' : 'info'}`}>{rule.action}</span>
                          </td>
                          <td className="mono">{rule.toolPattern ?? '—'}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                )}
                <p className="muted" style={{ margin: '8px 0 0', fontSize: 12 }}>
                  {t('emp.cfg.pipelineNote')}
                </p>
              </div>
            </div>
          </div>
        </div>
      )}

      {tab === 'exec' && (
        <div className="subsec show">
          <div className="panel">
            {detail.recentExecutions.length === 0 ? (
              <EmptyState t={t} label={t('exec.empty')} />
            ) : (
              <table>
                <thead>
                  <tr>
                    <th>{t('exec.col.status')}</th>
                    <th>{t('exec.col.input')}</th>
                    <th>{t('exec.col.duration')}</th>
                    <th>{t('exec.detail.tokens')}</th>
                    <th>{t('exec.col.time')}</th>
                  </tr>
                </thead>
                <tbody>
                  {detail.recentExecutions.map((row) => (
                    <tr key={row.id}>
                      <td>{row.status}</td>
                      <td>{(row.rawInput ?? '').slice(0, 48)}</td>
                      <td className="mono">{row.durationMs == null ? '—' : `${row.durationMs} ms`}</td>
                      <td className="mono">{(row.totalInputTokens ?? 0)}/{row.totalOutputTokens ?? 0}</td>
                      <td className="muted">{new Date(row.createdAt).toLocaleString()}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </div>
      )}

      {tab === 'growth' && (
        <div className="subsec show">
          {detail.growthTimeline.filter((entry) => entry.kind === 'coaching').length === 0 ? (
            <div className="panel">
              <EmptyState t={t} label={t('growth.empty')} />
            </div>
          ) : (
            <ol className="growth-timeline">
              {detail.growthTimeline
                .filter((entry) => entry.kind === 'coaching')
                .map((entry, index) => (
                  <li className="growth-node k-coaching" key={index}>
                    <div className="growth-head">
                      <span className={`chip ${entry.decision === 'REJECTED' ? 'bad' : 'ok'}`}>
                        {t('growth.kind.coaching')} ·{' '}
                        {entry.decision === 'REJECTED' ? t('growth.rejected') : t('growth.approved')}
                      </span>
                      {entry.toolName && <span className="mono">{entry.toolName}</span>}
                      <span className="muted">{new Date(entry.at).toLocaleString()}</span>
                    </div>
                    <blockquote
                      className={`coaching-note ${entry.decision === 'REJECTED' ? 'is-correction' : ''}`}
                      style={{ margin: '2px 0' }}
                    >
                      {entry.comment ?? '—'}
                      {entry.actorName && (
                        <footer>
                          {t('growth.by', { name: entry.actorName })} · {t('growth.coachingSource')}
                        </footer>
                      )}
                    </blockquote>
                  </li>
                ))}
            </ol>
          )}
          <div>
            <button className="primary" onClick={() => onOpenGrowth(detail.id)}>
              {t('emp.detail.growthCta')} →
            </button>
          </div>
        </div>
      )}
    </section>
  );
}
