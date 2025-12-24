#!/bin/bash

echo "=== Quick Fix: Restarting Services in Correct Order ==="
echo ""

# Colors
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m'

echo -e "${YELLOW}Step 1: Stopping all services...${NC}"
docker-compose down
echo ""

echo -e "${YELLOW}Step 2: Starting PostgreSQL database...${NC}"
docker-compose up -d postgres
echo ""

echo -e "${YELLOW}Step 3: Waiting for database to be ready (10 seconds)...${NC}"
sleep 10

echo -e "${YELLOW}Step 4: Checking database health...${NC}"
db_health=$(docker-compose exec -T postgres pg_isready -U utility_user -d utility_db 2>/dev/null)
if [ $? -eq 0 ]; then
    echo -e "${GREEN}✓ Database is ready${NC}"
else
    echo -e "${YELLOW}⚠ Database might still be initializing, continuing anyway...${NC}"
fi
echo ""

echo -e "${YELLOW}Step 5: Starting all services...${NC}"
docker-compose up -d
echo ""

echo -e "${YELLOW}Step 6: Waiting for services to start (5 seconds)...${NC}"
sleep 5

echo -e "${YELLOW}Step 7: Checking service status...${NC}"
docker-compose ps
echo ""

echo -e "${YELLOW}Step 8: Testing API Gateway health...${NC}"
response=$(curl -s -w "\n%{http_code}" http://localhost:3000/health 2>/dev/null)
http_code=$(echo "$response" | tail -n1)
if [ "$http_code" = "200" ]; then
    echo -e "${GREEN}✓ API Gateway is healthy${NC}"
else
    echo -e "${YELLOW}⚠ API Gateway returned HTTP $http_code${NC}"
fi
echo ""

echo -e "${YELLOW}Step 9: Testing User Service health...${NC}"
response=$(curl -s -w "\n%{http_code}" http://localhost:3001/health 2>/dev/null)
http_code=$(echo "$response" | tail -n1)
if [ "$http_code" = "200" ]; then
    echo -e "${GREEN}✓ User Service is healthy${NC}"
else
    echo -e "${YELLOW}⚠ User Service returned HTTP $http_code${NC}"
    echo "   Check logs: docker-compose logs user-service"
fi
echo ""

echo -e "${GREEN}=== Quick Fix Complete ===${NC}"
echo ""
echo "Next steps:"
echo "1. Check logs if services aren't healthy:"
echo "   docker-compose logs api-gateway"
echo "   docker-compose logs user-service"
echo ""
echo "2. Test signup flow:"
echo "   ./test-signup.sh"
echo ""
echo "3. Or try registering through the frontend at http://localhost:5173/register"

