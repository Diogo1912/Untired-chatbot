const { MongoClient } = require('mongodb');
const dotenv = require('dotenv');

dotenv.config();

const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://localhost:27017/untire-coach';
let client = null;
let db = null;

// Initialize MongoDB connection with retry logic
async function initializeDatabase() {
  const maxRetries = 5;
  let retryCount = 0;
  
  while (retryCount < maxRetries) {
    try {
      console.log(`🔄 Attempting MongoDB connection (attempt ${retryCount + 1}/${maxRetries})...`);
      
      if (!MONGODB_URI) {
        console.error('❌ MONGODB_URI environment variable is not set!');
        console.log('💡 Please set MONGODB_URI in your environment variables');
        await new Promise(resolve => setTimeout(resolve, 5000));
        retryCount++;
        continue;
      }
      
      client = new MongoClient(MONGODB_URI, {
        serverSelectionTimeoutMS: 5000,
        socketTimeoutMS: 45000,
      });
      
      await client.connect();
      db = client.db();
      
      // Create indexes
      await checkDB().collection('users').createIndex({ username: 1 }, { unique: true, sparse: true });
      await checkDB().collection('sessions').createIndex({ expires_at: 1 }, { expireAfterSeconds: 0 });
      await checkDB().collection('profiles').createIndex({ user_id: 1 }, { unique: true });
      await checkDB().collection('chats').createIndex({ user_id: 1 });
      await checkDB().collection('messages').createIndex({ chat_id: 1 });
      await checkDB().collection('user_settings').createIndex({ user_id: 1 }, { unique: true });
      await checkDB().collection('ai_settings').createIndex({ key: 1 }, { unique: true });
      await checkDB().collection('saved_memories').createIndex({ user_id: 1 });
      
      // Auto-create default admin account if none exists
      await createDefaultAdminIfNeeded();
      
      console.log('✅ MongoDB connected successfully');
      return; // Success, exit the retry loop
      
    } catch (error) {
      retryCount++;
      console.error(`❌ MongoDB connection error (attempt ${retryCount}/${maxRetries}):`, error.message);
      
      if (retryCount >= maxRetries) {
        console.error('❌ Failed to connect to MongoDB after multiple attempts');
        console.error('⚠️  Server will start but database features will be unavailable');
        console.error('💡 Please check:');
        console.error('   1. MONGODB_URI environment variable is set correctly');
        console.error('   2. MongoDB service is running and accessible');
        console.error('   3. Network connection is stable');
        return; // Don't throw - let server start anyway
      }
      
      // Wait before retrying (exponential backoff)
      const waitTime = Math.min(1000 * Math.pow(2, retryCount), 10000);
      console.log(`⏳ Waiting ${waitTime/1000}s before retry...`);
      await new Promise(resolve => setTimeout(resolve, waitTime));
    }
  }
}

// Create default admin account if no admin exists
async function createDefaultAdminIfNeeded() {
  try {
    const crypto = require('crypto');
    
    // Check if any admin exists
    const adminExists = await checkDB().collection('users').findOne({ is_admin: true });
    
    if (!adminExists) {
      const defaultUsername = 'admin';
      const defaultPassword = 'UntireAdmin2024!'; // Change this in production!
      const passwordHash = crypto.createHash('sha256').update(defaultPassword).digest('hex');
      
      await checkDB().collection('users').insertOne({
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

// Helper to check database connection
function checkDB() {
  if (!db) {
    throw new Error('Database not connected. Please configure MONGODB_URI environment variable.');
  }
  return db;
}

// User operations
async function createUser(userId) {
  await checkDB().collection('users').insertOne({
    _id: userId,
    created_at: new Date(),
    updated_at: new Date()
  });
  return userId;
}

async function getUser(userId) {
  return await checkDB().collection('users').findOne({ _id: userId });
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
  if (!db) {
    console.error('Database not connected');
    return null;
  }
  return await checkDB().collection('users').findOne({ username });
}

async function createUserWithAuth(username, passwordHash, isAdmin = false) {
  const userId = `user_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  await checkDB().collection('users').insertOne({
    _id: userId,
    username,
    password_hash: passwordHash,
    is_admin: isAdmin,
    created_at: new Date(),
    updated_at: new Date()
  });
  return await checkDB().collection('users').findOne({ _id: userId });
}

async function getUserById(userId) {
  return await checkDB().collection('users').findOne(
    { _id: userId },
    { projection: { password_hash: 0 } }
  );
}

async function getAllUsers() {
  return await checkDB().collection('users').find(
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
  await checkDB().collection('sessions').insertOne({
    _id: sessionId,
    user_id: userId,
    expires_at: new Date(expiresAt),
    created_at: new Date()
  });
  return await checkDB().collection('sessions').findOne({ _id: sessionId });
}

async function getSession(sessionId) {
  return await checkDB().collection('sessions').findOne({
    _id: sessionId,
    expires_at: { $gt: new Date() }
  });
}

async function deleteSession(sessionId) {
  await checkDB().collection('sessions').deleteOne({ _id: sessionId });
}

async function deleteUserSessions(userId) {
  await checkDB().collection('sessions').deleteMany({ user_id: userId });
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
  
  await checkDB().collection('profiles').updateOne(
    { user_id: userId },
    updateData,
    { upsert: true }
  );
  
  return await getProfile(userId);
}

async function getProfile(userId) {
  return await checkDB().collection('profiles').findOne({ user_id: userId });
}

async function updateLastFatigueAskedDate(userId) {
  const today = new Date().toISOString().split('T')[0];
  await checkDB().collection('profiles').updateOne(
    { user_id: userId },
    { $set: { last_fatigue_asked_date: today } }
  );
}

// Chat operations
async function createChat(chatId, userId, title = 'New Chat', initialFatigueLevel = null) {
  await checkDB().collection('chats').insertOne({
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
  return await checkDB().collection('chats').findOne({ _id: chatId });
}

async function updateChatTitle(chatId, title) {
  await checkDB().collection('chats').updateOne(
    { _id: chatId },
    { $set: { title, updated_at: new Date() } }
  );
}

async function getUserChats(userId, limit = 10) {
  return await checkDB().collection('chats')
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
  const result = await checkDB().collection('messages').insertOne({
    chat_id: chatId,
    role,
    content,
    media,
    timestamp: new Date()
  });
  return result.insertedId;
}

async function getChatMessages(chatId) {
  const messages = await checkDB().collection('messages')
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
  let settings = await checkDB().collection('user_settings').findOne({ user_id: userId });
  if (!settings) {
    settings = {
      user_id: userId,
      behavior_type: 'empathetic',
      agentic_features: true,
      chat_only: false,
      created_at: new Date(),
      updated_at: new Date()
    };
    await checkDB().collection('user_settings').insertOne(settings);
  }
  return settings;
}

async function updateUserSettings(userId, settings) {
  await checkDB().collection('user_settings').updateOne(
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
  await checkDB().collection('profiles').updateOne(
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
  return await checkDB().collection('videos').find().sort({ title: 1 }).toArray();
}

async function getVideosByCategory(category) {
  return await checkDB().collection('videos').find({ category }).sort({ title: 1 }).toArray();
}

async function addVideo(title, url, embedUrl, category = null, tags = null) {
  const result = await checkDB().collection('videos').insertOne({
    title,
    url,
    embed_url: embedUrl,
    category,
    tags,
    created_at: new Date()
  });
  return await checkDB().collection('videos').findOne({ _id: result.insertedId });
}

async function deleteVideo(videoId) {
  await checkDB().collection('videos').deleteOne({ _id: videoId });
}

// Breathing exercises operations
async function getAllBreathingExercises() {
  return await checkDB().collection('breathing_exercises').find().sort({ title: 1 }).toArray();
}

async function addBreathingExercise(title, description, duration, pattern, embedCode) {
  const result = await checkDB().collection('breathing_exercises').insertOne({
    title,
    description,
    duration,
    pattern,
    embed_code: embedCode,
    created_at: new Date()
  });
  return await checkDB().collection('breathing_exercises').findOne({ _id: result.insertedId });
}

async function deleteBreathingExercise(exerciseId) {
  await checkDB().collection('breathing_exercises').deleteOne({ _id: exerciseId });
}

// Fatigue quiz operations
async function getAllQuizQuestions() {
  return await checkDB().collection('fatigue_quiz_questions').find().sort({ question_order: 1 }).toArray();
}

async function addQuizQuestion(questionText, questionOrder, options, weight = 1.0) {
  const result = await checkDB().collection('fatigue_quiz_questions').insertOne({
    question_text: questionText,
    question_order: questionOrder,
    options,
    weight,
    created_at: new Date()
  });
  return await checkDB().collection('fatigue_quiz_questions').findOne({ _id: result.insertedId });
}

// AI Settings operations (Admin configurable)
async function getAISettings() {
  let settings = await checkDB().collection('ai_settings').findOne({ key: 'global' });
  if (!settings) {
    settings = {
      key: 'global',
      system_prompt: getDefaultSystemPrompt(),
      temperature: 0.8,
      max_tokens: 500,
      model: 'gpt-4o',
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
    await checkDB().collection('ai_settings').insertOne(settings);
  }
  return settings;
}

async function updateAISettings(settings) {
  await checkDB().collection('ai_settings').updateOne(
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
  return await checkDB().collection('saved_memories')
    .find({ user_id: userId })
    .sort({ created_at: -1 })
    .toArray();
}

async function addSavedMemory(userId, title, content, category = null) {
  const result = await checkDB().collection('saved_memories').insertOne({
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
  await checkDB().collection('saved_memories').deleteOne({ _id: memoryId });
}

async function updateSavedMemory(memoryId, updates) {
  await checkDB().collection('saved_memories').updateOne(
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

// Initialize on load - don't crash if it fails
initializeDatabase().catch(error => {
  console.error('Database initialization failed:', error.message);
  console.log('⚠️  Server will continue but database features may be limited');
});

module.exports = {
  db, // Export db object for health checks
  initializeDatabase,
  closeDatabase,
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

