# Technical Design Document
## Utility Management Application

### 1. System Architecture Overview

The application follows a microservices architecture pattern with the following components:

```
┌─────────────────────────────────────────────────────────────┐
│                        Frontend (React)                      │
│                    Next.js / Vite Application               │
└───────────────────────────┬─────────────────────────────────┘
                            │
                            │ HTTP/REST
                            │
┌───────────────────────────▼─────────────────────────────────┐
│                    API Gateway (Express.js)                  │
│              - Routing, Authentication, Rate Limiting        │
└───────┬───────────┬───────────┬───────────┬─────────────────┘
        │           │           │           │
        │           │           │           │
┌───────▼───┐ ┌─────▼─────┐ ┌──▼──────┐ ┌──▼──────────────┐
│   User    │ │  Utility  │ │Analytics│ │  Notification  │
│  Service  │ │  Service  │ │ Service │ │    Service     │
└───────┬───┘ └─────┬─────┘ └───┬─────┘ └──────┬─────────┘
        │           │           │               │
        └───────────┴───────────┴───────────────┘
                            │
                            │
                ┌───────────▼───────────┐
                │   PostgreSQL Database │
                │    (Shared Database)  │
                └───────────────────────┘
```

### 2. Technology Stack

#### 2.1 Frontend
- **Framework**: React 18+
- **Build Tool**: Vite (lightweight, fast)
- **UI Library**: Material-UI (MUI) or Tailwind CSS + Headless UI
- **State Management**: React Context API / Zustand
- **HTTP Client**: Axios
- **Charts**: Recharts or Chart.js
- **Form Handling**: React Hook Form
- **Routing**: React Router DOM

#### 2.2 Backend Services
- **Runtime**: Node.js 18+
- **Framework**: Express.js
- **Language**: TypeScript
- **Authentication**: JWT (jsonwebtoken)
- **Password Hashing**: bcrypt
- **Validation**: Joi or Zod
- **Database ORM**: Prisma or TypeORM
- **Logging**: Winston or Pino

#### 2.3 Database
- **Database**: PostgreSQL 15+
- **Connection Pooling**: pg-pool
- **Migrations**: Prisma Migrate or TypeORM Migrations

#### 2.4 Infrastructure
- **Containerization**: Docker & Docker Compose
- **Service Discovery**: Docker networking (internal DNS)
- **Environment Management**: dotenv

### 3. Microservices Design

#### 3.1 API Gateway Service

**Purpose**: Single entry point for all client requests, handles routing, authentication, and request/response transformation.

**Responsibilities**:
- Route requests to appropriate microservices
- Validate JWT tokens
- Rate limiting
- Request/response logging
- CORS handling
- Error handling and transformation

**Port**: 3000

**Endpoints**:
- All routes proxy to respective services (see service-specific endpoints below)

**Technology**: Express.js with http-proxy-middleware

#### 3.2 User Service

**Purpose**: Handles user authentication, registration, and user profile management.

**Port**: 3001

**Database Tables**: `users`, `households`, `household_members`

**API Endpoints**:

```
POST   /api/users/register
  Body: { email, password, full_name }
  Response: { user: { id, email, full_name }, token }

POST   /api/users/login
  Body: { email, password }
  Response: { user: { id, email, full_name }, token }

GET    /api/users/profile
  Headers: { Authorization: Bearer <token> }
  Response: { id, email, full_name, created_at }

PUT    /api/users/profile
  Headers: { Authorization: Bearer <token> }
  Body: { full_name?, email?, password? }
  Response: { id, email, full_name, updated_at }

POST   /api/users/households
  Headers: { Authorization: Bearer <token> }
  Body: { name }
  Response: { id, name, created_at }

GET    /api/users/households
  Headers: { Authorization: Bearer <token> }
  Response: [{ id, name, members: [...] }]

POST   /api/users/households/:id/members
  Headers: { Authorization: Bearer <token> }
  Body: { email }
  Response: { id, user_id, household_id, role }
```

**Key Features**:
- JWT token generation and validation
- Password hashing with bcrypt
- Email validation
- Household management

#### 3.3 Utility Service

**Purpose**: Manages utility types and bill entries.

**Port**: 3002

**Database Tables**: `utility_types`, `bills`

**API Endpoints**:

```
GET    /api/utilities/types
  Headers: { Authorization: Bearer <token> }
  Response: [{ id, name, description, unit_of_measurement, is_system_type }]

POST   /api/utilities/types
  Headers: { Authorization: Bearer <token> }
  Body: { name, description?, unit_of_measurement? }
  Response: { id, name, description, unit_of_measurement, created_at }

PUT    /api/utilities/types/:id
  Headers: { Authorization: Bearer <token> }
  Body: { name?, description?, unit_of_measurement? }
  Response: { id, name, description, unit_of_measurement, updated_at }

DELETE /api/utilities/types/:id
  Headers: { Authorization: Bearer <token> }
  Response: { success: true }

GET    /api/utilities/bills
  Headers: { Authorization: Bearer <token> }
  Query: { utility_type_id?, start_date?, end_date?, page?, limit? }
  Response: { bills: [...], total, page, limit }

GET    /api/utilities/bills/:id
  Headers: { Authorization: Bearer <token> }
  Response: { id, utility_type_id, amount, bill_date, due_date, usage_amount, notes }

POST   /api/utilities/bills
  Headers: { Authorization: Bearer <token> }
  Body: { utility_type_id, amount, bill_date, due_date?, usage_amount?, notes?, household_id? }
  Response: { id, utility_type_id, amount, bill_date, created_at }

PUT    /api/utilities/bills/:id
  Headers: { Authorization: Bearer <token> }
  Body: { utility_type_id?, amount?, bill_date?, due_date?, usage_amount?, notes? }
  Response: { id, utility_type_id, amount, bill_date, updated_at }

DELETE /api/utilities/bills/:id
  Headers: { Authorization: Bearer <token> }
  Response: { success: true }
```

**Key Features**:
- CRUD operations for utility types and bills
- Data validation
- User isolation (users can only access their own data)
- Pagination support

#### 3.4 Analytics Service

**Purpose**: Provides analytics, insights, and data aggregation for utility bills.

**Port**: 3003

**Database Tables**: Reads from `bills`, `utility_types`

**API Endpoints**:

```
GET    /api/analytics/cost-summary
  Headers: { Authorization: Bearer <token> }
  Query: { start_date?, end_date?, utility_type_id? }
  Response: {
    total_cost: number,
    average_monthly: number,
    by_utility_type: [{ utility_type_id, total, average }],
    period: { start_date, end_date }
  }

GET    /api/analytics/cost-trends
  Headers: { Authorization: Bearer <token> }
  Query: { start_date, end_date, utility_type_id?, group_by: 'month'|'quarter'|'year' }
  Response: {
    data: [{ period, total_cost, utility_type_id? }],
    period: { start_date, end_date }
  }

GET    /api/analytics/usage-trends
  Headers: { Authorization: Bearer <token> }
  Query: { start_date, end_date, utility_type_id?, group_by: 'month'|'quarter'|'year' }
  Response: {
    data: [{ period, total_usage, utility_type_id }],
    period: { start_date, end_date }
  }

GET    /api/analytics/comparison
  Headers: { Authorization: Bearer <token> }
  Query: { period1_start, period1_end, period2_start, period2_end, utility_type_id? }
  Response: {
    period1: { total_cost, average, usage },
    period2: { total_cost, average, usage },
    change: { cost_change_percent, usage_change_percent }
  }

GET    /api/analytics/forecast
  Headers: { Authorization: Bearer <token> }
  Query: { utility_type_id?, months_ahead: number }
  Response: {
    forecasts: [{ month, predicted_cost, confidence_level }]
  }
```

**Key Features**:
- Aggregation queries
- Time-series analysis
- Forecasting algorithms
- Performance optimization (caching, indexing)

#### 3.5 Notification Service

**Purpose**: Manages alerts and notifications for users.

**Port**: 3004

**Database Tables**: `alerts`, `notifications`

**API Endpoints**:

```
GET    /api/notifications/alerts
  Headers: { Authorization: Bearer <token> }
  Query: { is_active?: boolean }
  Response: [{ id, alert_type, utility_type_id, configuration, is_active }]

POST   /api/notifications/alerts
  Headers: { Authorization: Bearer <token> }
  Body: { alert_type, utility_type_id?, configuration }
  Response: { id, alert_type, configuration, is_active, created_at }

PUT    /api/notifications/alerts/:id
  Headers: { Authorization: Bearer <token> }
  Body: { configuration?, is_active? }
  Response: { id, alert_type, configuration, is_active, updated_at }

DELETE /api/notifications/alerts/:id
  Headers: { Authorization: Bearer <token> }
  Response: { success: true }

GET    /api/notifications/notifications
  Headers: { Authorization: Bearer <token> }
  Query: { is_read?: boolean, limit?, offset? }
  Response: { notifications: [...], total, unread_count }

PUT    /api/notifications/notifications/:id/read
  Headers: { Authorization: Bearer <token> }
  Response: { id, is_read: true }

POST   /api/notifications/check-thresholds
  Headers: { Authorization: Bearer <token> }
  Body: { bill_id }
  Response: { triggered_alerts: [...] }
```

**Key Features**:
- Alert configuration and management
- Threshold checking logic
- Notification generation
- Integration with bill entry (triggered when bills are added)

### 4. Database Schema

#### 4.1 Entity Relationship Diagram

```
┌─────────────┐         ┌──────────────┐
│    User     │         │  Household   │
│─────────────│         │──────────────│
│ id (PK)     │         │ id (PK)      │
│ email       │◄──┐     │ name         │
│ password    │   │     │ created_by   │
│ full_name   │   │     │ created_at   │
│ created_at  │   │     │ updated_at   │
│ updated_at  │   │     └──────┬───────┘
│ is_active   │   │            │
└──────┬──────┘   │            │
       │          │            │
       │          │     ┌──────▼──────────┐
       │          │     │ HouseholdMember │
       │          │     │─────────────────│
       │          │     │ id (PK)         │
       │          │     │ household_id    │
       │          └─────┤ user_id         │
       │                │ role            │
       │                │ joined_at       │
       │                └─────────────────┘
       │
       │
┌──────▼──────────┐
│  UtilityType    │
│─────────────────│
│ id (PK)         │
│ user_id (FK)    │
│ name            │
│ description     │
│ unit_of_measure │
│ is_system_type  │
│ created_at      │
│ updated_at      │
└──────┬──────────┘
       │
       │
┌──────▼──────┐         ┌──────────────┐
│    Bill     │         │    Alert     │
│─────────────│         │──────────────│
│ id (PK)     │         │ id (PK)      │
│ user_id     │         │ user_id      │
│ household_id│         │ alert_type   │
│ utility_id  │         │ utility_id   │
│ amount      │         │ configuration│
│ bill_date   │         │ is_active    │
│ due_date    │         │ last_triggered│
│ usage_amount│         │ created_at   │
│ notes       │         │ updated_at   │
│ created_at  │         └──────┬───────┘
│ updated_at  │                │
└─────────────┘                │
                               │
                      ┌────────▼──────────┐
                      │   Notification    │
                      │───────────────────│
                      │ id (PK)           │
                      │ user_id           │
                      │ alert_id          │
                      │ title             │
                      │ message           │
                      │ notification_type │
                      │ is_read           │
                      │ created_at        │
                      └───────────────────┘
```

#### 4.2 Database Tables

**users**
```sql
CREATE TABLE users (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    email VARCHAR(255) UNIQUE NOT NULL,
    password_hash VARCHAR(255) NOT NULL,
    full_name VARCHAR(255) NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    is_active BOOLEAN DEFAULT true
);

CREATE INDEX idx_users_email ON users(email);
```

**households**
```sql
CREATE TABLE households (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name VARCHAR(255) NOT NULL,
    created_by UUID NOT NULL REFERENCES users(id),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_households_created_by ON households(created_by);
```

**household_members**
```sql
CREATE TABLE household_members (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    household_id UUID NOT NULL REFERENCES households(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    role VARCHAR(20) DEFAULT 'member' CHECK (role IN ('owner', 'member')),
    joined_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(household_id, user_id)
);

CREATE INDEX idx_household_members_household ON household_members(household_id);
CREATE INDEX idx_household_members_user ON household_members(user_id);
```

**utility_types**
```sql
CREATE TABLE utility_types (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES users(id) ON DELETE CASCADE,
    name VARCHAR(255) NOT NULL,
    description TEXT,
    unit_of_measurement VARCHAR(50),
    is_system_type BOOLEAN DEFAULT false,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(user_id, name)
);

CREATE INDEX idx_utility_types_user ON utility_types(user_id);
CREATE INDEX idx_utility_types_system ON utility_types(is_system_type);
```

**bills**
```sql
CREATE TABLE bills (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    household_id UUID REFERENCES households(id) ON DELETE SET NULL,
    utility_type_id UUID NOT NULL REFERENCES utility_types(id) ON DELETE RESTRICT,
    amount DECIMAL(10,2) NOT NULL CHECK (amount > 0),
    bill_date DATE NOT NULL,
    due_date DATE,
    usage_amount DECIMAL(10,2) CHECK (usage_amount > 0),
    notes TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_bills_user ON bills(user_id);
CREATE INDEX idx_bills_household ON bills(household_id);
CREATE INDEX idx_bills_utility_type ON bills(utility_type_id);
CREATE INDEX idx_bills_date ON bills(bill_date);
CREATE INDEX idx_bills_user_date ON bills(user_id, bill_date);
```

**alerts**
```sql
CREATE TABLE alerts (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    alert_type VARCHAR(50) NOT NULL CHECK (alert_type IN ('bill_reminder', 'usage_threshold', 'cost_threshold')),
    utility_type_id UUID REFERENCES utility_types(id) ON DELETE CASCADE,
    configuration JSONB NOT NULL,
    is_active BOOLEAN DEFAULT true,
    last_triggered TIMESTAMP,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_alerts_user ON alerts(user_id);
CREATE INDEX idx_alerts_active ON alerts(user_id, is_active);
CREATE INDEX idx_alerts_type ON alerts(alert_type);
```

**notifications**
```sql
CREATE TABLE notifications (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    alert_id UUID REFERENCES alerts(id) ON DELETE SET NULL,
    title VARCHAR(255) NOT NULL,
    message TEXT NOT NULL,
    notification_type VARCHAR(20) DEFAULT 'info' CHECK (notification_type IN ('info', 'warning', 'alert')),
    is_read BOOLEAN DEFAULT false,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_notifications_user ON notifications(user_id);
CREATE INDEX idx_notifications_unread ON notifications(user_id, is_read);
CREATE INDEX idx_notifications_created ON notifications(created_at);
```

### 5. API Gateway Configuration

#### 5.1 Routing Rules

```
/api/users/*          → http://user-service:3001/*
/api/utilities/*      → http://utility-service:3002/*
/api/analytics/*      → http://analytics-service:3003/*
/api/notifications/*  → http://notification-service:3004/*
```

#### 5.2 Authentication Middleware

- Extract JWT token from `Authorization: Bearer <token>` header
- Validate token signature and expiration
- Extract user ID from token payload
- Attach user context to request
- Skip authentication for: `/api/users/register`, `/api/users/login`

#### 5.3 Error Handling

- Standardize error responses:
```json
{
  "error": {
    "code": "ERROR_CODE",
    "message": "Human-readable message",
    "details": {}
  }
}
```

- HTTP Status Codes:
  - 200: Success
  - 201: Created
  - 400: Bad Request
  - 401: Unauthorized
  - 403: Forbidden
  - 404: Not Found
  - 500: Internal Server Error

### 6. Docker Configuration

#### 6.1 Docker Compose Structure

```yaml
version: '3.8'

services:
  postgres:
    image: postgres:15-alpine
    environment:
      POSTGRES_DB: utility_db
      POSTGRES_USER: utility_user
      POSTGRES_PASSWORD: utility_pass
    ports:
      - "5432:5432"
    volumes:
      - postgres_data:/var/lib/postgresql/data
    networks:
      - utility-network

  api-gateway:
    build: ./services/api-gateway
    ports:
      - "3000:3000"
    environment:
      - NODE_ENV=development
      - USER_SERVICE_URL=http://user-service:3001
      - UTILITY_SERVICE_URL=http://utility-service:3002
      - ANALYTICS_SERVICE_URL=http://analytics-service:3003
      - NOTIFICATION_SERVICE_URL=http://notification-service:3004
      - JWT_SECRET=your-secret-key
    depends_on:
      - user-service
      - utility-service
      - analytics-service
      - notification-service
    networks:
      - utility-network

  user-service:
    build: ./services/user-service
    environment:
      - NODE_ENV=development
      - PORT=3001
      - DATABASE_URL=postgresql://utility_user:utility_pass@postgres:5432/utility_db
      - JWT_SECRET=your-secret-key
    depends_on:
      - postgres
    networks:
      - utility-network

  utility-service:
    build: ./services/utility-service
    environment:
      - NODE_ENV=development
      - PORT=3002
      - DATABASE_URL=postgresql://utility_user:utility_pass@postgres:5432/utility_db
    depends_on:
      - postgres
    networks:
      - utility-network

  analytics-service:
    build: ./services/analytics-service
    environment:
      - NODE_ENV=development
      - PORT=3003
      - DATABASE_URL=postgresql://utility_user:utility_pass@postgres:5432/utility_db
    depends_on:
      - postgres
    networks:
      - utility-network

  notification-service:
    build: ./services/notification-service
    environment:
      - NODE_ENV=development
      - PORT=3004
      - DATABASE_URL=postgresql://utility_user:utility_pass@postgres:5432/utility_db
    depends_on:
      - postgres
    networks:
      - utility-network

volumes:
  postgres_data:

networks:
  utility-network:
    driver: bridge
```

#### 6.2 Dockerfile Template (for each service)

```dockerfile
FROM node:18-alpine

WORKDIR /app

COPY package*.json ./
RUN npm ci --only=production

COPY . .

RUN npm run build

EXPOSE 3000

CMD ["node", "dist/index.js"]
```

### 7. Security Considerations

#### 7.1 Authentication & Authorization
- JWT tokens with 24-hour expiration
- Token refresh mechanism (optional enhancement)
- Password hashing with bcrypt (salt rounds: 10)
- HTTPS in production (reverse proxy like nginx)

#### 7.2 Data Protection
- Input validation on all endpoints
- SQL injection prevention (parameterized queries)
- XSS prevention (sanitize user input)
- CORS configuration
- Rate limiting on API Gateway

#### 7.3 Environment Variables
- Never commit secrets to version control
- Use environment variables for all sensitive data
- Different configurations for dev/staging/production

### 8. Error Handling Strategy

#### 8.1 Service-Level Errors
- Each service handles its own errors
- Standardized error response format
- Proper HTTP status codes
- Logging for debugging

#### 8.2 Gateway-Level Errors
- Catch and transform service errors
- Handle service unavailability
- Timeout handling
- Circuit breaker pattern (optional enhancement)

### 9. Logging Strategy

- Structured logging (JSON format)
- Log levels: error, warn, info, debug
- Include: timestamp, service name, request ID, user ID
- Centralized logging (optional: ELK stack)

### 10. Testing Strategy

#### 10.1 Unit Tests
- Test individual functions and modules
- Mock external dependencies
- Target: 80% code coverage

#### 10.2 Integration Tests
- Test service interactions
- Test database operations
- Test API endpoints

#### 10.3 End-to-End Tests
- Test complete user workflows
- Test frontend-backend integration

### 11. Deployment Considerations

#### 11.1 Development
- Docker Compose for local development
- Hot reload for services
- Development database with seed data

#### 11.2 Production
- Container orchestration (Kubernetes, Docker Swarm)
- Database backups
- Monitoring and alerting
- Load balancing
- Health checks

### 12. Performance Optimization

- Database indexing on frequently queried columns
- Query optimization
- Caching for analytics (Redis - optional)
- Pagination for large datasets
- Connection pooling

### 13. Future Enhancements

- Message queue (RabbitMQ/Kafka) for async processing
- Caching layer (Redis)
- Full-text search (Elasticsearch)
- Real-time notifications (WebSockets)
- GraphQL API
- Mobile app support
- Third-party integrations

