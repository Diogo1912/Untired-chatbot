import { getOpenRouter, EVAL_MODEL } from './llm';

const RISK_KEYWORDS = [
  'suicid', 'kill myself', 'end my life', 'want to die', 'no reason to live',
  'hopeless', 'worthless', 'better off dead', 'can\'t go on', 'give up on life',
  'self-harm', 'hurt myself', 'cutting myself',
];

export function detectRisk(text: string): { triggered: boolean; triggerType: string; severity: string } {
  const lower = text.toLowerCase();
  for (const kw of RISK_KEYWORDS) {
    if (lower.includes(kw)) {
      return {
        triggered: true,
        triggerType: 'keyword',
        severity: kw.includes('suicid') || kw.includes('kill myself') || kw.includes('end my life') ? 'high' : 'moderate',
      };
    }
  }
  return { triggered: false, triggerType: '', severity: '' };
}

/**
 * LLM-based risk detection — catches nuanced distress that keywords miss.
 * Runs async as a safety net; keyword check remains the synchronous gate.
 */
export async function detectRiskLLM(message: string): Promise<{ triggered: boolean; severity: string; reasoning: string }> {
  try {
    const client = getOpenRouter();
    const completion = await client.chat.completions.create({
      model: EVAL_MODEL,
      messages: [
        {
          role: 'system',
          content: `You are a mental health risk assessor for a cancer fatigue support app. Analyze the user message for signs of:
- Suicidal ideation (direct or indirect)
- Self-harm intent
- Severe hopelessness or despair beyond normal fatigue frustration
- Expressions suggesting the person may be in danger

Important: Cancer fatigue often causes frustration and low mood. Only flag messages that go BEYOND normal fatigue-related distress into territory requiring professional crisis support.

Respond ONLY with valid JSON:
{"triggered": true/false, "severity": "high"/"moderate"/"low", "reasoning": "one sentence"}`,
        },
        { role: 'user', content: message },
      ],
      max_tokens: 100,
      temperature: 0,
    });

    const raw = completion.choices[0].message.content?.trim() ?? '{}';
    const parsed = JSON.parse(raw.replace(/```json|```/g, '').trim());
    return {
      triggered: parsed.triggered === true,
      severity: parsed.severity ?? 'moderate',
      reasoning: parsed.reasoning ?? '',
    };
  } catch {
    return { triggered: false, severity: '', reasoning: '' };
  }
}

export const RISK_RESPONSE = `I hear how much you're struggling right now, and I want you to know that your pain is real and valid.

I need to be honest with you — I'm an AI coach, not a healthcare professional, and I'm not equipped to support you through what you're describing. But I care deeply about your wellbeing, and I don't want you to face this alone.

**Please reach out to someone who can truly help:**
- **Netherlands Crisis Line:** 0800-0113 (free, 24/7)
- **International Association for Suicide Prevention:** https://www.iasp.info/resources/Crisis_Centres/
- **Your GP or healthcare team** — they are there for exactly this

You deserve real, human support right now. Would you feel comfortable reaching out to one of these?`;
