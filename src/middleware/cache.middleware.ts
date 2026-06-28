// src/middleware/cache.middleware.ts
import { Request, Response, NextFunction } from 'express';
import { CacheService } from '../services/cache.service';

const cacheService = new CacheService();

export const cache = (durationSeconds: number = 300) => {
  return async (req: Request, res: Response, next: NextFunction) => {
    // Only cache GET requests
    if (req.method !== 'GET') {
      return next();
    }

    const key = `cache:${req.originalUrl || req.url}`;
    
    try {
      const cachedResponse = await cacheService.get(key);
      
      if (cachedResponse) {
        return res.json(cachedResponse);
      }
      
      // Store original send function
      const originalSend = res.json;
      
      // Override json method to cache response
      res.json = function(body) {
        // Cache successful responses
        if (res.statusCode === 200) {
          cacheService.set(key, body, durationSeconds);
        }
        return originalSend.call(this, body);
      };
      
      next();
    } catch (error) {
      // If cache fails, continue without caching
      next();
    }
  };
};