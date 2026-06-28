// src/middleware/request-id.ts
import { v4 as uuidv4 } from 'uuid';
import { Request, Response, NextFunction } from 'express';

declare global {
  namespace Express {
    interface Request {
      id: string;
    }
  }
}

export const requestIdMiddleware = (req: Request, res: Response, next: NextFunction) => {
  const requestId = req.headers['x-request-id'] as string || uuidv4();
  req.id = requestId;
  res.setHeader('x-request-id', requestId);
  next();
};

// Update your logger to include requestId
// src/utils/logger.ts
export const logger = winston.createLogger({
  // ...
  format: winston.format.combine(
    winston.format.timestamp(),
    winston.format((info) => {
      info.requestId = info.requestId || 'no-request-id';
      return info;
    })(),
    winston.format.json()
  ),
});