import { NextRequest, NextResponse } from 'next/server';
import { requireAuth } from '@/lib/auth';
import {
  getChatById, createChat, addMessage, getChatMessages,
  updateChatStep, markChatCompleted, getProfile, insertTrace, insertRiskEvent,
  getTodayChat, getCalendarChats, getUserStreak, getUserPreferences, getUserById,
} from '@/lib/db';
import { getOpenRouter, PRIMARY_MODEL, EVAL_MODEL, calculateCost, resolveModel } from '@/lib/llm';
import { parseFlowState, getSystemPromptForStep, getFreeConversationPrompt, FlowStep, CHECK_IN_OPTIONS, Language } from '@/lib/flow';
import { UNTIRE_THEME_IDS, UNTIRE_THEMES, UNTIRE_EXERCISE_IDS, UNTIRE_EXERCISES, scrubFabricatedContent } from '@/lib/untireContent';
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
      name: 'suggest_content_action',
      description: 'Point the user to a specific theme or exercise that actually exists in the Untire Now app. Use at steps 3-4 or in free conversation to steer toward a concrete next step. Never invent a theme or exercise id — only use values from the enums below.',
      parameters: {
        type: 'object',
        properties: {
          action_type: {
            type: 'string',
            enum: ['read_theme', 'do_exercise', 'read_tips'],
            description: 'read_theme: direct them to one of the 17 themes to read; do_exercise: direct them to one of the exercise categories; read_tips: direct them to the Tips section',
          },
          theme_id: {
            type: 'string',
            enum: UNTIRE_THEME_IDS as unknown as string[],
            description: 'Required when action_type = read_theme. The stable id of a theme from the authoritative inventory.',
          },
          exercise_id: {
            type: 'string',
            enum: UNTIRE_EXERCISE_IDS as unknown as string[],
            description: 'Required when action_type = do_exercise. The stable id of an exercise category from the authoritative inventory.',
          },
          reason: {
            type: 'string',
            description: 'One sentence explaining why this action is relevant right now. Do not describe features that are not listed.',
          },
        },
        required: ['action_type', 'reason'],
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
  if (name === 'suggest_content_action') {
    const actionType = args.action_type;
    if (!['read_theme', 'do_exercise', 'read_tips'].includes(actionType)) return null;

    if (actionType === 'read_theme') {
      const theme = UNTIRE_THEMES.find(t => t.id === args.theme_id);
      if (!theme) return null; // reject hallucinated ids rather than rendering them
      return { type: 'content_action', actionType, themeId: theme.id, themeNameNl: theme.nameNl, themeNameEn: theme.nameEn, reason: args.reason };
    }
    if (actionType === 'do_exercise') {
      const ex = UNTIRE_EXERCISES.find(e => e.id === args.exercise_id);
      if (!ex) return null;
      return { type: 'content_action', actionType, exerciseId: ex.id, exerciseNameNl: ex.nameNl, exerciseNameEn: ex.nameEn, reason: args.reason };
    }
    return { type: 'content_action', actionType, reason: args.reason };
  }
  return null;
}

// ─── LLM call with optional tool support ─────────────────────────────────────

async function callLLM(
  systemPrompt: string,
  conversationMessages: { role: string; content: string }[],
  maxTokens: number,
  useTools: boolean,
  model: string = PRIMARY_MODEL,
  language: Language = 'nl',
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
    model,
    messages: [
      { role: 'system', content: systemPrompt },
      ...conversationMessages,
    ] as any,
    ...(useTools ? { tools: COACHING_TOOLS as any, tool_choice: 'auto' } : {}),
    max_tokens: maxTokens,
    temperature: 0.75,
  });

  const choice = completion.choices[0];
  const rawText = choice.message.content ?? '';
  const { scrubbed, hits } = scrubFabricatedContent(rawText, language);
  if (hits.length > 0) {
    // Visible in server logs so we can quantify how often the model tries to
    // name nonexistent content. If this keeps firing, tighten the prompts.
    console.warn('[untire-content] scrubbed fabricated terms:', hits);
  }
  let widget: any = null;

  if (useTools && choice.message.tool_calls?.length) {
    try {
      const toolCall = choice.message.tool_calls[0];
      const args = JSON.parse(toolCall.function.arguments);
      widget = resolveToolWidget(toolCall.function.name, args);
    } catch { /* ignore malformed tool call */ }
  }

  return {
    text: scrubbed,
    widget,
    tokensIn: completion.usage?.prompt_tokens ?? 0,
    tokensOut: completion.usage?.completion_tokens ?? 0,
    latencyMs: Date.now() - start,
  };
}

// ─── Quick reply generator ────────────────────────────────────────────────────

async function generateQuickReplies(aiResponse: string, context: string, language: Language = 'nl'): Promise<string[]> {
  try {
    const client = getOpenRouter();
    const langNote = language === 'nl' ? ' Write the options in Dutch.' : ' Write the options in English.';
    const example = language === 'nl'
      ? '["Ik heb veel moeite met slapen", "Ik wil het over grenzen hebben", "Dat herken ik"]'
      : '["I\'ve been struggling with sleep a lot", "I want to talk about pacing myself", "That resonates with me"]';
    const res = await client.chat.completions.create({
      model: EVAL_MODEL,
      messages: [
        {
          role: 'system',
          content: `You help users navigate a cancer fatigue coaching conversation. Based on the AI coach's message, generate exactly 3 short follow-up options (max 8 words each) the user might say next. These should feel personal and help deepen the conversation — not generic.${langNote} Return ONLY a valid JSON array of 3 strings, nothing else. Example: ${example}`,
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
    let { chatId, message, step, selections, checkInNote } = body;

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
    if (checkInNote !== undefined && checkInNote !== null) {
      if (typeof checkInNote !== 'string') return NextResponse.json({ error: 'checkInNote must be a string' }, { status: 400 });
      checkInNote = checkInNote.trim().slice(0, 500);
      if (!checkInNote) checkInNote = undefined;
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
    const language: Language = (userPrefs?.language === 'en' ? 'en' : 'nl');
    const activeModel = resolveModel(userPrefs?.primary_model);

    // Risk check on every user message
    if (message && typeof message === 'string') {
      const risk = detectRisk(message);
      if (risk.triggered) {
        insertRiskEvent({ userId: user.id, chatId: chat.id, messageContent: message, triggerType: risk.triggerType, severity: risk.severity });
        addMessage(chat.id, 'user', message, flowState.step);
        const msgId = addMessage(chat.id, 'assistant', RISK_RESPONSE, flowState.step);
        insertTrace({ userId: user.id, chatId: chat.id, messageId: msgId, flowStep: flowState.step, model: activeModel, tokensIn: 0, tokensOut: 0, latencyMs: 0, costUsd: 0, ragChunks: 0, riskTriggered: true });
        return NextResponse.json({ chatId: chat.id, response: RISK_RESPONSE, messageId: msgId, riskTriggered: true, step: flowState.step });
      }
      // LLM risk detection runs in background as safety net (non-blocking)
      detectRiskLLM(message).then(llmRisk => {
        if (llmRisk.triggered) {
          insertRiskEvent({ userId: user.id, chatId: chat.id, messageContent: message!, triggerType: 'llm_analysis', severity: llmRisk.severity });
        }
      }).catch(() => {});
    }

    // Step 0 → advance to step 1 (Acknowledgement). Accept selections, a free-text note, or both.
    if (step === 0 && ((selections?.length ?? 0) > 0 || checkInNote)) {
      const sel = selections ?? [];
      const newState: any = { step: 1 as FlowStep, userSelections: sel };
      if (checkInNote) newState.checkInNote = checkInNote;
      updateChatStep(chat.id, 1, newState);

      // Log user side of the exchange so it's visible in history / transcripts
      const userVisible = [sel.length ? `I selected: ${sel.join(', ')}` : '', checkInNote ? `In my own words: ${checkInNote}` : '']
        .filter(Boolean).join('\n');
      addMessage(chat.id, 'user', userVisible, 0);

      const retrievalQuery = [sel.join(' '), checkInNote ?? ''].filter(Boolean).join(' ');
      const { chunks, count, topSimilarity } = await retrieveContext(retrievalQuery, 2);
      const systemPrompt = getSystemPromptForStep(1, sel, profile, chunks.join('\n\n'), profile?.dynamic_profile ?? '', customPrompt, language, checkInNote);
      const { text, tokensIn, tokensOut, latencyMs } = await callLLM(
        systemPrompt, [{ role: 'user', content: userVisible }], 300, false, activeModel, language,
      );
      const suggestions = await generateQuickReplies(text, [sel.join(', '), checkInNote ?? ''].filter(Boolean).join(' — '), language);

      const cost = calculateCost(activeModel, tokensIn, tokensOut);
      const msgId = addMessage(chat.id, 'assistant', text, 1);
      insertTrace({ userId: user.id, chatId: chat.id, messageId: msgId, flowStep: 1, model: activeModel, tokensIn, tokensOut, latencyMs, costUsd: cost, ragChunks: count, riskTriggered: false, ragTopSimilarity: topSimilarity });
      runEval(msgId, chat.id, text, 1, userVisible).catch(() => {});

      return NextResponse.json({ chatId: chat.id, response: text, messageId: msgId, step: 1, nextStep: 2, suggestions });
    }

    // Steps 1→4: advance flow
    if (step >= 1 && step <= 3) {
      const nextStep = (step + 1) as FlowStep;
      const currentState = parseFlowState(chat.flow_state);
      const currentSelections = currentState.userSelections ?? [];

      if (message) addMessage(chat.id, 'user', message, step as FlowStep);

      const storedNote = (currentState as any).checkInNote as string | undefined;
      const { chunks, count, topSimilarity } = await retrieveContext(currentSelections.join(' ') + ' ' + (message ?? ''), 3);
      const systemPrompt = getSystemPromptForStep(nextStep, currentSelections, profile, chunks.join('\n\n'), profile?.dynamic_profile ?? '', customPrompt, language, storedNote);

      const history = getChatMessages(chat.id).slice(-6).map(m => ({ role: m.role as 'user' | 'assistant', content: m.content }));
      const inputMessages = [
        ...history,
        ...(message ? [] : [{ role: 'user' as const, content: 'Continue to the next step.' }]),
      ];

      // Tools enabled at steps 3 and 4
      const useTools = nextStep >= 3;
      const maxTokens = nextStep === 2 ? 250 : 350;

      const { text, widget, tokensIn, tokensOut, latencyMs } = await callLLM(systemPrompt, inputMessages, maxTokens, useTools, activeModel, language);
      const cost = calculateCost(activeModel, tokensIn, tokensOut);

      updateChatStep(chat.id, nextStep, { ...currentState, step: nextStep });
      const msgId = addMessage(chat.id, 'assistant', text, nextStep, widget ?? undefined);
      insertTrace({ userId: user.id, chatId: chat.id, messageId: msgId, flowStep: nextStep, model: activeModel, tokensIn, tokensOut, latencyMs, costUsd: cost, ragChunks: count, riskTriggered: false, ragTopSimilarity: topSimilarity });

      if (nextStep === 4) {
        markChatCompleted(chat.id);
        import('@/lib/profileExtractor').then(({ extractAndUpdateProfile }) => {
          extractAndUpdateProfile(user.id, chat.id).catch(() => {});
        });
      }
      runEval(msgId, chat.id, text, nextStep, message ?? undefined, history).catch(() => {});

      // Offer quick replies at steps 2 and 3 so user always actively responds
      const suggestions = (nextStep === 2 || nextStep === 3)
        ? await generateQuickReplies(text, currentSelections.join(', '), language)
        : [];

      return NextResponse.json({ chatId: chat.id, response: text, messageId: msgId, widget, step: nextStep, completed: nextStep === 4, suggestions });
    }

    // Free conversation after session
    if (message) {
      addMessage(chat.id, 'user', message, 4);
      const currentState = parseFlowState(chat.flow_state);
      const { chunks, count, topSimilarity } = await retrieveContext(message, 2);
      const systemPrompt = getFreeConversationPrompt(currentState.userSelections ?? [], profile, chunks.join('\n\n'), profile?.dynamic_profile ?? '', customPrompt, language);
      const history = getChatMessages(chat.id).slice(-8).map(m => ({ role: m.role as 'user' | 'assistant', content: m.content }));

      const { text, widget, tokensIn, tokensOut, latencyMs } = await callLLM(systemPrompt, history, 400, true, activeModel, language);
      const cost = calculateCost(activeModel, tokensIn, tokensOut);

      const msgId = addMessage(chat.id, 'assistant', text, 4, widget ?? undefined);
      insertTrace({ userId: user.id, chatId: chat.id, messageId: msgId, flowStep: 4, model: activeModel, tokensIn, tokensOut, latencyMs, costUsd: cost, ragChunks: count, riskTriggered: false, ragTopSimilarity: topSimilarity });
      runEval(msgId, chat.id, text, 4, message, history).catch(() => {});

      return NextResponse.json({ chatId: chat.id, response: text, messageId: msgId, widget, step: 4, completed: false });
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
