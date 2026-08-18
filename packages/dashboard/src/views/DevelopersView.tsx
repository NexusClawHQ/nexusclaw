import type { Translator } from '../i18n';

const REPO_URL = 'https://github.com/NexusClawHQ/nexusclaw-agent-governance';

const ADAPTERS = [
  {
    key: 'python',
    title: 'Python',
    desc: 'zero-dependency client',
    href: `${REPO_URL}/tree/main/governance/adapters/python`,
  },
  {
    key: 'n8n',
    title: 'n8n',
    desc: 'Gate / Approve / Pending nodes',
    href: `${REPO_URL}/tree/main/governance/adapters/n8n`,
  },
  {
    key: 'dify',
    title: 'Dify',
    desc: 'importable OpenAPI schema',
    href: `${REPO_URL}/tree/main/governance/adapters/dify`,
  },
] as const;

/** The kernel's adoption path, as a page: install the library, gate a tool
 *  in three lines, or take a ready-made adapter. Static content — the same
 *  commands documented in examples/governance-closed-loop.md. */
export function DevelopersView({ t }: { t: Translator }) {
  return (
    <section className="view">
      <h2>{t('dev.title')}</h2>
      <p className="muted">{t('dev.subtitle')}</p>

      <div className="panel">
        <h3>{t('dev.install.title')}</h3>
        <div className="cmd mono">npm install @agent-governance/contracts</div>
        <div className="cmd mono">pip install nexusclaw-agent-governance</div>
      </div>

      <div className="panel">
        <h3>{t('dev.gate.title')}</h3>
        <p className="muted">{t('dev.gate.body')}</p>
        <pre className="json">{`POST /gate
{ "toolName": "demo.send_followup_email", "toolInput": { "customerId": "C-1001" } }
→ { "decision": "paused", "approvalId": "…", "riskLevel": "L3" }   # deny by default`}</pre>
        <pre className="json">{`from agent_governance import GovernanceClient

gov = GovernanceClient("http://127.0.0.1:7899")
update_customer = gov.wrap_tool(update_customer)   # gated + audited`}</pre>
        <p className="muted" style={{ fontSize: 12 }}>
          {t('dev.gate.note')}{' '}
          <a
            href={`${REPO_URL}/blob/main/examples/governance-closed-loop.md`}
            target="_blank"
            rel="noreferrer"
          >
            {t('dev.gate.example')} ↗
          </a>
        </p>
      </div>

      <div className="panel">
        <h3>{t('dev.adapters.title')}</h3>
        <div className="module-grid">
          {ADAPTERS.map((adapter) => (
            <a
              className="module-card"
              key={adapter.key}
              href={adapter.href}
              target="_blank"
              rel="noreferrer"
            >
              <span className="module-name">{adapter.title}</span>
              <p className="module-desc">{adapter.desc}</p>
            </a>
          ))}
        </div>
      </div>
    </section>
  );
}
