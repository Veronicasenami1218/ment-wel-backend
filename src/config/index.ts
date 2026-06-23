export const NODE_ENV = process.env.NODE_ENV || 'development';
export const PORT = process.env.PORT ? parseInt(process.env.PORT, 10) : 5000;
export const LOG_LEVEL = process.env.LOG_LEVEL || 'info';
export const LOG_FORMAT = process.env.LOG_FORMAT || 'dev';

// MONGODB_URI must be set — no localhost fallback allowed
if (!process.env.MONGODB_URI) {
  if (NODE_ENV === 'test') {
    // During tests use a local test database (developer should ensure test DB or mongodb-memory-server is available)
    process.env.MONGODB_URI = process.env.MONGODB_URI || 'mongodb://127.0.0.1:27017/mentwel-test';
    console.warn('MONGODB_URI not set; using fallback test DB for NODE_ENV=test');
  } else {
    console.error('FATAL: MONGODB_URI environment variable is not set.');
    console.error('Set it in your .env file (Atlas connection string) or in your deployment environment variables.');
    process.exit(1);
  }
}
export const MONGODB_URI = process.env.MONGODB_URI as string;

export const JWT_SECRET = process.env.JWT_SECRET || 'your-secret-key';
export const JWT_ACCESS_EXPIRATION = process.env.JWT_ACCESS_EXPIRATION || '15m';
export const JWT_REFRESH_EXPIRATION = process.env.JWT_REFRESH_EXPIRATION || '7d';

export const CLIENT_URL = process.env.CLIENT_URL || 'http://localhost:3000';
export const SERVER_URL = process.env.SERVER_URL || `http://localhost:${PORT}`;
export const API_BASE_URL = process.env.API_BASE_URL || `http://localhost:${PORT}/api/v1`;

export const REDIS_URL = process.env.REDIS_URL || '';
export const RECAPTCHA_SECRET = process.env.RECAPTCHA_SECRET || '';

export const ORIGIN = NODE_ENV === 'production'
  ? [CLIENT_URL, SERVER_URL]
  : ['http://localhost:3000', 'http://localhost:8000', `http://localhost:${PORT}`];

export const CREDENTIALS = process.env.CREDENTIALS === 'true';

export const RATE_LIMIT_WINDOW_MS = 15 * 60 * 1000; // 15 minutes
export const RATE_LIMIT_MAX = 100; // limit each IP to 100 requests per windowMs

// Export all environment variables for type safety
export const config = {
  nodeEnv: NODE_ENV,
  port: PORT,
  logLevel: LOG_LEVEL,
  logFormat: LOG_FORMAT,
  mongoose: {
    url: MONGODB_URI,
    options: {
      useNewUrlParser: true,
      useUnifiedTopology: true,
      autoIndex: NODE_ENV === 'development',
    },
  },
  jwt: {
    secret: JWT_SECRET,
    accessExpiration: JWT_ACCESS_EXPIRATION,
    refreshExpiration: JWT_REFRESH_EXPIRATION,
  },
  clientUrl: CLIENT_URL,
  serverUrl: SERVER_URL,
  apiBaseUrl: API_BASE_URL,
  redis: {
    url: REDIS_URL,
  },
  recaptcha: {
    secret: RECAPTCHA_SECRET,
  },
  cors: {
    origin: ORIGIN,
    credentials: CREDENTIALS,
  },
  rateLimit: {
    windowMs: RATE_LIMIT_WINDOW_MS,
    max: RATE_LIMIT_MAX,
  },
} as const;
