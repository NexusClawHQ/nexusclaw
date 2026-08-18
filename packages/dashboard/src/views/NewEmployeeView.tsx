import { useState } from 'react';

import { createAgent, type SensitiveOpRule } from '../api';
import type { Translator } from '../i18n';

const RISK_LEVELS = ['L0', 'L1', 'L2', 'L3', 'L4'] as const;
const RULE_ACTIONS = ['allow', 'audit', 'confirm', 'approve', 'block'] as const;

interface NewAgentDraft {
  name: string;
  apiName: string;
  description: string;
  prompt: string;
  allowedTools: string[];
  sensitiveOps: SensitiveOpRule[];
  maxReActIterations: number;
  timeoutMs: number;
}

const initialDraft: NewAgentDraft = {
  name: '',
  apiName: '',
  description: '',
  prompt: '',
  allowedTools: [],
  sensitiveOps: [],
  maxReActIterations: 4,
  timeoutMs: 60_000,
};

const emptyRule = (): SensitiveOpRule => ({
  operation: '',
  toolPattern: '',
  riskLevel: 'L2',
  action: 'approve',
  description: '',
});

/** Create a new digital employee with its initial policy. The mutation is
 *  server-validated and every creation lands on the audit chain. */
export function NewEmployeeView({
  t,
  token,
  onCreated,
  onCancel,
}: {
  t: Translator;
  token: string;
  onCreated: (id: string) => void;
  onCancel: () => void;
}) {
  const [draft, setDraft] = useState<NewAgentDraft>(initialDraft);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [newTool, setNewTool] = useState('');

  const patch = (partial: Partial<NewAgentDraft>) =>
    setDraft((current) => ({ ...current, ...partial }));

  const addTool = () => {
    const tool = newTool.trim();
    if (!tool || draft.allowedTools.includes(tool)) return;
    patch({ allowedTools: [...draft.allowedTools, tool] });
    setNewTool('');
  };

  const patchRule = (index: number, rulePatch: Partial<SensitiveOpRule>) => {
    patch({
      sensitiveOps: draft.sensitiveOps.map((rule, i) =>
        i === index ? { ...rule, ...rulePatch } : rule,
      ),
    });
  };

  const submit = async () => {
    if (!draft.name.trim() || !draft.apiName.trim() || busy) return;
    setBusy(true);
    setError(null);
    try {
      const created = await createAgent(token, {
        name: draft.name.trim(),
        apiName: draft.apiName.trim(),
        description: draft.description.trim() || null,
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
      onCreated(created.id);
    } catch {
      setError(t('emp.new.error'));
    } finally {
      setBusy(false);
    }
  };

  return (
    <section className="view">
      <button className="ghost" onClick={onCancel}>
        ← {t('emp.detail.back')}
      </button>
      <h2>{t('emp.new.title')}</h2>
      <p className="muted">{t('emp.new.subtitle')}</p>

      <div className="panel">
        <div className="panel-head">
          <h3 style={{ margin: 0 }}>{t('emp.cfg.basic')}</h3>
        </div>
        <div className="new-agent-grid">
          <label>
            <span>{t('emp.new.name')} *</span>
            <input
              value={draft.name}
              onChange={(event) => patch({ name: event.target.value })}
              placeholder={t('emp.new.namePlaceholder')}
            />
          </label>
          <label>
            <span>{t('emp.new.apiName')} *</span>
            <input
              className="mono"
              value={draft.apiName}
              onChange={(event) => patch({ apiName: event.target.value })}
              placeholder={t('emp.new.apiNamePlaceholder')}
            />
          </label>
          <label style={{ gridColumn: '1 / -1' }}>
            <span>{t('emp.new.description')}</span>
            <input
              value={draft.description}
              onChange={(event) => patch({ description: event.target.value })}
              placeholder={t('emp.new.descriptionPlaceholder')}
            />
          </label>
        </div>
      </div>

      <div className="panel">
        <div className="panel-head">
          <h3 style={{ margin: 0 }}>{t('emp.cfg.prompt')}</h3>
        </div>
        <textarea
          className="cfg-textarea"
          rows={5}
          value={draft.prompt}
          onChange={(event) => patch({ prompt: event.target.value })}
        />
        <p className="muted" style={{ margin: '6px 0 0', fontSize: 12 }}>
          {t('emp.cfg.promptNote')}
        </p>
      </div>

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
                  patch({ allowedTools: draft.allowedTools.filter((value) => value !== tool) })
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
                  onClick={() =>
                    patch({ sensitiveOps: draft.sensitiveOps.filter((_, i) => i !== index) })
                  }
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
        <button
          type="button"
          className="ghost"
          onClick={() => patch({ sensitiveOps: [...draft.sensitiveOps, emptyRule()] })}
          style={{ marginTop: 8 }}
        >
          + {t('emp.cfg.addRule')}
        </button>
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
                patch({ maxReActIterations: Number(event.target.value) || 4 })
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
              onChange={(event) => patch({ timeoutMs: Number(event.target.value) || 60_000 })}
            />
          </label>
        </div>
      </div>

      <div className="save-bar">
        <div className="save-status">
          {error && <span className="form-error" role="alert">{error}</span>}
          <span className="muted" style={{ fontSize: 12 }}>{t('emp.cfg.editNote')}</span>
        </div>
        <button
          className="primary"
          onClick={submit}
          disabled={busy || !draft.name.trim() || !draft.apiName.trim()}
        >
          {busy ? t('emp.cfg.saving') : t('emp.new.submit')}
        </button>
      </div>
    </section>
  );
}
