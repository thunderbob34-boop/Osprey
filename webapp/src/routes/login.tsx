import { useState } from 'react';
import { createFileRoute, useNavigate } from '@tanstack/react-router';
import { signInWithPassword, signInWithApple } from '../lib/auth';

export const Route = createFileRoute('/login')({ component: LoginPage });

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
    <main style={{ minHeight: '100vh', display: 'grid', placeItems: 'center' }}>
      <form onSubmit={submit} style={{ width: 360, border: 'var(--border-w) solid var(--line)', background: 'var(--panel)', padding: 32 }}>
        <h1 style={{ fontSize: 28, textTransform: 'uppercase', marginBottom: 24 }}>Osprey</h1>
        <label style={{ display: 'block', fontSize: 11, textTransform: 'uppercase', letterSpacing: 2, color: 'var(--mut)', marginBottom: 6 }}>Email</label>
        <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} required style={{ width: '100%', marginBottom: 16 }} />
        <label style={{ display: 'block', fontSize: 11, textTransform: 'uppercase', letterSpacing: 2, color: 'var(--mut)', marginBottom: 6 }}>Password</label>
        <input type="password" value={password} onChange={(e) => setPassword(e.target.value)} required style={{ width: '100%', marginBottom: 20 }} />
        {error && <p role="alert" style={{ color: 'var(--amber)', fontSize: 13, marginBottom: 14 }}>{error}</p>}
        <button type="submit" disabled={busy} style={{ width: '100%', background: 'var(--amber)', color: '#000', fontWeight: 700, textTransform: 'uppercase', padding: '12px 0', border: 'var(--border-w) solid var(--amber)', cursor: 'pointer' }}>
          {busy ? 'Signing in…' : 'Sign in'}
        </button>
        <button type="button" onClick={() => void signInWithApple()} style={{ width: '100%', marginTop: 10, background: 'transparent', color: 'var(--text)', fontWeight: 700, textTransform: 'uppercase', padding: '12px 0', border: 'var(--border-w) solid var(--line)', cursor: 'pointer' }}>
          Sign in with Apple
        </button>
      </form>
    </main>
  );
}
