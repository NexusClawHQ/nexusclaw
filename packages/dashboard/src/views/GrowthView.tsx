import { useCallback, useEffect, useState } from 'react';

import {
  executeAgent,
  fetchExecution,
  fetchGrowthTimeline,
  type AgentSummary,
  type ExecutionDetail,
  type GrowthEntry,
} from '../api';
import type { Translator } from '../i18n';
import {
  EmptyState,
  formatDuration,
  formatPercent,
  StatusChip,
} from '../components/ui';

/** Training & growth (AC-6.1–6.6): pick a digital employee from the list,
 *  then read that employee's growth timeline — coaching notes from approval
 *  decisions, L3 escalations, milestones — with replay-compare. Everything
 *  is derived from governance data. */
export function GrowthView({
  t,
  token,
  agents,
  selectedAgentId,
  onSelectAgent,
  onOpenExecution,
}: {
  t: Translator;
  token: string;
  agents: AgentSummary[];
  selectedAgentId: string | null;
  onSelectAgent: (id: string) => void;
  onOpenExecution: (id: string) => void;
}) {
  // selectedAgentId is the external entry point (e.g. "open training" from
  // an employee profile); the list view is the default.
  const [selectedId, setSelectedId] = useState<string | null>(selectedAgentId);
  const [entries, setEntries] = useState<GrowthEntry[] | null>(null);
  const [replay, setReplay] = useState<{
    originalId: string;
    replayId: string;
  } | null>(null);
  const [replaying, setReplaying] = useState(false);
  const [original, setOriginal] = useState<ExecutionDetail | null>(null);
  const [replayed, setReplayed] = useState<ExecutionDetail | null>(null);

  useEffect(() => {
    setSelectedId(selectedAgentId);
  }, [selectedAgentId]);

  useEffect(() => {
    if (!selectedId) return;
    let cancelled = false;
    fetchGrowthTimeline(token, selectedId)
      .then((rows) => {
        if (!cancelled) setEntries(rows);
      })
      .catch(() => {
        if (!cancelled) setEntries([]);
      });
    return () => {
      cancelled = true;
    };
  }, [token, selectedId]);

  const openEmployee = (id: string) => {
    setSelectedId(id);
    onSelectAgent(id);
  };

  const replayRun = useCallback(
    async (entry: GrowthEntry) => {
      if (!selectedId || replaying) return;
      setReplaying(true);
      setReplay(null);
      setOriginal(null);
      setReplayed(null);
      try {
        const source = await fetchExecution(token, entry.executionId);
        if (source) setOriginal(source);
        const started = await executeAgent(
          token,
          selectedId,
          source?.rawInput ?? '',
        );
        // Poll until terminal, then load for the side-by-side compare.
        for (let tick = 0; tick < 40; tick++) {
          await new Promise((resolve) => setTimeout(resolve, 1_500));
          const current = await fetchExecution(token, started.id);
          if (current && ['done', 'failed', 'timeout', 'cancelled'].includes(current.status)) {
            setReplayed(current);
            break;
          }
          if (current?.status === 'guardrail_pending') {
            setReplayed(current);
            break;
          }
        }
        setReplay({ originalId: entry.executionId, replayId: started.id });
      } finally {
        setReplaying(false);
      }
    },
    [token, selectedId, replaying],
  );

  const identical =
    original != null &&
    replayed != null &&
    original.rawInput === replayed.rawInput &&
    original.reactSteps.length === replayed.reactSteps.length;

  if (selectedId === null) {
    // Step 1 — the employee list; each card opens that employee's training.
    return (
      <section className="view">
        <h2>{t('growth.title')}</h2>
        <p className="muted">{t('growth.subtitle')}</p>
        {agents.length === 0 ? (
          <EmptyState t={t} label={t('growth.agentsEmpty')} />
        ) : (
          <div className="card-wall">
            {agents.map((agent) => (
              <button className="employee-card" key={agent.id} onClick={() => openEmployee(agent.id)}>
                <span className="avatar" aria-hidden="true">
                  {agent.name.slice(0, 1).toUpperCase()}
                </span>
                <b>{agent.name}</b>
                <span className={`chip ${agent.status === 'active' ? 'ok' : 'muted'}`}>
                  {agent.status}
                </span>
                {agent.description && <p className="muted">{agent.description}</p>}
                <dl className="employee-stats">
                  <div>
                    <dt>{t('emp.stats.executions')}</dt>
                    <dd>{agent.stats?.totalExecutions ?? 0}</dd>
                  </div>
                  <div>
                    <dt>{t('emp.stats.success')}</dt>
                    <dd>{formatPercent(agent.stats?.successRate ?? null)}</dd>
                  </div>
                  <div>
                    <dt>{t('emp.stats.approvals')}</dt>
                    <dd>{formatPercent(agent.stats?.approvalRate ?? null)}</dd>
                  </div>
                  <div>
                    <dt>{t('emp.stats.l3')}</dt>
                    <dd>{agent.stats?.l3EscalationCount ?? 0}</dd>
                  </div>
                </dl>
              </button>
            ))}
          </div>
        )}
      </section>
    );
  }

  const selectedAgent = agents.find((agent) => agent.id === selectedId) ?? null;

  // Step 2 — the selected employee's training timeline + replay-compare.
  return (
    <section className="view">
      <button className="ghost" onClick={() => setSelectedId(null)}>
        ← {t('growth.back')}
      </button>
      <h2>{t('growth.title')}</h2>
      <p className="muted">
        {selectedAgent ? selectedAgent.name : '—'} · {t('growth.subtitle')}
      </p>

      {entries === null ? (
        <p className="muted">{t('common.loading')}</p>
      ) : entries.length === 0 ? (
        <EmptyState t={t} label={t('growth.empty')} />
      ) : (
        <ol className="growth-timeline">
          {entries.map((entry, index) => (
            <li className={`growth-node k-${entry.kind}`} key={`${entry.kind}-${entry.executionId}-${index}`}>
              <div className="growth-head">
                <span className={`chip ${entry.kind === 'coaching' ? (entry.decision === 'REJECTED' ? 'bad' : 'ok') : entry.kind === 'escalation' ? 'warn' : 'info'}`}>
                  {t(`growth.kind.${entry.kind}` as Parameters<Translator>[0])}
                  {entry.kind === 'coaching' &&
                    ` · ${entry.decision === 'REJECTED' ? t('growth.rejected') : t('growth.approved')}`}
                </span>
                {entry.toolName && <span className="mono">{entry.toolName}</span>}
                <span className="muted">{new Date(entry.at).toLocaleString()}</span>
              </div>
              {entry.kind === 'coaching' && (
                <blockquote className={`coaching-note ${entry.decision === 'REJECTED' ? 'is-correction' : ''}`}>
                  {entry.comment ?? '—'}
                  {entry.actorName && (
                    <footer className="muted">{t('growth.by', { name: entry.actorName })}</footer>
                  )}
                </blockquote>
              )}
              {entry.kind === 'milestone' && entry.status && <StatusChip status={entry.status} t={t} />}
              <div className="growth-actions">
                <button className="ghost" onClick={() => onOpenExecution(entry.executionId)}>
                  {t('growth.openExecution')} →
                </button>
                <button className="ghost" disabled={replaying} onClick={() => void replayRun(entry)}>
                  {replaying ? t('growth.replay.running') : `↻ ${t('growth.replay')}`}
                </button>
              </div>
            </li>
          ))}
        </ol>
      )}

      {replay && (
        <div className="panel">
          <h3>{t('growth.replay.compare')}</h3>
          <div className={`verdict-bar ${identical ? 'same' : 'diff'}`}>
            {identical ? t('growth.replay.identical') : t('growth.replay.differs')}
          </div>
          <div className="compare-grid">
            {[
              { label: t('growth.replay.original'), detail: original },
              { label: t('growth.replay.latest'), detail: replayed },
            ].map((column) => (
              <div className="compare-column" key={column.label}>
                <h4>{column.label}</h4>
                {column.detail ? (
                  <>
                    <StatusChip status={column.detail.status} t={t} />
                    <p className="muted">
                      {formatDuration(column.detail.durationMs, t)} ·{' '}
                      {column.detail.reactSteps.length} steps
                    </p>
                    <ol className="compare-steps">
                      {column.detail.reactSteps
                        .slice()
                        .sort((a, b) => a.stepIndex - b.stepIndex)
                        .map((step) => (
                          <li key={step.id}>
                            <span className="mono">{step.toolName ?? step.actionType}</span>
                          </li>
                        ))}
                    </ol>
                  </>
                ) : (
                  <p className="muted">{t('common.loading')}</p>
                )}
              </div>
            ))}
          </div>
        </div>
      )}
    </section>
  );
}
