import mongoose, { Schema, Document } from 'mongoose';
import { UserRole, UserStatus, Gender, Country } from '../types';

export interface IUser extends Document {
  email: string;
  password: string;
  firstName: string;
  lastName: string;
  role: UserRole;
  phoneNumber?: string;
  isPhoneVerified?: boolean;
  isEmailVerified: boolean;
  verificationToken?: string;
  phoneVerificationCode?: string;
  resetPasswordToken?: string;
  resetPasswordExpires?: Date;
  status: UserStatus;
  dateOfBirth: Date;
  gender: Gender;
  country: Country;
  acceptedTermsAt?: Date;
  profilePicture?: string;
}

const UserSchema = new Schema<IUser>(
  {
    email: { type: String, required: false, unique: true, sparse: true, lowercase: true, index: true },
    password: { type: String, required: true, select: false },
    firstName: { type: String, required: true },
    lastName: { type: String, required: true },
    role: { type: String, enum: Object.values(UserRole), default: UserRole.USER },
    phoneNumber: { type: String, unique: true, sparse: true },
    isPhoneVerified: { type: Boolean, default: false },
    isEmailVerified: { type: Boolean, default: false },
    verificationToken: { type: String },
    phoneVerificationCode: { type: String },
    resetPasswordToken: { type: String },
    resetPasswordExpires: { type: Date },
    status: { type: String, enum: Object.values(UserStatus), default: UserStatus.ACTIVE },
    dateOfBirth: { type: Date, required: true },
    gender: { type: String, enum: Object.values(Gender), default: Gender.PREFER_NOT_TO_SAY },
    country: { type: String, enum: Object.values(Country), default: Country.NIGERIA },
    acceptedTermsAt: { type: Date },
    profilePicture: { type: String },
  },
  { timestamps: true }
);

export const User = mongoose.model<IUser>('User', UserSchema);
