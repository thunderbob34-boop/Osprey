import { useEffect } from 'react';
import { createFileRoute, Outlet, redirect, useNavigate } from '@tanstack/react-router';
import { useQueryClient } from '@tanstack/react-query';
import { getSession } from '../lib/auth';
import { supabase } from '../lib/supabase';
import { NavRail } from '../components/NavRail';

function AuthedShell() {
  const navigate = useNavigate();
  const qc = useQueryClient();

  // Catches both an explicit sign-out and a session that silently expires
  // (e.g. a revoked or unrefreshable token) — without this, queries just kept
  // failing with raw 401s forever instead of sending the user back to /login.
  useEffect(() => {
    const { data: sub } = supabase.auth.onAuthStateChange((event) => {
      if (event === 'SIGNED_OUT') {
        qc.clear();
        void navigate({ to: '/login' });
      }
    });
    return () => sub.subscription.unsubscribe();
  }, [navigate, qc]);

  return (
    <div className="app-shell">
      <NavRail />
      <main className="page">
        <Outlet />
      </main>
    </div>
  );
}

export const Route = createFileRoute('/_authed')({
  beforeLoad: async () => {
    const session = await getSession();
    if (!session) throw redirect({ to: '/login' });
    return { userId: session.user.id };
  },
  component: AuthedShell,
});
