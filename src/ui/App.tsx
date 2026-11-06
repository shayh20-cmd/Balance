import type { Session } from '@supabase/supabase-js';
import { useCallback, useEffect, useState } from 'react';
import { HashRouter } from 'react-router-dom';
import { getMyHousehold, type Household } from '../data/repo';
import { launchSearch, supabase } from '../data/supabase';
import { linkFailureNotice } from './auth/linkNotice';
import SignIn from './auth/SignIn';
import { HouseholdContext } from './household';
import AcceptInvite from './onboarding/AcceptInvite';
import Onboarding from './onboarding/Onboarding';
import AppRoutes from './routes';
import { ToastProvider } from './toast';
import './styles.css';

const PENDING_INVITE = 'balance.pendingInvite';

/** An invite link (#/invite/<token>) is remembered across the magic-link sign-in round trip. */
function takeInviteFromUrl(): void {
  const match = location.hash.match(/^#\/invite\/([0-9a-f-]{36})/i);
  if (!match) return;
  try {
    localStorage.setItem(PENDING_INVITE, match[1]);
  } catch {
    /* storage unavailable: the invite link must be opened again after sign-in */
  }
  location.hash = '#/';
}

function pendingInvite(): string | null {
  try {
    return localStorage.getItem(PENDING_INVITE);
  } catch {
    return null;
  }
}

function clearPendingInvite(): void {
  try {
    localStorage.removeItem(PENDING_INVITE);
  } catch {
    /* ignore */
  }
}

type State =
  | { kind: 'loading' }
  | { kind: 'signed-out'; notice: string | null }
  | { kind: 'no-household'; invite: string | null }
  | { kind: 'ready'; household: Household; userId: string };

export default function App() {
  const [session, setSession] = useState<Session | null | undefined>(undefined);
  const [state, setState] = useState<State>({ kind: 'loading' });
  const [notice, setNotice] = useState<string | null>(null);

  useEffect(() => {
    takeInviteFromUrl();
    // supabase-js exchanges a ?code= link before getSession resolves; read the URL only after that
    supabase.auth.getSession().then(({ data }) => {
      setNotice(linkFailureNotice(launchSearch, !!data.session));
      if (location.search) history.replaceState(null, '', location.pathname + location.hash);
      setSession(data.session);
    });
    const { data } = supabase.auth.onAuthStateChange((_event, s) => setSession(s));
    return () => data.subscription.unsubscribe();
  }, []);

  const load = useCallback(async () => {
    if (session === undefined) return;
    if (!session) return setState({ kind: 'signed-out', notice });
    try {
      const household = await getMyHousehold();
      if (household) {
        clearPendingInvite();
        setState({ kind: 'ready', household, userId: session.user.id });
      } else {
        setState({ kind: 'no-household', invite: pendingInvite() });
      }
    } catch {
      setState({ kind: 'no-household', invite: pendingInvite() });
    }
  }, [session, notice]);

  useEffect(() => {
    load();
  }, [load]);

  return (
    <ToastProvider>
      <div className="app">
        <header className="app-header">Balance</header>
        {state.kind === 'loading' && <p className="muted">טוען…</p>}
        {state.kind === 'signed-out' && <SignIn notice={state.notice} />}
        {state.kind === 'no-household' &&
          (state.invite ? (
            <AcceptInvite
              token={state.invite}
              onJoined={load}
              onInvalid={clearPendingInvite}
              onDecline={() => {
                clearPendingInvite();
                setState({ kind: 'no-household', invite: null });
              }}
            />
          ) : (
            <Onboarding onCreated={load} />
          ))}
        {state.kind === 'ready' && (
          <HouseholdContext.Provider value={{ household: state.household, userId: state.userId, reload: load }}>
            <HashRouter>
              <AppRoutes />
            </HashRouter>
          </HouseholdContext.Provider>
        )}
      </div>
    </ToastProvider>
  );
}
