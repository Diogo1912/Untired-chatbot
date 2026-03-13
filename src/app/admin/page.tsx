'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';

interface Stats {
  adminStats: { users: number; sessions: number; totalChats: number; totalMessages: number; ragDocuments: number };
  traceStats: { total_requests: number; avg_latency_ms: number; total_tokens: number; total_cost_usd: number; total_risk_events: number };
  evalStats: { total_evals: number; avg_tone_score: number; flow_compliance_rate: number; safety_pass_rate: number };
  recentTraces: any[];
  recentEvals: any[];
  riskEvents: any[];
}

interface User { id: string; username: string; is_admin: number; created_at: string; }

export default function AdminPage() {
  const router = useRouter();
  const [stats, setStats] = useState<Stats | null>(null);
  const [users, setUsers] = useState<User[]>([]);
  const [tab, setTab] = useState<'overview' | 'traces' | 'evals' | 'risks' | 'users'>('overview');
  const [newUsername, setNewUsername] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    fetch('/api/auth/me').then(r => r.json()).then(d => {
      if (!d.user?.isAdmin) router.push('/chat');
    });
    loadStats();
    loadUsers();
  }, [router]);

  async function loadStats() {
    const res = await fetch('/api/admin/stats');
    if (res.ok) setStats(await res.json());
  }

  async function loadUsers() {
    const res = await fetch('/api/admin/users');
    if (res.ok) { const d = await res.json(); setUsers(d.users); }
  }

  async function createUser() {
    setCreating(true); setError('');
    const res = await fetch('/api/admin/users', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username: newUsername, password: newPassword }),
    });
    const d = await res.json();
    if (!res.ok) { setError(d.error); } else { setNewUsername(''); setNewPassword(''); loadUsers(); }
    setCreating(false);
  }

  async function deleteUser(id: string) {
    if (!confirm('Delete this user?')) return;
    await fetch('/api/admin/users', { method: 'DELETE', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ userId: id }) });
    loadUsers();
  }

  const tabs = [
    { id: 'overview', label: 'Overview' },
    { id: 'traces', label: 'LLM Traces' },
    { id: 'evals', label: 'Evaluations' },
    { id: 'risks', label: 'Risk Events' },
    { id: 'users', label: 'Users' },
  ] as const;

  return (
    <div className="min-h-screen bg-surface">
      {/* Header */}
      <header className="bg-white border-b border-gray-100 px-6 py-4 flex items-center justify-between sticky top-0 z-10">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-lg bg-brand-purple flex items-center justify-center">
            <svg className="w-4 h-4 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
            </svg>
          </div>
          <h1 className="font-semibold text-gray-900">Admin Dashboard</h1>
        </div>
        <div className="flex items-center gap-3">
          <button onClick={() => router.push('/chat')} className="text-sm text-brand-purple hover:underline font-medium">
            Back to chat
          </button>
          <button onClick={() => { fetch('/api/auth/logout', { method: 'POST' }); router.push('/'); }} className="text-sm text-gray-400 hover:text-gray-600">
            Sign out
          </button>
        </div>
      </header>

      {/* Tabs */}
      <div className="border-b border-gray-200 bg-white px-6">
        <div className="flex gap-1 overflow-x-auto">
          {tabs.map(t => (
            <button
              key={t.id}
              onClick={() => setTab(t.id)}
              className={`px-4 py-3 text-sm font-medium border-b-2 transition-all whitespace-nowrap ${
                tab === t.id ? 'border-brand-purple text-brand-purple' : 'border-transparent text-gray-500 hover:text-gray-700'
              }`}
            >
              {t.label}
            </button>
          ))}
        </div>
      </div>

      <main className="max-w-6xl mx-auto px-6 py-6">
        {/* Overview */}
        {tab === 'overview' && stats && (
          <div className="space-y-6">
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              {[
                { label: 'Total users', value: stats.adminStats.users },
                { label: 'Total chats', value: stats.adminStats.totalChats },
                { label: 'LLM requests', value: stats.traceStats?.total_requests ?? 0 },
                { label: 'Total cost', value: `$${(stats.traceStats?.total_cost_usd ?? 0).toFixed(4)}` },
              ].map(s => (
                <div key={s.label} className="bg-white rounded-2xl p-4 border border-gray-100 shadow-sm">
                  <p className="text-xs text-gray-500 mb-1">{s.label}</p>
                  <p className="text-2xl font-bold text-gray-900">{s.value}</p>
                </div>
              ))}
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="bg-white rounded-2xl p-5 border border-gray-100 shadow-sm">
                <h3 className="font-semibold text-gray-800 mb-4 text-sm">LLM Performance</h3>
                <div className="space-y-3">
                  {[
                    { label: 'Avg latency', value: `${Math.round(stats.traceStats?.avg_latency_ms ?? 0)}ms` },
                    { label: 'Total tokens', value: (stats.traceStats?.total_tokens ?? 0).toLocaleString() },
                    { label: 'Risk events', value: stats.traceStats?.total_risk_events ?? 0 },
                    { label: 'RAG docs', value: stats.adminStats.ragDocuments },
                  ].map(s => (
                    <div key={s.label} className="flex justify-between items-center">
                      <span className="text-sm text-gray-500">{s.label}</span>
                      <span className="text-sm font-semibold text-gray-900">{s.value}</span>
                    </div>
                  ))}
                </div>
              </div>
              <div className="bg-white rounded-2xl p-5 border border-gray-100 shadow-sm">
                <h3 className="font-semibold text-gray-800 mb-4 text-sm">Response Quality</h3>
                <div className="space-y-3">
                  {[
                    { label: 'Avg tone score', value: `${(stats.evalStats?.avg_tone_score ?? 0).toFixed(1)}/5` },
                    { label: 'Flow compliance', value: `${Math.round((stats.evalStats?.flow_compliance_rate ?? 0) * 100)}%` },
                    { label: 'Safety pass rate', value: `${Math.round((stats.evalStats?.safety_pass_rate ?? 0) * 100)}%` },
                    { label: 'Total evals run', value: stats.evalStats?.total_evals ?? 0 },
                  ].map(s => (
                    <div key={s.label} className="flex justify-between items-center">
                      <span className="text-sm text-gray-500">{s.label}</span>
                      <span className="text-sm font-semibold text-gray-900">{s.value}</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Loading state for overview */}
        {tab === 'overview' && !stats && (
          <div className="flex items-center justify-center py-20">
            <div className="w-8 h-8 border-2 border-brand-purple/30 border-t-brand-purple rounded-full animate-spin" />
          </div>
        )}

        {/* LLM Traces */}
        {tab === 'traces' && stats && (
          <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-gray-50 border-b border-gray-100">
                  <tr>
                    {['Time', 'Step', 'Model', 'Latency', 'Tokens in', 'Tokens out', 'Cost', 'Risk'].map(h => (
                      <th key={h} className="px-4 py-3 text-left text-xs font-medium text-gray-500">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-50">
                  {stats.recentTraces.map((t: any) => (
                    <tr key={t.id} className="hover:bg-gray-50">
                      <td className="px-4 py-3 text-xs text-gray-500">{new Date(t.created_at).toLocaleString()}</td>
                      <td className="px-4 py-3"><span className="px-2 py-0.5 rounded-full bg-brand-purple-pale text-brand-purple text-xs font-medium">Step {t.flow_step}</span></td>
                      <td className="px-4 py-3 text-xs text-gray-600 font-mono">{t.model?.split('/')[1]}</td>
                      <td className="px-4 py-3 text-xs text-gray-900">{t.latency_ms}ms</td>
                      <td className="px-4 py-3 text-xs text-gray-600">{t.tokens_in}</td>
                      <td className="px-4 py-3 text-xs text-gray-600">{t.tokens_out}</td>
                      <td className="px-4 py-3 text-xs text-gray-600">${t.cost_usd?.toFixed(5)}</td>
                      <td className="px-4 py-3">{t.risk_triggered ? <span className="text-red-500 text-xs font-semibold">Yes</span> : <span className="text-gray-300 text-xs">—</span>}</td>
                    </tr>
                  ))}
                  {stats.recentTraces.length === 0 && (
                    <tr>
                      <td colSpan={8} className="px-4 py-12 text-center text-sm text-gray-400">No traces yet</td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* Evaluations */}
        {tab === 'evals' && stats && (
          <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-gray-50 border-b border-gray-100">
                  <tr>
                    {['Time', 'Tone', 'Flow', 'Length', 'Safety', 'Reasoning'].map(h => (
                      <th key={h} className="px-4 py-3 text-left text-xs font-medium text-gray-500">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-50">
                  {stats.recentEvals.map((e: any) => (
                    <tr key={e.id} className="hover:bg-gray-50">
                      <td className="px-4 py-3 text-xs text-gray-500">{new Date(e.created_at).toLocaleString()}</td>
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-1">
                          {Array.from({ length: 5 }).map((_, i) => (
                            <div key={i} className={`w-2 h-2 rounded-full ${i < e.tone_score ? 'bg-brand-purple' : 'bg-gray-200'}`} />
                          ))}
                          <span className="text-xs text-gray-500 ml-1">{e.tone_score}/5</span>
                        </div>
                      </td>
                      <td className="px-4 py-3">{e.flow_compliance ? <span className="text-green-500 text-xs">Pass</span> : <span className="text-red-400 text-xs">Fail</span>}</td>
                      <td className="px-4 py-3">{e.length_compliance ? <span className="text-green-500 text-xs">Pass</span> : <span className="text-red-400 text-xs">Fail</span>}</td>
                      <td className="px-4 py-3">{e.safety_pass ? <span className="text-green-500 text-xs">Pass</span> : <span className="text-red-400 text-xs font-bold">FAIL</span>}</td>
                      <td className="px-4 py-3 text-xs text-gray-500 max-w-xs truncate">{e.eval_reasoning}</td>
                    </tr>
                  ))}
                  {stats.recentEvals.length === 0 && (
                    <tr>
                      <td colSpan={6} className="px-4 py-12 text-center text-sm text-gray-400">No evaluations yet</td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* Risk Events */}
        {tab === 'risks' && stats && (
          <div className="space-y-3">
            {stats.riskEvents.length === 0 && (
              <div className="text-center py-12 text-gray-400 text-sm">No risk events recorded</div>
            )}
            {stats.riskEvents.map((e: any) => (
              <div key={e.id} className="bg-white rounded-2xl p-4 border border-red-100 shadow-sm">
                <div className="flex items-center justify-between mb-2">
                  <span className={`px-2.5 py-0.5 rounded-full text-xs font-semibold ${e.severity === 'high' ? 'bg-red-100 text-red-600' : 'bg-amber-100 text-amber-600'}`}>
                    {e.severity} severity · {e.trigger_type}
                  </span>
                  <span className="text-xs text-gray-400">{new Date(e.created_at).toLocaleString()}</span>
                </div>
                <p className="text-sm text-gray-700 bg-gray-50 rounded-xl px-3 py-2">"{e.message_content}"</p>
              </div>
            ))}
          </div>
        )}

        {/* Users */}
        {tab === 'users' && (
          <div className="space-y-4">
            <div className="bg-white rounded-2xl p-5 border border-gray-100 shadow-sm">
              <h3 className="font-semibold text-gray-800 mb-4 text-sm">Create user</h3>
              <div className="flex gap-2 flex-wrap">
                <input
                  value={newUsername} onChange={e => setNewUsername(e.target.value)}
                  placeholder="Username" className="flex-1 min-w-32 px-3 py-2 rounded-xl border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-brand-purple/30"
                />
                <input
                  type="password" value={newPassword} onChange={e => setNewPassword(e.target.value)}
                  placeholder="Password" className="flex-1 min-w-32 px-3 py-2 rounded-xl border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-brand-purple/30"
                />
                <button onClick={createUser} disabled={creating || !newUsername || !newPassword}
                  className="px-4 py-2 rounded-xl bg-brand-purple text-white text-sm font-medium hover:bg-brand-purple-light disabled:opacity-50 transition-all">
                  {creating ? 'Creating...' : 'Create'}
                </button>
              </div>
              {error && <p className="text-red-500 text-xs mt-2">{error}</p>}
            </div>
            <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
              <table className="w-full text-sm">
                <thead className="bg-gray-50 border-b border-gray-100">
                  <tr>
                    {['Username', 'Role', 'Created', 'Actions'].map(h => (
                      <th key={h} className="px-4 py-3 text-left text-xs font-medium text-gray-500">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-50">
                  {users.map(u => (
                    <tr key={u.id}>
                      <td className="px-4 py-3 font-medium text-gray-900">{u.username}</td>
                      <td className="px-4 py-3"><span className={`px-2 py-0.5 rounded-full text-xs font-medium ${u.is_admin ? 'bg-brand-purple-pale text-brand-purple' : 'bg-gray-100 text-gray-600'}`}>{u.is_admin ? 'Admin' : 'User'}</span></td>
                      <td className="px-4 py-3 text-xs text-gray-500">{new Date(u.created_at).toLocaleDateString()}</td>
                      <td className="px-4 py-3">
                        {!u.is_admin && (
                          <button onClick={() => deleteUser(u.id)} className="text-xs text-red-400 hover:text-red-600">Delete</button>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}
