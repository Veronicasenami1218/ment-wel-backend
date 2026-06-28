import dotenv from 'dotenv';
import path from 'path';

// Load .env from project root as the very first thing
dotenv.config({ path: path.join(process.cwd(), '.env') });

import express, { Request, Response, NextFunction } from 'express';
import cors from 'cors';
import helmet from 'helmet';
import compression from 'compression';
import morgan from 'morgan';
import { createServer } from 'http';
import { Server } from 'socket.io';
import { StatusCodes } from 'http-status-codes';
import rateLimit from 'express-rate-limit';
import { createClient } from 'redis';
import mongoose from 'mongoose';
import { initializeDatabase } from './config/database';
import { errorHandler, notFoundHandler } from './middleware/error.middleware';
import { logger, stream } from './utils/logger';
import { ApiError } from './utils/ApiError';
import { initializeSocket } from './socket';
import { registerRoutes } from './routes';
import { NODE_ENV, PORT, LOG_FORMAT, ORIGIN, CREDENTIALS } from './config';
import swaggerUi from 'swagger-ui-express';
import { swaggerSpec } from './config/swagger';
import { requestIdMiddleware } from './middleware/request-id.middleware';
import { metricsMiddleware } from './middleware/metrics.middleware';

// Validate critical environment variables
if (NODE_ENV === 'production') {
  const requiredEnvVars = ['MONGODB_URI', 'JWT_SECRET', 'CLIENT_URL', 'SERVER_URL'];
  const missingVars = requiredEnvVars.filter(varName => !process.env[varName]);
  
  if (missingVars.length > 0) {
    console.error('FATAL: Missing required environment variables:', missingVars.join(', '));
    console.error('Please set these variables in your .env file or deployment environment.');
    process.exit(1);
  }
}

class App {
  public app: express.Application;
  public env: string;
  public port: string | number;
  public httpServer: ReturnType<typeof createServer>;
  public io: Server;
  private redisClient: any;
  private isShuttingDown: boolean = false;

  constructor() {
    this.app = express();
    this.env = NODE_ENV || 'development';
    this.port = PORT;
    this.httpServer = createServer(this.app);
    this.io = new Server(this.httpServer, {
      cors: {
        origin: ORIGIN,
        credentials: CREDENTIALS,
      },
      pingTimeout: 60000,
      pingInterval: 25000,
    });

    this.initializeMiddlewares();
    this.initializeRoutes();
    this.initializeErrorHandling();
    initializeSocket(this.io);
  }

  public async initialize() {
    try {
      logger.info('Initializing server...');
      
      // Initialize database
      logger.info('Connecting to database...');
      await initializeDatabase();
      logger.info('Database connected successfully');
      
      // Initialize rate limiting
      logger.info('Initializing rate limiting...');
      await this.initializeRateLimiting();
      logger.info('Rate limiting initialized');
      
      logger.info('Server initialization complete');
    } catch (error) {
      logger.error('Server initialization failed:', error);
      
      // In production, log error but try to continue
      if (process.env.NODE_ENV === 'production') {
        logger.error('Production mode: Server will continue with limited functionality');
        // Don't exit in production - let the server try to run
      } else {
        process.exit(1);
      }
    }
  }

  private initializeMiddlewares() {
    // Trust proxy for accurate IP detection
    this.app.set('trust proxy', 1);
    
    // Request ID middleware - must be first
    this.app.use(requestIdMiddleware);
    
    // Metrics middleware
    this.app.use(metricsMiddleware);
    
    // Security middleware with custom config
    this.app.use(helmet({
      contentSecurityPolicy: {
        directives: {
          defaultSrc: ["'self'"],
          scriptSrc: ["'self'"],
          styleSrc: ["'self'"],
          imgSrc: ["'self'", 'data:', 'https://res.cloudinary.com'],
          connectSrc: ["'self'"],
          fontSrc: ["'self'"],
          objectSrc: ["'none'"],
          mediaSrc: ["'self'"],
          frameSrc: ["'none'"],
        },
      },
      hsts: {
        maxAge: 31536000,
        includeSubDomains: true,
        preload: true,
      },
      noSniff: true,
      xssFilter: true,
    }));
    
    // CORS configuration
    const extraOrigins = (process.env.CORS_ORIGINS || '')
      .split(',')
      .map((s) => s.trim())
      .filter(Boolean);

    const allowedOrigins = Array.from(new Set([
      'http://localhost:3000',
      'http://localhost:8000',
      'http://localhost:5000',
      'https://ment-wel.vercel.app',
      'https://mentwel.com',
      ...extraOrigins,
      ...(Array.isArray(ORIGIN) ? ORIGIN : typeof ORIGIN === 'string' ? [ORIGIN] : []),
    ].filter(Boolean)));

    const corsOptions = {
      origin: (incomingOrigin: string | undefined, callback: (err: Error | null, allow?: boolean) => void) => {
        if (!incomingOrigin) return callback(null, true);
        
        // Allow if origin is in allowed list or if CORS_ALLOW_ALL is true
        if (allowedOrigins.includes(incomingOrigin) || process.env.CORS_ALLOW_ALL === 'true') {
          return callback(null, true);
        }
        
        // In development, allow any localhost
        if (NODE_ENV !== 'production' && incomingOrigin.match(/^http:\/\/localhost:\d+$/)) {
          return callback(null, true);
        }
        
        return callback(new Error(`Origin ${incomingOrigin} not allowed by CORS`));
      },
      credentials: true,
      methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
      allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With', 'Accept', 'X-Request-ID'],
      exposedHeaders: ['X-Request-ID'],
      maxAge: 86400, // 24 hours
    };

    this.app.use(cors(corsOptions));
    
    // Handle preflight requests
    this.app.options('*', cors(corsOptions));
    
    // Body parsing
    this.app.use(express.json({ limit: '10mb' }));
    this.app.use(express.urlencoded({ extended: true, limit: '10mb' }));
    
    // Compression with optimized settings
    this.app.use(compression({
      level: 6,
      threshold: 1024,
      filter: (req, res) => {
        if (req.headers['upgrade'] === 'websocket') return false;
        return compression.filter(req, res);
      },
    }));
    
    // Request logging
    this.app.use(morgan(LOG_FORMAT, { stream }));

    // Root endpoint
    this.app.get('/', (_req, res) => {
      res.status(StatusCodes.OK).json({
        message: 'MentWel API Server',
        version: '1.0.0',
        status: 'running',
        environment: NODE_ENV,
        endpoints: {
          health: '/health',
          api: '/api/v1',
          docs: NODE_ENV !== 'production' ? '/api-docs' : 'disabled in production',
        },
        timestamp: new Date().toISOString(),
      });
    });

    // Health check endpoint
    this.app.get('/health', async (_req, res) => {
      const healthStatus = {
        status: 'ok',
        timestamp: new Date().toISOString(),
        uptime: process.uptime(),
        services: {
          database: mongoose.connection.readyState === 1 ? 'connected' : 'disconnected',
          redis: this.redisClient ? 'connected' : 'disabled',
        },
        memory: {
          used: Math.round(process.memoryUsage().heapUsed / 1024 / 1024),
          total: Math.round(process.memoryUsage().heapTotal / 1024 / 1024),
        },
      };

      const isHealthy = healthStatus.services.database === 'connected';
      res.status(isHealthy ? StatusCodes.OK : StatusCodes.SERVICE_UNAVAILABLE).json(healthStatus);
    });
  }

  private async initializeRateLimiting() {
    // Always apply rate limiting in production, optional in development
    if (this.env === 'development' && process.env.DISABLE_RATE_LIMIT === 'true') {
      logger.warn('Rate limiting disabled (development mode)');
      return;
    }

    const defaultLimiter = rateLimit({
      windowMs: 15 * 60 * 1000,
      max: 100,
      standardHeaders: true,
      legacyHeaders: false,
      skip: (req) => {
        // Skip rate limiting for health checks
        return req.path === '/health';
      },
      handler: (req, res) => {
        logger.warn('Rate limit exceeded', { 
          ip: req.ip, 
          path: req.path,
          requestId: req.id,
        });
        res.status(StatusCodes.TOO_MANY_REQUESTS).json({
          success: false,
          message: 'Too many requests from this IP, please try again after 15 minutes',
        });
      },
    });

    // Try Redis-based rate limiting
    if (process.env.REDIS_URL) {
      try {
        this.redisClient = createClient({ 
          url: process.env.REDIS_URL,
          socket: {
            reconnectStrategy: (retries) => Math.min(retries * 100, 3000),
          },
        });
        
        await this.redisClient.connect();
        logger.info('Redis connected for rate limiting');

        const RedisStoreModule = await import('rate-limit-redis');
        const RedisStoreCtor = (RedisStoreModule as any).default || RedisStoreModule;

        const limiter = rateLimit({
          windowMs: 15 * 60 * 1000,
          max: 100,
          standardHeaders: true,
          legacyHeaders: false,
          store: new (RedisStoreCtor as any)({
            sendCommand: (...args: string[]) => this.redisClient.sendCommand(args),
          }),
          skip: (req) => req.path === '/health',
        });

        this.app.use(limiter);
        return;
      } catch (err) {
        logger.warn('Redis rate limiting unavailable, falling back to in-memory', {
          error: (err as Error).message,
        });
        if (this.redisClient) {
          await this.redisClient.quit().catch(() => {});
          this.redisClient = null;
        }
      }
    }

    // Fallback to in-memory limiter
    this.app.use(defaultLimiter);
  }

  private initializeRoutes() {
    // Register API routes
    registerRoutes(this.app);

    // Swagger docs - only in development
    if (this.env !== 'production') {
      this.app.use('/api-docs', swaggerUi.serve, swaggerUi.setup(swaggerSpec, { explorer: true }));
      this.app.get('/api-docs.json', (_req: Request, res: Response) => {
        res.json(swaggerSpec);
      });
      logger.info('Swagger docs available at /api-docs');
    }

    // 404 handler
    this.app.use(notFoundHandler);
  }

  private initializeErrorHandling() {
    this.app.use(errorHandler);
  }

  public listen() {
    const host = '0.0.0.0';
    this.httpServer.listen({ port: this.port, host }, () => {
      logger.info('=================================');
      logger.info(`======= ENV: ${this.env} =======`);
      logger.info(`🚀 App listening on ${host}:${this.port}`);
      logger.info(`📚 API Docs: ${this.env !== 'production' ? `http://${host}:${this.port}/api-docs` : 'disabled'}`);
      logger.info('=================================');
    });
  }

  public async shutdown(signal: string): Promise<void> {
    if (this.isShuttingDown) return;
    this.isShuttingDown = true;

    logger.info(`Received ${signal}. Starting graceful shutdown...`);

    try {
      // Stop accepting new connections
      this.httpServer.close(() => {
        logger.info('HTTP server closed');
      });

      // Close Socket.io connections
      await this.io.close();
      logger.info('Socket.io server closed');

      // Close database connection
      await mongoose.connection.close();
      logger.info('Database connection closed');

      // Close Redis connection
      if (this.redisClient) {
        await this.redisClient.quit();
        logger.info('Redis connection closed');
      }

      logger.info('Graceful shutdown complete');
      process.exit(0);
    } catch (error) {
      logger.error('Error during shutdown:', error);
      process.exit(1);
    }
  }
}

// Create app instance
console.log('Starting MentWel Backend...');
console.log(`NODE_ENV: ${process.env.NODE_ENV}`);
console.log(`PORT: ${process.env.PORT || 5000}`);
console.log(`MONGODB_URI set: ${!!process.env.MONGODB_URI}`);
console.log(`MONGODB_URI is Atlas: ${(process.env.MONGODB_URI || '').includes('mongodb.net')}`);
console.log(`JWT_SECRET set: ${!!process.env.JWT_SECRET}`);

const app = new App();

// Start the application
app.initialize()
  .then(() => {
    console.log('App initialization successful, starting server...');
    app.listen();
  })
  .catch((error) => {
    console.error('Failed to initialize app:', error);
    process.exit(1);
  });

// Graceful shutdown handlers
const shutdownHandler = (signal: string) => {
  app.shutdown(signal);
};

process.on('SIGTERM', () => shutdownHandler('SIGTERM'));
process.on('SIGINT', () => shutdownHandler('SIGINT'));

// Handle unhandled rejections
process.on('unhandledRejection', (reason: Error) => {
  logger.error(`Unhandled Rejection: ${reason.message}`);
  logger.error(reason.stack);
  // Don't exit in production - let the error be handled gracefully
  if (process.env.NODE_ENV !== 'production') {
    process.exit(1);
  }
});

// Handle uncaught exceptions
process.on('uncaughtException', (error: Error) => {
  logger.error(`Uncaught Exception: ${error.message}`);
  logger.error(error.stack);
  // Don't exit in production - let the error be handled gracefully
  if (process.env.NODE_ENV !== 'production') {
    process.exit(1);
  }
});

export { app };