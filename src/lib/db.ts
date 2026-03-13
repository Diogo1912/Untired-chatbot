import Database from 'better-sqlite3';
import path from 'path';
import { randomUUID } from 'crypto';

const DB_PATH = path.join(process.cwd(), 'untire_coach_v2.db');

let _db: Database.Database | null = null;

export function getDb(): Database.Database {
  if (!_db) {
    _db = new Database(DB_PATH);
    _db.pragma('journal_mode = WAL');
    _db.pragma('foreign_keys = ON');
    initSchema(_db);
  }
  return _db;
}

function initSchema(db: Database.Database) {
  db.exec(`
    CREATE TABLE IF NOT EXISTS users (
      id TEXT PRIMARY KEY,
      username TEXT UNIQUE NOT NULL,
      password_hash TEXT NOT NULL,
      is_admin INTEGER DEFAULT 0,
      created_at TEXT DEFAULT (datetime('now')),
      updated_at TEXT DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS sessions (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL,
      expires_at TEXT NOT NULL,
      created_at TEXT DEFAULT (datetime('now')),
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS profiles (
      id TEXT PRIMARY KEY,
      user_id TEXT UNIQUE NOT NULL,
      name TEXT,
      age INTEGER,
      current_fatigue_level REAL,
      last_fatigue_asked_date TEXT,
      dynamic_profile TEXT,
      created_at TEXT DEFAULT (datetime('now')),
      updated_at TEXT DEFAULT (datetime('now')),
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS chats (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL,
      title TEXT DEFAULT 'Coaching Session',
      flow_step INTEGER DEFAULT 0,
      flow_state TEXT DEFAULT '{}',
      initial_fatigue_level REAL,
      completed INTEGER DEFAULT 0,
      created_at TEXT DEFAULT (datetime('now')),
      updated_at TEXT DEFAULT (datetime('now')),
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS messages (
      id TEXT PRIMARY KEY,
      chat_id TEXT NOT NULL,
      role TEXT NOT NULL,
      content TEXT NOT NULL,
      media TEXT,
      flow_step INTEGER,
      created_at TEXT DEFAULT (datetime('now')),
      FOREIGN KEY (chat_id) REFERENCES chats(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS rag_documents (
      id TEXT PRIMARY KEY,
      title TEXT NOT NULL,
      source TEXT,
      chunk_index INTEGER DEFAULT 0,
      chunk_text TEXT NOT NULL,
      embedding TEXT,
      created_at TEXT DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS llm_traces (
      id TEXT PRIMARY KEY,
      user_id TEXT,
      chat_id TEXT,
      message_id TEXT,
      flow_step INTEGER,
      model TEXT,
      tokens_in INTEGER DEFAULT 0,
      tokens_out INTEGER DEFAULT 0,
      latency_ms INTEGER DEFAULT 0,
      cost_usd REAL DEFAULT 0,
      rag_chunks_retrieved INTEGER DEFAULT 0,
      risk_triggered INTEGER DEFAULT 0,
      created_at TEXT DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS eval_scores (
      id TEXT PRIMARY KEY,
      message_id TEXT NOT NULL,
      chat_id TEXT,
      tone_score INTEGER,
      flow_compliance INTEGER DEFAULT 1,
      length_compliance INTEGER DEFAULT 1,
      safety_pass INTEGER DEFAULT 1,
      eval_model TEXT,
      eval_latency_ms INTEGER,
      eval_reasoning TEXT,
      created_at TEXT DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS risk_events (
      id TEXT PRIMARY KEY,
      user_id TEXT,
      chat_id TEXT,
      message_content TEXT,
      trigger_type TEXT,
      severity TEXT DEFAULT 'moderate',
      created_at TEXT DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS videos (
      id TEXT PRIMARY KEY,
      title TEXT NOT NULL,
      url TEXT NOT NULL,
      embed_url TEXT NOT NULL,
      category TEXT,
      tags TEXT,
      created_at TEXT DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS breathing_exercises (
      id TEXT PRIMARY KEY,
      title TEXT NOT NULL,
      description TEXT,
      duration INTEGER,
      pattern TEXT,
      created_at TEXT DEFAULT (datetime('now'))
    );

    CREATE INDEX IF NOT EXISTS idx_chats_user_id ON chats(user_id);
    CREATE INDEX IF NOT EXISTS idx_messages_chat_id ON messages(chat_id);
    CREATE INDEX IF NOT EXISTS idx_llm_traces_chat_id ON llm_traces(chat_id);
    CREATE INDEX IF NOT EXISTS idx_eval_scores_message_id ON eval_scores(message_id);
    CREATE INDEX IF NOT EXISTS idx_risk_events_user_id ON risk_events(user_id);
  `);

  // Auto-create admin user if none exists
  const adminExists = db.prepare('SELECT id FROM users WHERE is_admin = 1').get();
  if (!adminExists) {
    const bcrypt = require('bcryptjs');
    const hash = bcrypt.hashSync('UntireAdmin2024!', 10);
    const adminId = randomUUID();
    db.prepare(
      'INSERT INTO users (id, username, password_hash, is_admin) VALUES (?, ?, ?, 1)'
    ).run(adminId, 'admin', hash);
  }
}

// ─── User helpers ───────────────────────────────────────────────────────────

export function getUserByUsername(username: string) {
  return getDb().prepare('SELECT * FROM users WHERE username = ?').get(username) as any;
}

export function getUserById(id: string) {
  return getDb().prepare('SELECT id, username, is_admin, created_at FROM users WHERE id = ?').get(id) as any;
}

export function getAllUsers() {
  return getDb().prepare('SELECT id, username, is_admin, created_at FROM users ORDER BY created_at DESC').all() as any[];
}

export function createUser(username: string, passwordHash: string, isAdmin = 0) {
  const id = randomUUID();
  getDb().prepare('INSERT INTO users (id, username, password_hash, is_admin) VALUES (?, ?, ?, ?)').run(id, username, passwordHash, isAdmin);
  return getUserById(id);
}

export function deleteUser(id: string) {
  getDb().prepare('DELETE FROM users WHERE id = ?').run(id);
}

// ─── Session helpers ─────────────────────────────────────────────────────────

export function createSession(userId: string, sessionId: string, expiresAt: string) {
  getDb().prepare('INSERT INTO sessions (id, user_id, expires_at) VALUES (?, ?, ?)').run(sessionId, userId, expiresAt);
}

export function getSession(sessionId: string) {
  return getDb().prepare("SELECT * FROM sessions WHERE id = ? AND expires_at > datetime('now')").get(sessionId) as any;
}

export function deleteSession(sessionId: string) {
  getDb().prepare('DELETE FROM sessions WHERE id = ?').run(sessionId);
}

// ─── Profile helpers ─────────────────────────────────────────────────────────

export function getProfile(userId: string) {
  return getDb().prepare('SELECT * FROM profiles WHERE user_id = ?').get(userId) as any;
}

export function upsertProfile(userId: string, data: Record<string, any>) {
  const existing = getProfile(userId);
  if (existing) {
    const sets = Object.keys(data).map(k => `${k} = ?`).join(', ');
    getDb().prepare(`UPDATE profiles SET ${sets}, updated_at = datetime('now') WHERE user_id = ?`).run(...Object.values(data), userId);
  } else {
    const id = randomUUID();
    const cols = ['id', 'user_id', ...Object.keys(data)].join(', ');
    const placeholders = Array(Object.keys(data).length + 2).fill('?').join(', ');
    getDb().prepare(`INSERT INTO profiles (${cols}) VALUES (${placeholders})`).run(id, userId, ...Object.values(data));
  }
  return getProfile(userId);
}

export function updateDynamicProfile(userId: string, text: string) {
  getDb().prepare("UPDATE profiles SET dynamic_profile = ?, updated_at = datetime('now') WHERE user_id = ?").run(text, userId);
}

// ─── Chat helpers ─────────────────────────────────────────────────────────────

export function createChat(userId: string, initialFatigueLevel?: number) {
  const id = randomUUID();
  getDb().prepare(
    'INSERT INTO chats (id, user_id, initial_fatigue_level) VALUES (?, ?, ?)'
  ).run(id, userId, initialFatigueLevel ?? null);
  return getChatById(id)!;
}

export function getChatById(id: string) {
  return getDb().prepare('SELECT * FROM chats WHERE id = ?').get(id) as any;
}

export function getUserChats(userId: string) {
  return getDb().prepare('SELECT * FROM chats WHERE user_id = ? ORDER BY updated_at DESC LIMIT 20').all(userId) as any[];
}

export function updateChatStep(chatId: string, step: number, state: Record<string, any> = {}) {
  getDb().prepare("UPDATE chats SET flow_step = ?, flow_state = ?, updated_at = datetime('now') WHERE id = ?").run(step, JSON.stringify(state), chatId);
}

export function markChatCompleted(chatId: string) {
  getDb().prepare("UPDATE chats SET completed = 1, updated_at = datetime('now') WHERE id = ?").run(chatId);
}

export function deleteChat(chatId: string) {
  getDb().prepare('DELETE FROM chats WHERE id = ?').run(chatId);
}

// ─── Message helpers ─────────────────────────────────────────────────────────

export function addMessage(chatId: string, role: string, content: string, flowStep?: number, media?: any) {
  const id = randomUUID();
  getDb().prepare(
    'INSERT INTO messages (id, chat_id, role, content, flow_step, media) VALUES (?, ?, ?, ?, ?, ?)'
  ).run(id, chatId, role, content, flowStep ?? null, media ? JSON.stringify(media) : null);
  getDb().prepare("UPDATE chats SET updated_at = datetime('now') WHERE id = ?").run(chatId);
  return id;
}

export function getChatMessages(chatId: string) {
  const rows = getDb().prepare('SELECT * FROM messages WHERE chat_id = ? ORDER BY created_at ASC').all(chatId) as any[];
  return rows.map(r => ({ ...r, media: r.media ? JSON.parse(r.media) : null }));
}

// ─── RAG helpers ─────────────────────────────────────────────────────────────

export function insertRagChunk(title: string, source: string, chunkIndex: number, chunkText: string, embedding: number[]) {
  const id = randomUUID();
  getDb().prepare(
    'INSERT INTO rag_documents (id, title, source, chunk_index, chunk_text, embedding) VALUES (?, ?, ?, ?, ?, ?)'
  ).run(id, title, source, chunkIndex, chunkText, JSON.stringify(embedding));
}

export function getAllRagChunks() {
  const rows = getDb().prepare('SELECT * FROM rag_documents').all() as any[];
  return rows.map(r => ({ ...r, embedding: JSON.parse(r.embedding) }));
}

export function clearRagDocumentsBySource(source: string) {
  getDb().prepare('DELETE FROM rag_documents WHERE source = ?').run(source);
}

// ─── Observability helpers ────────────────────────────────────────────────────

export function insertTrace(data: {
  userId?: string; chatId?: string; messageId?: string; flowStep?: number;
  model: string; tokensIn: number; tokensOut: number; latencyMs: number;
  costUsd: number; ragChunks: number; riskTriggered: boolean;
}) {
  const id = randomUUID();
  getDb().prepare(`
    INSERT INTO llm_traces (id, user_id, chat_id, message_id, flow_step, model, tokens_in, tokens_out, latency_ms, cost_usd, rag_chunks_retrieved, risk_triggered)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(
    id, data.userId ?? null, data.chatId ?? null, data.messageId ?? null,
    data.flowStep ?? null, data.model, data.tokensIn, data.tokensOut,
    data.latencyMs, data.costUsd, data.ragChunks, data.riskTriggered ? 1 : 0
  );
  return id;
}

export function getTraces(limit = 100) {
  return getDb().prepare('SELECT * FROM llm_traces ORDER BY created_at DESC LIMIT ?').all(limit) as any[];
}

export function getTraceStats() {
  return getDb().prepare(`
    SELECT
      COUNT(*) as total_requests,
      AVG(latency_ms) as avg_latency_ms,
      SUM(tokens_in + tokens_out) as total_tokens,
      SUM(cost_usd) as total_cost_usd,
      SUM(risk_triggered) as total_risk_events,
      SUM(rag_chunks_retrieved) as total_rag_retrievals
    FROM llm_traces
  `).get() as any;
}

// ─── Eval helpers ─────────────────────────────────────────────────────────────

export function insertEval(data: {
  messageId: string; chatId?: string; toneScore: number;
  flowCompliance: boolean; lengthCompliance: boolean; safetyPass: boolean;
  evalModel: string; evalLatencyMs: number; evalReasoning?: string;
}) {
  const id = randomUUID();
  getDb().prepare(`
    INSERT INTO eval_scores (id, message_id, chat_id, tone_score, flow_compliance, length_compliance, safety_pass, eval_model, eval_latency_ms, eval_reasoning)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(
    id, data.messageId, data.chatId ?? null, data.toneScore,
    data.flowCompliance ? 1 : 0, data.lengthCompliance ? 1 : 0, data.safetyPass ? 1 : 0,
    data.evalModel, data.evalLatencyMs, data.evalReasoning ?? null
  );
}

export function getEvalScores(limit = 100) {
  return getDb().prepare('SELECT * FROM eval_scores ORDER BY created_at DESC LIMIT ?').all(limit) as any[];
}

export function getEvalStats() {
  return getDb().prepare(`
    SELECT
      COUNT(*) as total_evals,
      AVG(tone_score) as avg_tone_score,
      AVG(CAST(flow_compliance AS REAL)) as flow_compliance_rate,
      AVG(CAST(length_compliance AS REAL)) as length_compliance_rate,
      AVG(CAST(safety_pass AS REAL)) as safety_pass_rate
    FROM eval_scores
  `).get() as any;
}

// ─── Risk event helpers ───────────────────────────────────────────────────────

export function insertRiskEvent(data: {
  userId?: string; chatId?: string; messageContent: string;
  triggerType: string; severity?: string;
}) {
  const id = randomUUID();
  getDb().prepare(`
    INSERT INTO risk_events (id, user_id, chat_id, message_content, trigger_type, severity)
    VALUES (?, ?, ?, ?, ?, ?)
  `).run(id, data.userId ?? null, data.chatId ?? null, data.messageContent, data.triggerType, data.severity ?? 'moderate');
}

export function getRiskEvents(limit = 50) {
  return getDb().prepare('SELECT * FROM risk_events ORDER BY created_at DESC LIMIT ?').all(limit) as any[];
}

// ─── Admin stats ──────────────────────────────────────────────────────────────

export function getAdminStats() {
  const db = getDb();
  return {
    users: (db.prepare('SELECT COUNT(*) as c FROM users WHERE is_admin = 0').get() as any).c,
    sessions: (db.prepare("SELECT COUNT(*) as c FROM chats WHERE completed = 0 AND updated_at > datetime('now', '-1 day')").get() as any).c,
    totalChats: (db.prepare('SELECT COUNT(*) as c FROM chats').get() as any).c,
    totalMessages: (db.prepare('SELECT COUNT(*) as c FROM messages').get() as any).c,
    ragDocuments: (db.prepare('SELECT COUNT(*) as c FROM rag_documents').get() as any).c,
  };
}
