// src/services/session.service.ts
import { randomBytes } from 'crypto';

export class SessionService {
  private sessions = new Map<string, { userId: string, expiresAt: Date }>();

  createSession(userId: string): string {
    const sessionId = randomBytes(32).toString('hex');
    this.sessions.set(sessionId, {
      userId,
      expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000), // 7 days
    });
    return sessionId;
  }

  validateSession(sessionId: string): string | null {
    const session = this.sessions.get(sessionId);
    if (!session || session.expiresAt < new Date()) {
      this.sessions.delete(sessionId);
      return null;
    }
    return session.userId;
  }

  invalidateSession(sessionId: string): void {
    this.sessions.delete(sessionId);
  }
}