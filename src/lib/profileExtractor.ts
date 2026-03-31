import { getOpenRouter, EVAL_MODEL } from './llm';
import { getChatMessages, getProfile, insertProfileFact, rebuildDynamicProfile, getProfileFacts } from './db';

export async function extractAndUpdateProfile(userId: string, chatId: string): Promise<void> {
  try {
    const messages = getChatMessages(chatId);
    if (messages.length < 4) return; // Not enough to extract from

    const existingFacts = getProfileFacts(userId);
    const currentFacts = existingFacts.map((f: { content: string }) => `• ${f.content}`).join('\n');

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
          content: `You are a profile extraction assistant. Extract concise, factual information from coaching conversations.

Return ONLY a bullet list of NEW facts not already in the existing facts list. Each bullet starts with "• ".
Focus on: energy patterns, emotional patterns, coping strategies mentioned, personal details shared, goals, challenges.
Be factual and specific, not interpretive. Maximum 5 bullets. If there is nothing new, return "NONE".`
        },
        {
          role: 'user',
          content: `Existing facts:\n${currentFacts || 'None yet'}\n\nLatest conversation:\n${conversation}\n\nList only NEW facts (not already captured above). Return bullet list or NONE.`
        }
      ],
      max_tokens: 200,
      temperature: 0.2,
    });

    const output = completion.choices[0].message.content?.trim();
    if (!output || output === 'NONE') return;

    // Parse bullet lines
    const newFacts = output
      .split('\n')
      .map((l: string) => l.replace(/^[•\-*]\s*/, '').trim())
      .filter((l: string) => l.length > 5 && l !== 'NONE');

    for (const fact of newFacts) {
      insertProfileFact(userId, fact);
    }

    if (newFacts.length > 0) {
      rebuildDynamicProfile(userId);
    }
  } catch (err) {
    console.error('Profile extraction failed:', err instanceof Error ? err.message : err);
  }
}
