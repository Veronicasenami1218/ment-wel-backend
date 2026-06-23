import fetch from 'node-fetch';
import { logger } from '../utils/logger';

const GROQ_BASE = process.env.GROQ_API_BASE || 'https://api.groq.com/openai/v1';
const GROQ_KEY = process.env.GROQ_API_KEY;

if (!GROQ_KEY) {
  logger.warn('GROQ_API_KEY not set; AI endpoints will fail until configured');
}

export interface ChatMessage {
  role: 'system' | 'user' | 'assistant';
  content: string;
}

export const sendChatToGroq = async (messages: ChatMessage[]) => {
  if (!GROQ_KEY) {
    throw new Error('GROQ_API_KEY is not configured');
  }

  // Enforce the officially supported model for Groq
  const modelToUse = process.env.GROQ_MODEL || 'llama-3.3-70b-versatile';
  const url = `${GROQ_BASE}/chat/completions`;
  const body = {
    model: modelToUse,
    messages,
  };

  try {
    const res = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${GROQ_KEY}`,
      },
      body: JSON.stringify(body),
    });

    if (!res.ok) {
      const text = await res.text();
      logger.error('Groq API error', { status: res.status, body: text });
      throw new Error(`Groq API responded with ${res.status}: ${text}`);
    }

    const json = await res.json();
    const reply = json?.choices?.[0]?.message?.content || '';
    return { reply };
  } catch (err) {
    // Full error must be logged for debugging
    console.log('Full Groq error object:', err);
    logger.error('Error sending chat to Groq', { error: (err as Error).message });
    throw err;
  }
};

export default { sendChatToGroq };
