# MentWel Backend

Secure REST API for the MentWel Digital Mental Health Platform built with Node.js, Express, and TypeScript.

## Getting Started

```bash
# Install dependencies
npm install

# Copy and configure environment variables
cp .env.example .env

# Run in development (hot reload)
npm run dev

# Build and run in production
npm run build
npm start

# Run tests
npm test
```

## Environment Variables

See `.env.example` for all required variables. Key ones:

| Variable | Description |
|---|---|
| `NODE_ENV` | `development` or `production` |
| `PORT` | Server port (default: 5000) |
| `MONGODB_URI` | MongoDB connection string |
| `JWT_SECRET` | Secret key for signing JWTs |
| `CLIENT_URL` | Frontend URL (for CORS and redirects) |
| `SERVER_URL` | This server's public URL |
| `CLOUDINARY_CLOUD_NAME` | Cloudinary cloud name |
| `CLOUDINARY_API_KEY` | Cloudinary API key |
| `CLOUDINARY_API_SECRET` | Cloudinary API secret |
| `REQUIRE_EMAIL_VERIFICATION` | Set to `false` to skip email verification (development) |

## API Endpoints

### Base URL
```
http://localhost:5000/api/v1
```

### Authentication
| Method | Endpoint | Description |
|---|---|---|
| POST | `/auth/register` | Register new user |
| POST | `/auth/login` | Login |
| POST | `/auth/logout` | Logout |
| POST | `/auth/refresh-token` | Refresh JWT |
| POST | `/auth/forgot-password` | Request password reset |
| POST | `/auth/reset-password` | Reset password |
| GET | `/auth/verify-email/:token` | Verify email |
| POST | `/auth/resend-verification` | Resend verification email |

### Users (requires authentication)
| Method | Endpoint | Description |
|---|---|---|
| GET | `/users/me` | Get current user profile |
| PUT | `/users/profile` | Update profile |
| POST | `/users/profile-picture` | Upload profile picture (Cloudinary) |
| POST | `/users/change-password` | Change password |

### Other
- `GET /health` — Health check
- `GET /api-docs` — Swagger UI (development only)

## Deployment on Render

1. Connect your GitHub repo to Render
2. Set build command: `npm install && npm run build`
3. Set start command: `npm start`
4. Add all environment variables from `.env.example`
5. Set `NODE_ENV=production`
6. Set `CLIENT_URL` to your frontend URL
7. Set `SERVER_URL` to your Render service URL

## Project Structure

```
backend/
  src/
    config/         # env, database, swagger
    controllers/    # request handlers
    middleware/     # auth, error, validation, upload
    models/         # mongoose schemas
    routes/         # API routes
    services/       # email service
    socket/         # Socket.io
    utils/          # logger, ApiError
    server.ts       # app entry point
  tests/            # Jest tests
  .env.example
```

## Scripts

| Script | Description |
|---|---|
| `npm run dev` | Development server with hot reload |
| `npm run build` | Compile TypeScript |
| `npm start` | Run compiled server |
| `npm test` | Run tests with coverage |
| `npm run lint` | ESLint |
| `npm run format` | Prettier |

---

MentWel © 2026
