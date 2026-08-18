import { useCallback, useEffect, useState } from 'react';

import {
  fetchAgentDetail,
  fetchModelSource,
  updateAgentConfig,
  type AgentDetail,
  type ModelSource,
  type SensitiveOpRule,
} from '../api';
import type { Translator } from '../i18n';
import { EmptyState, formatPercent } from '../components/ui';

type SubTab = 'overview' | 'config' | 'exec' | 'growth';

const RISK_LEVELS = ['L0', 'L1', 'L2', 'L3', 'L4'] as const;
const RULE_ACTIONS = ['allow', 'audit', 'confirm', 'approve', 'block'] as const;

const LEVEL_LABEL_KEYS: Record<(typeof RISK_LEVELS)[number], Parameters<Translator>[0]> = {
  L0: 'emp.level.L0',
  L1: 'emp.level.L1',
  L2: 'emp.level.L2',
  L3: 'emp.level.L3',
  L4: 'emp.level.L4',
};

interface ConfigDraft {
  prompt: string;
  allowedTools: string[];
  sensitiveOps: SensitiveOpRule[];
  maxReActIterations: number;
  timeoutMs: number;
}

const emptyRule = (): SensitiveOpRule => ({
  operation: '',
  toolPattern: '',
  riskLevel: 'L2',
  action: 'approve',
  description: '',
});

/** Employee profile (frozen mockup §5.4): hero + in-page tabs. The CONFIG
 *  sub-page is an editable policy surface — prompt, tool allow-list,
 *  sensitive-op rules and execution constraints. Saving goes through the
 *  governed mutation (server-validated) and lands on the audit chain. */
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
  const [draft, setDraft] = useState<ConfigDraft | null>(null);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [savedVersion, setSavedVersion] = useState<number | null>(null);
  const [newTool, setNewTool] = useState('');

  const load = useCallback(() => {
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

  useEffect(() => load(), [load]);

  // Re-seed the draft whenever a fresh detail arrives.
  useEffect(() => {
    if (!detail) {
      setDraft(null);
      return;
    }
    const rules = detail.guardrailRules ?? {};
    setDraft({
      prompt: detail.prompt ?? '',
      allowedTools: [...(rules.allowedTools ?? [])],
      sensitiveOps: (rules.sensitiveOps ?? []).map((rule) => ({ ...rule })),
      maxReActIterations: rules.execution?.maxReActIterations ?? 4,
      timeoutMs: rules.execution?.timeoutMs ?? 60_000,
    });
  }, [detail]);

  if (loading) return <p className="muted">{t('common.loading')}</p>;
  if (notFound || !detail || !draft) {
    return <EmptyState t={t} label={t('emp.detail.notFound')} />;
  }

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

  const addTool = () => {
    const tool = newTool.trim();
    if (!tool || draft.allowedTools.includes(tool)) return;
    setDraft((current) =>
      current ? { ...current, allowedTools: [...current.allowedTools, tool] } : current,
    );
    setNewTool('');
  };

  const patchRule = (index: number, patch: Partial<SensitiveOpRule>) => {
    setDraft((current) =>
      current
        ? {
            ...current,
            sensitiveOps: current.sensitiveOps.map((rule, i) =>
              i === index ? { ...rule, ...patch } : rule,
            ),
          }
        : current,
    );
  };

  const removeRule = (index: number) => {
    setDraft((current) =>
      current
        ? { ...current, sensitiveOps: current.sensitiveOps.filter((_, i) => i !== index) }
        : current,
    );
  };

  const addRule = () => {
    setDraft((current) =>
      current
        ? { ...current, sensitiveOps: [...current.sensitiveOps, emptyRule()] }
        : current,
    );
  };

  const save = async () => {
    if (!draft) return;
    setSaving(true);
    setSaveError(null);
    try {
      const result = await updateAgentConfig(token, detail.id, {
        prompt: draft.prompt,
        allowedTools: draft.allowedTools,
        sensitiveOps: draft.sensitiveOps
          .filter((rule) => rule.operation && rule.toolPattern)
          .map((rule) => ({ ...rule, objectApiName: rule.objectApiName ?? '*' })),
        execution: {
          maxReActIterations: draft.maxReActIterations,
          timeoutMs: draft.timeoutMs,
        },
      });
      setSavedVersion(result.version);
      await load();
    } catch {
      setSaveError(t('emp.cfg.saveError'));
    } finally {
      setSaving(false);
    }
  };

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
              </div>

              <div className="panel">
                <div className="panel-head">
                  <h3 style={{ margin: 0 }}>{t('emp.cfg.prompt')}</h3>
                </div>
                <label className="visually-hidden" htmlFor="cfg-prompt">{t('emp.cfg.prompt')}</label>
                <textarea
                  id="cfg-prompt"
                  className="cfg-textarea"
                  rows={5}
                  value={draft.prompt}
                  onChange={(event) =>
                    setDraft((current) =>
                      current ? { ...current, prompt: event.target.value } : current,
                    )
                  }
                />
                <p className="muted" style={{ margin: '6px 0 0', fontSize: 12 }}>
                  {t('emp.cfg.promptNote')}
                </p>
              </div>

              <div className="panel">
                <div className="panel-head">
                  <h3 style={{ margin: 0 }}>{t('emp.cfg.execution')}</h3>
                </div>
                <div className="cfg-exec-grid">
                  <label>
                    <span>{t('emp.cfg.maxSteps')}</span>
                    <input
                      type="number"
                      min={1}
                      max={50}
                      value={draft.maxReActIterations}
                      onChange={(event) =>
                        setDraft((current) =>
                          current
                            ? { ...current, maxReActIterations: Number(event.target.value) || 4 }
                            : current,
                        )
                      }
                    />
                  </label>
                  <label>
                    <span>{t('emp.cfg.timeout')}</span>
                    <input
                      type="number"
                      min={1000}
                      max={600000}
                      step={1000}
                      value={draft.timeoutMs}
                      onChange={(event) =>
                        setDraft((current) =>
                          current
                            ? { ...current, timeoutMs: Number(event.target.value) || 60_000 }
                            : current,
                        )
                      }
                    />
                  </label>
                </div>
              </div>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              <div className="panel">
                <div className="panel-head">
                  <h3 style={{ margin: 0 }}>{t('emp.cfg.allowedTools')}</h3>
                  <span className="chip muted">{draft.allowedTools.length}</span>
                </div>
                <div className="tool-chips">
                  {draft.allowedTools.length === 0 && (
                    <p className="muted" style={{ margin: '2px 0 6px', fontSize: 12 }}>
                      {t('emp.cfg.allowedToolsEmpty')}
                    </p>
                  )}
                  {draft.allowedTools.map((tool) => (
                    <span className="tool-chip" key={tool}>
                      <span className="mono">{tool}</span>
                      <button
                        type="button"
                        aria-label={t('emp.cfg.removeTool', { tool })}
                        onClick={() =>
                          setDraft((current) =>
                            current
                              ? {
                                  ...current,
                                  allowedTools: current.allowedTools.filter((value) => value !== tool),
                                }
                              : current,
                          )
                        }
                      >
                        ×
                      </button>
                    </span>
                  ))}
                </div>
                <div className="tool-add-row">
                  <input
                    type="text"
                    placeholder={t('emp.cfg.toolPlaceholder')}
                    value={newTool}
                    onChange={(event) => setNewTool(event.target.value)}
                    onKeyDown={(event) => {
                      if (event.key === 'Enter') {
                        event.preventDefault();
                        addTool();
                      }
                    }}
                  />
                  <button type="button" onClick={addTool} disabled={!newTool.trim()}>
                    {t('emp.cfg.addTool')}
                  </button>
                </div>
                <p className="muted" style={{ margin: '8px 0 0', fontSize: 12 }}>
                  {t('emp.cfg.denyNote')}
                </p>
              </div>

              <div className="panel">
                <div className="panel-head">
                  <h3 style={{ margin: 0 }}>{t('emp.cfg.rules')}</h3>
                </div>
                {draft.sensitiveOps.length === 0 ? (
                  <p className="muted" style={{ margin: '6px 0 0' }}>{t('policy.empty')}</p>
                ) : (
                  draft.sensitiveOps.map((rule, index) => (
                    <div className="rule-editor" key={index}>
                      <div className="rule-editor-row">
                        <input
                          className="mono"
                          placeholder={t('emp.cfg.ruleTool')}
                          value={rule.toolPattern ?? ''}
                          onChange={(event) => patchRule(index, { toolPattern: event.target.value })}
                        />
                        <input
                          placeholder={t('emp.cfg.ruleOperation')}
                          value={rule.operation}
                          onChange={(event) => patchRule(index, { operation: event.target.value })}
                        />
                      </div>
                      <div className="rule-editor-row">
                        <select
                          aria-label={t('policy.col.risk')}
                          value={rule.riskLevel}
                          onChange={(event) => patchRule(index, { riskLevel: event.target.value })}
                        >
                          {RISK_LEVELS.map((level) => (
                            <option key={level} value={level}>
                              {level}
                            </option>
                          ))}
                        </select>
                        <select
                          aria-label={t('policy.col.action')}
                          value={rule.action}
                          onChange={(event) => patchRule(index, { action: event.target.value })}
                        >
                          {RULE_ACTIONS.map((action) => (
                            <option key={action} value={action}>
                              {action}
                            </option>
                          ))}
                        </select>
                        <button
                          type="button"
                          className="ghost"
                          aria-label={t('emp.cfg.removeRule')}
                          onClick={() => removeRule(index)}
                        >
                          ×
                        </button>
                      </div>
                      <input
                        className="rule-desc"
                        placeholder={t('emp.cfg.ruleDesc')}
                        value={rule.description ?? ''}
                        onChange={(event) => patchRule(index, { description: event.target.value })}
                      />
                    </div>
                  ))
                )}
                <button type="button" className="ghost" onClick={addRule} style={{ marginTop: 8 }}>
                  + {t('emp.cfg.addRule')}
                </button>
              </div>

              <div className="panel">
                <div className="panel-head">
                  <h3 style={{ margin: 0 }}>{t('emp.cfg.autonomy')}</h3>
                </div>
                <div className="level-track">
                  {RISK_LEVELS.map((level) => (
                    <div className={level === maxLevel ? 'level-step on' : 'level-step'} key={level}>
                      <b>{level}</b>
                      {t(LEVEL_LABEL_KEYS[level])}
                    </div>
                  ))}
                </div>
                <p className="muted" style={{ margin: '8px 0 0', fontSize: 12 }}>
                  {t('emp.cfg.pipelineNote')}
                </p>
              </div>
            </div>
          </div>

          <div className="save-bar">
            <div className="save-status">
              {savedVersion != null && (
                <span className="form-ok">{t('emp.cfg.saved', { n: savedVersion })}</span>
              )}
              {saveError && <span className="form-error" role="alert">{saveError}</span>}
              <span className="muted" style={{ fontSize: 12 }}>{t('emp.cfg.editNote')}</span>
            </div>
            <button className="primary" onClick={save} disabled={saving}>
              {saving ? t('emp.cfg.saving') : t('emp.cfg.save')}
            </button>
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
