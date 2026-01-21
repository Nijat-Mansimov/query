# API Quick Reference Guide

## Authentication
All private endpoints require `Authorization: Bearer <JWT_TOKEN>` header.

---

## Review API

### Get Reviews for a Rule
```http
GET /api/v1/reviews/rule/:ruleId?page=1&limit=10&sort=helpful
```
**Sorting options:** `helpful`, `newest`, `oldest`
**Response:** Array of reviews with user info

### Get Single Review
```http
GET /api/v1/reviews/:id
```

### Get User's Reviews
```http
GET /api/v1/reviews/user/:username?page=1&limit=10
```

### Create Review
```http
POST /api/v1/reviews
Authorization: Bearer <token>

{
  "ruleId": "MongoDB ObjectId",
  "rating": 4,
  "comment": "Great rule!"
}
```

### Update Review
```http
PUT /api/v1/reviews/:id
Authorization: Bearer <token>

{
  "rating": 5,
  "comment": "Updated comment"
}
```

### Delete Review
```http
DELETE /api/v1/reviews/:id
Authorization: Bearer <token>
```

### Mark Review as Helpful
```http
POST /api/v1/reviews/:id/helpful
Authorization: Bearer <token>

{
  "helpful": true
}
```

### Report Review
```http
POST /api/v1/reviews/:id/report
Authorization: Bearer <token>

{
  "reason": "Inappropriate content"
}
```

---

## User API

### Get Current User Profile
```http
GET /api/v1/users/profile
Authorization: Bearer <token>
```

### Update Profile
```http
PUT /api/v1/users/profile
Authorization: Bearer <token>

{
  "profile": {
    "firstName": "John",
    "lastName": "Doe",
    "bio": "Security researcher",
    "location": "New York",
    "website": "https://example.com"
  }
}
```

### Change Password
```http
POST /api/v1/users/password
Authorization: Bearer <token>

{
  "currentPassword": "oldPassword123",
  "newPassword": "newPassword123"
}
```

### Request Password Reset
```http
POST /api/v1/users/password/reset-request

{
  "email": "user@example.com"
}
```

### Reset Password with Token
```http
POST /api/v1/users/password/reset

{
  "token": "reset_token_from_email",
  "newPassword": "newPassword123"
}
```

### Search Users
```http
GET /api/v1/users/search?query=john&limit=10
```

### Get Public User Profile
```http
GET /api/v1/users/:username
```

### Get User's Rules
```http
GET /api/v1/users/:username/rules?page=1&limit=10&status=PUBLISHED
```

### Get User Statistics
```http
GET /api/v1/users/stats
Authorization: Bearer <token>
```

### Get User Activity
```http
GET /api/v1/users/activity?page=1&limit=20
Authorization: Bearer <token>
```

### Get Notifications
```http
GET /api/v1/users/notifications?page=1&limit=20&unread=true
Authorization: Bearer <token>
```

### Mark Notification as Read
```http
POST /api/v1/users/notifications/:notificationId/read
Authorization: Bearer <token>
```

### Mark All Notifications as Read
```http
POST /api/v1/users/notifications/read-all
Authorization: Bearer <token>
```

### Delete Notification
```http
DELETE /api/v1/users/notifications/:notificationId
Authorization: Bearer <token>
```

### Get Seller Earnings
```http
GET /api/v1/users/earnings?period=month
Authorization: Bearer <token>
```
**Period options:** `week`, `month`, `year`, `all`

### Get Purchased Rules
```http
GET /api/v1/users/me/purchases
Authorization: Bearer <token>
```

### Setup 2FA
```http
POST /api/v1/users/2fa/setup
Authorization: Bearer <token>
```
**Response:** Secret and QR code for scanning

### Verify and Enable 2FA
```http
POST /api/v1/users/2fa/verify
Authorization: Bearer <token>

{
  "token": "123456",
  "secret": "base32_secret_from_setup"
}
```

### Disable 2FA
```http
POST /api/v1/users/2fa/disable
Authorization: Bearer <token>

{
  "token": "123456"
}
```

---

## Transaction API

### Get User's Transactions
```http
GET /api/v1/transactions/my?page=1&limit=20&type=all
Authorization: Bearer <token>
```
**Type options:** `all`, `purchases`, `sales`

### Get Transaction Details
```http
GET /api/v1/transactions/:id
Authorization: Bearer <token>
```

### Purchase Rule
```http
POST /api/v1/transactions/purchase
Authorization: Bearer <token>

{
  "ruleId": "MongoDB ObjectId",
  "paymentMethodId": "stripe_payment_method_id"
}
```
**Response:** Transaction details and license key

### Request Refund
```http
POST /api/v1/transactions/:id/refund
Authorization: Bearer <token>

{
  "reason": "Rule doesn't work as expected"
}
```
**Note:** Available within 30 days of purchase

### Get Seller Earnings
```http
GET /api/v1/transactions/earnings/seller?period=month
Authorization: Bearer <token>
```

---

## Admin API

### Get All Transactions
```http
GET /api/v1/transactions?page=1&limit=20&status=COMPLETED&paymentMethod=STRIPE
Authorization: Bearer <admin_token>
```

### Get Platform Statistics
```http
GET /api/v1/transactions/stats/platform?period=month
Authorization: Bearer <admin_token>
```

### Process Refund
```http
POST /api/v1/transactions/:id/refund/process
Authorization: Bearer <admin_token>

{
  "approved": true
}
```

---

## Common Error Responses

### 400 Bad Request
```json
{
  "success": false,
  "message": "Validation failed",
  "errors": [
    {
      "msg": "Email is required",
      "param": "email"
    }
  ]
}
```

### 401 Unauthorized
```json
{
  "success": false,
  "message": "Unauthorized access"
}
```

### 403 Forbidden
```json
{
  "success": false,
  "message": "You do not have permission to perform this action"
}
```

### 404 Not Found
```json
{
  "success": false,
  "message": "Resource not found"
}
```

### 500 Internal Server Error
```json
{
  "success": false,
  "message": "Internal server error"
}
```

---

## Status Codes Reference

- `200` - OK
- `201` - Created
- `400` - Bad Request
- `401` - Unauthorized
- `403` - Forbidden
- `404` - Not Found
- `409` - Conflict
- `500` - Internal Server Error
- `501` - Not Implemented

---

## Authentication Header Example
```
Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
```

---

## Pagination Query Parameters

Used in list endpoints:
- `page` - Page number (default: 1)
- `limit` - Items per page (default: 10-20)

**Response includes:**
```json
{
  "success": true,
  "data": {
    "items": [],
    "pagination": {
      "total": 100,
      "page": 1,
      "limit": 10,
      "pages": 10
    }
  }
}
```

---

## Rate Limits (To be implemented)

- General endpoints: 100 requests/hour per IP
- Authentication endpoints: 5 attempts/15 minutes
- Payment endpoints: 10 requests/hour per user

