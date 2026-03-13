import { NextRequest, NextResponse } from 'next/server';
import { requireAdmin } from '@/lib/auth';
import { getAllUsers, createUser, deleteUser } from '@/lib/db';
import bcrypt from 'bcryptjs';

export async function GET() {
  try {
    await requireAdmin();
    return NextResponse.json({ users: getAllUsers() });
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
    const { username, password, isAdmin } = await req.json();
    if (!username || !password) return NextResponse.json({ error: 'Username and password required' }, { status: 400 });
    const hash = await bcrypt.hash(password, 10);
    const user = createUser(username, hash, isAdmin ? 1 : 0);
    return NextResponse.json({ user });
  } catch (err: any) {
    if (err.message === 'UNAUTHORIZED' || err.message === 'FORBIDDEN') {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function DELETE(req: NextRequest) {
  try {
    const admin = await requireAdmin();
    const { userId } = await req.json();
    if (userId === admin.id) return NextResponse.json({ error: 'Cannot delete yourself' }, { status: 400 });
    deleteUser(userId);
    return NextResponse.json({ success: true });
  } catch (err: any) {
    if (err.message === 'UNAUTHORIZED' || err.message === 'FORBIDDEN') {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
