import { useState } from 'react';

import type { Translator } from '../i18n';
import { CAPABILITIES_URL, EmptyState } from '../components/ui';
import { Icon, type IconName } from '../components/icons';

type Section =
  | 'overview'
  | 'employees'
  | 'run'
  | 'approvals'
  | 'audit'
  | 'growth'
  | 'policy';

/** A module in the product console: community ones route to the live
 *  section, commercial ones open the commercial-edition dialog (AC-4.3). */
interface ProductModule {
  key: string;
  icon: IconName;
  tone: 'brand' | 'ok' | 'warn' | 'info' | 'bad';
  commercial: boolean;
  section?: Section;
}

const MODULES: readonly ProductModule[] = [
  { key: 'overview', icon: 'overview', tone: 'brand', commercial: false, section: 'overview' },
  { key: 'employees', icon: 'employees', tone: 'brand', commercial: false, section: 'employees' },
  { key: 'growth', icon: 'growth', tone: 'ok', commercial: false, section: 'growth' },
  { key: 'approvals', icon: 'approvals', tone: 'warn', commercial: false, section: 'approvals' },
  { key: 'audit', icon: 'audit', tone: 'info', commercial: false, section: 'audit' },
  { key: 'policy', icon: 'policy', tone: 'bad', commercial: false, section: 'policy' },
  { key: 'visualBuilder', icon: 'builder', tone: 'brand', commercial: true },
  { key: 'growthLoop', icon: 'loop', tone: 'ok', commercial: true },
  { key: 'modelRouting', icon: 'routing', tone: 'info', commercial: true },
  { key: 'crm', icon: 'crm', tone: 'warn', commercial: true },
  { key: 'sales', icon: 'sales', tone: 'warn', commercial: true },
  { key: 'analytics', icon: 'analytics', tone: 'info', commercial: true },
  { key: 'integrations', icon: 'integrations', tone: 'brand', commercial: true },
  { key: 'enterprise', icon: 'enterprise', tone: 'bad', commercial: true },
];

/** Full product console (spec product-showcase-dashboard, AC-4.2/4.3):
 *  the complete platform surface, fully open in this repo. Community
 *  modules jump to their live sections; commercial modules explain
 *  themselves in a dialog on click — no fake interactions. */
export function ProductView({
  t,
  onGo,
}: {
  t: Translator;
  onGo: (section: Section) => void;
}) {
  const [dialog, setDialog] = useState<ProductModule | null>(null);

  return (
    <section className="view">
      <h2>{t('product.console.title')}</h2>
      <p className="muted">{t('product.console.subtitle')}</p>
      <div className="module-grid">
        {MODULES.map((module) => (
          <button
            key={module.key}
            className={`module-card ${module.commercial ? 'is-commercial' : ''}`}
            onClick={() =>
              module.commercial ? setDialog(module) : onGo(module.section!)
            }
          >
            <span className={`module-icon tone-${module.tone}`}>
              <Icon name={module.icon} />
            </span>
            <span className="module-name">{t(`product.module.${module.key}` as Parameters<Translator>[0])}</span>
            <p className="module-desc">{t(`product.cap.${module.key}` as Parameters<Translator>[0])}</p>
            <span className="module-foot">
              <span className={`chip ${module.commercial ? 'warn' : 'ok'}`}>
                {module.commercial ? t('product.badge') : t('product.community')}
              </span>
            </span>
          </button>
        ))}
      </div>

      {dialog && (
        <div
          className="modal-overlay"
          role="dialog"
          aria-modal="true"
          aria-label={t('product.modal.title')}
          onClick={(event) => {
            if (event.target === event.currentTarget) setDialog(null);
          }}
        >
          <div className="modal">
            <span className={`module-icon tone-${dialog.tone}`}>
              <Icon name={dialog.icon} />
            </span>
            <p className="muted" style={{ margin: 0, fontSize: 12, letterSpacing: '0.06em', textTransform: 'uppercase' }}>
              {t('product.modal.title')}
            </p>
            <h3>{t(`product.module.${dialog.key}` as Parameters<Translator>[0])}</h3>
            <p>{t(`product.cap.${dialog.key}` as Parameters<Translator>[0])}</p>
            <p className="muted">{t('product.modal.body')}</p>
            <div className="modal-actions">
              <button className="ghost" onClick={() => setDialog(null)}>
                {t('product.modal.close')}
              </button>
              <a
                className="primary"
                href={CAPABILITIES_URL}
                target="_blank"
                rel="noreferrer"
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  padding: '8px 16px',
                  borderRadius: 6,
                  textDecoration: 'none',
                }}
              >
                {t('product.modal.cta')} ↗
              </a>
            </div>
          </div>
        </div>
      )}
    </section>
  );
}

export function ProductEmptyFallback({ t }: { t: Translator }) {
  return <EmptyState t={t} />;
}
