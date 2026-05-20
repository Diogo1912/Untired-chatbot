import Database from 'better-sqlite3';
import path from 'path';
import { randomUUID } from 'crypto';

// DATA_DIR lets Railway (or any host) point to a persistent volume.
// Set DATA_DIR=/data on Railway and mount a volume there.
// Falls back to cwd for local development.
const DATA_DIR = process.env.DATA_DIR ?? process.cwd();
const DB_PATH = path.join(DATA_DIR, 'untire_coach_v2.db');

let _db: Database.Database | null = null;

export function getDb(): Database.Database {
  if (!_db) {
    _db = new Database(DB_PATH);
    _db.exec('PRAGMA journal_mode = WAL');
    _db.exec('PRAGMA foreign_keys = ON');
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

    CREATE TABLE IF NOT EXISTS share_tokens (
      token TEXT PRIMARY KEY,
      chat_id TEXT NOT NULL,
      user_id TEXT NOT NULL,
      created_at TEXT DEFAULT (datetime('now')),
      FOREIGN KEY (chat_id) REFERENCES chats(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS user_preferences (
      user_id TEXT PRIMARY KEY,
      custom_prompt TEXT,
      show_breathing INTEGER DEFAULT 1,
      show_app_features INTEGER DEFAULT 1,
      language TEXT DEFAULT 'nl',
      primary_model TEXT,
      updated_at TEXT DEFAULT (datetime('now')),
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS chat_notes (
      id TEXT PRIMARY KEY,
      chat_id TEXT NOT NULL,
      user_id TEXT NOT NULL,
      note TEXT NOT NULL,
      created_at TEXT DEFAULT (datetime('now')),
      FOREIGN KEY (chat_id) REFERENCES chats(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS message_feedback (
      id TEXT PRIMARY KEY,
      message_id TEXT NOT NULL UNIQUE,
      user_id TEXT NOT NULL,
      chat_id TEXT,
      rating INTEGER NOT NULL,
      reason TEXT,
      created_at TEXT DEFAULT (datetime('now')),
      updated_at TEXT DEFAULT (datetime('now')),
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
    );

    CREATE INDEX IF NOT EXISTS idx_message_feedback_chat_id ON message_feedback(chat_id);
    CREATE INDEX IF NOT EXISTS idx_message_feedback_rating ON message_feedback(rating);

    CREATE TABLE IF NOT EXISTS profile_facts (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL,
      content TEXT NOT NULL,
      created_at TEXT DEFAULT (datetime('now')),
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS app_settings (
      key TEXT PRIMARY KEY,
      value TEXT NOT NULL,
      updated_at TEXT DEFAULT (datetime('now'))
    );

    CREATE INDEX IF NOT EXISTS idx_profile_facts_user_id ON profile_facts(user_id);
    CREATE INDEX IF NOT EXISTS idx_chats_user_id ON chats(user_id);
    CREATE INDEX IF NOT EXISTS idx_messages_chat_id ON messages(chat_id);
    CREATE INDEX IF NOT EXISTS idx_llm_traces_chat_id ON llm_traces(chat_id);
    CREATE INDEX IF NOT EXISTS idx_eval_scores_message_id ON eval_scores(message_id);
    CREATE INDEX IF NOT EXISTS idx_risk_events_user_id ON risk_events(user_id);
  `);

  // ─── Schema migrations (idempotent) ──────────────────────────────────────
  const migrations = [
    'ALTER TABLE eval_scores ADD COLUMN contextual_relevance INTEGER DEFAULT 1',
    'ALTER TABLE eval_scores ADD COLUMN error TEXT',
    'ALTER TABLE eval_scores ADD COLUMN reviewed INTEGER DEFAULT 0',
    'ALTER TABLE llm_traces ADD COLUMN rag_top_similarity REAL',
    "ALTER TABLE user_preferences ADD COLUMN language TEXT DEFAULT 'nl'",
    'ALTER TABLE user_preferences ADD COLUMN primary_model TEXT',
    'ALTER TABLE rag_documents ADD COLUMN theme_name TEXT',
  ];
  for (const m of migrations) {
    try { db.exec(m); } catch { /* column already exists */ }
  }

  // Auto-create admin user if none exists
  const adminExists = db.prepare('SELECT id FROM users WHERE is_admin = 1').get() as any;
  if (!adminExists) {
    const bcrypt = require('bcryptjs');
    const hash = bcrypt.hashSync('UntireAdmin2024!', 10);
    const adminId = randomUUID();
    db.prepare(
      'INSERT INTO users (id, username, password_hash, is_admin) VALUES (?, ?, ?, 1)'
    ).run(adminId, 'admin', hash);
  }
}

// ─── User helpers ────────────────────────────────────────────────────────────

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

// ─── Session helpers ──────────────────────────────────────────────────────────

export function createSession(userId: string, sessionId: string, expiresAt: string) {
  getDb().prepare('INSERT INTO sessions (id, user_id, expires_at) VALUES (?, ?, ?)').run(sessionId, userId, expiresAt);
}

export function getSession(sessionId: string) {
  return getDb().prepare("SELECT * FROM sessions WHERE id = ? AND expires_at > datetime('now')").get(sessionId) as any;
}

export function deleteSession(sessionId: string) {
  getDb().prepare('DELETE FROM sessions WHERE id = ?').run(sessionId);
}

// ─── Profile helpers ──────────────────────────────────────────────────────────

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

// ─── Message helpers ──────────────────────────────────────────────────────────

export function addMessage(chatId: string, role: string, content: string, flowStep?: number, media?: any) {
  const id = randomUUID();
  getDb().prepare(
    'INSERT INTO messages (id, chat_id, role, content, flow_step, media) VALUES (?, ?, ?, ?, ?, ?)'
  ).run(id, chatId, role, content, flowStep ?? null, media ? JSON.stringify(media) : null);
  getDb().prepare("UPDATE chats SET updated_at = datetime('now') WHERE id = ?").run(chatId);
  return id;
}

export function getChatMessages(chatId: string) {
  const rows = getDb().prepare(`
    SELECT m.*, f.rating AS feedback_rating, f.reason AS feedback_reason
    FROM messages m
    LEFT JOIN message_feedback f ON f.message_id = m.id
    WHERE m.chat_id = ?
    ORDER BY m.created_at ASC
  `).all(chatId) as any[];
  return rows.map(r => ({
    ...r,
    media: r.media ? JSON.parse(r.media) : null,
    feedback: r.feedback_rating != null ? { rating: r.feedback_rating, reason: r.feedback_reason ?? null } : null,
  }));
}

// ─── Message feedback helpers ─────────────────────────────────────────────────

export function upsertMessageFeedback(messageId: string, userId: string, chatId: string | null, rating: 1 | -1, reason: string | null) {
  const existing = getDb().prepare('SELECT id FROM message_feedback WHERE message_id = ?').get(messageId) as any;
  if (existing) {
    getDb().prepare(
      "UPDATE message_feedback SET rating = ?, reason = ?, updated_at = datetime('now') WHERE message_id = ?"
    ).run(rating, reason, messageId);
  } else {
    getDb().prepare(
      'INSERT INTO message_feedback (id, message_id, user_id, chat_id, rating, reason) VALUES (?, ?, ?, ?, ?, ?)'
    ).run(randomUUID(), messageId, userId, chatId, rating, reason);
  }
  return getDb().prepare('SELECT * FROM message_feedback WHERE message_id = ?').get(messageId) as any;
}

export function getMessageById(messageId: string) {
  return getDb().prepare('SELECT * FROM messages WHERE id = ?').get(messageId) as any;
}

// ─── RAG helpers ──────────────────────────────────────────────────────────────

export function insertRagChunk(title: string, source: string, chunkIndex: number, chunkText: string, embedding: number[], themeName?: string) {
  const id = randomUUID();
  getDb().prepare(
    'INSERT INTO rag_documents (id, title, source, chunk_index, chunk_text, embedding, theme_name) VALUES (?, ?, ?, ?, ?, ?, ?)'
  ).run(id, title, source, chunkIndex, chunkText, JSON.stringify(embedding), themeName ?? null);
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
  ragTopSimilarity?: number | null;
}) {
  const id = randomUUID();
  getDb().prepare(`
    INSERT INTO llm_traces (id, user_id, chat_id, message_id, flow_step, model, tokens_in, tokens_out, latency_ms, cost_usd, rag_chunks_retrieved, risk_triggered, rag_top_similarity)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(
    id, data.userId ?? null, data.chatId ?? null, data.messageId ?? null,
    data.flowStep ?? null, data.model, data.tokensIn, data.tokensOut,
    data.latencyMs, data.costUsd, data.ragChunks, data.riskTriggered ? 1 : 0,
    data.ragTopSimilarity ?? null
  );
  return id;
}

export function getTraces(limit = 100, from?: string, to?: string) {
  if (from && to) {
    return getDb().prepare('SELECT * FROM llm_traces WHERE created_at BETWEEN ? AND ? ORDER BY created_at DESC LIMIT ?').all(from, to, limit) as any[];
  }
  return getDb().prepare('SELECT * FROM llm_traces ORDER BY created_at DESC LIMIT ?').all(limit) as any[];
}

export function getTraceStats(from?: string, to?: string) {
  const dateFilter = from && to ? `WHERE created_at BETWEEN '${from}' AND '${to}'` : '';
  return getDb().prepare(`
    SELECT
      COUNT(*) as total_requests,
      AVG(latency_ms) as avg_latency_ms,
      SUM(tokens_in + tokens_out) as total_tokens,
      SUM(cost_usd) as total_cost_usd,
      SUM(risk_triggered) as total_risk_events,
      SUM(rag_chunks_retrieved) as total_rag_retrievals,
      AVG(rag_top_similarity) as avg_rag_similarity
    FROM llm_traces ${dateFilter}
  `).get() as any;
}

export function getCompletionStats(from?: string, to?: string) {
  const dateFilter = from && to ? `WHERE created_at BETWEEN '${from}' AND '${to}'` : '';
  const db = getDb();
  const totals = db.prepare(`
    SELECT COUNT(*) as total_chats, SUM(completed) as completed_chats
    FROM chats ${dateFilter}
  `).get() as any;
  const dropout = db.prepare(`
    SELECT flow_step, COUNT(*) as count
    FROM chats
    ${dateFilter ? dateFilter + ' AND' : 'WHERE'} completed = 0
    GROUP BY flow_step ORDER BY flow_step
  `).all() as any[];
  return {
    totalChats: totals.total_chats,
    completedChats: totals.completed_chats ?? 0,
    completionRate: totals.total_chats > 0 ? (totals.completed_chats ?? 0) / totals.total_chats : 0,
    dropoutByStep: dropout,
  };
}

// ─── Trend helpers ─────────────────────────────────────────────────────────

export function getEvalTrend(days = 30) {
  return getDb().prepare(`
    SELECT date(created_at) as day,
      AVG(tone_score) as avg_tone,
      AVG(CAST(safety_pass AS REAL)) as safety_rate,
      AVG(CAST(flow_compliance AS REAL)) as flow_rate,
      AVG(CAST(contextual_relevance AS REAL)) as relevance_rate,
      COUNT(*) as eval_count
    FROM eval_scores
    WHERE tone_score IS NOT NULL AND created_at >= datetime('now', '-' || ? || ' days')
    GROUP BY date(created_at)
    ORDER BY day
  `).all(days) as any[];
}

export function getTraceTrend(days = 30) {
  return getDb().prepare(`
    SELECT date(created_at) as day,
      COUNT(*) as request_count,
      AVG(latency_ms) as avg_latency,
      SUM(cost_usd) as daily_cost,
      AVG(rag_top_similarity) as avg_rag_similarity
    FROM llm_traces
    WHERE created_at >= datetime('now', '-' || ? || ' days')
    GROUP BY date(created_at)
    ORDER BY day
  `).all(days) as any[];
}

export function getVolumeTrend(days = 30) {
  return getDb().prepare(`
    SELECT date(created_at) as day,
      COUNT(*) as message_count,
      (SELECT COUNT(*) FROM chats WHERE date(chats.created_at) = date(messages.created_at)) as session_count
    FROM messages
    WHERE created_at >= datetime('now', '-' || ? || ' days')
    GROUP BY date(created_at)
    ORDER BY day
  `).all(days) as any[];
}

// ─── Eval helpers ─────────────────────────────────────────────────────────────

export function insertEval(data: {
  messageId: string; chatId?: string; toneScore: number | null;
  flowCompliance: boolean | null; lengthCompliance: boolean | null; safetyPass: boolean | null;
  contextualRelevance?: boolean | null;
  evalModel: string; evalLatencyMs: number; evalReasoning?: string | null;
  error?: string | null;
}) {
  const id = randomUUID();
  getDb().prepare(`
    INSERT INTO eval_scores (id, message_id, chat_id, tone_score, flow_compliance, length_compliance, safety_pass, contextual_relevance, eval_model, eval_latency_ms, eval_reasoning, error)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(
    id, data.messageId, data.chatId ?? null,
    data.toneScore,
    data.flowCompliance == null ? null : data.flowCompliance ? 1 : 0,
    data.lengthCompliance == null ? null : data.lengthCompliance ? 1 : 0,
    data.safetyPass == null ? null : data.safetyPass ? 1 : 0,
    data.contextualRelevance == null ? null : data.contextualRelevance ? 1 : 0,
    data.evalModel, data.evalLatencyMs, data.evalReasoning ?? null,
    data.error ?? null,
  );
}

export function getEvalScores(limit = 100, from?: string, to?: string) {
  if (from && to) {
    return getDb().prepare('SELECT * FROM eval_scores WHERE created_at BETWEEN ? AND ? ORDER BY created_at DESC LIMIT ?').all(from, to, limit) as any[];
  }
  return getDb().prepare('SELECT * FROM eval_scores ORDER BY created_at DESC LIMIT ?').all(limit) as any[];
}

export function getEvalStats(from?: string, to?: string) {
  const whereClause = from && to ? `WHERE tone_score IS NOT NULL AND created_at BETWEEN '${from}' AND '${to}'` : 'WHERE tone_score IS NOT NULL';
  const allClause = from && to ? `WHERE created_at BETWEEN '${from}' AND '${to}'` : '';
  return getDb().prepare(`
    SELECT
      (SELECT COUNT(*) FROM eval_scores ${allClause}) as total_evals,
      (SELECT COUNT(*) FROM eval_scores ${allClause.replace('WHERE', 'WHERE error IS NOT NULL AND')
        || 'WHERE error IS NOT NULL'}) as eval_errors,
      AVG(tone_score) as avg_tone_score,
      AVG(CAST(flow_compliance AS REAL)) as flow_compliance_rate,
      AVG(CAST(length_compliance AS REAL)) as length_compliance_rate,
      AVG(CAST(safety_pass AS REAL)) as safety_pass_rate,
      AVG(CAST(contextual_relevance AS REAL)) as contextual_relevance_rate
    FROM eval_scores ${whereClause}
  `).get() as any;
}

export function getEvalCoverage(from?: string, to?: string) {
  const dateFilter = from && to ? `AND created_at BETWEEN '${from}' AND '${to}'` : '';
  const totalAi = (getDb().prepare(`SELECT COUNT(*) as c FROM messages WHERE role = 'assistant' ${dateFilter}`).get() as any).c;
  const totalEvals = (getDb().prepare(`SELECT COUNT(*) as c FROM eval_scores WHERE 1=1 ${dateFilter}`).get() as any).c;
  return { totalAiMessages: totalAi, totalEvals, coverageRate: totalAi > 0 ? totalEvals / totalAi : 0 };
}

export function getEvalStatsByStep(from?: string, to?: string) {
  const dateFilter = from && to ? `AND e.created_at BETWEEN '${from}' AND '${to}'` : '';
  return getDb().prepare(`
    SELECT
      m.flow_step,
      COUNT(*) as eval_count,
      AVG(e.tone_score) as avg_tone,
      AVG(CAST(e.flow_compliance AS REAL)) as flow_compliance_rate,
      AVG(CAST(e.length_compliance AS REAL)) as length_compliance_rate,
      AVG(CAST(e.safety_pass AS REAL)) as safety_pass_rate,
      AVG(CAST(e.contextual_relevance AS REAL)) as contextual_relevance_rate
    FROM eval_scores e
    JOIN messages m ON e.message_id = m.id
    WHERE e.tone_score IS NOT NULL ${dateFilter}
    GROUP BY m.flow_step
    ORDER BY m.flow_step
  `).all() as any[];
}

export function getQualityScorecard(from?: string, to?: string) {
  const dateFilter = from && to ? `AND created_at BETWEEN '${from}' AND '${to}'` : '';
  const db = getDb();

  const stats = db.prepare(`
    SELECT
      COUNT(*) as total,
      AVG(tone_score) as avg_tone,
      AVG(CAST(safety_pass AS REAL)) as safety_rate,
      AVG(CAST(flow_compliance AS REAL)) as flow_rate,
      AVG(CAST(contextual_relevance AS REAL)) as relevance_rate,
      AVG(CAST(length_compliance AS REAL)) as length_rate
    FROM eval_scores
    WHERE tone_score IS NOT NULL ${dateFilter}
  `).get() as any;

  const distribution = db.prepare(`
    SELECT tone_score, COUNT(*) as count
    FROM eval_scores
    WHERE tone_score IS NOT NULL ${dateFilter}
    GROUP BY tone_score
    ORDER BY tone_score
  `).all() as any[];

  const errorCount = (db.prepare(`SELECT COUNT(*) as c FROM eval_scores WHERE error IS NOT NULL ${dateFilter}`).get() as any).c;

  return { stats, distribution, errorCount };
}

export function getFlaggedResponses(limit = 50) {
  return getDb().prepare(`
    SELECT
      e.*,
      m.content as ai_message,
      m.flow_step,
      m.chat_id,
      (SELECT m2.content FROM messages m2 WHERE m2.chat_id = m.chat_id AND m2.role = 'user' AND m2.created_at < m.created_at ORDER BY m2.created_at DESC LIMIT 1) as user_message
    FROM eval_scores e
    JOIN messages m ON e.message_id = m.id
    WHERE e.tone_score IS NOT NULL
      AND e.reviewed = 0
      AND (e.safety_pass = 0 OR e.tone_score <= 2 OR e.flow_compliance = 0 OR e.contextual_relevance = 0)
    ORDER BY
      CASE WHEN e.safety_pass = 0 THEN 0 ELSE 1 END,
      e.tone_score ASC,
      e.created_at DESC
    LIMIT ?
  `).all(limit) as any[];
}

export function markEvalReviewed(evalId: string) {
  getDb().prepare('UPDATE eval_scores SET reviewed = 1 WHERE id = ?').run(evalId);
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

export function getRiskEvents(limit = 50, from?: string, to?: string) {
  if (from && to) {
    return getDb().prepare('SELECT * FROM risk_events WHERE created_at BETWEEN ? AND ? ORDER BY created_at DESC LIMIT ?').all(from, to, limit) as any[];
  }
  return getDb().prepare('SELECT * FROM risk_events ORDER BY created_at DESC LIMIT ?').all(limit) as any[];
}

// ─── Admin stats ──────────────────────────────────────────────────────────────

// ─── Calendar / streak helpers ────────────────────────────────────────────────

export function getTodayChat(userId: string) {
  return getDb().prepare(
    "SELECT * FROM chats WHERE user_id = ? AND date(created_at) = date('now') ORDER BY created_at DESC LIMIT 1"
  ).get(userId) as any;
}

export function getCalendarChats(userId: string, days = 60) {
  return getDb().prepare(
    "SELECT id, completed, flow_step, created_at FROM chats WHERE user_id = ? AND date(created_at) >= date('now', '-' || ? || ' days') ORDER BY created_at DESC"
  ).all(userId, days) as any[];
}

export function getUserStreak(userId: string): number {
  const rows = getDb().prepare(`
    SELECT DISTINCT date(created_at) as day
    FROM chats WHERE user_id = ? AND completed = 1
    ORDER BY day DESC LIMIT 365
  `).all(userId) as { day: string }[];
  if (rows.length === 0) return 0;

  let streak = 0;
  const today = new Date().toISOString().slice(0, 10);
  const d = new Date();
  if (rows[0].day !== today) d.setDate(d.getDate() - 1);

  for (const { day } of rows) {
    if (day === d.toISOString().slice(0, 10)) {
      streak++;
      d.setDate(d.getDate() - 1);
    } else break;
  }
  return streak;
}

// ─── Share token helpers ───────────────────────────────────────────────────────

export function upsertShareToken(chatId: string, userId: string): string {
  const existing = getDb().prepare('SELECT token FROM share_tokens WHERE chat_id = ?').get(chatId) as any;
  if (existing) return existing.token;
  const token = randomUUID().replace(/-/g, '');
  getDb().prepare(
    "INSERT INTO share_tokens (token, chat_id, user_id) VALUES (?, ?, ?)"
  ).run(token, chatId, userId);
  return token;
}

export function getChatByShareToken(token: string) {
  const row = getDb().prepare('SELECT chat_id FROM share_tokens WHERE token = ?').get(token) as any;
  if (!row) return null;
  return getChatById(row.chat_id);
}

// ─── User preference helpers ───────────────────────────────────────────────────

export function getUserPreferences(userId: string) {
  return getDb().prepare('SELECT * FROM user_preferences WHERE user_id = ?').get(userId) as any;
}

export function upsertUserPreferences(userId: string, data: { customPrompt?: string; showBreathing?: boolean; showAppFeatures?: boolean; language?: string; primaryModel?: string | null }) {
  const existing = getUserPreferences(userId);
  if (existing) {
    const sets: string[] = [];
    const vals: any[] = [];
    if (data.customPrompt !== undefined) { sets.push('custom_prompt = ?'); vals.push(data.customPrompt); }
    if (data.showBreathing !== undefined) { sets.push('show_breathing = ?'); vals.push(data.showBreathing ? 1 : 0); }
    if (data.showAppFeatures !== undefined) { sets.push('show_app_features = ?'); vals.push(data.showAppFeatures ? 1 : 0); }
    if (data.language !== undefined) { sets.push('language = ?'); vals.push(data.language); }
    if (data.primaryModel !== undefined) { sets.push('primary_model = ?'); vals.push(data.primaryModel); }
    if (sets.length) {
      sets.push("updated_at = datetime('now')");
      getDb().prepare(`UPDATE user_preferences SET ${sets.join(', ')} WHERE user_id = ?`).run(...vals, userId);
    }
  } else {
    getDb().prepare(
      'INSERT INTO user_preferences (user_id, custom_prompt, show_breathing, show_app_features, language, primary_model) VALUES (?, ?, ?, ?, ?, ?)'
    ).run(userId, data.customPrompt ?? null, data.showBreathing !== false ? 1 : 0, data.showAppFeatures !== false ? 1 : 0, data.language ?? 'nl', data.primaryModel ?? null);
  }
  return getUserPreferences(userId);
}

// ─── Chat note helpers ─────────────────────────────────────────────────────────

export function getChatNote(chatId: string) {
  return getDb().prepare('SELECT * FROM chat_notes WHERE chat_id = ? LIMIT 1').get(chatId) as any;
}

export function upsertChatNote(chatId: string, userId: string, note: string) {
  const existing = getChatNote(chatId);
  if (existing) {
    getDb().prepare('UPDATE chat_notes SET note = ? WHERE chat_id = ?').run(note, chatId);
  } else {
    getDb().prepare('INSERT INTO chat_notes (id, chat_id, user_id, note) VALUES (?, ?, ?, ?)').run(randomUUID(), chatId, userId, note);
  }
}

// ─── Profile facts helpers ────────────────────────────────────────────────────

export function getProfileFacts(userId: string) {
  return getDb().prepare('SELECT * FROM profile_facts WHERE user_id = ? ORDER BY created_at ASC').all(userId) as any[];
}

export function insertProfileFact(userId: string, content: string) {
  const trimmed = content.trim();
  if (!trimmed) return;
  // Skip if exact duplicate already exists
  const exists = getDb().prepare('SELECT id FROM profile_facts WHERE user_id = ? AND content = ?').get(userId, trimmed);
  if (exists) return;
  getDb().prepare('INSERT INTO profile_facts (id, user_id, content) VALUES (?, ?, ?)').run(randomUUID(), userId, trimmed);
}

export function deleteProfileFact(id: string, userId: string) {
  getDb().prepare('DELETE FROM profile_facts WHERE id = ? AND user_id = ?').run(id, userId);
}

export function rebuildDynamicProfile(userId: string) {
  const facts = getProfileFacts(userId);
  const text = facts.map(f => `• ${f.content}`).join('\n');
  updateDynamicProfile(userId, text);
}

// Migrate existing dynamic_profile text into profile_facts rows (one-time)
export function migrateProfileToFacts(userId: string) {
  const existing = getProfileFacts(userId);
  if (existing.length > 0) return; // already migrated
  const profile = getProfile(userId);
  if (!profile?.dynamic_profile) return;
  const lines = profile.dynamic_profile
    .split('\n')
    .map((l: string) => l.replace(/^[•\-*]\s*/, '').trim())
    .filter((l: string) => l.length > 10);
  for (const line of lines) insertProfileFact(userId, line);
}

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

// ─── Per-user analytics ──────────────────────────────────────────────────────

export function getAllUserAnalytics() {
  // Chat aggregates, trace costs, and eval scores each come from their own
  // subquery. Joining them together in one FROM clause inflates numbers by
  // the cross-product of traces × assistant messages per chat.
  return getDb().prepare(`
    SELECT
      u.id, u.username, u.created_at as joined_at,
      COALESCE(ch.total_sessions, 0) as total_sessions,
      COALESCE(ch.completed_sessions, 0) as completed_sessions,
      COALESCE(ch.last_active, u.created_at) as last_active,
      COALESCE(tr.total_cost, 0) as total_cost,
      ev.avg_tone as avg_tone,
      COALESCE(ev.safety_fails, 0) as safety_fails
    FROM users u
    LEFT JOIN (
      SELECT user_id,
             COUNT(*) as total_sessions,
             SUM(CASE WHEN completed = 1 THEN 1 ELSE 0 END) as completed_sessions,
             MAX(created_at) as last_active
      FROM chats
      GROUP BY user_id
    ) ch ON ch.user_id = u.id
    LEFT JOIN (
      SELECT c.user_id, SUM(t.cost_usd) as total_cost
      FROM llm_traces t
      INNER JOIN chats c ON c.id = t.chat_id
      GROUP BY c.user_id
    ) tr ON tr.user_id = u.id
    LEFT JOIN (
      SELECT c.user_id,
             AVG(e.tone_score) as avg_tone,
             SUM(CASE WHEN e.safety_pass = 0 THEN 1 ELSE 0 END) as safety_fails
      FROM eval_scores e
      INNER JOIN messages m ON m.id = e.message_id
      INNER JOIN chats c ON c.id = m.chat_id
      WHERE e.tone_score IS NOT NULL
      GROUP BY c.user_id
    ) ev ON ev.user_id = u.id
    WHERE u.is_admin = 0
    ORDER BY last_active DESC
  `).all() as any[];
}

export function getFatigueTrend(userId: string) {
  return getDb().prepare(`
    SELECT date(created_at) as day, initial_fatigue_level as fatigue
    FROM chats
    WHERE user_id = ? AND initial_fatigue_level IS NOT NULL
    ORDER BY created_at
  `).all(userId) as any[];
}

// ─── Conversation QA helpers ─────────────────────────────────────────────────

export function getSessionsWithQuality(from?: string, to?: string, limit = 50) {
  const dateFilter = from && to ? `AND c.created_at BETWEEN '${from}' AND '${to}'` : '';
  return getDb().prepare(`
    SELECT
      c.id as chat_id,
      c.user_id,
      u.username,
      c.completed,
      c.flow_step,
      c.created_at,
      COUNT(DISTINCT m.id) as message_count,
      AVG(e.tone_score) as avg_tone,
      MIN(e.tone_score) as min_tone,
      SUM(CASE WHEN e.safety_pass = 0 THEN 1 ELSE 0 END) as safety_fails,
      SUM(CASE WHEN e.flow_compliance = 0 THEN 1 ELSE 0 END) as flow_fails,
      SUM(CASE WHEN e.contextual_relevance = 0 THEN 1 ELSE 0 END) as relevance_fails
    FROM chats c
    JOIN users u ON u.id = c.user_id
    LEFT JOIN messages m ON m.chat_id = c.id AND m.role = 'assistant'
    LEFT JOIN eval_scores e ON e.message_id = m.id AND e.tone_score IS NOT NULL
    WHERE 1=1 ${dateFilter}
    GROUP BY c.id
    ORDER BY c.created_at DESC
    LIMIT ?
  `).all(limit) as any[];
}

export function getConversationWithEvals(chatId: string) {
  return getDb().prepare(`
    SELECT
      m.id as message_id,
      m.role,
      m.content,
      m.flow_step,
      m.media,
      m.created_at,
      e.tone_score,
      e.flow_compliance,
      e.length_compliance,
      e.safety_pass,
      e.contextual_relevance,
      e.eval_reasoning,
      e.error as eval_error
    FROM messages m
    LEFT JOIN eval_scores e ON e.message_id = m.id
    WHERE m.chat_id = ?
    ORDER BY m.created_at ASC
  `).all(chatId) as any[];
}

// ─── App settings (admin-tunable global config) ─────────────────────────────

export function getAllAppSettings(): Record<string, string> {
  const rows = getDb().prepare('SELECT key, value FROM app_settings').all() as { key: string; value: string }[];
  return Object.fromEntries(rows.map(r => [r.key, r.value]));
}

export function getAppSetting(key: string): string | undefined {
  const row = getDb().prepare('SELECT value FROM app_settings WHERE key = ?').get(key) as { value: string } | undefined;
  return row?.value;
}

export function setAppSetting(key: string, value: string) {
  getDb().prepare(`
    INSERT INTO app_settings (key, value, updated_at) VALUES (?, ?, datetime('now'))
    ON CONFLICT(key) DO UPDATE SET value = excluded.value, updated_at = datetime('now')
  `).run(key, value);
}

export function setAppSettings(entries: Record<string, string>) {
  const stmt = getDb().prepare(`
    INSERT INTO app_settings (key, value, updated_at) VALUES (?, ?, datetime('now'))
    ON CONFLICT(key) DO UPDATE SET value = excluded.value, updated_at = datetime('now')
  `);
  const tx = getDb().transaction((rows: [string, string][]) => {
    for (const [k, v] of rows) stmt.run(k, v);
  });
  tx(Object.entries(entries));
}

