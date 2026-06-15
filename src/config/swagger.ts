import swaggerJSDoc from 'swagger-jsdoc';
import { SERVER_URL } from './index';

const swaggerDefinition = {
  openapi: '3.0.3',
  info: {
    title: 'MentWel API',
    description: `
# MentWel Digital Mental Health Platform API

A secure REST API for the MentWel mental health platform.

## Features
- **Authentication** — Registration, login, password reset, email verification, JWT refresh
- **Users** — Profile management and profile picture uploads (Cloudinary)
- **Therapy Sessions** — Booking and management
- **Therapists** — Directory and search
- **Messaging** — Real-time messaging
- **Admin** — Dashboard and user management

## Security
- JWT bearer token authentication with refresh tokens
- Rate limiting (5 registration attempts/hour, 100 req/15 min default)
- Nigerian phone number validation (+234XXXXXXXXX)
- Password complexity requirements
- CORS and Helmet security headers
    `,
    version: '1.0.0',
    contact: { name: 'MentWel Team' },
    license: { name: 'ISC' },
  },
  servers: [
    {
      url: SERVER_URL || 'http://localhost:5000',
      description: 'Current server',
    },
    {
      url: 'http://localhost:5000',
      description: 'Local development',
    },
  ],
  tags: [
    { name: 'Health', description: 'Health check' },
    { name: 'Auth', description: 'Authentication and token management' },
    { name: 'Users', description: 'User profile operations' },
    { name: 'Therapists', description: 'Therapist directory' },
    { name: 'Sessions', description: 'Therapy session management' },
    { name: 'Messages', description: 'Messaging' },
    { name: 'Appointments', description: 'Appointment scheduling' },
    { name: 'Notifications', description: 'Notifications' },
    { name: 'Admin', description: 'Administrative operations' },
  ],
  components: {
    securitySchemes: {
      BearerAuth: {
        type: 'http',
        scheme: 'bearer',
        bearerFormat: 'JWT',
        description: 'JWT Authorization header. Example: "Authorization: Bearer {token}"',
      },
    },
    schemas: {
      ApiResponse: {
        type: 'object',
        properties: {
          success: { type: 'boolean' },
          message: { type: 'string' },
          data: { type: 'object' },
        },
      },
      ErrorResponse: {
        type: 'object',
        properties: {
          success: { type: 'boolean', example: false },
          message: { type: 'string', example: 'Error message' },
          errors: { type: 'array', items: { type: 'object' } },
        },
      },
      LoginRequest: {
        type: 'object',
        required: ['email', 'password'],
        properties: {
          email: { type: 'string', format: 'email', example: 'user@example.com' },
          password: { type: 'string', minLength: 8, example: 'SecurePass123!' },
        },
      },
      RegisterRequest: {
        type: 'object',
        required: ['password', 'confirmPassword', 'firstName', 'lastName', 'dateOfBirth', 'gender', 'acceptTerms'],
        properties: {
          email: {
            type: 'string',
            format: 'email',
            example: 'user@example.com',
            description: 'Provide either email OR phoneNumber',
          },
          phoneNumber: {
            type: 'string',
            example: '+2348012345678',
            description: 'Nigerian phone number (+234XXXXXXXXX). Provide either email OR phoneNumber',
          },
          password: {
            type: 'string',
            minLength: 8,
            example: 'SecurePass123!',
            description: 'Min 8 chars with uppercase, lowercase, number, special character',
          },
          confirmPassword: { type: 'string', example: 'SecurePass123!' },
          firstName: { type: 'string', example: 'John' },
          lastName: { type: 'string', example: 'Doe' },
          dateOfBirth: { type: 'string', format: 'date', example: '1990-01-01' },
          gender: { type: 'string', enum: ['male', 'female', 'other', 'prefer_not_to_say'], example: 'male' },
          country: {
            type: 'string',
            enum: ['Nigeria', 'Ghana', 'Kenya', 'South Africa', 'Other'],
            default: 'Nigeria',
          },
          role: { type: 'string', enum: ['user', 'therapist'], default: 'user' },
          acceptTerms: { type: 'boolean', example: true },
        },
        additionalProperties: false,
      },
      RefreshRequest: {
        type: 'object',
        required: ['refreshToken'],
        properties: { refreshToken: { type: 'string' } },
      },
      LogoutRequest: {
        type: 'object',
        required: ['refreshToken'],
        properties: { refreshToken: { type: 'string' } },
      },
      ForgotPasswordRequest: {
        type: 'object',
        required: ['email'],
        properties: { email: { type: 'string', format: 'email' } },
      },
      ResetPasswordRequest: {
        type: 'object',
        required: ['token', 'password'],
        properties: {
          token: { type: 'string' },
          password: { type: 'string', minLength: 8 },
        },
      },
      ResendVerificationRequest: {
        type: 'object',
        required: ['email'],
        properties: { email: { type: 'string', format: 'email' } },
      },
      User: {
        type: 'object',
        properties: {
          _id: { type: 'string', example: '507f1f77bcf86cd799439011' },
          email: { type: 'string', format: 'email', example: 'user@example.com' },
          firstName: { type: 'string', example: 'John' },
          lastName: { type: 'string', example: 'Doe' },
          role: { type: 'string', enum: ['user', 'therapist', 'admin'] },
          phoneNumber: { type: 'string', example: '+2348012345678' },
          isEmailVerified: { type: 'boolean' },
          status: { type: 'string', enum: ['active', 'inactive', 'suspended', 'pending_verification'] },
          dateOfBirth: { type: 'string', format: 'date' },
          gender: { type: 'string', enum: ['male', 'female', 'other', 'prefer_not_to_say'] },
          country: { type: 'string', enum: ['Nigeria', 'Ghana', 'Kenya', 'South Africa', 'Other'] },
          profilePicture: { type: 'string', description: 'Cloudinary URL' },
          createdAt: { type: 'string', format: 'date-time' },
          updatedAt: { type: 'string', format: 'date-time' },
        },
      },
      AuthTokens: {
        type: 'object',
        properties: {
          access: {
            type: 'object',
            properties: {
              token: { type: 'string', example: 'eyJhbGciOi...' },
              expiresIn: { type: 'string', example: '15m' },
            },
          },
          refresh: {
            type: 'object',
            properties: {
              token: { type: 'string', example: 'eyJhbGciOi...' },
              expiresIn: { type: 'string', example: '7d' },
            },
          },
        },
      },
      AuthResponse: {
        type: 'object',
        properties: {
          success: { type: 'boolean', example: true },
          data: {
            type: 'object',
            properties: {
              user: { $ref: '#/components/schemas/User' },
              tokens: { $ref: '#/components/schemas/AuthTokens' },
            },
          },
        },
      },
      UpdateProfileRequest: {
        type: 'object',
        properties: {
          firstName: { type: 'string' },
          lastName: { type: 'string' },
          phoneNumber: { type: 'string' },
          country: { type: 'string' },
        },
      },
      ChangePasswordRequest: {
        type: 'object',
        required: ['currentPassword', 'newPassword'],
        properties: {
          currentPassword: { type: 'string' },
          newPassword: { type: 'string', minLength: 8 },
        },
      },
    },
  },
  paths: {
    '/health': {
      get: {
        tags: ['Health'],
        summary: 'System health check',
        responses: {
          200: {
            description: 'Server is healthy',
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  properties: {
                    status: { type: 'string', example: 'ok' },
                    timestamp: { type: 'string', format: 'date-time' },
                  },
                },
              },
            },
          },
        },
      },
    },
    '/api/v1/auth/register': {
      post: {
        tags: ['Auth'],
        summary: 'Register a new user',
        requestBody: {
          required: true,
          content: { 'application/json': { schema: { $ref: '#/components/schemas/RegisterRequest' } } },
        },
        responses: {
          201: { description: 'Registration successful', content: { 'application/json': { schema: { $ref: '#/components/schemas/AuthResponse' } } } },
          400: { description: 'Validation error', content: { 'application/json': { schema: { $ref: '#/components/schemas/ErrorResponse' } } } },
          409: { description: 'Account already exists' },
          429: { description: 'Rate limit exceeded' },
        },
      },
    },
    '/api/v1/auth/login': {
      post: {
        tags: ['Auth'],
        summary: 'Login user',
        requestBody: {
          required: true,
          content: { 'application/json': { schema: { $ref: '#/components/schemas/LoginRequest' } } },
        },
        responses: {
          200: { description: 'Login successful', content: { 'application/json': { schema: { $ref: '#/components/schemas/AuthResponse' } } } },
          401: { description: 'Invalid credentials' },
          403: { description: 'Email verification required' },
          429: { description: 'Too many attempts' },
        },
      },
    },
    '/api/v1/auth/refresh-token': {
      post: {
        tags: ['Auth'],
        summary: 'Refresh access token',
        requestBody: { required: true, content: { 'application/json': { schema: { $ref: '#/components/schemas/RefreshRequest' } } } },
        responses: { 200: { description: 'New access token issued' }, 401: { description: 'Invalid refresh token' } },
      },
    },
    '/api/v1/auth/logout': {
      post: {
        tags: ['Auth'],
        summary: 'Logout user',
        requestBody: { required: true, content: { 'application/json': { schema: { $ref: '#/components/schemas/LogoutRequest' } } } },
        responses: { 200: { description: 'Logged out successfully' } },
      },
    },
    '/api/v1/auth/forgot-password': {
      post: {
        tags: ['Auth'],
        summary: 'Request password reset email',
        requestBody: { required: true, content: { 'application/json': { schema: { $ref: '#/components/schemas/ForgotPasswordRequest' } } } },
        responses: { 200: { description: 'Reset email sent if account exists' } },
      },
    },
    '/api/v1/auth/reset-password': {
      post: {
        tags: ['Auth'],
        summary: 'Reset password with token',
        requestBody: { required: true, content: { 'application/json': { schema: { $ref: '#/components/schemas/ResetPasswordRequest' } } } },
        responses: { 200: { description: 'Password reset successful' }, 400: { description: 'Invalid or expired token' } },
      },
    },
    '/api/v1/auth/verify-email/{token}': {
      get: {
        tags: ['Auth'],
        summary: 'Verify email address',
        parameters: [{ name: 'token', in: 'path', required: true, schema: { type: 'string' } }],
        responses: { 302: { description: 'Redirect to frontend' }, 400: { description: 'Invalid token' } },
      },
    },
    '/api/v1/auth/resend-verification': {
      post: {
        tags: ['Auth'],
        summary: 'Resend verification email',
        requestBody: { required: true, content: { 'application/json': { schema: { $ref: '#/components/schemas/ResendVerificationRequest' } } } },
        responses: { 200: { description: 'Email sent' }, 400: { description: 'Already verified' } },
      },
    },
    '/api/v1/users/me': {
      get: {
        tags: ['Users'],
        summary: 'Get current authenticated user profile',
        security: [{ BearerAuth: [] }],
        responses: {
          200: { description: 'User profile', content: { 'application/json': { schema: { $ref: '#/components/schemas/User' } } } },
          401: { description: 'Unauthorized' },
        },
      },
    },
    '/api/v1/users/profile': {
      put: {
        tags: ['Users'],
        summary: 'Update user profile',
        security: [{ BearerAuth: [] }],
        requestBody: { required: true, content: { 'application/json': { schema: { $ref: '#/components/schemas/UpdateProfileRequest' } } } },
        responses: { 200: { description: 'Profile updated' }, 401: { description: 'Unauthorized' } },
      },
    },
    '/api/v1/users/profile-picture': {
      post: {
        tags: ['Users'],
        summary: 'Upload profile picture (stored on Cloudinary)',
        security: [{ BearerAuth: [] }],
        requestBody: {
          required: true,
          content: {
            'multipart/form-data': {
              schema: {
                type: 'object',
                properties: {
                  profilePicture: { type: 'string', format: 'binary', description: 'Image file (jpeg, png, webp, gif — max 5MB)' },
                },
              },
            },
          },
        },
        responses: {
          200: {
            description: 'Profile picture uploaded — returns Cloudinary URL',
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  properties: {
                    success: { type: 'boolean', example: true },
                    data: {
                      type: 'object',
                      properties: { profilePicture: { type: 'string', example: 'https://res.cloudinary.com/...' } },
                    },
                  },
                },
              },
            },
          },
          400: { description: 'No file uploaded or invalid file type' },
          401: { description: 'Unauthorized' },
        },
      },
    },
    '/api/v1/users/change-password': {
      post: {
        tags: ['Users'],
        summary: 'Change password',
        security: [{ BearerAuth: [] }],
        requestBody: { required: true, content: { 'application/json': { schema: { $ref: '#/components/schemas/ChangePasswordRequest' } } } },
        responses: { 200: { description: 'Password changed' }, 400: { description: 'Incorrect current password' } },
      },
    },
  },
};

const options = {
  definition: swaggerDefinition as any,
  apis: [],
} as any;

export const swaggerSpec = swaggerJSDoc(options);
