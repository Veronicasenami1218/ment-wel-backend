import { Response } from 'express';
import { StatusCodes } from 'http-status-codes';
import bcrypt from 'bcryptjs';
import path from 'path';
import fs from 'fs';
import { User } from '../models/User';
import { Token } from '../models/Token';
import { ApiError } from '../utils/ApiError';
import { logger } from '../utils/logger';
import { AuthenticatedRequest } from '../middleware/auth.middleware';
import { API_BASE_URL, SERVER_URL } from '../config';

/**
 * GET /users/me
 * Returns the freshly-loaded profile of the authenticated user. The frontend
 * calls this on app boot to hydrate its cached user object with any changes
 * (role, status, profile picture, etc.) that happened on the server.
 */
export const getCurrentUser = async (req: AuthenticatedRequest, res: Response) => {
  if (!req.user) throw ApiError.unauthorized();
  const user = await User.findById(req.user.id).lean();
  if (!user) throw ApiError.notFound('User not found');
  res.status(StatusCodes.OK).json({ success: true, data: { user } });
};

/**
 * PUT /users/profile
 */
export const updateProfile = async (req: AuthenticatedRequest, res: Response) => {
  if (!req.user) throw ApiError.unauthorized();
  const { firstName, lastName, phoneNumber, country } = req.body as {
    firstName?: string;
    lastName?: string;
    phoneNumber?: string;
    country?: string;
  };

  const update: any = {};
  if (firstName !== undefined) update.firstName = firstName;
  if (lastName !== undefined) update.lastName = lastName;
  if (phoneNumber !== undefined) update.phoneNumber = phoneNumber;
  if (country !== undefined) update.country = country;

  const user = await User.findByIdAndUpdate(req.user.id, { $set: update }, { new: true }).lean();
  if (!user) throw ApiError.notFound('User not found');

  res.status(StatusCodes.OK).json({ success: true, data: user });
};

/**
 * POST /users/change-password
 */
export const changePassword = async (req: AuthenticatedRequest, res: Response) => {
  if (!req.user) throw ApiError.unauthorized();
  const { currentPassword, newPassword } = req.body as {
    currentPassword: string;
    newPassword: string;
  };

  const user = await User.findById(req.user.id).select('+password');
  if (!user) throw ApiError.notFound('User not found');

  const isValid = await bcrypt.compare(currentPassword, user.password);
  if (!isValid) throw ApiError.badRequest('Current password incorrect');

  user.password = await bcrypt.hash(newPassword, 12);
  await user.save();

  // Invalidate refresh tokens
  await Token.deleteMany({ user: user.id });

  res.status(StatusCodes.OK).json({ success: true, message: 'Password changed successfully' });
};

/**
 * POST /users/profile-picture
 */
export const uploadProfilePicture = async (req: AuthenticatedRequest, res: Response) => {
  try {
    if (!req.user) throw ApiError.unauthorized();
    const file = (req as any).file as Express.Multer.File | undefined;
    if (!file) throw ApiError.badRequest('No file uploaded');

    // Public URL served from /uploads
    const publicUrl = `${SERVER_URL.replace(/\/$/, '')}/uploads/profile-pictures/${file.filename}`;

    const user = await User.findById(req.user.id);
    if (!user) throw ApiError.notFound('User not found');

    // Remove old picture file if exists locally
    if (user.profilePicture) {
      const oldPath = path.join(
        process.cwd(),
        'uploads',
        'profile-pictures',
        path.basename(user.profilePicture)
      );
      fs.promises.unlink(oldPath).catch(() => undefined);
    }

    user.profilePicture = publicUrl;
    await user.save();

    res.status(StatusCodes.OK).json({
      success: true,
      data: { profilePicture: publicUrl },
    });
  } catch (error) {
    logger.error('Upload profile picture error:', error);
    throw error;
  }
};
