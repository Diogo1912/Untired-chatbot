import { NextRequest, NextResponse } from 'next/server';
import { deleteSession } from '@/lib/db';

export async function POST(req: NextRequest) {
  const sessionId = req.cookies.get('sessionId')?.value;
  if (sessionId) deleteSession(sessionId);
  const response = NextResponse.json({ success: true });
  response.cookies.delete('sessionId');
  return response;
}
