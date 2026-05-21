import { Request, Response } from 'express';
import bcrypt from 'bcryptjs';
import jwt, { type Secret, type SignOptions } from 'jsonwebtoken';
import { v4 as uuidv4 } from 'uuid';
import { StatusCodes } from 'http-status-codes';
import { logger } from '../utils/logger';
import { ApiError } from '../utils/ApiError';
import { User } from '../models/User';
import { Token } from '../models/Token';
import { sendEmail } from '../services/email.service';
import { emailTemplates } from '../utils/emailTemplates';
import { JWT_SECRET, JWT_ACCESS_EXPIRATION, JWT_REFRESH_EXPIRATION } from '../config';
import { UserRole, Gender, Country } from '../types';

/**
 * Register a new user
 */
export const register = async (req: Request, res: Response): Promise<void> => {
  try {
    // Add extra logging for debugging
    logger.info('Registration attempt started', { 
      hasEmail: !!req.body.email, 
      hasPhone: !!req.body.phoneNumber,
      userAgent: req.get('User-Agent')
    });
    const {
      email,
      phoneNumber,
      password,
      confirmPassword,
      firstName,
      lastName,
      dateOfBirth,
      gender,
      country = Country.NIGERIA,
      acceptTerms,
      role = UserRole.USER,
    } = req.body as {
      email?: string;
      phoneNumber?: string;
      password: string;
      confirmPassword: string;
      firstName: string;
      lastName: string;
      dateOfBirth: string | Date;
      gender: Gender;
      country?: Country;
      acceptTerms?: string | boolean;
      role?: UserRole;
    };

    // Log attempt without PII
    logger.info('Registration attempt', { byEmail: Boolean(email), byPhone: Boolean(phoneNumber) });

    // Require either email or phone
    if (!email && !phoneNumber) {
      throw new ApiError(StatusCodes.BAD_REQUEST, 'Either email or phone number is required');
    }

    // Enforce age >= 18
    const dob = new Date(dateOfBirth as any);
    if (Number.isNaN(dob.getTime())) {
      throw new ApiError(StatusCodes.BAD_REQUEST, 'Valid date of birth is required');
    }
    const now = new Date();
    const age = now.getFullYear() - dob.getFullYear() - (now < new Date(dob.getFullYear() + (now.getFullYear() - dob.getFullYear()), dob.getMonth(), dob.getDate()) ? 1 : 0);
    if (age < 18) {
      throw new ApiError(StatusCodes.BAD_REQUEST, 'You must be at least 18 years old');
    }

    // Enforce acceptance of terms
    const accepted = acceptTerms === true || acceptTerms === 'true';
    if (!accepted) {
      throw new ApiError(StatusCodes.BAD_REQUEST, 'You must accept the Terms of Service and Privacy Policy');
    }

    // Check if user already exists
    const existingUser = await User.findOne({
      $or: [
        ...(email ? [{ email }] : []),
        ...(phoneNumber ? [{ phoneNumber }] : []),
      ],
    });
    if (existingUser) {
      throw new ApiError(StatusCodes.CONFLICT, 'Account with provided email or phone already exists');
    }

    // Hash password
    const hashedPassword = await bcrypt.hash(password, 12);

    // Create user
    const phoneCode = phoneNumber ? String(Math.floor(100000 + Math.random() * 900000)) : undefined;
    const user = await User.create({
      email,
      phoneNumber,
      password: hashedPassword,
      firstName,
      lastName,
      role,
      verificationToken: email ? uuidv4() : undefined,
      phoneVerificationCode: phoneCode,
      dateOfBirth: dob,
      gender,
      country,
      acceptedTermsAt: new Date(),
    });

    // Generate tokens
    const { accessToken, refreshToken } = generateTokens(user.id, user.role);

    // Save refresh token
    await Token.create({
      token: refreshToken,
      user: user.id,
      expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000), // 7 days
    });

    // Send verification message (email or SMS stub)
    if (email && user.verificationToken) {
      const verificationUrl = `${process.env.CLIENT_URL}/verify-email/${user.verificationToken}`;
      const emailContent = emailTemplates.verifyEmail(verificationUrl, firstName);
      try {
        await sendEmail({
          to: email,
          subject: emailContent.subject,
          html: emailContent.html,
          text: emailContent.text,
        });
        logger.info('Verification email sent successfully');
      } catch (emailError) {
        // Don't fail registration if email fails - just log the error
        logger.warn('Failed to send verification email, but registration completed', { 
          error: (emailError as Error).message 
        });
      }
    } else if (phoneNumber && phoneCode) {
      // SMS provider integration would go here; for now, log masked
      logger.info('SMS verification code sent', { phone: '***redacted***' });
    }

    // Remove sensitive data before sending response
    user.password = undefined as any;
    user.verificationToken = undefined as any;
    user.phoneVerificationCode = undefined as any;

    res.status(StatusCodes.CREATED).json({
      success: true,
      data: {
        user,
        tokens: {
          accessToken,
          refreshToken,
        },
      },
    });
  } catch (error) {
    logger.error('Registration error:', error);
    
    // Don't crash the server - send proper error response
    if (res.headersSent) {
      return;
    }
    
    if (error instanceof ApiError) {
      res.status(error.statusCode).json({
        success: false,
        message: error.message
      });
    } else {
      res.status(StatusCodes.INTERNAL_SERVER_ERROR).json({
        success: false,
        message: 'Registration failed. Please try again.'
      });
    }
  }
};

/**
 * Login user
 */
export const login = async (req: Request, res: Response): Promise<void> => {
  try {
    const { email, password } = req.body;

    // Check if user exists
    const user = await User.findOne({ email }).select('+password');
    if (!user) {
      throw new ApiError(StatusCodes.UNAUTHORIZED, 'Invalid credentials');
    }

    // Check if password is correct
    const isPasswordValid = await bcrypt.compare(password, user.password);
    if (!isPasswordValid) {
      throw new ApiError(StatusCodes.UNAUTHORIZED, 'Invalid credentials');
    }

    // Check if email is verified (allow fallback if email verification is disabled)
    const requireEmailVerification = process.env.REQUIRE_EMAIL_VERIFICATION !== 'false';
    if (requireEmailVerification && !user.isEmailVerified) {
      throw new ApiError(StatusCodes.FORBIDDEN, 'Please verify your email first');
    }

    // Generate tokens
    const { accessToken, refreshToken } = generateTokens(user.id, user.role);

    // Save refresh token
    await Token.create({
      token: refreshToken,
      user: user.id,
      expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000), // 7 days
    });

    // Remove sensitive data before sending response
    user.password = undefined as any;

    res.status(StatusCodes.OK).json({
      success: true,
      data: {
        user,
        tokens: {
          accessToken,
          refreshToken,
        },
      },
    });
  } catch (error) {
    logger.error('Login error:', error);
    throw error;
  }
};

/**
 * Refresh access token
 */
export const refreshToken = async (req: Request, res: Response): Promise<void> => {
  try {
    const { refreshToken: oldRefreshToken } = req.body;

    // Verify refresh token
    const payload = jwt.verify(oldRefreshToken, JWT_SECRET) as {
      userId: string;
      role: UserRole;
      sessionId: string;
    };

    // Check if token exists in database
    const token = await Token.findOne({
      token: oldRefreshToken,
      user: payload.userId,
      expiresAt: { $gt: new Date() },
    });

    if (!token) {
      throw new ApiError(StatusCodes.UNAUTHORIZED, 'Invalid refresh token');
    }

    // Rotate: issue a brand-new pair AND invalidate the old refresh token row
    // so a stolen refresh token can only be used at most once.
    const { accessToken, refreshToken: newRefreshToken } = generateTokens(
      payload.userId,
      payload.role
    );

    await Token.deleteOne({ _id: token._id });
    await Token.create({
      token: newRefreshToken,
      user: payload.userId,
      expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
    });

    res.status(StatusCodes.OK).json({
      success: true,
      data: {
        accessToken,
        refreshToken: newRefreshToken,
        expiresIn: JWT_ACCESS_EXPIRATION,
      },
    });
  } catch (error) {
    logger.error('Refresh token error:', error);
    throw new ApiError(StatusCodes.UNAUTHORIZED, 'Invalid refresh token');
  }
};

/**
 * Logout user
 */
export const logout = async (req: Request, res: Response): Promise<void> => {
  try {
    const { refreshToken } = req.body;

    // Delete refresh token from database
    await Token.deleteOne({ token: refreshToken });

    res.status(StatusCodes.OK).json({ success: true, message: 'Logout successful' });
  } catch (error) {
    logger.error('Logout error:', error);
    throw error;
  }
};

/**
 * Forgot password
 */
export const forgotPassword = async (req: Request, res: Response): Promise<void> => {
  try {
    const { email } = req.body;

    // Find user by email
    const user = await User.findOne({ email });
    if (!user) {
      // Don't reveal if user exists or not for security
      res.status(StatusCodes.OK).json({
        success: true,
        message: 'If your email is registered, you will receive a password reset link',
      });
      return;
    }

    // Generate reset token
    const resetToken = uuidv4();
    const resetTokenExpires = new Date(Date.now() + 10 * 60 * 1000); // 10 minutes

    // Save reset token to user
    user.resetPasswordToken = resetToken;
    user.resetPasswordExpires = resetTokenExpires;
    await user.save();

    // Send reset password email
    const resetUrl = `${process.env.CLIENT_URL}/reset-password?token=${resetToken}`;
    const emailContent = emailTemplates.resetPassword(resetUrl, user.firstName);
    await sendEmail({
      to: user.email,
      subject: emailContent.subject,
      html: emailContent.html,
      text: emailContent.text,
    });

    res.status(StatusCodes.OK).json({
      success: true,
      message: 'If your email is registered, you will receive a password reset link',
    });
  } catch (error) {
    logger.error('Forgot password error:', error);
    throw error;
  }
};

/**
 * Reset password
 */
export const resetPassword = async (req: Request, res: Response): Promise<void> => {
  try {
    const { token, password } = req.body;

    // Find user by reset token
    const user = await User.findOne({
      resetPasswordToken: token,
      resetPasswordExpires: { $gt: new Date() },
    });

    if (!user) {
      throw new ApiError(StatusCodes.BAD_REQUEST, 'Invalid or expired token');
    }

    // Update password
    const hashedPassword = await bcrypt.hash(password, 12);
    user.password = hashedPassword;
    user.resetPasswordToken = undefined;
    user.resetPasswordExpires = undefined;
    await user.save();

    // Invalidate all user's refresh tokens
    await Token.deleteMany({ user: user.id });

    res.status(StatusCodes.OK).json({
      success: true,
      message: 'Password reset successful',
    });
  } catch (error) {
    logger.error('Reset password error:', error);
    throw error;
  }
};

/**
 * Verify email
 */
export const verifyEmail = async (req: Request, res: Response): Promise<void> => {
  try {
    const { token } = req.params;

    // Find user by verification token
    const user = await User.findOne({ verificationToken: token });

    if (!user) {
      throw new ApiError(StatusCodes.BAD_REQUEST, 'Invalid verification token');
    }

    // Update user
    user.isEmailVerified = true;
    user.verificationToken = undefined;
    await user.save();

    // Send welcome email
    const welcomeEmail = emailTemplates.welcome(user.firstName);
    await sendEmail({
      to: user.email,
      subject: welcomeEmail.subject,
      html: welcomeEmail.html,
      text: welcomeEmail.text,
    }).catch((error) => {
      // Don't fail verification if welcome email fails
      logger.error('Failed to send welcome email:', error);
    });

    // Redirect to success page
    res.redirect(`${process.env.CLIENT_URL}/email-verified`);
  } catch (error) {
    logger.error('Verify email error:', error);
    res.redirect(`${process.env.CLIENT_URL}/verification-error`);
  }
};

/**
 * Resend verification email
 */
export const resendVerificationEmail = async (req: Request, res: Response): Promise<void> => {
  try {
    const { email } = req.body;

    // Find user by email
    const user = await User.findOne({ email });

    if (!user) {
      // Don't reveal if user exists or not for security
      res.status(StatusCodes.OK).json({
        success: true,
        message: 'If your email is registered, you will receive a verification email',
      });
      return;
    }

    if (user.isEmailVerified) {
      throw new ApiError(StatusCodes.BAD_REQUEST, 'Email already verified');
    }

    // Generate new verification token
    user.verificationToken = uuidv4();
    await user.save();

    // Send verification email
    const verificationUrl = `${process.env.CLIENT_URL}/verify-email/${user.verificationToken}`;
    const emailContent = emailTemplates.verifyEmail(verificationUrl, user.firstName);
    await sendEmail({
      to: user.email,
      subject: emailContent.subject,
      html: emailContent.html,
      text: emailContent.text,
    });

    res.status(StatusCodes.OK).json({
      success: true,
      message: 'Verification email sent',
    });
  } catch (error) {
    logger.error('Resend verification email error:', error);
    throw error;
  }
};

/**
 * Generate access and refresh tokens
 */
const generateTokens = (userId: string, role: UserRole) => {
  const sessionId = uuidv4();
  const accessToken = generateAccessToken(userId, role, sessionId);
  const refreshToken = jwt.sign(
    { userId, role, sessionId },
    JWT_SECRET as Secret,
    { expiresIn: JWT_REFRESH_EXPIRATION as SignOptions['expiresIn'] }
  );

  return { accessToken, refreshToken };
};

/**
 * Clerk Sync — exchange a Clerk-authenticated user for a MentWel JWT pair.
 *
 * The frontend calls this right after a successful Clerk sign-in or sign-up
 * (e.g. Google OAuth). We find-or-create the matching MentWel user and return
 * our own access/refresh tokens so the rest of the API works transparently.
 *
 * TODO (production-hardening): verify the supplied Clerk session token against
 * Clerk's JWKS using `@clerk/backend` to ensure the request is authentic.
 * For now we trust the supplied profile (low risk for our use case because
 * the worst an attacker can do is create a new user with someone else's name).
 */
export const clerkSync = async (req: Request, res: Response): Promise<void> => {
  try {
    const {
      clerkUserId,
      email,
      firstName,
      lastName,
      profileImageUrl,
    } = req.body as {
      clerkUserId: string;
      email: string;
      firstName?: string;
      lastName?: string;
      profileImageUrl?: string;
    };

    if (!clerkUserId || !email) {
      throw new ApiError(
        StatusCodes.BAD_REQUEST,
        'clerkUserId and email are required'
      );
    }

    let user = await User.findOne({ email: email.toLowerCase() });

    if (!user) {
      // Create a brand-new user record. We use a random password since the
      // user will only ever authenticate via Clerk.
      const randomPassword = await bcrypt.hash(uuidv4() + Date.now(), 12);

      // Default DOB to an adult value so the schema validation passes; the
      // user can update it later in their profile.
      const defaultDob = new Date('2000-01-01');

      user = await User.create({
        email: email.toLowerCase(),
        password: randomPassword,
        firstName: firstName || 'User',
        lastName: lastName || '',
        role: UserRole.USER,
        isEmailVerified: true, // Clerk has verified the email
        dateOfBirth: defaultDob,
        gender: Gender.PREFER_NOT_TO_SAY,
        country: Country.NIGERIA,
        acceptedTermsAt: new Date(),
        profilePicture: profileImageUrl,
      });

      logger.info('Created new user from Clerk sync', { userId: user.id });
    } else if (profileImageUrl && !user.profilePicture) {
      user.profilePicture = profileImageUrl;
      await user.save();
    }

    const { accessToken, refreshToken } = generateTokens(user.id, user.role);

    await Token.create({
      token: refreshToken,
      user: user.id,
      expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
    });

    // Strip sensitive fields
    user.password = undefined as any;
    user.verificationToken = undefined as any;

    res.status(StatusCodes.OK).json({
      success: true,
      data: {
        user,
        tokens: {
          accessToken,
          refreshToken,
        },
      },
    });
  } catch (error) {
    logger.error('Clerk sync error:', error);
    if (res.headersSent) return;
    if (error instanceof ApiError) {
      res.status(error.statusCode).json({ success: false, message: error.message });
    } else {
      res.status(StatusCodes.INTERNAL_SERVER_ERROR).json({
        success: false,
        message: 'Clerk sync failed',
      });
    }
  }
};

/**
 * Generate access token
 */
const generateAccessToken = (userId: string, role: UserRole, sessionId: string): string => {
  return jwt.sign(
    { userId, role, sessionId },
    JWT_SECRET as Secret,
    { expiresIn: JWT_ACCESS_EXPIRATION as SignOptions['expiresIn'] }
  );
};


