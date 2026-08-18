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
  CommercialPreviewCard,
  EmptyState,
  formatDuration,
  StatusChip,
} from '../components/ui';
import { COMMERCIAL_PREVIEW } from '../components/ui';

const GROWTH_LOOP_PREVIEW = COMMERCIAL_PREVIEW.find(
  (capability) => capability.key === 'growthLoop',
)!;

/** Training & growth — the flagship showcase surface (AC-6.1–6.6).
 *  Timeline + replay-compare, everything derived from governance data. */
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
  const [entries, setEntries] = useState<GrowthEntry[] | null>(null);
  const [replay, setReplay] = useState<{
    originalId: string;
    replayId: string;
  } | null>(null);
  const [replaying, setReplaying] = useState(false);
  const [original, setOriginal] = useState<ExecutionDetail | null>(null);
  const [replayed, setReplayed] = useState<ExecutionDetail | null>(null);

  useEffect(() => {
    if (!selectedAgentId) return;
    let cancelled = false;
    fetchGrowthTimeline(token, selectedAgentId)
      .then((rows) => {
        if (!cancelled) setEntries(rows);
      })
      .catch(() => {
        if (!cancelled) setEntries([]);
      });
    return () => {
      cancelled = true;
    };
  }, [token, selectedAgentId]);

  const replayRun = useCallback(
    async (entry: GrowthEntry) => {
      if (!selectedAgentId || replaying) return;
      setReplaying(true);
      setReplay(null);
      setOriginal(null);
      setReplayed(null);
      try {
        const source = await fetchExecution(token, entry.executionId);
        if (source) setOriginal(source);
        const started = await executeAgent(
          token,
          selectedAgentId,
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
    [token, selectedAgentId, replaying],
  );

  const identical =
    original != null &&
    replayed != null &&
    original.rawInput === replayed.rawInput &&
    original.reactSteps.length === replayed.reactSteps.length;

  return (
    <section className="view">
      <h2>{t('growth.title')}</h2>
      <p className="muted">{t('growth.subtitle')}</p>
      {agents.length > 1 && (
        <select
          value={selectedAgentId ?? agents[0].id}
          onChange={(event) => onSelectAgent(event.target.value)}
          aria-label={t('run.agent')}
        >
          {agents.map((agent) => (
            <option key={agent.id} value={agent.id}>
              {agent.name}
            </option>
          ))}
        </select>
      )}

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

      <div className="panel">
        <p className="muted">{t('growth.stats.source')}</p>
        <CommercialPreviewCard capability={GROWTH_LOOP_PREVIEW} t={t} />
      </div>
    </section>
  );
}
