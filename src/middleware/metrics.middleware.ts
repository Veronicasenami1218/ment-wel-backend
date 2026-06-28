import { Request, Response, NextFunction } from 'express';
import { logger } from '../utils/logger';

const requestCounts = new Map<string, number>();
const responseTimes: number[] = [];

export const metricsMiddleware = (req: Request, res: Response, next: NextFunction) => {
  const start = Date.now();
  
  // Track request count
  const key = `${req.method}:${req.path}`;
  requestCounts.set(key, (requestCounts.get(key) || 0) + 1);
  
  // Track response time
  res.on('finish', () => {
    const duration = Date.now() - start;
    responseTimes.push(duration);
    
    // Keep only last 1000 response times
    if (responseTimes.length > 1000) {
      responseTimes.shift();
    }
    
    logger.debug('Request completed', {
      method: req.method,
      path: req.path,
      status: res.statusCode,
      duration: `${duration}ms`,
      requestId: req.id,
    });
  });
  
  next();
};

export const getMetrics = () => {
  const avgResponseTime = responseTimes.length > 0
    ? responseTimes.reduce((a, b) => a + b, 0) / responseTimes.length
    : 0;
  
  return {
    requests: Object.fromEntries(requestCounts),
    responseTimes: {
      avg: Math.round(avgResponseTime),
      count: responseTimes.length,
    },
    memory: process.memoryUsage(),
    uptime: process.uptime(),
  };
};