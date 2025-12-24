#!/bin/bash

echo "=== Diagnosing Signup Flow Issues ==="
echo ""

# Check Docker services
echo "1. Checking Docker services..."
docker-compose ps
echo ""

# Check API Gateway logs
echo "2. Recent API Gateway logs (last 20 lines):"
docker-compose logs --tail=20 api-gateway
echo ""

# Check User Service logs
echo "3. Recent User Service logs (last 20 lines):"
docker-compose logs --tail=20 user-service
echo ""

# Check Database logs
echo "4. Recent Database logs (last 10 lines):"
docker-compose logs --tail=10 postgres
echo ""

# Test connectivity
echo "5. Testing service connectivity..."
echo "   API Gateway (port 3000):"
curl -s -o /dev/null -w "   Status: %{http_code}\n" http://localhost:3000/health || echo "   ✗ Not accessible"
echo "   User Service (port 3001):"
curl -s -o /dev/null -w "   Status: %{http_code}\n" http://localhost:3001/health || echo "   ✗ Not accessible"
echo ""

# Check if ports are in use
echo "6. Checking if ports are in use:"
lsof -i :3000 | head -2 || echo "   Port 3000: Available"
lsof -i :3001 | head -2 || echo "   Port 3001: Available"
lsof -i :5433 | head -2 || echo "   Port 5433: Available"
echo ""

echo "=== Diagnosis Complete ==="

