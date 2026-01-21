# Advanced Features Documentation

This document describes the newly implemented advanced features:
- Real-time WebSocket Notifications
- API Rate Limiting
- Admin Dashboard
- Analytics & Reporting

## Table of Contents
1. [WebSocket Real-Time Notifications](#websocket-real-time-notifications)
2. [API Rate Limiting](#api-rate-limiting)
3. [Admin Dashboard](#admin-dashboard)
4. [Analytics & Reporting](#analytics--reporting)

---

## WebSocket Real-Time Notifications

### Overview
Real-time notifications are delivered via Socket.IO, allowing instant communication between server and clients.

### Installation

The server automatically initializes WebSocket when started. On the client side:

```bash
npm install socket.io-client
```

### Client Connection

```javascript
import io from 'socket.io-client';

// Connect to WebSocket with authentication
const socket = io('http://localhost:5000', {
  auth: {
    token: 'your_jwt_token'
  }
});

// Listen for connection
socket.on('connect', () => {
  console.log('Connected to notification server');
});

// Subscribe to notifications
socket.emit('subscribe_notifications');

// Listen for new notifications
socket.on('new_notification', (notification) => {
  console.log('New notification:', notification);
  // {
  //   id: 'notification_id',
  //   title: 'Notification Title',
  //   message: 'Notification message',
  //   type: 'RULE_PURCHASED',
  //   data: { /* additional data */ },
  //   timestamp: '2026-01-21T10:00:00Z'
  // }
});
```

### Events

#### Client Events (Emit to Server)

**Subscribe to Notifications**
```javascript
socket.emit('subscribe_notifications');
```

**Send Message**
```javascript
socket.emit('send_message', {
  recipientId: 'user_id',
  message: 'Hello!'
});
```

**View Rule**
```javascript
socket.emit('view_rule', 'rule_id');
```

**Activity Update**
```javascript
socket.emit('activity_update', {
  type: 'RULE_CREATED',
  details: { ruleId: 'rule_id' }
});
```

#### Server Events (Listen from Server)

**New Notification**
```javascript
socket.on('new_notification', (notification) => {
  // Handle notification
});
```

**New Message**
```javascript
socket.on('new_message', (data) => {
  // {
  //   from: 'sender_user_id',
  //   message: 'message text',
  //   timestamp: Date
  // }
});
```

**Message Sent Confirmation**
```javascript
socket.on('message_sent', (data) => {
  // { to: 'recipient_id' }
});
```

**User Activity**
```javascript
socket.on('user_activity', (data) => {
  // {
  //   userId: 'user_id',
  //   type: 'RULE_CREATED',
  //   details: {},
  //   timestamp: Date
  // }
});
```

**Rule Stats Update**
```javascript
socket.on('rule_stats_update', (data) => {
  // {
  //   ruleId: 'rule_id',
  //   downloads: 100,
  //   purchases: 50,
  //   rating: 4.5,
  //   reviewCount: 25
  // }
});
```

**Online Users Count**
```javascript
socket.on('online_users_count', (data) => {
  // { count: 150 }
});
```

### Notification Types

- `RULE_PURCHASED` - User purchased a rule
- `RULE_APPROVED` - Rule was approved by moderator
- `RULE_REJECTED` - Rule was rejected
- `NEW_REVIEW` - New review on user's rule
- `COMMENT_REPLY` - Reply to user's comment
- `ACHIEVEMENT` - User earned achievement
- `SYSTEM` - System-wide notification
- `PURCHASE_SUCCESS` - Purchase was successful

### Programmatic Notification

Use in controllers to send real-time notifications:

```javascript
// Send to specific user
global.socketService.sendNotificationToUser(userId, {
  _id: 'notification_id',
  title: 'Rule Purchased',
  message: 'Your rule was purchased!',
  type: 'RULE_PURCHASED',
  data: { buyerId, ruleTitle },
  createdAt: new Date()
});

// Send to multiple users
global.socketService.sendNotificationToUsers([userId1, userId2], notification);

// Broadcast to all users
global.socketService.broadcastSystemNotification(notification);

// Notify rule purchase
global.socketService.notifyRulePurchase(buyerId, sellerId, ruleTitle);

// Notify new review
global.socketService.notifyNewReview(ruleCreatorId, reviewAuthorName, ruleTitle, rating);

// Update rule stats
global.socketService.updateRuleStats(ruleId, {
  downloads: 100,
  purchases: 50,
  rating: 4.5,
  reviewCount: 25
});
```

### Connection Status

Check online users count:

```bash
GET /api/v1/websocket/status
```

Response:
```json
{
  "success": true,
  "message": "WebSocket server is running",
  "onlineUsers": 150
}
```

---

## API Rate Limiting

### Overview

Rate limiting protects your API from abuse by limiting the number of requests per user/IP within a time window.

### Configuration

Rate limits are configured in `/src/middleware/rateLimiter.js` and applied in `server.js`.

### Rate Limits by Endpoint

| Endpoint | Limit | Window | Description |
|----------|-------|--------|-------------|
| `/api/v1/auth/*` | 5 | 15 min | Authentication endpoints |
| `/api/v1/users/*` | 100-500 | 15 min | Role-based (USER: 100, VERIFIED: 200, MODERATOR: 500) |
| `/api/v1/reviews` | 5 | 1 hour | Review posting |
| `/api/v1/transactions/purchase` | 10 | 15 min | Purchase transactions |
| `/api/v1/rules/download` | 20 | 1 hour | Rule downloads |

### Admin Bypass

Admins automatically bypass all rate limits.

### Redis Support

For distributed systems, configure Redis:

```env
REDIS_URL=redis://localhost:6379
```

Rate limiting will use Redis store instead of memory.

### Rate Limit Headers

All responses include rate limit information:

```
RateLimit-Limit: 100
RateLimit-Remaining: 95
RateLimit-Reset: 1234567890
```

### Rate Limit Response

When limit is exceeded:

```json
{
  "success": false,
  "message": "Too many requests from this IP, please try again later."
}
```

Status Code: `429 (Too Many Requests)`

### Custom Rate Limiter

Create custom limits for specific endpoints:

```javascript
const customLimiter = require('./middleware/rateLimiter').createRateLimiter({
  windowMs: 60 * 60 * 1000, // 1 hour
  max: 50,
  message: "Custom rate limit exceeded"
});

router.get('/endpoint', customLimiter, controller.method);
```

---

## Admin Dashboard

### Overview

The admin dashboard provides comprehensive platform management, including:
- System metrics and overview
- User management
- Rule moderation
- Review moderation
- System logs

### Authentication

All admin endpoints require:
1. Valid JWT token
2. User role: `ADMIN`

```bash
Authorization: Bearer <jwt_token>
```

### Dashboard Endpoints

#### Get Dashboard Overview
```http
GET /api/v1/admin/dashboard
```

**Response:**
```json
{
  "success": true,
  "data": {
    "overview": {
      "totalUsers": 1000,
      "totalRules": 500,
      "totalReviews": 2000,
      "totalTransactions": 800,
      "activeUsers": 150,
      "pendingRules": 25
    },
    "revenue": {
      "totalRevenue": 5000,
      "platformFees": 500,
      "sellerPayouts": 4500,
      "transactionCount": 800
    },
    "topRules": [
      {
        "title": "SQL Injection Detection",
        "stats": { "downloads": 1000, "rating": 4.8 },
        "creator": { "username": "john_doe" }
      }
    ],
    "recentActivity": [
      {
        "user": { "username": "jane_smith" },
        "type": "RULE_CREATED",
        "createdAt": "2026-01-21T10:00:00Z"
      }
    ]
  }
}
```

### User Management

#### Get Users
```http
GET /api/v1/admin/users?page=1&limit=20&role=USER&status=active
```

**Query Parameters:**
- `page` - Page number (default: 1)
- `limit` - Items per page (default: 20)
- `role` - Filter by role (USER, VERIFIED_CONTRIBUTOR, MODERATOR, ADMIN)
- `status` - Filter by status (active, inactive)

#### Update User Role
```http
PUT /api/v1/admin/users/:userId/role
Content-Type: application/json

{
  "role": "MODERATOR"
}
```

#### Suspend User
```http
POST /api/v1/admin/users/:userId/suspend
Content-Type: application/json

{
  "reason": "Violated terms of service",
  "duration": 30
}
```

**Parameters:**
- `reason` - Suspension reason
- `duration` - Duration in days (optional, leave empty for permanent)

#### Unsuspend User
```http
POST /api/v1/admin/users/:userId/unsuspend
```

### Rule Moderation

#### Get Rules for Moderation
```http
GET /api/v1/admin/rules?page=1&limit=20&status=PENDING_REVIEW
```

#### Moderate Rule (Approve/Reject)
```http
POST /api/v1/admin/rules/:ruleId/moderate
Content-Type: application/json

{
  "approved": true,
  "reason": "Meets quality standards"
}
```

### Review Moderation

#### Get Reported Reviews
```http
GET /api/v1/admin/reviews?page=1&limit=20
```

#### Take Action on Review
```http
POST /api/v1/admin/reviews/:reviewId/action
Content-Type: application/json

{
  "action": "remove"
}
```

**Actions:**
- `remove` - Remove the review
- `approve` - Keep the review, clear reported flag

### System Logs

#### Get Activity Logs
```http
GET /api/v1/admin/logs?page=1&limit=50&type=RULE_CREATED&userId=userId
```

#### Get Admin Action Logs
```http
GET /api/v1/admin/logs/admin-actions?page=1&limit=50
```

---

## Analytics & Reporting

### Overview

The analytics system provides detailed insights into platform performance, user behavior, and revenue.

### Analytics Endpoints

#### Platform Analytics
```http
GET /api/v1/admin/analytics/platform?startDate=2026-01-01&endDate=2026-01-31
```

**Response includes:**
- New users, rules, reviews, transactions
- Revenue metrics
- User growth trend

#### User Behavior Analytics
```http
GET /api/v1/admin/analytics/user-behavior?startDate=2026-01-01&endDate=2026-01-31
```

**Response includes:**
- Activity distribution
- User retention statistics
- Rule engagement metrics
- Top user activities

#### Rule Analytics
```http
GET /api/v1/admin/analytics/rules?startDate=2026-01-01&endDate=2026-01-31
```

**Response includes:**
- Top rules by downloads
- Top rules by rating
- Rules by status
- New rules trend
- Pricing distribution

#### Revenue Analytics
```http
GET /api/v1/admin/analytics/revenue?startDate=2026-01-01&endDate=2026-01-31
```

**Response includes:**
- Revenue trend by date
- Payment method distribution
- Refund statistics
- Top sellers

#### Review Analytics
```http
GET /api/v1/admin/analytics/reviews?startDate=2026-01-01&endDate=2026-01-31
```

**Response includes:**
- Rating distribution
- Review trend
- Review statistics
- Most helpful reviews

### Custom Reports

Generate custom reports with filters:

```http
POST /api/v1/admin/analytics/report
Content-Type: application/json

{
  "reportType": "user_activity",
  "startDate": "2026-01-01",
  "endDate": "2026-01-31",
  "filters": {
    "userId": "specific_user_id"
  }
}
```

**Report Types:**
- `user_activity` - User activity by type
- `rule_performance` - Rule performance metrics
- `revenue_breakdown` - Revenue breakdown by date/method
- `user_growth` - New user growth

### Export Reports

Export analytics data to CSV:

```http
GET /api/v1/admin/analytics/export?reportType=transactions&startDate=2026-01-01&endDate=2026-01-31
```

**Report Types:**
- `transactions` - Export all transactions
- `users` - Export all users
- `rules` - Export all rules

**Response:** CSV file download

### Analytics Metrics

Common metrics provided:

**Platform Metrics:**
- Total users
- Total rules
- Total reviews
- Total transactions
- Active users
- Pending rules

**Revenue Metrics:**
- Total revenue
- Platform fees
- Seller payouts
- Average transaction value
- Refund rate

**User Metrics:**
- User growth
- Active users
- User retention
- User roles distribution

**Rule Metrics:**
- Downloads
- Purchases
- Average rating
- Number of reviews
- Pricing distribution

**Activity Metrics:**
- Rule created
- Rule updated
- Rule purchased
- Rule reviewed
- Profile updated

---

## Integration Examples

### Example: Send Notification on Purchase

In `transactionController.js`:

```javascript
// After purchase is created
global.socketService.notifyRulePurchase(
  buyerId,
  sellerId,
  rule.title
);

// Also create notification in database
await Notification.create({
  recipient: sellerId,
  type: 'RULE_PURCHASED',
  title: 'Rule Purchased',
  message: `User purchased your rule "${rule.title}"`
});
```

### Example: Update Stats in Real-Time

In `transactionController.js`:

```javascript
// Broadcast real-time stats update
global.socketService.updateRuleStats(ruleId, {
  downloads: rule.stats.downloads,
  purchases: rule.stats.purchases,
  rating: rule.stats.rating,
  reviewCount: rule.stats.reviewCount
});
```

### Example: Check Rate Limit

Frontend error handling:

```javascript
const response = await fetch('/api/v1/reviews', {
  method: 'POST',
  headers: { 'Authorization': `Bearer ${token}` },
  body: JSON.stringify(reviewData)
});

if (response.status === 429) {
  const resetTime = response.headers.get('RateLimit-Reset');
  console.log('Rate limited. Try again at:', new Date(resetTime * 1000));
}
```

---

## Environment Variables Required

```env
# WebSocket
CLIENT_URL=http://localhost:3000

# Redis (optional, for distributed rate limiting)
REDIS_URL=redis://localhost:6379

# Admin Dashboard
ADMIN_ENABLE=true

# Analytics
ANALYTICS_ENABLED=true
```

---

## Best Practices

1. **Use WebSocket for Real-Time Features**
   - Notifications
   - Live stats updates
   - User presence

2. **Monitor Rate Limits**
   - Adjust limits based on usage patterns
   - Use Redis for multi-server setup

3. **Admin Dashboard**
   - Regularly review pending rules
   - Monitor reported reviews
   - Check admin action logs

4. **Analytics**
   - Review weekly metrics
   - Monitor revenue trends
   - Identify popular rules
   - Track user growth

---

## Troubleshooting

### WebSocket Not Connecting
- Check client URL matches server
- Verify JWT token is valid
- Check browser console for errors
- Ensure socket.io is installed on client

### Rate Limit Not Working
- Verify middleware is applied to routes
- Check Redis connection if using Redis store
- Verify user role is set correctly for bypass

### Admin Endpoints Return 403
- Verify user has ADMIN role
- Check JWT token is valid and not expired
- Ensure authentication middleware is applied

### Analytics Data Missing
- Verify date range is correct
- Check MongoDB connection
- Verify data exists for date range

