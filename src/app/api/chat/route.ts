import { NextRequest, NextResponse } from 'next/server';
import { requireAuth } from '@/lib/auth';
import {
  getChatById, createChat, addMessage, getChatMessages,
  updateChatStep, markChatCompleted, getProfile, insertTrace, insertRiskEvent,
  upsertProfile
} from '@/lib/db';
import { getOpenRouter, PRIMARY_MODEL, calculateCost } from '@/lib/llm';
import { parseFlowState, getSystemPromptForStep, FlowStep } from '@/lib/flow';
import { detectRisk, RISK_RESPONSE } from '@/lib/risk';
import { retrieveContext } from '@/lib/rag';
import { runEval } from '@/lib/eval';

export async function POST(req: NextRequest) {
  try {
    const user = await requireAuth();
    const { chatId, message, step, selections } = await req.json();

    // Get or create chat
    let chat = chatId ? getChatById(chatId) : null;
    if (!chat) {
      chat = createChat(user.id);
    }

    const flowState = parseFlowState(chat.flow_state);
    const profile = getProfile(user.id);

    // Risk check on every user message
    let riskTriggered = false;
    if (message && typeof message === 'string') {
      const risk = detectRisk(message);
      if (risk.triggered) {
        riskTriggered = true;
        insertRiskEvent({
          userId: user.id,
          chatId: chat.id,
          messageContent: message,
          triggerType: risk.triggerType,
          severity: risk.severity,
        });

        // Save user message and risk response
        addMessage(chat.id, 'user', message, flowState.step);
        const msgId = addMessage(chat.id, 'assistant', RISK_RESPONSE, flowState.step);

        insertTrace({
          userId: user.id, chatId: chat.id, messageId: msgId,
          flowStep: flowState.step, model: PRIMARY_MODEL,
          tokensIn: 0, tokensOut: 0, latencyMs: 0, costUsd: 0,
          ragChunks: 0, riskTriggered: true,
        });

        return NextResponse.json({
          chatId: chat.id,
          response: RISK_RESPONSE,
          riskTriggered: true,
          step: flowState.step,
        });
      }
    }

    // Step 0: user submitted selections — advance to step 1
    if (step === 0 && selections?.length > 0) {
      const newState = { step: 1 as FlowStep, userSelections: selections };
      updateChatStep(chat.id, 1, newState);

      // Generate step 1 acknowledgement
      const { chunks, count } = await retrieveContext(selections.join(' '), 2);
      const ragContext = chunks.join('\n\n');
      const systemPrompt = getSystemPromptForStep(1, selections, profile, ragContext, profile?.dynamic_profile ?? '');

      const start = Date.now();
      const client = getOpenRouter();
      const completion = await client.chat.completions.create({
        model: PRIMARY_MODEL,
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: `I selected: ${selections.join(', ')}` },
        ],
        max_tokens: 300,
        temperature: 0.75,
      });

      const latency = Date.now() - start;
      const response = completion.choices[0].message.content ?? '';
      const tokensIn = completion.usage?.prompt_tokens ?? 0;
      const tokensOut = completion.usage?.completion_tokens ?? 0;
      const cost = calculateCost(PRIMARY_MODEL, tokensIn, tokensOut);

      const msgId = addMessage(chat.id, 'assistant', response, 1);
      insertTrace({ userId: user.id, chatId: chat.id, messageId: msgId, flowStep: 1, model: PRIMARY_MODEL, tokensIn, tokensOut, latencyMs: latency, costUsd: cost, ragChunks: count, riskTriggered: false });

      // Fire eval async
      runEval(msgId, chat.id, response, 1).catch(() => {});

      return NextResponse.json({ chatId: chat.id, response, step: 1, nextStep: 2 });
    }

    // Steps 2, 3, 4: advance flow
    if (step >= 1 && step <= 3) {
      const nextStep = (step + 1) as FlowStep;
      const currentState = parseFlowState(chat.flow_state);
      const currentSelections = currentState.userSelections ?? [];

      // Save user message if present
      if (message) {
        addMessage(chat.id, 'user', message, step as FlowStep);
      }

      const { chunks, count } = await retrieveContext(currentSelections.join(' ') + ' ' + (message ?? ''), 3);
      const ragContext = chunks.join('\n\n');
      const systemPrompt = getSystemPromptForStep(nextStep, currentSelections, profile, ragContext, profile?.dynamic_profile ?? '');

      const conversationMessages = getChatMessages(chat.id).slice(-6).map(m => ({
        role: m.role as 'user' | 'assistant',
        content: m.content,
      }));

      const start = Date.now();
      const client = getOpenRouter();
      const completion = await client.chat.completions.create({
        model: PRIMARY_MODEL,
        messages: [
          { role: 'system', content: systemPrompt },
          ...conversationMessages,
          ...(message ? [] : [{ role: 'user' as const, content: 'Continue to the next step.' }]),
        ],
        max_tokens: nextStep === 2 ? 250 : 350,
        temperature: 0.75,
      });

      const latency = Date.now() - start;
      const response = completion.choices[0].message.content ?? '';
      const tokensIn = completion.usage?.prompt_tokens ?? 0;
      const tokensOut = completion.usage?.completion_tokens ?? 0;
      const cost = calculateCost(PRIMARY_MODEL, tokensIn, tokensOut);

      updateChatStep(chat.id, nextStep, { ...currentState, step: nextStep });
      const msgId = addMessage(chat.id, 'assistant', response, nextStep);
      insertTrace({ userId: user.id, chatId: chat.id, messageId: msgId, flowStep: nextStep, model: PRIMARY_MODEL, tokensIn, tokensOut, latencyMs: latency, costUsd: cost, ragChunks: count, riskTriggered: false });

      if (nextStep === 4) {
        markChatCompleted(chat.id);
        // Extract profile insights async after session completes
        import('@/lib/profileExtractor').then(({ extractAndUpdateProfile }) => {
          extractAndUpdateProfile(user.id, chat.id).catch(() => {});
        });
      }
      runEval(msgId, chat.id, response, nextStep).catch(() => {});

      return NextResponse.json({ chatId: chat.id, response, step: nextStep, completed: nextStep === 4 });
    }

    // Free conversation after session completes
    if (message) {
      addMessage(chat.id, 'user', message, 4);
      const currentState = parseFlowState(chat.flow_state);
      const { chunks, count } = await retrieveContext(message, 2);
      const ragContext = chunks.join('\n\n');
      const systemPrompt = getSystemPromptForStep(3, currentState.userSelections ?? [], profile, ragContext, profile?.dynamic_profile ?? '');
      const conversationMessages = getChatMessages(chat.id).slice(-8).map(m => ({
        role: m.role as 'user' | 'assistant',
        content: m.content,
      }));

      const start = Date.now();
      const client = getOpenRouter();
      const completion = await client.chat.completions.create({
        model: PRIMARY_MODEL,
        messages: [{ role: 'system', content: systemPrompt }, ...conversationMessages],
        max_tokens: 400,
        temperature: 0.8,
      });

      const latency = Date.now() - start;
      const response = completion.choices[0].message.content ?? '';
      const tokensIn = completion.usage?.prompt_tokens ?? 0;
      const tokensOut = completion.usage?.completion_tokens ?? 0;
      const cost = calculateCost(PRIMARY_MODEL, tokensIn, tokensOut);
      const msgId = addMessage(chat.id, 'assistant', response, 4);
      insertTrace({ userId: user.id, chatId: chat.id, messageId: msgId, flowStep: 4, model: PRIMARY_MODEL, tokensIn, tokensOut, latencyMs: latency, costUsd: cost, ragChunks: count, riskTriggered: false });
      runEval(msgId, chat.id, response, 4).catch(() => {});

      return NextResponse.json({ chatId: chat.id, response, step: 4, completed: false });
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

    const { getUserChats } = await import('@/lib/db');
    const chats = getUserChats(user.id);
    return NextResponse.json({ chats });
  } catch (err: any) {
    if (err.message === 'UNAUTHORIZED') return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
