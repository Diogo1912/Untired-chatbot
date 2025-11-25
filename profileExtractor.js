// Profile extraction using OpenAI to analyze conversations and extract key information
const OpenAI = require('openai');

let openai = null;

function getOpenAI() {
  if (!openai && process.env.OPENAI_API_KEY) {
    openai = new OpenAI({
      apiKey: process.env.OPENAI_API_KEY,
    });
  }
  return openai;
}

async function extractProfileInfo(userId, conversationHistory, currentProfile) {
  const openaiClient = getOpenAI();
  if (!openaiClient || !process.env.OPENAI_API_KEY) {
    return currentProfile || '';
  }

  try {
    // Get last 20 messages for context
    const recentMessages = conversationHistory.slice(-20);
    
    const extractionPrompt = `Analyze the following conversation and extract key information about the user. Update or create a profile that includes:
- Personal details mentioned (family, work, hobbies, interests)
- Health-related information (treatment stage, symptoms, medications mentioned)
- Emotional patterns and coping strategies
- Preferences and dislikes
- Support systems mentioned
- Daily routines or challenges
- Goals or concerns expressed

Current profile: ${currentProfile || 'None'}

Conversation:
${recentMessages.map(m => `${m.role === 'user' ? 'User' : 'Coach'}: ${m.content}`).join('\n')}

Return ONLY a concise profile summary (max 300 words) that captures the most important information about this user. Focus on facts and patterns, not interpretations.`;

    const completion = await openaiClient.chat.completions.create({
      model: 'gpt-4o',
      messages: [
        { role: 'system', content: 'You are a profile extraction assistant. Extract factual information from conversations.' },
        { role: 'user', content: extractionPrompt }
      ],
      max_tokens: 400,
      temperature: 0.3
    });

    return completion.choices[0].message.content.trim();
  } catch (error) {
    console.error('Profile extraction error:', error);
    return currentProfile || '';
  }
}

module.exports = { extractProfileInfo };

