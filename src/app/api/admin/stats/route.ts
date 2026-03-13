import { NextResponse } from 'next/server';
import { requireAdmin } from '@/lib/auth';
import { getAdminStats, getTraceStats, getEvalStats, getTraces, getEvalScores, getRiskEvents } from '@/lib/db';

export async function GET() {
  try {
    await requireAdmin();
    return NextResponse.json({
      adminStats: getAdminStats(),
      traceStats: getTraceStats(),
      evalStats: getEvalStats(),
      recentTraces: getTraces(50),
      recentEvals: getEvalScores(50),
      riskEvents: getRiskEvents(20),
    });
  } catch (err: any) {
    if (err.message === 'UNAUTHORIZED' || err.message === 'FORBIDDEN') {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
