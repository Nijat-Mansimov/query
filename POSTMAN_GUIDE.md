# Postman Collection Import Guide

## 📥 How to Import the Collection

### Method 1: Direct Import (Recommended)

1. **Open Postman** application
2. Click **Import** button (top left corner)
3. Select **Upload Files** tab
4. Browse and select `Postman_Collection.json` from your project root
5. Click **Import**

### Method 2: Link Import

1. Open Postman
2. Click **Import** → **Link** tab
3. Paste raw GitHub URL or file path
4. Click **Import**

---

## ⚙️ Setup Environment Variables

### Create a New Environment

1. Click **Environments** (left sidebar)
2. Click **Create Environment**
3. Name: `Security Rules Platform`
4. Add these variables:

| Variable | Initial Value | Current Value |
|----------|---|---|
| `base_url` | `http://localhost:5000` | `http://localhost:5000` |
| `access_token` | `your_jwt_access_token` | *(paste your token after login)* |
| `admin_token` | `your_admin_jwt_token` | *(paste admin token)* |
| `user_id` | `mongodb_user_id` | *(paste user ID)* |
| `rule_id` | `mongodb_rule_id` | *(paste rule ID)* |
| `review_id` | `mongodb_review_id` | *(paste review ID)* |
| `transaction_id` | `mongodb_transaction_id` | *(paste transaction ID)* |
| `notification_id` | `mongodb_notification_id` | *(paste notification ID)* |

5. Click **Save**

### Select Environment

1. Top right, select dropdown (currently shows "No Environment")
2. Choose **Security Rules Platform**

---

## 🔐 Get Access Tokens

### Step 1: Register or Login

**Register:**
```
POST /api/v1/auth/register
{
  "username": "testuser",
  "email": "test@example.com",
  "password": "SecurePass123",
  "confirmPassword": "SecurePass123"
}
```

**Login:**
```
POST /api/v1/auth/login
{
  "email": "test@example.com",
  "password": "SecurePass123"
}
```

Response will contain `accessToken` and `refreshToken`

### Step 2: Save Token to Environment

1. Copy `accessToken` from response
2. Go to Environment settings
3. Paste into `access_token` variable
4. Click **Save**

---

## 📋 Collection Structure

The collection is organized into 6 main folders:

### 1️⃣ Authentication (5 endpoints)
- Register User
- Login
- Refresh Token
- Verify Email
- Logout

### 2️⃣ User Management (16 endpoints)
- Get My Profile
- Update My Profile
- Change Password
- Password Reset
- Get Public Profiles
- Notifications Management
- Purchase History
- Earnings
- 2FA Setup

### 3️⃣ Reviews (8 endpoints)
- Get Reviews for Rule
- Create Review
- Update Review
- Delete Review
- Mark as Helpful
- Report Review

### 4️⃣ Transactions (6 endpoints)
- Get My Transactions
- Get Transaction Details
- Purchase Rule
- Request Refund
- Get Seller Earnings

### 5️⃣ Admin Dashboard (10 endpoints)
- Dashboard Overview
- User Management
- Rule Moderation
- Review Moderation
- System Logs

### 6️⃣ Analytics (7 endpoints)
- Platform Analytics
- User Behavior
- Rule Performance
- Revenue Analytics
- Review Analytics
- Custom Reports
- Export to CSV

### 7️⃣ Utility (3 endpoints)
- Health Check
- API Info
- WebSocket Status

---

## 🚀 Quick Start: Common Workflows

### Workflow 1: Complete User Journey

1. **Register Account**
   ```
   Folder: Authentication → Register User
   ```
   - Fill in username, email, password
   - Send request
   - Save the response

2. **Verify Email**
   ```
   Folder: Authentication → Verify Email
   ```
   - Use verification token from email
   - Send request

3. **Login**
   ```
   Folder: Authentication → Login
   ```
   - Use email and password
   - Copy `accessToken` to environment
   - Send request

4. **Get Profile**
   ```
   Folder: User Management → Get My Profile
   ```
   - Should show your profile info
   - Send request

5. **Update Profile**
   ```
   Folder: User Management → Update My Profile
   ```
   - Fill in bio, location, etc.
   - Send request

### Workflow 2: Create and Review a Rule

1. **Create Rule** (see ruleRoutes in API_REFERENCE.md)
   ```
   POST /api/v1/rules
   ```

2. **Create Review**
   ```
   Folder: Reviews → Create Review
   ```
   - Use the rule ID from step 1
   - Fill in rating and comment
   - Send request

3. **Get Reviews**
   ```
   Folder: Reviews → Get Reviews for Rule
   ```
   - Use the rule ID
   - Should show your review
   - Send request

### Workflow 3: Purchase Rule

1. **Purchase Rule**
   ```
   Folder: Transactions → Purchase Rule
   ```
   - Use rule ID
   - Use payment method ID
   - Send request

2. **Get Transaction Details**
   ```
   Folder: Transactions → Get Transaction Details
   ```
   - Use transaction ID from response
   - Send request

3. **Get My Transactions**
   ```
   Folder: Transactions → Get My Transactions
   ```
   - Should list your purchases
   - Send request

### Workflow 4: Admin Dashboard

**Note:** Requires admin token in environment

1. **Get Dashboard**
   ```
   Folder: Admin Dashboard → Get Dashboard Overview
   ```
   - Shows platform metrics
   - Send request

2. **Get Users**
   ```
   Folder: Admin Dashboard → Get Users
   ```
   - Can filter by role and status
   - Send request

3. **Get Pending Rules**
   ```
   Folder: Admin Dashboard → Get Rules for Moderation
   ```
   - Status = PENDING_REVIEW
   - Send request

4. **Moderate Rule**
   ```
   Folder: Admin Dashboard → Moderate Rule (Approve/Reject)
   ```
   - Set approved to true/false
   - Add reason
   - Send request

5. **View Analytics**
   ```
   Folder: Analytics → Platform Analytics
   ```
   - Shows platform stats
   - Send request

---

## 💡 Tips & Tricks

### Auto-Run Tests

1. Select folder (e.g., "Authentication")
2. Click **Run** (with play icon)
3. Postman will run all requests in sequence
4. View results in Collection Runner

### Set Pre-request Scripts

For automatic token extraction:

1. Select "Login" request
2. Click **Tests** tab
3. Add script:
```javascript
if (pm.response.code === 200) {
  const response = pm.response.json();
  pm.environment.set("access_token", response.data.accessToken);
  pm.environment.set("refreshToken", response.data.refreshToken);
}
```

### Use Response Data in Next Request

1. In any request that returns an ID
2. Go to **Tests** tab
3. Add:
```javascript
if (pm.response.code === 201) {
  const response = pm.response.json();
  pm.environment.set("rule_id", response.data._id);
}
```

---

## 🔍 Common API Responses

### Success Response (200/201)
```json
{
  "success": true,
  "data": {
    /* response data */
  }
}
```

### Error Response (400/401/403/404/500)
```json
{
  "success": false,
  "message": "Error description",
  "errors": []
}
```

### Pagination Response
```json
{
  "success": true,
  "data": {
    "items": [],
    "pagination": {
      "page": 1,
      "limit": 10,
      "total": 100,
      "pages": 10
    }
  }
}
```

---

## 🐛 Troubleshooting

### Issue: 401 Unauthorized

**Cause:** Missing or invalid token

**Solution:**
1. Generate new token via Login
2. Copy token to `access_token` environment variable
3. Make sure environment is selected
4. Retry request

### Issue: 403 Forbidden

**Cause:** User doesn't have required role

**Solution:**
1. For admin endpoints, use `admin_token` instead
2. Verify user has ADMIN role
3. Create new admin account or promote existing user

### Issue: 404 Not Found

**Cause:** Resource doesn't exist

**Solution:**
1. Check the resource ID is correct
2. Try getting list of resources first
3. Use ID from list in detailed request

### Issue: 429 Too Many Requests

**Cause:** Rate limit exceeded

**Solution:**
1. Wait for rate limit window (15 minutes)
2. Check rate limit headers in response
3. Use admin account to bypass limits

### Issue: Variables Not Working

**Cause:** Environment not selected

**Solution:**
1. Top right, ensure environment is selected
2. Go to Environments → verify variables
3. Click Save after making changes

---

## 📊 API Endpoints Summary

### Authentication (5)
```
POST   /api/v1/auth/register
POST   /api/v1/auth/login
POST   /api/v1/auth/refresh
POST   /api/v1/auth/verify-email
POST   /api/v1/auth/logout
```

### User Management (16)
```
GET    /api/v1/users/profile
PUT    /api/v1/users/profile
POST   /api/v1/users/password
POST   /api/v1/users/password/reset-request
POST   /api/v1/users/password/reset
GET    /api/v1/users/:username
GET    /api/v1/users/:username/rules
GET    /api/v1/users/search
GET    /api/v1/users/activity
GET    /api/v1/users/notifications
POST   /api/v1/users/notifications/:id/read
POST   /api/v1/users/notifications/read-all
DELETE /api/v1/users/notifications/:id
GET    /api/v1/users/me/purchases
GET    /api/v1/users/earnings
```

### Reviews (8)
```
GET    /api/v1/reviews/rule/:ruleId
GET    /api/v1/reviews/:reviewId
GET    /api/v1/reviews/user/:username
POST   /api/v1/reviews
PUT    /api/v1/reviews/:reviewId
DELETE /api/v1/reviews/:reviewId
POST   /api/v1/reviews/:reviewId/helpful
POST   /api/v1/reviews/:reviewId/report
```

### Transactions (6)
```
GET    /api/v1/transactions/my
GET    /api/v1/transactions/:id
POST   /api/v1/transactions/purchase
POST   /api/v1/transactions/:id/refund
GET    /api/v1/transactions/earnings/seller
```

### Admin (10)
```
GET    /api/v1/admin/dashboard
GET    /api/v1/admin/users
PUT    /api/v1/admin/users/:userId/role
POST   /api/v1/admin/users/:userId/suspend
POST   /api/v1/admin/users/:userId/unsuspend
GET    /api/v1/admin/rules
POST   /api/v1/admin/rules/:ruleId/moderate
GET    /api/v1/admin/reviews
POST   /api/v1/admin/reviews/:reviewId/action
GET    /api/v1/admin/logs
```

### Analytics (7)
```
GET    /api/v1/admin/analytics/platform
GET    /api/v1/admin/analytics/user-behavior
GET    /api/v1/admin/analytics/rules
GET    /api/v1/admin/analytics/revenue
GET    /api/v1/admin/analytics/reviews
POST   /api/v1/admin/analytics/report
GET    /api/v1/admin/analytics/export
```

---

## 🎯 Next Steps

1. **Import Collection** (follow steps above)
2. **Create Environment** with variables
3. **Get Access Token** via Login
4. **Run Workflows** (Authentication → User → Reviews → Transactions)
5. **Test Admin Endpoints** with admin token
6. **Explore Analytics** for platform insights

---

## 📚 Additional Resources

- Full API Reference: `API_REFERENCE.md`
- Advanced Features: `ADVANCED_FEATURES.md`
- Quick Reference: `QUICK_REFERENCE.md`
- Implementation Summary: `ADVANCED_FEATURES_SUMMARY.md`

---

## ✨ Features

✅ 60+ API endpoints
✅ Complete request/response examples
✅ Environment variables for easy switching
✅ Pre-built workflows
✅ Authentication examples
✅ Admin functionality
✅ Analytics queries
✅ Rate limiting information
✅ Error handling patterns
✅ Real-time WebSocket support

---

**Ready to test!** 🚀

Import the collection and start exploring the API!
