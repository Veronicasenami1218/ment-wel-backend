import { jest, beforeAll, afterAll, afterEach } from '@jest/globals';
import mongoose from 'mongoose';
import { MongoMemoryServer } from 'mongodb-memory-server';

// Allow longer time for MongoDB binary download/setup (5 minutes)
jest.setTimeout(300000);

let mongo: MongoMemoryServer | null = null;

/**
 * Helper to create MongoMemoryServer with retries to mitigate transient ETIMEDOUT/download errors.
 */
const createMongoWithRetries = async (attempts = 10, delayMs = 3000) => {
  let lastErr: any;
  for (let i = 0; i < attempts; i++) {
    try {
      // If developer/CI has a local mongod binary, set MONGOMS_SYSTEM_BINARY to its path
      // e.g. on Linux/macOS: export MONGOMS_SYSTEM_BINARY=/usr/local/bin/mongod
      // on Windows: set MONGOMS_SYSTEM_BINARY=C:\path\to\mongod.exe
      return await MongoMemoryServer.create();
    } catch (err) {
      lastErr = err;
      // Wait and retry
      const backoff = delayMs * Math.pow(2, i);
      // eslint-disable-next-line no-await-in-loop
      await new Promise((r) => setTimeout(r, backoff));
    }
  }
  throw lastErr;
};

beforeAll(async () => {
  process.env.NODE_ENV = 'test';
  process.env.CLIENT_URL = 'http://localhost:3000';
  process.env.SERVER_URL = 'http://localhost:5000';
  process.env.JWT_SECRET = 'test-secret';
  process.env.JWT_ACCESS_EXPIRATION = '15m';
  process.env.JWT_REFRESH_EXPIRATION = '7d';
  process.env.RECAPTCHA_SECRET = '';

  // Prefer using a system-installed mongod binary if available to avoid downloads:
  //   export MONGOMS_SYSTEM_BINARY=/path/to/mongod
  // or set in CI environment variables. When set, mongodb-memory-server will use the binary instead of downloading.

  // If a MONGODB_URI is already provided (globalSetup or CI), use it instead of starting a memory server.
  if (!process.env.MONGODB_URI) {
    // Create memory server with retries (handles transient network/download timeouts)
    mongo = await createMongoWithRetries();
    const uri = mongo.getUri();
    await mongoose.connect(uri);
  } else {
    // Use provided MONGODB_URI
    await mongoose.connect(process.env.MONGODB_URI);
  }
});

afterAll(async () => {
  try {
    if (mongoose.connection.readyState !== 0) {
      await mongoose.connection.dropDatabase();
      await mongoose.connection.close();
    }
  } finally {
    if (mongo) await mongo.stop();
  }
});

afterEach(async () => {
  if (mongoose.connection.readyState !== 1) return; // not connected
  const db = mongoose.connection.db;
  if (!db) return;
  const collections = await db.collections();
  await Promise.all(collections.map((c) => c.deleteMany({})));
});

// (Jest provides `beforeAll`/`afterAll` globals) - no local stubs needed

