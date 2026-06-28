import mongoose, { Schema, Document } from 'mongoose';
import bcrypt from 'bcrypt';
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
  refreshTokenVersion: number; // For token rotation
  lastLoginAt?: Date;
  failedLoginAttempts: number;
  lockUntil?: Date;
  comparePassword(candidatePassword: string): Promise<boolean>;
  isAccountLocked(): boolean;
}

const UserSchema = new Schema<IUser>(
  {
    email: { 
      type: String, 
      required: false, 
      unique: true, 
      sparse: true, 
      lowercase: true, 
      index: true,
      trim: true,
      match: [/^\S+@\S+\.\S+$/, 'Please enter a valid email address'],
    },
    password: { 
      type: String, 
      required: true, 
      select: false,
      minlength: 8,
    },
    firstName: { 
      type: String, 
      required: true,
      trim: true,
      maxlength: 50,
    },
    lastName: { 
      type: String, 
      required: true,
      trim: true,
      maxlength: 50,
    },
    role: { 
      type: String, 
      enum: Object.values(UserRole), 
      default: UserRole.USER,
      index: true,
    },
    phoneNumber: { 
      type: String, 
      unique: true, 
      sparse: true,
      match: [/^\+234[789][01]\d{8}$/, 'Please enter a valid Nigerian phone number'],
    },
    isPhoneVerified: { type: Boolean, default: false },
    isEmailVerified: { type: Boolean, default: false },
    verificationToken: { type: String },
    phoneVerificationCode: { type: String },
    resetPasswordToken: { type: String },
    resetPasswordExpires: { type: Date },
    status: { 
      type: String, 
      enum: Object.values(UserStatus), 
      default: UserStatus.ACTIVE,
      index: true,
    },
    dateOfBirth: { 
      type: Date, 
      required: true,
      validate: {
        validator: function(value: Date) {
          // User must be at least 13 years old
          const age = Math.floor((Date.now() - value.getTime()) / (365.25 * 24 * 60 * 60 * 1000));
          return age >= 13;
        },
        message: 'User must be at least 13 years old',
      },
    },
    gender: { 
      type: String, 
      enum: Object.values(Gender), 
      default: Gender.PREFER_NOT_TO_SAY,
    },
    country: { 
      type: String, 
      enum: Object.values(Country), 
      default: Country.NIGERIA,
    },
    acceptedTermsAt: { type: Date, default: Date.now },
    profilePicture: { 
      type: String,
      validate: {
        validator: function(value: string) {
          return !value || value.startsWith('http') || value.startsWith('data:image');
        },
        message: 'Invalid profile picture URL',
      },
    },
    refreshTokenVersion: { type: Number, default: 0 },
    lastLoginAt: { type: Date },
    failedLoginAttempts: { type: Number, default: 0 },
    lockUntil: { type: Date },
  },
  { 
    timestamps: true,
    toJSON: {
      transform: function(doc, ret) {
        delete ret.password;
        delete ret.verificationToken;
        delete ret.phoneVerificationCode;
        delete ret.resetPasswordToken;
        delete ret.resetPasswordExpires;
        delete ret.__v;
        return ret;
      },
    },
  }
);

// Compound indexes for performance
UserSchema.index({ email: 1, phoneNumber: 1 });
UserSchema.index({ status: 1, role: 1 });
UserSchema.index({ createdAt: -1 });

// Pre-save middleware - hash password
UserSchema.pre<IUser>('save', async function(next) {
  // Only hash if password is modified
  if (!this.isModified('password')) return next();
  
  try {
    const salt = await bcrypt.genSalt(12);
    this.password = await bcrypt.hash(this.password, salt);
    next();
  } catch (error) {
    next(error as Error);
  }
});

// Method to compare password
UserSchema.methods.comparePassword = async function(candidatePassword: string): Promise<boolean> {
  return bcrypt.compare(candidatePassword, this.password);
};

// Method to check if account is locked
UserSchema.methods.isAccountLocked = function(): boolean {
  if (!this.lockUntil) return false;
  return this.lockUntil > new Date();
};

// Method to increment failed login attempts
UserSchema.methods.incrementFailedLoginAttempts = async function(): Promise<void> {
  this.failedLoginAttempts += 1;
  
  // Lock account after 5 failed attempts
  if (this.failedLoginAttempts >= 5) {
    this.lockUntil = new Date(Date.now() + 30 * 60 * 1000); // 30 minutes
  }
  
  await this.save();
};

// Method to reset failed login attempts
UserSchema.methods.resetFailedLoginAttempts = async function(): Promise<void> {
  this.failedLoginAttempts = 0;
  this.lockUntil = undefined;
  await this.save();
};

// Static method to find by email or phone
UserSchema.statics.findByEmailOrPhone = function(email: string, phoneNumber: string) {
  return this.findOne({
    $or: [
      { email: email?.toLowerCase() },
      { phoneNumber },
    ],
  });
};

export const User = mongoose.model<IUser>('User', UserSchema);