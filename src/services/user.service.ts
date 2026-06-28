// src/services/user.service.ts
import { User, IUser } from '../models/User';
import { ApiError } from '../utils/ApiError';
import { StatusCodes } from 'http-status-codes';
import { logger } from '../utils/logger';

export class UserService {
  async findById(userId: string): Promise<IUser | null> {
    try {
      return await User.findById(userId).select('-password');
    } catch (error) {
      logger.error('Error finding user:', error);
      throw new ApiError(StatusCodes.INTERNAL_SERVER_ERROR, 'Error fetching user');
    }
  }

  async updateProfile(userId: string, updateData: Partial<IUser>): Promise<IUser | null> {
    // Remove sensitive fields
    delete updateData.password;
    delete updateData.email; // Don't allow email change here
    
    return await User.findByIdAndUpdate(
      userId,
      { $set: updateData },
      { new: true, runValidators: true }
    ).select('-password');
  }

  async changePassword(userId: string, currentPassword: string, newPassword: string): Promise<void> {
    const user = await User.findById(userId);
    if (!user) {
      throw new ApiError(StatusCodes.NOT_FOUND, 'User not found');
    }

    const isMatch = await user.comparePassword(currentPassword);
    if (!isMatch) {
      throw new ApiError(StatusCodes.UNAUTHORIZED, 'Current password is incorrect');
    }

    user.password = newPassword;
    await user.save();
  }
}