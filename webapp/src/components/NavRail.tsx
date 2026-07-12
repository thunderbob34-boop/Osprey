import { Link, useNavigate } from '@tanstack/react-router';
import { signOut } from '../lib/auth';

const links = [
  { to: '/calendar', label: 'Calendar' },
  { to: '/log', label: 'Log' },
  { to: '/history', label: 'History' },
  { to: '/settings', label: 'Settings' },
] as const;

export function NavRail() {
  const navigate = useNavigate();
  return (
    <nav style={{ width: 200, borderRight: 'var(--border-w) solid var(--line)', padding: '24px 0', display: 'flex', flexDirection: 'column' }}>
      <div style={{ fontWeight: 700, fontSize: 18, textTransform: 'uppercase', padding: '0 20px 24px' }}>Osprey</div>
      {links.map((l) => (
        <Link key={l.to} to={l.to} style={{ padding: '12px 20px', fontSize: 13, textTransform: 'uppercase', letterSpacing: 1.5, color: 'var(--mut)' }}
          activeProps={{ style: { color: '#000', background: 'var(--amber)', fontWeight: 700 } }}>
          {l.label}
        </Link>
      ))}
      <button onClick={() => { void signOut().then(() => navigate({ to: '/login' })); }}
        style={{ margin: 'auto 20px 0', background: 'transparent', border: 'var(--border-w) solid var(--line)', padding: '10px 0', textTransform: 'uppercase', fontSize: 12, cursor: 'pointer' }}>
        Sign out
      </button>
    </nav>
  );
}
