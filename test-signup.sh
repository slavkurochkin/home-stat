#!/bin/bash

echo "=== Testing Signup Flow ==="
echo ""

# Colors for output
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Test 1: Check API Gateway Health
echo "1. Testing API Gateway Health..."
response=$(curl -s -w "\n%{http_code}" http://localhost:3000/health)
http_code=$(echo "$response" | tail -n1)
body=$(echo "$response" | sed '$d')

if [ "$http_code" = "200" ]; then
    echo -e "${GREEN}✓ API Gateway is running${NC}"
    echo "   Response: $body"
else
    echo -e "${RED}✗ API Gateway is not accessible (HTTP $http_code)${NC}"
    echo "   Make sure Docker containers are running: docker-compose up -d"
    exit 1
fi
echo ""

# Test 2: Check User Service Health
echo "2. Testing User Service Health..."
response=$(curl -s -w "\n%{http_code}" http://localhost:3001/health)
http_code=$(echo "$response" | tail -n1)
body=$(echo "$response" | sed '$d')

if [ "$http_code" = "200" ]; then
    echo -e "${GREEN}✓ User Service is running${NC}"
    echo "   Response: $body"
else
    echo -e "${RED}✗ User Service is not accessible (HTTP $http_code)${NC}"
    exit 1
fi
echo ""

# Test 3: Test Registration Endpoint
echo "3. Testing Registration Endpoint..."
timestamp=$(date +%s)
test_email="test${timestamp}@example.com"
test_password="test1234"
test_name="Test User ${timestamp}"

echo "   Email: $test_email"
echo "   Password: $test_password"
echo "   Name: $test_name"
echo ""

response=$(curl -s -w "\n%{http_code}" -X POST http://localhost:3000/api/users/register \
  -H "Content-Type: application/json" \
  -d "{
    \"email\": \"$test_email\",
    \"password\": \"$test_password\",
    \"full_name\": \"$test_name\"
  }")

http_code=$(echo "$response" | tail -n1)
body=$(echo "$response" | sed '$d')

if [ "$http_code" = "201" ]; then
    echo -e "${GREEN}✓ Registration successful!${NC}"
    echo "   Response: $body"
    
    # Extract token
    token=$(echo "$body" | grep -o '"token":"[^"]*' | cut -d'"' -f4)
    if [ -n "$token" ]; then
        echo -e "${GREEN}✓ Token received${NC}"
        echo "   Token: ${token:0:50}..."
    fi
else
    echo -e "${RED}✗ Registration failed (HTTP $http_code)${NC}"
    echo "   Response: $body"
    exit 1
fi
echo ""

# Test 4: Test Login with registered user
echo "4. Testing Login with registered user..."
response=$(curl -s -w "\n%{http_code}" -X POST http://localhost:3000/api/users/login \
  -H "Content-Type: application/json" \
  -d "{
    \"email\": \"$test_email\",
    \"password\": \"$test_password\"
  }")

http_code=$(echo "$response" | tail -n1)
body=$(echo "$response" | sed '$d')

if [ "$http_code" = "200" ]; then
    echo -e "${GREEN}✓ Login successful!${NC}"
    echo "   Response: $body"
else
    echo -e "${RED}✗ Login failed (HTTP $http_code)${NC}"
    echo "   Response: $body"
    exit 1
fi
echo ""

# Test 5: Test Profile endpoint with token
echo "5. Testing Profile endpoint with authentication..."
login_token=$(echo "$body" | grep -o '"token":"[^"]*' | cut -d'"' -f4)

if [ -z "$login_token" ]; then
    echo -e "${YELLOW}⚠ Could not extract token from login response${NC}"
    exit 1
fi

response=$(curl -s -w "\n%{http_code}" http://localhost:3000/api/users/profile \
  -H "Authorization: Bearer $login_token")

http_code=$(echo "$response" | tail -n1)
body=$(echo "$response" | sed '$d')

if [ "$http_code" = "200" ]; then
    echo -e "${GREEN}✓ Profile retrieval successful!${NC}"
    echo "   Response: $body"
else
    echo -e "${RED}✗ Profile retrieval failed (HTTP $http_code)${NC}"
    echo "   Response: $body"
    exit 1
fi
echo ""

echo -e "${GREEN}=== All Tests Passed! ===${NC}"

