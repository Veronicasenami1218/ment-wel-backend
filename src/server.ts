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
import { initializeDatabase } from './config/database';
import { errorHandler, notFoundHandler } from './middleware/error.middleware';
import { logger, stream } from './utils/logger';
import { ApiError } from './utils/ApiError';
import { initializeSocket } from './socket';
import { registerRoutes } from './routes';
import { NODE_ENV, PORT, LOG_FORMAT, ORIGIN, CREDENTIALS } from './config';
import swaggerUi from 'swagger-ui-express';
import { swaggerSpec } from './config/swagger';

class App {
  public app: express.Application;
  public env: string;
  public port: string | number;
  public httpServer: ReturnType<typeof createServer>;
  public io: Server;

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
    });

    this.initializeMiddlewares();
    this.initializeRoutes();
    this.initializeErrorHandling();
    initializeSocket(this.io);
  }

  public async initialize() {
    try {
      console.log('Initializing database connection...');
      await initializeDatabase();
      console.log('Database connected successfully');
      
      console.log('Initializing rate limiting...');
      await this.initializeRateLimiting();
      console.log('Rate limiting initialized');
      
      logger.info('Server initialization complete');
    } catch (error) {
      console.error('Server initialization failed:', error);
      logger.error('Failed to initialize server:', error);
      
      // In production, log error but try to continue without crashing
      if (process.env.NODE_ENV === 'production') {
        console.error('Production mode: Server will attempt to continue despite initialization errors');
        logger.error('Production mode: Server continuing with limited functionality');
      } else {
        process.exit(1);
      }
    }
  }

  private initializeMiddlewares() {
    // Trust proxy for accurate IP detection (required for Render/Heroku/etc)
    this.app.set('trust proxy', 1);
    
    // Security middleware
    this.app.use(helmet());
    
    // CORS — base origins come from config; extra origins can be added
    // via the CORS_ORIGINS env var (comma-separated) without touching code.
    const extraOrigins = (process.env.CORS_ORIGINS || '')
      .split(',')
      .map((s) => s.trim())
      .filter(Boolean);

    // Build a list of allowed origins and a runtime validator so we can return
    // the appropriate Access-Control-Allow-Origin header when credentials are used.
    const allowedOrigins = Array.from(new Set([
      'http://localhost:3000',
      'http://localhost:8000',
      'http://localhost:5000',
      ...extraOrigins,
      ...(ORIGIN as string[]),
    ].filter(Boolean)));

    const corsOptions = {
      origin: (incomingOrigin: string | undefined, callback: (err: Error | null, allow?: boolean) => void) => {
        // Allow non-browser requests (e.g. curl, server-to-server) with no origin
        if (!incomingOrigin) return callback(null, true);

        // If origin is in allowed list, permit it
        if (allowedOrigins.includes(incomingOrigin)) return callback(null, true);

        // Fallback: allow same-origin or allow when environment explicitly enables CORS_ALL
        if (process.env.CORS_ALLOW_ALL === 'true') return callback(null, true);

        // Otherwise reject
        return callback(new Error(`Origin ${incomingOrigin} not allowed by CORS`));
      },
      credentials: true,
      methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
      allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With', 'Accept'],
    };

    this.app.use((req, res, next) => {
      // Short-circuit OPTIONS to ensure preflight returns correct headers quickly
      if (req.method === 'OPTIONS') {
        return cors(corsOptions)(req, res, next);
      }
      return cors(corsOptions)(req, res, next);
    });
    this.app.use(express.json());
    this.app.use(express.urlencoded({ extended: true }));
    this.app.use(compression());
    
    // Request logging
    this.app.use(morgan(LOG_FORMAT, { stream }));

    // Root endpoint
    this.app.get('/', (_req, res) => {
      res.status(StatusCodes.OK).json({ 
        message: 'MentWel API Server', 
        version: '1.0.0',
        status: 'running',
        endpoints: {
          health: '/health',
          api: '/api/v1',
          docs: NODE_ENV !== 'production' ? '/api-docs' : 'disabled in production'
        }
      });
    });

    // Health check endpoint (must be before other routes)
    this.app.get('/health', (_req, res) => {
      res.status(StatusCodes.OK).json({ status: 'ok', timestamp: new Date().toISOString() });
    });
  }

  private async initializeRateLimiting() {
    // Disable rate limiting during development to avoid Redis-related crashes while debugging
    if (this.env === 'development' || process.env.DISABLE_RATE_LIMIT === 'true') {
      logger.warn('Rate limiting disabled (development or DISABLE_RATE_LIMIT=true)');
      return;
    }
    const defaultLimiter = rateLimit({
      windowMs: 15 * 60 * 1000, // 15 minutes
      max: 100,
      standardHeaders: true,
      legacyHeaders: false,
      message: 'Too many requests from this IP, please try again after 15 minutes',
    });

    if (process.env.REDIS_URL) {
      try {
        const redisClient = createClient({ url: process.env.REDIS_URL });
        await redisClient.connect();

        // Dynamically import RedisStore to avoid ESM/CJS import issues during build
        const RedisStoreModule = await import('rate-limit-redis');
        const RedisStoreCtor = (RedisStoreModule as any).default || RedisStoreModule;

        const limiter = rateLimit({
          windowMs: 15 * 60 * 1000,
          max: 100,
          standardHeaders: true,
          legacyHeaders: false,
          store: new (RedisStoreCtor as any)({
            sendCommand: (...args: string[]) => redisClient.sendCommand(args),
          }),
          message: 'Too many requests from this IP, please try again after 15 minutes',
        });

        this.app.use(limiter);
        return;
      } catch (err) {
        logger.warn('Redis rate limiting unavailable, falling back to in-memory limiter', {
          error: (err as Error).message,
        });
      }
    }

    // Fallback to in-memory limiter
    this.app.use(defaultLimiter);
  }

  private initializeRoutes() {
    // Register API routes
    registerRoutes(this.app);

    // Swagger docs (OpenAPI) - enable only in non-production
    if (this.env !== 'production') {
      this.app.use('/api-docs', swaggerUi.serve, swaggerUi.setup(swaggerSpec, { explorer: true }));
      this.app.get('/api-docs.json', (_req: Request, res: Response) => {
        res.json(swaggerSpec);
      });
    }

    // 404 handler for non-existent routes (must be after routes)
    this.app.use(notFoundHandler);
  }

  private initializeErrorHandling() {
    this.app.use(errorHandler);
  }

  public listen() {
    // Bind to 0.0.0.0 so hosting platforms (Render, Heroku) can reach the service
    const host = '0.0.0.0';
    this.httpServer.listen({ port: this.port, host }, () => {
      logger.info(`=================================`);
      logger.info(`======= ENV: ${this.env} =======`);
      logger.info(`🚀 App listening on ${host}:${this.port}`);
      logger.info(`=================================`);
    });
  }
}

console.log('Starting MentWel Backend...');
console.log('NODE_ENV:', process.env.NODE_ENV);
console.log('PORT:', process.env.PORT || 5000);
console.log('MONGODB_URI set:', !!process.env.MONGODB_URI);
console.log('MONGODB_URI is Atlas:', (process.env.MONGODB_URI || '').includes('mongodb.net'));
console.log('JWT_SECRET set:', !!process.env.JWT_SECRET);

const app = new App();
app.initialize().then(() => {
  console.log('App initialization successful, starting server...');
  app.listen();
}).catch((error) => {
  console.error('Failed to initialize app:', error);
  process.exit(1);
});

// Handle unhandled promise rejections
process.on('unhandledRejection', (reason: Error) => {
  logger.error(`Unhandled Rejection: ${reason.message}`);
  logger.error(reason.stack);
  process.exit(1);
});

// Handle uncaught exceptions
process.on('uncaughtException', (error: Error) => {
  logger.error(`Uncaught Exception: ${error.message}`);
  logger.error(error.stack);
  process.exit(1);
});

// Handle SIGTERM
process.on('SIGTERM', () => {
  logger.info('SIGTERM received. Shutting down gracefully');
  process.exit(0);
});

export { app };
