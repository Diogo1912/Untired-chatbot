const express = require('express');
const cors = require('cors');
const dotenv = require('dotenv');
const OpenAI = require('openai');
const path = require('path');
const crypto = require('crypto');
const cookieParser = require('cookie-parser');
const {
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
} = require('./database-mongo');
const { extractProfileInfo } = require('./profileExtractor');

// Load environment variables
dotenv.config();

const app = express();
const PORT = process.env.PORT || 3003;

// Initialize OpenAI
const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

// Basic CORS and JSON parsing
app.use(cors({
  origin: true,
  credentials: true
}));
app.use(express.json());
app.use(cookieParser());
app.use(express.static(__dirname));

// Authentication middleware
async function authenticateUser(req, res, next) {
  const sessionId = req.cookies?.sessionId;
  
  if (!sessionId) {
    return res.status(401).json({ error: 'Not authenticated' });
  }
  
  const session = await getSession(sessionId);
  if (!session) {
    return res.status(401).json({ error: 'Session expired or invalid' });
  }
  
  req.userId = session.user_id;
  req.sessionId = sessionId;
  next();
}

// Admin authentication middleware
async function authenticateAdmin(req, res, next) {
  await authenticateUser(req, res, async () => {
    const user = await getUserById(req.userId);
    if (!user || !user.is_admin) {
      return res.status(403).json({ error: 'Admin access required' });
    }
    next();
  });
}

// Helper function to hash passwords
function hashPassword(password) {
  return crypto.createHash('sha256').update(password).digest('hex');
}

// Health check endpoint
app.get('/api/health', (req, res) => {
  res.json({ 
    status: 'healthy', 
    timestamp: new Date().toISOString(),
    version: '2.0.0',
    database: 'MongoDB'
  });
});

// Authentication endpoints
app.post('/api/auth/login', async (req, res) => {
  try {
    const { username, password } = req.body;
    
    if (!username || !password) {
      return res.status(400).json({ error: 'Username and password required' });
    }
    
    // If trying to login as admin, ensure admin exists
    if (username === 'admin') {
      const { createDefaultAdminIfNeeded } = require('./database-mongo');
      await createDefaultAdminIfNeeded();
    }
    
    const user = await getUserByUsername(username);
    if (!user) {
      return res.status(401).json({ error: 'Invalid username or password' });
    }
    
    const passwordHash = hashPassword(password);
    if (user.password_hash !== passwordHash) {
      return res.status(401).json({ error: 'Invalid username or password' });
    }
    
    // Create session
    const sessionId = crypto.randomBytes(32).toString('hex');
    const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000); // 7 days
    
    await createSession(user._id, sessionId, expiresAt.toISOString());
    
    res.cookie('sessionId', sessionId, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: 7 * 24 * 60 * 60 * 1000 // 7 days
    });
    
    res.json({ 
      success: true, 
      user: {
        id: user._id,
        username: user.username,
        isAdmin: user.is_admin === true
      }
    });
  } catch (error) {
    console.error('Login error:', error);
    res.status(500).json({ error: 'Login failed' });
  }
});

app.post('/api/auth/logout', authenticateUser, async (req, res) => {
  try {
    await deleteSession(req.sessionId);
    res.clearCookie('sessionId');
    res.json({ success: true });
  } catch (error) {
    console.error('Logout error:', error);
    res.status(500).json({ error: 'Logout failed' });
  }
});

app.get('/api/auth/me', authenticateUser, async (req, res) => {
  try {
    const user = await getUserById(req.userId);
    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }
    res.json({ 
      user: {
        id: user._id,
        username: user.username,
        isAdmin: user.is_admin === true
      }
    });
  } catch (error) {
    console.error('Auth check error:', error);
    res.status(500).json({ error: 'Authentication check failed' });
  }
});

// Admin endpoints
app.get('/api/admin/ai-settings', authenticateAdmin, async (req, res) => {
  try {
    const settings = await getAISettings();
    res.json(settings);
  } catch (error) {
    console.error('AI settings fetch error:', error);
    res.status(500).json({ error: 'Failed to fetch AI settings' });
  }
});

app.post('/api/admin/ai-settings', authenticateAdmin, async (req, res) => {
  try {
    const settings = await updateAISettings(req.body);
    res.json(settings);
  } catch (error) {
    console.error('AI settings update error:', error);
    res.status(500).json({ error: 'Failed to update AI settings' });
  }
});

app.get('/api/admin/users', authenticateAdmin, async (req, res) => {
  try {
    const users = await getAllUsers();
    res.json({ users });
  } catch (error) {
    console.error('Users fetch error:', error);
    res.status(500).json({ error: 'Failed to fetch users' });
  }
});

app.post('/api/admin/users', authenticateAdmin, async (req, res) => {
  try {
    const { username, password } = req.body;
    
    if (!username || !password) {
      return res.status(400).json({ error: 'Username and password required' });
    }
    
    const passwordHash = hashPassword(password);
    const user = await createUserWithAuth(username, passwordHash, false);
    
    res.json({ user: { id: user._id, username: user.username } });
  } catch (error) {
    console.error('User creation error:', error);
    res.status(500).json({ error: 'Failed to create user' });
  }
});

app.delete('/api/admin/users/:userId', authenticateAdmin, async (req, res) => {
  try {
    const { userId } = req.params;
    
    // Prevent deleting self
    if (userId === req.userId) {
      return res.status(400).json({ error: 'Cannot delete your own account' });
    }
    
    await deleteUser(userId);
    res.json({ success: true });
  } catch (error) {
    console.error('User deletion error:', error);
    res.status(500).json({ error: 'Failed to delete user' });
  }
});

app.get('/api/admin/stats', authenticateAdmin, async (req, res) => {
  try {
    const users = await getAllUsers();
    const videos = await getAllVideos();
    
    // Would need to aggregate chats and messages count from MongoDB
    // For now, return basic stats
    res.json({
      totalUsers: users.length,
      totalChats: 0, // TODO: Implement aggregation
      totalMessages: 0, // TODO: Implement aggregation
      totalVideos: videos.length,
      openaiConnected: !!process.env.OPENAI_API_KEY
    });
  } catch (error) {
    console.error('Stats fetch error:', error);
    res.status(500).json({ error: 'Failed to fetch stats' });
  }
});

// Generate dynamic system prompt based on user profile, fatigue level, settings, and AI settings
async function generateSystemPrompt(profile, fatigueLevel, userSettings, dynamicProfile) {
  const aiSettings = await getAISettings();
  
  let fatigueGuidance = '';
  
  if (fatigueLevel !== null && fatigueLevel !== undefined) {
    if (fatigueLevel >= 8.0) {
      fatigueGuidance = `CRITICAL: The user's current fatigue level is ${fatigueLevel}/10, which indicates severe fatigue. 
- Be extra gentle and validating - they are likely struggling significantly
- Focus on rest, self-compassion, and managing basic daily needs
- Avoid suggesting activities that require energy
- Emphasize that this level of fatigue is valid and they're not alone
- Be patient if responses are brief or they seem withdrawn`;
    } else if (fatigueLevel >= 6.0) {
      fatigueGuidance = `IMPORTANT: The user's current fatigue level is ${fatigueLevel}/10, indicating moderate-to-severe fatigue.
- Acknowledge the significant impact this has on their daily life
- Focus on gentle strategies and realistic expectations
- Be understanding if they mention struggling with daily tasks
- Encourage pacing and rest breaks
- Validate the difficulty of managing moderate fatigue`;
    } else if (fatigueLevel >= 4.0) {
      fatigueGuidance = `The user's current fatigue level is ${fatigueLevel}/10, indicating moderate fatigue.
- They may have some energy but still experience significant limitations
- Balance encouragement with realistic expectations
- Suggest gentle activities and pacing strategies
- Acknowledge that even moderate fatigue can be challenging`;
    } else {
      fatigueGuidance = `The user's current fatigue level is ${fatigueLevel}/10, indicating mild fatigue.
- They may have more capacity for activities and strategies
- Still be gentle and validate their experience
- Can suggest more active coping strategies while respecting their limits`;
    }
  }

  const profileInfo = profile ? `
USER PROFILE:
${profile.name ? `- Name: ${profile.name}` : ''}
${profile.age ? `- Age: ${profile.age}` : ''}
${profile.gender ? `- Gender: ${profile.gender}` : ''}
${profile.ethnicity ? `- Ethnicity: ${profile.ethnicity}` : ''}
${profile.cancer_type ? `- Cancer Type: ${profile.cancer_type}` : ''}
${profile.treatment_stage ? `- Treatment Stage: ${profile.treatment_stage}` : ''}
${profile.diagnosis_date ? `- Diagnosis Date: ${profile.diagnosis_date}` : ''}
${profile.current_fatigue_level !== null ? `- Typical fatigue level: ${profile.current_fatigue_level}/10` : ''}
${profile.location ? `- Location: ${profile.location}` : ''}
${profile.support_system ? `- Support System: ${profile.support_system}` : ''}
` : '';

  const dynamicProfileSection = dynamicProfile ? `
DYNAMIC PROFILE (learned from conversations):
${dynamicProfile}

Use this information to personalize your responses and remember important details about the user.
` : '';

  // Behavior type customization
  const behaviorGuidance = userSettings?.behavior_type === 'empathetic' ? 
    '- Use warm, empathetic language\n- Show deep understanding and validation\n- Be gentle and supportive' :
    userSettings?.behavior_type === 'practical' ?
    '- Focus on actionable strategies\n- Be direct but kind\n- Offer concrete suggestions' :
    userSettings?.behavior_type === 'encouraging' ?
    '- Use positive, uplifting language\n- Highlight progress and strengths\n- Be motivational' :
    '- Use warm, empathetic language\n- Show deep understanding and validation\n- Be gentle and supportive';

  const enabledTools = aiSettings.enabled_tools || [];
  const agenticGuidance = userSettings?.agentic_features && !userSettings?.chat_only ? `
AGENTIC FEATURES ENABLED:
${enabledTools.includes('videos') ? '- You can suggest meditation videos when the user expresses stress, anxiety, or overwhelm\n- Use the format: [VIDEO:title:embed_url] to embed videos in your response' : ''}
${enabledTools.includes('breathing') ? '- You can suggest breathing exercises when the user needs quick stress relief or relaxation\n- Use the format: [BREATHING:title:duration:pattern:embed_code] to embed breathing exercises' : ''}
${enabledTools.includes('journaling') ? '- You can suggest journaling prompts for self-reflection\n- Use the format: [JOURNAL:prompt_text]' : ''}
${enabledTools.includes('activity_tracking') ? '- You can help track daily activities and energy levels\n- Use the format: [ACTIVITY:type:duration:energy_level]' : ''}
${enabledTools.includes('mood_tracking') ? '- You can help track mood and emotional states\n- Use the format: [MOOD:emotion:intensity:notes]' : ''}
- Only suggest tools when genuinely helpful, not in every response
- Detect emotional states like stress, anxiety, worry, overwhelm, panic
- When suggesting a tool, briefly explain why it might help
` : '';

  // Use custom system prompt from AI settings or default
  const basePrompt = aiSettings.system_prompt || `You are "Untire Coach," a warm, empathetic AI companion for adults experiencing cancer-related fatigue. Your role is to have flowing, supportive conversations that help patients feel heard and understood.`;

  // Verbosity adjustment
  const verbosityGuidance = aiSettings.verbosity === 'low' ? 
    '\nRESPONSE LENGTH: Keep responses brief (50-100 words)' :
    aiSettings.verbosity === 'high' ?
    '\nRESPONSE LENGTH: Provide detailed, comprehensive responses (150-250 words)' :
    '\nRESPONSE LENGTH: Keep responses conversational (100-180 words)';

  return `${basePrompt}

${profileInfo}

${dynamicProfileSection}

${fatigueGuidance}

BEHAVIOR TYPE: ${userSettings?.behavior_type || 'empathetic'}
${behaviorGuidance}

${agenticGuidance}

CONVERSATION APPROACH:
- Be PROACTIVE: If the user doesn't provide much information or says something vague like "hello" or "hi", take the initiative to start meaningful topics
- Use the dynamic profile to reference things you know about them (e.g., "How is your cat doing?" or "I remember you mentioned...")
- Ask thoughtful follow-up questions to better understand their situation
- Be genuinely curious about their daily experience, energy patterns, and challenges
- Guide conversations naturally through topics like sleep, activity levels, emotional state, support systems
- Offer gentle, practical strategies when appropriate
- Always validate their feelings and experiences
- ${fatigueLevel !== null ? `Remember their current fatigue level (${fatigueLevel}/10) and adapt your suggestions accordingly` : ''}
- Update your understanding of the user based on what they share
- When starting conversations or when user input is minimal, suggest specific topics or ask about things relevant to their profile

${verbosityGuidance}
- Always end with a thoughtful question to continue the dialogue
- Use empathetic language that shows you're listening
- Be specific in your questions (not generic)
- Adapt your energy and suggestions to match their fatigue level
- Reference specific details from their profile when relevant to show you remember them
- If the user gives a brief response or doesn't provide much detail, be proactive and suggest topics or ask about specific aspects of their life based on what you know

IMPORTANT: This is educational support, not medical advice. Encourage them to discuss significant concerns with their healthcare team.

Focus on creating a supportive dialogue rather than just giving advice.`;
}

// Profile endpoints
app.get('/api/profile/:userId', authenticateUser, async (req, res) => {
  try {
    const { userId } = req.params;
    if (userId !== req.userId) {
      return res.status(403).json({ error: 'Forbidden: Cannot access other user profiles' });
    }
    const profile = await getProfile(userId);
    res.json({ profile: profile || null });
  } catch (error) {
    console.error('Profile fetch error:', error);
    res.status(500).json({ error: 'Failed to fetch profile' });
  }
});

app.post('/api/profile/:userId', authenticateUser, async (req, res) => {
  try {
    const { userId } = req.params;
    if (userId !== req.userId) {
      return res.status(403).json({ error: 'Forbidden' });
    }
    
    await getOrCreateUser(userId);
    const profile = await createOrUpdateProfile(userId, req.body);
    
    res.json({ profile });
  } catch (error) {
    console.error('Profile update error:', error);
    res.status(500).json({ error: 'Failed to update profile' });
  }
});

// Endpoint to check if fatigue should be asked
app.get('/api/profile/:userId/should-ask-fatigue', authenticateUser, async (req, res) => {
  try {
    const { userId } = req.params;
    if (userId !== req.userId) {
      return res.status(403).json({ error: 'Forbidden' });
    }
    const profile = await getProfile(userId);
    
    if (!profile) {
      return res.json({ shouldAsk: true, reason: 'no_profile' });
    }
    
    // If profile has typical fatigue level, use that instead
    if (profile.current_fatigue_level !== null && profile.current_fatigue_level !== undefined) {
      return res.json({ 
        shouldAsk: false, 
        reason: 'has_typical_fatigue',
        typicalFatigue: profile.current_fatigue_level 
      });
    }
    
    // Check if asked today
    const today = new Date().toISOString().split('T')[0];
    if (profile.last_fatigue_asked_date === today) {
      return res.json({ shouldAsk: false, reason: 'asked_today' });
    }
    
    return res.json({ shouldAsk: true, reason: 'not_asked_today' });
  } catch (error) {
    console.error('Check fatigue error:', error);
    res.status(500).json({ error: 'Failed to check fatigue status' });
  }
});

// Endpoint to update last fatigue asked date
app.post('/api/profile/:userId/fatigue-asked', authenticateUser, async (req, res) => {
  try {
    const { userId } = req.params;
    if (userId !== req.userId) {
      return res.status(403).json({ error: 'Forbidden' });
    }
    await updateLastFatigueAskedDate(userId);
    res.json({ success: true });
  } catch (error) {
    console.error('Update fatigue asked error:', error);
    res.status(500).json({ error: 'Failed to update fatigue asked date' });
  }
});

// Endpoint to clear all user data
app.delete('/api/user/:userId/clear-all', authenticateUser, async (req, res) => {
  try {
    const { userId } = req.params;
    if (userId !== req.userId) {
      return res.status(403).json({ error: 'Forbidden' });
    }
    await deleteAllUserData(userId);
    res.json({ success: true });
  } catch (error) {
    console.error('Clear user data error:', error);
    res.status(500).json({ error: 'Failed to clear user data' });
  }
});

// User settings endpoints
app.get('/api/settings/:userId', authenticateUser, async (req, res) => {
  try {
    const { userId } = req.params;
    if (userId !== req.userId) {
      return res.status(403).json({ error: 'Forbidden' });
    }
    const settings = await getUserSettings(userId);
    res.json({ settings });
  } catch (error) {
    console.error('Settings fetch error:', error);
    res.status(500).json({ error: 'Failed to fetch settings' });
  }
});

app.post('/api/settings/:userId', authenticateUser, async (req, res) => {
  try {
    const { userId } = req.params;
    if (userId !== req.userId) {
      return res.status(403).json({ error: 'Forbidden' });
    }
    
    await getOrCreateUser(userId);
    const settings = await updateUserSettings(userId, req.body);
    
    res.json({ settings });
  } catch (error) {
    console.error('Settings update error:', error);
    res.status(500).json({ error: 'Failed to update settings' });
  }
});

// Video endpoints
app.get('/api/videos', async (req, res) => {
  try {
    const { category } = req.query;
    const videos = category ? await getVideosByCategory(category) : await getAllVideos();
    res.json({ videos });
  } catch (error) {
    console.error('Videos fetch error:', error);
    res.status(500).json({ error: 'Failed to fetch videos' });
  }
});

app.post('/api/videos', async (req, res) => {
  try {
    const { title, url, embed_url, category, tags } = req.body;
    const video = await addVideo(title, url, embed_url, category, tags);
    res.json({ video });
  } catch (error) {
    console.error('Video add error:', error);
    res.status(500).json({ error: 'Failed to add video' });
  }
});

// Breathing exercises endpoints
app.get('/api/breathing-exercises', async (req, res) => {
  try {
    const exercises = await getAllBreathingExercises();
    res.json({ exercises });
  } catch (error) {
    console.error('Breathing exercises fetch error:', error);
    res.status(500).json({ error: 'Failed to fetch breathing exercises' });
  }
});

app.post('/api/breathing-exercises', async (req, res) => {
  try {
    const { title, description, duration, pattern, embed_code } = req.body;
    const exercise = await addBreathingExercise(title, description, duration, pattern, embed_code);
    res.json({ exercise });
  } catch (error) {
    console.error('Breathing exercise add error:', error);
    res.status(500).json({ error: 'Failed to add breathing exercise' });
  }
});

// Fatigue quiz endpoints
app.get('/api/fatigue-quiz/questions', async (req, res) => {
  try {
    const questions = await getAllQuizQuestions();
    res.json({ questions });
  } catch (error) {
    console.error('Quiz questions fetch error:', error);
    res.status(500).json({ error: 'Failed to fetch quiz questions' });
  }
});

app.post('/api/fatigue-quiz/calculate', async (req, res) => {
  try {
    const { answers } = req.body;
    
    if (!answers || !Array.isArray(answers)) {
      return res.status(400).json({ error: 'Invalid answers format' });
    }
    
    const questions = await getAllQuizQuestions();
    
    let totalScore = 0;
    let totalWeight = 0;
    
    for (const answer of answers) {
      const question = questions.find(q => q._id.toString() === answer.questionId);
      if (question) {
        const weight = question.weight || 1.0;
        totalScore += answer.optionValue * weight;
        totalWeight += weight;
      }
    }
    
    const averageScore = totalWeight > 0 ? totalScore / totalWeight : 5;
    const fatigueLevel = Math.min(10, Math.max(1, Math.round(averageScore * 10) / 10));
    
    res.json({ suggestedFatigueLevel: fatigueLevel });
  } catch (error) {
    console.error('Quiz calculation error:', error);
    res.status(500).json({ error: 'Failed to calculate fatigue level' });
  }
});

app.post('/api/profile/:userId/update-fatigue', authenticateUser, async (req, res) => {
  try {
    const { userId } = req.params;
    if (userId !== req.userId) {
      return res.status(403).json({ error: 'Forbidden' });
    }
    const { fatigueLevel } = req.body;
    
    await getOrCreateUser(userId);
    const profile = await createOrUpdateProfile(userId, { 
      current_fatigue_level: fatigueLevel 
    });
    
    res.json({ profile });
  } catch (error) {
    console.error('Fatigue update error:', error);
    res.status(500).json({ error: 'Failed to update fatigue level' });
  }
});

// Saved memories endpoints
app.get('/api/memories/:userId', authenticateUser, async (req, res) => {
  try {
    const { userId } = req.params;
    if (userId !== req.userId) {
      return res.status(403).json({ error: 'Forbidden' });
    }
    const memories = await getSavedMemories(userId);
    res.json({ memories });
  } catch (error) {
    console.error('Memories fetch error:', error);
    res.status(500).json({ error: 'Failed to fetch memories' });
  }
});

app.post('/api/memories/:userId', authenticateUser, async (req, res) => {
  try {
    const { userId } = req.params;
    if (userId !== req.userId) {
      return res.status(403).json({ error: 'Forbidden' });
    }
    const { title, content, category } = req.body;
    const memoryId = await addSavedMemory(userId, title, content, category);
    res.json({ memoryId });
  } catch (error) {
    console.error('Memory save error:', error);
    res.status(500).json({ error: 'Failed to save memory' });
  }
});

app.delete('/api/memories/:memoryId', authenticateUser, async (req, res) => {
  try {
    const { memoryId } = req.params;
    // Would need to verify ownership here
    await deleteSavedMemory(memoryId);
    res.json({ success: true });
  } catch (error) {
    console.error('Memory delete error:', error);
    res.status(500).json({ error: 'Failed to delete memory' });
  }
});

// Welcome message endpoint
app.post('/api/welcome-message', authenticateUser, async (req, res) => {
  try {
    const { userProfile, currentFatigueLevel, dynamicProfile } = req.body;
    const userId = req.userId;
    
    if (!process.env.OPENAI_API_KEY) {
      return res.json({ 
        message: "Hello! I'm Untire Coach. I'm here to support you through cancer-related fatigue with gentle, practical strategies. What brings you here today?" 
      });
    }

    const profile = userProfile || await getProfile(userId);
    const settings = await getUserSettings(userId);
    const dynamicProf = dynamicProfile || await getDynamicProfile(userId);
    
    const systemPrompt = await generateSystemPrompt(profile, currentFatigueLevel, settings, dynamicProf);
    
    let welcomePrompt = `Create a warm, personalized welcome message for this user. `;
    
    if (profile?.name) {
      welcomePrompt += `Address them by name: ${profile.name}. `;
    }
    
    if (currentFatigueLevel) {
      welcomePrompt += `Their current fatigue level is ${currentFatigueLevel}/10. `;
    }
    
    if (dynamicProf) {
      welcomePrompt += `\n\nHere's what I know about them:\n${dynamicProf}\n\nReference specific details from this profile to show you remember them. Be proactive and suggest topics or ask about things relevant to their life. `;
    } else {
      welcomePrompt += `This is a new user or we don't have much information yet. `;
    }
    
    welcomePrompt += `\n\nBe proactive: Don't just ask "what brings you here?" - suggest specific topics or ask about their day, energy levels, sleep, or how they're feeling. Make it personal and engaging. Keep it conversational (100-150 words).`;
    
    const aiSettings = await getAISettings();
    
    // DISABLED - No predetermined welcome messages
    res.json({ message: '' });
  } catch (error) {
    console.error('Welcome message error:', error);
    res.json({ message: '' }); // Return empty instead of error
  }
});

// Chat endpoints
app.get('/api/chats/:userId', authenticateUser, async (req, res) => {
  try {
    const { userId } = req.params;
    if (userId !== req.userId) {
      return res.status(403).json({ error: 'Forbidden' });
    }
    const chats = await getUserChats(userId);
    res.json({ chats });
  } catch (error) {
    console.error('Chats fetch error:', error);
    res.status(500).json({ error: 'Failed to fetch chats' });
  }
});

app.get('/api/chat/:chatId', authenticateUser, async (req, res) => {
  try {
    const { chatId } = req.params;
    const chat = await getChat(chatId);
    if (!chat) {
      return res.status(404).json({ error: 'Chat not found' });
    }
    if (chat.user_id !== req.userId) {
      return res.status(403).json({ error: 'Forbidden: Cannot access other user chats' });
    }
    const messages = await getChatMessages(chatId);
    res.json({ chat, messages });
  } catch (error) {
    console.error('Chat fetch error:', error);
    res.status(500).json({ error: 'Failed to fetch chat' });
  }
});

app.post('/api/chat', authenticateUser, async (req, res) => {
  try {
    const { chatId, message, initialFatigueLevel } = req.body;
    const userId = req.userId;
    
    if (!message) {
      return res.status(400).json({ 
        error: 'Missing required field: message' 
      });
    }

    await getOrCreateUser(userId);
    
    const profile = await getProfile(userId);
    const settings = await getUserSettings(userId);
    const dynamicProfile = await getDynamicProfile(userId);
    const aiSettings = await getAISettings();
    
    let chat = null;
    if (chatId) {
      chat = await getChat(chatId);
    }
    
    if (!chat && chatId) {
      chat = await createChat(chatId, userId, 'New Chat', initialFatigueLevel);
    }
    
    if (!chat) {
      return res.status(400).json({ 
        error: 'Chat must be created before sending messages' 
      });
    }
    
    const fatigueLevel = chat.initial_fatigue_level ?? profile?.current_fatigue_level ?? null;
    
    if (message !== '__INIT__') {
      await addMessage(chat._id, 'user', message);
      
      if (!chat.title || chat.title === 'New Chat') {
        const title = message.substring(0, 50) + (message.length > 50 ? '...' : '');
        await updateChatTitle(chat._id, title);
      }
    } else {
      return res.json({ response: '__INIT__' });
    }

    if (!process.env.OPENAI_API_KEY) {
      const fallbackResponse = "Thank you for reaching out and sharing with me. I can sense that you're looking for support with cancer-related fatigue, and I want you to know that what you're experiencing is completely valid.\n\nI'm currently running in demo mode, but I'm still here to listen and have a real conversation with you. Cancer-related fatigue isn't just being tired - it can feel like it touches every part of your day, can't it?\n\nI'd love to understand more about what you're going through. What does a typical day look like for you right now? Are there particular times when the fatigue feels heavier?\n\n*This is educational support to complement your healthcare team's care.*";
      
      await addMessage(chat._id, 'assistant', fallbackResponse);
      
      return res.json({ response: fallbackResponse });
    }

    const conversationHistory = await getChatMessages(chat._id);
    const formattedMessages = conversationHistory.map(m => ({
      role: m.role === 'user' ? 'user' : 'assistant',
      content: m.content
    }));

    let systemPrompt = await generateSystemPrompt(profile, fatigueLevel, settings, dynamicProfile);

    let availableVideos = [];
    let availableBreathing = [];
    const enabledTools = aiSettings.enabled_tools || [];
    
    if (settings?.agentic_features && !settings?.chat_only) {
      if (enabledTools.includes('videos')) {
        availableVideos = await getAllVideos();
      }
      if (enabledTools.includes('breathing')) {
        availableBreathing = await getAllBreathingExercises();
      }
    }

    let videoContext = '';
    if (availableVideos.length > 0) {
      videoContext += `\n\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
🎥 AVAILABLE MEDITATION VIDEOS - USE THESE PROACTIVELY!
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
${availableVideos.map(v => `📹 ${v.title}\n   Format: [VIDEO:${v.title}:${v.embed_url}]`).join('\n\n')}

WHEN TO USE VIDEOS:
✓ User mentions stress, anxiety, overwhelm, racing thoughts
✓ User needs help winding down or relaxing
✓ User asks for guided exercises or meditation
✓ After a difficult conversation - offer as a calming resource
✓ When user seems emotionally distressed
✓ User mentions insomnia or sleep difficulties

HOW TO USE: Simply include [VIDEO:title:embed_url] naturally in your response.
Example: "I have a gentle meditation that might help. [VIDEO:10 Minute Guided Meditation:https://youtube.com/embed/xyz]"`;
    }
    
    if (availableBreathing.length > 0) {
      videoContext += `\n\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
🫁 BREATHING EXERCISES - OFFER THESE FREQUENTLY!
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
${availableBreathing.map(b => `💨 ${b.title} (${b.duration}s)
   Pattern: ${b.pattern}
   Format: [BREATHING:${b.title}:${b.duration}:${b.pattern}:${b.embed_code || ''}]`).join('\n\n')}

WHEN TO USE BREATHING EXERCISES:
✓ User mentions anxiety, panic, or feeling overwhelmed
✓ Quick relief for immediate stress
✓ User feels tense or restless
✓ Before bed for better sleep
✓ During fatigue spikes for energy reset
✓ When user needs grounding
✓ At least once per conversation if user seems stressed

HOW TO USE: Include [BREATHING:title:duration:pattern:embedcode] in your response.
Example: "Let's take a moment to breathe together. [BREATHING:Box Breathing:60:Inhale 4s, Hold 4s, Exhale 4s, Hold 4s:]"

⚠️ IMPORTANT: Be PROACTIVE with these tools! Don't wait for users to ask - suggest them when appropriate.`;
    }

    const briefMessages = ['hi', 'hello', 'hey', 'ok', 'okay', 'yes', 'no', 'thanks', 'thank you'];
    const isBriefMessage = briefMessages.includes(message.toLowerCase().trim()) || message.trim().length < 10;
    
    if (isBriefMessage && formattedMessages.length > 0) {
      const proactiveNote = `\n\nNOTE: The user's last message was brief or vague ("${message}"). Be PROACTIVE - start a meaningful topic, reference something from their profile, or ask about specific aspects of their day/energy/situation. Don't just acknowledge - engage!`;
      systemPrompt += proactiveNote;
    }

    const finalSystemPrompt = systemPrompt + videoContext;

    const completion = await openai.chat.completions.create({
      model: aiSettings.model || 'gpt-5.2',
      messages: [
        { role: 'system', content: finalSystemPrompt },
        ...formattedMessages.slice(-10)
      ],
      max_tokens: aiSettings.max_tokens || 500,
      temperature: aiSettings.temperature || 0.8
    });

    let response = completion.choices[0].message.content;
    console.log('OpenAI response:', response);

    const videoRegex = /\[VIDEO:([^:]+):([^\]]+)\]/g;
    const videos = [];
    let match;
    while ((match = videoRegex.exec(response)) !== null) {
      videos.push({
        title: match[1].trim(),
        embedUrl: match[2].trim()
      });
    }
    response = response.replace(/\[VIDEO:[^\]]+\]/g, '');
    
    const breathingRegex = /\[BREATHING:([^:]+):([^:]+):([^:]+):([^\]]+)\]/g;
    const breathingExercises = [];
    while ((match = breathingRegex.exec(response)) !== null) {
      breathingExercises.push({
        title: match[1],
        duration: parseInt(match[2]),
        pattern: match[3],
        embedCode: match[4]
      });
      response = response.replace(match[0], '');
    }

    const mediaContent = {
      videos: videos.length > 0 ? videos : null,
      breathing: breathingExercises.length > 0 ? breathingExercises : null
    };
    await addMessage(chat._id, 'assistant', response, Object.keys(mediaContent).some(k => mediaContent[k]) ? mediaContent : null);

    const updatedConversationHistory = await getChatMessages(chat._id);
    const updatedFormattedMessages = updatedConversationHistory.map(m => ({
      role: m.role === 'user' ? 'user' : 'assistant',
      content: m.content
    }));
    
    if (updatedFormattedMessages.length >= 2 && aiSettings.memory_enabled) {
      const shouldUpdate = updatedFormattedMessages.length % 2 === 0;
      
      if (shouldUpdate) {
        extractProfileInfo(userId, updatedFormattedMessages, dynamicProfile)
          .then(newProfile => {
            if (newProfile && newProfile.trim() && newProfile !== dynamicProfile) {
              console.log('Updating dynamic profile:', newProfile.substring(0, 100) + '...');
              updateDynamicProfile(userId, newProfile)
                .then(() => {
                  console.log('Dynamic profile updated successfully');
                })
                .catch(err => console.error('Profile update save error:', err));
            }
          })
          .catch(err => console.error('Profile extraction error:', err));
      }
    }

    const responseData = { 
      response: response.trim()
    };
    
    if (videos.length > 0) {
      responseData.videos = videos;
      console.log('Sending videos:', videos);
    }
    
    if (breathingExercises.length > 0) {
      responseData.breathing = breathingExercises;
    }
    
    res.json(responseData);

  } catch (error) {
    console.error('Chat error:', error);
    console.error('Error stack:', error.stack);
    res.status(500).json({ 
      error: 'Failed to process request',
      details: process.env.NODE_ENV === 'development' ? error.message : 'An error occurred'
    });
  }
});

app.delete('/api/chat/:chatId', authenticateUser, async (req, res) => {
  try {
    const { chatId } = req.params;
    const chat = await getChat(chatId);
    if (!chat) {
      return res.status(404).json({ error: 'Chat not found' });
    }
    if (chat.user_id !== req.userId) {
      return res.status(403).json({ error: 'Forbidden' });
    }
    await deleteChat(chatId);
    res.json({ success: true });
  } catch (error) {
    console.error('Chat delete error:', error);
    res.status(500).json({ error: 'Failed to delete chat' });
  }
});

// Serve the main interface
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'index.html'));
});

// Serve admin interface
app.get('/admin.html', (req, res) => {
  res.sendFile(path.join(__dirname, 'admin.html'));
});

// Start server
app.listen(PORT, () => {
  console.log(`🌿 Untire Coach server running on port ${PORT}`);
  console.log(`🌐 Frontend: http://localhost:${PORT}`);
  console.log(`🔧 Admin Console: http://localhost:${PORT}/admin.html`);
  console.log(`🗄️  Database: MongoDB`);
  console.log(`🔑 OpenAI API: ${process.env.OPENAI_API_KEY ? 'Configured' : 'Not configured (using demo responses)'}`);
});

