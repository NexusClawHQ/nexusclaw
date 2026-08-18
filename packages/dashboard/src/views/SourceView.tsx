import { useEffect, useState } from 'react';

import type { Translator } from '../i18n';
import { EmptyState } from '../components/ui';

const REPO_URL = 'https://github.com/NexusClawHQ/nexusclaw-agent-governance';

interface SourceDisclosure {
  license: string;
  licenseUrl: string;
  correspondingSourceUrl: string;
}

const COMPLIANCE_DOCS = [
  { key: 'sbom', href: `${REPO_URL}/blob/main/sbom.cdx.json` },
  { key: 'notices', href: `${REPO_URL}/blob/main/THIRD_PARTY_NOTICES.md` },
  { key: 'policy', href: `${REPO_URL}/blob/main/docs/snapshot-export-policy.md` },
  { key: 'security', href: `${REPO_URL}/blob/main/SECURITY.md` },
] as const;

/** Source transparency — the auditability story as a page. Fetches the
 *  live GET /source disclosure of this very instance and links the
 *  in-tree compliance artifacts (SBOM, license map, snapshot policy). */
export function SourceView({ t }: { t: Translator }) {
  const [disclosure, setDisclosure] = useState<SourceDisclosure | null>(null);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    let cancelled = false;
    fetch('/source')
      .then((response) => (response.ok ? response.json() : null))
      .then((data: SourceDisclosure | null) => {
        if (!cancelled) {
          if (data) setDisclosure(data);
          else setFailed(true);
        }
      })
      .catch(() => {
        if (!cancelled) setFailed(true);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <section className="view">
      <h2>{t('source.title')}</h2>
      <p className="muted">{t('source.subtitle')}</p>

      {failed ? (
        <EmptyState t={t} label={t('source.failed')} />
      ) : !disclosure ? (
        <p className="muted">{t('common.loading')}</p>
      ) : (
        <>
          <div className="split">
            <div className="panel">
              <h3>{t('source.license.title')}</h3>
              <p className="verdict-bar policy">🛡 {disclosure.license}</p>
              <p className="muted" style={{ fontSize: 12.5 }}>
                {t('source.license.body')}{' '}
                <a href={disclosure.licenseUrl} target="_blank" rel="noreferrer">
                  {disclosure.license} ↗
                </a>
              </p>
            </div>
            <div className="panel">
              <h3>{t('source.url.title')}</h3>
              <div className="cmd mono">{disclosure.correspondingSourceUrl}</div>
              <p className="muted" style={{ fontSize: 12.5 }}>
                {t('source.url.body')}
              </p>
            </div>
          </div>

          <div className="panel">
            <h3>{t('source.artifacts.title')}</h3>
            <div className="module-grid">
              {COMPLIANCE_DOCS.map((doc) => (
                <a className="module-card" key={doc.key} href={doc.href} target="_blank" rel="noreferrer">
                  <span className="module-name">{t(`source.artifacts.${doc.key}`)}</span>
                  <p className="module-desc">{t(`source.artifacts.${doc.key}Desc`)}</p>
                </a>
              ))}
            </div>
            <p className="muted" style={{ marginTop: 8, fontSize: 12 }}>
              {t('source.artifacts.note')}
            </p>
          </div>
        </>
      )}
    </section>
  );
}
