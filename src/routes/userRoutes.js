// src/routes/userRoutes.js
const express = require('express');
const router = express.Router();
const { body, validationResult } = require('express-validator');
const speakeasy = require('speakeasy');
const QRCode = require('qrcode');
const User = require('../models/User');
const Rule = require('../models/Rule');
const { authenticate, hasRole } = require('../middleware/auth');

const validate = (req, res, next) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({
      success: false,
      errors: errors.array()
    });
  }
  next();
};

/**
 * @route   GET /api/v1/users/profile
 * @desc    Get current user profile
 * @access  Private
 */
router.get('/profile', authenticate, async (req, res) => {
  try {
    const user = await User.findById(req.user._id).select('-password -refreshTokens');
    
    res.json({
      success: true,
      data: { user }
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Failed to fetch profile',
      error: error.message
    });
  }
});

/**
 * @route   PUT /api/v1/users/profile
 * @desc    Update user profile
 * @access  Private
 */
router.put('/profile',
  authenticate,
  [
    body('profile.firstName').optional().trim().isLength({ max: 50 }),
    body('profile.lastName').optional().trim().isLength({ max: 50 }),
    body('profile.bio').optional().trim().isLength({ max: 500 }),
    body('profile.organization').optional().trim(),
    body('profile.location').optional().trim(),
    body('profile.website').optional().isURL()
  ],
  validate,
  async (req, res) => {
    try {
      const { profile } = req.body;
      
      const user = await User.findById(req.user._id);
      
      if (profile) {
        Object.assign(user.profile, profile);
      }
      
      await user.save();
      
      res.json({
        success: true,
        message: 'Profile updated successfully',
        data: { user }
      });
    } catch (error) {
      res.status(500).json({
        success: false,
        message: 'Failed to update profile',
        error: error.message
      });
    }
  }
);

/**
 * @route   GET /api/v1/users/:username
 * @desc    Get public user profile
 * @access  Public
 */
router.get('/:username', async (req, res) => {
  try {
    const user = await User.findOne({ username: req.params.username })
      .select('username profile statistics createdAt');
    
    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'User not found'
      });
    }
    
    // Get user's public rules
    const rules = await Rule.find({
      author: user._id,
      status: 'APPROVED',
      visibility: 'PUBLIC',
      isActive: true
    })
    .select('title category queryLanguage statistics createdAt')
    .sort('-createdAt')
    .limit(10);
    
    res.json({
      success: true,
      data: {
        user,
        rules
      }
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Failed to fetch user',
      error: error.message
    });
  }
});

/**
 * @route   GET /api/v1/users/me/rules
 * @desc    Get current user's rules
 * @access  Private
 */
router.get('/me/rules', authenticate, async (req, res) => {
  try {
    const { status, page = 1, limit = 20 } = req.query;
    
    const filter = { author: req.user._id };
    if (status) filter.status = status;
    
    const skip = (parseInt(page) - 1) * parseInt(limit);
    
    const rules = await Rule.find(filter)
      .sort('-createdAt')
      .limit(parseInt(limit))
      .skip(skip);
    
    const total = await Rule.countDocuments(filter);
    
    res.json({
      success: true,
      data: {
        rules,
        pagination: {
          currentPage: parseInt(page),
          totalPages: Math.ceil(total / parseInt(limit)),
          totalItems: total
        }
      }
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Failed to fetch rules',
      error: error.message
    });
  }
});

/**
 * @route   POST /api/v1/users/2fa/setup
 * @desc    Setup 2FA for user account
 * @access  Private
 */
router.post('/2fa/setup', authenticate, async (req, res) => {
  try {
    if (req.user.twoFactorAuth.enabled) {
      return res.status(400).json({
        success: false,
        message: '2FA is already enabled'
      });
    }
    
    // Generate secret
    const secret = speakeasy.generateSecret({
      name: `${process.env.TWO_FACTOR_APP_NAME || 'Security Rules Platform'} (${req.user.email})`
    });
    
    // Generate QR code
    const qrCode = await QRCode.toDataURL(secret.otpauth_url);
    
    // Temporarily store secret (not saved until verified)
    req.user.twoFactorAuth.secret = secret.base32;
    await req.user.save();
    
    res.json({
      success: true,
      data: {
        secret: secret.base32,
        qrCode,
        message: 'Scan the QR code with your authenticator app and verify with a token'
      }
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Failed to setup 2FA',
      error: error.message
    });
  }
});

/**
 * @route   POST /api/v1/users/2fa/verify
 * @desc    Verify and enable 2FA
 * @access  Private
 */
router.post('/2fa/verify',
  authenticate,
  [body('token').isLength({ min: 6, max: 6 })],
  validate,
  async (req, res) => {
    try {
      const { token } = req.body;
      
      const user = await User.findById(req.user._id).select('+twoFactorAuth.secret');
      
      if (!user.twoFactorAuth.secret) {
        return res.status(400).json({
          success: false,
          message: 'Please setup 2FA first'
        });
      }
      
      // Verify token
      const verified = speakeasy.totp.verify({
        secret: user.twoFactorAuth.secret,
        encoding: 'base32',
        token,
        window: 2
      });
      
      if (!verified) {
        return res.status(401).json({
          success: false,
          message: 'Invalid token'
        });
      }
      
      // Enable 2FA
      user.twoFactorAuth.enabled = true;
      await user.save();
      
      res.json({
        success: true,
        message: '2FA enabled successfully'
      });
    } catch (error) {
      res.status(500).json({
        success: false,
        message: 'Failed to verify 2FA',
        error: error.message
      });
    }
  }
);

/**
 * @route   POST /api/v1/users/2fa/disable
 * @desc    Disable 2FA
 * @access  Private
 */
router.post('/2fa/disable',
  authenticate,
  [body('token').isLength({ min: 6, max: 6 })],
  validate,
  async (req, res) => {
    try {
      const { token } = req.body;
      
      const user = await User.findById(req.user._id).select('+twoFactorAuth.secret');
      
      if (!user.twoFactorAuth.enabled) {
        return res.status(400).json({
          success: false,
          message: '2FA is not enabled'
        });
      }
      
      // Verify token before disabling
      const verified = speakeasy.totp.verify({
        secret: user.twoFactorAuth.secret,
        encoding: 'base32',
        token,
        window: 2
      });
      
      if (!verified) {
        return res.status(401).json({
          success: false,
          message: 'Invalid token'
        });
      }
      
      // Disable 2FA
      user.twoFactorAuth.enabled = false;
      user.twoFactorAuth.secret = undefined;
      await user.save();
      
      res.json({
        success: true,
        message: '2FA disabled successfully'
      });
    } catch (error) {
      res.status(500).json({
        success: false,
        message: 'Failed to disable 2FA',
        error: error.message
      });
    }
  }
);

/**
 * @route   GET /api/v1/users/me/purchases
 * @desc    Get user's purchased rules
 * @access  Private
 */
router.get('/me/purchases', authenticate, async (req, res) => {
  try {
    const Purchase = require('../models/Purchase');
    
    const purchases = await Purchase.find({ user: req.user._id, isActive: true })
      .populate('rule', 'title description queryLanguage vendor category')
      .sort('-createdAt');
    
    res.json({
      success: true,
      data: { purchases }
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Failed to fetch purchases',
      error: error.message
    });
  }
});

/**
 * @route   GET /api/v1/users/me/statistics
 * @desc    Get user statistics
 * @access  Private
 */
router.get('/me/statistics', authenticate, async (req, res) => {
  try {
    const stats = {
      totalRules: await Rule.countDocuments({ author: req.user._id, isActive: true }),
      publishedRules: await Rule.countDocuments({ author: req.user._id, status: 'APPROVED', isActive: true }),
      draftRules: await Rule.countDocuments({ author: req.user._id, status: 'DRAFT' }),
      pendingRules: await Rule.countDocuments({ author: req.user._id, status: 'PENDING_REVIEW' }),
      totalDownloads: req.user.statistics.totalDownloads,
      totalEarnings: req.user.statistics.totalEarnings,
      rating: req.user.statistics.rating
    };
    
    res.json({
      success: true,
      data: { statistics: stats }
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Failed to fetch statistics',
      error: error.message
    });
  }
});

module.exports = router;