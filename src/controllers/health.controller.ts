// src/controllers/health.controller.ts
import { Request, Response } from 'express';
import mongoose from 'mongoose';
import { StatusCodes } from 'http-status-codes';

export const healthCheck = async (_req: Request, res: Response) => {
  const healthStatus = {
    status: 'ok',
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
    services: {
      database: mongoose.connection.readyState === 1 ? 'connected' : 'disconnected',
      redis: 'unknown', // Check Redis connection
    },
  };

  const isHealthy = healthStatus.services.database === 'connected';
  
  res.status(isHealthy ? StatusCodes.OK : StatusCodes.SERVICE_UNAVAILABLE).json(healthStatus);
};