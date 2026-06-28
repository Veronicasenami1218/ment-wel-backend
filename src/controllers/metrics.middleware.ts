// src/middleware/metrics.middleware.ts
import { Request, Response, NextFunction } from 'express';

const requestCounts = new Map<string, number>();

export const metricsMiddleware = (req: Request, res: Response, next: NextFunction) => {
  const start = Date.now();
  
  // Track request count
  const key = `${req.method}:${req.path}`;
  requestCounts.set(key, (requestCounts.get(key) || 0) + 1);
  
  // Track response time
  res.on('finish', () => {
    const duration = Date.now() - start;
    logger.info('Request completed', {
      method: req.method,
      path: req.path,
      status: res.statusCode,
      duration: `${duration}ms`,
      requestId: req.id,
    });
  });
  
  next();
};

// Endpoint to get metrics (admin only)
export const getMetrics = (_req: Request, res: Response) => {
  const metrics = {
    requests: Object.fromEntries(requestCounts),
    memory: process.memoryUsage(),
    uptime: process.uptime(),
  };
  res.json(metrics);
};