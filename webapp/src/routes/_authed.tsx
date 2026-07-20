import { createFileRoute, Outlet, redirect } from '@tanstack/react-router';
import { getSession } from '../lib/auth';
import { NavRail } from '../components/NavRail';
import { usePlanSync } from '../features/home/queries';

function AuthedShell() {
  const { userId } = Route.useRouteContext();
  // Fired once per mount here (not per-page) so the plan-generation self-heal
  // that mobile's home screen already does on every load also runs on the
  // webapp, regardless of which route the user lands on first. See
  // usePlanSync's doc comment for why this exists.
  usePlanSync(userId);

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
