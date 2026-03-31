import { NextRequest, NextResponse } from 'next/server';
import { requireAdmin } from '@/lib/auth';
import { getTraces, getEvalScores, getRiskEvents, getSessionsWithQuality } from '@/lib/db';

function toCsv(rows: Record<string, any>[]): string {
  if (rows.length === 0) return '';
  const headers = Object.keys(rows[0]);
  const lines = [
    headers.join(','),
    ...rows.map(row =>
      headers.map(h => {
        const val = row[h];
        if (val == null) return '';
        const str = String(val);
        return str.includes(',') || str.includes('"') || str.includes('\n')
          ? `"${str.replace(/"/g, '""')}"`
          : str;
      }).join(',')
    ),
  ];
  return lines.join('\n');
}

export async function GET(req: NextRequest) {
  try {
    await requireAdmin();
    const { searchParams } = new URL(req.url);
    const type = searchParams.get('type') ?? 'traces';
    const from = searchParams.get('from') ?? undefined;
    const to = searchParams.get('to') ?? undefined;

    let data: Record<string, any>[];
    let filename: string;

    switch (type) {
      case 'traces':
        data = getTraces(10000, from, to);
        filename = 'llm_traces';
        break;
      case 'evals':
        data = getEvalScores(10000, from, to);
        filename = 'eval_scores';
        break;
      case 'risks':
        data = getRiskEvents(10000, from, to);
        filename = 'risk_events';
        break;
      case 'sessions':
        data = getSessionsWithQuality(from, to, 10000);
        filename = 'session_quality';
        break;
      default:
        return NextResponse.json({ error: 'Invalid type. Use: traces, evals, risks, sessions' }, { status: 400 });
    }

    const csv = toCsv(data);
    return new NextResponse(csv, {
      headers: {
        'Content-Type': 'text/csv; charset=utf-8',
        'Content-Disposition': `attachment; filename="${filename}_${new Date().toISOString().slice(0, 10)}.csv"`,
      },
    });
  } catch (err: any) {
    if (err.message === 'UNAUTHORIZED' || err.message === 'FORBIDDEN') {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
