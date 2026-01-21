// src/controllers/analyticsController.js
const User = require("../models/User");
const Rule = require("../models/Rule");
const Review = require("../models/Review");
const Transaction = require("../models/Transaction");
const Activity = require("../models/Activity");
const Purchase = require("../models/Purchase");
const { asyncHandler, errors } = require("../middleware/errorHandler");

/**
 * Get platform analytics overview
 */
exports.getPlatformAnalytics = asyncHandler(async (req, res) => {
  const { startDate = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000), endDate = new Date() } = req.query;

  const dateFilter = {
    createdAt: {
      $gte: new Date(startDate),
      $lte: new Date(endDate),
    },
  };

  // Get key metrics
  const [newUsers, newRules, newReviews, newTransactions] = await Promise.all([
    User.countDocuments(dateFilter),
    Rule.countDocuments(dateFilter),
    Review.countDocuments(dateFilter),
    Transaction.countDocuments({ ...dateFilter, status: "COMPLETED" }),
  ]);

  // Get revenue metrics
  const revenueData = await Transaction.aggregate([
    {
      $match: {
        status: "COMPLETED",
        createdAt: {
          $gte: new Date(startDate),
          $lte: new Date(endDate),
        },
      },
    },
    {
      $group: {
        _id: null,
        totalRevenue: { $sum: "$amount" },
        platformFees: { $sum: "$platformFee" },
        sellerPayouts: { $sum: "$sellerEarnings" },
        avgTransaction: { $avg: "$amount" },
      },
    },
  ]);

  // Get user growth
  const userGrowth = await User.aggregate([
    {
      $match: dateFilter,
    },
    {
      $group: {
        _id: { $dateToString: { format: "%Y-%m-%d", date: "$createdAt" } },
        count: { $sum: 1 },
      },
    },
    { $sort: { _id: 1 } },
  ]);

  res.json({
    success: true,
    data: {
      period: { startDate, endDate },
      metrics: {
        newUsers,
        newRules,
        newReviews,
        newTransactions,
      },
      revenue: revenueData[0] || {
        totalRevenue: 0,
        platformFees: 0,
        sellerPayouts: 0,
        avgTransaction: 0,
      },
      userGrowth,
    },
  });
});

/**
 * Get user behavior analytics
 */
exports.getUserBehaviorAnalytics = asyncHandler(async (req, res) => {
  const { startDate = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000), endDate = new Date() } = req.query;

  const dateFilter = {
    $gte: new Date(startDate),
    $lte: new Date(endDate),
  };

  // Get activity distribution
  const activityDistribution = await Activity.aggregate([
    {
      $match: {
        createdAt: dateFilter,
      },
    },
    {
      $group: {
        _id: "$type",
        count: { $sum: 1 },
      },
    },
    { $sort: { count: -1 } },
  ]);

  // Get user retention
  const userRetention = await User.aggregate([
    {
      $group: {
        _id: null,
        totalUsers: { $sum: 1 },
        activeUsers: {
          $sum: {
            $cond: [
              {
                $gte: [
                  "$lastLogin",
                  new Date(Date.now() - 7 * 24 * 60 * 60 * 1000),
                ],
              },
              1,
              0,
            ],
          },
        },
      },
    },
  ]);

  // Get rule engagement
  const ruleEngagement = await Rule.aggregate([
    {
      $group: {
        _id: null,
        avgDownloads: { $avg: "$stats.downloads" },
        avgRating: { $avg: "$stats.rating" },
        avgReviews: { $avg: "$stats.reviewCount" },
        avgPurchases: { $avg: "$stats.purchases" },
      },
    },
  ]);

  // Top activities by user
  const topUserActivities = await Activity.aggregate([
    {
      $match: {
        createdAt: dateFilter,
      },
    },
    {
      $group: {
        _id: "$user",
        activityCount: { $sum: 1 },
      },
    },
    { $sort: { activityCount: -1 } },
    { $limit: 10 },
    {
      $lookup: {
        from: "users",
        localField: "_id",
        foreignField: "_id",
        as: "user",
      },
    },
  ]);

  res.json({
    success: true,
    data: {
      period: { startDate, endDate },
      activityDistribution,
      userRetention: userRetention[0] || {
        totalUsers: 0,
        activeUsers: 0,
      },
      ruleEngagement: ruleEngagement[0] || {
        avgDownloads: 0,
        avgRating: 0,
        avgReviews: 0,
        avgPurchases: 0,
      },
      topUserActivities,
    },
  });
});

/**
 * Get rule analytics
 */
exports.getRuleAnalytics = asyncHandler(async (req, res) => {
  const { startDate = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000), endDate = new Date() } = req.query;

  const dateFilter = {
    createdAt: {
      $gte: new Date(startDate),
      $lte: new Date(endDate),
    },
  };

  // Get top rules by downloads
  const topRulesByDownloads = await Rule.find()
    .select("title slug stats creator")
    .populate("creator", "username")
    .sort({ "stats.downloads": -1 })
    .limit(10)
    .lean();

  // Get top rules by rating
  const topRulesByRating = await Rule.find({
    "stats.reviewCount": { $gt: 0 },
  })
    .select("title slug stats creator")
    .populate("creator", "username")
    .sort({ "stats.rating": -1 })
    .limit(10)
    .lean();

  // Get rules by status
  const rulesByStatus = await Rule.aggregate([
    {
      $group: {
        _id: "$status",
        count: { $sum: 1 },
      },
    },
  ]);

  // Get new rules trend
  const newRulesTrend = await Rule.aggregate([
    {
      $match: dateFilter,
    },
    {
      $group: {
        _id: { $dateToString: { format: "%Y-%m-%d", date: "$createdAt" } },
        count: { $sum: 1 },
      },
    },
    { $sort: { _id: 1 } },
  ]);

  // Get pricing distribution
  const pricingDistribution = await Rule.aggregate([
    {
      $group: {
        _id: "$pricing.type",
        count: { $sum: 1 },
        avgPrice: {
          $avg: {
            $cond: [{ $eq: ["$pricing.type", "PAID"] }, "$pricing.amount", 0],
          },
        },
      },
    },
  ]);

  res.json({
    success: true,
    data: {
      period: { startDate, endDate },
      topRulesByDownloads,
      topRulesByRating,
      rulesByStatus,
      newRulesTrend,
      pricingDistribution,
    },
  });
});

/**
 * Get transaction and revenue analytics
 */
exports.getRevenueAnalytics = asyncHandler(async (req, res) => {
  const { startDate = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000), endDate = new Date() } = req.query;

  const dateFilter = {
    createdAt: {
      $gte: new Date(startDate),
      $lte: new Date(endDate),
    },
  };

  // Get revenue trend
  const revenueTrend = await Transaction.aggregate([
    {
      $match: {
        ...dateFilter,
        status: "COMPLETED",
      },
    },
    {
      $group: {
        _id: { $dateToString: { format: "%Y-%m-%d", date: "$createdAt" } },
        revenue: { $sum: "$amount" },
        platformFees: { $sum: "$platformFee" },
        sellerPayouts: { $sum: "$sellerEarnings" },
        transactions: { $sum: 1 },
      },
    },
    { $sort: { _id: 1 } },
  ]);

  // Get payment method distribution
  const paymentMethodDistribution = await Transaction.aggregate([
    {
      $match: {
        ...dateFilter,
        status: "COMPLETED",
      },
    },
    {
      $group: {
        _id: "$paymentMethod",
        count: { $sum: 1 },
        totalAmount: { $sum: "$amount" },
      },
    },
  ]);

  // Get refund statistics
  const refundStats = await Transaction.aggregate([
    {
      $match: dateFilter,
    },
    {
      $group: {
        _id: "$status",
        count: { $sum: 1 },
        totalAmount: {
          $sum: { $cond: [{ $eq: ["$status", "REFUNDED"] }, "$amount", 0] },
        },
      },
    },
  ]);

  // Get top sellers
  const topSellers = await Transaction.aggregate([
    {
      $match: {
        ...dateFilter,
        status: "COMPLETED",
      },
    },
    {
      $group: {
        _id: "$seller",
        totalEarnings: { $sum: "$sellerEarnings" },
        transactionCount: { $sum: 1 },
      },
    },
    { $sort: { totalEarnings: -1 } },
    { $limit: 10 },
    {
      $lookup: {
        from: "users",
        localField: "_id",
        foreignField: "_id",
        as: "user",
      },
    },
  ]);

  res.json({
    success: true,
    data: {
      period: { startDate, endDate },
      revenueTrend,
      paymentMethodDistribution,
      refundStats,
      topSellers,
    },
  });
});

/**
 * Get review analytics
 */
exports.getReviewAnalytics = asyncHandler(async (req, res) => {
  const { startDate = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000), endDate = new Date() } = req.query;

  const dateFilter = {
    createdAt: {
      $gte: new Date(startDate),
      $lte: new Date(endDate),
    },
  };

  // Get rating distribution
  const ratingDistribution = await Review.aggregate([
    {
      $match: {
        ...dateFilter,
        isActive: true,
      },
    },
    {
      $group: {
        _id: "$rating",
        count: { $sum: 1 },
      },
    },
    { $sort: { _id: 1 } },
  ]);

  // Get review trend
  const reviewTrend = await Review.aggregate([
    {
      $match: {
        ...dateFilter,
        isActive: true,
      },
    },
    {
      $group: {
        _id: { $dateToString: { format: "%Y-%m-%d", date: "$createdAt" } },
        count: { $sum: 1 },
      },
    },
    { $sort: { _id: 1 } },
  ]);

  // Get review statistics
  const reviewStats = await Review.aggregate([
    {
      $match: {
        ...dateFilter,
        isActive: true,
      },
    },
    {
      $group: {
        _id: null,
        totalReviews: { $sum: 1 },
        avgRating: { $avg: "$rating" },
        verifiedReviews: {
          $sum: { $cond: ["$verified", 1, 0] },
        },
        reportedReviews: {
          $sum: { $cond: ["$reported", 1, 0] },
        },
      },
    },
  ]);

  // Get most helpful reviews
  const mostHelpfulReviews = await Review.find({
    ...dateFilter,
    isActive: true,
  })
    .select("comment rating helpful rule user")
    .populate("user", "username")
    .populate("rule", "title")
    .sort({ "helpful.count": -1 })
    .limit(10)
    .lean();

  res.json({
    success: true,
    data: {
      period: { startDate, endDate },
      ratingDistribution,
      reviewTrend,
      reviewStats: reviewStats[0] || {
        totalReviews: 0,
        avgRating: 0,
        verifiedReviews: 0,
        reportedReviews: 0,
      },
      mostHelpfulReviews,
    },
  });
});

/**
 * Generate custom report
 */
exports.generateCustomReport = asyncHandler(async (req, res) => {
  const { reportType, startDate, endDate, filters = {} } = req.body;

  if (!reportType) {
    throw errors.badRequest("reportType is required");
  }

  const dateFilter = {
    createdAt: {
      $gte: new Date(startDate),
      $lte: new Date(endDate),
    },
  };

  let report;

  switch (reportType) {
    case "user_activity":
      report = await generateUserActivityReport(dateFilter, filters);
      break;
    case "rule_performance":
      report = await generateRulePerformanceReport(dateFilter, filters);
      break;
    case "revenue_breakdown":
      report = await generateRevenueBreakdownReport(dateFilter, filters);
      break;
    case "user_growth":
      report = await generateUserGrowthReport(dateFilter, filters);
      break;
    default:
      throw errors.badRequest("Invalid reportType");
  }

  res.json({
    success: true,
    data: {
      reportType,
      period: { startDate, endDate },
      generatedAt: new Date(),
      report,
    },
  });
});

// Helper functions for report generation

async function generateUserActivityReport(dateFilter, filters) {
  return await Activity.aggregate([
    {
      $match: {
        ...dateFilter,
        ...(filters.userId && { user: filters.userId }),
      },
    },
    {
      $group: {
        _id: "$type",
        count: { $sum: 1 },
      },
    },
  ]);
}

async function generateRulePerformanceReport(dateFilter, filters) {
  return await Rule.aggregate([
    {
      $match: {
        ...dateFilter,
        ...(filters.creator && { creator: filters.creator }),
      },
    },
    {
      $project: {
        title: 1,
        downloads: "$stats.downloads",
        purchases: "$stats.purchases",
        rating: "$stats.rating",
        reviews: "$stats.reviewCount",
        revenue: "$stats.revenue",
      },
    },
    {
      $sort: { revenue: -1 },
    },
  ]);
}

async function generateRevenueBreakdownReport(dateFilter, filters) {
  return await Transaction.aggregate([
    {
      $match: {
        ...dateFilter,
        status: "COMPLETED",
        ...(filters.paymentMethod && { paymentMethod: filters.paymentMethod }),
      },
    },
    {
      $group: {
        _id: {
          date: { $dateToString: { format: "%Y-%m-%d", date: "$createdAt" } },
          method: "$paymentMethod",
        },
        revenue: { $sum: "$amount" },
        platformFees: { $sum: "$platformFee" },
        count: { $sum: 1 },
      },
    },
    { $sort: { "_id.date": 1 } },
  ]);
}

async function generateUserGrowthReport(dateFilter, filters) {
  return await User.aggregate([
    {
      $match: {
        ...dateFilter,
        ...(filters.role && { role: filters.role }),
      },
    },
    {
      $group: {
        _id: { $dateToString: { format: "%Y-%m-%d", date: "$createdAt" } },
        newUsers: { $sum: 1 },
      },
    },
    { $sort: { _id: 1 } },
  ]);
}

/**
 * Export report to CSV
 */
exports.exportReport = asyncHandler(async (req, res) => {
  const { reportType, startDate, endDate } = req.query;

  if (!reportType) {
    throw errors.badRequest("reportType is required");
  }

  const dateFilter = {
    createdAt: {
      $gte: new Date(startDate),
      $lte: new Date(endDate),
    },
  };

  let data;
  let filename;

  switch (reportType) {
    case "transactions":
      data = await Transaction.find(dateFilter)
        .select("buyer seller rule amount status createdAt")
        .populate("buyer", "username email")
        .populate("seller", "username email")
        .populate("rule", "title")
        .lean();
      filename = `transactions_${startDate}_${endDate}.csv`;
      break;
    case "users":
      data = await User.find(dateFilter)
        .select("username email role createdAt statistics")
        .lean();
      filename = `users_${startDate}_${endDate}.csv`;
      break;
    case "rules":
      data = await Rule.find(dateFilter)
        .select("title status stats creator createdAt")
        .populate("creator", "username")
        .lean();
      filename = `rules_${startDate}_${endDate}.csv`;
      break;
    default:
      throw errors.badRequest("Invalid reportType");
  }

  // Convert to CSV
  const csv = convertToCSV(data);

  res.setHeader("Content-Type", "text/csv");
  res.setHeader("Content-Disposition", `attachment; filename="${filename}"`);
  res.send(csv);
});

function convertToCSV(data) {
  if (!data || data.length === 0) return "";

  const keys = Object.keys(data[0]);
  const csv = [
    keys.join(","),
    ...data.map((row) =>
      keys
        .map((key) => {
          const value = row[key];
          if (typeof value === "object") {
            return JSON.stringify(value);
          }
          return String(value).includes(",") ? `"${value}"` : value;
        })
        .join(",")
    ),
  ];

  return csv.join("\n");
}
