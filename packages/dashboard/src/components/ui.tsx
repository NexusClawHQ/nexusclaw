import type { ReactNode } from 'react';

import type { ExecutionStatus } from '../api';
import type { Translator } from '../i18n';

const STATUS_CLASS: Record<string, string> = {
  pending: 'muted',
  running: 'info',
  guardrail_pending: 'warn',
  done: 'ok',
  failed: 'bad',
  timeout: 'bad',
  cancelled: 'bad',
};

const KNOWN_STATUSES = [
  'pending',
  'running',
  'guardrail_pending',
  'done',
  'failed',
  'timeout',
  'cancelled',
] as const;

type KnownStatus = (typeof KNOWN_STATUSES)[number];

export function StatusChip({ status, t }: { status: string; t: Translator }) {
  const known = KNOWN_STATUSES.find((value): value is KnownStatus => value === status);
  return (
    <span className={`chip ${STATUS_CLASS[status] ?? 'muted'}`}>
      {known ? t(`status.${known}`) : status}
    </span>
  );
}

const RISK_CLASS: Record<string, string> = {
  L1: 'ok',
  L2: 'info',
  L3: 'warn',
  L4: 'bad',
};

export function RiskBadge({ riskLevel }: { riskLevel: string }) {
  return <span className={`chip ${RISK_CLASS[riskLevel] ?? 'muted'}`}>{riskLevel}</span>;
}

export function JsonBlock({ value }: { value: unknown }) {
  let text: string;
  if (typeof value === 'string') {
    try {
      text = JSON.stringify(JSON.parse(value), null, 2);
    } catch {
      text = value;
    }
  } else if (value === null || value === undefined) {
    text = '—';
  } else {
    text = JSON.stringify(value, null, 2);
  }
  return <pre className="json">{text}</pre>;
}

export function Field({ label, children }: { label: ReactNode; children: ReactNode }) {
  return (
    <div className="field">
      <span className="field-label">{label}</span>
      <span className="field-value">{children}</span>
    </div>
  );
}

export function formatDuration(ms: number | null, t: Translator): string {
  if (ms === null || ms === undefined) return t('common.never');
  if (ms < 10_000) return t('common.ms', { n: ms });
  return `${(ms / 1000).toFixed(1)} s`;
}

export function formatWhen(iso: string | null, lang: string): string {
  if (!iso) return '—';
  const date = new Date(iso);
  const deltaMs = Date.now() - date.getTime();
  const rtf = new Intl.RelativeTimeFormat(lang, { numeric: 'auto' });
  if (deltaMs < 60_000) return rtf.format(Math.max(-59, Math.round(-deltaMs / 1000)), 'second');
  if (deltaMs < 3_600_000) return rtf.format(Math.round(-deltaMs / 60_000), 'minute');
  if (deltaMs < 86_400_000) return rtf.format(Math.round(-deltaMs / 3_600_000), 'hour');
  return date.toLocaleString(lang);
}

export function formatTokens(input: number | null, output: number | null): string {
  if (input === null && output === null) return '—';
  return `${input ?? 0} / ${output ?? 0}`;
}

export const TERMINAL_STATUSES: ReadonlySet<ExecutionStatus> = new Set([
  'done',
  'failed',
  'timeout',
  'cancelled',
]);

// ---- product showcase shared pieces (spec product-showcase-dashboard) ----

export type CommercialCapabilityKey =
  | 'visualBuilder'
  | 'growthLoop'
  | 'modelRouting'
  | 'enterprise'
  | 'governance'
  | 'adapters';

export interface CommercialCapability {
  key: CommercialCapabilityKey;
  /** false = runs in this community repo; true = commercial preview card. */
  commercial: boolean;
}

/** Static catalog — display copy lives in i18n as product.cap.<key>. */
export const COMMERCIAL_PREVIEW: readonly CommercialCapability[] = [
  { key: 'governance', commercial: false },
  { key: 'adapters', commercial: false },
  { key: 'visualBuilder', commercial: true },
  { key: 'growthLoop', commercial: true },
  { key: 'modelRouting', commercial: true },
  { key: 'enterprise', commercial: true },
];

export const CAPABILITIES_URL = 'https://nexusclaw.cn/zh/capabilities';

export function CommercialPreviewCard({
  capability,
  t,
}: {
  capability: CommercialCapability;
  t: Translator;
}) {
  return (
    <div className={`preview-card ${capability.commercial ? 'is-commercial' : 'is-community'}`}>
      <div className="preview-head">
        <span className={`chip ${capability.commercial ? 'warn' : 'ok'}`}>
          {capability.commercial ? t('product.badge') : t('product.community')}
        </span>
      </div>
      <p className="preview-copy">{t(`product.cap.${capability.key}` as Parameters<Translator>[0])}</p>
      {capability.commercial && (
        <a className="preview-link" href={CAPABILITIES_URL} target="_blank" rel="noreferrer">
          {t('product.link')} ↗
        </a>
      )}
    </div>
  );
}

export function EmptyState({ t, label }: { t: Translator; label?: string }) {
  return (
    <div className="empty-state">
      <span className="empty-dot" aria-hidden="true" />
      <p>{label ?? t('overview.empty')}</p>
    </div>
  );
}

export function formatPercent(value: number | null): string {
  if (value === null || value === undefined) return '—';
  return `${Math.round(value * 100)}%`;
}
