'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';

export default function OnboardingPage() {
  const router = useRouter();
  const [step, setStep] = useState<1 | 2>(1);
  const [name, setName] = useState('');
  const [age, setAge] = useState('');
  const [energyLevel, setEnergyLevel] = useState(5);
  const [loading, setLoading] = useState(false);
  const [checking, setChecking] = useState(true);

  // Auth + profile check
  useEffect(() => {
    fetch('/api/auth/me')
      .then(r => r.json())
      .then(d => {
        if (!d.user) {
          router.push('/');
          return;
        }
        // Check if profile already has a name
        return fetch('/api/profile')
          .then(r => r.json())
          .then(pd => {
            if (pd.profile?.name) {
              router.push('/chat');
            } else {
              setChecking(false);
            }
          });
      })
      .catch(() => router.push('/'));
  }, [router]);

  async function handleSubmit() {
    if (!name.trim()) return;
    setLoading(true);
    try {
      await fetch('/api/profile', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: name.trim(),
          ...(age ? { age: parseInt(age, 10) } : {}),
          current_fatigue_level: energyLevel,
        }),
      });
      router.push('/chat');
    } catch {
      setLoading(false);
    }
  }

  if (checking) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-brand-purple-pale via-white to-brand-teal/10 flex items-center justify-center">
        <div className="w-8 h-8 border-2 border-brand-purple/30 border-t-brand-purple rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-brand-purple-pale via-white to-brand-teal/10 flex flex-col items-center justify-center px-4 py-12">
      {/* Progress dots */}
      <div className="flex items-center gap-2 mb-10">
        <div className={`w-2.5 h-2.5 rounded-full transition-all duration-300 ${step >= 1 ? 'bg-brand-purple scale-110' : 'bg-gray-200'}`} />
        <div className={`w-8 h-0.5 transition-all duration-300 ${step >= 2 ? 'bg-brand-purple' : 'bg-gray-200'}`} />
        <div className={`w-2.5 h-2.5 rounded-full transition-all duration-300 ${step >= 2 ? 'bg-brand-purple scale-110' : 'bg-gray-200'}`} />
      </div>

      <div className="w-full max-w-md">
        {step === 1 && (
          <div className="animate-fade-in">
            {/* Icon */}
            <div className="flex justify-center mb-6">
              <div className="w-16 h-16 rounded-2xl bg-white shadow-lg shadow-brand-purple/10 border border-brand-purple-pale flex items-center justify-center">
                <span className="text-3xl">👋</span>
              </div>
            </div>

            <h1 className="text-2xl font-bold text-gray-900 text-center mb-2">
              What should we call you?
            </h1>
            <p className="text-sm text-gray-500 text-center mb-8">
              Let&apos;s personalise your coaching experience.
            </p>

            <div className="bg-white rounded-3xl shadow-sm border border-gray-100 p-6 flex flex-col gap-5">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Your name <span className="text-brand-purple">*</span>
                </label>
                <input
                  type="text"
                  value={name}
                  onChange={e => setName(e.target.value)}
                  onKeyDown={e => { if (e.key === 'Enter' && name.trim()) setStep(2); }}
                  placeholder="e.g. Sarah"
                  autoFocus
                  className="w-full px-4 py-3 rounded-xl border border-gray-200 bg-gray-50 text-sm text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-brand-purple/30 focus:border-brand-purple transition-all"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Age <span className="text-gray-400 font-normal">(optional)</span>
                </label>
                <input
                  type="number"
                  value={age}
                  onChange={e => setAge(e.target.value)}
                  onKeyDown={e => { if (e.key === 'Enter' && name.trim()) setStep(2); }}
                  placeholder="e.g. 45"
                  min={1}
                  max={120}
                  className="w-full px-4 py-3 rounded-xl border border-gray-200 bg-gray-50 text-sm text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-brand-purple/30 focus:border-brand-purple transition-all"
                />
              </div>

              <button
                onClick={() => setStep(2)}
                disabled={!name.trim()}
                className="w-full py-3.5 rounded-xl bg-brand-purple text-white font-semibold text-sm hover:bg-brand-purple-light active:scale-[0.98] transition-all disabled:opacity-40 disabled:cursor-not-allowed shadow-md shadow-brand-purple/20"
              >
                Continue
              </button>
            </div>
          </div>
        )}

        {step === 2 && (
          <div className="animate-fade-in">
            {/* Icon */}
            <div className="flex justify-center mb-6">
              <div className="w-16 h-16 rounded-2xl bg-white shadow-lg shadow-brand-purple/10 border border-brand-purple-pale flex items-center justify-center">
                <span className="text-3xl">⚡</span>
              </div>
            </div>

            <h1 className="text-2xl font-bold text-gray-900 text-center mb-2">
              How&apos;s your energy usually?
            </h1>
            <p className="text-sm text-gray-500 text-center mb-8">
              This helps us personalise your coaching experience.
            </p>

            <div className="bg-white rounded-3xl shadow-sm border border-gray-100 p-6 flex flex-col gap-6">
              {/* Slider display value */}
              <div className="flex flex-col items-center gap-1">
                <span className="text-4xl font-bold text-brand-purple">{energyLevel}</span>
                <span className="text-xs text-gray-500">out of 10</span>
              </div>

              {/* Slider */}
              <div className="flex flex-col gap-2">
                <input
                  type="range"
                  min={1}
                  max={10}
                  step={1}
                  value={energyLevel}
                  onChange={e => setEnergyLevel(parseInt(e.target.value, 10))}
                  className="w-full h-2 rounded-full appearance-none cursor-pointer accent-brand-purple"
                  style={{
                    background: `linear-gradient(to right, #B8722A 0%, #B8722A ${(energyLevel - 1) / 9 * 100}%, #E5E7EB ${(energyLevel - 1) / 9 * 100}%, #E5E7EB 100%)`
                  }}
                />
                <div className="flex justify-between text-xs text-gray-400">
                  <span>Very low energy</span>
                  <span>Full of energy</span>
                </div>
              </div>

              {/* Emoji scale */}
              <div className="flex justify-between px-1">
                {['😴', '😔', '😐', '🙂', '✨'].map((emoji, i) => {
                  const threshold = [2, 4, 6, 8, 10][i];
                  const active = energyLevel <= threshold && (i === 0 || energyLevel > [0, 2, 4, 6, 8][i]);
                  return (
                    <span
                      key={i}
                      className={`text-xl transition-all duration-200 ${active ? 'scale-125 opacity-100' : 'opacity-40'}`}
                    >
                      {emoji}
                    </span>
                  );
                })}
              </div>

              <button
                onClick={handleSubmit}
                disabled={loading}
                className="w-full py-3.5 rounded-xl bg-brand-purple text-white font-semibold text-sm hover:bg-brand-purple-light active:scale-[0.98] transition-all disabled:opacity-60 shadow-md shadow-brand-purple/20"
              >
                {loading ? (
                  <span className="flex items-center justify-center gap-2">
                    <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                    Setting up your profile...
                  </span>
                ) : (
                  "Let's get started"
                )}
              </button>

              <div className="text-center">
                <button
                  onClick={() => router.push('/chat')}
                  className="text-xs text-gray-400 hover:text-gray-600 underline underline-offset-2 transition-colors"
                >
                  Skip for now
                </button>
              </div>
            </div>
          </div>
        )}
      </div>

      <p className="mt-8 text-xs text-gray-300">
        Not medical advice · Untire Coach is a support tool
      </p>
    </div>
  );
}
