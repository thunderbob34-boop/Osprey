import { Link, useNavigate } from '@tanstack/react-router';
import { useQueryClient } from '@tanstack/react-query';
import { signOut } from '../lib/auth';
import { useUserProfile } from '../lib/useAuthUser';

const links = [
  { to: '/calendar', label: 'Calendar' },
  { to: '/log', label: 'Log' },
  { to: '/history', label: 'History' },
  { to: '/nutrition', label: 'Nutrition' },
  { to: '/chat', label: 'Ask Ozzie' },
  { to: '/settings', label: 'Settings' },
] as const;

export function NavRail() {
  const navigate = useNavigate();
  const qc = useQueryClient();
  const { data: profile } = useUserProfile();

  return (
    <nav className="rail">
      <div className="rail-brand">
        <Link to="/" className="rail-logo">Osprey</Link>
      </div>
      <div className="rail-links">
        {links.map((l) => (
          <Link key={l.to} to={l.to} className="rail-link" activeProps={{ className: 'rail-link active' }}>
            {l.label}
          </Link>
        ))}
      </div>
      <div className="rail-foot">
        {profile && (
          <div className="rail-user">
            <b>{profile.display_name}</b>
            {profile.email}
          </div>
        )}
        <button
          className="rail-signout"
          onClick={() => { void signOut().then(() => { qc.clear(); navigate({ to: '/login' }); }); }}
        >
          Sign out
        </button>
      </div>
    </nav>
  );
}
