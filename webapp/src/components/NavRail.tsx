import { Link } from '@tanstack/react-router';
import { signOut } from '../lib/auth';
import { useUserProfile } from '../lib/useAuthUser';

const links = [
  { to: '/', label: 'Dashboard' },
  { to: '/calendar', label: 'Calendar' },
  { to: '/log', label: 'Log' },
  { to: '/history', label: 'History' },
  { to: '/nutrition', label: 'Nutrition' },
  // Ask Ozzie (chat) hidden until OpenAI billing is turned on — the /chat route
  // also redirects to '/' (see chat.tsx). Re-enable: restore this link + drop
  // the beforeLoad redirect. The page, data layer, and edge fn are all intact.
  // { to: '/chat', label: 'Ask Ozzie' },
  { to: '/settings', label: 'Settings' },
] as const;

export function NavRail() {
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
        {/* Cache clear + redirect to /login happen in _authed.tsx's onAuthStateChange
            listener, the single place that reacts to a session ending — whether
            from this button or from a token refresh failure elsewhere. */}
        <button className="rail-signout" onClick={() => void signOut()}>
          Sign out
        </button>
      </div>
    </nav>
  );
}
