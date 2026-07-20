import { Link, useNavigate } from '@tanstack/react-router';
import { useQueryClient } from '@tanstack/react-query';
import { signOut } from '../lib/auth';
import { useUserProfile } from '../lib/useAuthUser';

const links = [
  { to: '/', label: 'Home', exact: true },
  { to: '/calendar', label: 'Calendar', exact: false },
  { to: '/log', label: 'Log', exact: false },
  { to: '/history', label: 'History', exact: false },
  { to: '/nutrition', label: 'Nutrition', exact: false },
  // Ask Ozzie (chat) hidden until OpenAI billing is turned on — the /chat route
  // also redirects to '/' (see chat.tsx). Re-enable: restore this link + drop
  // the beforeLoad redirect. The page, data layer, and edge fn are all intact.
  // { to: '/chat', label: 'Ask Ozzie', exact: false },
  { to: '/settings', label: 'Settings', exact: false },
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
          <Link
            key={l.to}
            to={l.to}
            className="rail-link"
            activeProps={{ className: 'rail-link active' }}
            activeOptions={{ exact: l.exact }}
          >
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
