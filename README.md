# Security Rules Platform - Backend API

Professional security rule və query paylaşım platforması üçün RESTful API backend.

## 🎯 Xüsusiyyətlər

### Authentication & Authorization
- ✅ Passport.js əsaslı authentication
- ✅ JWT access + refresh token mexanizmi
- ✅ Email verification flow
- ✅ Password reset funksiyası
- ✅ 2FA (TOTP) dəstəyi
- ✅ Role-based access control (USER, VERIFIED_CONTRIBUTOR, MODERATOR, ADMIN)
- ✅ Permission-based authorization

### Rule Management
- ✅ Rule yaradılması (draft mode)
- ✅ Public/Private/Unlisted visibility
- ✅ Rule versioning sistemi
- ✅ Rule fork/clone funksiyası
- ✅ Advanced filtering və search
- ✅ MITRE ATT&CK mapping
- ✅ Multiple query language support (SIGMA, KQL, SPL, YARA, və s.)

### Monetization
- ✅ Free və paid rule dəstəyi
- ✅ Rule satış infrastrukturu
- ✅ Transaction tracking
- ✅ Purchase history
- ✅ Preview masking (paid rules üçün)
- ✅ Platform fee hesablama

### Security
- ✅ Helmet.js middleware
- ✅ Rate limiting
- ✅ MongoDB injection qorunması
- ✅ CORS konfiqurasiyası
- ✅ Token blacklist (Redis hazır)
- ✅ Secure password hashing (bcrypt)

## 📋 Tələblər

- Node.js >= 16.x
- MongoDB >= 5.x
- Redis >= 6.x (optional, token blacklist üçün)
- npm və ya yarn

## 🚀 Quraşdırma

### 1. Repository-ni clone edin

```bash
git clone <repository-url>
cd security-rules-platform
```

### 2. Dependencies yükləyin

```bash
npm install
```

### 3. Environment variables konfiqurasiya edin

`.env.example` faylını `.env` olaraq kopyalayın:

```bash
cp .env.example .env
```

`.env` faylında aşağıdakı parametrləri düzəldin:

```env
# Database
MONGODB_URI=mongodb://localhost:27017/security-rules-platform

# JWT Secrets (production-da mütləq dəyişdirin!)
JWT_SECRET=your-super-secret-jwt-key
JWT_REFRESH_SECRET=your-refresh-secret-key

# Email (Gmail nümunəsi)
EMAIL_HOST=smtp.gmail.com
EMAIL_PORT=587
EMAIL_USER=your-email@gmail.com
EMAIL_PASSWORD=your-app-password
EMAIL_FROM=noreply@securityrules.com

# Frontend URL
FRONTEND_URL=http://localhost:3000
```

### 4. MongoDB-ni işə salın

```bash
# MongoDB local olaraq işləyirsə:
mongod

# və ya Docker ilə:
docker run -d -p 27017:27017 --name mongodb mongo:latest
```

### 5. Server-i başladın

```bash
# Development mode
npm run dev

# Production mode
npm start
```

Server default olaraq `http://localhost:5000` ünvanında işləyəcək.

## 📚 API Documentation

### Base URL
```
http://localhost:5000/api/v1
```

### Authentication Endpoints

#### Register
```http
POST /api/v1/auth/register
Content-Type: application/json

{
  "email": "user@example.com",
  "password": "SecurePass123",
  "username": "johndoe",
  "firstName": "John",
  "lastName": "Doe"
}
```

#### Login
```http
POST /api/v1/auth/login
Content-Type: application/json

{
  "email": "user@example.com",
  "password": "SecurePass123"
}
```

Response:
```json
{
  "success": true,
  "message": "Login successful",
  "data": {
    "user": {
      "id": "...",
      "email": "user@example.com",
      "username": "johndoe",
      "role": "USER"
    },
    "tokens": {
      "accessToken": "eyJhbGc...",
      "refreshToken": "eyJhbGc...",
      "expiresIn": 900
    }
  }
}
```

#### Refresh Token
```http
POST /api/v1/auth/refresh
Content-Type: application/json

{
  "refreshToken": "eyJhbGc..."
}
```

#### Logout
```http
POST /api/v1/auth/logout
Authorization: Bearer <access_token>
Content-Type: application/json

{
  "refreshToken": "eyJhbGc..."
}
```

### Rule Endpoints

#### Create Rule
```http
POST /api/v1/rules
Authorization: Bearer <access_token>
Content-Type: application/json

{
  "title": "Detect Suspicious PowerShell Activity",
  "description": "Detects encoded PowerShell commands...",
  "queryLanguage": "KQL",
  "vendor": "MICROSOFT_SENTINEL",
  "category": "DETECTION",
  "severity": "HIGH",
  "tags": ["powershell", "execution", "command-line"],
  "mitreAttack": {
    "tactics": ["TA0002"],
    "techniques": ["T1059.001"]
  },
  "ruleContent": {
    "query": "DeviceProcessEvents | where FileName =~ 'powershell.exe'...",
    "metadata": {
      "author": "Security Team",
      "references": ["https://..."]
    }
  },
  "visibility": "PUBLIC",
  "pricing": {
    "isPaid": false
  }
}
```

#### Get All Rules (with filters)
```http
GET /api/v1/rules?page=1&limit=20&queryLanguage=KQL&category=DETECTION&severity=HIGH&isPaid=false
```

#### Get Rule by ID
```http
GET /api/v1/rules/:id
Authorization: Bearer <access_token> (optional)
```

#### Update Rule
```http
PUT /api/v1/rules/:id
Authorization: Bearer <access_token>
Content-Type: application/json

{
  "title": "Updated Title",
  "description": "Updated description..."
}
```

#### Publish Rule
```http
POST /api/v1/rules/:id/publish
Authorization: Bearer <access_token>
```

#### Fork Rule
```http
POST /api/v1/rules/:id/fork
Authorization: Bearer <access_token>
```

#### Download Rule
```http
POST /api/v1/rules/:id/download
Authorization: Bearer <access_token>
```

### Query Parameters (Filtering)

Rules endpoint-i aşağıdakı filter parametrlərini dəstəkləyir:

- `queryLanguage`: SIGMA, KQL, SPL, YARA, SURICATA, SNORT, LUCENE, ESQL, SQL, XQL, CUSTOM
- `vendor`: ELASTIC, SPLUNK, MICROSOFT_SENTINEL, CHRONICLE, QRADAR, ARCSIGHT, SUMO_LOGIC, PALO_ALTO_XDR, PALO_ALTO_XSIAM, GENERIC
- `category`: DETECTION, HUNTING, CORRELATION, ENRICHMENT, RESPONSE, MONITORING, FORENSICS
- `severity`: LOW, MEDIUM, HIGH, CRITICAL
- `isPaid`: true/false
- `minRating`: 0-5
- `tags`: comma-separated list
- `mitreTactics`: comma-separated list
- `mitreTechniques`: comma-separated list
- `search`: text search
- `sort`: -createdAt, -rating, -downloads, title
- `page`: page number
- `limit`: items per page (max 100)

## 🏗️ Project Structure

```
src/
├── config/
│   └── passport.js          # Passport authentication config
├── controllers/
│   ├── authController.js    # Authentication logic
│   └── ruleController.js    # Rule management logic
├── middleware/
│   └── auth.js              # Auth middleware (JWT, RBAC)
├── models/
│   ├── User.js              # User schema
│   ├── Rule.js              # Rule schema
│   ├── RuleVersion.js       # Version tracking
│   ├── Transaction.js       # Payment transactions
│   ├── Purchase.js          # Purchase records
│   ├── Review.js            # Rule reviews
│   ├── Activity.js          # User activity logs
│   ├── Category.js          # Categories
│   └── Notification.js      # User notifications
├── routes/
│   ├── authRoutes.js        # Auth endpoints
│   ├── ruleRoutes.js        # Rule endpoints
│   ├── userRoutes.js        # User profile endpoints
│   ├── transactionRoutes.js # Transaction endpoints
│   └── reviewRoutes.js      # Review endpoints
├── utils/
│   └── email.js             # Email utilities
└── server.js                # Main application file
```

## 🔐 Roles & Permissions

### USER
- Rule create/update/delete (own rules only)
- Rule read (public rules)
- Purchase rules

### VERIFIED_CONTRIBUTOR
- All USER permissions
- Auto-publish rules (skip review)

### MODERATOR
- All VERIFIED_CONTRIBUTOR permissions
- Approve/reject rules
- Update/delete any rule
- Moderate users

### ADMIN
- All permissions
- System configuration
- User role management

## 🧪 Testing

```bash
# Run all tests
npm test

# Watch mode
npm run test:watch

# Coverage report
npm run test:cov
```

## 📦 Deployment

### Production checklist

1. ✅ `.env` faylında production secrets istifadə edin
2. ✅ `NODE_ENV=production` set edin
3. ✅ MongoDB connection string-i secure edin
4. ✅ Redis-i enable edin (token blacklist üçün)
5. ✅ Email service konfiqurasiya edin
6. ✅ CORS origin-i məhdudlaşdırın
7. ✅ Rate limiting parametrlərini ayarlayın
8. ✅ Monitoring və logging setup edin

### Docker Deployment

```dockerfile
FROM node:18-alpine
WORKDIR /app
COPY package*.json ./
RUN npm ci --only=production
COPY . .
EXPOSE 5000
CMD ["node", "src/server.js"]
```

```bash
docker build -t security-rules-api .
docker run -p 5000:5000 --env-file .env security-rules-api
```

## 🔄 Gələcək İnkişaf Planı

- [ ] Elasticsearch integration (advanced search)
- [ ] OAuth providers (Google, GitHub)
- [ ] Stripe payment integration
- [ ] AI-powered query generation
- [ ] Real-time notifications (WebSocket)
- [ ] API rate limiting per user
- [ ] GraphQL API
- [ ] Admin dashboard endpoints
- [ ] Analytics və reporting
- [ ] Rule testing/validation sandbox

## 🤝 Contributing

1. Fork the repository
2. Create feature branch (`git checkout -b feature/amazing-feature`)
3. Commit changes (`git commit -m 'Add amazing feature'`)
4. Push to branch (`git push origin feature/amazing-feature`)
5. Open Pull Request

## 📝 License

MIT License - see LICENSE file for details

## 📧 Contact

Security Rules Platform Team - support@securityrules.com

---

**Made with ❤️ for the Security Community**