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
  fetchPendingApprovals,
  signIn,
  type AgentSummary,
  type ExecutionSummary,
  type PendingApproval,
} from './api';
import { createTranslator, detectLang, type Lang, type Translator } from './i18n';
import { ApprovalsView } from './views/ApprovalsView';
import { ExecutionsView } from './views/ExecutionsView';
import { RunView } from './views/RunView';

const TOKEN_KEY = 'nexusclaw.dashboard.token';
const LANG_KEY = 'nexusclaw.dashboard.lang';
const POLL_INTERVAL_MS = 3000;

type Tab = 'run' | 'executions' | 'approvals';

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
  const [tab, setTab] = useState<Tab>('executions');
  const [refreshTick, setRefreshTick] = useState(0);
  const [focusExecutionId, setFocusExecutionId] = useState<string | null>(null);

  const t = useMemo(() => createTranslator(lang), [lang]);
  const feed = useCommunityFeed(token, refreshTick);

  useEffect(() => {
    if (!token) {
      window.sessionStorage.removeItem(TOKEN_KEY);
      return;
    }
    window.sessionStorage.setItem(TOKEN_KEY, token);
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
    setTab('executions');
    setRefreshTick((n) => n + 1);
  }, []);

  if (!token) return <LoginView t={t} onSignedIn={handleSignedIn} />;

  const pendingCount = feed.approvals.length;
  const tabs: Array<{ id: Tab; label: string }> = [
    { id: 'run', label: t('tab.run') },
    { id: 'executions', label: t('tab.executions') },
    { id: 'approvals', label: t('tab.approvals') },
  ];

  let active: ReactNode;
  if (tab === 'run') {
    active = (
      <RunView
        t={t}
        token={token}
        agents={feed.agents}
        loading={feed.loading}
        onExecuted={handleExecuted}
      />
    );
  } else if (tab === 'approvals') {
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
  } else {
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
  }

  return (
    <div className="app-shell">
      <header className="app-header">
        <div>
          <h1>{t('app.title')}</h1>
          <p className="muted">{t('app.subtitle')}</p>
        </div>
        <div className="header-actions">
          <span className={`live-dot ${feed.loading ? 'pulse' : ''}`} title={t('app.autoRefresh')} />
          <button className="ghost" onClick={toggleLang}>
            {lang === 'en' ? '中文' : 'English'}
          </button>
          <button className="ghost" onClick={() => setToken(null)}>
            {t('app.signout')}
          </button>
        </div>
      </header>
      <nav className="tabs">
        {tabs.map((entry) => (
          <button
            key={entry.id}
            className={tab === entry.id ? 'tab active' : 'tab'}
            onClick={() => setTab(entry.id)}
          >
            {entry.label}
            {entry.id === 'approvals' && pendingCount > 0 && (
              <span className="badge-count">{pendingCount}</span>
            )}
          </button>
        ))}
      </nav>
      <main className="app-main">{active}</main>
    </div>
  );
}
