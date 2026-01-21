// src/controllers/transactionController.js
const Transaction = require("../models/Transaction");
const Purchase = require("../models/Purchase");
const Rule = require("../models/Rule");
const User = require("../models/User");
const Notification = require("../models/Notification");
const { asyncHandler, errors } = require("../middleware/errorHandler");
const crypto = require("crypto");

/**
 * Get all transactions (admin only)
 */
exports.getAllTransactions = asyncHandler(async (req, res) => {
  const { page = 1, limit = 20, status, paymentMethod } = req.query;
  const skip = (page - 1) * limit;

  let query = {};
  if (status) query.status = status;
  if (paymentMethod) query.paymentMethod = paymentMethod;

  const transactions = await Transaction.find(query)
    .populate("buyer", "username email")
    .populate("seller", "username email")
    .populate("rule", "title slug")
    .sort({ createdAt: -1 })
    .skip(skip)
    .limit(parseInt(limit))
    .lean();

  const total = await Transaction.countDocuments(query);

  res.json({
    success: true,
    data: {
      transactions,
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
 * Get current user's transactions
 */
exports.getMyTransactions = asyncHandler(async (req, res) => {
  const { page = 1, limit = 20, type = "all" } = req.query;
  const skip = (page - 1) * limit;

  let query;

  if (type === "purchases") {
    query = { buyer: req.user._id };
  } else if (type === "sales") {
    query = { seller: req.user._id };
  } else {
    query = {
      $or: [{ buyer: req.user._id }, { seller: req.user._id }],
    };
  }

  const transactions = await Transaction.find(query)
    .populate("buyer", "username email")
    .populate("seller", "username email")
    .populate("rule", "title slug")
    .sort({ createdAt: -1 })
    .skip(skip)
    .limit(parseInt(limit))
    .lean();

  const total = await Transaction.countDocuments(query);

  res.json({
    success: true,
    data: {
      transactions,
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
 * Get single transaction
 */
exports.getTransaction = asyncHandler(async (req, res) => {
  const { id } = req.params;

  const transaction = await Transaction.findById(id)
    .populate("buyer", "username email profile")
    .populate("seller", "username email profile")
    .populate("rule", "title slug");

  if (!transaction) {
    throw errors.notFound("Transaction not found");
  }

  // Check authorization
  if (
    transaction.buyer._id.toString() !== req.user._id.toString() &&
    transaction.seller._id.toString() !== req.user._id.toString() &&
    req.user.role !== "ADMIN"
  ) {
    throw errors.forbidden("You do not have access to this transaction");
  }

  res.json({
    success: true,
    data: { transaction },
  });
});

/**
 * Purchase a rule
 */
exports.purchaseRule = asyncHandler(async (req, res) => {
  const { ruleId, paymentMethodId } = req.body;

  // Validate rule exists
  const rule = await Rule.findById(ruleId);
  if (!rule) {
    throw errors.notFound("Rule not found");
  }

  // Check if rule is paid
  if (!rule.pricing || rule.pricing.type !== "PAID") {
    throw errors.badRequest("This rule is not for sale");
  }

  // Check if already purchased
  const existingPurchase = await Purchase.findOne({
    user: req.user._id,
    rule: ruleId,
    isActive: true,
  });

  if (existingPurchase) {
    throw errors.conflict("You have already purchased this rule");
  }

  // Check if buyer is seller
  if (rule.creator.toString() === req.user._id.toString()) {
    throw errors.badRequest("You cannot purchase your own rule");
  }

  const amount = rule.pricing.amount;
  const platformFeePercent = 0.1; // 10% platform fee
  const platformFee = amount * platformFeePercent;
  const sellerEarnings = amount - platformFee;

  // Create transaction
  const transaction = new Transaction({
    buyer: req.user._id,
    seller: rule.creator,
    rule: ruleId,
    amount,
    currency: "USD",
    paymentMethod: "STRIPE", // Placeholder
    status: "COMPLETED", // Placeholder - in real app, would wait for payment
    paymentIntentId: paymentMethodId || crypto.randomBytes(16).toString("hex"),
    platformFee,
    sellerEarnings,
    metadata: {
      ruleTitle: rule.title,
      buyerEmail: req.user.email,
      sellerEmail: rule.creator.email,
    },
  });

  await transaction.save();

  // Create purchase record
  const purchase = new Purchase({
    user: req.user._id,
    rule: ruleId,
    transaction: transaction._id,
    licenseKey: crypto.randomBytes(16).toString("hex").toUpperCase(),
  });

  await purchase.save();

  // Update rule statistics
  rule.stats.purchases = (rule.stats.purchases || 0) + 1;
  rule.stats.revenue = (rule.stats.revenue || 0) + amount;
  await rule.save();

  // Create notification for seller
  await Notification.create({
    recipient: rule.creator,
    type: "RULE_PURCHASED",
    title: "Your rule was purchased",
    message: `${req.user.username} purchased "${rule.title}"`,
    data: {
      transactionId: transaction._id,
      ruleId: rule._id,
      buyerId: req.user._id,
    },
    actionUrl: `/transactions/${transaction._id}`,
  });

  // Create notification for buyer
  await Notification.create({
    recipient: req.user._id,
    type: "RULE_PURCHASED",
    title: "Purchase successful",
    message: `You successfully purchased "${rule.title}"`,
    data: {
      transactionId: transaction._id,
      ruleId: rule._id,
      licenseKey: purchase.licenseKey,
    },
    actionUrl: `/rules/${rule.slug}/download`,
  });

  await transaction.populate("rule", "title slug");

  res.status(201).json({
    success: true,
    message: "Purchase completed successfully",
    data: {
      transaction,
      purchase,
      licenseKey: purchase.licenseKey,
    },
  });
});

/**
 * Request refund
 */
exports.requestRefund = asyncHandler(async (req, res) => {
  const { id } = req.params;
  const { reason } = req.body;

  if (!reason) {
    throw errors.badRequest("Refund reason is required");
  }

  const transaction = await Transaction.findById(id);
  if (!transaction) {
    throw errors.notFound("Transaction not found");
  }

  // Check authorization
  if (transaction.buyer.toString() !== req.user._id.toString()) {
    throw errors.forbidden("Only the buyer can request a refund");
  }

  // Check transaction status
  if (transaction.status !== "COMPLETED") {
    throw errors.badRequest(
      "Refund can only be requested for completed transactions",
    );
  }

  // Check time limit (e.g., 30 days)
  const daysSince = (Date.now() - transaction.createdAt) / (1000 * 60 * 60 * 24);
  if (daysSince > 30) {
    throw errors.badRequest("Refund requests can only be made within 30 days");
  }

  transaction.status = "DISPUTED";
  transaction.metadata = {
    ...transaction.metadata,
    refundReason: reason,
    refundRequestedAt: new Date(),
    refundRequestedBy: req.user._id,
  };

  await transaction.save();

  // Create notifications
  await Notification.create({
    recipient: transaction.buyer,
    type: "SYSTEM",
    title: "Refund request submitted",
    message: "Your refund request has been received and is under review",
    actionUrl: `/transactions/${transaction._id}`,
  });

  res.json({
    success: true,
    message: "Refund request submitted successfully",
    data: { transaction },
  });
});

/**
 * Process refund (admin only)
 */
exports.processRefund = asyncHandler(async (req, res) => {
  const { id } = req.params;
  const { approved } = req.body;

  const transaction = await Transaction.findById(id);
  if (!transaction) {
    throw errors.notFound("Transaction not found");
  }

  if (transaction.status !== "DISPUTED") {
    throw errors.badRequest(
      "Only disputed transactions can be refunded",
    );
  }

  if (approved) {
    transaction.status = "REFUNDED";

    // Deduct from seller's earnings
    await User.findByIdAndUpdate(
      transaction.seller,
      {
        $inc: { "statistics.earnings": -transaction.sellerEarnings },
      },
    );

    // Create notifications
    await Notification.create({
      recipient: transaction.buyer,
      type: "SYSTEM",
      title: "Refund approved",
      message: `Your refund of $${transaction.amount} has been approved and will be processed`,
      actionUrl: `/transactions/${transaction._id}`,
    });

    await Notification.create({
      recipient: transaction.seller,
      type: "SYSTEM",
      title: "Refund issued",
      message: `A refund of $${transaction.sellerEarnings} was issued for transaction ${transaction._id}`,
      actionUrl: `/transactions/${transaction._id}`,
    });
  } else {
    transaction.status = "COMPLETED";

    await Notification.create({
      recipient: transaction.buyer,
      type: "SYSTEM",
      title: "Refund denied",
      message: "Your refund request has been denied",
      actionUrl: `/transactions/${transaction._id}`,
    });
  }

  await transaction.save();

  res.json({
    success: true,
    message: approved ? "Refund processed" : "Refund denied",
    data: { transaction },
  });
});

/**
 * Get seller earnings
 */
exports.getSellerEarnings = asyncHandler(async (req, res) => {
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

  const earnings = await Transaction.aggregate([
    {
      $match: {
        seller: req.user._id,
        status: "COMPLETED",
        createdAt: { $gte: dateFilter },
      },
    },
    {
      $group: {
        _id: { $dateToString: { format: "%Y-%m-%d", date: "$createdAt" } },
        earnings: { $sum: "$sellerEarnings" },
        count: { $sum: 1 },
      },
    },
    { $sort: { _id: 1 } },
  ]);

  const total = earnings.reduce((sum, e) => sum + e.earnings, 0);

  res.json({
    success: true,
    data: {
      period,
      totalEarnings: total,
      earningsByDate: earnings,
    },
  });
});

/**
 * Get platform revenue statistics (admin only)
 */
exports.getPlatformStats = asyncHandler(async (req, res) => {
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

  const stats = await Transaction.aggregate([
    {
      $match: {
        status: "COMPLETED",
        createdAt: { $gte: dateFilter },
      },
    },
    {
      $group: {
        _id: null,
        totalRevenue: { $sum: "$amount" },
        totalPlatformFees: { $sum: "$platformFee" },
        totalSellerEarnings: { $sum: "$sellerEarnings" },
        transactionCount: { $sum: 1 },
      },
    },
  ]);

  const paymentMethodStats = await Transaction.aggregate([
    {
      $match: {
        status: "COMPLETED",
        createdAt: { $gte: dateFilter },
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

  res.json({
    success: true,
    data: {
      period,
      overview: stats[0] || {
        totalRevenue: 0,
        totalPlatformFees: 0,
        totalSellerEarnings: 0,
        transactionCount: 0,
      },
      paymentMethodStats,
    },
  });
});
