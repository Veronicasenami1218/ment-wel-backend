import { Request, Response } from 'express';
import { StatusCodes } from 'http-status-codes';
import { sendChatToGroq, ChatMessage } from '../services/ai.service';
import { logger } from '../utils/logger';

/**
 * POST /ai/chat
 * body: { messages: [{ role, content }], model?: string }
 */
export const handleChat = async (req: Request, res: Response) => {
  console.log('ENTERED CHAT CONTROLLER');
  try {
    const { messages, model } = req.body as { messages: ChatMessage[]; model?: string };
    if (!messages || !Array.isArray(messages) || messages.length === 0) {
      return res.status(StatusCodes.BAD_REQUEST).json({ success: false, error: 'messages are required' });
    }

    // Validate each message structure
    const allowedRoles = new Set(['system', 'user', 'assistant']);
    for (const [i, m] of messages.entries()) {
      if (!m || typeof m !== 'object') {
        return res.status(StatusCodes.BAD_REQUEST).json({ success: false, error: `messages[${i}] must be an object` });
      }
      if (!allowedRoles.has((m as any).role)) {
        return res.status(StatusCodes.BAD_REQUEST).json({ success: false, error: `messages[${i}].role is invalid` });
      }
      if (typeof (m as any).content !== 'string' || (m as any).content.trim() === '') {
        return res.status(StatusCodes.BAD_REQUEST).json({ success: false, error: `messages[${i}].content is required` });
      }
    }

    // Call Groq service inside try/catch and return stable response
    const result = await sendChatToGroq(messages);

    return res.status(StatusCodes.OK).json({ success: true, reply: result.reply });
  } catch (err) {
    const message = (err as Error).message || 'AI chat failed';
    logger.error('AI chat error', { error: message });

    // Network/DNS errors when contacting Groq should be surfaced as 502 Bad Gateway
    if (message.includes('getaddrinfo') || message.includes('ENOTFOUND') || message.includes('ECONNREFUSED') || message.includes('ENETUNREACH')) {
      return res.status(StatusCodes.BAD_GATEWAY).json({ success: false, error: `Unable to reach Groq API: ${message}` });
    }

    return res.status(StatusCodes.INTERNAL_SERVER_ERROR).json({ success: false, error: message });
  }
};

export default { handleChat };
