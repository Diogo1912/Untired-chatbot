import { NextRequest, NextResponse } from 'next/server';
import { requireAuth } from '@/lib/auth';
import {
  getChatById, createChat, addMessage, getChatMessages,
  updateChatStep, markChatCompleted, getProfile, insertTrace, insertRiskEvent,
  getTodayChat, getCalendarChats, getUserStreak, getUserPreferences, getUserById,
} from '@/lib/db';
import { getOpenRouter, PRIMARY_MODEL, EVAL_MODEL, calculateCost } from '@/lib/llm';
import { parseFlowState, getSystemPromptForStep, FlowStep, CHECK_IN_OPTIONS } from '@/lib/flow';
import { detectRisk, detectRiskLLM, RISK_RESPONSE } from '@/lib/risk';
import { retrieveContext } from '@/lib/rag';
import { runEval } from '@/lib/eval';
import { checkRateLimit } from '@/lib/rateLimit';

const VALID_CHECK_IN_IDS = new Set(CHECK_IN_OPTIONS.map(o => o.id));
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

// ─── Tool definitions ─────────────────────────────────────────────────────────

const COACHING_TOOLS = [
  {
    type: 'function',
    function: {
      name: 'show_breathing_exercise',
      description: 'Show the user an interactive animated breathing exercise widget. Use when the user is anxious, stressed, overwhelmed, or would benefit from a calming exercise.',
      parameters: {
        type: 'object',
        properties: {
          type: {
            type: 'string',
            enum: ['box', '478', 'coherent'],
            description: 'box = 4-4-4-4 for stress; 478 = 4-7-8 for anxiety/sleep; coherent = 5-5 for general relaxation',
          },
          intro: {
            type: 'string',
            description: 'One warm sentence introducing the exercise (e.g. "A short breathing exercise might help right now.")',
          },
        },
        required: ['type', 'intro'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'suggest_app_feature',
      description: 'Show a card suggesting a relevant Untire Now app feature. Use when a specific feature would directly help the user with what they are experiencing.',
      parameters: {
        type: 'object',
        properties: {
          feature: {
            type: 'string',
            enum: ['energy_map', 'activity_planner', 'pacing_guide', 'sleep_tracker'],
            description: 'energy_map: for tracking energy patterns; activity_planner: for scheduling within energy limits; pacing_guide: for balancing rest/activity; sleep_tracker: for sleep-fatigue connection',
          },
          intro: {
            type: 'string',
            description: 'One warm sentence explaining why this feature might help them.',
          },
        },
        required: ['feature', 'intro'],
      },
    },
  },
] as const;

const BREATHING_PATTERNS: Record<string, { label: string; phases: Array<{ label: string; duration: number }> }> = {
  box: {
    label: 'Box Breathing',
    phases: [
      { label: 'Inhale', duration: 4 },
      { label: 'Hold', duration: 4 },
      { label: 'Exhale', duration: 4 },
      { label: 'Hold', duration: 4 },
    ],
  },
  '478': {
    label: '4-7-8 Breathing',
    phases: [
      { label: 'Inhale', duration: 4 },
      { label: 'Hold', duration: 7 },
      { label: 'Exhale', duration: 8 },
    ],
  },
  coherent: {
    label: 'Coherent Breathing',
    phases: [
      { label: 'Inhale', duration: 5 },
      { label: 'Exhale', duration: 5 },
    ],
  },
};

function resolveToolWidget(name: string, args: Record<string, any>): any | null {
  if (name === 'show_breathing_exercise') {
    const pattern = BREATHING_PATTERNS[args.type] ?? BREATHING_PATTERNS.coherent;
    return { type: 'breathing_exercise', exercise: pattern, intro: args.intro };
  }
  if (name === 'suggest_app_feature') {
    return { type: 'app_feature', feature: args.feature, intro: args.intro };
  }
  return null;
}

// ─── LLM call with optional tool support ─────────────────────────────────────

async function callLLM(
  systemPrompt: string,
  conversationMessages: { role: string; content: string }[],
  maxTokens: number,
  useTools: boolean,
): Promise<{
  text: string;
  widget: any | null;
  tokensIn: number;
  tokensOut: number;
  latencyMs: number;
}> {
  const client = getOpenRouter();
  const start = Date.now();

  const completion = await client.chat.completions.create({
    model: PRIMARY_MODEL,
    messages: [
      { role: 'system', content: systemPrompt },
      ...conversationMessages,
    ] as any,
    ...(useTools ? { tools: COACHING_TOOLS as any, tool_choice: 'auto' } : {}),
    max_tokens: maxTokens,
    temperature: 0.75,
  });

  const choice = completion.choices[0];
  const text = choice.message.content ?? '';
  let widget: any = null;

  if (useTools && choice.message.tool_calls?.length) {
    try {
      const toolCall = choice.message.tool_calls[0];
      const args = JSON.parse(toolCall.function.arguments);
      widget = resolveToolWidget(toolCall.function.name, args);
    } catch { /* ignore malformed tool call */ }
  }

  return {
    text,
    widget,
    tokensIn: completion.usage?.prompt_tokens ?? 0,
    tokensOut: completion.usage?.completion_tokens ?? 0,
    latencyMs: Date.now() - start,
  };
}

// ─── Quick reply generator ────────────────────────────────────────────────────

async function generateQuickReplies(aiResponse: string, context: string): Promise<string[]> {
  try {
    const client = getOpenRouter();
    const res = await client.chat.completions.create({
      model: EVAL_MODEL,
      messages: [
        {
          role: 'system',
          content: 'You help users navigate a cancer fatigue coaching conversation. Based on the AI coach\'s message, generate exactly 3 short follow-up options (max 8 words each) the user might say next. These should feel personal and help deepen the conversation — not generic. Return ONLY a valid JSON array of 3 strings, nothing else. Example: ["I\'ve been struggling with sleep a lot", "I want to talk about pacing myself", "That really resonates with me"]',
        },
        {
          role: 'user',
          content: `User context: ${context}\n\nAI coach said: "${aiResponse.slice(0, 400)}"\n\nGenerate 3 follow-up options:`,
        },
      ],
      max_tokens: 150,
      temperature: 0.85,
    });
    const text = res.choices[0].message.content?.trim() ?? '[]';
    const match = text.match(/\[[\s\S]*?\]/);
    if (match) {
      const parsed = JSON.parse(match[0]);
      if (Array.isArray(parsed)) return parsed.slice(0, 3).map(String);
    }
    return [];
  } catch {
    return [];
  }
}

// ─── Route handlers ───────────────────────────────────────────────────────────

export async function POST(req: NextRequest) {
  try {
    const user = await requireAuth();
    const body = await req.json();
    let { chatId, message, step, selections } = body;

    // ─── Input validation ──────────────────────────────────────────────
    if (message !== undefined && message !== null) {
      if (typeof message !== 'string') return NextResponse.json({ error: 'message must be a string' }, { status: 400 });
      message = message.trim().slice(0, 2000);
      if (!message) message = undefined;
    }
    if (step !== undefined && (typeof step !== 'number' || step < 0 || step > 4 || !Number.isInteger(step))) {
      return NextResponse.json({ error: 'step must be an integer 0-4' }, { status: 400 });
    }
    if (selections !== undefined) {
      if (!Array.isArray(selections) || selections.length > 3 || !selections.every((s: any) => typeof s === 'string' && VALID_CHECK_IN_IDS.has(s))) {
        return NextResponse.json({ error: 'Invalid selections' }, { status: 400 });
      }
    }
    if (chatId !== undefined && chatId !== null && (typeof chatId !== 'string' || !UUID_RE.test(chatId))) {
      return NextResponse.json({ error: 'Invalid chatId format' }, { status: 400 });
    }

    // ─── Rate limiting ─────────────────────────────────────────────────
    const rateCheck = checkRateLimit(user.id);
    if (!rateCheck.allowed) {
      return NextResponse.json(
        { error: 'Rate limit exceeded. Please try again later.' },
        { status: 429, headers: { 'Retry-After': String(Math.ceil((rateCheck.retryAfterMs ?? 60000) / 1000)) } },
      );
    }

    let chat = chatId ? getChatById(chatId) : null;
    if (!chat) {
      chat = createChat(user.id);
    }

    const flowState = parseFlowState(chat.flow_state);
    const profile = getProfile(user.id);
    const userPrefs = getUserPreferences(user.id);
    const customPrompt = userPrefs?.custom_prompt ?? '';

    // Risk check on every user message
    if (message && typeof message === 'string') {
      const risk = detectRisk(message);
      if (risk.triggered) {
        insertRiskEvent({ userId: user.id, chatId: chat.id, messageContent: message, triggerType: risk.triggerType, severity: risk.severity });
        addMessage(chat.id, 'user', message, flowState.step);
        const msgId = addMessage(chat.id, 'assistant', RISK_RESPONSE, flowState.step);
        insertTrace({ userId: user.id, chatId: chat.id, messageId: msgId, flowStep: flowState.step, model: PRIMARY_MODEL, tokensIn: 0, tokensOut: 0, latencyMs: 0, costUsd: 0, ragChunks: 0, riskTriggered: true });
        return NextResponse.json({ chatId: chat.id, response: RISK_RESPONSE, riskTriggered: true, step: flowState.step });
      }
      // LLM risk detection runs in background as safety net (non-blocking)
      detectRiskLLM(message).then(llmRisk => {
        if (llmRisk.triggered) {
          insertRiskEvent({ userId: user.id, chatId: chat.id, messageContent: message!, triggerType: 'llm_analysis', severity: llmRisk.severity });
        }
      }).catch(() => {});
    }

    // Step 0 → advance to step 1 (Acknowledgement)
    if (step === 0 && selections?.length > 0) {
      const newState = { step: 1 as FlowStep, userSelections: selections };
      updateChatStep(chat.id, 1, newState);

      const { chunks, count, topSimilarity } = await retrieveContext(selections.join(' '), 2);
      const systemPrompt = getSystemPromptForStep(1, selections, profile, chunks.join('\n\n'), profile?.dynamic_profile ?? '', customPrompt);
      const { text, tokensIn, tokensOut, latencyMs } = await callLLM(
        systemPrompt, [{ role: 'user', content: `I selected: ${selections.join(', ')}` }], 300, false,
      );
      const suggestions = await generateQuickReplies(text, selections.join(', '));

      const cost = calculateCost(PRIMARY_MODEL, tokensIn, tokensOut);
      const msgId = addMessage(chat.id, 'assistant', text, 1);
      insertTrace({ userId: user.id, chatId: chat.id, messageId: msgId, flowStep: 1, model: PRIMARY_MODEL, tokensIn, tokensOut, latencyMs, costUsd: cost, ragChunks: count, riskTriggered: false, ragTopSimilarity: topSimilarity });
      runEval(msgId, chat.id, text, 1, `I selected: ${selections.join(', ')}`).catch(() => {});

      return NextResponse.json({ chatId: chat.id, response: text, step: 1, nextStep: 2, suggestions });
    }

    // Steps 1→4: advance flow
    if (step >= 1 && step <= 3) {
      const nextStep = (step + 1) as FlowStep;
      const currentState = parseFlowState(chat.flow_state);
      const currentSelections = currentState.userSelections ?? [];

      if (message) addMessage(chat.id, 'user', message, step as FlowStep);

      const { chunks, count, topSimilarity } = await retrieveContext(currentSelections.join(' ') + ' ' + (message ?? ''), 3);
      const systemPrompt = getSystemPromptForStep(nextStep, currentSelections, profile, chunks.join('\n\n'), profile?.dynamic_profile ?? '', customPrompt);

      const history = getChatMessages(chat.id).slice(-6).map(m => ({ role: m.role as 'user' | 'assistant', content: m.content }));
      const inputMessages = [
        ...history,
        ...(message ? [] : [{ role: 'user' as const, content: 'Continue to the next step.' }]),
      ];

      // Tools enabled at steps 3 and 4
      const useTools = nextStep >= 3;
      const maxTokens = nextStep === 2 ? 250 : 350;

      const { text, widget, tokensIn, tokensOut, latencyMs } = await callLLM(systemPrompt, inputMessages, maxTokens, useTools);
      const cost = calculateCost(PRIMARY_MODEL, tokensIn, tokensOut);

      updateChatStep(chat.id, nextStep, { ...currentState, step: nextStep });
      const msgId = addMessage(chat.id, 'assistant', text, nextStep, widget ?? undefined);
      insertTrace({ userId: user.id, chatId: chat.id, messageId: msgId, flowStep: nextStep, model: PRIMARY_MODEL, tokensIn, tokensOut, latencyMs, costUsd: cost, ragChunks: count, riskTriggered: false, ragTopSimilarity: topSimilarity });

      if (nextStep === 4) {
        markChatCompleted(chat.id);
        import('@/lib/profileExtractor').then(({ extractAndUpdateProfile }) => {
          extractAndUpdateProfile(user.id, chat.id).catch(() => {});
        });
      }
      runEval(msgId, chat.id, text, nextStep, message ?? undefined, history).catch(() => {});

      // Offer quick replies at steps 2 and 3 so user always actively responds
      const suggestions = (nextStep === 2 || nextStep === 3)
        ? await generateQuickReplies(text, currentSelections.join(', '))
        : [];

      return NextResponse.json({ chatId: chat.id, response: text, widget, step: nextStep, completed: nextStep === 4, suggestions });
    }

    // Free conversation after session
    if (message) {
      addMessage(chat.id, 'user', message, 4);
      const currentState = parseFlowState(chat.flow_state);
      const { chunks, count, topSimilarity } = await retrieveContext(message, 2);
      const systemPrompt = getSystemPromptForStep(3, currentState.userSelections ?? [], profile, chunks.join('\n\n'), profile?.dynamic_profile ?? '', customPrompt);
      const history = getChatMessages(chat.id).slice(-8).map(m => ({ role: m.role as 'user' | 'assistant', content: m.content }));

      const { text, widget, tokensIn, tokensOut, latencyMs } = await callLLM(systemPrompt, history, 400, true);
      const cost = calculateCost(PRIMARY_MODEL, tokensIn, tokensOut);

      const msgId = addMessage(chat.id, 'assistant', text, 4, widget ?? undefined);
      insertTrace({ userId: user.id, chatId: chat.id, messageId: msgId, flowStep: 4, model: PRIMARY_MODEL, tokensIn, tokensOut, latencyMs, costUsd: cost, ragChunks: count, riskTriggered: false, ragTopSimilarity: topSimilarity });
      runEval(msgId, chat.id, text, 4, message, history).catch(() => {});

      return NextResponse.json({ chatId: chat.id, response: text, widget, step: 4, completed: false });
    }

    return NextResponse.json({ error: 'Invalid request' }, { status: 400 });
  } catch (err: any) {
    if (err.message === 'UNAUTHORIZED') return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    console.error('Chat error:', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function GET(req: NextRequest) {
  try {
    const user = await requireAuth();
    const { searchParams } = new URL(req.url);
    const chatId = searchParams.get('chatId');

    if (chatId) {
      const chat = getChatById(chatId);
      if (!chat || chat.user_id !== user.id) return NextResponse.json({ error: 'Not found' }, { status: 404 });
      const messages = getChatMessages(chatId);
      return NextResponse.json({ chat, messages });
    }

    const todayChat = getTodayChat(user.id);
    const calendarChats = getCalendarChats(user.id, 365);
    const streak = getUserStreak(user.id);
    const fullUser = getUserById(user.id);
    return NextResponse.json({ todayChat, calendarChats, streak, userJoinedAt: fullUser?.created_at ?? null });
  } catch (err: any) {
    if (err.message === 'UNAUTHORIZED') return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function DELETE(req: NextRequest) {
  try {
    const user = await requireAuth();
    const { searchParams } = new URL(req.url);
    const chatId = searchParams.get('chatId');
    if (!chatId) return NextResponse.json({ error: 'chatId required' }, { status: 400 });

    const chat = getChatById(chatId);
    if (!chat || chat.user_id !== user.id) return NextResponse.json({ error: 'Not found' }, { status: 404 });

    const { deleteChat } = await import('@/lib/db');
    deleteChat(chatId);
    return NextResponse.json({ ok: true });
  } catch (err: any) {
    if (err.message === 'UNAUTHORIZED') return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
