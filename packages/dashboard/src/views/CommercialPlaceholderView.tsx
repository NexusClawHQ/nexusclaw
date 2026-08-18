import type { Translator } from '../i18n';
import { Icon, type IconName } from '../components/icons';

const CAPABILITIES_URL = 'https://nexusclaw.cn/zh/capabilities';

export interface CommercialModule {
  key: string;
  icon: IconName;
  tone: 'brand' | 'ok' | 'warn' | 'info' | 'bad';
}

/** The commercial modules of the full platform. Their nav entries stay
 *  visible (the navigation mirrors the product); opening one lands on this
 *  restrained placeholder — a fact, not a sales pitch. */
export const COMMERCIAL_MODULES: readonly CommercialModule[] = [
  { key: 'visualBuilder', icon: 'builder', tone: 'brand' },
  { key: 'growthLoop', icon: 'loop', tone: 'ok' },
  { key: 'modelRouting', icon: 'routing', tone: 'info' },
  { key: 'crm', icon: 'crm', tone: 'warn' },
  { key: 'sales', icon: 'sales', tone: 'warn' },
  { key: 'analytics', icon: 'analytics', tone: 'info' },
  { key: 'integrations', icon: 'integrations', tone: 'brand' },
  { key: 'enterprise', icon: 'enterprise', tone: 'bad' },
];

export function CommercialPlaceholderView({
  t,
  moduleKey,
}: {
  t: Translator;
  moduleKey: string;
}) {
  const module = COMMERCIAL_MODULES.find((m) => m.key === moduleKey);

  return (
    <section className="view">
      <div className="panel placeholder-panel">
        <div className="placeholder-head">
          {module && (
            <span className={`module-icon tone-${module.tone}`}>
              <Icon name={module.icon} />
            </span>
          )}
          <h2>
            {module
              ? t(`product.module.${module.key}` as Parameters<Translator>[0])
              : t('product.placeholder.unknown')}
          </h2>
        </div>
        <p className="verdict-bar policy">🔒 {t('product.placeholder.title')}</p>
        <p className="muted">{t('product.placeholder.body')}</p>
        <p className="muted" style={{ fontSize: 12 }}>
          {t('product.placeholder.note')}{' '}
          <a href={CAPABILITIES_URL} target="_blank" rel="noreferrer">
            nexusclaw.cn ↗
          </a>
        </p>
      </div>
    </section>
  );
}
