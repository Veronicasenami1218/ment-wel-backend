import { Response } from 'express';
import { StatusCodes } from 'http-status-codes';
import bcrypt from 'bcryptjs';
import { v2 as cloudinary } from 'cloudinary';
import { User } from '../models/User';
import { Token } from '../models/Token';
import { ApiError } from '../utils/ApiError';
import { logger } from '../utils/logger';
import { AuthenticatedRequest } from '../middleware/auth.middleware';

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
 * Uploads to Cloudinary — persists across server restarts and deploys.
 */
export const uploadProfilePicture = async (req: AuthenticatedRequest, res: Response) => {
  try {
    if (!req.user) throw ApiError.unauthorized();
    const file = (req as any).file as (Express.Multer.File & { path?: string; filename?: string }) | undefined;
    if (!file) throw ApiError.badRequest('No file uploaded');

    // Cloudinary returns the secure URL in file.path
    const newUrl: string = (file as any).path;

    const user = await User.findById(req.user.id);
    if (!user) throw ApiError.notFound('User not found');

    // Delete old Cloudinary image to keep storage clean
    if (user.profilePicture) {
      try {
        // Extract public_id from the old Cloudinary URL
        const urlParts = user.profilePicture.split('/');
        const uploadIndex = urlParts.indexOf('upload');
        if (uploadIndex !== -1) {
          // Strip version segment (v12345) if present
          const afterUpload = urlParts.slice(uploadIndex + 1);
          if (afterUpload[0]?.startsWith('v') && /^\d+$/.test(afterUpload[0].slice(1))) {
            afterUpload.shift();
          }
          const publicIdWithExt = afterUpload.join('/');
          const publicId = publicIdWithExt.replace(/\.[^/.]+$/, ''); // remove extension
          await cloudinary.uploader.destroy(publicId);
        }
      } catch {
        // Don't fail the upload if old image deletion fails
      }
    }

    user.profilePicture = newUrl;
    await user.save();

    res.status(StatusCodes.OK).json({
      success: true,
      data: { profilePicture: newUrl },
    });
  } catch (error) {
    logger.error('Upload profile picture error:', error);
    throw error;
  }
};
