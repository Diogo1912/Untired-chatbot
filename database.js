const sqlite3 = require('sqlite3').verbose();
const path = require('path');
const { promisify } = require('util');

const dbPath = path.join(__dirname, 'untire_coach.db');
const db = new sqlite3.Database(dbPath);

// Promisify database methods
const dbGet = promisify(db.get.bind(db));
const dbAll = promisify(db.all.bind(db));
const dbExec = promisify(db.exec.bind(db));

// Custom dbRun that properly captures lastID
function dbRun(sql, params = []) {
  return new Promise((resolve, reject) => {
    db.run(sql, params, function(err) {
      if (err) {
        reject(err);
      } else {
        resolve({ lastID: this.lastID, changes: this.changes });
      }
    });
  });
}

// Initialize database schema
async function initializeDatabase() {
  try {
    // Enable foreign keys
    await dbRun('PRAGMA foreign_keys = ON');

    // Users table
    await dbExec(`
      CREATE TABLE IF NOT EXISTS users (
        id TEXT PRIMARY KEY,
        username TEXT UNIQUE,
        password_hash TEXT,
        is_admin INTEGER DEFAULT 0,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
      )
    `);

    // Sessions table
    await dbExec(`
      CREATE TABLE IF NOT EXISTS sessions (
        id TEXT PRIMARY KEY,
        user_id TEXT NOT NULL,
        expires_at DATETIME NOT NULL,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
      )
    `);

    // Migrations: Add new columns if they don't exist
    const userMigrations = [
      { table: 'users', column: 'username', type: 'TEXT' },
      { table: 'users', column: 'password_hash', type: 'TEXT' },
      { table: 'users', column: 'is_admin', type: 'INTEGER DEFAULT 0' }
    ];

    for (const migration of userMigrations) {
      try {
        await dbRun(`ALTER TABLE ${migration.table} ADD COLUMN ${migration.column} ${migration.type}`);
        console.log(`✅ Added ${migration.column} column to ${migration.table} table`);
      } catch (error) {
        if (!error.message || !error.message.includes('duplicate column')) {
          console.log(`Migration note for ${migration.column}:`, error.message);
        }
      }
    }

    // Profiles table
    await dbExec(`
      CREATE TABLE IF NOT EXISTS profiles (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        user_id TEXT NOT NULL,
        name TEXT,
        age INTEGER,
        current_fatigue_level REAL,
        last_fatigue_asked_date DATE,
        dynamic_profile TEXT,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
        UNIQUE(user_id)
      )
    `);

    // User settings table
    await dbExec(`
      CREATE TABLE IF NOT EXISTS user_settings (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        user_id TEXT NOT NULL,
        behavior_type TEXT DEFAULT 'empathetic',
        agentic_features BOOLEAN DEFAULT 1,
        chat_only BOOLEAN DEFAULT 0,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
        UNIQUE(user_id)
      )
    `);

    // Videos library table
    await dbExec(`
      CREATE TABLE IF NOT EXISTS videos (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        title TEXT NOT NULL,
        url TEXT NOT NULL,
        embed_url TEXT NOT NULL,
        category TEXT,
        tags TEXT,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP
      )
    `);

    // Breathing exercises table
    await dbExec(`
      CREATE TABLE IF NOT EXISTS breathing_exercises (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        title TEXT NOT NULL,
        description TEXT,
        duration INTEGER,
        pattern TEXT,
        embed_code TEXT,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP
      )
    `);

    // Fatigue quiz questions table
    await dbExec(`
      CREATE TABLE IF NOT EXISTS fatigue_quiz_questions (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        question_text TEXT NOT NULL,
        question_order INTEGER NOT NULL,
        options TEXT NOT NULL,
        weight REAL DEFAULT 1.0,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP
      )
    `);

    // Chats table
    await dbExec(`
      CREATE TABLE IF NOT EXISTS chats (
        id TEXT PRIMARY KEY,
        user_id TEXT NOT NULL,
        title TEXT,
        initial_fatigue_level REAL,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
      )
    `);

    // Messages table
    await dbExec(`
      CREATE TABLE IF NOT EXISTS messages (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        chat_id TEXT NOT NULL,
        role TEXT NOT NULL,
        content TEXT NOT NULL,
        videos TEXT,
        timestamp DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (chat_id) REFERENCES chats(id) ON DELETE CASCADE
      )
    `);

    // Create indexes for better performance
    await dbExec(`
      CREATE INDEX IF NOT EXISTS idx_chats_user_id ON chats(user_id);
      CREATE INDEX IF NOT EXISTS idx_messages_chat_id ON messages(chat_id);
      CREATE INDEX IF NOT EXISTS idx_profiles_user_id ON profiles(user_id);
    `);

    // Migrations: Add new columns if they don't exist
    const migrations = [
      { table: 'profiles', column: 'last_fatigue_asked_date', type: 'DATE' },
      { table: 'profiles', column: 'dynamic_profile', type: 'TEXT' },
      { table: 'messages', column: 'videos', type: 'TEXT' }
    ];

    for (const migration of migrations) {
      try {
        await dbRun(`ALTER TABLE ${migration.table} ADD COLUMN ${migration.column} ${migration.type}`);
        console.log(`✅ Added ${migration.column} column to ${migration.table} table`);
      } catch (error) {
        if (!error.message || !error.message.includes('duplicate column')) {
          console.log(`Migration note for ${migration.column}:`, error.message);
        }
      }
    }

    console.log('✅ Database initialized successfully');
  } catch (error) {
    console.error('Database initialization error:', error);
    throw error;
  }
}

// User operations
async function createUser(userId) {
  await dbRun('INSERT INTO users (id) VALUES (?)', [userId]);
  return userId;
}

async function getUser(userId) {
  return await dbGet('SELECT * FROM users WHERE id = ?', [userId]);
}

async function getOrCreateUser(userId) {
  let user = await getUser(userId);
  if (!user) {
    await createUser(userId);
    user = await getUser(userId);
  }
  return user;
}

async function getUserByUsername(username) {
  return await dbGet('SELECT * FROM users WHERE username = ?', [username]);
}

async function createUserWithAuth(username, passwordHash, isAdmin = 0) {
  const userId = `user_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  await dbRun('INSERT INTO users (id, username, password_hash, is_admin) VALUES (?, ?, ?, ?)', 
    [userId, username, passwordHash, isAdmin]);
  return await dbGet('SELECT * FROM users WHERE id = ?', [userId]);
}

async function getUserById(userId) {
  return await dbGet('SELECT id, username, is_admin, created_at FROM users WHERE id = ?', [userId]);
}

// Session operations
async function createSession(userId, sessionId, expiresAt) {
  await dbRun('INSERT INTO sessions (id, user_id, expires_at) VALUES (?, ?, ?)', 
    [sessionId, userId, expiresAt]);
  return await dbGet('SELECT * FROM sessions WHERE id = ?', [sessionId]);
}

async function getSession(sessionId) {
  const session = await dbGet('SELECT * FROM sessions WHERE id = ? AND expires_at > datetime("now")', [sessionId]);
  return session;
}

async function deleteSession(sessionId) {
  await dbRun('DELETE FROM sessions WHERE id = ?', [sessionId]);
}

async function deleteUserSessions(userId) {
  await dbRun('DELETE FROM sessions WHERE user_id = ?', [userId]);
}

// Profile operations
async function createOrUpdateProfile(userId, profileData) {
  const existing = await dbGet('SELECT id FROM profiles WHERE user_id = ?', [userId]);
  
  if (existing) {
    await dbRun(`
      UPDATE profiles 
      SET name = COALESCE(?, name),
          age = COALESCE(?, age),
          current_fatigue_level = COALESCE(?, current_fatigue_level),
          last_fatigue_asked_date = COALESCE(?, last_fatigue_asked_date),
          updated_at = CURRENT_TIMESTAMP
      WHERE user_id = ?
    `, [profileData.name, profileData.age, profileData.current_fatigue_level, profileData.last_fatigue_asked_date, userId]);
  } else {
    await dbRun(`
      INSERT INTO profiles (user_id, name, age, current_fatigue_level, last_fatigue_asked_date)
      VALUES (?, ?, ?, ?, ?)
    `, [userId, profileData.name, profileData.age, profileData.current_fatigue_level, profileData.last_fatigue_asked_date]);
  }
  
  return await getProfile(userId);
}

async function updateLastFatigueAskedDate(userId) {
  const today = new Date().toISOString().split('T')[0]; // YYYY-MM-DD format
  await dbRun(`
    UPDATE profiles 
    SET last_fatigue_asked_date = ?
    WHERE user_id = ?
  `, [today, userId]);
}

async function getProfile(userId) {
  return await dbGet('SELECT * FROM profiles WHERE user_id = ?', [userId]);
}

// Chat operations
async function createChat(chatId, userId, title = 'New Chat', initialFatigueLevel = null) {
  await dbRun(`
    INSERT INTO chats (id, user_id, title, initial_fatigue_level)
    VALUES (?, ?, ?, ?)
  `, [chatId, userId, title, initialFatigueLevel]);
  return await getChat(chatId);
}

async function getChat(chatId) {
  return await dbGet('SELECT * FROM chats WHERE id = ?', [chatId]);
}

async function updateChatTitle(chatId, title) {
  await dbRun('UPDATE chats SET title = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?', [title, chatId]);
}

async function getUserChats(userId, limit = 10) {
  return await dbAll(`
    SELECT * FROM chats 
    WHERE user_id = ? 
    ORDER BY updated_at DESC 
    LIMIT ?
  `, [userId, limit]);
}

// Message operations
async function addMessage(chatId, role, content, media = null) {
  // media can be videos array or object with videos and breathing
  const mediaJson = media ? JSON.stringify(media) : null;
  const result = await dbRun('INSERT INTO messages (chat_id, role, content, videos) VALUES (?, ?, ?, ?)', [chatId, role, content, mediaJson]);
  return result.lastID;
}

async function getChatMessages(chatId) {
  const messages = await dbAll('SELECT * FROM messages WHERE chat_id = ? ORDER BY timestamp ASC', [chatId]);
  // Parse media JSON if present (can be videos array or object with videos/breathing)
  return messages.map(msg => {
    let media = null;
    if (msg.videos) {
      try {
        media = JSON.parse(msg.videos);
        // Handle legacy format (just videos array)
        if (Array.isArray(media)) {
          media = { videos: media, breathing: null };
        }
      } catch (e) {
        media = null;
      }
    }
    return {
      ...msg,
      videos: media?.videos || null,
      breathing: media?.breathing || null
    };
  });
}

async function deleteChat(chatId) {
  await dbRun('DELETE FROM chats WHERE id = ?', [chatId]);
}

// Delete all user data
async function deleteAllUserData(userId) {
  // Delete user (cascades to profile, chats, and messages due to foreign keys)
  await dbRun('DELETE FROM users WHERE id = ?', [userId]);
}

// User settings operations
async function getUserSettings(userId) {
  let settings = await dbGet('SELECT * FROM user_settings WHERE user_id = ?', [userId]);
  if (!settings) {
    // Create default settings
    await dbRun(`
      INSERT INTO user_settings (user_id, behavior_type, agentic_features, chat_only)
      VALUES (?, 'empathetic', 1, 0)
    `, [userId]);
    settings = await dbGet('SELECT * FROM user_settings WHERE user_id = ?', [userId]);
  }
  return settings;
}

async function updateUserSettings(userId, settings) {
  const existing = await dbGet('SELECT id FROM user_settings WHERE user_id = ?', [userId]);
  
  if (existing) {
    await dbRun(`
      UPDATE user_settings 
      SET behavior_type = COALESCE(?, behavior_type),
          agentic_features = COALESCE(?, agentic_features),
          chat_only = COALESCE(?, chat_only),
          updated_at = CURRENT_TIMESTAMP
      WHERE user_id = ?
    `, [settings.behavior_type, settings.agentic_features, settings.chat_only, userId]);
  } else {
    await dbRun(`
      INSERT INTO user_settings (user_id, behavior_type, agentic_features, chat_only)
      VALUES (?, ?, ?, ?)
    `, [userId, settings.behavior_type || 'empathetic', settings.agentic_features !== undefined ? settings.agentic_features : 1, settings.chat_only !== undefined ? settings.chat_only : 0]);
  }
  
  return await getUserSettings(userId);
}

// Dynamic profile operations
async function updateDynamicProfile(userId, profileText) {
  await dbRun(`
    UPDATE profiles 
    SET dynamic_profile = ?,
        updated_at = CURRENT_TIMESTAMP
    WHERE user_id = ?
  `, [profileText, userId]);
}

async function getDynamicProfile(userId) {
  const profile = await getProfile(userId);
  return profile?.dynamic_profile || '';
}

// Video operations
async function getAllVideos() {
  return await dbAll('SELECT * FROM videos ORDER BY title ASC');
}

async function getVideosByCategory(category) {
  return await dbAll('SELECT * FROM videos WHERE category = ? ORDER BY title ASC', [category]);
}

async function addVideo(title, url, embedUrl, category = null, tags = null) {
  await dbRun(`
    INSERT INTO videos (title, url, embed_url, category, tags)
    VALUES (?, ?, ?, ?, ?)
  `, [title, url, embedUrl, category, tags]);
  return await dbGet('SELECT * FROM videos WHERE id = last_insert_rowid()');
}

// Breathing exercises operations
async function getAllBreathingExercises() {
  return await dbAll('SELECT * FROM breathing_exercises ORDER BY title ASC');
}

async function addBreathingExercise(title, description, duration, pattern, embedCode) {
  await dbRun(`
    INSERT INTO breathing_exercises (title, description, duration, pattern, embed_code)
    VALUES (?, ?, ?, ?, ?)
  `, [title, description, duration, pattern, embedCode]);
  return await dbGet('SELECT * FROM breathing_exercises WHERE id = last_insert_rowid()');
}

// Fatigue quiz operations
async function getAllQuizQuestions() {
  return await dbAll('SELECT * FROM fatigue_quiz_questions ORDER BY question_order ASC');
}

async function addQuizQuestion(questionText, questionOrder, options, weight = 1.0) {
  const optionsJson = JSON.stringify(options);
  await dbRun(`
    INSERT INTO fatigue_quiz_questions (question_text, question_order, options, weight)
    VALUES (?, ?, ?, ?)
  `, [questionText, questionOrder, optionsJson, weight]);
  return await dbGet('SELECT * FROM fatigue_quiz_questions WHERE id = last_insert_rowid()');
}

// Initialize on load
initializeDatabase().catch(console.error);

module.exports = {
  db,
  getOrCreateUser,
  getUserByUsername,
  createUserWithAuth,
  getUserById,
  createSession,
  getSession,
  deleteSession,
  deleteUserSessions,
  createOrUpdateProfile,
  getProfile,
  updateLastFatigueAskedDate,
  getUserSettings,
  updateUserSettings,
  updateDynamicProfile,
  getDynamicProfile,
  createChat,
  getChat,
  updateChatTitle,
  getUserChats,
  addMessage,
  getChatMessages,
  deleteChat,
  deleteAllUserData,
  getAllVideos,
  getVideosByCategory,
  addVideo,
  getAllBreathingExercises,
  addBreathingExercise,
  getAllQuizQuestions,
  addQuizQuestion,
};
