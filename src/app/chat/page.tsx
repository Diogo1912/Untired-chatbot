'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import { useRouter } from 'next/navigation';

// ─── Types ───────────────────────────────────────────────────────────────────

interface User { id: string; username: string; isAdmin: boolean; }
interface Message { id: string; role: 'user' | 'assistant'; content: string; flow_step?: number; media?: any; }
interface Chat { id: string; flow_step: number; flow_state: string; completed: number; created_at: string; }
interface CalendarDay {
  date: string;
  label: string;
  chatId: string | null;
  completed: boolean;
  step: number;
  isToday: boolean;
  isSkipped: boolean; // past day, no completed chat
  month: string; // "March 2026"
}
interface Preferences {
  customPrompt: string;
  showBreathing: boolean;
  showAppFeatures: boolean;
}

// ─── Constants ───────────────────────────────────────────────────────────────

const CHECK_IN_OPTIONS = [
  { id: 'very_tired', label: 'Very tired today' },
  { id: 'some_energy', label: 'Some energy, not much' },
  { id: 'ok_day', label: 'Having an okay day' },
  { id: 'emotionally_heavy', label: 'Emotionally heavy' },
  { id: 'anxious', label: 'Feeling anxious or restless' },
  { id: 'hopeful', label: 'Feeling hopeful' },
  { id: 'proud', label: 'Proud of something small' },
  { id: 'struggling', label: 'Struggling to find motivation' },
];

const APP_FEATURE_DETAILS: Record<string, { icon: string; label: string; description: string }> = {
  energy_map: {
    icon: 'E',
    label: 'Energy Map',
    description: 'Track how your energy shifts throughout the day and spot patterns over time.',
  },
  activity_planner: {
    icon: 'A',
    label: 'Activity Planner',
    description: 'Schedule activities within your energy envelope — no boom and bust.',
  },
  pacing_guide: {
    icon: 'P',
    label: 'Pacing Guide',
    description: 'Learn to balance rest and activity to gently build your stamina back.',
  },
  sleep_tracker: {
    icon: 'S',
    label: 'Sleep Tracker',
    description: 'See how sleep quality connects to your fatigue levels the next day.',
  },
};

// ─── Helpers ─────────────────────────────────────────────────────────────────

function getTodayStr(): string {
  return new Date().toISOString().slice(0, 10);
}

function formatSidebarDate(dateStr: string): { label: string; month: string } {
  const d = new Date(dateStr + 'T12:00:00');
  const today = getTodayStr();
  const yesterday = new Date();
  yesterday.setDate(yesterday.getDate() - 1);
  const yStr = yesterday.toISOString().slice(0, 10);

  let label: string;
  if (dateStr === today) label = 'Today';
  else if (dateStr === yStr) label = 'Yesterday';
  else label = d.toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric', month: 'short' });

  const month = d.toLocaleDateString('en-GB', { month: 'long', year: 'numeric' });
  return { label, month };
}

function generateCalendarDays(calendarChats: Chat[], userJoinedAt: string | null, numDays = 365): CalendarDay[] {
  const days: CalendarDay[] = [];
  const today = getTodayStr();
  // Don't show days before the account was created
  const joinDate = userJoinedAt ? userJoinedAt.slice(0, 10) : today;

  for (let i = 0; i < numDays; i++) {
    const d = new Date();
    d.setDate(d.getDate() - i);
    const dateStr = d.toISOString().slice(0, 10);

    if (dateStr < joinDate) break; // stop at account creation date

    const chat = calendarChats.find(c => c.created_at?.slice(0, 10) === dateStr);
    const { label, month } = formatSidebarDate(dateStr);

    days.push({
      date: dateStr,
      label,
      month,
      chatId: chat?.id ?? null,
      completed: chat?.completed === 1,
      step: chat?.flow_step ?? 0,
      isToday: dateStr === today,
      isSkipped: i > 0 && !chat?.completed,
    });
  }
  return days;
}

function getGreeting(): string {
  const h = new Date().getHours();
  if (h < 12) return 'Good morning';
  if (h < 18) return 'Good afternoon';
  return 'Good evening';
}

// ─── Widgets ─────────────────────────────────────────────────────────────────

function BreathingWidget({ exercise, intro }: { exercise: any; intro: string }) {
  const [active, setActive] = useState(false);
  const [phaseIndex, setPhaseIndex] = useState(0);
  const [countdown, setCountdown] = useState<number>(exercise.phases[0].duration);
  const phaseRef = useRef(0);
  phaseRef.current = phaseIndex;

  useEffect(() => {
    if (!active) return;
    const timer = setInterval(() => {
      setCountdown(prev => {
        if (prev > 1) return prev - 1;
        const next = (phaseRef.current + 1) % exercise.phases.length;
        setPhaseIndex(next);
        return exercise.phases[next].duration;
      });
    }, 1000);
    return () => clearInterval(timer);
  }, [active, exercise.phases]);

  function toggle() {
    if (active) { setActive(false); }
    else { setPhaseIndex(0); setCountdown(exercise.phases[0].duration); setActive(true); }
  }

  const currentPhase = exercise.phases[phaseIndex];
  const isInhale = currentPhase.label === 'Inhale';
  const isExhale = currentPhase.label === 'Exhale';

  return (
    <div className="mt-2 rounded-xl border border-surface-muted bg-white shadow-sm overflow-hidden">
      <div className="px-4 pt-3 pb-0">
        <p className="text-xs text-gray-500 leading-relaxed">{intro}</p>
      </div>
      <div className="flex flex-col items-center gap-3 px-4 py-4">
        <div className="relative flex items-center justify-center w-24 h-24">
          <div className={`absolute inset-0 rounded-full bg-brand-yellow/40 transition-transform duration-[1200ms] ease-in-out ${active ? (isInhale ? 'scale-125' : isExhale ? 'scale-90' : 'scale-110') : 'scale-100'}`} />
          <div className={`absolute inset-3 rounded-full bg-brand-yellow/50 transition-transform duration-[1200ms] ease-in-out ${active ? (isInhale ? 'scale-110' : isExhale ? 'scale-95' : 'scale-105') : 'scale-100'}`} />
          <div className={`relative w-14 h-14 rounded-full bg-brand-purple flex items-center justify-center shadow-md transition-transform duration-[1200ms] ease-in-out ${active ? (isInhale ? 'scale-110' : isExhale ? 'scale-90' : 'scale-100') : 'scale-100'}`}>
            <span className="text-white font-bold text-lg select-none">{active ? countdown : '+'}</span>
          </div>
        </div>
        <p className="text-xs font-semibold text-gray-600 h-4 text-center">{active ? currentPhase.label : exercise.label}</p>
        <div className="flex gap-1.5 flex-wrap justify-center">
          {exercise.phases.map((p: any, i: number) => (
            <span key={i} className={`text-xs px-2 py-0.5 rounded-full transition-all duration-300 ${i === phaseIndex && active ? 'bg-brand-purple text-white font-medium' : 'bg-surface text-gray-400 border border-surface-muted'}`}>
              {p.label} {p.duration}s
            </span>
          ))}
        </div>
        <button onClick={toggle} className={`px-5 py-1.5 rounded-full text-xs font-semibold transition-all active:scale-95 ${active ? 'bg-surface-muted text-gray-600 hover:bg-gray-200' : 'bg-brand-purple text-white hover:bg-brand-purple-light shadow-sm'}`}>
          {active ? 'Pause' : 'Start'}
        </button>
      </div>
    </div>
  );
}

function AppFeatureWidget({ feature, intro }: { feature: string; intro: string }) {
  const details = APP_FEATURE_DETAILS[feature] ?? APP_FEATURE_DETAILS.energy_map;
  return (
    <div className="mt-2 rounded-xl border border-surface-muted bg-white shadow-sm overflow-hidden">
      <div className="px-4 pt-3 pb-1">
        <p className="text-xs text-gray-500 leading-relaxed">{intro}</p>
      </div>
      <div className="flex items-center gap-3 px-4 py-3">
        <div className="w-9 h-9 rounded-lg bg-surface flex items-center justify-center flex-shrink-0 border border-surface-muted">
          <span className="text-xs font-bold text-brand-purple">{details.icon}</span>
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-sm font-semibold text-gray-800">{details.label}</p>
          <p className="text-xs text-gray-400 mt-0.5 leading-relaxed">{details.description}</p>
        </div>
      </div>
      <div className="px-4 pb-3">
        <p className="text-xs text-gray-300 text-right">Available in Untire Now</p>
      </div>
    </div>
  );
}

function TypingIndicator() {
  return (
    <div className="flex items-end gap-2">
      <div className="w-7 h-7 rounded-full bg-brand-purple flex items-center justify-center flex-shrink-0">
        <svg className="w-3.5 h-3.5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M4.318 6.318a4.5 4.5 0 000 6.364L12 20.364l7.682-7.682a4.5 4.5 0 00-6.364-6.364L12 7.636l-1.318-1.318a4.5 4.5 0 00-6.364 0z" />
        </svg>
      </div>
      <div className="bg-white rounded-2xl rounded-bl-sm px-4 py-3 shadow-sm border border-gray-100">
        <div className="flex gap-1 items-center h-4">
          <span className="w-1.5 h-1.5 rounded-full bg-gray-400 animate-bounce" style={{ animationDelay: '0ms' }} />
          <span className="w-1.5 h-1.5 rounded-full bg-gray-400 animate-bounce" style={{ animationDelay: '150ms' }} />
          <span className="w-1.5 h-1.5 rounded-full bg-gray-400 animate-bounce" style={{ animationDelay: '300ms' }} />
        </div>
      </div>
    </div>
  );
}

function MessageBubble({ message, showWidgets = true }: { message: Message; showWidgets?: boolean }) {
  const isUser = message.role === 'user';
  const media = message.media;

  return (
    <div className={`flex items-end gap-2 animate-slide-up ${isUser ? 'flex-row-reverse' : ''}`}>
      {!isUser && (
        <div className="w-7 h-7 rounded-full bg-brand-purple flex items-center justify-center flex-shrink-0 shadow-sm">
          <svg className="w-3.5 h-3.5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M4.318 6.318a4.5 4.5 0 000 6.364L12 20.364l7.682-7.682a4.5 4.5 0 00-6.364-6.364L12 7.636l-1.318-1.318a4.5 4.5 0 00-6.364 0z" />
          </svg>
        </div>
      )}
      <div className={`max-w-[78%] flex flex-col gap-1 ${isUser ? 'items-end' : 'items-start'}`}>
        {message.content && (
          <div className={`px-4 py-2.5 rounded-2xl text-sm leading-relaxed whitespace-pre-wrap ${
            isUser
              ? 'bg-brand-purple text-white rounded-br-sm'
              : 'bg-white text-gray-800 rounded-bl-sm shadow-sm border border-gray-100'
          }`}>
            {message.content}
          </div>
        )}
        {showWidgets && !isUser && media?.type === 'breathing_exercise' && (
          <BreathingWidget exercise={media.exercise} intro={media.intro} />
        )}
        {showWidgets && !isUser && media?.type === 'app_feature' && (
          <AppFeatureWidget feature={media.feature} intro={media.intro} />
        )}
      </div>
    </div>
  );
}

// ─── Sidebar Day Entry ────────────────────────────────────────────────────────

function DayEntry({
  day,
  isSelected,
  onSelect,
  onDelete,
  onRedo,
  onCopy,
}: {
  day: CalendarDay;
  isSelected: boolean;
  onSelect: () => void;
  onDelete: () => void;
  onRedo: () => void;
  onCopy: () => void;
}) {
  const [menuOpen, setMenuOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!menuOpen) return;
    function close(e: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) setMenuOpen(false);
    }
    document.addEventListener('mousedown', close);
    return () => document.removeEventListener('mousedown', close);
  }, [menuOpen]);

  let statusColor = 'bg-gray-200'; // no chat
  if (day.completed) statusColor = 'bg-brand-teal';
  else if (day.chatId && day.isToday) statusColor = 'bg-brand-purple/50'; // in progress today
  else if (day.isSkipped) statusColor = 'bg-red-300';

  return (
    <div className={`group relative flex items-center gap-2.5 px-3 py-2 rounded-lg cursor-pointer transition-colors ${
      isSelected ? 'bg-brand-purple-pale' : 'hover:bg-surface'
    }`}>
      <button className="flex items-center gap-2.5 flex-1 min-w-0 text-left" onClick={onSelect}>
        <span className={`w-1.5 h-1.5 rounded-full flex-shrink-0 ${statusColor}`} />
        <span className={`text-xs truncate ${
          day.isSkipped ? 'text-red-400' : isSelected ? 'text-brand-purple font-medium' : 'text-gray-600'
        }`}>
          {day.label}
        </span>
        {day.completed && (
          <svg className="w-3 h-3 text-brand-teal flex-shrink-0 ml-auto" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" />
          </svg>
        )}
      </button>

      {/* 3-dot menu — shows on hover */}
      {(day.chatId || day.isToday) && (
        <div className="relative flex-shrink-0" ref={menuRef}>
          <button
            onClick={e => { e.stopPropagation(); setMenuOpen(v => !v); }}
            className="opacity-0 group-hover:opacity-100 w-5 h-5 flex items-center justify-center rounded hover:bg-surface-muted transition-opacity"
          >
            <svg className="w-3.5 h-3.5 text-gray-400" fill="currentColor" viewBox="0 0 24 24">
              <circle cx="12" cy="5" r="1.5" /><circle cx="12" cy="12" r="1.5" /><circle cx="12" cy="19" r="1.5" />
            </svg>
          </button>

          {menuOpen && (
            <div className="absolute right-0 top-6 z-50 bg-white border border-gray-200 rounded-lg shadow-lg overflow-hidden w-36">
              <button
                onClick={() => { setMenuOpen(false); onDelete(); }}
                className="flex items-center gap-2.5 w-full px-3 py-2 text-xs text-gray-700 hover:bg-surface text-left"
              >
                <svg className="w-3.5 h-3.5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                </svg>
                Delete
              </button>
              <button
                onClick={() => { setMenuOpen(false); onRedo(); }}
                disabled={!day.isToday}
                className="flex items-center gap-2.5 w-full px-3 py-2 text-xs hover:bg-surface text-left disabled:opacity-40 disabled:cursor-not-allowed text-gray-700"
              >
                <svg className="w-3.5 h-3.5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                </svg>
                {day.isToday ? 'Re-do' : 'Re-do (today only)'}
              </button>
              {day.chatId && (
                <button
                  onClick={() => { setMenuOpen(false); onCopy(); }}
                  className="flex items-center gap-2.5 w-full px-3 py-2 text-xs text-gray-700 hover:bg-surface text-left"
                >
                  <svg className="w-3.5 h-3.5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8.684 13.342C8.886 12.938 9 12.482 9 12c0-.482-.114-.938-.316-1.342m0 2.684a3 3 0 110-2.684m0 2.684l6.632 3.316m-6.632-6l6.632-3.316m0 0a3 3 0 105.367-2.684 3 3 0 00-5.367 2.684zm0 9.316a3 3 0 105.368 2.684 3 3 0 00-5.368-2.684z" />
                  </svg>
                  Copy link
                </button>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ─── Calendar Modal ───────────────────────────────────────────────────────────

function CalendarModal({
  days,
  onClose,
  onSelectDay,
}: {
  days: CalendarDay[];
  onClose: () => void;
  onSelectDay: (date: string) => void;
}) {
  const today = getTodayStr();
  const thisMonth = new Date().toLocaleDateString('en-GB', { month: 'long', year: 'numeric' });

  // Build a month grid for the current month
  const now = new Date();
  const year = now.getFullYear();
  const month = now.getMonth();
  const firstDay = new Date(year, month, 1).getDay(); // 0=Sun
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const offset = firstDay === 0 ? 6 : firstDay - 1; // Mon-first offset

  const cells: (number | null)[] = [
    ...Array(offset).fill(null),
    ...Array.from({ length: daysInMonth }, (_, i) => i + 1),
  ];

  function dayStatus(dayNum: number): 'completed' | 'skipped' | 'today' | 'future' | 'none' {
    const dateStr = `${year}-${String(month + 1).padStart(2, '0')}-${String(dayNum).padStart(2, '0')}`;
    if (dateStr > today) return 'future';
    if (dateStr === today) return 'today';
    const d = days.find(d => d.date === dateStr);
    if (d?.completed) return 'completed';
    if (!d?.chatId) return 'skipped';
    return 'none';
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/40" onClick={onClose} />
      <div className="relative bg-white rounded-2xl shadow-2xl w-full max-w-sm overflow-hidden animate-fade-in">
        <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100">
          <h2 className="text-sm font-semibold text-gray-900">{thisMonth}</h2>
          <button onClick={onClose} className="w-7 h-7 rounded-lg hover:bg-surface flex items-center justify-center">
            <svg className="w-4 h-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        <div className="px-5 py-4">
          <div className="grid grid-cols-7 mb-2">
            {['Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa', 'Su'].map(d => (
              <div key={d} className="text-center text-xs font-medium text-gray-400 py-1">{d}</div>
            ))}
          </div>
          <div className="grid grid-cols-7 gap-y-1">
            {cells.map((dayNum, i) => {
              if (!dayNum) return <div key={i} />;
              const status = dayStatus(dayNum);
              const dateStr = `${year}-${String(month + 1).padStart(2, '0')}-${String(dayNum).padStart(2, '0')}`;
              const dayData = days.find(d => d.date === dateStr);

              return (
                <button
                  key={i}
                  disabled={status === 'future'}
                  onClick={() => { if (dayData?.chatId) { onSelectDay(dateStr); onClose(); } }}
                  className={`aspect-square flex items-center justify-center rounded-lg text-xs font-medium transition-colors mx-0.5 ${
                    status === 'today' ? 'bg-brand-purple text-white' :
                    status === 'completed' ? 'bg-brand-teal/20 text-brand-teal hover:bg-brand-teal/30 cursor-pointer' :
                    status === 'skipped' ? 'text-red-400 hover:bg-red-50' :
                    'text-gray-300 cursor-default'
                  }`}
                >
                  {dayNum}
                  {status === 'completed' && (
                    <span className="sr-only">completed</span>
                  )}
                </button>
              );
            })}
          </div>

          <div className="flex items-center gap-4 mt-4 pt-4 border-t border-gray-100">
            <div className="flex items-center gap-1.5 text-xs text-gray-500">
              <span className="w-2.5 h-2.5 rounded-full bg-brand-teal/50" />Completed
            </div>
            <div className="flex items-center gap-1.5 text-xs text-gray-500">
              <span className="w-2.5 h-2.5 rounded-full bg-red-300/50" />Skipped
            </div>
            <div className="flex items-center gap-1.5 text-xs text-gray-500">
              <span className="w-2.5 h-2.5 rounded-full bg-brand-purple" />Today
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── Customise Modal ──────────────────────────────────────────────────────────

function CustomiseModal({
  prefs,
  onClose,
  onSave,
}: {
  prefs: Preferences;
  onClose: () => void;
  onSave: (p: Preferences) => void;
}) {
  const [form, setForm] = useState(prefs);
  const [saving, setSaving] = useState(false);

  async function save() {
    setSaving(true);
    await fetch('/api/preferences', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(form),
    });
    onSave(form);
    setSaving(false);
    onClose();
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/40" onClick={onClose} />
      <div className="relative bg-white rounded-2xl shadow-2xl w-full max-w-md overflow-hidden animate-fade-in">
        <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100">
          <h2 className="text-sm font-semibold text-gray-900">Customise</h2>
          <button onClick={onClose} className="w-7 h-7 rounded-lg hover:bg-surface flex items-center justify-center">
            <svg className="w-4 h-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        <div className="px-5 py-5 space-y-5">
          <div>
            <label className="block text-xs font-semibold text-gray-700 mb-1.5">Custom context for the coach</label>
            <p className="text-xs text-gray-400 mb-2 leading-relaxed">
              Share anything that helps the coach understand you better — your situation, preferences, or what you find helpful.
            </p>
            <textarea
              value={form.customPrompt}
              onChange={e => setForm(f => ({ ...f, customPrompt: e.target.value }))}
              placeholder="e.g. I find short, direct messages more helpful. I am managing fatigue after breast cancer treatment..."
              rows={5}
              className="w-full px-3 py-2.5 rounded-xl border border-gray-200 bg-surface text-sm text-gray-800 resize-none focus:outline-none focus:ring-2 focus:ring-brand-purple/20 focus:border-brand-purple placeholder:text-gray-300"
            />
          </div>

          <div>
            <p className="text-xs font-semibold text-gray-700 mb-3">Interactive elements</p>
            <div className="space-y-2">
              <label className="flex items-center justify-between p-3 rounded-xl border border-gray-100 hover:bg-surface cursor-pointer">
                <div>
                  <p className="text-xs font-medium text-gray-700">Breathing exercises</p>
                  <p className="text-xs text-gray-400">Animated breathing guides during sessions</p>
                </div>
                <button
                  onClick={() => setForm(f => ({ ...f, showBreathing: !f.showBreathing }))}
                  className={`relative w-9 h-5 rounded-full transition-colors flex-shrink-0 ${form.showBreathing ? 'bg-brand-teal' : 'bg-gray-200'}`}
                >
                  <span className={`absolute top-0.5 w-4 h-4 rounded-full bg-white shadow transition-transform ${form.showBreathing ? 'translate-x-4' : 'translate-x-0.5'}`} />
                </button>
              </label>
              <label className="flex items-center justify-between p-3 rounded-xl border border-gray-100 hover:bg-surface cursor-pointer">
                <div>
                  <p className="text-xs font-medium text-gray-700">App feature suggestions</p>
                  <p className="text-xs text-gray-400">Cards suggesting Untire Now features</p>
                </div>
                <button
                  onClick={() => setForm(f => ({ ...f, showAppFeatures: !f.showAppFeatures }))}
                  className={`relative w-9 h-5 rounded-full transition-colors flex-shrink-0 ${form.showAppFeatures ? 'bg-brand-teal' : 'bg-gray-200'}`}
                >
                  <span className={`absolute top-0.5 w-4 h-4 rounded-full bg-white shadow transition-transform ${form.showAppFeatures ? 'translate-x-4' : 'translate-x-0.5'}`} />
                </button>
              </label>
            </div>
          </div>
        </div>

        <div className="px-5 pb-5 flex gap-2">
          <button onClick={onClose} className="flex-1 py-2.5 rounded-xl border border-gray-200 text-xs font-medium text-gray-600 hover:bg-surface">
            Cancel
          </button>
          <button onClick={save} disabled={saving} className="flex-1 py-2.5 rounded-xl bg-brand-purple text-white text-xs font-semibold hover:bg-brand-purple-light disabled:opacity-50">
            {saving ? 'Saving...' : 'Save'}
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Main Page ────────────────────────────────────────────────────────────────

export default function ChatPage() {
  const router = useRouter();

  // Auth
  const [user, setUser] = useState<User | null>(null);
  const [authChecked, setAuthChecked] = useState(false);

  // Chat state (today's active session)
  const [chat, setChat] = useState<Chat | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [currentStep, setCurrentStep] = useState(0);
  const [sessionComplete, setSessionComplete] = useState(false);
  const [selections, setSelections] = useState<string[]>([]);
  const [inputText, setInputText] = useState('');
  const [loading, setLoading] = useState(false);
  const [riskShown, setRiskShown] = useState(false);

  // Sidebar / calendar
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [calendarChats, setCalendarChats] = useState<Chat[]>([]);
  const [streak, setStreak] = useState(0);
  const [calendarDays, setCalendarDays] = useState<CalendarDay[]>([]);
  const [chatsCollapsed, setChatsCollapsed] = useState(false);
  const [userJoinedAt, setUserJoinedAt] = useState<string | null>(null);

  // Quick reply suggestions (dynamic, from AI)
  const [suggestions, setSuggestions] = useState<string[]>([]);

  // View — null = today, string = viewing past day chat
  const [viewChatId, setViewChatId] = useState<string | null>(null);
  const [viewMessages, setViewMessages] = useState<Message[]>([]);
  const [viewLoading, setViewLoading] = useState(false);
  const [viewDate, setViewDate] = useState<string | null>(null);

  // Modals
  const [showCalendar, setShowCalendar] = useState(false);
  const [showCustomise, setShowCustomise] = useState(false);
  const [prefs, setPrefs] = useState<Preferences>({ customPrompt: '', showBreathing: true, showAppFeatures: true });

  // Copy confirmation
  const [copyConfirm, setCopyConfirm] = useState<string | null>(null);

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const scrollToBottom = useCallback(() => { messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' }); }, []);
  useEffect(() => { scrollToBottom(); }, [messages, loading]);

  // Auth check
  useEffect(() => {
    fetch('/api/auth/me').then(r => r.json()).then(d => {
      if (!d.user) { router.push('/'); return; }
      setUser(d.user);
      fetch('/api/profile').then(r => r.json()).then(pd => {
        if (!pd.profile?.name) router.push('/onboarding');
        else setAuthChecked(true);
      }).catch(() => setAuthChecked(true));
    });
  }, [router]);

  // Load calendar + today's chat + preferences
  useEffect(() => {
    if (!user) return;

    fetch('/api/chat').then(r => r.json()).then(d => {
      const cc: Chat[] = d.calendarChats ?? [];
      const joinedAt: string | null = d.userJoinedAt ?? null;
      setCalendarChats(cc);
      setStreak(d.streak ?? 0);
      setUserJoinedAt(joinedAt);
      setCalendarDays(generateCalendarDays(cc, joinedAt));

      if (d.todayChat) {
        const tc: Chat = d.todayChat;
        setChat(tc);
        setCurrentStep(tc.flow_step);
        if (tc.completed) setSessionComplete(true);

        // Load today's messages
        fetch(`/api/chat?chatId=${tc.id}`).then(r => r.json()).then(md => {
          setMessages(md.messages ?? []);
        });
      }
    });

    fetch('/api/preferences').then(r => r.json()).then(d => {
      setPrefs({ customPrompt: d.customPrompt ?? '', showBreathing: d.showBreathing !== false, showAppFeatures: d.showAppFeatures !== false });
    }).catch(() => {});
  }, [user]);

  // View a past chat
  async function openDayView(chatId: string, date: string) {
    setViewChatId(chatId);
    setViewDate(date);
    setViewLoading(true);
    setSidebarOpen(false);
    try {
      const d = await fetch(`/api/chat?chatId=${chatId}`).then(r => r.json());
      setViewMessages(d.messages ?? []);
    } finally {
      setViewLoading(false);
    }
  }

  function closeView() {
    setViewChatId(null);
    setViewDate(null);
    setViewMessages([]);
  }

  // Refresh calendar
  async function refreshCalendar() {
    const d = await fetch('/api/chat').then(r => r.json());
    const cc: Chat[] = d.calendarChats ?? [];
    const joinedAt: string | null = d.userJoinedAt ?? userJoinedAt;
    setCalendarChats(cc);
    setStreak(d.streak ?? 0);
    setCalendarDays(generateCalendarDays(cc, joinedAt));
  }

  // Chat actions
  async function handleDelete(chatId: string, isToday: boolean) {
    await fetch(`/api/chat?chatId=${chatId}`, { method: 'DELETE' });
    if (isToday) {
      setChat(null); setMessages([]); setCurrentStep(0); setSessionComplete(false);
      closeView();
    } else if (viewChatId === chatId) closeView();
    await refreshCalendar();
  }

  async function handleRedo() {
    if (!chat) return;
    await fetch(`/api/chat?chatId=${chat.id}`, { method: 'DELETE' });
    setChat(null); setMessages([]); setCurrentStep(0); setSessionComplete(false);
    closeView();
    await refreshCalendar();
  }

  async function handleCopy(chatId: string) {
    try {
      const d = await fetch('/api/chat/share', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ chatId }),
      }).then(r => r.json());
      await navigator.clipboard.writeText(d.shareUrl);
      setCopyConfirm(chatId);
      setTimeout(() => setCopyConfirm(null), 2000);
    } catch { /* fallback */ }
  }

  // Sidebar select handler
  function handleDaySelect(day: CalendarDay) {
    if (day.isToday) {
      closeView();
      setSidebarOpen(false);
    } else if (day.chatId) {
      openDayView(day.chatId, day.date);
    }
  }

  // Check-in flow
  function toggleSelection(id: string) {
    setSelections(prev => prev.includes(id) ? prev.filter(s => s !== id) : prev.length < 3 ? [...prev, id] : prev);
  }

  async function sendSelections() {
    if (selections.length === 0 || loading) return;
    setLoading(true);
    const selectionText = selections.map(id => CHECK_IN_OPTIONS.find(o => o.id === id)?.label ?? id).join(', ');
    setMessages([{ id: Date.now().toString(), role: 'user', content: selectionText }]);
    setCurrentStep(1);
    try {
      const res = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ chatId: chat?.id, step: 0, selections }),
      });
      const data = await res.json();
      if (data.riskTriggered) setRiskShown(true);
      if (data.chatId) {
        const newChat = { id: data.chatId, flow_step: 1, flow_state: '{}', completed: 0, created_at: new Date().toISOString() };
        setChat(newChat);
      }
      if (data.response) {
        setMessages(prev => [...prev, { id: (Date.now() + 1).toString(), role: 'assistant', content: data.response, media: data.widget ?? null }]);
      }
      // Stay at step 1 — user must pick a suggestion (no auto-advance)
      setCurrentStep(1);
      setSuggestions(data.suggestions ?? []);
    } finally {
      setLoading(false);
    }
  }

  async function advanceStep(chatId: string, targetStep: number) {
    setLoading(true);
    setSuggestions([]);
    try {
      const res = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ chatId, step: targetStep - 1 }),
      });
      const data = await res.json();
      if (data.response) {
        setMessages(prev => [...prev, { id: Date.now().toString(), role: 'assistant', content: data.response, media: data.widget ?? null }]);
      }
      setCurrentStep(data.step);
      setSuggestions(data.suggestions ?? []);
      if (data.completed) { setSessionComplete(true); setCurrentStep(4); setSuggestions([]); await refreshCalendar(); }
    } finally {
      setLoading(false);
    }
  }

  async function sendMessage() {
    if (!inputText.trim() || loading || !chat) return;
    const text = inputText.trim();
    setInputText('');
    setSuggestions([]);
    setLoading(true);
    setMessages(prev => [...prev, { id: Date.now().toString(), role: 'user', content: text }]);
    try {
      const res = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ chatId: chat.id, step: currentStep, message: text }),
      });
      const data = await res.json();
      if (data.riskTriggered) setRiskShown(true);
      if (data.response) {
        setMessages(prev => [...prev, { id: (Date.now() + 1).toString(), role: 'assistant', content: data.response, media: data.widget ?? null }]);
      }
      setCurrentStep(data.step ?? currentStep);
      setSuggestions(data.suggestions ?? []);
      if (data.completed) { setSessionComplete(true); setSuggestions([]); await refreshCalendar(); }
    } finally {
      setLoading(false);
    }
  }

  // Send a quick-reply suggestion as the user's message
  async function sendQuickReply(text: string) {
    if (loading || !chat) return;
    setSuggestions([]);
    setLoading(true);
    setMessages(prev => [...prev, { id: Date.now().toString(), role: 'user', content: text }]);
    try {
      const res = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ chatId: chat.id, step: currentStep, message: text }),
      });
      const data = await res.json();
      if (data.riskTriggered) setRiskShown(true);
      if (data.response) {
        setMessages(prev => [...prev, { id: (Date.now() + 1).toString(), role: 'assistant', content: data.response, media: data.widget ?? null }]);
      }
      setCurrentStep(data.step ?? currentStep);
      setSuggestions(data.suggestions ?? []);
      if (data.completed) { setSessionComplete(true); setSuggestions([]); await refreshCalendar(); }
    } finally {
      setLoading(false);
    }
  }

  async function logout() {
    await fetch('/api/auth/logout', { method: 'POST' });
    router.push('/');
  }

  if (!authChecked) {
    return (
      <div className="h-screen flex items-center justify-center bg-surface">
        <div className="w-6 h-6 border-2 border-brand-purple/30 border-t-brand-purple rounded-full animate-spin" />
      </div>
    );
  }

  // ─── Sidebar ───────────────────────────────────────────────────────────────

  // Group days by month for demarcators
  const groupedDays = calendarDays.reduce<{ month: string; days: CalendarDay[] }[]>((acc, day) => {
    const last = acc[acc.length - 1];
    if (!last || last.month !== day.month) acc.push({ month: day.month, days: [day] });
    else last.days.push(day);
    return acc;
  }, []);

  const sidebar = (
    <aside className={`
      w-64 bg-white border-r border-gray-100 flex flex-col h-full
      fixed md:relative z-30 top-0 left-0 transition-transform duration-300
      ${sidebarOpen ? 'translate-x-0' : '-translate-x-full'} md:translate-x-0
    `}>
      {/* Streak */}
      <div className="px-5 pt-6 pb-4 border-b border-gray-100">
        <div className="flex items-center justify-between mb-1">
          <span className="text-xs font-medium text-gray-400 uppercase tracking-wider">Current streak</span>
          <button className="md:hidden w-6 h-6 flex items-center justify-center rounded" onClick={() => setSidebarOpen(false)}>
            <svg className="w-4 h-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>
        <div className="flex items-baseline gap-1">
          <span className="text-4xl font-bold text-gray-900">{streak}</span>
          <span className="text-sm text-gray-400 font-medium">{streak === 1 ? 'day' : 'days'}</span>
        </div>
        {streak === 0 && <p className="text-xs text-gray-400 mt-1">Complete today's session to start your streak</p>}
        {streak > 0 && <p className="text-xs text-gray-400 mt-1">Keep it going</p>}
      </div>

      {/* Nav items */}
      <div className="px-3 py-3 border-b border-gray-100">
        <button
          onClick={() => { setSidebarOpen(false); setShowCalendar(true); }}
          className="flex items-center gap-2.5 w-full px-3 py-2 rounded-lg text-xs font-medium text-gray-600 hover:bg-surface transition-colors"
        >
          <svg className="w-4 h-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
          </svg>
          Calendar
        </button>
        <button
          onClick={() => { setSidebarOpen(false); setShowCustomise(true); }}
          className="flex items-center gap-2.5 w-full px-3 py-2 rounded-lg text-xs font-medium text-gray-600 hover:bg-surface transition-colors"
        >
          <svg className="w-4 h-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 6V4m0 2a2 2 0 100 4m0-4a2 2 0 110 4m-6 8a2 2 0 100-4m0 4a2 2 0 110-4m0 4v2m0-6V4m6 6v10m6-2a2 2 0 100-4m0 4a2 2 0 110-4m0 4v2m0-6V4" />
          </svg>
          Customise
        </button>
      </div>

      {/* Chats list */}
      <div className="flex-1 overflow-y-auto">
        <button
          onClick={() => setChatsCollapsed(v => !v)}
          className="flex items-center justify-between w-full px-5 py-3 text-xs font-medium text-gray-400 uppercase tracking-wider hover:text-gray-600 transition-colors"
        >
          <span>Chats</span>
          <svg className={`w-3.5 h-3.5 transition-transform ${chatsCollapsed ? '-rotate-90' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
          </svg>
        </button>

        {!chatsCollapsed && (
          <div className="px-2 pb-4">
            {groupedDays.map(({ month, days }) => (
              <div key={month}>
                {/* Only show month header if not the first/current month and it changes */}
                {days[0] && !days[0].isToday && days[0] === groupedDays.find(g => g.month === month)?.days[0] && (
                  <p className="text-xs text-gray-300 font-medium px-3 pt-3 pb-1">{month}</p>
                )}
                {days.map(day => (
                  <DayEntry
                    key={day.date}
                    day={day}
                    isSelected={viewChatId === day.chatId || (day.isToday && !viewChatId)}
                    onSelect={() => handleDaySelect(day)}
                    onDelete={() => day.chatId ? handleDelete(day.chatId, day.isToday) : undefined}
                    onRedo={handleRedo}
                    onCopy={() => day.chatId ? handleCopy(day.chatId) : undefined}
                  />
                ))}
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Footer */}
      <div className="px-4 py-4 border-t border-gray-100 space-y-1">
        {user?.isAdmin && (
          <button onClick={() => router.push('/admin')} className="flex items-center gap-2.5 w-full px-3 py-2 rounded-lg text-xs font-medium text-gray-500 hover:bg-surface">
            <svg className="w-4 h-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
            </svg>
            Admin
          </button>
        )}
        <button onClick={logout} className="flex items-center gap-2.5 w-full px-3 py-2 rounded-lg text-xs font-medium text-gray-400 hover:bg-surface hover:text-gray-600">
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
          </svg>
          Sign out
        </button>
      </div>
    </aside>
  );

  // ─── Past day (read-only) view ─────────────────────────────────────────────

  const pastDayView = viewChatId && (
    <div className="flex flex-col h-full">
      <div className="flex items-center gap-3 px-4 py-3 border-b border-gray-100 bg-white flex-shrink-0">
        <button onClick={closeView} className="w-7 h-7 rounded-lg hover:bg-surface flex items-center justify-center">
          <svg className="w-4 h-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" />
          </svg>
        </button>
        <div>
          <p className="text-sm font-semibold text-gray-800">
            {viewDate ? new Date(viewDate + 'T12:00:00').toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'long' }) : 'Past session'}
          </p>
          <p className="text-xs text-gray-400">Read-only</p>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto px-4 py-4 space-y-4">
        {viewLoading ? (
          <div className="flex justify-center pt-10">
            <div className="w-5 h-5 border-2 border-brand-purple/30 border-t-brand-purple rounded-full animate-spin" />
          </div>
        ) : viewMessages.length === 0 ? (
          <p className="text-center text-xs text-gray-400 pt-10">No messages in this session.</p>
        ) : (
          viewMessages.map(msg => <MessageBubble key={msg.id} message={msg} showWidgets={prefs.showBreathing && prefs.showAppFeatures} />)
        )}
      </div>

      <p className="text-center text-xs text-gray-300 py-2 flex-shrink-0 bg-white">
        Not medical advice · Untire Coach
      </p>
    </div>
  );

  // ─── Today: Check-in (step 0) ──────────────────────────────────────────────

  const checkInView = !viewChatId && currentStep === 0 && (
    <div className="flex flex-col h-full overflow-y-auto">
      <div className="flex items-center justify-between px-4 py-3 bg-white border-b border-gray-100 flex-shrink-0 md:hidden">
        <button onClick={() => setSidebarOpen(true)} className="w-8 h-8 flex items-center justify-center rounded-lg hover:bg-surface">
          <svg className="w-5 h-5 text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
          </svg>
        </button>
        <span className="text-sm font-semibold text-gray-800">Untire Coach</span>
        <div className="w-8" />
      </div>

      <div className="flex-1 px-6 py-8 max-w-lg mx-auto w-full">
        <div className="mb-8">
          <p className="text-sm text-gray-400 mb-1">{getGreeting()}, {user?.username}</p>
          <h2 className="text-xl font-semibold text-gray-900 mb-1">How are you today?</h2>
          <p className="text-xs text-gray-400">Select up to 3 that feel most true right now</p>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 mb-6">
          {CHECK_IN_OPTIONS.map((option, index) => {
            const selected = selections.includes(option.id);
            return (
              <button
                key={option.id}
                onClick={() => toggleSelection(option.id)}
                className={`flex items-center gap-3 px-4 py-3 rounded-xl border text-left transition-all active:scale-[0.98] opacity-0 animate-fade-in text-sm ${
                  selected
                    ? 'bg-brand-purple border-brand-purple text-white shadow-md shadow-brand-purple/20 font-medium'
                    : 'bg-white border-gray-200 text-gray-700 hover:border-brand-purple/30 hover:bg-brand-purple-pale/40'
                }`}
                style={{ animationDelay: `${index * 50}ms`, animationFillMode: 'forwards' }}
              >
                <span className={`w-1.5 h-1.5 rounded-full flex-shrink-0 ${selected ? 'bg-white' : 'bg-brand-purple/30'}`} />
                {option.label}
              </button>
            );
          })}
        </div>

        <button
          onClick={sendSelections}
          disabled={selections.length === 0 || loading}
          className="w-full py-3.5 rounded-xl bg-brand-purple text-white font-semibold text-sm hover:bg-brand-purple-light active:scale-[0.98] transition-all disabled:opacity-40 disabled:cursor-not-allowed shadow-lg shadow-brand-purple/20"
        >
          {loading ? (
            <span className="flex items-center justify-center gap-2">
              <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
              Starting...
            </span>
          ) : `Continue${selections.length > 0 ? ` — ${selections.length} selected` : ''}`}
        </button>
      </div>
    </div>
  );

  // ─── Today: Coaching chat (steps 1-4 + free) ──────────────────────────────

  const chatView = !viewChatId && currentStep > 0 && (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 bg-white border-b border-gray-100 flex-shrink-0">
        <div className="flex items-center gap-2">
          <button onClick={() => setSidebarOpen(true)} className="w-7 h-7 flex items-center justify-center rounded-lg hover:bg-surface md:hidden">
            <svg className="w-5 h-5 text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
            </svg>
          </button>
          <div className="hidden md:block">
            <p className="text-sm font-semibold text-gray-800">
              {new Date().toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'long' })}
            </p>
          </div>
        </div>
        {sessionComplete && (
          <span className="text-xs font-medium text-brand-teal flex items-center gap-1.5">
            <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" />
            </svg>
            Session complete
          </span>
        )}
      </div>

      {/* Risk banner */}
      {riskShown && (
        <div className="mx-4 mt-3 p-3 rounded-xl bg-red-50 border border-red-200 flex items-center gap-2 text-xs text-red-700 flex-shrink-0">
          <svg className="w-4 h-4 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
          </svg>
          If you are in crisis, please call 0800-0113 (free, 24/7 Netherlands)
        </div>
      )}

      {/* Messages */}
      <div className="flex-1 overflow-y-auto px-4 py-4 space-y-4">
        {messages.map(msg => (
          <MessageBubble
            key={msg.id}
            message={msg}
            showWidgets={prefs.showBreathing || prefs.showAppFeatures}
          />
        ))}
        {loading && <TypingIndicator />}
        <div ref={messagesEndRef} />
      </div>

      {/* Input area */}

      {/* Quick reply suggestions (steps 1-3) — user must pick to advance */}
      {suggestions.length > 0 && !loading && !sessionComplete && (
        <div className="px-4 py-3 bg-white border-t border-gray-100 flex-shrink-0 space-y-2">
          {suggestions.map((s, i) => (
            <button
              key={i}
              onClick={() => sendQuickReply(s)}
              className="w-full text-left px-4 py-2.5 rounded-xl border border-gray-200 bg-white text-sm text-gray-700 hover:border-brand-purple/40 hover:bg-brand-purple-pale/30 transition-all active:scale-[0.99]"
            >
              {s}
            </button>
          ))}
          <div className="flex gap-2 pt-1">
            <input
              type="text"
              value={inputText}
              onChange={e => setInputText(e.target.value)}
              onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); if (inputText.trim()) sendMessage(); } }}
              placeholder="Or type your own response..."
              className="flex-1 px-3 py-2 rounded-xl border border-gray-200 bg-surface text-sm focus:outline-none focus:ring-2 focus:ring-brand-purple/20 focus:border-brand-purple"
            />
            {inputText.trim() && (
              <button onClick={sendMessage} className="px-4 py-2 rounded-xl bg-brand-purple text-white text-sm font-medium flex-shrink-0">
                Send
              </button>
            )}
          </div>
        </div>
      )}

      {/* Free chat input (after session complete or step 4, no suggestions) */}
      {(sessionComplete || currentStep === 4) && suggestions.length === 0 && (
        <div className="px-4 py-3 bg-white border-t border-gray-100 flex-shrink-0">
          <div className="flex gap-2">
            <input
              type="text"
              value={inputText}
              onChange={e => setInputText(e.target.value)}
              onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); sendMessage(); } }}
              placeholder="Continue the conversation..."
              className="flex-1 px-4 py-2.5 rounded-xl border border-gray-200 bg-surface text-sm focus:outline-none focus:ring-2 focus:ring-brand-purple/20 focus:border-brand-purple"
              disabled={loading}
            />
            <button
              onClick={sendMessage}
              disabled={loading || !inputText.trim()}
              className="px-4 py-2.5 rounded-xl bg-brand-purple text-white text-sm font-medium hover:bg-brand-purple-light transition-all disabled:opacity-50 flex-shrink-0"
            >
              {loading ? <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin block" /> : 'Send'}
            </button>
          </div>
        </div>
      )}

      <p className="text-center text-xs text-gray-300 py-2 flex-shrink-0 bg-white">
        Not medical advice · Untire Coach
      </p>
    </div>
  );

  // ─── Render ────────────────────────────────────────────────────────────────

  return (
    <div className="h-screen flex bg-surface overflow-hidden">
      {sidebar}

      {/* Mobile overlay */}
      {sidebarOpen && (
        <div className="fixed inset-0 bg-black/30 z-20 md:hidden" onClick={() => setSidebarOpen(false)} />
      )}

      {/* Main content */}
      <main className="flex-1 flex flex-col min-w-0 bg-surface overflow-hidden">
        {!viewChatId && currentStep === 0 && checkInView}
        {!viewChatId && currentStep > 0 && chatView}
        {viewChatId && pastDayView}
      </main>

      {/* Copy confirmation toast */}
      {copyConfirm && (
        <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-50 bg-gray-900 text-white text-xs font-medium px-4 py-2.5 rounded-xl shadow-lg animate-fade-in">
          Link copied to clipboard
        </div>
      )}

      {/* Calendar modal */}
      {showCalendar && (
        <CalendarModal
          days={calendarDays}
          onClose={() => setShowCalendar(false)}
          onSelectDay={date => {
            const day = calendarDays.find(d => d.date === date);
            if (day?.chatId) openDayView(day.chatId, date);
          }}
        />
      )}

      {/* Customise modal */}
      {showCustomise && (
        <CustomiseModal
          prefs={prefs}
          onClose={() => setShowCustomise(false)}
          onSave={setPrefs}
        />
      )}
    </div>
  );
}
