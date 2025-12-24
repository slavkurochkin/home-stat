# Quick Start Guide

## Prerequisites

- Docker Desktop installed and running
- Docker Compose installed

## Starting the Application

1. **Start all services:**
```bash
docker-compose up -d
```

2. **Check service status:**
```bash
docker-compose ps
```

All services should show as "Up" and healthy.

3. **View logs (optional):**
```bash
docker-compose logs -f
```

## Accessing the Application

### Frontend (Development)

If you want to run the frontend locally for development:

```bash
cd frontend
npm install
npm run dev
```

Then access: http://localhost:5173

### API Gateway

The API Gateway is available at: http://localhost:3000

### Direct Service Access (for testing)

- User Service: http://localhost:3001
- Utility Service: http://localhost:3002
- Analytics Service: http://localhost:3003
- Notification Service: http://localhost:3004

## First Steps

1. **Register a new account:**
   - Navigate to the frontend
   - Click "Sign Up"
   - Enter your details (email, password, full name)
   - Password must be at least 8 characters with letters and numbers

2. **Add a utility type (optional):**
   - System types (Water, Electricity, Gas) are available by default
   - You can create custom utility types from the Bills page

3. **Add your first bill:**
   - Go to Bills page
   - Click "Add Bill"
   - Fill in the details and save

4. **View Analytics:**
   - Navigate to Analytics page
   - View cost trends and summaries

5. **Set up Alerts:**
   - Go to Alerts page
   - Create alerts for bill reminders or thresholds

## Stopping the Application

```bash
docker-compose down
```

To also remove volumes (database data):
```bash
docker-compose down -v
```

## Troubleshooting

### Services won't start
- Ensure Docker is running
- Check if ports 3000-3004 and 5432 are available
- View logs: `docker-compose logs <service-name>`

### Database connection errors
- Wait a few seconds for PostgreSQL to initialize
- Check database logs: `docker-compose logs postgres`
- Verify DATABASE_URL in docker-compose.yml

### Frontend connection issues
- Ensure API Gateway is running: `curl http://localhost:3000/health`
- Check browser console for errors
- Verify proxy settings in vite.config.js

## Testing the API

### Register a user:
```bash
curl -X POST http://localhost:3000/api/users/register \
  -H "Content-Type: application/json" \
  -d '{"email":"test@example.com","password":"test1234","full_name":"Test User"}'
```

### Login:
```bash
curl -X POST http://localhost:3000/api/users/login \
  -H "Content-Type: application/json" \
  -d '{"email":"test@example.com","password":"test1234"}'
```

Save the token from the response and use it in subsequent requests:
```bash
curl -X GET http://localhost:3000/api/utilities/types \
  -H "Authorization: Bearer <your-token>"
```

## Development Mode

To run services in development mode with hot reload:

1. Stop Docker containers: `docker-compose down`
2. Start only the database: `docker-compose up -d postgres`
3. Run each service locally:
   ```bash
   cd services/user-service
   npm install
   npm run dev
   ```
4. Repeat for other services
5. Run frontend: `cd frontend && npm run dev`

## Database Access

To access the PostgreSQL database directly:

```bash
docker-compose exec postgres psql -U utility_user -d utility_db
```

## Health Checks

Check service health:
- API Gateway: http://localhost:3000/health
- User Service: http://localhost:3001/health
- Utility Service: http://localhost:3002/health
- Analytics Service: http://localhost:3003/health
- Notification Service: http://localhost:3004/health

