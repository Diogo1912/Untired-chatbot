import { cookies } from 'next/headers';
import { randomBytes } from 'crypto';
import { createSession, getSession, getUserById } from './db';

export async function getAuthUser(): Promise<{ id: string; username: string; isAdmin: boolean } | null> {
  const cookieStore = await cookies();
  const sessionId = cookieStore.get('sessionId')?.value;
  if (!sessionId) return null;

  const session = getSession(sessionId);
  if (!session) return null;

  const user = getUserById(session.user_id);
  if (!user) return null;

  return { id: user.id, username: user.username, isAdmin: user.is_admin === 1 };
}

export async function requireAuth() {
  const user = await getAuthUser();
  if (!user) throw new Error('UNAUTHORIZED');
  return user;
}

export async function requireAdmin() {
  const user = await requireAuth();
  if (!user.isAdmin) throw new Error('FORBIDDEN');
  return user;
}

export function createSessionToken(userId: string): string {
  const sessionId = randomBytes(32).toString('hex');
  const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString();
  createSession(userId, sessionId, expiresAt);
  return sessionId;
}
