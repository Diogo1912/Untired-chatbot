const express = require('express');
const cors = require('cors');
const dotenv = require('dotenv');
const OpenAI = require('openai');
const path = require('path');
const { promisify } = require('util');
const crypto = require('crypto');
const cookieParser = require('cookie-parser');
const {
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
} = require('./database');
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

// Helper function to hash passwords
function hashPassword(password) {
  return crypto.createHash('sha256').update(password).digest('hex');
}

// Health check endpoint
app.get('/api/health', (req, res) => {
  res.json({ 
    status: 'healthy', 
    timestamp: new Date().toISOString(),
    version: '1.0.0'
  });
});

// Authentication endpoints
app.post('/api/auth/login', async (req, res) => {
  try {
    const { username, password } = req.body;
    
    if (!username || !password) {
      return res.status(400).json({ error: 'Username and password required' });
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
    
    await createSession(user.id, sessionId, expiresAt.toISOString());
    
    res.cookie('sessionId', sessionId, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: 7 * 24 * 60 * 60 * 1000 // 7 days
    });
    
    res.json({ 
      success: true, 
      user: {
        id: user.id,
        username: user.username,
        isAdmin: user.is_admin === 1
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
        id: user.id,
        username: user.username,
        isAdmin: user.is_admin === 1
      }
    });
  } catch (error) {
    console.error('Auth check error:', error);
    res.status(500).json({ error: 'Authentication check failed' });
  }
});

// Generate dynamic system prompt based on user profile, fatigue level, settings, and dynamic profile
function generateSystemPrompt(profile, fatigueLevel, settings, dynamicProfile) {
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
${profile.current_fatigue_level !== null ? `- Typical fatigue level: ${profile.current_fatigue_level}/10` : ''}
` : '';

  const dynamicProfileSection = dynamicProfile ? `
DYNAMIC PROFILE (learned from conversations):
${dynamicProfile}

Use this information to personalize your responses and remember important details about the user.
` : '';

  // Behavior type customization
  const behaviorGuidance = settings?.behavior_type === 'empathetic' ? 
    '- Use warm, empathetic language\n- Show deep understanding and validation\n- Be gentle and supportive' :
    settings?.behavior_type === 'practical' ?
    '- Focus on actionable strategies\n- Be direct but kind\n- Offer concrete suggestions' :
    settings?.behavior_type === 'encouraging' ?
    '- Use positive, uplifting language\n- Highlight progress and strengths\n- Be motivational' :
    '- Use warm, empathetic language\n- Show deep understanding and validation\n- Be gentle and supportive';

  const agenticGuidance = settings?.agentic_features && !settings?.chat_only ? `
AGENTIC FEATURES ENABLED:
- You can suggest meditation videos when the user expresses stress, anxiety, or overwhelm
- Use the format: [VIDEO:title:embed_url] to embed videos in your response
- You can suggest breathing exercises when the user needs quick stress relief or relaxation
- Use the format: [BREATHING:title:duration:pattern:embed_code] to embed breathing exercises
- Only suggest videos/exercises when genuinely helpful, not in every response
- Detect emotional states like stress, anxiety, worry, overwhelm, panic
- When suggesting a video or exercise, briefly explain why it might help
` : '';

  return `You are "Untire Coach," a warm, empathetic AI companion for adults experiencing cancer-related fatigue. Your role is to have flowing, supportive conversations that help patients feel heard and understood.

${profileInfo}

${dynamicProfileSection}

${fatigueGuidance}

BEHAVIOR TYPE: ${settings?.behavior_type || 'empathetic'}
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

RESPONSE STYLE:
- Keep responses conversational (100-180 words)
- Always end with a thoughtful question to continue the dialogue
- Use empathetic language that shows you're listening
- Be specific in your questions (not generic)
- Adapt your energy and suggestions to match their fatigue level
- Reference specific details from their profile when relevant to show you remember them
- If the user gives a brief response or doesn't provide much detail, be proactive and suggest topics or ask about specific aspects of their life based on what you know

IMPORTANT: This is educational support, not medical advice. Encourage them to discuss significant concerns with their healthcare team.

Focus on creating a supportive dialogue rather than just giving advice.`;
}

// Profile endpoints (now require authentication)
app.get('/api/profile/:userId', authenticateUser, async (req, res) => {
  try {
    const { userId } = req.params;
    // Ensure user can only access their own profile
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
    const { name, age, current_fatigue_level, last_fatigue_asked_date } = req.body;
    
    await getOrCreateUser(userId);
    const profile = await createOrUpdateProfile(userId, { 
      name, 
      age, 
      current_fatigue_level,
      last_fatigue_asked_date 
    });
    
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
    const { behavior_type, agentic_features, chat_only } = req.body;
    
    await getOrCreateUser(userId);
    const settings = await updateUserSettings(userId, {
      behavior_type,
      agentic_features,
      chat_only
    });
    
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
    // Parse options JSON
    const parsedQuestions = questions.map(q => ({
      ...q,
      options: JSON.parse(q.options)
    }));
    res.json({ questions: parsedQuestions });
  } catch (error) {
    console.error('Quiz questions fetch error:', error);
    res.status(500).json({ error: 'Failed to fetch quiz questions' });
  }
});

app.post('/api/fatigue-quiz/calculate', async (req, res) => {
  try {
    const { answers } = req.body; // Array of {questionId, selectedOption, optionValue}
    
    if (!answers || !Array.isArray(answers)) {
      return res.status(400).json({ error: 'Invalid answers format' });
    }
    
    // Calculate fatigue level based on answers
    // Each answer contributes to a fatigue score
    const { db } = require('./database');
    const dbGet = promisify(db.get.bind(db));
    
    let totalScore = 0;
    let totalWeight = 0;
    
    for (const answer of answers) {
      const question = await dbGet('SELECT * FROM fatigue_quiz_questions WHERE id = ?', [answer.questionId]);
      if (question) {
        const weight = question.weight || 1.0;
        totalScore += answer.optionValue * weight;
        totalWeight += weight;
      }
    }
    
    // Calculate average and convert to 1-10 scale
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

// Welcome message endpoint - generates personalized proactive welcome
app.post('/api/welcome-message', authenticateUser, async (req, res) => {
  try {
    const { userProfile, currentFatigueLevel, dynamicProfile } = req.body;
    const userId = req.userId; // Use authenticated user ID
    
    if (!process.env.OPENAI_API_KEY) {
      return res.json({ 
        message: "Hello! I'm Untire Coach. I'm here to support you through cancer-related fatigue with gentle, practical strategies. What brings you here today?" 
      });
    }

    const profile = userProfile || await getProfile(userId);
    const settings = await getUserSettings(userId);
    const dynamicProf = dynamicProfile || await getDynamicProfile(userId);
    
    const systemPrompt = generateSystemPrompt(profile, currentFatigueLevel, settings, dynamicProf);
    
    // Create a proactive welcome prompt
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
    
    const completion = await openai.chat.completions.create({
      model: 'gpt-4o',
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: welcomePrompt }
      ],
      max_tokens: 300,
      temperature: 0.8
    });

    const message = completion.choices[0].message.content;
    res.json({ message });
  } catch (error) {
    console.error('Welcome message error:', error);
    res.status(500).json({ error: 'Failed to generate welcome message' });
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
    // Ensure user can only access their own chats
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
    const userId = req.userId; // Use authenticated user ID from session
    
    if (!message) {
      return res.status(400).json({ 
        error: 'Missing required field: message' 
      });
    }

    // Get or create user
    await getOrCreateUser(userId);
    
    // Get user profile and settings
    const profile = await getProfile(userId);
    const settings = await getUserSettings(userId);
    const dynamicProfile = await getDynamicProfile(userId);
    
    // Create chat if it doesn't exist - MUST create before saving messages
    let chat = null;
    if (chatId) {
      chat = await getChat(chatId);
    }
    
    if (!chat && chatId) {
      // Create chat with initial fatigue level
      chat = await createChat(chatId, userId, 'New Chat', initialFatigueLevel);
    }
    
    // If still no chat, we can't proceed - but this shouldn't happen
    if (!chat) {
      return res.status(400).json({ 
        error: 'Chat must be created before sending messages' 
      });
    }
    
    // Use chat's initial fatigue level or profile's current fatigue level
    const fatigueLevel = chat.initial_fatigue_level ?? profile?.current_fatigue_level ?? null;
    
    // Skip initialization messages
    if (message !== '__INIT__') {
      // Save user message
      await addMessage(chat.id, 'user', message);
      
      // Update chat title if it's the first user message
      if (!chat.title || chat.title === 'New Chat') {
        const title = message.substring(0, 50) + (message.length > 50 ? '...' : '');
        await updateChatTitle(chat.id, title);
      }
    } else {
      // Just create the chat, don't process as a message
      return res.json({ response: '__INIT__' });
    }

    if (!process.env.OPENAI_API_KEY) {
      // Fallback response
      const fallbackResponse = "Thank you for reaching out and sharing with me. I can sense that you're looking for support with cancer-related fatigue, and I want you to know that what you're experiencing is completely valid.\n\nI'm currently running in demo mode, but I'm still here to listen and have a real conversation with you. Cancer-related fatigue isn't just being tired - it can feel like it touches every part of your day, can't it?\n\nI'd love to understand more about what you're going through. What does a typical day look like for you right now? Are there particular times when the fatigue feels heavier?\n\n*This is educational support to complement your healthcare team's care.*";
      
      await addMessage(chat.id, 'assistant', fallbackResponse);
      
      return res.json({ response: fallbackResponse });
    }

    // Get conversation history
    const conversationHistory = await getChatMessages(chat.id);
    const formattedMessages = conversationHistory.map(m => ({
      role: m.role === 'user' ? 'user' : 'assistant',
      content: m.content
    }));

    // Generate system prompt with profile, fatigue, settings, and dynamic profile
    let systemPrompt = generateSystemPrompt(profile, fatigueLevel, settings, dynamicProfile);

    // Get available videos and breathing exercises if agentic features are enabled
    let availableVideos = [];
    let availableBreathing = [];
    if (settings?.agentic_features && !settings?.chat_only) {
      availableVideos = await getAllVideos();
      availableBreathing = await getAllBreathingExercises();
    }

    // Add video and breathing context to system prompt
    let videoContext = '';
    if (availableVideos.length > 0) {
      videoContext += `\n\nAVAILABLE MEDITATION VIDEOS (use format [VIDEO:title:embed_url] to embed):
${availableVideos.map(v => `- ${v.title} (embed: ${v.embed_url})`).join('\n')}
Only suggest videos when the user expresses stress, anxiety, overwhelm, or requests relaxation help.`;
    }
    
    if (availableBreathing.length > 0) {
      videoContext += `\n\nAVAILABLE BREATHING EXERCISES (use format [BREATHING:title:duration:pattern:embed_code] to embed):
${availableBreathing.map(b => `- ${b.title} (${b.duration}s, pattern: ${b.pattern}, embed: ${b.embed_code})`).join('\n')}
Suggest breathing exercises for quick stress relief, anxiety, or when user needs immediate relaxation.`;
    }

    // Check if this is a brief/vague message and add proactive instruction
    const briefMessages = ['hi', 'hello', 'hey', 'ok', 'okay', 'yes', 'no', 'thanks', 'thank you'];
    const isBriefMessage = briefMessages.includes(message.toLowerCase().trim()) || message.trim().length < 10;
    
    if (isBriefMessage && formattedMessages.length > 0) {
      // Add proactive instruction for brief responses
      const proactiveNote = `\n\nNOTE: The user's last message was brief or vague ("${message}"). Be PROACTIVE - start a meaningful topic, reference something from their profile, or ask about specific aspects of their day/energy/situation. Don't just acknowledge - engage!`;
      systemPrompt += proactiveNote;
    }

    const finalSystemPrompt = systemPrompt + videoContext;

    // OpenAI API call - Using latest model (gpt-4o)
    // Note: GPT-5.1 doesn't exist yet, using latest available model (gpt-4o)
    const completion = await openai.chat.completions.create({
      model: 'gpt-4o', // Latest model as of 2024
      messages: [
        { role: 'system', content: finalSystemPrompt },
        ...formattedMessages.slice(-10) // Keep last 10 messages for context
      ],
      max_tokens: 500,
      temperature: 0.8
    });

    let response = completion.choices[0].message.content;
    console.log('OpenAI response:', response);

    // Parse video embeds from response
    const videoRegex = /\[VIDEO:([^:]+):([^\]]+)\]/g;
    const videos = [];
    let match;
    let lastIndex = 0;
    while ((match = videoRegex.exec(response)) !== null) {
      videos.push({
        title: match[1].trim(),
        embedUrl: match[2].trim()
      });
      lastIndex = videoRegex.lastIndex;
    }
    // Remove all video tags from response text
    response = response.replace(/\[VIDEO:[^\]]+\]/g, '');
    
    // Parse breathing exercise embeds from response
    const breathingRegex = /\[BREATHING:([^:]+):([^:]+):([^:]+):([^\]]+)\]/g;
    const breathingExercises = [];
    while ((match = breathingRegex.exec(response)) !== null) {
      breathingExercises.push({
        title: match[1],
        duration: parseInt(match[2]),
        pattern: match[3],
        embedCode: match[4]
      });
      // Remove the breathing tag from response text
      response = response.replace(match[0], '');
    }

    // Save assistant response with videos and breathing exercises
    const mediaContent = {
      videos: videos.length > 0 ? videos : null,
      breathing: breathingExercises.length > 0 ? breathingExercises : null
    };
    await addMessage(chat.id, 'assistant', response, Object.keys(mediaContent).some(k => mediaContent[k]) ? mediaContent : null);

    // Extract and update dynamic profile (async, don't wait)
    // Get updated conversation history including the new messages
    const updatedConversationHistory = await getChatMessages(chat.id);
    const updatedFormattedMessages = updatedConversationHistory.map(m => ({
      role: m.role === 'user' ? 'user' : 'assistant',
      content: m.content
    }));
    
    // Update profile after every message (or every 2-3 messages for efficiency)
    // Check if we have enough messages to extract meaningful info
    if (updatedFormattedMessages.length >= 2) {
      // Update profile every 2 messages (user + assistant)
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
    // Ensure user can only delete their own chats
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

// Start server
app.listen(PORT, () => {
  console.log(`🌿 Simple Untire Coach server running on port ${PORT}`);
  console.log(`🌐 Frontend: http://localhost:${PORT}`);
  console.log(`🔑 OpenAI API: ${process.env.OPENAI_API_KEY ? 'Configured' : 'Not configured (using demo responses)'}`);
});