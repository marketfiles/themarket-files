'use client';
import { useState } from 'react';

export default function Admin() {
  const [msg, setMsg] = useState('');
  async function submit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const password = new FormData(e.currentTarget).get('password');
    setMsg('Signing in…');
    const r = await fetch('/api/admin/login', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ password }) });
    const j = await r.json().catch(() => ({}));
    if (r.ok) { window.location.href = '/#/on-this-date'; } else setMsg(j.error || 'Sign-in failed');
  }
  return (
    <main className="wrap" style={{ maxWidth: 420, padding: '96px 0' }}>
      <img src="/logo-240.png" alt="" width={72} height={72} />
      <h1 className="se-logo holo" style={{ margin: '16px 0 8px' }}>Editor sign-in</h1>
      <p className="dim" style={{ marginBottom: 20 }}>For the Market Files team. After signing in, the ✦ Editor button appears in the top bar.</p>
      <form onSubmit={submit} className="ed-f">
        <label>Password<input className="inp" name="password" type="password" required autoComplete="current-password" /></label>
        <button className="btn btn-p" style={{ height: 44, justifyContent: 'center' }}>Sign in</button>
        <p className="ed-msg mono" role="status">{msg}</p>
      </form>
    </main>
  );
}
