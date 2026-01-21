// src/models/Activity.js
const mongoose = require("mongoose");

const activitySchema = new mongoose.Schema(
  {
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    type: {
      type: String,
      enum: [
        "RULE_CREATED",
        "RULE_UPDATED",
        "RULE_PUBLISHED",
        "RULE_PURCHASED",
        "RULE_DOWNLOADED",
        "RULE_FORKED",
        "RULE_REVIEWED",
        "PROFILE_UPDATED",
        "ACHIEVEMENT_EARNED",
      ],
      required: true,
    },
    target: {
      type: mongoose.Schema.Types.ObjectId,
      refPath: "targetModel",
    },
    targetModel: {
      type: String,
      enum: ["Rule", "User", "Review"],
    },
    metadata: {
      type: Map,
      of: mongoose.Schema.Types.Mixed,
    },
    ipAddress: String,
    userAgent: String,
  },
  {
    timestamps: true,
  },
);

activitySchema.index({ user: 1, createdAt: -1 });
activitySchema.index({ type: 1, createdAt: -1 });
activitySchema.index({ target: 1 });

module.exports = mongoose.model("Activity", activitySchema);
