'use client';

import { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import Logo from '@/components/Logo';

// ─── Types ──────────────────────────────────────────────────────────────────

interface Stats {
  adminStats: { users: number; sessions: number; totalChats: number; totalMessages: number; ragDocuments: number };
  traceStats: { total_requests: number; avg_latency_ms: number; total_tokens: number; total_cost_usd: number; total_risk_events: number; avg_rag_similarity: number };
  evalStats: { total_evals: number; eval_errors: number; avg_tone_score: number; flow_compliance_rate: number; length_compliance_rate: number; safety_pass_rate: number; contextual_relevance_rate: number };
  completionStats: { totalChats: number; completedChats: number; completionRate: number; dropoutByStep: { flow_step: number; count: number }[] };
  evalCoverage: { totalAiMessages: number; totalEvals: number; coverageRate: number };
  evalByStep: { flow_step: number; eval_count: number; avg_tone: number; flow_compliance_rate: number; length_compliance_rate: number; safety_pass_rate: number; contextual_relevance_rate: number }[];
  qualityScorecard: { stats: { total: number; avg_tone: number; safety_rate: number; flow_rate: number; relevance_rate: number; length_rate: number }; distribution: { tone_score: number; count: number }[]; errorCount: number };
  flaggedResponses: any[];
  recentTraces: any[];
  recentEvals: any[];
  riskEvents: any[];
}

interface TrendData {
  evalTrend: { day: string; avg_tone: number; safety_rate: number; flow_rate: number; relevance_rate: number; eval_count: number }[];
  traceTrend: { day: string; request_count: number; avg_latency: number; daily_cost: number; avg_rag_similarity: number }[];
  volumeTrend: { day: string; message_count: number; session_count: number }[];
}

interface UserAnalytics {
  id: string; username: string; joined_at: string; total_sessions: number;
  completed_sessions: number; total_cost: number; avg_tone: number;
  safety_fails: number; last_active: string;
}

interface User { id: string; username: string; is_admin: number; created_at: string; }

type Tab = 'overview' | 'qa' | 'evals' | 'traces' | 'users' | 'rag' | 'settings';

const STEP_LABELS: Record<number, string> = { 0: 'Check-in', 1: 'Acknowledge', 2: 'Reflection', 3: 'Connect', 4: 'Close' };

// ─── Helpers ────────────────────────────────────────────────────────────────

function pct(v: number | null | undefined): string {
  if (v == null) return '0%';
  return `${Math.round(v * 100)}%`;
}

function scoreColor(rate: number): string {
  if (rate >= 0.8) return 'text-green-600';
  if (rate >= 0.6) return 'text-amber-500';
  return 'text-red-500';
}

function scoreBg(rate: number): string {
  if (rate >= 0.8) return 'bg-green-500';
  if (rate >= 0.6) return 'bg-amber-400';
  return 'bg-red-400';
}

function heatBg(rate: number): string {
  if (rate >= 0.95) return 'bg-green-100 text-green-800';
  if (rate >= 0.8) return 'bg-green-50 text-green-700';
  if (rate >= 0.6) return 'bg-amber-50 text-amber-700';
  return 'bg-red-50 text-red-700';
}

function toneBg(score: number): string {
  if (score >= 4) return 'bg-green-100 text-green-800';
  if (score >= 3) return 'bg-amber-50 text-amber-700';
  return 'bg-red-50 text-red-700';
}

// ─── Chart Components ───────────────────────────────────────────────────────

function BarChart({ data, valueKey, labelKey = 'day', color = 'bg-brand-purple', maxHeight = 120, label }: {
  data: any[]; valueKey: string; labelKey?: string; color?: string; maxHeight?: number; label: string;
}) {
  if (!data.length) return <div className="text-center text-xs text-gray-400 py-8">No data yet</div>;
  const max = Math.max(...data.map(d => d[valueKey] ?? 0), 0.001);
  return (
    <div>
      <p className="text-xs font-medium text-gray-600 mb-2">{label}</p>
      <div className="flex items-end gap-[2px]" style={{ height: maxHeight }}>
        {data.map((d, i) => {
          const val = d[valueKey] ?? 0;
          const h = Math.max((val / max) * maxHeight, 2);
          return (
            <div key={i} className="flex-1 group relative">
              <div className={`${color} rounded-t-sm opacity-80 hover:opacity-100 transition-opacity`} style={{ height: h }} />
              <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-1 hidden group-hover:block bg-gray-900 text-white text-[10px] px-1.5 py-0.5 rounded whitespace-nowrap z-10">
                {typeof val === 'number' ? (val < 1 && val > 0 ? val.toFixed(3) : val.toFixed(1)) : val}
                <br />{d[labelKey]?.slice(5)}
              </div>
            </div>
          );
        })}
      </div>
      <div className="flex justify-between text-[10px] text-gray-400 mt-1">
        <span>{data[0]?.[labelKey]?.slice(5)}</span>
        <span>{data[data.length - 1]?.[labelKey]?.slice(5)}</span>
      </div>
    </div>
  );
}

function SparkLine({ data, valueKey, stroke = '#7c3aed', fill = '#7c3aed1a', height = 60, label, format }: {
  data: any[]; valueKey: string; stroke?: string; fill?: string; height?: number; label: string;
  format?: (v: number) => string;
}) {
  if (!data.length) return <div className="text-center text-xs text-gray-400 py-8">No data</div>;
  const vals = data.map(d => Number(d[valueKey] ?? 0));
  const max = Math.max(...vals, 0.001);
  const min = Math.min(...vals, 0);
  const range = Math.max(max - min, 0.001);
  const w = 220;
  const pts = vals.map((v, i) => {
    const x = (i / Math.max(vals.length - 1, 1)) * w;
    const y = height - ((v - min) / range) * (height - 6) - 3;
    return [x, y] as const;
  });
  const linePath = pts.map(([x, y], i) => `${i === 0 ? 'M' : 'L'}${x.toFixed(1)},${y.toFixed(1)}`).join(' ');
  const areaPath = `${linePath} L${w.toFixed(1)},${height} L0,${height} Z`;
  const last = vals[vals.length - 1];
  const first = vals[0];
  const delta = first === 0 ? 0 : ((last - first) / Math.max(Math.abs(first), 0.0001)) * 100;
  const arrow = delta > 1 ? '↑' : delta < -1 ? '↓' : '→';
  const arrowColor = delta > 1 ? 'text-green-600' : delta < -1 ? 'text-red-500' : 'text-gray-400';
  return (
    <div>
      <div className="flex items-baseline justify-between mb-1">
        <p className="text-xs font-medium text-gray-600">{label}</p>
        <span className={`text-[10px] font-semibold ${arrowColor}`}>{arrow} {Math.abs(delta).toFixed(0)}%</span>
      </div>
      <div className="flex items-end gap-3">
        <svg width={w} height={height} viewBox={`0 0 ${w} ${height}`} className="flex-1">
          <path d={areaPath} fill={fill} />
          <path d={linePath} stroke={stroke} strokeWidth="2" fill="none" strokeLinecap="round" strokeLinejoin="round" />
          {pts.length > 0 && (
            <circle cx={pts[pts.length - 1][0]} cy={pts[pts.length - 1][1]} r="3" fill={stroke} />
          )}
        </svg>
        <div className="text-right">
          <div className="text-lg font-bold text-gray-900">{format ? format(last) : (last < 1 && last > 0 ? last.toFixed(3) : last.toFixed(1))}</div>
          <div className="text-[10px] text-gray-400">latest</div>
        </div>
      </div>
    </div>
  );
}

function InsightBadge({ label, value, hint, tone = 'neutral' }: {
  label: string; value: string; hint?: string; tone?: 'good' | 'bad' | 'neutral';
}) {
  const toneCls =
    tone === 'good' ? 'bg-green-50 border-green-100 text-green-700'
    : tone === 'bad' ? 'bg-red-50 border-red-100 text-red-700'
    : 'bg-gray-50 border-gray-100 text-gray-700';
  return (
    <div className={`rounded-xl border p-3 ${toneCls}`}>
      <p className="text-[10px] uppercase tracking-wide opacity-70">{label}</p>
      <p className="text-lg font-semibold mt-0.5">{value}</p>
      {hint && <p className="text-[10px] opacity-70 mt-0.5">{hint}</p>}
    </div>
  );
}

// ─── Main Component ─────────────────────────────────────────────────────────

export default function AdminPage() {
  const router = useRouter();
  const [stats, setStats] = useState<Stats | null>(null);
  const [trends, setTrends] = useState<TrendData | null>(null);
  const [userAnalytics, setUserAnalytics] = useState<UserAnalytics[]>([]);
  const [users, setUsers] = useState<User[]>([]);
  const [tab, setTab] = useState<Tab>('overview');
  const [newUsername, setNewUsername] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState('');

  // Date range
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');

  // QA Review
  const [sessions, setSessions] = useState<any[]>([]);
  const [selectedChat, setSelectedChat] = useState<any[] | null>(null);
  const [selectedChatId, setSelectedChatId] = useState<string | null>(null);

  // RAG
  const [ragDocs, setRagDocs] = useState<any[]>([]);
  const [ragTitle, setRagTitle] = useState('');
  const [ragSource, setRagSource] = useState('');
  const [ragContent, setRagContent] = useState('');
  const [ragLoading, setRagLoading] = useState(false);
  const [ragError, setRagError] = useState('');

  // Settings
  interface SettingDef { key: string; label: string; group: string; type: string; default: any; options?: { value: string; label: string }[]; min?: number; max?: number; step?: number; description?: string; }
  const [settingDefs, setSettingDefs] = useState<SettingDef[]>([]);
  const [settingValues, setSettingValues] = useState<Record<string, string>>({});
  const [settingsSaving, setSettingsSaving] = useState(false);
  const [settingsSaved, setSettingsSaved] = useState(false);

  async function loadSettings() {
    const res = await fetch('/api/admin/settings');
    if (res.ok) {
      const d = await res.json();
      setSettingDefs(d.defs);
      setSettingValues(d.values);
    }
  }

  async function saveSettings() {
    setSettingsSaving(true);
    setSettingsSaved(false);
    const res = await fetch('/api/admin/settings', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(settingValues),
    });
    if (res.ok) {
      const d = await res.json();
      setSettingValues(d.values);
      setSettingsSaved(true);
      setTimeout(() => setSettingsSaved(false), 2000);
    }
    setSettingsSaving(false);
  }

  useEffect(() => {
    fetch('/api/auth/me').then(r => r.json()).then(d => {
      if (!d.user?.isAdmin) router.push('/hub');
    });
    loadStats();
    loadUsers();
    loadRagDocs();
  }, [router]);

  const dateParams = dateFrom && dateTo ? `&from=${dateFrom}&to=${dateTo}` : '';

  const loadStats = useCallback(async () => {
    const res = await fetch(`/api/admin/stats?${dateParams.replace('&', '')}`);
    if (res.ok) setStats(await res.json());
  }, [dateParams]);

  async function loadUsers() {
    const res = await fetch('/api/admin/users');
    if (res.ok) { const d = await res.json(); setUsers(d.users); }
  }

  async function loadRagDocs() {
    const res = await fetch('/api/admin/rag');
    if (res.ok) { const d = await res.json(); setRagDocs(d.documents); }
  }

  async function loadTrends() {
    const res = await fetch('/api/admin/stats?view=trends&days=30');
    if (res.ok) setTrends(await res.json());
  }

  async function loadUserAnalytics() {
    const res = await fetch('/api/admin/stats?view=users');
    if (res.ok) { const d = await res.json(); setUserAnalytics(d.userAnalytics); }
  }

  async function loadSessions() {
    const res = await fetch(`/api/admin/stats?view=conversation${dateParams}`);
    if (res.ok) { const d = await res.json(); setSessions(d.sessions); }
  }

  async function loadConversation(chatId: string) {
    const res = await fetch(`/api/admin/stats?view=conversation&chatId=${chatId}`);
    if (res.ok) {
      const d = await res.json();
      setSelectedChat(d.conversation);
      setSelectedChatId(chatId);
    }
  }

  useEffect(() => { loadStats(); }, [dateFrom, dateTo, loadStats]);
  useEffect(() => {
    if (tab === 'overview') loadTrends();
    if (tab === 'users') loadUserAnalytics();
    if (tab === 'qa') loadSessions();
    if (tab === 'settings') loadSettings();
  }, [tab]);

  async function createUser() {
    setCreating(true); setError('');
    const res = await fetch('/api/admin/users', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
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

  async function dismissFlagged(evalId: string) {
    await fetch('/api/admin/stats', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'markReviewed', evalId }),
    });
    loadStats();
  }

  async function ingestDocument() {
    setRagLoading(true); setRagError('');
    const res = await fetch('/api/admin/rag', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ title: ragTitle, source: ragSource, content: ragContent }),
    });
    const d = await res.json();
    if (!res.ok) { setRagError(d.error); }
    else { setRagTitle(''); setRagSource(''); setRagContent(''); loadRagDocs(); loadStats(); }
    setRagLoading(false);
  }

  async function deleteRagDoc(source: string) {
    if (!confirm('Delete this document from RAG?')) return;
    await fetch('/api/admin/rag', { method: 'DELETE', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ source }) });
    loadRagDocs();
  }

  function exportCsv(type: string) {
    const params = new URLSearchParams({ type });
    if (dateFrom) params.set('from', dateFrom);
    if (dateTo) params.set('to', dateTo);
    window.open(`/api/admin/export?${params.toString()}`, '_blank');
  }

  const tabs: { id: Tab; label: string }[] = [
    { id: 'overview', label: 'Analytics' },
    { id: 'qa', label: 'QA Review' },
    { id: 'evals', label: 'Evaluations' },
    { id: 'traces', label: 'LLM Traces' },
    { id: 'users', label: 'Users' },
    { id: 'rag', label: 'RAG Content' },
    { id: 'settings', label: 'Settings' },
  ];

  // Quality score computation
  const sc = stats?.qualityScorecard?.stats;
  const qualityScore = sc ? (
    ((sc.avg_tone ?? 0) / 5) * 0.4 +
    (sc.safety_rate ?? 0) * 0.3 +
    (sc.flow_rate ?? 0) * 0.2 +
    (sc.relevance_rate ?? 0) * 0.1
  ) * 100 : 0;

  return (
    <div className="min-h-screen bg-surface">
      {/* Header */}
      <header className="bg-white border-b border-gray-100 px-6 py-4 flex items-center justify-between sticky top-0 z-10">
        <div className="flex items-center gap-3">
          <button onClick={() => router.push('/hub')} className="flex items-center gap-2 hover:opacity-80 transition-opacity">
            <Logo size={32} />
            <span className="font-semibold text-gray-900 hidden sm:inline">Tired of Cancer</span>
          </button>
          <span className="text-gray-300">·</span>
          <h1 className="font-semibold text-gray-900">Admin Dashboard</h1>
        </div>
        <div className="flex items-center gap-3">
          {/* Date range */}
          <div className="flex items-center gap-1.5 text-xs">
            <input type="date" value={dateFrom} onChange={e => setDateFrom(e.target.value)}
              className="px-2 py-1 rounded-lg border border-gray-200 text-xs focus:outline-none focus:ring-2 focus:ring-brand-purple/30" />
            <span className="text-gray-400">to</span>
            <input type="date" value={dateTo} onChange={e => setDateTo(e.target.value)}
              className="px-2 py-1 rounded-lg border border-gray-200 text-xs focus:outline-none focus:ring-2 focus:ring-brand-purple/30" />
            {(dateFrom || dateTo) && (
              <button onClick={() => { setDateFrom(''); setDateTo(''); }} className="text-gray-400 hover:text-gray-600 text-xs">Clear</button>
            )}
          </div>
          <button onClick={() => router.push('/hub')} className="text-sm text-brand-purple hover:underline font-medium">Switch app</button>
          <button onClick={() => { fetch('/api/auth/logout', { method: 'POST' }); router.push('/'); }} className="text-sm text-gray-400 hover:text-gray-600">Sign out</button>
        </div>
      </header>

      {/* Tabs */}
      <div className="border-b border-gray-200 bg-white px-6">
        <div className="flex gap-1 overflow-x-auto">
          {tabs.map(t => (
            <button key={t.id} onClick={() => setTab(t.id)}
              className={`px-4 py-3 text-sm font-medium border-b-2 transition-all whitespace-nowrap ${
                tab === t.id ? 'border-brand-purple text-brand-purple' : 'border-transparent text-gray-500 hover:text-gray-700'
              }`}>
              {t.label}
              {t.id === 'qa' && stats?.flaggedResponses && stats.flaggedResponses.length > 0 && (
                <span className="ml-1.5 px-1.5 py-0.5 rounded-full bg-red-100 text-red-600 text-[10px] font-bold">{stats.flaggedResponses.length}</span>
              )}
            </button>
          ))}
        </div>
      </div>

      <main className="max-w-7xl mx-auto px-6 py-6">

        {/* ═══════════════════ OVERVIEW ═══════════════════ */}
        {tab === 'overview' && stats && (
          <div className="space-y-6">
            {/* Top stat cards */}
            <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
              {[
                { label: 'Users', value: stats.adminStats.users },
                { label: 'Sessions', value: stats.adminStats.totalChats },
                { label: 'Completion rate', value: pct(stats.completionStats?.completionRate) },
                { label: 'LLM requests', value: stats.traceStats?.total_requests ?? 0 },
                { label: 'Total cost', value: `$${(stats.traceStats?.total_cost_usd ?? 0).toFixed(4)}` },
              ].map(s => (
                <div key={s.label} className="bg-white rounded-2xl p-4 border border-gray-100 shadow-sm">
                  <p className="text-xs text-gray-500 mb-1">{s.label}</p>
                  <p className="text-2xl font-bold text-gray-900">{s.value}</p>
                </div>
              ))}
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              {/* Quality Scorecard */}
              <div className="bg-white rounded-2xl p-5 border border-gray-100 shadow-sm md:col-span-2">
                <div className="flex items-center justify-between mb-4">
                  <h3 className="font-semibold text-gray-800 text-sm">Quality Scorecard</h3>
                  <button onClick={() => exportCsv('evals')} className="text-[10px] text-brand-purple hover:underline">Export CSV</button>
                </div>
                <div className="flex gap-6">
                  {/* Big score */}
                  <div className="flex-shrink-0 flex flex-col items-center justify-center">
                    <div className={`text-4xl font-bold ${qualityScore >= 80 ? 'text-green-600' : qualityScore >= 60 ? 'text-amber-500' : 'text-red-500'}`}>
                      {qualityScore.toFixed(0)}
                    </div>
                    <p className="text-xs text-gray-400 mt-1">Overall</p>
                  </div>
                  {/* Dimension bars */}
                  <div className="flex-1 space-y-2.5">
                    {[
                      { label: 'Tone', rate: (sc?.avg_tone ?? 0) / 5, raw: `${(sc?.avg_tone ?? 0).toFixed(1)}/5` },
                      { label: 'Safety', rate: sc?.safety_rate ?? 0 },
                      { label: 'Flow', rate: sc?.flow_rate ?? 0 },
                      { label: 'Relevance', rate: sc?.relevance_rate ?? 0 },
                      { label: 'Length', rate: sc?.length_rate ?? 0 },
                    ].map(d => (
                      <div key={d.label} className="flex items-center gap-2">
                        <span className="text-xs text-gray-500 w-16">{d.label}</span>
                        <div className="flex-1 h-2 bg-gray-100 rounded-full overflow-hidden">
                          <div className={`h-full rounded-full ${scoreBg(d.rate)}`} style={{ width: pct(d.rate) }} />
                        </div>
                        <span className={`text-xs font-semibold w-10 text-right ${scoreColor(d.rate)}`}>{d.raw ?? pct(d.rate)}</span>
                      </div>
                    ))}
                  </div>
                </div>
                {/* Tone distribution */}
                {stats.qualityScorecard?.distribution?.length > 0 && (
                  <div className="mt-4 pt-4 border-t border-gray-100">
                    <p className="text-xs text-gray-500 mb-2">Tone score distribution</p>
                    <div className="flex items-end gap-1.5 h-10">
                      {[1, 2, 3, 4, 5].map(score => {
                        const entry = stats.qualityScorecard.distribution.find((d: any) => d.tone_score === score);
                        const count = entry?.count ?? 0;
                        const max = Math.max(...stats.qualityScorecard.distribution.map((d: any) => d.count), 1);
                        const h = Math.max((count / max) * 40, 2);
                        const colors = ['bg-red-400', 'bg-orange-400', 'bg-amber-400', 'bg-green-400', 'bg-green-600'];
                        return (
                          <div key={score} className="flex-1 flex flex-col items-center gap-0.5">
                            <span className="text-[10px] text-gray-400">{count}</span>
                            <div className={`w-full rounded-t ${colors[score - 1]}`} style={{ height: h }} />
                            <span className="text-[10px] text-gray-500">{score}</span>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}
                {/* Eval health */}
                <div className="mt-3 pt-3 border-t border-gray-100 flex gap-6 text-xs text-gray-500">
                  <span>Coverage: <strong className="text-gray-700">{pct(stats.evalCoverage?.coverageRate)}</strong></span>
                  <span>Errors: <strong className={stats.qualityScorecard?.errorCount > 0 ? 'text-red-500' : 'text-gray-700'}>{stats.qualityScorecard?.errorCount ?? 0}</strong></span>
                  <span>Total evals: <strong className="text-gray-700">{sc?.total ?? 0}</strong></span>
                </div>
              </div>

              {/* LLM Performance + Completion */}
              <div className="space-y-4">
                <div className="bg-white rounded-2xl p-5 border border-gray-100 shadow-sm">
                  <h3 className="font-semibold text-gray-800 mb-3 text-sm">LLM Performance</h3>
                  <div className="space-y-2.5">
                    {[
                      { label: 'Avg latency', value: `${Math.round(stats.traceStats?.avg_latency_ms ?? 0)}ms` },
                      { label: 'Total tokens', value: (stats.traceStats?.total_tokens ?? 0).toLocaleString() },
                      { label: 'RAG similarity', value: (stats.traceStats?.avg_rag_similarity ?? 0).toFixed(3) },
                      { label: 'RAG docs', value: stats.adminStats.ragDocuments },
                    ].map(s => (
                      <div key={s.label} className="flex justify-between items-center">
                        <span className="text-xs text-gray-500">{s.label}</span>
                        <span className="text-xs font-semibold text-gray-900">{s.value}</span>
                      </div>
                    ))}
                  </div>
                </div>
                <div className="bg-white rounded-2xl p-5 border border-gray-100 shadow-sm">
                  <h3 className="font-semibold text-gray-800 mb-3 text-sm">Session Completion</h3>
                  <div className="flex items-center gap-3 mb-3">
                    <div className="text-2xl font-bold text-gray-900">{pct(stats.completionStats?.completionRate)}</div>
                    <div className="text-xs text-gray-500">{stats.completionStats?.completedChats ?? 0} / {stats.completionStats?.totalChats ?? 0}</div>
                  </div>
                  {stats.completionStats?.dropoutByStep?.length > 0 && (
                    <div className="space-y-1.5">
                      <p className="text-[10px] text-gray-400">Dropout by step</p>
                      {stats.completionStats.dropoutByStep.map(d => (
                        <div key={d.flow_step} className="flex items-center gap-2">
                          <span className="text-[10px] text-gray-500 w-20">{STEP_LABELS[d.flow_step] ?? `Step ${d.flow_step}`}</span>
                          <div className="flex-1 h-1.5 bg-gray-100 rounded-full overflow-hidden">
                            <div className="h-full bg-red-300 rounded-full" style={{ width: `${Math.min((d.count / Math.max(stats.completionStats.totalChats, 1)) * 100, 100)}%` }} />
                          </div>
                          <span className="text-[10px] text-gray-500 w-6 text-right">{d.count}</span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            </div>

            {/* Trend section (formerly Trends tab) */}
            {trends && (
              <div className="bg-white rounded-2xl border border-gray-100 shadow-sm">
                <div className="flex items-center justify-between px-5 pt-5">
                  <h3 className="font-semibold text-gray-800 text-sm">Activity over time (30 days)</h3>
                  <span className="text-[10px] text-gray-400">Tap a chart for hover detail</span>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5 p-5">
                  <SparkLine data={trends.volumeTrend} valueKey="message_count" label="Messages per day" stroke="#7c3aed" fill="#7c3aed1a" format={v => v.toFixed(0)} />
                  <SparkLine data={trends.volumeTrend} valueKey="session_count" label="Sessions per day" stroke="#0d9488" fill="#0d94881a" format={v => v.toFixed(0)} />
                  <SparkLine data={trends.traceTrend} valueKey="request_count" label="LLM requests per day" stroke="#f59e0b" fill="#f59e0b1a" format={v => v.toFixed(0)} />
                  <SparkLine data={trends.traceTrend} valueKey="daily_cost" label="Daily LLM cost ($)" stroke="#ef4444" fill="#ef44441a" format={v => `$${v.toFixed(2)}`} />
                  <SparkLine data={trends.traceTrend} valueKey="avg_latency" label="Avg latency (ms)" stroke="#3b82f6" fill="#3b82f61a" format={v => `${v.toFixed(0)}ms`} />
                  <SparkLine data={trends.evalTrend} valueKey="avg_tone" label="Avg tone (/5)" stroke="#10b981" fill="#10b9811a" format={v => v.toFixed(2)} />
                  <SparkLine data={trends.evalTrend} valueKey="safety_rate" label="Safety pass rate" stroke="#16a34a" fill="#16a34a1a" format={v => `${(v * 100).toFixed(0)}%`} />
                  <SparkLine data={trends.evalTrend} valueKey="flow_rate" label="Flow compliance" stroke="#8b5cf6" fill="#8b5cf61a" format={v => `${(v * 100).toFixed(0)}%`} />
                  <SparkLine data={trends.traceTrend} valueKey="avg_rag_similarity" label="Avg RAG similarity" stroke="#14b8a6" fill="#14b8a61a" format={v => v.toFixed(3)} />
                </div>
              </div>
            )}

            {/* Derived insights */}
            {trends && (() => {
              const v = trends.volumeTrend;
              const cost = trends.traceTrend;
              const evals = trends.evalTrend;
              const sumN = (arr: any[], k: string, n: number) => arr.slice(-n).reduce((a, b) => a + (Number(b[k]) || 0), 0);
              const avgN = (arr: any[], k: string, n: number) => {
                const slice = arr.slice(-n).filter(d => d[k] != null);
                if (!slice.length) return 0;
                return slice.reduce((a, b) => a + Number(b[k]), 0) / slice.length;
              };
              const msgWeek = sumN(v, 'message_count', 7);
              const msgPrev = v.length >= 14 ? v.slice(-14, -7).reduce((a, b) => a + (Number(b.message_count) || 0), 0) : 0;
              const wow = msgPrev > 0 ? ((msgWeek - msgPrev) / msgPrev) * 100 : 0;
              const cost7 = sumN(cost, 'daily_cost', 7);
              const costPerSession = (() => {
                const s7 = sumN(v, 'session_count', 7);
                return s7 > 0 ? cost7 / s7 : 0;
              })();
              const tone7 = avgN(evals, 'avg_tone', 7);
              const safety7 = avgN(evals, 'safety_rate', 7);
              const risksTotal = stats.traceStats?.total_risk_events ?? 0;
              const flaggedCount = stats.flaggedResponses?.length ?? 0;
              return (
                <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
                  <InsightBadge label="Msgs (7d)" value={msgWeek.toString()} hint={`${wow >= 0 ? '+' : ''}${wow.toFixed(0)}% vs prev wk`} tone={wow >= 0 ? 'good' : 'bad'} />
                  <InsightBadge label="Cost (7d)" value={`$${cost7.toFixed(2)}`} hint={`$${costPerSession.toFixed(3)} / session`} />
                  <InsightBadge label="Avg tone (7d)" value={`${tone7.toFixed(2)}/5`} tone={tone7 >= 4 ? 'good' : tone7 >= 3 ? 'neutral' : 'bad'} />
                  <InsightBadge label="Safety (7d)" value={`${(safety7 * 100).toFixed(0)}%`} tone={safety7 >= 0.95 ? 'good' : safety7 >= 0.8 ? 'neutral' : 'bad'} />
                  <InsightBadge label="Risk events" value={risksTotal.toString()} tone={risksTotal === 0 ? 'good' : 'bad'} hint="lifetime" />
                  <InsightBadge label="Flagged in QA" value={flaggedCount.toString()} tone={flaggedCount === 0 ? 'good' : 'bad'} />
                </div>
              );
            })()}
          </div>
        )}

        {tab === 'overview' && !stats && (
          <div className="flex items-center justify-center py-20">
            <div className="w-8 h-8 border-2 border-brand-purple/30 border-t-brand-purple rounded-full animate-spin" />
          </div>
        )}

        {/* ═══════════════════ QA REVIEW ═══════════════════ */}
        {tab === 'qa' && (
          <div className="space-y-6">
            {/* Flagged responses */}
            {stats?.flaggedResponses && stats.flaggedResponses.length > 0 && (
              <div>
                <h3 className="font-semibold text-gray-800 text-sm mb-3 flex items-center gap-2">
                  Needs Review
                  <span className="px-1.5 py-0.5 rounded-full bg-red-100 text-red-600 text-[10px] font-bold">{stats.flaggedResponses.length}</span>
                </h3>
                <div className="space-y-3">
                  {stats.flaggedResponses.map((f: any) => (
                    <div key={f.id} className="bg-white rounded-2xl p-4 border border-red-100 shadow-sm">
                      <div className="flex items-start justify-between gap-4">
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 flex-wrap mb-2">
                            {f.safety_pass === 0 && <span className="px-1.5 py-0.5 rounded bg-red-100 text-red-600 text-[10px] font-bold">SAFETY FAIL</span>}
                            {f.flow_compliance === 0 && <span className="px-1.5 py-0.5 rounded bg-amber-100 text-amber-600 text-[10px] font-bold">FLOW FAIL</span>}
                            {f.contextual_relevance === 0 && <span className="px-1.5 py-0.5 rounded bg-amber-100 text-amber-600 text-[10px] font-bold">IRRELEVANT</span>}
                            {f.tone_score != null && f.tone_score <= 2 && <span className="px-1.5 py-0.5 rounded bg-orange-100 text-orange-600 text-[10px] font-bold">LOW TONE ({f.tone_score}/5)</span>}
                            <span className="text-[10px] text-gray-400">Step {f.flow_step} &middot; {new Date(f.created_at).toLocaleString()}</span>
                          </div>
                          {f.user_message && (
                            <p className="text-xs text-gray-500 mb-1"><span className="font-medium">User:</span> {f.user_message}</p>
                          )}
                          <p className="text-sm text-gray-800 bg-gray-50 rounded-xl px-3 py-2">{f.ai_message}</p>
                          {f.eval_reasoning && <p className="text-[10px] text-gray-400 mt-1 italic">{f.eval_reasoning}</p>}
                        </div>
                        <button onClick={() => dismissFlagged(f.id)} className="text-xs text-gray-400 hover:text-gray-600 flex-shrink-0">Dismiss</button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Session list or conversation detail */}
            {selectedChat ? (
              <div>
                <button onClick={() => { setSelectedChat(null); setSelectedChatId(null); }} className="text-sm text-brand-purple hover:underline mb-3">&larr; Back to sessions</button>
                <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5">
                  <h3 className="font-semibold text-gray-800 text-sm mb-4">Conversation {selectedChatId?.slice(0, 8)}</h3>
                  <div className="space-y-3">
                    {selectedChat.map((m: any) => (
                      <div key={m.message_id} className={`flex gap-3 ${m.role === 'assistant' ? '' : 'flex-row-reverse'}`}>
                        <div className={`max-w-[75%] ${m.role === 'assistant' ? 'bg-gray-50' : 'bg-brand-purple-pale'} rounded-2xl px-4 py-3`}>
                          <div className="flex items-center gap-2 mb-1">
                            <span className="text-[10px] font-medium text-gray-500">{m.role === 'user' ? 'User' : 'Coach'}</span>
                            {m.flow_step != null && <span className="text-[10px] text-gray-400">Step {m.flow_step}</span>}
                          </div>
                          <p className="text-sm text-gray-800">{m.content}</p>
                          {/* Inline eval scores for assistant messages */}
                          {m.role === 'assistant' && m.tone_score != null && (
                            <div className="mt-2 pt-2 border-t border-gray-200/50 flex items-center gap-2 flex-wrap">
                              <span className={`px-1.5 py-0.5 rounded text-[10px] font-medium ${toneBg(m.tone_score)}`}>Tone {m.tone_score}/5</span>
                              {m.safety_pass === 0 && <span className="px-1.5 py-0.5 rounded bg-red-100 text-red-600 text-[10px] font-bold">SAFETY FAIL</span>}
                              {m.safety_pass === 1 && <span className="px-1.5 py-0.5 rounded bg-green-50 text-green-600 text-[10px]">Safe</span>}
                              {m.flow_compliance === 0 && <span className="px-1.5 py-0.5 rounded bg-amber-100 text-amber-600 text-[10px]">Flow fail</span>}
                              {m.length_compliance === 0 && <span className="px-1.5 py-0.5 rounded bg-amber-100 text-amber-600 text-[10px]">Length fail</span>}
                              {m.contextual_relevance === 0 && <span className="px-1.5 py-0.5 rounded bg-amber-100 text-amber-600 text-[10px]">Irrelevant</span>}
                              {m.eval_reasoning && (
                                <span className="text-[10px] text-gray-400 italic">{m.eval_reasoning}</span>
                              )}
                            </div>
                          )}
                          {m.role === 'assistant' && m.eval_error && (
                            <div className="mt-1 text-[10px] text-red-400">Eval error: {m.eval_error}</div>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            ) : (
              <div>
                <div className="flex items-center justify-between mb-3">
                  <h3 className="font-semibold text-gray-800 text-sm">Sessions</h3>
                  <button onClick={() => exportCsv('sessions')} className="text-[10px] text-brand-purple hover:underline">Export CSV</button>
                </div>
                <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead className="bg-gray-50 border-b border-gray-100">
                        <tr>
                          {['User', 'Date', 'Status', 'Messages', 'Avg Tone', 'Issues', ''].map(h => (
                            <th key={h} className="px-4 py-3 text-left text-xs font-medium text-gray-500">{h}</th>
                          ))}
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-gray-50">
                        {sessions.map((s: any) => (
                          <tr key={s.chat_id} className="hover:bg-gray-50 cursor-pointer" onClick={() => loadConversation(s.chat_id)}>
                            <td className="px-4 py-3 text-xs font-medium text-gray-900">{s.username}</td>
                            <td className="px-4 py-3 text-xs text-gray-500">{new Date(s.created_at).toLocaleString()}</td>
                            <td className="px-4 py-3">
                              <span className={`px-2 py-0.5 rounded-full text-[10px] font-medium ${s.completed ? 'bg-green-50 text-green-600' : 'bg-amber-50 text-amber-600'}`}>
                                {s.completed ? 'Complete' : `Step ${s.flow_step}`}
                              </span>
                            </td>
                            <td className="px-4 py-3 text-xs text-gray-600">{s.message_count}</td>
                            <td className="px-4 py-3">
                              {s.avg_tone != null ? (
                                <span className={`text-xs font-semibold ${s.avg_tone >= 4 ? 'text-green-600' : s.avg_tone >= 3 ? 'text-amber-500' : 'text-red-500'}`}>
                                  {s.avg_tone.toFixed(1)}
                                </span>
                              ) : <span className="text-xs text-gray-300">--</span>}
                            </td>
                            <td className="px-4 py-3">
                              <div className="flex gap-1">
                                {s.safety_fails > 0 && <span className="px-1.5 py-0.5 rounded bg-red-100 text-red-600 text-[10px] font-bold">{s.safety_fails} safety</span>}
                                {s.flow_fails > 0 && <span className="px-1.5 py-0.5 rounded bg-amber-100 text-amber-600 text-[10px]">{s.flow_fails} flow</span>}
                                {s.relevance_fails > 0 && <span className="px-1.5 py-0.5 rounded bg-amber-100 text-amber-600 text-[10px]">{s.relevance_fails} rel</span>}
                                {!s.safety_fails && !s.flow_fails && !s.relevance_fails && <span className="text-[10px] text-gray-300">--</span>}
                              </div>
                            </td>
                            <td className="px-4 py-3 text-xs text-brand-purple">View &rarr;</td>
                          </tr>
                        ))}
                        {sessions.length === 0 && (
                          <tr><td colSpan={7} className="px-4 py-12 text-center text-sm text-gray-400">No sessions found</td></tr>
                        )}
                      </tbody>
                    </table>
                  </div>
                </div>
              </div>
            )}
          </div>
        )}

        {/* ═══════════════════ EVALUATIONS ═══════════════════ */}
        {tab === 'evals' && stats && (
          <div className="space-y-6">
            {/* Per-step heatmap */}
            {stats.evalByStep?.length > 0 && (
              <div className="bg-white rounded-2xl p-5 border border-gray-100 shadow-sm">
                <h3 className="font-semibold text-gray-800 text-sm mb-4">Quality by Step</h3>
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr>
                        <th className="px-3 py-2 text-left text-xs font-medium text-gray-500">Dimension</th>
                        {stats.evalByStep.map(s => (
                          <th key={s.flow_step} className="px-3 py-2 text-center text-xs font-medium text-gray-500">
                            {STEP_LABELS[s.flow_step] ?? `Step ${s.flow_step}`}
                            <div className="text-[10px] text-gray-400 font-normal">n={s.eval_count}</div>
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {[
                        { label: 'Tone (avg)', key: 'avg_tone', isTone: true },
                        { label: 'Flow compliance', key: 'flow_compliance_rate' },
                        { label: 'Length compliance', key: 'length_compliance_rate' },
                        { label: 'Safety pass', key: 'safety_pass_rate' },
                        { label: 'Contextual relevance', key: 'contextual_relevance_rate' },
                      ].map(dim => (
                        <tr key={dim.key}>
                          <td className="px-3 py-2 text-xs text-gray-600">{dim.label}</td>
                          {stats.evalByStep.map(s => {
                            const val = (s as any)[dim.key] ?? 0;
                            const display = dim.isTone ? `${val.toFixed(1)}/5` : pct(val);
                            const bg = dim.isTone ? toneBg(val) : heatBg(val);
                            return (
                              <td key={s.flow_step} className="px-3 py-2 text-center">
                                <span className={`px-2.5 py-1 rounded-lg text-xs font-semibold ${bg}`}>{display}</span>
                              </td>
                            );
                          })}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            {/* Eval table */}
            <div className="flex items-center justify-between">
              <h3 className="font-semibold text-gray-800 text-sm">Recent Evaluations</h3>
              <button onClick={() => exportCsv('evals')} className="text-[10px] text-brand-purple hover:underline">Export CSV</button>
            </div>
            <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="bg-gray-50 border-b border-gray-100">
                    <tr>
                      {['Time', 'Tone', 'Flow', 'Length', 'Safety', 'Relevance', 'Reasoning'].map(h => (
                        <th key={h} className="px-4 py-3 text-left text-xs font-medium text-gray-500">{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-50">
                    {stats.recentEvals.map((e: any) => (
                      <tr key={e.id} className={`hover:bg-gray-50 ${e.error ? 'bg-red-50/30' : ''}`}>
                        <td className="px-4 py-3 text-xs text-gray-500">{new Date(e.created_at).toLocaleString()}</td>
                        <td className="px-4 py-3">
                          {e.tone_score != null ? (
                            <div className="flex items-center gap-1">
                              {Array.from({ length: 5 }).map((_, i) => (
                                <div key={i} className={`w-2 h-2 rounded-full ${i < e.tone_score ? 'bg-brand-purple' : 'bg-gray-200'}`} />
                              ))}
                              <span className="text-xs text-gray-500 ml-1">{e.tone_score}/5</span>
                            </div>
                          ) : <span className="text-xs text-red-400">Error</span>}
                        </td>
                        <td className="px-4 py-3">{e.flow_compliance != null ? (e.flow_compliance ? <span className="text-green-500 text-xs">Pass</span> : <span className="text-red-400 text-xs">Fail</span>) : '--'}</td>
                        <td className="px-4 py-3">{e.length_compliance != null ? (e.length_compliance ? <span className="text-green-500 text-xs">Pass</span> : <span className="text-red-400 text-xs">Fail</span>) : '--'}</td>
                        <td className="px-4 py-3">{e.safety_pass != null ? (e.safety_pass ? <span className="text-green-500 text-xs">Pass</span> : <span className="text-red-400 text-xs font-bold">FAIL</span>) : '--'}</td>
                        <td className="px-4 py-3">{e.contextual_relevance != null ? (e.contextual_relevance ? <span className="text-green-500 text-xs">Pass</span> : <span className="text-red-400 text-xs">Fail</span>) : '--'}</td>
                        <td className="px-4 py-3 text-xs text-gray-500 max-w-xs truncate">{e.error || e.eval_reasoning}</td>
                      </tr>
                    ))}
                    {stats.recentEvals.length === 0 && (
                      <tr><td colSpan={7} className="px-4 py-12 text-center text-sm text-gray-400">No evaluations yet</td></tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}

        {/* ═══════════════════ LLM TRACES ═══════════════════ */}
        {tab === 'traces' && stats && (
          <div>
            <div className="flex items-center justify-between mb-3">
              <h3 className="font-semibold text-gray-800 text-sm">LLM Traces</h3>
              <button onClick={() => exportCsv('traces')} className="text-[10px] text-brand-purple hover:underline">Export CSV</button>
            </div>
            <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="bg-gray-50 border-b border-gray-100">
                    <tr>
                      {['Time', 'Step', 'Model', 'Latency', 'Tokens in', 'Tokens out', 'Cost', 'RAG sim', 'Risk'].map(h => (
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
                        <td className="px-4 py-3 text-xs text-gray-600">{t.rag_top_similarity != null ? t.rag_top_similarity.toFixed(3) : '--'}</td>
                        <td className="px-4 py-3">{t.risk_triggered ? <span className="text-red-500 text-xs font-semibold">Yes</span> : <span className="text-gray-300 text-xs">--</span>}</td>
                      </tr>
                    ))}
                    {stats.recentTraces.length === 0 && (
                      <tr><td colSpan={9} className="px-4 py-12 text-center text-sm text-gray-400">No traces yet</td></tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}

        {/* ═══════════════════ USERS ═══════════════════ */}
        {tab === 'users' && (
          <div className="space-y-4">
            <div className="bg-white rounded-2xl p-5 border border-gray-100 shadow-sm">
              <h3 className="font-semibold text-gray-800 mb-4 text-sm">Create user</h3>
              <div className="flex gap-2 flex-wrap">
                <input value={newUsername} onChange={e => setNewUsername(e.target.value)} placeholder="Username"
                  className="flex-1 min-w-32 px-3 py-2 rounded-xl border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-brand-purple/30" />
                <input type="password" value={newPassword} onChange={e => setNewPassword(e.target.value)} placeholder="Password"
                  className="flex-1 min-w-32 px-3 py-2 rounded-xl border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-brand-purple/30" />
                <button onClick={createUser} disabled={creating || !newUsername || !newPassword}
                  className="px-4 py-2 rounded-xl bg-brand-purple text-white text-sm font-medium hover:bg-brand-purple-light disabled:opacity-50 transition-all">
                  {creating ? 'Creating...' : 'Create'}
                </button>
              </div>
              {error && <p className="text-red-500 text-xs mt-2">{error}</p>}
            </div>

            {/* User analytics table */}
            <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="bg-gray-50 border-b border-gray-100">
                    <tr>
                      {['Username', 'Sessions', 'Completed', 'Avg Tone', 'Safety Fails', 'Cost', 'Last Active', 'Actions'].map(h => (
                        <th key={h} className="px-4 py-3 text-left text-xs font-medium text-gray-500">{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-50">
                    {(userAnalytics.length > 0 ? userAnalytics : users.filter(u => !u.is_admin).map(u => ({
                      id: u.id, username: u.username, joined_at: u.created_at,
                      total_sessions: 0, completed_sessions: 0, total_cost: 0, avg_tone: 0, safety_fails: 0, last_active: u.created_at,
                    }))).map((u: any) => {
                      const completionRate = u.total_sessions > 0 ? u.completed_sessions / u.total_sessions : 0;
                      return (
                        <tr key={u.id} className="hover:bg-gray-50">
                          <td className="px-4 py-3 font-medium text-gray-900">{u.username}</td>
                          <td className="px-4 py-3 text-xs text-gray-600">{u.total_sessions}</td>
                          <td className="px-4 py-3">
                            <span className={`text-xs font-semibold ${completionRate >= 0.7 ? 'text-green-600' : completionRate >= 0.4 ? 'text-amber-500' : 'text-gray-400'}`}>
                              {u.completed_sessions}/{u.total_sessions} ({pct(completionRate)})
                            </span>
                          </td>
                          <td className="px-4 py-3">
                            {u.avg_tone ? (
                              <span className={`text-xs font-semibold ${u.avg_tone >= 4 ? 'text-green-600' : u.avg_tone >= 3 ? 'text-amber-500' : 'text-red-500'}`}>
                                {u.avg_tone.toFixed(1)}
                              </span>
                            ) : <span className="text-xs text-gray-300">--</span>}
                          </td>
                          <td className="px-4 py-3">
                            {u.safety_fails > 0 ? (
                              <span className="text-xs font-bold text-red-500">{u.safety_fails}</span>
                            ) : <span className="text-xs text-gray-300">0</span>}
                          </td>
                          <td className="px-4 py-3 text-xs text-gray-600">${(u.total_cost ?? 0).toFixed(4)}</td>
                          <td className="px-4 py-3 text-xs text-gray-500">{u.last_active ? new Date(u.last_active).toLocaleDateString() : '--'}</td>
                          <td className="px-4 py-3">
                            <button onClick={() => deleteUser(u.id)} className="text-xs text-red-400 hover:text-red-600">Delete</button>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}

        {/* ═══════════════════ RAG CONTENT ═══════════════════ */}
        {tab === 'rag' && (
          <div className="space-y-4">
            <div className="bg-white rounded-2xl p-5 border border-gray-100 shadow-sm">
              <h3 className="font-semibold text-gray-800 mb-4 text-sm">Add document to RAG</h3>
              <div className="space-y-3">
                <div className="flex gap-2">
                  <input value={ragTitle} onChange={e => setRagTitle(e.target.value)} placeholder="Document title (e.g. Energy Management Module)"
                    className="flex-1 px-3 py-2 rounded-xl border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-brand-purple/30" />
                  <input value={ragSource} onChange={e => setRagSource(e.target.value)} placeholder="Source key (e.g. energy-management)"
                    className="flex-1 px-3 py-2 rounded-xl border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-brand-purple/30" />
                </div>
                <textarea value={ragContent} onChange={e => setRagContent(e.target.value)} placeholder="Paste the document content here..." rows={8}
                  className="w-full px-3 py-2 rounded-xl border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-brand-purple/30 resize-none font-mono" />
                {ragError && <p className="text-red-500 text-xs">{ragError}</p>}
                <button onClick={ingestDocument} disabled={ragLoading || !ragTitle || !ragSource || !ragContent}
                  className="px-4 py-2 rounded-xl bg-brand-purple text-white text-sm font-medium hover:bg-brand-purple-light disabled:opacity-50 transition-all">
                  {ragLoading ? 'Ingesting...' : 'Ingest document'}
                </button>
              </div>
            </div>
            <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
              {ragDocs.length === 0 ? (
                <div className="text-center py-12 text-gray-400 text-sm">
                  No documents ingested yet.<br />
                  <span className="text-xs">Add Untire Now app content above to ground the AI responses.</span>
                </div>
              ) : (
                <table className="w-full text-sm">
                  <thead className="bg-gray-50 border-b border-gray-100">
                    <tr>
                      {['Title', 'Source', 'Chunks', 'Added', 'Actions'].map(h => (
                        <th key={h} className="px-4 py-3 text-left text-xs font-medium text-gray-500">{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-50">
                    {ragDocs.map((doc: any) => (
                      <tr key={doc.source} className="hover:bg-gray-50">
                        <td className="px-4 py-3 font-medium text-gray-900">{doc.title}</td>
                        <td className="px-4 py-3 text-xs text-gray-500 font-mono">{doc.source}</td>
                        <td className="px-4 py-3">
                          <span className="px-2 py-0.5 rounded-full bg-brand-purple-pale text-brand-purple text-xs font-medium">{doc.chunkCount} chunks</span>
                        </td>
                        <td className="px-4 py-3 text-xs text-gray-500">{new Date(doc.createdAt).toLocaleDateString()}</td>
                        <td className="px-4 py-3">
                          <button onClick={() => deleteRagDoc(doc.source)} className="text-xs text-red-400 hover:text-red-600">Delete</button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>
          </div>
        )}

        {/* ═══════════════════ SETTINGS ═══════════════════ */}
        {tab === 'settings' && (
          <div className="space-y-6 max-w-3xl">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="font-semibold text-gray-800 text-sm">App settings</h3>
                <p className="text-xs text-gray-500 mt-0.5">Tune both apps without touching the code. Changes apply immediately.</p>
              </div>
              <div className="flex items-center gap-3">
                {settingsSaved && <span className="text-xs text-green-600 font-medium">Saved ✓</span>}
                <button
                  onClick={saveSettings}
                  disabled={settingsSaving || settingDefs.length === 0}
                  className="px-4 py-2 rounded-xl bg-brand-purple text-white text-sm font-medium disabled:opacity-60 hover:bg-brand-purple-light transition-colors"
                >
                  {settingsSaving ? 'Saving…' : 'Save changes'}
                </button>
              </div>
            </div>

            {settingDefs.length === 0 ? (
              <div className="flex items-center justify-center py-20">
                <div className="w-8 h-8 border-2 border-brand-purple/30 border-t-brand-purple rounded-full animate-spin" />
              </div>
            ) : (
              ['general', 'coach', 'recommender'].map(group => {
                const groupDefs = settingDefs.filter(d => d.group === group);
                if (!groupDefs.length) return null;
                const groupLabel = group === 'general' ? 'General' : group === 'coach' ? 'Untire Coach' : 'Theme Recommender';
                return (
                  <div key={group} className="bg-white rounded-2xl p-5 border border-gray-100 shadow-sm space-y-4">
                    <h4 className="font-semibold text-gray-800 text-sm pb-2 border-b border-gray-100">{groupLabel}</h4>
                    {groupDefs.map(def => {
                      const val = settingValues[def.key] ?? String(def.default);
                      const setVal = (v: string) => setSettingValues(s => ({ ...s, [def.key]: v }));
                      return (
                        <div key={def.key} className="grid grid-cols-1 sm:grid-cols-3 gap-3 items-start">
                          <div>
                            <label className="block text-xs font-medium text-gray-700">{def.label}</label>
                            {def.description && <p className="text-[10px] text-gray-400 mt-0.5">{def.description}</p>}
                            <p className="text-[10px] text-gray-300 mt-0.5 font-mono">{def.key}</p>
                          </div>
                          <div className="sm:col-span-2">
                            {def.type === 'boolean' && (
                              <label className="inline-flex items-center gap-2 cursor-pointer">
                                <input
                                  type="checkbox"
                                  checked={val === 'true'}
                                  onChange={e => setVal(e.target.checked ? 'true' : 'false')}
                                  className="w-4 h-4 rounded border-gray-300 text-brand-purple focus:ring-brand-purple/30"
                                />
                                <span className="text-xs text-gray-600">{val === 'true' ? 'Enabled' : 'Disabled'}</span>
                              </label>
                            )}
                            {def.type === 'enum' && (
                              <select
                                value={val}
                                onChange={e => setVal(e.target.value)}
                                className="w-full sm:w-64 px-3 py-2 rounded-lg border border-gray-200 bg-white text-sm focus:outline-none focus:ring-2 focus:ring-brand-purple/30"
                              >
                                {def.options?.map(o => (
                                  <option key={o.value} value={o.value}>{o.label}</option>
                                ))}
                              </select>
                            )}
                            {def.type === 'number' && (
                              <input
                                type="number"
                                value={val}
                                min={def.min}
                                max={def.max}
                                step={def.step}
                                onChange={e => setVal(e.target.value)}
                                className="w-full sm:w-32 px-3 py-2 rounded-lg border border-gray-200 bg-white text-sm focus:outline-none focus:ring-2 focus:ring-brand-purple/30"
                              />
                            )}
                            {def.type === 'string' && (
                              <input
                                type="text"
                                value={val}
                                onChange={e => setVal(e.target.value)}
                                className="w-full px-3 py-2 rounded-lg border border-gray-200 bg-white text-sm focus:outline-none focus:ring-2 focus:ring-brand-purple/30"
                              />
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                );
              })
            )}

            <p className="text-[10px] text-gray-400">
              Coach settings are applied to <strong>new</strong> users; existing users keep their own preferences until they reset.
              Recommender settings apply on the next request.
            </p>
          </div>
        )}
      </main>
    </div>
  );
}
