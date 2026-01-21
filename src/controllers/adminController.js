// src/controllers/adminController.js
const User = require("../models/User");
const Rule = require("../models/Rule");
const Review = require("../models/Review");
const Transaction = require("../models/Transaction");
const Notification = require("../models/Notification");
const Activity = require("../models/Activity");
const { asyncHandler, errors } = require("../middleware/errorHandler");

/**
 * Get dashboard overview metrics
 */
exports.getDashboardOverview = asyncHandler(async (req, res) => {
  const [
    totalUsers,
    totalRules,
    totalReviews,
    totalTransactions,
    activeUsers,
    pendingRules,
  ] = await Promise.all([
    User.countDocuments(),
    Rule.countDocuments(),
    Review.countDocuments({ isActive: true }),
    Transaction.countDocuments(),
    User.countDocuments({ lastLogin: { $gte: new Date(Date.now() - 24 * 60 * 60 * 1000) } }),
    Rule.countDocuments({ status: "PENDING_REVIEW" }),
  ]);

  // Get revenue data
  const revenueData = await Transaction.aggregate([
    {
      $match: { status: "COMPLETED" },
    },
    {
      $group: {
        _id: null,
        totalRevenue: { $sum: "$amount" },
        platformFees: { $sum: "$platformFee" },
        sellerPayouts: { $sum: "$sellerEarnings" },
        transactionCount: { $sum: 1 },
      },
    },
  ]);

  // Get top rules
  const topRules = await Rule.find()
    .select("title stats creator")
    .sort({ "stats.downloads": -1 })
    .limit(5)
    .populate("creator", "username email")
    .lean();

  // Get recent activity
  const recentActivity = await Activity.find()
    .populate("user", "username")
    .sort({ createdAt: -1 })
    .limit(10)
    .lean();

  res.json({
    success: true,
    data: {
      overview: {
        totalUsers,
        totalRules,
        totalReviews,
        totalTransactions,
        activeUsers,
        pendingRules,
      },
      revenue: revenueData[0] || {
        totalRevenue: 0,
        platformFees: 0,
        sellerPayouts: 0,
        transactionCount: 0,
      },
      topRules,
      recentActivity,
    },
  });
});

/**
 * Get user management data
 */
exports.getUserManagement = asyncHandler(async (req, res) => {
  const { page = 1, limit = 20, role, status } = req.query;
  const skip = (page - 1) * limit;

  let query = {};
  if (role) query.role = role;
  if (status === "active") query.lastLogin = { $gte: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000) };
  if (status === "inactive") query.lastLogin = { $lt: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000) };

  const users = await User.find(query)
    .select("username email role emailVerified profile lastLogin createdAt statistics")
    .skip(skip)
    .limit(parseInt(limit))
    .sort({ createdAt: -1 })
    .lean();

  const total = await User.countDocuments(query);

  // Get user breakdown by role
  const roleDistribution = await User.aggregate([
    {
      $group: {
        _id: "$role",
        count: { $sum: 1 },
      },
    },
  ]);

  res.json({
    success: true,
    data: {
      users,
      roleDistribution,
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
 * Get rule moderation data
 */
exports.getRuleModeration = asyncHandler(async (req, res) => {
  const { page = 1, limit = 20, status } = req.query;
  const skip = (page - 1) * limit;

  let query = {};
  if (status) query.status = status;

  const rules = await Rule.find(query)
    .select("title slug status creator stats createdAt")
    .populate("creator", "username email")
    .skip(skip)
    .limit(parseInt(limit))
    .sort({ createdAt: -1 })
    .lean();

  const total = await Rule.countDocuments(query);

  const statusDistribution = await Rule.aggregate([
    {
      $group: {
        _id: "$status",
        count: { $sum: 1 },
      },
    },
  ]);

  res.json({
    success: true,
    data: {
      rules,
      statusDistribution,
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
 * Approve or reject a rule
 */
exports.moderateRule = asyncHandler(async (req, res) => {
  const { ruleId } = req.params;
  const { approved, reason } = req.body;

  const rule = await Rule.findById(ruleId);
  if (!rule) {
    throw errors.notFound("Rule not found");
  }

  if (approved) {
    rule.status = "PUBLISHED";
    rule.publishedAt = new Date();

    // Create notification for rule creator
    await Notification.create({
      recipient: rule.creator,
      type: "RULE_APPROVED",
      title: "Rule Approved",
      message: `Your rule "${rule.title}" has been approved and published!`,
      data: { ruleId: rule._id },
      actionUrl: `/rules/${rule.slug}`,
    });
  } else {
    rule.status = "REJECTED";
    rule.rejectionReason = reason;

    // Create notification for rule creator
    await Notification.create({
      recipient: rule.creator,
      type: "RULE_REJECTED",
      title: "Rule Rejected",
      message: `Your rule "${rule.title}" was rejected. Reason: ${reason}`,
      data: { ruleId: rule._id, reason },
    });
  }

  await rule.save();

  res.json({
    success: true,
    message: approved ? "Rule approved" : "Rule rejected",
    data: { rule },
  });
});

/**
 * Get review moderation data
 */
exports.getReviewModeration = asyncHandler(async (req, res) => {
  const { page = 1, limit = 20 } = req.query;
  const skip = (page - 1) * limit;

  const reportedReviews = await Review.find({ reported: true })
    .populate("user", "username email")
    .populate("rule", "title")
    .skip(skip)
    .limit(parseInt(limit))
    .sort({ createdAt: -1 })
    .lean();

  const total = await Review.countDocuments({ reported: true });

  res.json({
    success: true,
    data: {
      reviews: reportedReviews,
      total,
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
 * Take action on reported review
 */
exports.reviewModerationAction = asyncHandler(async (req, res) => {
  const { reviewId } = req.params;
  const { action } = req.body; // approve, remove

  const review = await Review.findById(reviewId);
  if (!review) {
    throw errors.notFound("Review not found");
  }

  if (action === "remove") {
    review.isActive = false;
  } else if (action === "approve") {
    review.reported = false;
  }

  await review.save();

  res.json({
    success: true,
    message: `Review ${action}d successfully`,
    data: { review },
  });
});

/**
 * Manage user roles
 */
exports.updateUserRole = asyncHandler(async (req, res) => {
  const { userId } = req.params;
  const { role } = req.body;

  const validRoles = ["USER", "VERIFIED_CONTRIBUTOR", "MODERATOR", "ADMIN"];
  if (!validRoles.includes(role)) {
    throw errors.badRequest("Invalid role");
  }

  const user = await User.findByIdAndUpdate(
    userId,
    { role },
    { new: true }
  ).select("-password -refreshTokens");

  if (!user) {
    throw errors.notFound("User not found");
  }

  // Create activity log
  await Activity.create({
    user: req.user._id,
    type: "ADMIN_ACTION",
    target: userId,
    targetModel: "User",
    metadata: {
      action: "role_updated",
      oldRole: user.role,
      newRole: role,
    },
  });

  res.json({
    success: true,
    message: "User role updated",
    data: { user },
  });
});

/**
 * Suspend or ban user
 */
exports.suspendUser = asyncHandler(async (req, res) => {
  const { userId } = req.params;
  const { reason, duration } = req.body;

  const user = await User.findById(userId);
  if (!user) {
    throw errors.notFound("User not found");
  }

  user.suspended = true;
  user.suspensionReason = reason;
  user.suspensionUntil = duration ? new Date(Date.now() + duration * 24 * 60 * 60 * 1000) : null;

  await user.save();

  // Create notification
  await Notification.create({
    recipient: userId,
    type: "SYSTEM",
    title: "Account Suspended",
    message: `Your account has been suspended. Reason: ${reason}`,
  });

  res.json({
    success: true,
    message: "User suspended",
    data: { user },
  });
});

/**
 * Unsuspend user
 */
exports.unsuspendUser = asyncHandler(async (req, res) => {
  const { userId } = req.params;

  const user = await User.findByIdAndUpdate(
    userId,
    {
      suspended: false,
      suspensionReason: null,
      suspensionUntil: null,
    },
    { new: true }
  );

  if (!user) {
    throw errors.notFound("User not found");
  }

  res.json({
    success: true,
    message: "User unsuspended",
    data: { user },
  });
});

/**
 * Get system logs
 */
exports.getSystemLogs = asyncHandler(async (req, res) => {
  const { page = 1, limit = 50, type, userId } = req.query;
  const skip = (page - 1) * limit;

  let query = {};
  if (type) query.type = type;
  if (userId) query.user = userId;

  const logs = await Activity.find(query)
    .populate("user", "username email")
    .populate("target")
    .skip(skip)
    .limit(parseInt(limit))
    .sort({ createdAt: -1 })
    .lean();

  const total = await Activity.countDocuments(query);

  res.json({
    success: true,
    data: {
      logs,
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
 * Get admin actions log
 */
exports.getAdminActions = asyncHandler(async (req, res) => {
  const { page = 1, limit = 50 } = req.query;
  const skip = (page - 1) * limit;

  const actions = await Activity.find({ type: "ADMIN_ACTION" })
    .populate("user", "username email")
    .skip(skip)
    .limit(parseInt(limit))
    .sort({ createdAt: -1 })
    .lean();

  const total = await Activity.countDocuments({ type: "ADMIN_ACTION" });

  res.json({
    success: true,
    data: {
      actions,
      pagination: {
        total,
        page: parseInt(page),
        limit: parseInt(limit),
        pages: Math.ceil(total / limit),
      },
    },
  });
});
