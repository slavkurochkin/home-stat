#!/bin/bash

echo "=== Fixing Services ==="
echo ""

# Colors
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m'

# Step 1: Stop all services
echo -e "${YELLOW}Step 1: Stopping all services...${NC}"
docker-compose down
echo ""

# Step 2: Remove old containers and images (optional, uncomment if needed)
# echo -e "${YELLOW}Step 2: Removing old containers...${NC}"
# docker-compose rm -f
# echo ""

# Step 3: Start PostgreSQL first
echo -e "${YELLOW}Step 2: Starting PostgreSQL database...${NC}"
docker-compose up -d postgres
echo ""

# Step 4: Wait for database to be ready
echo -e "${YELLOW}Step 3: Waiting for database to initialize (15 seconds)...${NC}"
sleep 15

# Step 5: Check database health
echo -e "${YELLOW}Step 4: Checking database health...${NC}"
db_ready=false
for i in {1..10}; do
  if docker-compose exec -T postgres pg_isready -U utility_user -d utility_db > /dev/null 2>&1; then
    echo -e "${GREEN}✓ Database is ready${NC}"
    db_ready=true
    break
  else
    echo "  Waiting for database... ($i/10)"
    sleep 2
  fi
done

if [ "$db_ready" = false ]; then
  echo -e "${RED}✗ Database did not become ready in time${NC}"
  echo "  Continuing anyway..."
fi
echo ""

# Step 6: Build all services
echo -e "${YELLOW}Step 5: Building all services...${NC}"
docker-compose build --no-cache
echo ""

# Step 7: Start all services
echo -e "${YELLOW}Step 6: Starting all services...${NC}"
docker-compose up -d
echo ""

# Step 8: Wait for services to start
echo -e "${YELLOW}Step 7: Waiting for services to start (10 seconds)...${NC}"
sleep 10

# Step 9: Check service status
echo -e "${YELLOW}Step 8: Checking service status...${NC}"
docker-compose ps
echo ""

# Step 10: Check logs for errors
echo -e "${YELLOW}Step 9: Checking for startup errors...${NC}"
echo ""
echo "API Gateway logs (last 10 lines):"
docker-compose logs --tail=10 api-gateway
echo ""
echo "User Service logs (last 10 lines):"
docker-compose logs --tail=10 user-service
echo ""

# Step 11: Test endpoints
echo -e "${YELLOW}Step 10: Testing service endpoints...${NC}"
echo ""

# Test API Gateway
echo "Testing API Gateway (http://localhost:3000/health)..."
gateway_response=$(curl -s -w "\n%{http_code}" http://localhost:3000/health 2>/dev/null)
gateway_code=$(echo "$gateway_response" | tail -n1)
if [ "$gateway_code" = "200" ]; then
  echo -e "${GREEN}✓ API Gateway is healthy${NC}"
else
  echo -e "${RED}✗ API Gateway returned HTTP $gateway_code${NC}"
fi

# Test User Service
echo "Testing User Service (http://localhost:3001/health)..."
user_response=$(curl -s -w "\n%{http_code}" http://localhost:3001/health 2>/dev/null)
user_code=$(echo "$user_response" | tail -n1)
if [ "$user_code" = "200" ]; then
  echo -e "${GREEN}✓ User Service is healthy${NC}"
else
  echo -e "${RED}✗ User Service returned HTTP $user_code${NC}"
fi

echo ""
echo -e "${GREEN}=== Fix Complete ===${NC}"
echo ""
echo "Next steps:"
echo "1. Check logs if services aren't healthy:"
echo "   docker-compose logs -f [service-name]"
echo ""
echo "2. Test signup flow:"
echo "   ./test-signup.sh"
echo ""
echo "3. Or access the frontend:"
echo "   http://localhost:5173/register"

