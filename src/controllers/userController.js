// src/controllers/userController.js
const User = require("../models/User");
const Rule = require("../models/Rule");
const Activity = require("../models/Activity");
const Transaction = require("../models/Transaction");
const Notification = require("../models/Notification");
const { asyncHandler, errors } = require("../middleware/errorHandler");
const { sendPasswordResetEmail } = require("../utils/email");
const crypto = require("crypto");

/**
 * Get current user profile
 */
exports.getProfile = asyncHandler(async (req, res) => {
  const user = await User.findById(req.user._id).select(
    "-password -refreshTokens -emailVerificationToken -passwordResetToken",
  );

  if (!user) {
    throw errors.notFound("User not found");
  }

  res.json({
    success: true,
    data: { user },
  });
});

/**
 * Update user profile
 */
exports.updateProfile = asyncHandler(async (req, res) => {
  const { profile } = req.body;

  const user = await User.findById(req.user._id);
  if (!user) {
    throw errors.notFound("User not found");
  }

  if (profile) {
    Object.assign(user.profile, profile);
  }

  await user.save();

  res.json({
    success: true,
    message: "Profile updated successfully",
    data: { user },
  });
});

/**
 * Get public user profile
 */
exports.getUserProfile = asyncHandler(async (req, res) => {
  const { username } = req.params;

  const user = await User.findOne({ username }).select(
    "username profile statistics createdAt role",
  );

  if (!user) {
    throw errors.notFound("User not found");
  }

  // Get user's public stats
  const rulesCreated = await Rule.countDocuments({
    creator: user._id,
    status: "PUBLISHED",
  });

  res.json({
    success: true,
    data: {
      user: {
        ...user.toObject(),
        rulesCreated,
      },
    },
  });
});

/**
 * Update password
 */
exports.updatePassword = asyncHandler(async (req, res) => {
  const { currentPassword, newPassword } = req.body;

  if (!currentPassword || !newPassword) {
    throw errors.badRequest(
      "Current password and new password are required",
    );
  }

  const user = await User.findById(req.user._id).select("+password");

  // Verify current password
  const isPasswordValid = await user.validatePassword(currentPassword);
  if (!isPasswordValid) {
    throw errors.unauthorized("Current password is incorrect");
  }

  // Update password
  user.password = newPassword;
  await user.save();

  res.json({
    success: true,
    message: "Password updated successfully",
  });
});

/**
 * Request password reset
 */
exports.requestPasswordReset = asyncHandler(async (req, res) => {
  const { email } = req.body;

  const user = await User.findOne({ email: email.toLowerCase() });
  if (!user) {
    // Don't reveal if email exists
    return res.json({
      success: true,
      message: "If email exists, password reset link has been sent",
    });
  }

  // Generate reset token
  const resetToken = crypto.randomBytes(32).toString("hex");
  user.passwordResetToken = crypto
    .createHash("sha256")
    .update(resetToken)
    .digest("hex");
  user.passwordResetExpires = new Date(Date.now() + 60 * 60 * 1000); // 1 hour

  await user.save();

  // Send email
  await sendPasswordResetEmail(user.email, resetToken).catch((err) => {
    console.error("Failed to send password reset email:", err.message);
  });

  res.json({
    success: true,
    message: "If email exists, password reset link has been sent",
  });
});

/**
 * Reset password with token
 */
exports.resetPassword = asyncHandler(async (req, res) => {
  const { token, newPassword } = req.body;

  if (!token || !newPassword) {
    throw errors.badRequest("Token and new password are required");
  }

  const hashedToken = crypto.createHash("sha256").update(token).digest("hex");

  const user = await User.findOne({
    passwordResetToken: hashedToken,
    passwordResetExpires: { $gt: Date.now() },
  });

  if (!user) {
    throw errors.badRequest("Invalid or expired reset token");
  }

  user.password = newPassword;
  user.passwordResetToken = undefined;
  user.passwordResetExpires = undefined;

  await user.save();

  res.json({
    success: true,
    message: "Password reset successfully",
  });
});

/**
 * Get user's created rules
 */
exports.getUserRules = asyncHandler(async (req, res) => {
  const { username } = req.params;
  const { page = 1, limit = 10, status = "PUBLISHED" } = req.query;

  const user = await User.findOne({ username });
  if (!user) {
    throw errors.notFound("User not found");
  }

  const skip = (page - 1) * limit;
  let query = { creator: user._id };

  if (status === "PUBLISHED") {
    query.status = "PUBLISHED";
  } else if (req.user && req.user._id.toString() === user._id.toString()) {
    // Show all statuses for own user
  } else {
    query.status = "PUBLISHED";
  }

  const rules = await Rule.find(query)
    .select("title slug description stats pricing createdAt")
    .sort({ createdAt: -1 })
    .skip(skip)
    .limit(parseInt(limit))
    .lean();

  const total = await Rule.countDocuments(query);

  res.json({
    success: true,
    data: {
      rules,
      pagination: {
        total,
        page: parseInt(page),
        limit: parseInt(limit),
        pages: Math.ceil(total / limit),
      },
    },
  });
});

/**
 * Get user's activities
 */
exports.getUserActivity = asyncHandler(async (req, res) => {
  const { page = 1, limit = 20 } = req.query;
  const skip = (page - 1) * limit;

  const activities = await Activity.find({ user: req.user._id })
    .populate("target")
    .sort({ createdAt: -1 })
    .skip(skip)
    .limit(parseInt(limit))
    .lean();

  const total = await Activity.countDocuments({ user: req.user._id });

  res.json({
    success: true,
    data: {
      activities,
      pagination: {
        total,
        page: parseInt(page),
        limit: parseInt(limit),
        pages: Math.ceil(total / limit),
      },
    },
  });
});

/**
 * Get user's notifications
 */
exports.getNotifications = asyncHandler(async (req, res) => {
  const { page = 1, limit = 20, unread = null } = req.query;
  const skip = (page - 1) * limit;

  let query = { recipient: req.user._id };
  if (unread === "true") {
    query.isRead = false;
  }

  const notifications = await Notification.find(query)
    .sort({ createdAt: -1 })
    .skip(skip)
    .limit(parseInt(limit))
    .lean();

  const total = await Notification.countDocuments(query);
  const unreadCount = await Notification.countDocuments({
    recipient: req.user._id,
    isRead: false,
  });

  res.json({
    success: true,
    data: {
      notifications,
      unreadCount,
      pagination: {
        total,
        page: parseInt(page),
        limit: parseInt(limit),
        pages: Math.ceil(total / limit),
      },
    },
  });
});

/**
 * Mark notification as read
 */
exports.markNotificationAsRead = asyncHandler(async (req, res) => {
  const { notificationId } = req.params;

  const notification = await Notification.findOne({
    _id: notificationId,
    recipient: req.user._id,
  });

  if (!notification) {
    throw errors.notFound("Notification not found");
  }

  notification.isRead = true;
  notification.readAt = new Date();
  await notification.save();

  res.json({
    success: true,
    message: "Notification marked as read",
  });
});

/**
 * Mark all notifications as read
 */
exports.markAllNotificationsAsRead = asyncHandler(async (req, res) => {
  await Notification.updateMany(
    { recipient: req.user._id, isRead: false },
    { isRead: true, readAt: new Date() },
  );

  res.json({
    success: true,
    message: "All notifications marked as read",
  });
});

/**
 * Delete notification
 */
exports.deleteNotification = asyncHandler(async (req, res) => {
  const { notificationId } = req.params;

  const result = await Notification.deleteOne({
    _id: notificationId,
    recipient: req.user._id,
  });

  if (result.deletedCount === 0) {
    throw errors.notFound("Notification not found");
  }

  res.json({
    success: true,
    message: "Notification deleted",
  });
});

/**
 * Get earnings (for sellers)
 */
exports.getEarnings = asyncHandler(async (req, res) => {
  const { period = "month" } = req.query;

  let dateFilter;
  const now = new Date();

  if (period === "week") {
    dateFilter = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
  } else if (period === "month") {
    dateFilter = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
  } else if (period === "year") {
    dateFilter = new Date(now.getTime() - 365 * 24 * 60 * 60 * 1000);
  } else {
    dateFilter = new Date(0);
  }

  const transactions = await Transaction.find({
    seller: req.user._id,
    status: "COMPLETED",
    createdAt: { $gte: dateFilter },
  }).lean();

  const totalEarnings = transactions.reduce(
    (sum, t) => sum + (t.sellerEarnings || 0),
    0,
  );
  const totalTransactions = transactions.length;

  const earningsByDay = {};
  transactions.forEach((t) => {
    const day = t.createdAt.toISOString().split("T")[0];
    earningsByDay[day] = (earningsByDay[day] || 0) + (t.sellerEarnings || 0);
  });

  res.json({
    success: true,
    data: {
      totalEarnings,
      totalTransactions,
      period,
      earningsByDay,
      transactions: transactions.slice(0, 10),
    },
  });
});

/**
 * Search users
 */
exports.searchUsers = asyncHandler(async (req, res) => {
  const { query = "", limit = 10 } = req.query;

  if (query.length < 2) {
    return res.json({
      success: true,
      data: { users: [] },
    });
  }

  const users = await User.find({
    $or: [
      { username: { $regex: query, $options: "i" } },
      { "profile.firstName": { $regex: query, $options: "i" } },
      { "profile.lastName": { $regex: query, $options: "i" } },
    ],
  })
    .select("username profile avatar")
    .limit(parseInt(limit))
    .lean();

  res.json({
    success: true,
    data: { users },
  });
});

/**
 * Get user statistics
 */
exports.getUserStats = asyncHandler(async (req, res) => {
  const user = await User.findById(req.user._id);

  if (!user) {
    throw errors.notFound("User not found");
  }

  // Count rules created
  const rulesCreated = await Rule.countDocuments({
    creator: req.user._id,
    status: "PUBLISHED",
  });

  // Count reviews written
  const reviewsWritten = await Rule.countDocuments({
    creator: req.user._id,
  }); // Placeholder - should count from Review model

  // Get total earnings
  const earnings = await Transaction.aggregate([
    {
      $match: {
        seller: req.user._id,
        status: "COMPLETED",
      },
    },
    {
      $group: {
        _id: null,
        total: { $sum: "$sellerEarnings" },
        count: { $sum: 1 },
      },
    },
  ]);

  res.json({
    success: true,
    data: {
      rulesCreated,
      reviewsWritten,
      totalEarnings: earnings[0]?.total || 0,
      totalTransactions: earnings[0]?.count || 0,
    },
  });
});
