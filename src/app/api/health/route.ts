import { NextResponse } from 'next/server';
import { getDb } from '@/lib/db';

const startTime = Date.now();

export async function GET() {
  let dbOk = false;
  try {
    getDb().prepare('SELECT 1').get();
    dbOk = true;
  } catch { /* db unavailable */ }

  const envConfigured = !!process.env.OPENROUTER_API_KEY;
  const status = dbOk && envConfigured ? 'healthy' : 'degraded';

  return NextResponse.json({
    status,
    db_ok: dbOk,
    env_configured: envConfigured,
    uptime_ms: Date.now() - startTime,
    timestamp: new Date().toISOString(),
    version: '2.1.0',
  }, { status: status === 'healthy' ? 200 : 503 });
}
