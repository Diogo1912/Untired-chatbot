'use client';

import { useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import Logo from '@/components/Logo';

interface TagDef { id: string; labelNl: string; labelEn: string }
interface TagCatalog {
  energyIn: TagDef[];
  energyCosts: TagDef[];
  energyLeaks: TagDef[];
}
interface Recommendation {
  themeId: string;
  nameNl: string;
  nameEn: string;
  score: number;
  rationale: string;
  matchedSignals: string[];
}
interface RecommenderResult {
  recommendations: Recommendation[];
  fallbackUsed: boolean;
  engineVersion: string;
  language: 'nl' | 'en';
  mode?: 'rules' | 'ai';
  aiMessage?: string;
  aiModel?: string;
  aiLatencyMs?: number;
  aiCostUsd?: number;
}
type Mode = 'rules' | 'ai';

const STRINGS = {
  nl: {
    title: 'Thema-aanbeveler',
    subtitle: 'Op basis van wat je deelt, krijg je een paar thema’s uit de app om mee te beginnen.',
    name: 'Voornaam',
    fatigue: 'Vermoeidheid',
    happiness: 'Geluk',
    energy: 'Energie',
    nowScore: 'Nu',
    acceptable: 'Acceptabel',
    desired: 'Gewenst',
    goal: 'Gekozen doel',
    goalProgress: 'Voortgang doel',
    energyIn: 'Wat geeft je energie',
    energyCosts: 'Wat kost je energie',
    energyLeaks: 'Energielekken',
    cta: 'Toon aanbevelingen',
    loading: 'Bezig...',
    fallback: 'Geen sterke match gevonden — begin met de Introductie.',
    matched: 'Signalen die meewogen',
    seedExample: 'Voorbeeld invullen (Erik)',
    reset: 'Leegmaken',
    score: 'Score',
    modeLabel: 'Modus',
    modeRules: 'Regels',
    modeAi: 'AI',
    modeRulesHint: 'Deterministisch, regels in een vast bestand',
    modeAiHint: 'Licht model met persoonlijk bericht',
    aiMessageLabel: 'Persoonlijk bericht',
    aiDisclaimer: 'Gegenereerd door AI ter vergelijking — geen medisch advies.',
    aiUnavailable: 'AI-modus is uitgeschakeld door de beheerder.',
    error: 'Er ging iets mis. Probeer opnieuw.',
  },
  en: {
    title: 'Theme recommender',
    subtitle: 'Based on what you share, you’ll get a few in-app themes to start with.',
    name: 'First name',
    fatigue: 'Fatigue',
    happiness: 'Happiness',
    energy: 'Energy',
    nowScore: 'Now',
    acceptable: 'Acceptable',
    desired: 'Desired',
    goal: 'Chosen goal',
    goalProgress: 'Goal progress',
    energyIn: 'Energy IN',
    energyCosts: 'Energy costs',
    energyLeaks: 'Energy leaks',
    cta: 'Show recommendations',
    loading: 'Working...',
    fallback: 'No strong match — start with the Introduction.',
    matched: 'Signals that contributed',
    seedExample: 'Fill example (Erik)',
    reset: 'Clear',
    score: 'Score',
    modeLabel: 'Mode',
    modeRules: 'Rules',
    modeAi: 'AI',
    modeRulesHint: 'Deterministic, rules in a static file',
    modeAiHint: 'Light model with a personal message',
    aiMessageLabel: 'Personal note',
    aiDisclaimer: 'AI-generated for comparison — not medical advice.',
    aiUnavailable: 'AI mode is disabled by the admin.',
    error: 'Something went wrong. Try again.',
  },
} as const;

const EXAMPLE = {
  firstName: 'Erik',
  fatigueScore: 8, fatigueAcceptable: 5, fatigueDesired: 3,
  happinessScore: 4, happinessAcceptable: 6, happinessDesired: 7,
  energyScore: 30, energyAcceptable: 50, energyDesired: 80,
  chosenGoal: 'Retain more energy after work',
  goalProgress: 2,
  energyIn: ['being_outside'],
  energyCosts: ['caring_for_others', 'too_much_to_do'],
  energyLeaks: ['no_time_for_myself'],
};

const EMPTY: typeof EXAMPLE = {
  firstName: '',
  fatigueScore: 0, fatigueAcceptable: 0, fatigueDesired: 0,
  happinessScore: 0, happinessAcceptable: 0, happinessDesired: 0,
  energyScore: 0, energyAcceptable: 0, energyDesired: 0,
  chosenGoal: '',
  goalProgress: 0,
  energyIn: [],
  energyCosts: [],
  energyLeaks: [],
};

export default function RecommenderPage() {
  const router = useRouter();
  const [language, setLanguage] = useState<'nl' | 'en'>('nl');
  const [catalog, setCatalog] = useState<TagCatalog | null>(null);
  const [form, setForm] = useState({ ...EXAMPLE });
  const [result, setResult] = useState<RecommenderResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [authChecked, setAuthChecked] = useState(false);
  const [mode, setMode] = useState<Mode>('rules');
  const [aiEnabled, setAiEnabled] = useState(false);
  const [aiModel, setAiModel] = useState<string>('');
  const [errorMsg, setErrorMsg] = useState<string>('');

  const t = STRINGS[language];

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const res = await fetch('/api/recommend');
      if (res.status === 401) { router.replace('/'); return; }
      const data = await res.json();
      if (!cancelled) {
        setCatalog(data.tagCatalog);
        setAiEnabled(!!data.aiEnabled);
        setAiModel(data.aiModel ?? '');
        setAuthChecked(true);
      }
    })();
    return () => { cancelled = true; };
  }, [router]);

  function toggle(field: 'energyIn' | 'energyCosts' | 'energyLeaks', tagId: string) {
    setForm(f => {
      const set = new Set(f[field]);
      if (set.has(tagId)) set.delete(tagId); else set.add(tagId);
      return { ...f, [field]: Array.from(set) };
    });
  }

  function setNum(field: keyof typeof EXAMPLE, value: string) {
    const n = Number(value);
    setForm(f => ({ ...f, [field]: Number.isFinite(n) ? n : 0 } as any));
  }

  async function submit() {
    setLoading(true);
    setResult(null);
    setErrorMsg('');
    try {
      const res = await fetch('/api/recommend', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...form, language, mode }),
      });
      const data = await res.json();
      if (!res.ok) {
        setErrorMsg(data?.error ?? t.error);
        return;
      }
      setResult(data);
    } catch {
      setErrorMsg(t.error);
    } finally {
      setLoading(false);
    }
  }

  const sections = useMemo(() => catalog ? [
    { key: 'energyIn', label: t.energyIn, defs: catalog.energyIn },
    { key: 'energyCosts', label: t.energyCosts, defs: catalog.energyCosts },
    { key: 'energyLeaks', label: t.energyLeaks, defs: catalog.energyLeaks },
  ] as const : [], [catalog, t]);

  if (!authChecked) {
    return <div className="min-h-screen flex items-center justify-center text-gray-500">…</div>;
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-brand-purple-pale via-white to-brand-teal/10 p-4 sm:p-8">
      <div className="max-w-5xl mx-auto">
        <header className="flex items-center justify-between mb-6">
          <div>
            <button onClick={() => router.push('/hub')} className="flex items-center gap-2 mb-3 hover:opacity-80 transition-opacity">
              <Logo size={32} />
              <span className="text-sm font-semibold text-gray-800">Tired of Cancer</span>
              <span className="text-sm text-brand-purple">← {language === 'nl' ? 'Andere app' : 'Switch app'}</span>
            </button>
            <h1 className="text-2xl font-semibold text-gray-900">{t.title}</h1>
            <p className="text-sm text-gray-500 mt-1">{t.subtitle}</p>
          </div>
          <div className="flex gap-2">
            <button onClick={() => setLanguage('nl')} className={`px-3 py-1.5 rounded-lg text-sm ${language === 'nl' ? 'bg-brand-purple text-white' : 'bg-white border border-gray-200 text-gray-700'}`}>NL</button>
            <button onClick={() => setLanguage('en')} className={`px-3 py-1.5 rounded-lg text-sm ${language === 'en' ? 'bg-brand-purple text-white' : 'bg-white border border-gray-200 text-gray-700'}`}>EN</button>
          </div>
        </header>

        {/* Mode switcher — prominent, visible above both columns */}
        <div className="bg-white rounded-2xl shadow-md shadow-gray-200/60 p-2 mb-5 inline-flex items-center gap-1 border border-gray-100">
          <span className="text-[10px] uppercase tracking-wider text-gray-400 px-2">{t.modeLabel}</span>
          <button
            onClick={() => { setMode('rules'); setResult(null); }}
            className={`px-4 py-2 rounded-xl text-sm font-medium transition-all flex items-center gap-2 ${
              mode === 'rules' ? 'bg-brand-purple text-white shadow-md shadow-brand-purple/20' : 'text-gray-600 hover:bg-gray-50'
            }`}
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M4 6h16M4 10h16M4 14h10M4 18h6" />
            </svg>
            {t.modeRules}
          </button>
          <button
            onClick={() => { if (aiEnabled) { setMode('ai'); setResult(null); } }}
            disabled={!aiEnabled}
            title={aiEnabled ? undefined : t.aiUnavailable}
            className={`px-4 py-2 rounded-xl text-sm font-medium transition-all flex items-center gap-2 ${
              mode === 'ai' ? 'bg-brand-teal text-white shadow-md shadow-brand-teal/20'
              : aiEnabled ? 'text-gray-600 hover:bg-gray-50'
              : 'text-gray-300 cursor-not-allowed'
            }`}
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M13 10V3L4 14h7v7l9-11h-7z" />
            </svg>
            {t.modeAi}
            {aiEnabled && aiModel && mode === 'ai' && (
              <span className="text-[10px] opacity-80 font-mono ml-1">{aiModel.split('/').pop()}</span>
            )}
          </button>
          <span className="text-[10px] text-gray-400 ml-2 pr-2 hidden md:inline">
            {mode === 'rules' ? t.modeRulesHint : t.modeAiHint}
          </span>
        </div>

        <div className="grid lg:grid-cols-2 gap-6">
          {/* Form */}
          <section className="bg-white rounded-3xl shadow-xl shadow-gray-200/80 p-6 space-y-6">
            <div className="flex gap-2">
              <button onClick={() => setForm({ ...EXAMPLE })} className="px-3 py-1.5 rounded-lg text-xs bg-brand-purple/10 text-brand-purple">{t.seedExample}</button>
              <button onClick={() => setForm({ ...EMPTY })} className="px-3 py-1.5 rounded-lg text-xs bg-gray-100 text-gray-600">{t.reset}</button>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1.5">{t.name}</label>
              <input value={form.firstName} onChange={e => setForm(f => ({ ...f, firstName: e.target.value }))} className="w-full px-3 py-2 rounded-lg border border-gray-200 bg-gray-50 text-sm" />
            </div>

            {(['fatigue', 'happiness', 'energy'] as const).map(metric => (
              <div key={metric}>
                <div className="text-sm font-medium text-gray-700 mb-1.5">{t[metric]}</div>
                <div className="grid grid-cols-3 gap-2">
                  {(['Score', 'Acceptable', 'Desired'] as const).map(field => {
                    const labelMap = { Score: t.nowScore, Acceptable: t.acceptable, Desired: t.desired };
                    const key = (metric + field) as keyof typeof EXAMPLE;
                    return (
                      <div key={field}>
                        <label className="block text-xs text-gray-500 mb-1">{labelMap[field]}</label>
                        <input type="number" value={(form as any)[key]} onChange={e => setNum(key, e.target.value)} className="w-full px-2 py-1.5 rounded-lg border border-gray-200 bg-gray-50 text-sm" />
                      </div>
                    );
                  })}
                </div>
              </div>
            ))}

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1.5">{t.goal}</label>
              <input value={form.chosenGoal} onChange={e => setForm(f => ({ ...f, chosenGoal: e.target.value }))} className="w-full px-3 py-2 rounded-lg border border-gray-200 bg-gray-50 text-sm" />
              <label className="block text-xs text-gray-500 mt-2 mb-1">{t.goalProgress}</label>
              <input type="number" value={form.goalProgress} onChange={e => setNum('goalProgress', e.target.value)} className="w-full px-3 py-2 rounded-lg border border-gray-200 bg-gray-50 text-sm" />
            </div>

            {sections.map(s => (
              <div key={s.key}>
                <div className="text-sm font-medium text-gray-700 mb-2">{s.label}</div>
                <div className="flex flex-wrap gap-2">
                  {s.defs.map(d => {
                    const selected = (form[s.key] as string[]).includes(d.id);
                    return (
                      <button key={d.id} onClick={() => toggle(s.key, d.id)} className={`px-3 py-1.5 rounded-full text-xs border transition-colors ${selected ? 'bg-brand-purple text-white border-brand-purple' : 'bg-white border-gray-200 text-gray-700 hover:border-brand-purple/40'}`}>
                        {language === 'nl' ? d.labelNl : d.labelEn}
                      </button>
                    );
                  })}
                </div>
              </div>
            ))}

            <button onClick={submit} disabled={loading} className={`w-full py-3 rounded-xl text-white font-medium shadow-lg disabled:opacity-60 transition-colors ${mode === 'ai' ? 'bg-brand-teal shadow-brand-teal/25 hover:bg-brand-teal/90' : 'bg-brand-purple shadow-brand-purple/25 hover:bg-brand-purple-light'}`}>
              {loading ? t.loading : t.cta}
            </button>
          </section>

          {/* Result */}
          <section className="space-y-4">
            {!result && !errorMsg && (
              <div className="bg-white/50 border border-dashed border-gray-200 rounded-3xl p-8 text-sm text-gray-500 text-center">
                {language === 'nl' ? 'Vul het formulier in en klik op de knop voor aanbevelingen.' : 'Fill the form and click the button to see recommendations.'}
              </div>
            )}
            {errorMsg && (
              <div className="bg-red-50 border border-red-200 rounded-2xl p-4 text-sm text-red-700">{errorMsg}</div>
            )}
            {/* AI prescription message */}
            {result?.mode === 'ai' && result.aiMessage && (
              <article className="bg-gradient-to-br from-brand-teal/10 to-white border border-brand-teal/30 rounded-3xl p-6">
                <div className="flex items-start gap-3">
                  <div className="w-9 h-9 rounded-xl bg-brand-teal text-white flex items-center justify-center flex-shrink-0 shadow-md shadow-brand-teal/30">
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 12l2 2 4-4M7.835 4.697a3.42 3.42 0 001.946-.806 3.42 3.42 0 014.438 0 3.42 3.42 0 001.946.806 3.42 3.42 0 013.138 3.138 3.42 3.42 0 00.806 1.946 3.42 3.42 0 010 4.438 3.42 3.42 0 00-.806 1.946 3.42 3.42 0 01-3.138 3.138 3.42 3.42 0 00-1.946.806 3.42 3.42 0 01-4.438 0 3.42 3.42 0 00-1.946-.806 3.42 3.42 0 01-3.138-3.138 3.42 3.42 0 00-.806-1.946 3.42 3.42 0 010-4.438 3.42 3.42 0 00.806-1.946 3.42 3.42 0 013.138-3.138z" />
                    </svg>
                  </div>
                  <div className="flex-1">
                    <p className="text-[10px] uppercase tracking-wider text-brand-teal font-semibold mb-1">{t.aiMessageLabel}{form.firstName ? ` — ${form.firstName}` : ''}</p>
                    <p className="text-base text-gray-800 leading-relaxed">{result.aiMessage}</p>
                    <p className="text-[10px] text-gray-400 mt-3 italic">
                      {t.aiDisclaimer}{result.aiModel ? ` · ${result.aiModel}` : ''}{result.aiLatencyMs ? ` · ${result.aiLatencyMs}ms` : ''}{result.aiCostUsd ? ` · $${result.aiCostUsd.toFixed(5)}` : ''}
                    </p>
                  </div>
                </div>
              </article>
            )}
            {result?.fallbackUsed && (
              <div className="bg-yellow-50 border border-yellow-200 rounded-2xl p-4 text-sm text-yellow-800">{t.fallback}</div>
            )}
            {result?.recommendations.map((rec, idx) => (
              <article key={rec.themeId} className="bg-white rounded-3xl shadow-xl shadow-gray-200/80 p-6">
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <div className={`text-xs uppercase tracking-wide font-medium ${result?.mode === 'ai' ? 'text-brand-teal' : 'text-brand-purple'}`}>#{idx + 1}</div>
                    <h2 className="text-xl font-semibold text-gray-900 mt-1">
                      {language === 'nl' ? rec.nameNl : rec.nameEn}
                    </h2>
                  </div>
                  <div className="text-sm text-gray-500">{t.score}: {(rec.score * 100).toFixed(0)}%</div>
                </div>
                <p className="text-sm text-gray-700 mt-3 leading-relaxed">{rec.rationale}</p>
                {rec.matchedSignals.length > 0 && (
                  <details className="mt-3">
                    <summary className="text-xs text-gray-500 cursor-pointer">{t.matched} ({rec.matchedSignals.length})</summary>
                    <ul className="mt-2 text-xs text-gray-500 space-y-0.5">
                      {rec.matchedSignals.map(s => <li key={s}>· {s}</li>)}
                    </ul>
                  </details>
                )}
              </article>
            ))}
            {result && (
              <p className="text-[10px] text-gray-400 text-right">engine {result.engineVersion}</p>
            )}
          </section>
        </div>
      </div>
    </div>
  );
}
