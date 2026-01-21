// src/controllers/reviewController.js
const Review = require("../models/Review");
const Rule = require("../models/Rule");
const User = require("../models/User");
const Purchase = require("../models/Purchase");
const Activity = require("../models/Activity");
const { asyncHandler, errors } = require("../middleware/errorHandler");

/**
 * Get all reviews for a rule
 */
exports.getReviewsByRule = asyncHandler(async (req, res) => {
  const { ruleId } = req.params;
  const { page = 1, limit = 10, sort = "helpful" } = req.query;

  // Verify rule exists
  const rule = await Rule.findById(ruleId);
  if (!rule) {
    throw errors.notFound("Rule not found");
  }

  let sortOption = { createdAt: -1 };
  if (sort === "helpful") {
    sortOption = { "helpful.count": -1, createdAt: -1 };
  } else if (sort === "newest") {
    sortOption = { createdAt: -1 };
  } else if (sort === "oldest") {
    sortOption = { createdAt: 1 };
  }

  const skip = (page - 1) * limit;

  const reviews = await Review.find({ rule: ruleId, isActive: true })
    .populate("user", "username profile avatar")
    .sort(sortOption)
    .skip(skip)
    .limit(parseInt(limit))
    .lean();

  const total = await Review.countDocuments({ rule: ruleId, isActive: true });

  // Check if current user marked as helpful
  if (req.user) {
    reviews.forEach((review) => {
      review.userMarkedHelpful = review.helpful.users.includes(req.user._id);
    });
  }

  res.json({
    success: true,
    data: {
      reviews,
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
 * Get single review
 */
exports.getReview = asyncHandler(async (req, res) => {
  const { id } = req.params;

  const review = await Review.findById(id)
    .populate("user", "username profile avatar")
    .populate("rule", "title slug");

  if (!review) {
    throw errors.notFound("Review not found");
  }

  res.json({
    success: true,
    data: { review },
  });
});

/**
 * Create a new review
 */
exports.createReview = asyncHandler(async (req, res) => {
  const { ruleId, rating, comment } = req.body;

  // Verify rule exists
  const rule = await Rule.findById(ruleId);
  if (!rule) {
    throw errors.notFound("Rule not found");
  }

  // Check if user has purchased the rule (if it's paid)
  if (rule.pricing && rule.pricing.type === "PAID") {
    const hasPurchased = await Purchase.findOne({
      user: req.user._id,
      rule: ruleId,
      isActive: true,
    });

    if (!hasPurchased) {
      throw errors.forbidden(
        "You must purchase this rule to leave a review",
      );
    }
  }

  // Check if user already reviewed
  const existingReview = await Review.findOne({
    rule: ruleId,
    user: req.user._id,
  });

  if (existingReview) {
    throw errors.conflict("You have already reviewed this rule");
  }

  // Create review
  const review = new Review({
    rule: ruleId,
    user: req.user._id,
    rating,
    comment,
    verified: !!hasPurchased,
  });

  await review.save();

  // Log activity
  await Activity.create({
    user: req.user._id,
    type: "RULE_REVIEWED",
    target: ruleId,
    targetModel: "Rule",
    metadata: {
      rating,
      reviewId: review._id,
    },
  });

  // Update rule rating
  const allReviews = await Review.find({ rule: ruleId, isActive: true });
  const avgRating =
    allReviews.reduce((sum, r) => sum + r.rating, 0) / allReviews.length;
  const ratingCount = allReviews.length;

  await Rule.findByIdAndUpdate(ruleId, {
    "stats.rating": avgRating,
    "stats.reviewCount": ratingCount,
  });

  await review.populate("user", "username profile avatar");

  res.status(201).json({
    success: true,
    message: "Review created successfully",
    data: { review },
  });
});

/**
 * Update review
 */
exports.updateReview = asyncHandler(async (req, res) => {
  const { id } = req.params;
  const { rating, comment } = req.body;

  const review = await Review.findById(id);
  if (!review) {
    throw errors.notFound("Review not found");
  }

  // Check ownership
  if (review.user.toString() !== req.user._id.toString()) {
    throw errors.forbidden("You can only update your own reviews");
  }

  review.rating = rating || review.rating;
  review.comment = comment || review.comment;

  await review.save();

  // Update rule rating
  const rule = await Rule.findById(review.rule);
  const allReviews = await Review.find({
    rule: review.rule,
    isActive: true,
  });

  const avgRating =
    allReviews.reduce((sum, r) => sum + r.rating, 0) / allReviews.length;

  await Rule.findByIdAndUpdate(review.rule, {
    "stats.rating": avgRating,
  });

  await review.populate("user", "username profile avatar");

  res.json({
    success: true,
    message: "Review updated successfully",
    data: { review },
  });
});

/**
 * Delete review
 */
exports.deleteReview = asyncHandler(async (req, res) => {
  const { id } = req.params;

  const review = await Review.findById(id);
  if (!review) {
    throw errors.notFound("Review not found");
  }

  // Check ownership or admin
  if (
    review.user.toString() !== req.user._id.toString() &&
    req.user.role !== "ADMIN"
  ) {
    throw errors.forbidden("You can only delete your own reviews");
  }

  review.isActive = false;
  await review.save();

  // Update rule rating
  const allReviews = await Review.find({
    rule: review.rule,
    isActive: true,
  });

  if (allReviews.length > 0) {
    const avgRating =
      allReviews.reduce((sum, r) => sum + r.rating, 0) / allReviews.length;
    await Rule.findByIdAndUpdate(review.rule, {
      "stats.rating": avgRating,
      "stats.reviewCount": allReviews.length,
    });
  } else {
    await Rule.findByIdAndUpdate(review.rule, {
      "stats.rating": 0,
      "stats.reviewCount": 0,
    });
  }

  res.json({
    success: true,
    message: "Review deleted successfully",
  });
});

/**
 * Mark review as helpful
 */
exports.markHelpful = asyncHandler(async (req, res) => {
  const { id } = req.params;
  const { helpful } = req.body;

  const review = await Review.findById(id);
  if (!review) {
    throw errors.notFound("Review not found");
  }

  const userIndex = review.helpful.users.indexOf(req.user._id);
  const isHelpful = userIndex !== -1;

  if (helpful && !isHelpful) {
    review.helpful.users.push(req.user._id);
    review.helpful.count += 1;
  } else if (!helpful && isHelpful) {
    review.helpful.users.splice(userIndex, 1);
    review.helpful.count -= 1;
  }

  await review.save();

  res.json({
    success: true,
    message: helpful ? "Marked as helpful" : "Removed helpful mark",
    data: {
      helpful: review.helpful.count,
      userMarked: helpful,
    },
  });
});

/**
 * Report review
 */
exports.reportReview = asyncHandler(async (req, res) => {
  const { id } = req.params;
  const { reason } = req.body;

  if (!reason) {
    throw errors.badRequest("Report reason is required");
  }

  const review = await Review.findById(id);
  if (!review) {
    throw errors.notFound("Review not found");
  }

  review.reported = true;
  review.reportReason = reason;
  await review.save();

  res.json({
    success: true,
    message: "Review reported successfully",
  });
});

/**
 * Get user's reviews
 */
exports.getUserReviews = asyncHandler(async (req, res) => {
  const { username } = req.params;
  const { page = 1, limit = 10 } = req.query;

  const user = await User.findOne({ username });
  if (!user) {
    throw errors.notFound("User not found");
  }

  const skip = (page - 1) * limit;

  const reviews = await Review.find({ user: user._id, isActive: true })
    .populate("rule", "title slug stats")
    .sort({ createdAt: -1 })
    .skip(skip)
    .limit(parseInt(limit))
    .lean();

  const total = await Review.countDocuments({
    user: user._id,
    isActive: true,
  });

  res.json({
    success: true,
    data: {
      reviews,
      pagination: {
        total,
        page: parseInt(page),
        limit: parseInt(limit),
        pages: Math.ceil(total / limit),
      },
    },
  });
});
