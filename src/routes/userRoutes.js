// src/routes/userRoutes.js
const express = require("express");
const router = express.Router();
const { body, validationResult } = require("express-validator");
const speakeasy = require("speakeasy");
const QRCode = require("qrcode");
const userController = require("../controllers/userController");
const { authenticate, hasRole } = require("../middleware/auth");

const validate = (req, res, next) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({
      success: false,
      message: "Validation failed",
      errors: errors.array(),
    });
  }
  next();
};

/**
 * @route   GET /api/v1/users/profile
 * @desc    Get current user profile
 * @access  Private
 */
router.get("/profile", authenticate, userController.getProfile);

/**
 * @route   PUT /api/v1/users/profile
 * @desc    Update user profile
 * @access  Private
 */
router.put(
  "/profile",
  authenticate,
  [
    body("profile.firstName").optional().trim().isLength({ max: 50 }),
    body("profile.lastName").optional().trim().isLength({ max: 50 }),
    body("profile.bio").optional().trim().isLength({ max: 500 }),
    body("profile.organization").optional().trim(),
    body("profile.location").optional().trim(),
    body("profile.website").optional().isURL(),
  ],
  validate,
  userController.updateProfile,
);

/**
 * @route   POST /api/v1/users/password
 * @desc    Update user password
 * @access  Private
 */
router.post(
  "/password",
  authenticate,
  [
    body("currentPassword").notEmpty().withMessage("Current password required"),
    body("newPassword")
      .isLength({ min: 8 })
      .withMessage("Password must be at least 8 characters")
      .matches(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)/)
      .withMessage("Password must contain uppercase, lowercase, and number"),
  ],
  validate,
  userController.updatePassword,
);

/**
 * @route   POST /api/v1/users/password/reset-request
 * @desc    Request password reset
 * @access  Public
 */
router.post(
  "/password/reset-request",
  [body("email").isEmail().normalizeEmail()],
  validate,
  userController.requestPasswordReset,
);

/**
 * @route   POST /api/v1/users/password/reset
 * @desc    Reset password with token
 * @access  Public
 */
router.post(
  "/password/reset",
  [
    body("token").trim().notEmpty().withMessage("Reset token required"),
    body("newPassword")
      .isLength({ min: 8 })
      .withMessage("Password must be at least 8 characters")
      .matches(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)/)
      .withMessage("Password must contain uppercase, lowercase, and number"),
  ],
  validate,
  userController.resetPassword,
);

/**
 * @route   GET /api/v1/users/search
 * @desc    Search users
 * @access  Public
 */
router.get(
  "/search",
  [body("query").optional().trim()],
  userController.searchUsers,
);

/**
 * @route   GET /api/v1/users/:username
 * @desc    Get public user profile
 * @access  Public
 */
router.get("/:username", userController.getUserProfile);

/**
 * @route   GET /api/v1/users/:username/rules
 * @desc    Get user's created rules
 * @access  Public
 */
router.get(
  "/:username/rules",
  userController.getUserRules,
);

/**
 * @route   GET /api/v1/users/activity
 * @desc    Get user's activity history
 * @access  Private
 */
router.get(
  "/activity",
  authenticate,
  userController.getUserActivity,
);

/**
 * @route   GET /api/v1/users/notifications
 * @desc    Get user's notifications
 * @access  Private
 */
router.get(
  "/notifications",
  authenticate,
  userController.getNotifications,
);

/**
 * @route   POST /api/v1/users/notifications/:notificationId/read
 * @desc    Mark notification as read
 * @access  Private
 */
router.post(
  "/notifications/:notificationId/read",
  authenticate,
  userController.markNotificationAsRead,
);

/**
 * @route   POST /api/v1/users/notifications/read-all
 * @desc    Mark all notifications as read
 * @access  Private
 */
router.post(
  "/notifications/read-all",
  authenticate,
  userController.markAllNotificationsAsRead,
);

/**
 * @route   DELETE /api/v1/users/notifications/:notificationId
 * @desc    Delete notification
 * @access  Private
 */
router.delete(
  "/notifications/:notificationId",
  authenticate,
  userController.deleteNotification,
);

/**
 * @route   GET /api/v1/users/earnings
 * @desc    Get user's earnings (seller view)
 * @access  Private
 */
router.get(
  "/earnings",
  authenticate,
  userController.getEarnings,
);

/**
 * @route   GET /api/v1/users/me/purchases
 * @desc    Get user's purchased rules
 * @access  Private
 */
router.get("/me/purchases", authenticate, async (req, res) => {
  try {
    const Purchase = require("../models/Purchase");

    const purchases = await Purchase.find({
      user: req.user._id,
      isActive: true,
    })
      .populate("rule", "title description stats")
      .sort("-createdAt")
      .lean();

    res.json({
      success: true,
      data: { purchases },
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: "Failed to fetch purchases",
      error: error.message,
    });
  }
});

/**
 * @route   POST /api/v1/users/2fa/setup
 * @desc    Setup 2FA for user account
 * @access  Private
 */
router.post("/2fa/setup", authenticate, async (req, res) => {
  try {
    const user = await User.findById(req.user._id);

    if (user.requires2FA) {
      return res.status(400).json({
        success: false,
        message: "2FA is already enabled",
      });
    }

    // Generate secret
    const secret = speakeasy.generateSecret({
      name: `Security Rules (${req.user.email})`,
    });

    // Generate QR code
    const qrCode = await QRCode.toDataURL(secret.otpauth_url);

    res.json({
      success: true,
      data: {
        secret: secret.base32,
        qrCode,
        message:
          "Scan the QR code with your authenticator app and verify with a token",
      },
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: "Failed to setup 2FA",
      error: error.message,
    });
  }
});

/**
 * @route   POST /api/v1/users/2fa/verify
 * @desc    Verify and enable 2FA
 * @access  Private
 */
router.post(
  "/2fa/verify",
  authenticate,
  [body("token").isLength({ min: 6, max: 6 })],
  validate,
  async (req, res) => {
    try {
      const { token, secret } = req.body;

      // Verify token
      const verified = speakeasy.totp.verify({
        secret: secret,
        encoding: "base32",
        token,
        window: 2,
      });

      if (!verified) {
        return res.status(401).json({
          success: false,
          message: "Invalid token",
        });
      }

      // Enable 2FA
      const user = await User.findByIdAndUpdate(
        req.user._id,
        {
          requires2FA: true,
          twoFactorSecret: secret,
        },
        { new: true },
      );

      res.json({
        success: true,
        message: "2FA enabled successfully",
        data: { user },
      });
    } catch (error) {
      res.status(500).json({
        success: false,
        message: "Failed to verify 2FA",
        error: error.message,
      });
    }
  },
);

/**
 * @route   POST /api/v1/users/2fa/disable
 * @desc    Disable 2FA
 * @access  Private
 */
router.post(
  "/2fa/disable",
  authenticate,
  [body("token").isLength({ min: 6, max: 6 })],
  validate,
  async (req, res) => {
    try {
      const { token } = req.body;

      const user = await User.findById(req.user._id);

      if (!user.requires2FA) {
        return res.status(400).json({
          success: false,
          message: "2FA is not enabled",
        });
      }

      // Verify token before disabling
      const verified = speakeasy.totp.verify({
        secret: user.twoFactorSecret,
        encoding: "base32",
        token,
        window: 2,
      });

      if (!verified) {
        return res.status(401).json({
          success: false,
          message: "Invalid token",
        });
      }

      // Disable 2FA
      const updatedUser = await User.findByIdAndUpdate(
        req.user._id,
        {
          requires2FA: false,
          twoFactorSecret: undefined,
        },
        { new: true },
      );

      res.json({
        success: true,
        message: "2FA disabled successfully",
        data: { user: updatedUser },
      });
    } catch (error) {
      res.status(500).json({
        success: false,
        message: "Failed to disable 2FA",
        error: error.message,
      });
    }
  },
);

module.exports = router;
