import { useCallback, useEffect, useState } from 'react';

import {
  fetchExecution,
  fetchExecutionEvents,
  type ExecutionDetail,
  type ExecutionSummary,
  type OutboxEventView,
} from '../api';
import type { Translator } from '../i18n';
import {
  Field,
  JsonBlock,
  StatusChip,
  TERMINAL_STATUSES,
  formatDuration,
  formatTokens,
  formatWhen,
} from '../components/ui';

const DETAIL_POLL_MS = 3000;

function ExecutionDetailPanel({
  t,
  token,
  lang,
  executionId,
  onClose,
}: {
  t: Translator;
  token: string;
  lang: string;
  executionId: string;
  onClose: () => void;
}) {
  const [detail, setDetail] = useState<ExecutionDetail | null>(null);
  const [events, setEvents] = useState<OutboxEventView[]>([]);
  const [error, setError] = useState(false);

  const load = useCallback(async () => {
    try {
      const [nextDetail, nextEvents] = await Promise.all([
        fetchExecution(token, executionId),
        fetchExecutionEvents(token, executionId),
      ]);
      setDetail(nextDetail);
      setEvents(nextEvents);
      setError(false);
    } catch {
      setError(true);
    }
  }, [token, executionId]);

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    if (!detail || TERMINAL_STATUSES.has(detail.status)) return;
    const timer = window.setInterval(() => void load(), DETAIL_POLL_MS);
    return () => window.clearInterval(timer);
  }, [detail, load]);

  return (
    <section className="panel detail-panel" aria-label={t('exec.detail')}>
      <header className="detail-header">
        <h2>
          {t('exec.detail')} · <code>{executionId.slice(0, 8)}</code>
        </h2>
        <button className="ghost" onClick={onClose}>
          {t('exec.close')}
        </button>
      </header>

      {error && <p className="form-error">{t('common.error')}</p>}
      {!detail && !error && <p className="muted">{t('common.loading')}</p>}

      {detail && (
        <>
          <div className="meta-grid">
            <Field label={t('exec.col.status')}>
              <StatusChip status={detail.status} t={t} />
            </Field>
            <Field label={t('exec.col.created')}>{formatWhen(detail.createdAt, lang)}</Field>
            <Field label={t('exec.col.duration')}>
              {formatDuration(detail.durationMs, t)}
            </Field>
            <Field label={t('exec.detail.tokens')}>
              {formatTokens(detail.totalInputTokens, detail.totalOutputTokens)}
            </Field>
            <Field label={t('exec.detail.cost')}>
              {detail.totalCost === null ? '—' : detail.totalCost.toFixed(5)}
            </Field>
          </div>

          <h3>{t('exec.detail.output')}</h3>
          <p className="output-summary">{detail.outputSummary ?? t('common.never')}</p>

          <h3>{t('exec.detail.timeline')}</h3>
          {detail.reactSteps.length === 0 ? (
            <p className="muted">{t('step.empty')}</p>
          ) : (
            <ol className="timeline">
              {detail.reactSteps.map((step) => (
                <li key={step.id} className={step.guardrailTriggered ? 'guardrail' : ''}>
                  <div className="step-head">
                    <span className="step-index">#{step.stepIndex}</span>
                    {step.toolName && (
                      <span>
                        <code>{step.toolName}</code> · {step.actionType}
                      </span>
                    )}
                    {step.guardrailTriggered && (
                      <span className="chip warn">{t('step.guardrail')}</span>
                    )}
                  </div>
                  {step.thoughtReasoning && (
                    <p>
                      <b>{t('step.thought')}:</b> {step.thoughtReasoning}
                    </p>
                  )}
                  {step.observationSuccess && (
                    <p>
                      <b>{t('step.observation')}:</b> {step.observationSuccess}
                    </p>
                  )}
                  {step.observationError && (
                    <p className="obs-error">
                      <b>{t('step.observationError')}:</b> {step.observationError}
                    </p>
                  )}
                </li>
              ))}
            </ol>
          )}

          <h3>{t('exec.detail.tools')}</h3>
          {detail.toolCallRecords.length === 0 ? (
            <p className="muted">{t('tool.empty')}</p>
          ) : (
            <div className="tool-table">
              {detail.toolCallRecords.map((call) => (
                <details key={call.id} className="tool-row">
                  <summary>
                    <code>{call.toolName}</code>
                    <StatusChip status={call.status} t={t} />
                    <span className="muted">{formatDuration(call.durationMs, t)}</span>
                  </summary>
                  <div className="tool-detail">
                    <Field label={t('tool.checks')}>
                      {call.permissionCheck ?? '—'} · {call.guardrailCheck ?? '—'}
                    </Field>
                    <Field label={t('tool.input')}>
                      <JsonBlock value={call.input} />
                    </Field>
                    <Field label={t('tool.output')}>
                      <JsonBlock value={call.output} />
                    </Field>
                  </div>
                </details>
              ))}
            </div>
          )}

          <h3>{t('exec.detail.events')}</h3>
          {events.length === 0 ? (
            <p className="muted">{t('events.empty')}</p>
          ) : (
            <div className="event-stream">
              {events.map((event) => (
                <details key={event.id} className="event-row">
                  <summary>
                    <span className="event-type">
                      <code>{event.eventType}</code>
                    </span>
                    <span className="muted">{formatWhen(event.createdAt, lang)}</span>
                    <span className="chip muted">{event.topic}</span>
                  </summary>
                  <Field label={t('events.payload')}>
                    <JsonBlock value={event.payload} />
                  </Field>
                </details>
              ))}
            </div>
          )}
        </>
      )}
    </section>
  );
}

export function ExecutionsView({
  t,
  token,
  executions,
  loading,
  focusExecutionId,
  onFocusHandled,
  lang,
}: {
  t: Translator;
  token: string;
  executions: ExecutionSummary[];
  loading: boolean;
  focusExecutionId: string | null;
  onFocusHandled: () => void;
  lang: string;
}) {
  const [selectedId, setSelectedId] = useState<string | null>(null);

  useEffect(() => {
    if (focusExecutionId) {
      setSelectedId(focusExecutionId);
      onFocusHandled();
    }
  }, [focusExecutionId, onFocusHandled]);

  return (
    <div className="split">
      <section className="panel">
        <h2>{t('exec.title')}</h2>
        {loading && executions.length === 0 && <p className="muted">{t('common.loading')}</p>}
        {!loading && executions.length === 0 && <p className="muted">{t('exec.empty')}</p>}
        {executions.length > 0 && (
          <table className="exec-table">
            <thead>
              <tr>
                <th>{t('exec.col.status')}</th>
                <th>{t('exec.col.input')}</th>
                <th>{t('exec.col.created')}</th>
                <th>{t('exec.col.duration')}</th>
              </tr>
            </thead>
            <tbody>
              {executions.map((execution) => (
                <tr
                  key={execution.id}
                  className={execution.id === selectedId ? 'selected' : ''}
                  onClick={() => setSelectedId(execution.id)}
                >
                  <td>
                    <StatusChip status={execution.status} t={t} />
                  </td>
                  <td className="cell-input">{execution.rawInput}</td>
                  <td>{formatWhen(execution.createdAt, lang)}</td>
                  <td>{formatDuration(execution.durationMs, t)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </section>
      {selectedId && (
        <ExecutionDetailPanel
          t={t}
          token={token}
          lang={lang}
          executionId={selectedId}
          onClose={() => setSelectedId(null)}
        />
      )}
    </div>
  );
}
