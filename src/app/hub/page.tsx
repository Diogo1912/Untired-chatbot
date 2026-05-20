'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import Logo from '@/components/Logo';

interface User { id: string; username: string; isAdmin: boolean }

export default function HubPage() {
  const router = useRouter();
  const [user, setUser] = useState<User | null>(null);
  const [checking, setChecking] = useState(true);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const res = await fetch('/api/auth/me');
      if (res.status === 401) { router.replace('/'); return; }
      const data = await res.json();
      if (!cancelled) {
        setUser(data.user);
        setChecking(false);
      }
    })();
    return () => { cancelled = true; };
  }, [router]);

  async function logout() {
    await fetch('/api/auth/logout', { method: 'POST' });
    router.replace('/');
  }

  if (checking) {
    return <div className="min-h-screen flex items-center justify-center text-gray-500">…</div>;
  }

  const modes = [
    {
      key: 'chat',
      title: 'Untire Coach',
      subtitle: 'Full guided coaching session — 4-step daily check-in with the AI coach.',
      href: '/chat',
      tone: 'bg-brand-purple text-white shadow-brand-purple/25',
      icon: (
        <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
        </svg>
      ),
      visible: true,
    },
    {
      key: 'recommender',
      title: 'Theme Recommender',
      subtitle: 'Lightweight, rule-based prototype. Maps energy & mood inputs to in-app themes — no LLM in the response path.',
      href: '/recommender',
      tone: 'bg-brand-teal text-white shadow-brand-teal/25',
      icon: (
        <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
        </svg>
      ),
      visible: true,
    },
    {
      key: 'admin',
      title: 'Admin Dashboard',
      subtitle: 'Manage users, review LLM traces, evaluation scores and risk events.',
      href: '/admin',
      tone: 'bg-gray-900 text-white shadow-gray-900/25',
      icon: (
        <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
        </svg>
      ),
      visible: !!user?.isAdmin,
    },
  ].filter(m => m.visible);

  return (
    <div className="min-h-screen bg-gradient-to-br from-brand-purple-pale via-white to-brand-teal/10 p-6 sm:p-10">
      <div className="max-w-4xl mx-auto">
        <header className="flex items-center justify-between mb-10">
          <div className="flex items-center gap-3">
            <Logo size={44} />
            <div>
              <h1 className="text-xl font-semibold text-gray-900">Tired of Cancer</h1>
              <p className="text-xs text-gray-500">Signed in as {user?.username}</p>
            </div>
          </div>
          <button onClick={logout} className="text-sm text-gray-500 hover:text-gray-900">Sign out</button>
        </header>

        <h2 className="text-2xl font-semibold text-gray-900 mb-2">Choose a mode</h2>
        <p className="text-sm text-gray-500 mb-8">Pick which prototype you want to open. You can switch any time.</p>

        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {modes.map(m => (
            <button
              key={m.key}
              onClick={() => router.push(m.href)}
              className="text-left bg-white rounded-3xl shadow-xl shadow-gray-200/80 p-6 hover:scale-[1.02] active:scale-[0.99] transition-transform"
            >
              <div className={`w-12 h-12 rounded-xl flex items-center justify-center mb-4 shadow-lg ${m.tone}`}>
                {m.icon}
              </div>
              <h3 className="text-lg font-semibold text-gray-900">{m.title}</h3>
              <p className="text-sm text-gray-500 mt-1 leading-relaxed">{m.subtitle}</p>
              <div className="mt-4 text-xs font-medium text-brand-purple">Open →</div>
            </button>
          ))}
        </div>

        <p className="text-center text-xs text-gray-400 mt-10">Tired of Cancer B.V. · Prototype v2</p>
      </div>
    </div>
  );
}
