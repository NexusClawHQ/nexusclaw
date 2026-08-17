import { useState } from 'react';

import { decideApproval, type PendingApproval } from '../api';
import type { Translator } from '../i18n';
import { JsonBlock, RiskBadge, formatWhen } from '../components/ui';

function ApprovalCard({
  t,
  token,
  lang,
  approval,
  onDecided,
}: {
  t: Translator;
  token: string;
  lang: string;
  approval: PendingApproval;
  onDecided: (message: string) => void;
}) {
  const [comment, setComment] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(false);

  const decide = async (decision: 'APPROVED' | 'REJECTED') => {
    setBusy(true);
    setError(false);
    try {
      const result = await decideApproval(
        token,
        approval.id,
        decision,
        comment.trim() || null,
      );
      onDecided(t('appr.decided', { status: result.executionStatus }));
    } catch {
      setError(true);
    } finally {
      setBusy(false);
    }
  };

  return (
    <article className="approval-card">
      <header>
        <code className="tool-name">{approval.toolName}</code>
        <RiskBadge riskLevel={approval.riskLevel} />
      </header>
      {approval.description && <p>{approval.description}</p>}
      <dl className="approval-meta">
        <div>
          <dt>{t('appr.execution')}</dt>
          <dd>
            <code>{approval.executionId.slice(0, 8)}</code>
          </dd>
        </div>
        <div>
          <dt>{t('appr.submitted')}</dt>
          <dd>{formatWhen(approval.submittedAt, lang)}</dd>
        </div>
      </dl>
      <div className="approval-io">
        <span className="field-label">{t('appr.toolInput')}</span>
        <JsonBlock value={approval.toolInput} />
      </div>
      <input
        className="comment-input"
        placeholder={t('appr.commentPlaceholder')}
        value={comment}
        onChange={(e) => setComment(e.target.value)}
      />
      <div className="approval-actions">
        <button className="approve" disabled={busy} onClick={() => void decide('APPROVED')}>
          {t('appr.approve')}
        </button>
        <button className="reject" disabled={busy} onClick={() => void decide('REJECTED')}>
          {t('appr.reject')}
        </button>
      </div>
      {error && <p className="form-error" role="alert">{t('appr.error')}</p>}
    </article>
  );
}

export function ApprovalsView({
  t,
  token,
  approvals,
  loading,
  onDecided,
  lang,
}: {
  t: Translator;
  token: string;
  approvals: PendingApproval[];
  loading: boolean;
  onDecided: () => void;
  lang: string;
}) {
  const [banner, setBanner] = useState<string | null>(null);

  return (
    <section className="panel">
      <h2>{t('appr.title')}</h2>
      {banner && (
        <p className="form-ok" role="status">
          {banner}
        </p>
      )}
      {loading && approvals.length === 0 && <p className="muted">{t('common.loading')}</p>}
      {!loading && approvals.length === 0 && <p className="muted">{t('appr.empty')}</p>}
      <div className="approval-grid">
        {approvals.map((approval) => (
          <ApprovalCard
            key={approval.id}
            t={t}
            token={token}
            lang={lang}
            approval={approval}
            onDecided={(message) => {
              setBanner(message);
              onDecided();
            }}
          />
        ))}
      </div>
    </section>
  );
}
