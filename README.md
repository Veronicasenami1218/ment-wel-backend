# MentWel Backend (Node.js + TypeScript)

Secure, versioned REST API for the MentWel Digital Mental Health Platform with a strict Anonymity Layer, and real-time capabilities.

## 🚀 Live Deployment

**Production API:** 

- **Health Check:** 
- **API Base URL:** 
- **API Documentation:** Available in development mode only

## Features
- **REST API** with `/api/v1` versioning
- **Security**: JWT auth, RBAC, CORS, Helmet, rate limiting (Redis or in-memory fallback)
- **User Registration**: Email/phone registration with gender and country selection
- **Email Verification**: Optional email verification with fallback support
- **Anonymity Layer**: PII separation and masking for therapist-facing contexts
- **MongoDB Atlas**: Cloud database with proper connection handling
- **Redis** (optional), **Socket.io** for real-time capabilities
- **Swagger/OpenAPI** docs (development only)
- **Production Deployment**: Live on Render with environment-based configuration
- **Testing** with Jest + Supertest

## Getting Started
1. Install dependencies
   ```bash
   npm install
   ```
2. Configure environment
   - Copy `.env.example` to `.env` and update values.
   - Use a strong `JWT_SECRET`.
3. Run in development
   ```bash
   npm run dev
   ```
4. Build and run
   ```bash
   npm run build
   npm start
   ```
5. Test with coverage
   ```bash
   npm run test
   ```

## Environment Variables
See `.env.example`. Important keys:
- `NODE_ENV`, `PORT`
- `LOG_LEVEL`, `LOG_FORMAT`, `CREDENTIALS`
- `CLIENT_URL`, `SERVER_URL`
- `MONGODB_URI`
- `REDIS_URL` (optional)
- `JWT_SECRET`, `JWT_ACCESS_EXPIRATION`, `JWT_REFRESH_EXPIRATION`

## API Endpoints

### Production URLs
- **Health check:** 
- **API base:** 

### Authentication Endpoints
- **Register:** `POST /api/v1/auth/register`
- **Login:** `POST /api/v1/auth/login`
- **Refresh Token:** `POST /api/v1/auth/refresh-token`
- **Logout:** `POST /api/v1/auth/logout`
- **Forgot Password:** `POST /api/v1/auth/forgot-password`
- **Reset Password:** `POST /api/v1/auth/reset-password`
- **Verify Email:** `GET /api/v1/auth/verify-email/:token`
- **Resend Verification:** `POST /api/v1/auth/resend-verification`

### Development Only
- **Swagger UI:** `GET /api-docs` (localhost only)
- **Swagger JSON:** `GET /api-docs.json` (localhost only)

## Project Structure
```
backend/
  src/
    config/         # env, database, swagger
    controllers/    # controllers (thin)
    middleware/     # auth, error, validation
    models/         # mongoose schemas
    routes/         # feature routes mounted at /api/v1
    socket/         # socket.io init
    utils/          # logger, ApiError
    server.ts       # app bootstrap
  tests/            # jest tests
  README.md
  .env.example
  .gitignore
```

## Scripts
- `npm run dev` – Start dev server (ts-node-dev)
- `npm run build` – Compile TypeScript to `dist/`
- `npm start` – Run compiled server
- `npm run test` – Jest with coverage
- `npm run lint` / `npm run format` – Lint and format

## Security & Compliance
- **JWT** with proper expirations and refresh flow.
- **RBAC** for Users/Therapists/Admins.
- **Helmet, CORS, Rate limiting** enabled; Redis store used when available.
- **Centralized error handling**; no internal details exposed.
- **Anonymity Layer**: service-layer masking for therapist views; PII separated from session data.
- **No secrets in VCS**: `.env` is ignored; maintain `.env.example` only.

## Contributing
- Ensure tests pass (target ≥80% coverage).
- Follow the code organization (Controller → Service → Repository).
- Keep controllers thin; put business logic in services.

## Deployment

### Production Environment (Render)
- **URL:** 
- **Database:** MongoDB Atlas
- **Environment:** Production mode with optimized settings
- **Email Verification:** Configurable via `REQUIRE_EMAIL_VERIFICATION` environment variable

### Environment Variables for Production
Required environment variables for Render deployment:
```bash
NODE_ENV=production
MONGODB_URI=mongodb+srv://username:password@cluster.mongodb.net/database
JWT_SECRET=your-secure-jwt-secret
CLIENT_URL=https://your-frontend-domain.com
SERVER_URL=
REQUIRE_EMAIL_VERIFICATION=false
```

## Troubleshooting
- **Redis not available:** App falls back to in-memory rate limiter
- **MongoDB connection:** Ensure Atlas connection string is properly formatted
- **Email verification:** Set `REQUIRE_EMAIL_VERIFICATION=false` to allow login without verification
- **Swagger docs:** Disabled in production for security (`NODE_ENV=production`)
- **Deployment issues:** Check Render logs for specific error messages

---
MentWel © 2025 – All rights reserved.
