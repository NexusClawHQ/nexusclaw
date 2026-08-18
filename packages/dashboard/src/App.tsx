import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type FormEvent,
  type ReactNode,
} from 'react';

import {
  fetchAgents,
  fetchExecutions,
  fetchModelSource,
  fetchPendingApprovals,
  signIn,
  type AgentSummary,
  type ExecutionSummary,
  type ModelSource,
  type PendingApproval,
} from './api';
import { createTranslator, detectLang, type Lang, type Translator } from './i18n';
import { ApprovalsView } from './views/ApprovalsView';
import { ExecutionsView } from './views/ExecutionsView';
import { RunView } from './views/RunView';
import { OverviewView } from './views/OverviewView';
import { EmployeesView } from './views/EmployeesView';
import { EmployeeDetailView } from './views/EmployeeDetailView';
import { GrowthView } from './views/GrowthView';
import { PolicyView } from './views/PolicyView';
import { ProductView } from './views/ProductView';
import { Icon, type IconName } from './components/icons';

const TOKEN_KEY = 'nexusclaw.dashboard.token';
const LANG_KEY = 'nexusclaw.dashboard.lang';
const POLL_INTERVAL_MS = 3000;

type Section =
  | 'overview'
  | 'employees'
  | 'run'
  | 'approvals'
  | 'audit'
  | 'growth'
  | 'policy'
  | 'product';

interface CommunityFeed {
  agents: AgentSummary[];
  executions: ExecutionSummary[];
  approvals: PendingApproval[];
  loading: boolean;
  error: string | null;
}

function useCommunityFeed(token: string | null, refreshTick: number): CommunityFeed {
  const [feed, setFeed] = useState<CommunityFeed>({
    agents: [],
    executions: [],
    approvals: [],
    loading: true,
    error: null,
  });
  const inFlight = useRef(false);

  useEffect(() => {
    if (!token) return;
    let cancelled = false;

    const load = async () => {
      if (inFlight.current) return;
      inFlight.current = true;
      try {
        const [agents, executions, approvals] = await Promise.all([
          fetchAgents(token),
          fetchExecutions(token),
          fetchPendingApprovals(token),
        ]);
        if (cancelled) return;
        setFeed({ agents, executions, approvals, loading: false, error: null });
      } catch (error) {
        if (cancelled) return;
        const message = error instanceof Error ? error.message : 'request failed';
        setFeed((current) => ({ ...current, loading: false, error: message }));
      } finally {
        inFlight.current = false;
      }
    };

    void load();
    const timer = window.setInterval(load, POLL_INTERVAL_MS);
    return () => {
      cancelled = true;
      window.clearInterval(timer);
    };
  }, [token, refreshTick]);

  return feed;
}

/** Hand-rolled hash routing (spec AC-9.1: no router dependency).
 *  Shapes: #/section and #/employees/<id>. */
function parseHash(hash: string): { section: Section; employeeId: string | null } {
  const path = hash.replace(/^#\/?/, '').split('?')[0];
  const segments = path.split('/').filter(Boolean);
  const known: Section[] = [
    'overview',
    'employees',
    'run',
    'approvals',
    'audit',
    'growth',
    'policy',
    'product',
  ];
  if (segments[0] === 'employees' && segments[1]) {
    return { section: 'employees', employeeId: segments[1] };
  }
  const section = known.find((value) => value === segments[0]);
  return { section: section ?? 'overview', employeeId: null };
}

function LoginView({
  t,
  onSignedIn,
}: {
  t: Translator;
  onSignedIn: (token: string) => void;
}) {
  const [username, setUsername] = useState('demo');
  const [password, setPassword] = useState('');
  const [error, setError] = useState(false);
  const [busy, setBusy] = useState(false);

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    setBusy(true);
    setError(false);
    try {
      const session = await signIn(username.trim(), password);
      onSignedIn(session.token);
    } catch {
      setError(true);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="login-wrap">
      <form className="login-card" onSubmit={submit}>
        <h1>{t('app.title')}</h1>
        <p className="muted">{t('login.subtitle')}</p>
        <label>
          <span>{t('login.username')}</span>
          <input
            value={username}
            autoComplete="username"
            onChange={(e) => setUsername(e.target.value)}
          />
        </label>
        <label>
          <span>{t('login.password')}</span>
          <input
            type="password"
            value={password}
            autoComplete="current-password"
            onChange={(e) => setPassword(e.target.value)}
          />
        </label>
        {error && <p className="form-error" role="alert">{t('login.error')}</p>}
        <button type="submit" disabled={busy || !username || !password}>
          {t('login.submit')}
        </button>
        <p className="login-hint muted">{t('login.hint')}</p>
      </form>
    </div>
  );
}

export function App() {
  const [lang, setLang] = useState<Lang>(() => {
    const stored = window.localStorage.getItem(LANG_KEY);
    return stored === 'zh' || stored === 'en' ? stored : detectLang();
  });
  const [token, setToken] = useState<string | null>(
    () => window.sessionStorage.getItem(TOKEN_KEY),
  );
  const [route, setRoute] = useState(() => parseHash(window.location.hash));
  const [refreshTick, setRefreshTick] = useState(0);
  const [focusExecutionId, setFocusExecutionId] = useState<string | null>(null);
  const [modelSource, setModelSource] = useState<ModelSource | null>(null);
  const [growthAgentId, setGrowthAgentId] = useState<string | null>(null);

  const t = useMemo(() => createTranslator(lang), [lang]);
  const feed = useCommunityFeed(token, refreshTick);

  useEffect(() => {
    const onHashChange = () => setRoute(parseHash(window.location.hash));
    window.addEventListener('hashchange', onHashChange);
    return () => window.removeEventListener('hashchange', onHashChange);
  }, []);

  useEffect(() => {
    if (!token) {
      window.sessionStorage.removeItem(TOKEN_KEY);
      return;
    }
    window.sessionStorage.setItem(TOKEN_KEY, token);
    fetchModelSource(token)
      .then(setModelSource)
      .catch(() => setModelSource(null));
  }, [token]);

  useEffect(() => {
    if (feed.error && feed.error.includes('unauthorized')) {
      setToken(null);
    }
  }, [feed.error]);

  const toggleLang = useCallback(() => {
    setLang((current) => {
      const next: Lang = current === 'en' ? 'zh' : 'en';
      window.localStorage.setItem(LANG_KEY, next);
      return next;
    });
  }, []);

  const refresh = useCallback(() => setRefreshTick((n) => n + 1), []);

  const handleSignedIn = useCallback((value: string) => setToken(value), []);

  const handleExecuted = useCallback((executionId: string) => {
    setFocusExecutionId(executionId);
    window.location.hash = '#/audit';
    setRoute({ section: 'audit', employeeId: null });
    setRefreshTick((n) => n + 1);
  }, []);

  const go = useCallback((section: Section) => {
    window.location.hash = `#/${section}`;
    setRoute({ section, employeeId: null });
  }, []);

  const openEmployee = useCallback((id: string) => {
    window.location.hash = `#/employees/${id}`;
    setRoute({ section: 'employees', employeeId: id });
  }, []);

  const openGrowthFor = useCallback((agentId: string) => {
    window.location.hash = '#/growth';
    setRoute({ section: 'growth', employeeId: null });
    setGrowthAgentId(agentId);
  }, []);

  const effectiveGrowthAgent = growthAgentId ?? feed.agents[0]?.id ?? null;

  if (!token) return <LoginView t={t} onSignedIn={handleSignedIn} />;

  const pendingCount = feed.approvals.length;
  const feedBroken =
    feed.error !== null && !feed.loading && !feed.error.includes('unauthorized');

  const nav: Array<{ group: string; items: Array<{ id: Section; label: string; icon: IconName }> }> = [
    {
      group: t('nav.group.workbench'),
      items: [{ id: 'overview', label: t('nav.overview'), icon: 'overview' }],
    },
    {
      group: t('nav.group.governance'),
      items: [
        { id: 'employees', label: t('nav.employees'), icon: 'employees' },
        { id: 'growth', label: t('nav.growth'), icon: 'growth' },
        { id: 'approvals', label: t('nav.approvals'), icon: 'approvals' },
        { id: 'audit', label: t('nav.audit'), icon: 'audit' },
        { id: 'run', label: t('nav.run'), icon: 'run' },
      ],
    },
    {
      group: t('nav.group.platform'),
      items: [
        { id: 'policy', label: t('nav.policy'), icon: 'policy' },
        { id: 'product', label: t('nav.product'), icon: 'product' },
      ],
    },
  ];

  let active: ReactNode;
  if (route.section === 'employees' && route.employeeId) {
    active = (
      <EmployeeDetailView
        t={t}
        token={token}
        agentId={route.employeeId}
        onBack={() => go('employees')}
        onOpenGrowth={openGrowthFor}
        onGoRun={() => go('run')}
      />
    );
  } else if (route.section === 'run') {
    active = (
      <RunView
        t={t}
        token={token}
        agents={feed.agents}
        loading={feed.loading}
        onExecuted={handleExecuted}
      />
    );
  } else if (route.section === 'approvals') {
    active = (
      <ApprovalsView
        t={t}
        token={token}
        approvals={feed.approvals}
        loading={feed.loading}
        onDecided={refresh}
        lang={lang}
      />
    );
  } else if (route.section === 'audit') {
    active = (
      <ExecutionsView
        t={t}
        token={token}
        executions={feed.executions}
        loading={feed.loading}
        focusExecutionId={focusExecutionId}
        onFocusHandled={() => setFocusExecutionId(null)}
        lang={lang}
      />
    );
  } else if (route.section === 'growth') {
    active = (
      <GrowthView
        t={t}
        token={token}
        agents={feed.agents}
        selectedAgentId={effectiveGrowthAgent}
        onSelectAgent={setGrowthAgentId}
        onOpenExecution={(id) => {
          setFocusExecutionId(id);
          go('audit');
        }}
      />
    );
  } else if (route.section === 'policy') {
    active = <PolicyView t={t} token={token} agents={feed.agents} />;
  } else if (route.section === 'product') {
    active = <ProductView t={t} onGo={go} />;
  } else if (route.section === 'employees') {
    active = (
      <EmployeesView
        t={t}
        agents={feed.agents}
        loading={feed.loading}
        onOpen={openEmployee}
      />
    );
  } else {
    active = (
      <OverviewView
        t={t}
        agents={feed.agents}
        executions={feed.executions}
        approvals={feed.approvals}
        onGo={go}
      />
    );
  }

  return (
    <div className="app-shell showcase">
      <header className="app-header">
        <div>
          <h1>{t('app.title')}</h1>
          <p className="muted">{t('app.subtitle')}</p>
        </div>
        <div className="header-actions">
          {modelSource && (
            <span
              className={`chip model ${modelSource.kind === 'byo_env' ? 'info' : 'muted'}`}
              title={modelSource.modelId}
            >
              {modelSource.kind === 'byo_env'
                ? `${t('model.byo')} · ${modelSource.modelId}`
                : t('model.smoke')}
            </span>
          )}
          <span className={`live-dot ${feed.loading ? 'pulse' : ''}`} title={t('app.autoRefresh')} />
          <button className="ghost" onClick={toggleLang}>
            {lang === 'en' ? '中文' : 'English'}
          </button>
          <button className="ghost" onClick={() => setToken(null)}>
            {t('app.signout')}
          </button>
        </div>
      </header>
      {feedBroken && (
        <div className="feed-error" role="alert">
          <span>{t('common.error')}</span>
          <button className="ghost" onClick={refresh}>
            {t('common.retry')}
          </button>
        </div>
      )}
      <div className="showcase-body">
        <nav className="side-nav" aria-label="sections">
          {nav.map((group) => (
            <div className="nav-group" key={group.group}>
              <div className="nav-group-title">{group.group}</div>
              {group.items.map((entry) => (
                <button
                  key={entry.id}
                  className={route.section === entry.id ? 'nav-item active' : 'nav-item'}
                  onClick={() => go(entry.id)}
                >
                  <Icon name={entry.icon} />
                  {entry.label}
                  {entry.id === 'approvals' && pendingCount > 0 && (
                    <span className="badge-count">{pendingCount}</span>
                  )}
                </button>
              ))}
            </div>
          ))}
          <div className="nav-sep" />
          <a className="nav-item nav-link" href="/console">
            <Icon name="console" />
            {t('nav.console')} ↗
          </a>
        </nav>
        <main className="app-main">{active}</main>
      </div>
    </div>
  );
}
