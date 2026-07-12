import { createFileRoute, Outlet, redirect } from '@tanstack/react-router';
import { getSession } from '../lib/auth';
import { NavRail } from '../components/NavRail';

export const Route = createFileRoute('/_authed')({
  beforeLoad: async () => {
    const session = await getSession();
    if (!session) throw redirect({ to: '/login' });
    return { userId: session.user.id };
  },
  component: () => (
    <div style={{ display: 'flex', minHeight: '100vh' }}>
      <NavRail />
      <main style={{ flex: 1, padding: 28, minWidth: 0 }}>
        <Outlet />
      </main>
    </div>
  ),
});
