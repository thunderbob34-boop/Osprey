import { useState } from 'react';
import { createFileRoute, redirect, useNavigate } from '@tanstack/react-router';
import { signInWithPassword, signInWithApple, getSession } from '../lib/auth';

export const Route = createFileRoute('/login')({
  beforeLoad: async () => {
    const session = await getSession();
    if (session) throw redirect({ to: '/calendar' });
  },
  component: LoginPage,
});

function LoginPage() {
  const navigate = useNavigate();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    const err = await signInWithPassword(email, password);
    setBusy(false);
    if (err) setError(err);
    else navigate({ to: '/calendar' });
  }

  return (
    <main className="login-wrap">
      <form onSubmit={submit} className="card login-card">
        <h1>Osprey</h1>
        <div className="field">
          <label htmlFor="login-email">Email</label>
          <input id="login-email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} required />
        </div>
        <div className="field">
          <label htmlFor="login-password">Password</label>
          <input id="login-password" type="password" value={password} onChange={(e) => setPassword(e.target.value)} required />
        </div>
        {error && <p role="alert" className="login-error">{error}</p>}
        <button type="submit" className="btn login-submit" disabled={busy}>
          {busy ? 'Signing in…' : 'Sign in'}
        </button>
        <button
          type="button"
          className="btn ghost"
          onClick={() => { void signInWithApple().then((err) => { if (err) setError(err); }); }}
        >
          Sign in with Apple
        </button>
      </form>
    </main>
  );
}
