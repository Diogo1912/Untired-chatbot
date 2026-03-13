import { getOpenRouter, EVAL_MODEL } from './llm';
import { getChatMessages, updateDynamicProfile, getProfile } from './db';

export async function extractAndUpdateProfile(userId: string, chatId: string): Promise<void> {
  try {
    const messages = getChatMessages(chatId);
    if (messages.length < 4) return; // Not enough to extract from

    const existing = getProfile(userId);
    const currentProfile = existing?.dynamic_profile ?? '';

    const conversation = messages
      .filter((m: { role: string; content: string }) => m.role === 'user' || m.role === 'assistant')
      .slice(-20)
      .map((m: { role: string; content: string }) => `${m.role === 'user' ? 'User' : 'Coach'}: ${m.content}`)
      .join('\n');

    const client = getOpenRouter();
    const completion = await client.chat.completions.create({
      model: EVAL_MODEL,
      messages: [
        {
          role: 'system',
          content: 'You are a profile extraction assistant. Extract concise, factual information from coaching conversations. Return only a brief summary (max 200 words). Focus on: energy patterns, emotional patterns, coping strategies mentioned, personal details shared, goals, challenges. Be factual, not interpretive.'
        },
        {
          role: 'user',
          content: `Current profile summary:\n${currentProfile || 'None yet'}\n\nLatest conversation:\n${conversation}\n\nUpdate the profile summary with any new relevant information. Return only the updated summary text, nothing else.`
        }
      ],
      max_tokens: 300,
      temperature: 0.2,
    });

    const newProfile = completion.choices[0].message.content?.trim();
    if (newProfile && newProfile !== currentProfile) {
      updateDynamicProfile(userId, newProfile);
    }
  } catch {
    // Non-critical — fail silently
  }
}
