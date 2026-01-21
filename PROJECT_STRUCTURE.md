# Project Structure Documentation

## Overview
This is a full-featured REST API for a Security Rules marketplace platform with user management, reviews, payments, and notifications.

## Directory Structure

```
query/
├── src/
│   ├── server.js                 # Main Express server entry point
│   ├── config/
│   │   └── passport.js           # Passport authentication strategies
│   ├── controllers/              # Business logic layer
│   │   ├── authController.js     # Authentication & authorization
│   │   ├── reviewController.js   # Review management logic ✨ NEW
│   │   ├── ruleController.js     # Rule/query management
│   │   ├── transactionController.js  # Payment & transaction logic ✨ NEW
│   │   └── userController.js     # User management logic ✨ NEW
│   ├── middleware/
│   │   ├── auth.js               # JWT authentication middleware
│   │   └── errorHandler.js       # Global error handling
│   ├── models/
│   │   ├── Activity.js           # User activity logs
│   │   ├── Category.js           # Rule categories
│   │   ├── Notification.js       # User notifications
│   │   ├── Purchase.js           # Purchase records
│   │   ├── Review.js             # Rule reviews/ratings
│   │   ├── Rule.js               # Security rules
│   │   ├── RuleVersion.js        # Rule versioning
│   │   ├── Transaction.js        # Payment transactions
│   │   └── User.js               # User accounts
│   ├── routes/
│   │   ├── authRoutes.js         # Auth endpoints
│   │   ├── reviewRoutes.js       # Review endpoints ✨ UPDATED
│   │   ├── ruleRoutes.js         # Rule endpoints
│   │   ├── transactionRoutes.js  # Transaction endpoints ✨ UPDATED
│   │   └── userRoutes.js         # User endpoints ✨ UPDATED
│   └── utils/
│       └── email.js              # Email sending utilities
├── package.json                   # Dependencies & scripts
├── README.md                       # Main documentation
├── IMPLEMENTATION_SUMMARY.md       # Implementation details ✨ NEW
├── API_REFERENCE.md               # API documentation ✨ NEW
└── .env                           # Environment variables
```

## File Descriptions

### Controllers

#### `reviewController.js` (NEW)
**Responsibilities:**
- Handle all review-related operations
- Manage review creation, updates, and deletions
- Track helpful markings
- Handle review reporting
- Calculate rule ratings based on reviews
- Log review activities

**Key Exports:**
- `getReviewsByRule()`
- `createReview()`
- `updateReview()`
- `deleteReview()`
- `markHelpful()`
- `reportReview()`
- `getUserReviews()`

---

#### `userController.js` (NEW)
**Responsibilities:**
- User profile management
- Password management and resets
- Notification handling
- Activity tracking
- Earnings calculations
- User search and statistics
- 2FA management

**Key Exports:**
- `getProfile()`
- `updateProfile()`
- `updatePassword()`
- `requestPasswordReset()`
- `resetPassword()`
- `getNotifications()`
- `markNotificationAsRead()`
- `getEarnings()`
- `getUserStats()`

---

#### `transactionController.js` (NEW)
**Responsibilities:**
- Handle all payment transactions
- Process rule purchases
- Manage refunds
- Calculate fees and earnings
- Track platform revenue
- Generate transaction reports
- Create purchase records

**Key Exports:**
- `getAllTransactions()`
- `getMyTransactions()`
- `purchaseRule()`
- `requestRefund()`
- `processRefund()`
- `getSellerEarnings()`
- `getPlatformStats()`

---

### Routes

#### `reviewRoutes.js` (UPDATED)
**Endpoints:** 8 endpoints
- GET /api/v1/reviews/rule/:ruleId
- GET /api/v1/reviews/:id
- GET /api/v1/reviews/user/:username
- POST /api/v1/reviews
- PUT /api/v1/reviews/:id
- DELETE /api/v1/reviews/:id
- POST /api/v1/reviews/:id/helpful
- POST /api/v1/reviews/:id/report

**Middleware:** 
- Authentication (where required)
- Validation with express-validator
- Error handling

---

#### `userRoutes.js` (UPDATED)
**Endpoints:** 22 endpoints
- GET /api/v1/users/profile
- PUT /api/v1/users/profile
- POST /api/v1/users/password
- POST /api/v1/users/password/reset-request
- POST /api/v1/users/password/reset
- GET /api/v1/users/search
- GET /api/v1/users/stats
- GET /api/v1/users/:username
- GET /api/v1/users/:username/rules
- GET /api/v1/users/activity
- GET /api/v1/users/notifications
- POST /api/v1/users/notifications/:id/read
- POST /api/v1/users/notifications/read-all
- DELETE /api/v1/users/notifications/:id
- GET /api/v1/users/earnings
- GET /api/v1/users/me/purchases
- POST /api/v1/users/2fa/setup
- POST /api/v1/users/2fa/verify
- POST /api/v1/users/2fa/disable

**Middleware:**
- Authentication
- Validation
- Error handling

---

#### `transactionRoutes.js` (UPDATED)
**Endpoints:** 8 endpoints
- GET /api/v1/transactions
- GET /api/v1/transactions/my
- GET /api/v1/transactions/stats/platform
- GET /api/v1/transactions/earnings/seller
- POST /api/v1/transactions/purchase
- GET /api/v1/transactions/:id
- POST /api/v1/transactions/:id/refund
- POST /api/v1/transactions/:id/refund/process

**Middleware:**
- Authentication
- Role-based access (ADMIN)
- Validation
- Error handling

---

## Data Models

### Review Schema
```javascript
{
  rule: ObjectId,           // Reference to Rule
  user: ObjectId,           // Reference to User
  rating: Number (1-5),     // Star rating
  comment: String,          // Review text
  verified: Boolean,        // Purchase verified
  helpful: {
    count: Number,
    users: [ObjectId]       // Users who marked helpful
  },
  reported: Boolean,
  reportReason: String,
  isActive: Boolean,
  timestamps: true
}
```

### Transaction Schema
```javascript
{
  buyer: ObjectId,          // Reference to User
  seller: ObjectId,         // Reference to User
  rule: ObjectId,           // Reference to Rule
  amount: Number,           // Purchase price
  currency: String,         // Currency code
  paymentMethod: String,    // STRIPE, PAYPAL, CRYPTO, CREDITS
  status: String,           // PENDING, COMPLETED, FAILED, REFUNDED, DISPUTED
  paymentIntentId: String,  // Payment gateway reference
  receiptUrl: String,       // Receipt document
  platformFee: Number,      // 10% fee
  sellerEarnings: Number,   // 90% to seller
  metadata: Map,            // Additional data
  timestamps: true
}
```

### Purchase Schema
```javascript
{
  user: ObjectId,           // Reference to User
  rule: ObjectId,           // Reference to Rule
  transaction: ObjectId,    // Reference to Transaction
  accessGrantedAt: Date,
  expiresAt: Date,          // Optional expiration
  downloads: {
    count: Number,
    lastDownloadedAt: Date,
    history: [
      {
        downloadedAt: Date,
        ipAddress: String,
        userAgent: String
      }
    ]
  },
  licenseKey: String,       // Unique license key
  isActive: Boolean,
  timestamps: true
}
```

### Notification Schema
```javascript
{
  recipient: ObjectId,      // Reference to User
  type: String,             // RULE_APPROVED, RULE_REJECTED, RULE_PURCHASED, etc.
  title: String,
  message: String,
  data: Map,                // Additional data
  isRead: Boolean,
  readAt: Date,
  actionUrl: String,        // Link to action
  timestamps: true
}
```

## Environment Variables

```env
# Database
MONGODB_URI=mongodb://localhost:27017/security-rules

# JWT
JWT_SECRET=your_jwt_secret
JWT_REFRESH_SECRET=your_refresh_secret
JWT_ACCESS_EXPIRATION=15m
JWT_REFRESH_EXPIRATION=7d

# Email
EMAIL_SERVICE=gmail
EMAIL_USER=your_email@gmail.com
EMAIL_PASSWORD=your_app_password
EMAIL_FROM=noreply@securityrules.com

# Payment
STRIPE_SECRET_KEY=sk_test_...
STRIPE_PUBLIC_KEY=pk_test_...

# Server
PORT=3000
NODE_ENV=development
```

## Installation & Setup

1. **Install dependencies:**
   ```bash
   npm install
   ```

2. **Configure environment:**
   ```bash
   cp .env.example .env
   # Edit .env with your configuration
   ```

3. **Start development server:**
   ```bash
   npm run dev
   ```

4. **Start production server:**
   ```bash
   npm start
   ```

## Dependencies Used

### Core
- `express` - Web framework
- `mongoose` - MongoDB ORM
- `dotenv` - Environment variables

### Authentication
- `jsonwebtoken` - JWT tokens
- `bcrypt` - Password hashing
- `passport` - Authentication strategies
- `passport-local` - Local strategy
- `passport-jwt` - JWT strategy
- `speakeasy` - 2FA TOTP
- `qrcode` - QR code generation

### Validation
- `express-validator` - Input validation

### Email
- `nodemailer` - Email sending
- `email-validator` - Email validation

### Utilities
- `uuid` - Unique ID generation
- `crypto` - Cryptographic functions

## API Design Patterns

### Error Handling
All endpoints use `asyncHandler` wrapper for error handling:
```javascript
exports.someEndpoint = asyncHandler(async (req, res) => {
  // Your code here
  // Errors are automatically caught and passed to error handler
});
```

### Validation
Input validation using express-validator:
```javascript
[
  body("email").isEmail(),
  body("rating").isInt({ min: 1, max: 5 }),
],
validate, // middleware that checks errors
controller.method
```

### Response Format
All responses follow standard format:
```json
{
  "success": true/false,
  "message": "Description",
  "data": { /* data */ }
}
```

## Testing Endpoints

### Using cURL
```bash
# Get public user profile
curl http://localhost:3000/api/v1/users/john_doe

# Get reviews with auth
curl -H "Authorization: Bearer <token>" \
  http://localhost:3000/api/v1/reviews/rule/123456
```

### Using Postman
1. Set Authorization type to "Bearer Token"
2. Paste JWT token
3. Make requests to endpoints

## Security Features

✅ JWT authentication
✅ Role-based access control
✅ Password hashing with bcrypt
✅ Input validation
✅ Two-factor authentication
✅ CORS protection
✅ Rate limiting ready
✅ SQL injection prevention (using Mongoose)
✅ XSS protection (via validation)
✅ CSRF tokens support

## Performance Considerations

- Database indexing on frequently queried fields
- Pagination for large result sets
- Lean queries where full documents not needed
- Async/await for non-blocking operations
- Error handling prevents crashes

## Future Enhancements

- [ ] Real-time notifications with WebSocket
- [ ] Advanced caching with Redis
- [ ] File upload for rule content
- [ ] Advanced search with Elasticsearch
- [ ] Admin dashboard
- [ ] Analytics and reporting
- [ ] API rate limiting
- [ ] Request logging
- [ ] Unit and integration tests
- [ ] API versioning

