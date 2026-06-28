import mongoose, { Schema, Document, Types } from 'mongoose';

export type ChatMessageType = 'text' | 'image' | 'file' | 'system';
export type SenderType = 'user' | 'counselor' | 'system';

export interface IChatMessage extends Document {
  session: Types.ObjectId;
  sender: Types.ObjectId;
  senderType: SenderType;
  content: string;
  type: ChatMessageType;
  read: boolean;
  readBy: Types.ObjectId[];
  delivered: boolean;
  deliveredAt?: Date;
  readAt?: Date;
  timestamp: Date;
  metadata?: {
    fileName?: string;
    fileSize?: number;
    mimeType?: string;
    url?: string;
    [key: string]: any;
  };
  isDeleted: boolean;
  deletedFor?: Types.ObjectId[];
}

const ChatMessageSchema = new Schema<IChatMessage>(
  {
    session: { 
      type: Schema.Types.ObjectId, 
      ref: 'ChatSession', 
      required: true, 
      index: true,
    },
    sender: { 
      type: Schema.Types.ObjectId, 
      ref: 'User', 
      required: true,
      index: true,
    },
    senderType: { 
      type: String, 
      enum: ['user', 'counselor', 'system'], 
      required: true,
    },
    content: { 
      type: String, 
      required: true,
      maxlength: 10000, // Max 10,000 characters per message
    },
    type: { 
      type: String, 
      enum: ['text', 'image', 'file', 'system'], 
      default: 'text',
    },
    read: { type: Boolean, default: false },
    readBy: [{ type: Schema.Types.ObjectId, ref: 'User' }],
    delivered: { type: Boolean, default: false },
    deliveredAt: { type: Date },
    readAt: { type: Date },
    timestamp: { type: Date, default: Date.now, index: true },
    metadata: {
      type: Schema.Types.Mixed,
      default: {},
    },
    isDeleted: { type: Boolean, default: false },
    deletedFor: [{ type: Schema.Types.ObjectId, ref: 'User' }],
  },
  { 
    timestamps: true,
    toJSON: {
      transform: function(doc, ret) {
        ret.id = ret._id;
        delete ret._id;
        delete ret.__v;
        return ret;
      },
    },
  }
);

// Indexes for performance
ChatMessageSchema.index({ session: 1, timestamp: -1 });
ChatMessageSchema.index({ sender: 1, timestamp: -1 });
ChatMessageSchema.index({ read: 1, delivered: 1 });
ChatMessageSchema.index({ 'metadata.url': 1 });

// Compound index for unread messages
ChatMessageSchema.index({ session: 1, read: 1, senderType: 1 });

// Method to mark message as read
ChatMessageSchema.methods.markAsRead = async function(userId: Types.ObjectId): Promise<void> {
  if (!this.readBy.includes(userId)) {
    this.readBy.push(userId);
  }
  
  // If all participants have read the message, mark as read
  // This is simplified - you might want to check against session participants
  this.read = true;
  this.readAt = new Date();
  await this.save();
};

// Method to mark message as delivered
ChatMessageSchema.methods.markAsDelivered = async function(): Promise<void> {
  if (!this.delivered) {
    this.delivered = true;
    this.deliveredAt = new Date();
    await this.save();
  }
};

// Static method to get unread count
ChatMessageSchema.statics.getUnreadCount = function(sessionId: Types.ObjectId, userId: Types.ObjectId) {
  return this.countDocuments({
    session: sessionId,
    read: false,
    sender: { $ne: userId },
    isDeleted: false,
  });
};

// Static method to get recent messages
ChatMessageSchema.statics.getRecentMessages = function(sessionId: Types.ObjectId, limit: number = 50) {
  return this.find({
    session: sessionId,
    isDeleted: false,
  })
    .sort({ timestamp: -1 })
    .limit(limit)
    .populate('sender', 'firstName lastName profilePicture role')
    .lean()
    .exec();
};

export const ChatMessage = mongoose.model<IChatMessage>('ChatMessage', ChatMessageSchema);