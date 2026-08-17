import { useState, type FormEvent } from 'react';

import { executeAgent, type AgentSummary } from '../api';
import type { Translator } from '../i18n';

export function RunView({
  t,
  token,
  agents,
  loading,
  onExecuted,
}: {
  t: Translator;
  token: string;
  agents: AgentSummary[];
  loading: boolean;
  onExecuted: (executionId: string) => void;
}) {
  const [agentId, setAgentId] = useState('');
  const [input, setInput] = useState('');
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const selected = agentId || agents[0]?.id || '';

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    setError(null);
    setMessage(null);
    if (!selected) {
      setError(t('run.noAgent'));
      return;
    }
    if (!input.trim()) {
      setError(t('run.emptyInput'));
      return;
    }
    setBusy(true);
    try {
      const execution = await executeAgent(token, selected, input.trim());
      setMessage(t('run.submitted'));
      onExecuted(execution.id);
    } catch {
      setError(t('run.error'));
    } finally {
      setBusy(false);
    }
  };

  return (
    <section className="panel">
      <h2>{t('run.title')}</h2>
      <p className="muted">{t('run.hint')}</p>
      <form className="run-form" onSubmit={submit}>
        <label>
          <span>{t('run.agent')}</span>
          <select value={selected} onChange={(e) => setAgentId(e.target.value)}>
            {agents.map((agent) => (
              <option key={agent.id} value={agent.id}>
                {agent.name} · {agent.status}
              </option>
            ))}
          </select>
        </label>
        <label>
          <span>{t('run.input')}</span>
          <textarea
            rows={3}
            placeholder={t('run.inputPlaceholder')}
            value={input}
            onChange={(e) => setInput(e.target.value)}
          />
        </label>
        <button type="submit" disabled={busy || loading || agents.length === 0}>
          {busy ? t('run.running') : t('run.submit')}
        </button>
        {message && <p className="form-ok" role="status">{message}</p>}
        {error && <p className="form-error" role="alert">{error}</p>}
      </form>
    </section>
  );
}
