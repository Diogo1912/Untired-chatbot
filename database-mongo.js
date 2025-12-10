const { MongoClient } = require('mongodb');
const dotenv = require('dotenv');

dotenv.config();

const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://localhost:27017/untire-coach';
let client = null;
let db = null;

// Initialize MongoDB connection
async function initializeDatabase() {
  try {
    client = new MongoClient(MONGODB_URI);
    await client.connect();
    db = client.db();
    
    // Create indexes
    await db.collection('users').createIndex({ username: 1 }, { unique: true, sparse: true });
    await db.collection('sessions').createIndex({ expires_at: 1 }, { expireAfterSeconds: 0 });
    await db.collection('profiles').createIndex({ user_id: 1 }, { unique: true });
    await db.collection('chats').createIndex({ user_id: 1 });
    await db.collection('messages').createIndex({ chat_id: 1 });
    await db.collection('user_settings').createIndex({ user_id: 1 }, { unique: true });
    await db.collection('ai_settings').createIndex({ key: 1 }, { unique: true });
    await db.collection('saved_memories').createIndex({ user_id: 1 });
    
    // Auto-create default admin account if none exists
    await createDefaultAdminIfNeeded();
    
    console.log('✅ MongoDB connected successfully');
  } catch (error) {
    console.error('MongoDB connection error:', error);
    throw error;
  }
}

// Create default admin account if no admin exists
async function createDefaultAdminIfNeeded() {
  try {
    const crypto = require('crypto');
    
    // Check if any admin exists
    const adminExists = await db.collection('users').findOne({ is_admin: true });
    
    if (!adminExists) {
      const defaultUsername = 'admin';
      const defaultPassword = 'UntireAdmin2024!'; // Change this in production!
      const passwordHash = crypto.createHash('sha256').update(defaultPassword).digest('hex');
      
      await db.collection('users').insertOne({
        _id: `admin_${Date.now()}`,
        username: defaultUsername,
        password_hash: passwordHash,
        is_admin: true,
        created_at: new Date(),
        updated_at: new Date()
      });
      
      console.log('🔐 Default admin account created');
      console.log('   Username: admin');
      console.log('   Password: UntireAdmin2024!');
      console.log('   ⚠️  IMPORTANT: Change this password after first login!');
    }
  } catch (error) {
    console.error('Error creating default admin:', error);
    // Don't throw - let the app continue even if admin creation fails
  }
}

// User operations
async function createUser(userId) {
  await db.collection('users').insertOne({
    _id: userId,
    created_at: new Date(),
    updated_at: new Date()
  });
  return userId;
}

async function getUser(userId) {
  return await db.collection('users').findOne({ _id: userId });
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
  return await db.collection('users').findOne({ username });
}

async function createUserWithAuth(username, passwordHash, isAdmin = false) {
  const userId = `user_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  await db.collection('users').insertOne({
    _id: userId,
    username,
    password_hash: passwordHash,
    is_admin: isAdmin,
    created_at: new Date(),
    updated_at: new Date()
  });
  return await db.collection('users').findOne({ _id: userId });
}

async function getUserById(userId) {
  return await db.collection('users').findOne(
    { _id: userId },
    { projection: { password_hash: 0 } }
  );
}

async function getAllUsers() {
  return await db.collection('users').find(
    {},
    { projection: { password_hash: 0 } }
  ).toArray();
}

async function deleteUser(userId) {
  // Delete all related data
  await Promise.all([
    db.collection('users').deleteOne({ _id: userId }),
    db.collection('profiles').deleteMany({ user_id: userId }),
    db.collection('chats').deleteMany({ user_id: userId }),
    db.collection('messages').deleteMany({ user_id: userId }),
    db.collection('user_settings').deleteMany({ user_id: userId }),
    db.collection('sessions').deleteMany({ user_id: userId }),
    db.collection('saved_memories').deleteMany({ user_id: userId })
  ]);
}

// Session operations
async function createSession(userId, sessionId, expiresAt) {
  await db.collection('sessions').insertOne({
    _id: sessionId,
    user_id: userId,
    expires_at: new Date(expiresAt),
    created_at: new Date()
  });
  return await db.collection('sessions').findOne({ _id: sessionId });
}

async function getSession(sessionId) {
  return await db.collection('sessions').findOne({
    _id: sessionId,
    expires_at: { $gt: new Date() }
  });
}

async function deleteSession(sessionId) {
  await db.collection('sessions').deleteOne({ _id: sessionId });
}

async function deleteUserSessions(userId) {
  await db.collection('sessions').deleteMany({ user_id: userId });
}

// Profile operations
async function createOrUpdateProfile(userId, profileData) {
  const updateData = {
    $set: {
      ...profileData,
      user_id: userId,
      updated_at: new Date()
    },
    $setOnInsert: {
      created_at: new Date()
    }
  };
  
  await db.collection('profiles').updateOne(
    { user_id: userId },
    updateData,
    { upsert: true }
  );
  
  return await getProfile(userId);
}

async function getProfile(userId) {
  return await db.collection('profiles').findOne({ user_id: userId });
}

async function updateLastFatigueAskedDate(userId) {
  const today = new Date().toISOString().split('T')[0];
  await db.collection('profiles').updateOne(
    { user_id: userId },
    { $set: { last_fatigue_asked_date: today } }
  );
}

// Chat operations
async function createChat(chatId, userId, title = 'New Chat', initialFatigueLevel = null) {
  await db.collection('chats').insertOne({
    _id: chatId,
    user_id: userId,
    title,
    initial_fatigue_level: initialFatigueLevel,
    created_at: new Date(),
    updated_at: new Date()
  });
  return await getChat(chatId);
}

async function getChat(chatId) {
  return await db.collection('chats').findOne({ _id: chatId });
}

async function updateChatTitle(chatId, title) {
  await db.collection('chats').updateOne(
    { _id: chatId },
    { $set: { title, updated_at: new Date() } }
  );
}

async function getUserChats(userId, limit = 10) {
  return await db.collection('chats')
    .find({ user_id: userId })
    .sort({ updated_at: -1 })
    .limit(limit)
    .toArray();
}

async function deleteChat(chatId) {
  await Promise.all([
    db.collection('chats').deleteOne({ _id: chatId }),
    db.collection('messages').deleteMany({ chat_id: chatId })
  ]);
}

// Message operations
async function addMessage(chatId, role, content, media = null) {
  const result = await db.collection('messages').insertOne({
    chat_id: chatId,
    role,
    content,
    media,
    timestamp: new Date()
  });
  return result.insertedId;
}

async function getChatMessages(chatId) {
  const messages = await db.collection('messages')
    .find({ chat_id: chatId })
    .sort({ timestamp: 1 })
    .toArray();
  
  return messages.map(msg => ({
    ...msg,
    videos: msg.media?.videos || null,
    breathing: msg.media?.breathing || null
  }));
}

// Delete all user data
async function deleteAllUserData(userId) {
  await deleteUser(userId);
}

// User settings operations
async function getUserSettings(userId) {
  let settings = await db.collection('user_settings').findOne({ user_id: userId });
  if (!settings) {
    settings = {
      user_id: userId,
      behavior_type: 'empathetic',
      agentic_features: true,
      chat_only: false,
      created_at: new Date(),
      updated_at: new Date()
    };
    await db.collection('user_settings').insertOne(settings);
  }
  return settings;
}

async function updateUserSettings(userId, settings) {
  await db.collection('user_settings').updateOne(
    { user_id: userId },
    {
      $set: {
        ...settings,
        updated_at: new Date()
      },
      $setOnInsert: {
        user_id: userId,
        created_at: new Date()
      }
    },
    { upsert: true }
  );
  return await getUserSettings(userId);
}

// Dynamic profile operations
async function updateDynamicProfile(userId, profileText) {
  await db.collection('profiles').updateOne(
    { user_id: userId },
    {
      $set: {
        dynamic_profile: profileText,
        updated_at: new Date()
      }
    }
  );
}

async function getDynamicProfile(userId) {
  const profile = await getProfile(userId);
  return profile?.dynamic_profile || '';
}

// Video operations
async function getAllVideos() {
  return await db.collection('videos').find().sort({ title: 1 }).toArray();
}

async function getVideosByCategory(category) {
  return await db.collection('videos').find({ category }).sort({ title: 1 }).toArray();
}

async function addVideo(title, url, embedUrl, category = null, tags = null) {
  const result = await db.collection('videos').insertOne({
    title,
    url,
    embed_url: embedUrl,
    category,
    tags,
    created_at: new Date()
  });
  return await db.collection('videos').findOne({ _id: result.insertedId });
}

async function deleteVideo(videoId) {
  await db.collection('videos').deleteOne({ _id: videoId });
}

// Breathing exercises operations
async function getAllBreathingExercises() {
  return await db.collection('breathing_exercises').find().sort({ title: 1 }).toArray();
}

async function addBreathingExercise(title, description, duration, pattern, embedCode) {
  const result = await db.collection('breathing_exercises').insertOne({
    title,
    description,
    duration,
    pattern,
    embed_code: embedCode,
    created_at: new Date()
  });
  return await db.collection('breathing_exercises').findOne({ _id: result.insertedId });
}

async function deleteBreathingExercise(exerciseId) {
  await db.collection('breathing_exercises').deleteOne({ _id: exerciseId });
}

// Fatigue quiz operations
async function getAllQuizQuestions() {
  return await db.collection('fatigue_quiz_questions').find().sort({ question_order: 1 }).toArray();
}

async function addQuizQuestion(questionText, questionOrder, options, weight = 1.0) {
  const result = await db.collection('fatigue_quiz_questions').insertOne({
    question_text: questionText,
    question_order: questionOrder,
    options,
    weight,
    created_at: new Date()
  });
  return await db.collection('fatigue_quiz_questions').findOne({ _id: result.insertedId });
}

// AI Settings operations (Admin configurable)
async function getAISettings() {
  let settings = await db.collection('ai_settings').findOne({ key: 'global' });
  if (!settings) {
    settings = {
      key: 'global',
      system_prompt: getDefaultSystemPrompt(),
      temperature: 0.8,
      max_tokens: 500,
      model: 'gpt-5.1',
      enabled_tools: ['videos', 'breathing', 'quiz', 'journaling', 'activity_tracking'],
      verbosity: 'medium',
      memory_enabled: true,
      accessible_user_fields: [
        'name', 'age', 'cancer_type', 'treatment_stage', 
        'fatigue_level', 'gender', 'ethnicity', 'location'
      ],
      created_at: new Date(),
      updated_at: new Date()
    };
    await db.collection('ai_settings').insertOne(settings);
  }
  return settings;
}

async function updateAISettings(settings) {
  await db.collection('ai_settings').updateOne(
    { key: 'global' },
    {
      $set: {
        ...settings,
        updated_at: new Date()
      }
    },
    { upsert: true }
  );
  return await getAISettings();
}

function getDefaultSystemPrompt() {
  return `You are "Untire Coach," a warm, empathetic AI companion for adults experiencing cancer-related fatigue. Your role is to have flowing, supportive conversations that help patients feel heard and understood.

CONVERSATION APPROACH:
- Be PROACTIVE: If the user doesn't provide much information, take the initiative to start meaningful topics
- Use the dynamic profile to reference things you know about them
- Ask thoughtful follow-up questions to better understand their situation
- Be genuinely curious about their daily experience, energy patterns, and challenges
- Guide conversations naturally through topics like sleep, activity levels, emotional state, support systems
- Offer gentle, practical strategies when appropriate
- Always validate their feelings and experiences

RESPONSE STYLE:
- Keep responses conversational (100-180 words)
- Always end with a thoughtful question to continue the dialogue
- Use empathetic language that shows you're listening
- Be specific in your questions (not generic)
- Reference specific details from their profile when relevant

IMPORTANT: This is educational support, not medical advice. Encourage them to discuss significant concerns with their healthcare team.`;
}

// Saved memories operations (for card-based memory UI)
async function getSavedMemories(userId) {
  return await db.collection('saved_memories')
    .find({ user_id: userId })
    .sort({ created_at: -1 })
    .toArray();
}

async function addSavedMemory(userId, title, content, category = null) {
  const result = await db.collection('saved_memories').insertOne({
    user_id: userId,
    title,
    content,
    category,
    created_at: new Date(),
    updated_at: new Date()
  });
  return result.insertedId;
}

async function deleteSavedMemory(memoryId) {
  await db.collection('saved_memories').deleteOne({ _id: memoryId });
}

async function updateSavedMemory(memoryId, updates) {
  await db.collection('saved_memories').updateOne(
    { _id: memoryId },
    { $set: { ...updates, updated_at: new Date() } }
  );
}

// Close connection
async function closeDatabase() {
  if (client) {
    await client.close();
    console.log('MongoDB connection closed');
  }
}

// Initialize on load
initializeDatabase().catch(console.error);

module.exports = {
  initializeDatabase,
  closeDatabase,
  createDefaultAdminIfNeeded,
  getOrCreateUser,
  getUserByUsername,
  createUserWithAuth,
  getUserById,
  getAllUsers,
  deleteUser,
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
  deleteVideo,
  getAllBreathingExercises,
  addBreathingExercise,
  deleteBreathingExercise,
  getAllQuizQuestions,
  addQuizQuestion,
  getAISettings,
  updateAISettings,
  getSavedMemories,
  addSavedMemory,
  deleteSavedMemory,
  updateSavedMemory
};

