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

export const RISK_RESPONSE = `I hear how much you're struggling right now, and I want you to know that your pain is real and valid.

I need to be honest with you — I'm an AI coach, not a healthcare professional, and I'm not equipped to support you through what you're describing. But I care deeply about your wellbeing, and I don't want you to face this alone.

**Please reach out to someone who can truly help:**
- **Netherlands Crisis Line:** 0800-0113 (free, 24/7)
- **International Association for Suicide Prevention:** https://www.iasp.info/resources/Crisis_Centres/
- **Your GP or healthcare team** — they are there for exactly this

You deserve real, human support right now. Would you feel comfortable reaching out to one of these?`;
