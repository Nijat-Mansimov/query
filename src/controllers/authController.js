// src/controllers/authController.js
const jwt = require('jsonwebtoken');
const crypto = require('crypto');
const { v4: uuidv4 } = require('uuid');
const speakeasy = require('speakeasy');
const QRCode = require('qrcode');
const User = require('../models/User');
const { sendVerificationEmail, sendPasswordResetEmail } = require('../utils/email');
const { asyncHandler, errors } = require('../middleware/errorHandler');

// Generate JWT tokens
const generateTokens = (userId, jti = uuidv4()) => {
  const accessToken = jwt.sign(
    { userId, jti, type: 'access' },
    process.env.JWT_SECRET,
    { expiresIn: process.env.JWT_ACCESS_EXPIRATION || '15m' }
  );

  const refreshToken = jwt.sign(
    { userId, jti, type: 'refresh' },
    process.env.JWT_REFRESH_SECRET,
    { expiresIn: process.env.JWT_REFRESH_EXPIRATION || '7d' }
  );

  return { accessToken, refreshToken, jti };
};

// Register new user
exports.register = asyncHandler(async (req, res) => {
  const { email, password, username, firstName, lastName } = req.body;

  // Check if user already exists
  const existingUser = await User.findOne({ 
    $or: [{ email: email.toLowerCase() }, { username }] 
  });

  if (existingUser) {
    throw existingUser.email === email.toLowerCase() 
      ? errors.conflict('Email already registered')
      : errors.conflict('Username already taken');
  }

  // Generate verification token
  const verificationToken = crypto.randomBytes(32).toString('hex');
  const verificationExpires = new Date(Date.now() + 24 * 60 * 60 * 1000);

  // Create user
  const user = new User({
    email: email.toLowerCase(),
    password,
    username,
    profile: { firstName, lastName },
    emailVerificationToken: verificationToken,
    emailVerificationExpires: verificationExpires
  });

  await user.save();

  // Send verification email (non-blocking)
  sendVerificationEmail(user.email, verificationToken).catch(err => {
    console.error('Failed to send verification email:', err.message);
  });

  res.status(201).json({
    success: true,
    message: 'Registration successful. Please check your email to verify your account.',
    data: {
      userId: user._id,
      email: user.email,
      username: user.username
    }
  });
});

// Login user
exports.login = asyncHandler(async (req, res, next) => {
  const passport = require('passport');
  
  passport.authenticate('local', { session: false }, async (err, user, info) => {
    try {
      if (err) {
        throw errors.internal('Authentication error');
      }

      if (!user) {
        throw errors.unauthorized(info?.message || 'Authentication failed');
      }

      // Check if 2FA is required
      if (user.requires2FA) {
        return res.status(200).json({
          success: true,
          requires2FA: true,
          userId: user.userId,
          message: 'Please provide 2FA token'
        });
      }

      // Generate tokens
      const { accessToken, refreshToken } = generateTokens(user._id);

      // Store refresh token in database
      user.refreshTokens.push({
        token: refreshToken,
        deviceInfo: req.get('user-agent'),
        ipAddress: req.ip,
        expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000)
      });

      if (user.refreshTokens.length > 5) {
        user.refreshTokens = user.refreshTokens.slice(-5);
      }

      await user.save();

      res.json({
        success: true,
        message: 'Login successful',
        data: {
          user: {
            id: user._id,
            email: user.email,
            username: user.username,
            role: user.role,
            emailVerified: user.emailVerified
          },
          tokens: {
            accessToken,
            refreshToken,
            expiresIn: 900
          }
        }
      });
    } catch (error) {
      next(error);
    }
  })(req, res, next);
});

// Verify 2FA token and complete login
exports.verify2FA = asyncHandler(async (req, res) => {
  const { userId, token } = req.body;

  const user = await User.findById(userId).select('+twoFactorAuth.secret');

  if (!user || !user.twoFactorAuth.enabled) {
    throw errors.badRequest('Invalid request');
  }

  // Verify token
  const verified = speakeasy.totp.verify({
    secret: user.twoFactorAuth.secret,
    encoding: 'base32',
    token,
    window: 2
  });

  if (!verified) {
    throw errors.unauthorized('Invalid 2FA token');
  }

  // Generate tokens
  const { accessToken, refreshToken } = generateTokens(user._id);

  user.refreshTokens.push({
    token: refreshToken,
    deviceInfo: req.get('user-agent'),
    ipAddress: req.ip,
    expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000)
  });

  user.lastLogin = new Date();
  await user.save();

  res.json({
    success: true,
    message: 'Login successful',
    data: {
      user: {
        id: user._id,
        email: user.email,
        username: user.username,
        role: user.role
      },
      tokens: {
        accessToken,
        refreshToken,
        expiresIn: 900
      }
    }
  });
});

// Refresh access token
exports.refreshToken = asyncHandler(async (req, res) => {
  const { refreshToken } = req.body;

  if (!refreshToken) {
    throw errors.badRequest('Refresh token required');
  }

  // Verify refresh token
  const decoded = jwt.verify(refreshToken, process.env.JWT_REFRESH_SECRET);

  if (decoded.type !== 'refresh') {
    throw errors.unauthorized('Invalid token type');
  }

  const user = await User.findById(decoded.userId);

  if (!user) {
    throw errors.unauthorized('User not found');
  }

  const tokenExists = user.refreshTokens.some(t => t.token === refreshToken);

  if (!tokenExists) {
    throw errors.unauthorized('Invalid refresh token');
  }

  // Generate new tokens
  const { accessToken, refreshToken: newRefreshToken } = generateTokens(user._id);

  user.refreshTokens = user.refreshTokens.filter(t => t.token !== refreshToken);
  user.refreshTokens.push({
    token: newRefreshToken,
    deviceInfo: req.get('user-agent'),
    ipAddress: req.ip,
    expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000)
  });

  await user.save();

  res.json({
    success: true,
    data: {
      accessToken,
      refreshToken: newRefreshToken,
      expiresIn: 900
    }
  });
});

// Logout
exports.logout = asyncHandler(async (req, res) => {
  const { refreshToken } = req.body;
  const user = req.user;

  if (refreshToken) {
    user.refreshTokens = user.refreshTokens.filter(t => t.token !== refreshToken);
    await user.save();
  }

  res.json({
    success: true,
    message: 'Logout successful'
  });
});

// Verify email
exports.verifyEmail = asyncHandler(async (req, res) => {
  const { token } = req.params;

  const user = await User.findOne({
    emailVerificationToken: token,
    emailVerificationExpires: { $gt: Date.now() }
  });

  if (!user) {
    throw errors.badRequest('Invalid or expired verification token');
  }

  user.emailVerified = true;
  user.emailVerificationToken = undefined;
  user.emailVerificationExpires = undefined;
  await user.save();

  res.json({
    success: true,
    message: 'Email verified successfully'
  });
});

// Request password reset
exports.forgotPassword = asyncHandler(async (req, res) => {
  const { email } = req.body;

  const user = await User.findOne({ email: email.toLowerCase() });

  if (user) {
    const resetToken = crypto.randomBytes(32).toString('hex');
    user.passwordResetToken = resetToken;
    user.passwordResetExpires = new Date(Date.now() + 60 * 60 * 1000);

    await user.save();
    
    sendPasswordResetEmail(user.email, resetToken).catch(err => {
      console.error('Failed to send password reset email:', err.message);
    });
  }

  // Always return same message for security
  res.json({
    success: true,
    message: 'If that email exists, a password reset link has been sent'
  });
});

// Reset password
exports.resetPassword = asyncHandler(async (req, res) => {
  const { token } = req.params;
  const { password } = req.body;

  const user = await User.findOne({
    passwordResetToken: token,
    passwordResetExpires: { $gt: Date.now() }
  });

  if (!user) {
    throw errors.badRequest('Invalid or expired reset token');
  }

  user.password = password;
  user.passwordResetToken = undefined;
  user.passwordResetExpires = undefined;
  user.refreshTokens = [];

  await user.save();

  res.json({
    success: true,
    message: 'Password reset successful'
  });
});