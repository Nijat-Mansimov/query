// src/services/socketService.js
const socketIo = require("socket.io");
const jwt = require("jsonwebtoken");
const User = require("../models/User");
const Notification = require("../models/Notification");

// Store active connections
const userConnections = new Map(); // userId -> [socketIds]
const socketUsers = new Map(); // socketId -> userId

class SocketService {
  constructor(server) {
    this.io = socketIo(server, {
      cors: {
        origin: process.env.CLIENT_URL || "http://localhost:3000",
        credentials: true,
      },
    });

    this.setupMiddleware();
    this.setupEventHandlers();
  }

  /**
   * Setup socket middleware for authentication
   */
  setupMiddleware() {
    this.io.use(async (socket, next) => {
      try {
        const token = socket.handshake.auth.token;

        if (!token) {
          return next(new Error("Authentication error: No token"));
        }

        // Verify JWT token
        const decoded = jwt.verify(
          token,
          process.env.JWT_SECRET || "your_secret"
        );
        socket.userId = decoded.userId;
        socket.user = { id: decoded.userId };

        next();
      } catch (error) {
        next(new Error("Authentication error: Invalid token"));
      }
    });
  }

  /**
   * Setup socket event handlers
   */
  setupEventHandlers() {
    this.io.on("connection", (socket) => {
      console.log(`User ${socket.userId} connected with socket ${socket.id}`);

      // Track user connection
      if (!userConnections.has(socket.userId)) {
        userConnections.set(socket.userId, []);
      }
      userConnections.get(socket.userId).push(socket.id);
      socketUsers.set(socket.id, socket.userId);

      // Join user room for targeted messaging
      socket.join(`user:${socket.userId}`);

      // Handle notification subscription
      socket.on("subscribe_notifications", () => {
        socket.join(`notifications:${socket.userId}`);
        socket.emit("notification_subscribed", {
          message: "Subscribed to notifications",
        });
      });

      // Handle chat/messaging
      socket.on("send_message", (data) => {
        this.handleMessage(socket, data);
      });

      // Handle activity updates
      socket.on("activity_update", (data) => {
        this.broadcastActivity(socket, data);
      });

      // Handle real-time rule view count
      socket.on("view_rule", (ruleId) => {
        socket.join(`rule:${ruleId}`);
        this.io
          .to(`rule:${ruleId}`)
          .emit("rule_viewer_joined", { ruleId, userId: socket.userId });
      });

      // Handle disconnect
      socket.on("disconnect", () => {
        this.handleDisconnect(socket);
      });

      // Handle errors
      socket.on("error", (error) => {
        console.error(`Socket error for user ${socket.userId}:`, error);
      });
    });
  }

  /**
   * Handle message sending
   */
  handleMessage(socket, data) {
    const { recipientId, message } = data;

    if (!recipientId || !message) {
      socket.emit("message_error", {
        error: "Missing recipientId or message",
      });
      return;
    }

    // Send to recipient's room
    this.io.to(`user:${recipientId}`).emit("new_message", {
      from: socket.userId,
      message,
      timestamp: new Date(),
    });

    // Confirm to sender
    socket.emit("message_sent", { to: recipientId });
  }

  /**
   * Broadcast activity to followers
   */
  broadcastActivity(socket, data) {
    const { type, details } = data;

    // Broadcast to activity feed
    socket.broadcast.emit("user_activity", {
      userId: socket.userId,
      type,
      details,
      timestamp: new Date(),
    });
  }

  /**
   * Handle user disconnect
   */
  handleDisconnect(socket) {
    const userId = socketUsers.get(socket.id);

    if (userId) {
      const connections = userConnections.get(userId);
      if (connections) {
        const index = connections.indexOf(socket.id);
        if (index > -1) {
          connections.splice(index, 1);
        }

        if (connections.length === 0) {
          userConnections.delete(userId);
        }
      }

      socketUsers.delete(socket.id);
      console.log(`User ${userId} disconnected`);
    }
  }

  /**
   * Send notification to specific user
   */
  sendNotificationToUser(userId, notification) {
    this.io.to(`notifications:${userId}`).emit("new_notification", {
      id: notification._id,
      title: notification.title,
      message: notification.message,
      type: notification.type,
      data: notification.data,
      timestamp: notification.createdAt,
    });
  }

  /**
   * Send notification to multiple users
   */
  sendNotificationToUsers(userIds, notification) {
    userIds.forEach((userId) => {
      this.sendNotificationToUser(userId, notification);
    });
  }

  /**
   * Broadcast system-wide notification
   */
  broadcastSystemNotification(notification) {
    this.io.emit("system_notification", {
      id: notification._id,
      title: notification.title,
      message: notification.message,
      timestamp: notification.createdAt,
    });
  }

  /**
   * Update real-time rule stats
   */
  updateRuleStats(ruleId, stats) {
    this.io.to(`rule:${ruleId}`).emit("rule_stats_update", {
      ruleId,
      downloads: stats.downloads,
      purchases: stats.purchases,
      rating: stats.rating,
      reviewCount: stats.reviewCount,
    });
  }

  /**
   * Notify user of rule purchase
   */
  notifyRulePurchase(buyerId, sellerId, ruleTitle) {
    // Notify seller
    this.sendNotificationToUser(sellerId, {
      _id: `notif_${Date.now()}`,
      title: "Rule Purchased",
      message: `Your rule "${ruleTitle}" was purchased!`,
      type: "RULE_PURCHASED",
      data: { buyerId, ruleTitle },
      createdAt: new Date(),
    });

    // Notify buyer
    this.sendNotificationToUser(buyerId, {
      _id: `notif_${Date.now()}`,
      title: "Purchase Successful",
      message: `You successfully purchased "${ruleTitle}"`,
      type: "PURCHASE_SUCCESS",
      data: { ruleTitle },
      createdAt: new Date(),
    });
  }

  /**
   * Notify user of new review
   */
  notifyNewReview(ruleCreatorId, reviewAuthorName, ruleTitle, rating) {
    this.sendNotificationToUser(ruleCreatorId, {
      _id: `notif_${Date.now()}`,
      title: "New Review",
      message: `${reviewAuthorName} left a ${rating}-star review on "${ruleTitle}"`,
      type: "NEW_REVIEW",
      data: { reviewAuthorName, ruleTitle, rating },
      createdAt: new Date(),
    });
  }

  /**
   * Broadcast online user count
   */
  broadcastOnlineCount() {
    const onlineCount = userConnections.size;
    this.io.emit("online_users_count", { count: onlineCount });
  }

  /**
   * Get online users count
   */
  getOnlineUsersCount() {
    return userConnections.size;
  }

  /**
   * Check if user is online
   */
  isUserOnline(userId) {
    return userConnections.has(userId);
  }

  /**
   * Get user's socket connections
   */
  getUserConnections(userId) {
    return userConnections.get(userId) || [];
  }
}

module.exports = SocketService;
