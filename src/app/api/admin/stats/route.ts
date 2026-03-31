import { NextRequest, NextResponse } from 'next/server';
import { requireAdmin } from '@/lib/auth';
import {
  getAdminStats, getTraceStats, getEvalStats, getTraces, getEvalScores,
  getRiskEvents, getCompletionStats, getEvalCoverage, getEvalStatsByStep,
  getQualityScorecard, getFlaggedResponses, getEvalTrend, getTraceTrend,
  getVolumeTrend, getAllUserAnalytics, getSessionsWithQuality,
  getConversationWithEvals, markEvalReviewed,
} from '@/lib/db';

export async function GET(req: NextRequest) {
  try {
    await requireAdmin();
    const { searchParams } = new URL(req.url);
    const from = searchParams.get('from') ?? undefined;
    const to = searchParams.get('to') ?? undefined;
    const view = searchParams.get('view');

    // Conversation detail view
    if (view === 'conversation') {
      const chatId = searchParams.get('chatId');
      if (chatId) {
        return NextResponse.json({ conversation: getConversationWithEvals(chatId) });
      }
      return NextResponse.json({ sessions: getSessionsWithQuality(from, to, 100) });
    }

    // Trends view
    if (view === 'trends') {
      const days = parseInt(searchParams.get('days') ?? '30');
      return NextResponse.json({
        evalTrend: getEvalTrend(days),
        traceTrend: getTraceTrend(days),
        volumeTrend: getVolumeTrend(days),
      });
    }

    // User analytics view
    if (view === 'users') {
      return NextResponse.json({ userAnalytics: getAllUserAnalytics() });
    }

    // Default: full stats overview
    return NextResponse.json({
      adminStats: getAdminStats(),
      traceStats: getTraceStats(from, to),
      evalStats: getEvalStats(from, to),
      completionStats: getCompletionStats(from, to),
      evalCoverage: getEvalCoverage(from, to),
      evalByStep: getEvalStatsByStep(from, to),
      qualityScorecard: getQualityScorecard(from, to),
      flaggedResponses: getFlaggedResponses(20),
      recentTraces: getTraces(50, from, to),
      recentEvals: getEvalScores(50, from, to),
      riskEvents: getRiskEvents(20, from, to),
    });
  } catch (err: any) {
    if (err.message === 'UNAUTHORIZED' || err.message === 'FORBIDDEN') {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    await requireAdmin();
    const { action, evalId } = await req.json();

    if (action === 'markReviewed' && evalId) {
      markEvalReviewed(evalId);
      return NextResponse.json({ ok: true });
    }

    return NextResponse.json({ error: 'Invalid action' }, { status: 400 });
  } catch (err: any) {
    if (err.message === 'UNAUTHORIZED' || err.message === 'FORBIDDEN') {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
