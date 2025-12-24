# Utility Management Application

A comprehensive utility management application built with microservices architecture, allowing users to track and manage their utility bills (water, electricity, gas, and custom utilities) with analytics, alerts, and multi-user support.

## Features

- **User Authentication**: Secure registration and login with JWT tokens
- **Utility Management**: Create custom utility types and manage bills
- **Analytics**: View cost trends, usage patterns, and forecasts
- **Alerts & Notifications**: Set up bill reminders and threshold alerts
- **Multi-user Support**: Household management with member invitations
- **Modern UI**: Responsive React frontend with Material-UI

## Architecture

The application follows a microservices architecture:

- **API Gateway**: Single entry point for all client requests (Express.js)
- **User Service**: Authentication and user management
- **Utility Service**: Utility types and bill management
- **Analytics Service**: Data aggregation and analytics
- **Notification Service**: Alerts and notifications management
- **PostgreSQL Database**: Shared database for all services
- **React Frontend**: Modern single-page application

## Technology Stack

### Backend
- Node.js 18+
- Express.js
- PostgreSQL 15+
- JWT for authentication
- Docker & Docker Compose

### Frontend
- React 18
- Vite
- Material-UI (MUI)
- Recharts for data visualization
- React Router for navigation

## Getting Started

### Prerequisites

- Docker and Docker Compose installed
- Node.js 18+ (for local development)

### Installation

1. Clone the repository:
```bash
git clone <repository-url>
cd home-stat
```

2. Start all services with Docker Compose:
```bash
docker-compose up -d
```

This will start:
- PostgreSQL database on port 5432
- API Gateway on port 3000
- User Service on port 3001
- Utility Service on port 3002
- Analytics Service on port 3003
- Notification Service on port 3004

3. Access the application:
- Frontend: http://localhost:5173 (if running locally) or configure in docker-compose
- API Gateway: http://localhost:3000

### Development Setup

#### Backend Services

Each service can be run independently:

```bash
cd services/user-service
npm install
npm run dev
```

#### Frontend

```bash
cd frontend
npm install
npm run dev
```

The frontend will be available at http://localhost:5173

## API Endpoints

### Authentication
- `POST /api/users/register` - Register a new user
- `POST /api/users/login` - Login user

### Utility Types
- `GET /api/utilities/types` - Get all utility types
- `POST /api/utilities/types` - Create custom utility type
- `PUT /api/utilities/types/:id` - Update utility type
- `DELETE /api/utilities/types/:id` - Delete utility type

### Bills
- `GET /api/utilities/bills` - Get bills (with pagination and filters)
- `GET /api/utilities/bills/:id` - Get single bill
- `POST /api/utilities/bills` - Create bill
- `PUT /api/utilities/bills/:id` - Update bill
- `DELETE /api/utilities/bills/:id` - Delete bill

### Analytics
- `GET /api/analytics/cost-summary` - Get cost summary
- `GET /api/analytics/cost-trends` - Get cost trends over time
- `GET /api/analytics/usage-trends` - Get usage trends
- `GET /api/analytics/comparison` - Compare two periods
- `GET /api/analytics/forecast` - Get cost forecasts

### Alerts & Notifications
- `GET /api/notifications/alerts` - Get all alerts
- `POST /api/notifications/alerts` - Create alert
- `PUT /api/notifications/alerts/:id` - Update alert
- `DELETE /api/notifications/alerts/:id` - Delete alert
- `GET /api/notifications/notifications` - Get notifications

All endpoints (except register/login) require authentication via JWT token in the Authorization header:
```
Authorization: Bearer <token>
```

## Database Schema

The database includes the following tables:
- `users` - User accounts
- `households` - Household groups
- `household_members` - Household membership
- `utility_types` - Utility type definitions
- `bills` - Bill entries
- `alerts` - Alert configurations
- `notifications` - Notification records

See `database/init.sql` for the complete schema.

## Environment Variables

Each service uses environment variables. Key variables:

- `DATABASE_URL` - PostgreSQL connection string
- `JWT_SECRET` - Secret key for JWT tokens
- `PORT` - Service port number
- `NODE_ENV` - Environment (development/production)

## Project Structure

```
home-stat/
├── docs/
│   ├── business-requirements.md
│   └── technical-design.md
├── services/
│   ├── api-gateway/
│   ├── user-service/
│   ├── utility-service/
│   ├── analytics-service/
│   └── notification-service/
├── frontend/
├── database/
│   └── init.sql
├── docker-compose.yml
└── README.md
```

## Testing

To test the application:

1. Start all services: `docker-compose up -d`
2. Wait for services to be healthy
3. Access the frontend and create an account
4. Add utility types and bills
5. View analytics and set up alerts

## Troubleshooting

### Services not starting
- Check Docker logs: `docker-compose logs <service-name>`
- Ensure ports are not in use
- Verify database connection string

### Database connection issues
- Ensure PostgreSQL container is running: `docker-compose ps`
- Check database credentials in docker-compose.yml
- Verify database initialization completed

### Frontend not connecting
- Check API Gateway is running on port 3000
- Verify proxy configuration in vite.config.js
- Check browser console for errors

## Future Enhancements

- Email notifications
- Bill scanning/OCR
- Integration with utility provider APIs
- Mobile applications
- Advanced reporting and PDF generation
- Real-time notifications via WebSockets

## License

[Your License Here]

## Contributing

[Contributing Guidelines Here]

