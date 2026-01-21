// src/models/User.js
const mongoose = require('mongoose');
const bcrypt = require('bcrypt');

const userSchema = new mongoose.Schema({
  email: {
    type: String,
    required: true,
    unique: true,
    lowercase: true,
    trim: true,
    match: [/^\S+@\S+\.\S+$/, 'Invalid email format']
  },
  password: {
    type: String,
    required: true,
    minlength: 8,
    select: false
  },
  username: {
    type: String,
    required: true,
    unique: true,
    trim: true,
    minlength: 3,
    maxlength: 30
  },
  role: {
    type: String,
    enum: ['USER', 'VERIFIED_CONTRIBUTOR', 'MODERATOR', 'ADMIN'],
    default: 'USER'
  },
  profile: {
    firstName: String,
    lastName: String,
    avatar: String,
    bio: { type: String, maxlength: 500 },
    organization: String,
    location: String,
    website: String
  },
  emailVerified: {
    type: Boolean,
    default: false
  },
  emailVerificationToken: String,
  emailVerificationExpires: Date,
  passwordResetToken: String,
  passwordResetExpires: Date,
  twoFactorAuth: {
    enabled: { type: Boolean, default: false },
    secret: { type: String, select: false },
    backupCodes: { type: [String], select: false }
  },
  refreshTokens: [{
    token: { type: String, required: true },
    deviceInfo: String,
    ipAddress: String,
    createdAt: { type: Date, default: Date.now },
    expiresAt: Date
  }],
  statistics: {
    totalRules: { type: Number, default: 0 },
    totalDownloads: { type: Number, default: 0 },
    totalEarnings: { type: Number, default: 0 },
    rating: { type: Number, default: 0, min: 0, max: 5 }
  },
  billing: {
    stripeCustomerId: String,
    balance: { type: Number, default: 0 },
    currency: { type: String, default: 'USD' }
  },
  isActive: {
    type: Boolean,
    default: true
  },
  isBanned: {
    type: Boolean,
    default: false
  },
  banReason: String,
  lastLogin: Date,
  loginHistory: [{
    timestamp: Date,
    ipAddress: String,
    userAgent: String,
    success: Boolean
  }]
}, {
  timestamps: true,
  toJSON: { virtuals: true },
  toObject: { virtuals: true }
});

// Indexes
userSchema.index({ email: 1 });
userSchema.index({ username: 1 });
userSchema.index({ role: 1 });
userSchema.index({ 'statistics.rating': -1 });

// Hash password before saving
userSchema.pre('save', async function(next) {
  if (!this.isModified('password')) return next();
  this.password = await bcrypt.hash(this.password, 12);
  next();
});

// Compare password method
userSchema.methods.comparePassword = async function(candidatePassword) {
  return await bcrypt.compare(candidatePassword, this.password);
};

// Check if user has permission
userSchema.methods.hasPermission = function(permission) {
  const rolePermissions = {
    USER: ['rule:create', 'rule:read', 'rule:update:own', 'rule:delete:own'],
    VERIFIED_CONTRIBUTOR: ['rule:create', 'rule:read', 'rule:update:own', 'rule:delete:own', 'rule:publish'],
    MODERATOR: ['rule:create', 'rule:read', 'rule:update:any', 'rule:delete:any', 'rule:approve', 'rule:reject', 'user:moderate'],
    ADMIN: ['*']
  };
  
  const permissions = rolePermissions[this.role] || [];
  return permissions.includes('*') || permissions.includes(permission);
};

module.exports = mongoose.model('User', userSchema);