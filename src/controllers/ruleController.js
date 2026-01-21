// src/controllers/ruleController.js
const Rule = require('../models/Rule');
const RuleVersion = require('../models/RuleVersion');
const Purchase = require('../models/Purchase');
const Activity = require('../models/Activity');

// Create new rule (draft)
exports.createRule = async (req, res) => {
  try {
    const {
      title,
      description,
      queryLanguage,
      vendor,
      category,
      tags,
      mitreAttack,
      severity,
      ruleContent,
      visibility,
      pricing
    } = req.body;

    const rule = new Rule({
      title,
      description,
      author: req.user._id,
      queryLanguage,
      vendor,
      category,
      tags,
      mitreAttack,
      severity,
      ruleContent,
      visibility: visibility || 'PRIVATE',
      pricing,
      status: 'DRAFT'
    });

    await rule.save();

    // Create initial version
    const version = new RuleVersion({
      rule: rule._id,
      version: '1.0.0',
      title,
      description,
      ruleContent,
      createdBy: req.user._id
    });

    await version.save();

    // Log activity
    await Activity.create({
      user: req.user._id,
      type: 'RULE_CREATED',
      target: rule._id,
      targetModel: 'Rule',
      ipAddress: req.ip,
      userAgent: req.get('user-agent')
    });

    // Update user statistics
    req.user.statistics.totalRules += 1;
    await req.user.save();

    res.status(201).json({
      success: true,
      message: 'Rule created successfully',
      data: { rule }
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Failed to create rule',
      error: error.message
    });
  }
};

// Get all rules with filters
exports.getRules = async (req, res) => {
  try {
    const {
      page = 1,
      limit = 20,
      sort = '-createdAt',
      queryLanguage,
      vendor,
      category,
      severity,
      isPaid,
      minRating,
      search,
      tags,
      mitreTactics,
      mitreTechniques
    } = req.query;

    // Build filter
    const filter = {
      status: 'APPROVED',
      isActive: true
    };

    // Only show public rules unless user is authenticated
    if (!req.user) {
      filter.visibility = 'PUBLIC';
    } else {
      // Show user's own rules + public rules
      filter.$or = [
        { visibility: 'PUBLIC' },
        { author: req.user._id }
      ];
    }

    // Apply filters
    if (queryLanguage) filter.queryLanguage = queryLanguage;
    if (vendor) filter.vendor = vendor;
    if (category) filter.category = category;
    if (severity) filter.severity = severity;
    if (isPaid !== undefined) filter['pricing.isPaid'] = isPaid === 'true';
    if (minRating) filter['statistics.rating'] = { $gte: parseFloat(minRating) };
    if (tags) filter.tags = { $in: tags.split(',') };
    if (mitreTactics) filter['mitreAttack.tactics'] = { $in: mitreTactics.split(',') };
    if (mitreTechniques) filter['mitreAttack.techniques'] = { $in: mitreTechniques.split(',') };

    // Text search
    if (search) {
      filter.$text = { $search: search };
    }

    // Pagination
    const skip = (parseInt(page) - 1) * parseInt(limit);

    // Execute query
    const rules = await Rule.find(filter)
      .populate('author', 'username profile.avatar statistics.rating')
      .sort(sort)
      .limit(parseInt(limit))
      .skip(skip)
      .lean();

    const total = await Rule.countDocuments(filter);

    // Mask paid rule content for non-purchasers
    const maskedRules = await Promise.all(rules.map(async (rule) => {
      if (rule.pricing.isPaid && req.user) {
        const hasPurchased = await Purchase.exists({
          user: req.user._id,
          rule: rule._id,
          isActive: true
        });

        if (!hasPurchased) {
          // Mask the query content
          rule.ruleContent.query = rule.ruleContent.query.substring(0, 100) + '... [Purchase to view full content]';
        }
      } else if (rule.pricing.isPaid && !req.user) {
        rule.ruleContent.query = '[Login and purchase to view content]';
      }

      return rule;
    }));

    res.json({
      success: true,
      data: {
        rules: maskedRules,
        pagination: {
          currentPage: parseInt(page),
          totalPages: Math.ceil(total / parseInt(limit)),
          totalItems: total,
          itemsPerPage: parseInt(limit)
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
};

// Get single rule by ID
exports.getRuleById = async (req, res) => {
  try {
    const { id } = req.params;

    const rule = await Rule.findById(id)
      .populate('author', 'username profile statistics.rating')
      .populate('reviews');

    if (!rule) {
      return res.status(404).json({
        success: false,
        message: 'Rule not found'
      });
    }

    // Check visibility permissions
    if (rule.visibility === 'PRIVATE' && (!req.user || rule.author._id.toString() !== req.user._id.toString())) {
      return res.status(403).json({
        success: false,
        message: 'Access denied'
      });
    }

    // Increment view count
    rule.statistics.views += 1;
    await rule.save();

    // Check if user has purchased (for paid rules)
    let hasPurchased = false;
    if (rule.pricing.isPaid && req.user) {
      hasPurchased = await Purchase.exists({
        user: req.user._id,
        rule: rule._id,
        isActive: true
      });

      // Mask content if not purchased
      if (!hasPurchased) {
        rule.ruleContent.query = rule.ruleContent.query.substring(0, 150) + '... [Purchase to view full content]';
      }
    } else if (rule.pricing.isPaid && !req.user) {
      rule.ruleContent.query = '[Login and purchase to view content]';
    }

    res.json({
      success: true,
      data: {
        rule,
        hasPurchased
      }
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Failed to fetch rule',
      error: error.message
    });
  }
};

// Update rule
exports.updateRule = async (req, res) => {
  try {
    const { id } = req.params;
    const updates = req.body;

    const rule = await Rule.findById(id);

    if (!rule) {
      return res.status(404).json({
        success: false,
        message: 'Rule not found'
      });
    }

    // Check ownership or admin permission
    if (rule.author.toString() !== req.user._id.toString() && !req.user.hasPermission('rule:update:any')) {
      return res.status(403).json({
        success: false,
        message: 'Access denied'
      });
    }

    // Don't allow changing status through this endpoint
    delete updates.status;
    delete updates.moderation;

    // Update rule
    Object.assign(rule, updates);
    await rule.save();

    // Log activity
    await Activity.create({
      user: req.user._id,
      type: 'RULE_UPDATED',
      target: rule._id,
      targetModel: 'Rule',
      ipAddress: req.ip,
      userAgent: req.get('user-agent')
    });

    res.json({
      success: true,
      message: 'Rule updated successfully',
      data: { rule }
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Failed to update rule',
      error: error.message
    });
  }
};

// Publish rule
exports.publishRule = async (req, res) => {
  try {
    const { id } = req.params;

    const rule = await Rule.findById(id);

    if (!rule) {
      return res.status(404).json({
        success: false,
        message: 'Rule not found'
      });
    }

    if (rule.author.toString() !== req.user._id.toString()) {
      return res.status(403).json({
        success: false,
        message: 'Access denied'
      });
    }

    if (rule.status !== 'DRAFT') {
      return res.status(400).json({
        success: false,
        message: 'Only draft rules can be published'
      });
    }

    if (!req.user.emailVerified) {
      return res.status(403).json({
        success: false,
        message: 'Email verification required to publish rules'
      });
    }

    // Change status based on user role
    if (req.user.role === 'VERIFIED_CONTRIBUTOR' || req.user.role === 'ADMIN') {
      rule.status = 'APPROVED';
      rule.publishedAt = new Date();
    } else {
      rule.status = 'PENDING_REVIEW';
    }

    await rule.save();

    // Log activity
    await Activity.create({
      user: req.user._id,
      type: 'RULE_PUBLISHED',
      target: rule._id,
      targetModel: 'Rule',
      ipAddress: req.ip,
      userAgent: req.get('user-agent')
    });

    res.json({
      success: true,
      message: rule.status === 'APPROVED' ? 'Rule published successfully' : 'Rule submitted for review',
      data: { rule }
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Failed to publish rule',
      error: error.message
    });
  }
};

// Delete rule
exports.deleteRule = async (req, res) => {
  try {
    const { id } = req.params;

    const rule = await Rule.findById(id);

    if (!rule) {
      return res.status(404).json({
        success: false,
        message: 'Rule not found'
      });
    }

    if (rule.author.toString() !== req.user._id.toString() && !req.user.hasPermission('rule:delete:any')) {
      return res.status(403).json({
        success: false,
        message: 'Access denied'
      });
    }

    // Soft delete
    rule.isActive = false;
    rule.status = 'ARCHIVED';
    await rule.save();

    res.json({
      success: true,
      message: 'Rule deleted successfully'
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Failed to delete rule',
      error: error.message
    });
  }
};

// Fork rule
exports.forkRule = async (req, res) => {
  try {
    const { id } = req.params;

    const originalRule = await Rule.findById(id);

    if (!originalRule) {
      return res.status(404).json({
        success: false,
        message: 'Rule not found'
      });
    }

    if (originalRule.visibility !== 'PUBLIC') {
      return res.status(403).json({
        success: false,
        message: 'Cannot fork private rules'
      });
    }

    // Create forked rule
    const forkedRule = new Rule({
      title: `${originalRule.title} (Fork)`,
      description: originalRule.description,
      author: req.user._id,
      queryLanguage: originalRule.queryLanguage,
      vendor: originalRule.vendor,
      category: originalRule.category,
      tags: originalRule.tags,
      mitreAttack: originalRule.mitreAttack,
      severity: originalRule.severity,
      ruleContent: originalRule.ruleContent,
      forkedFrom: originalRule._id,
      status: 'DRAFT',
      visibility: 'PRIVATE'
    });

    await forkedRule.save();

    // Update fork count
    originalRule.statistics.forks += 1;
    await originalRule.save();

    // Log activity
    await Activity.create({
      user: req.user._id,
      type: 'RULE_FORKED',
      target: forkedRule._id,
      targetModel: 'Rule',
      metadata: { originalRule: originalRule._id },
      ipAddress: req.ip,
      userAgent: req.get('user-agent')
    });

    res.status(201).json({
      success: true,
      message: 'Rule forked successfully',
      data: { rule: forkedRule }
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Failed to fork rule',
      error: error.message
    });
  }
};

module.exports = exports;