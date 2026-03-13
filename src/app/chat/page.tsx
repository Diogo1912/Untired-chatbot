'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import { useRouter } from 'next/navigation';

// ─── Types ───────────────────────────────────────────────────────────────────

interface User { id: string; username: string; isAdmin: boolean; }
interface Message { id: string; role: 'user' | 'assistant'; content: string; flow_step?: number; media?: any; }
interface Chat { id: string; flow_step: number; flow_state: string; completed: number; }

const CHECK_IN_OPTIONS = [
  { id: 'very_tired', label: 'Very tired today', emoji: '😴' },
  { id: 'some_energy', label: 'Some energy, not much', emoji: '🌤' },
  { id: 'ok_day', label: 'Having an okay day', emoji: '😌' },
  { id: 'emotionally_heavy', label: 'Emotionally heavy', emoji: '💙' },
  { id: 'anxious', label: 'Feeling anxious or restless', emoji: '🌊' },
  { id: 'hopeful', label: 'Feeling hopeful', emoji: '✨' },
  { id: 'proud', label: 'Proud of something small', emoji: '🌱' },
  { id: 'struggling', label: 'Struggling to find motivation', emoji: '🪨' },
];

const STEP_LABELS = ['Check-in', 'Acknowledgement', 'Reflection', 'Connect', 'Close'];

// ─── Subcomponents ───────────────────────────────────────────────────────────

function StepProgress({ currentStep, completed }: { currentStep: number; completed: boolean }) {
  if (currentStep === 0 && !completed) return null;
  const steps = completed ? 4 : Math.min(currentStep, 4);
  return (
    <div className="flex items-center gap-1.5 px-4 py-3 bg-white border-b border-gray-100">
      {STEP_LABELS.map((label, i) => {
        const done = i < steps || completed;
        const active = i === steps && !completed;
        return (
          <div key={i} className="flex items-center gap-1.5 flex-1">
            <div className={`flex items-center justify-center w-6 h-6 rounded-full text-xs font-semibold transition-all ${
              done ? 'bg-brand-purple text-white' :
              active ? 'bg-brand-purple-pale text-brand-purple border-2 border-brand-purple' :
              'bg-gray-100 text-gray-400'
            }`}>
              {done ? (
                <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" />
                </svg>
              ) : i + 1}
            </div>
            <span className={`text-xs hidden sm:block ${done || active ? 'text-gray-700 font-medium' : 'text-gray-400'}`}>
              {label}
            </span>
            {i < STEP_LABELS.length - 1 && (
              <div className={`h-px flex-1 ml-1 transition-all ${done ? 'bg-brand-purple' : 'bg-gray-200'}`} />
            )}
          </div>
        );
      })}
    </div>
  );
}

function TypingIndicator() {
  return (
    <div className="flex items-end gap-2 animate-fade-in">
      <div className="w-8 h-8 rounded-full bg-gradient-to-br from-brand-purple to-brand-teal flex items-center justify-center flex-shrink-0">
        <svg className="w-4 h-4 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M4.318 6.318a4.5 4.5 0 000 6.364L12 20.364l7.682-7.682a4.5 4.5 0 00-6.364-6.364L12 7.636l-1.318-1.318a4.5 4.5 0 00-6.364 0z" />
        </svg>
      </div>
      <div className="bg-white rounded-2xl rounded-bl-sm px-4 py-3 shadow-sm border border-gray-100">
        <div className="flex gap-1 items-center h-4">
          <span className="w-2 h-2 rounded-full bg-gray-400 animate-bounce" style={{ animationDelay: '0ms' }} />
          <span className="w-2 h-2 rounded-full bg-gray-400 animate-bounce" style={{ animationDelay: '150ms' }} />
          <span className="w-2 h-2 rounded-full bg-gray-400 animate-bounce" style={{ animationDelay: '300ms' }} />
        </div>
      </div>
    </div>
  );
}

function MessageBubble({ message }: { message: Message }) {
  const isUser = message.role === 'user';
  return (
    <div className={`flex items-end gap-2 animate-slide-up ${isUser ? 'flex-row-reverse' : ''}`}>
      {!isUser && (
        <div className="w-8 h-8 rounded-full bg-gradient-to-br from-brand-purple to-brand-teal flex items-center justify-center flex-shrink-0 shadow-sm">
          <svg className="w-4 h-4 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M4.318 6.318a4.5 4.5 0 000 6.364L12 20.364l7.682-7.682a4.5 4.5 0 00-6.364-6.364L12 7.636l-1.318-1.318a4.5 4.5 0 00-6.364 0z" />
          </svg>
        </div>
      )}
      <div className={`max-w-[80%] ${isUser ? 'items-end' : 'items-start'} flex flex-col gap-1`}>
        <div className={`px-4 py-3 rounded-2xl text-sm leading-relaxed whitespace-pre-wrap ${
          isUser
            ? 'bg-brand-purple text-white rounded-br-sm'
            : 'bg-white text-gray-800 rounded-bl-sm shadow-sm border border-gray-100'
        }`}>
          {message.content}
        </div>
        {message.media?.videos?.map((v: any, i: number) => (
          <div key={i} className="w-full mt-2 rounded-2xl overflow-hidden border border-gray-200 shadow-sm">
            <iframe src={v.embedUrl} title={v.title} className="w-full aspect-video" allowFullScreen />
          </div>
        ))}
      </div>
    </div>
  );
}

function RiskBanner() {
  return (
    <div className="mx-4 my-2 p-3 rounded-xl bg-red-50 border border-red-200 flex items-center gap-2 text-xs text-red-700">
      <svg className="w-4 h-4 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
      </svg>
      If you are in crisis, please call 0800-0113 (free, 24/7 Netherlands)
    </div>
  );
}

// ─── Main Page ────────────────────────────────────────────────────────────────

export default function ChatPage() {
  const router = useRouter();
  const [user, setUser] = useState<User | null>(null);
  const [chat, setChat] = useState<Chat | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [selections, setSelections] = useState<string[]>([]);
  const [inputText, setInputText] = useState('');
  const [loading, setLoading] = useState(false);
  const [riskShown, setRiskShown] = useState(false);
  const [sessionComplete, setSessionComplete] = useState(false);
  const [currentStep, setCurrentStep] = useState(0);
  const [freeMode, setFreeMode] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const scrollToBottom = useCallback(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, []);

  useEffect(() => { scrollToBottom(); }, [messages, loading]);

  // Check auth
  useEffect(() => {
    fetch('/api/auth/me')
      .then(r => r.json())
      .then(d => {
        if (!d.user) { router.push('/'); return; }
        setUser(d.user);
      });
  }, [router]);

  async function sendSelections() {
    if (selections.length === 0 || loading) return;
    setLoading(true);

    // Show user selection as a message
    const selectionText = selections
      .map(id => CHECK_IN_OPTIONS.find(o => o.id === id)?.label ?? id)
      .join(', ');
    const userMsg: Message = { id: Date.now().toString(), role: 'user', content: selectionText };
    setMessages(prev => [...prev, userMsg]);
    setCurrentStep(1);

    try {
      const res = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ chatId: chat?.id, step: 0, selections }),
      });
      const data = await res.json();
      if (data.riskTriggered) setRiskShown(true);
      if (data.chatId && !chat) setChat({ id: data.chatId, flow_step: 1, flow_state: '{}', completed: 0 });
      if (data.response) {
        const aiMsg: Message = { id: (Date.now() + 1).toString(), role: 'assistant', content: data.response };
        setMessages(prev => [...prev, aiMsg]);
      }
      setCurrentStep(data.nextStep ?? 2);
      // Auto-advance to step 2 after brief delay
      setTimeout(() => advanceStep(data.chatId ?? chat?.id, 2), 1200);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  }

  async function advanceStep(chatId: string, targetStep: number) {
    setLoading(true);
    try {
      const res = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ chatId, step: targetStep - 1 }),
      });
      const data = await res.json();
      if (data.response) {
        const aiMsg: Message = { id: Date.now().toString(), role: 'assistant', content: data.response };
        setMessages(prev => [...prev, aiMsg]);
      }
      setCurrentStep(data.step);
      if (data.completed) {
        setSessionComplete(true);
        setCurrentStep(4);
      } else if (targetStep === 2) {
        // Auto-advance step 2 -> 3
        setTimeout(() => advanceStep(chatId, 3), 1200);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  }

  async function sendMessage() {
    if (!inputText.trim() || loading || !chat) return;
    const text = inputText.trim();
    setInputText('');
    setLoading(true);

    const userMsg: Message = { id: Date.now().toString(), role: 'user', content: text };
    setMessages(prev => [...prev, userMsg]);

    try {
      const res = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ chatId: chat.id, step: currentStep, message: text }),
      });
      const data = await res.json();
      if (data.riskTriggered) setRiskShown(true);
      if (data.response) {
        const aiMsg: Message = { id: (Date.now() + 1).toString(), role: 'assistant', content: data.response };
        setMessages(prev => [...prev, aiMsg]);
      }
      setCurrentStep(data.step);
      if (data.completed) setSessionComplete(true);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  }

  async function startNewSession() {
    setChat(null);
    setMessages([]);
    setSelections([]);
    setCurrentStep(0);
    setSessionComplete(false);
    setFreeMode(false);
    setRiskShown(false);
  }

  async function logout() {
    await fetch('/api/auth/logout', { method: 'POST' });
    router.push('/');
  }

  function toggleSelection(id: string) {
    setSelections(prev =>
      prev.includes(id) ? prev.filter(s => s !== id) : prev.length < 3 ? [...prev, id] : prev
    );
  }

  if (!user) {
    return (
      <div className="min-h-screen bg-brand-purple-pale flex items-center justify-center">
        <div className="w-8 h-8 border-2 border-brand-purple/30 border-t-brand-purple rounded-full animate-spin" />
      </div>
    );
  }

  // ─── Check-in step (step 0) ────────────────────────────────────────────────
  if (currentStep === 0 && messages.length === 0) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-brand-purple-pale via-white to-brand-teal/5">
        {/* Header */}
        <header className="flex items-center justify-between px-6 py-4 bg-white/80 backdrop-blur-sm border-b border-gray-100 sticky top-0 z-10">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-brand-purple flex items-center justify-center">
              <svg className="w-4 h-4 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M4.318 6.318a4.5 4.5 0 000 6.364L12 20.364l7.682-7.682a4.5 4.5 0 00-6.364-6.364L12 7.636l-1.318-1.318a4.5 4.5 0 00-6.364 0z" />
              </svg>
            </div>
            <span className="font-semibold text-gray-900">Untire Coach</span>
          </div>
          <div className="flex items-center gap-3">
            {user.isAdmin && (
              <button onClick={() => router.push('/admin')} className="text-xs text-brand-purple font-medium hover:underline">
                Admin
              </button>
            )}
            <button onClick={logout} className="text-xs text-gray-400 hover:text-gray-600">
              Sign out
            </button>
          </div>
        </header>

        {/* Check-in content */}
        <main className="max-w-lg mx-auto px-4 py-8">
          <div className="text-center mb-8 animate-fade-in">
            <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-white shadow-lg shadow-brand-purple/10 mb-4 border border-brand-purple-pale">
              <span className="text-2xl">👋</span>
            </div>
            <h2 className="text-xl font-semibold text-gray-900 mb-2">
              How are you today, {user.username}?
            </h2>
            <p className="text-sm text-gray-500">
              Select up to 3 that feel most true right now
            </p>
          </div>

          <div className="grid grid-cols-2 gap-3 mb-6">
            {CHECK_IN_OPTIONS.map(option => {
              const selected = selections.includes(option.id);
              return (
                <button
                  key={option.id}
                  onClick={() => toggleSelection(option.id)}
                  className={`flex items-center gap-3 px-4 py-3.5 rounded-2xl border-2 text-left transition-all active:scale-[0.97] ${
                    selected
                      ? 'bg-brand-purple border-brand-purple text-white shadow-lg shadow-brand-purple/20'
                      : 'bg-white border-gray-200 text-gray-700 hover:border-brand-purple/40 hover:bg-brand-purple-pale/50'
                  }`}
                >
                  <span className="text-xl flex-shrink-0">{option.emoji}</span>
                  <span className="text-sm font-medium leading-tight">{option.label}</span>
                </button>
              );
            })}
          </div>

          <button
            onClick={sendSelections}
            disabled={selections.length === 0 || loading}
            className="w-full py-4 rounded-2xl bg-brand-purple text-white font-semibold text-base hover:bg-brand-purple-light active:scale-[0.98] transition-all disabled:opacity-40 disabled:cursor-not-allowed shadow-lg shadow-brand-purple/25"
          >
            {loading ? (
              <span className="flex items-center justify-center gap-2">
                <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                Starting session...
              </span>
            ) : `Continue${selections.length > 0 ? ` (${selections.length} selected)` : ''}`}
          </button>
        </main>
      </div>
    );
  }

  // ─── Coaching session (steps 1–4) + free mode ─────────────────────────────
  return (
    <div className="h-screen flex flex-col bg-surface">
      {/* Header */}
      <header className="flex items-center justify-between px-4 py-3 bg-white border-b border-gray-100 flex-shrink-0">
        <div className="flex items-center gap-2">
          <div className="w-7 h-7 rounded-lg bg-brand-purple flex items-center justify-center">
            <svg className="w-3.5 h-3.5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M4.318 6.318a4.5 4.5 0 000 6.364L12 20.364l7.682-7.682a4.5 4.5 0 00-6.364-6.364L12 7.636l-1.318-1.318a4.5 4.5 0 00-6.364 0z" />
            </svg>
          </div>
          <span className="font-semibold text-sm text-gray-900">Untire Coach</span>
        </div>
        <div className="flex items-center gap-3">
          {user.isAdmin && (
            <button onClick={() => router.push('/admin')} className="text-xs text-brand-purple font-medium hover:underline">
              Admin
            </button>
          )}
          <button onClick={logout} className="text-xs text-gray-400 hover:text-gray-600">Sign out</button>
        </div>
      </header>

      {/* Step progress */}
      <StepProgress currentStep={currentStep} completed={sessionComplete} />

      {/* Risk banner */}
      {riskShown && <RiskBanner />}

      {/* Messages */}
      <div className="flex-1 overflow-y-auto px-4 py-4 space-y-4">
        {messages.map(msg => (
          <MessageBubble key={msg.id} message={msg} />
        ))}
        {loading && <TypingIndicator />}
        <div ref={messagesEndRef} />
      </div>

      {/* Session complete CTA */}
      {sessionComplete && !freeMode && (
        <div className="px-4 py-3 bg-gradient-to-r from-brand-purple-pale to-brand-teal/10 border-t border-gray-100 flex-shrink-0">
          <p className="text-xs text-gray-500 text-center mb-3">
            Session complete · You showed up for yourself today
          </p>
          <div className="flex gap-2">
            <button
              onClick={startNewSession}
              className="flex-1 py-2.5 rounded-xl bg-brand-purple text-white text-sm font-medium hover:bg-brand-purple-light transition-all"
            >
              New session
            </button>
            <button
              onClick={() => setFreeMode(true)}
              className="flex-1 py-2.5 rounded-xl bg-white border border-gray-200 text-gray-700 text-sm font-medium hover:bg-gray-50 transition-all"
            >
              Keep chatting
            </button>
          </div>
        </div>
      )}

      {/* Step 3 input (connect step — optional message) */}
      {currentStep === 3 && !sessionComplete && (
        <div className="px-4 py-3 bg-white border-t border-gray-100 flex-shrink-0">
          <div className="flex gap-2">
            <input
              type="text"
              value={inputText}
              onChange={e => setInputText(e.target.value)}
              onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); sendMessage(); } }}
              placeholder="Share a thought, or tap to continue..."
              className="flex-1 px-4 py-2.5 rounded-xl border border-gray-200 bg-gray-50 text-sm focus:outline-none focus:ring-2 focus:ring-brand-purple/30 focus:border-brand-purple"
              disabled={loading}
            />
            <button
              onClick={inputText.trim() ? sendMessage : () => advanceStep(chat!.id, 4)}
              disabled={loading}
              className="px-4 py-2.5 rounded-xl bg-brand-purple text-white text-sm font-medium hover:bg-brand-purple-light transition-all disabled:opacity-50 flex-shrink-0"
            >
              {loading ? (
                <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin block" />
              ) : inputText.trim() ? 'Send' : 'Continue \u2192'}
            </button>
          </div>
        </div>
      )}

      {/* Free mode input */}
      {freeMode && (
        <div className="px-4 py-3 bg-white border-t border-gray-100 flex-shrink-0">
          <div className="flex gap-2">
            <input
              type="text"
              value={inputText}
              onChange={e => setInputText(e.target.value)}
              onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); sendMessage(); } }}
              placeholder="Continue the conversation..."
              className="flex-1 px-4 py-2.5 rounded-xl border border-gray-200 bg-gray-50 text-sm focus:outline-none focus:ring-2 focus:ring-brand-purple/30 focus:border-brand-purple"
              disabled={loading}
            />
            <button
              onClick={sendMessage}
              disabled={loading || !inputText.trim()}
              className="px-4 py-2.5 rounded-xl bg-brand-purple text-white text-sm font-medium hover:bg-brand-purple-light transition-all disabled:opacity-50"
            >
              {loading ? (
                <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin block" />
              ) : 'Send'}
            </button>
          </div>
        </div>
      )}

      <p className="text-center text-xs text-gray-300 py-2 flex-shrink-0 bg-white">
        Not medical advice · Untire Coach is a support tool
      </p>
    </div>
  );
}
