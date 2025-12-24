# Troubleshooting Connection Issues

## Issue: Requests timing out

If requests are timing out, it means the Vite proxy isn't forwarding to the API Gateway.

## Quick Tests

### 1. Test API Gateway directly
Open in browser: `http://localhost:3000/health`

Should return: `{"status":"healthy","service":"api-gateway"}`

If this doesn't work:
- Check if API Gateway is running: `docker-compose ps api-gateway`
- Check API Gateway logs: `docker-compose logs api-gateway`
- Restart API Gateway: `docker-compose restart api-gateway`

### 2. Test Vite Proxy
Open in browser: `http://localhost:5173/api/health`

Should return the same as above. If this doesn't work, the Vite proxy isn't working.

### 3. Check Vite Dev Server Console
When you make a request, you should see:
```
[Vite Proxy] POST /api/users/register -> /api/users/register
[Vite Proxy] Response 200 for /api/users/register
```

If you don't see these logs, the proxy isn't forwarding.

## Solutions

### Solution 1: Restart Vite Dev Server
1. Stop the dev server (Ctrl+C)
2. Start it again: `npm run dev`

### Solution 2: Check Docker Services
```bash
# Check all services are running
docker-compose ps

# Check API Gateway logs
docker-compose logs -f api-gateway

# Restart all services
docker-compose restart
```

### Solution 3: Temporary Direct Connection (Bypass Proxy)
If the proxy isn't working, you can temporarily connect directly:

Edit `frontend/src/services/api.js`:
```javascript
const api = axios.create({
  baseURL: 'http://localhost:3000/api', // Direct connection
  // ... rest of config
});
```

This bypasses the Vite proxy and connects directly to the API Gateway.

### Solution 4: Check Port Conflicts
```bash
# Check if port 3000 is in use
lsof -i :3000

# Check if port 5173 is in use
lsof -i :5173
```

## Expected Behavior

1. Frontend makes request to `/api/users/register`
2. Vite proxy forwards to `http://localhost:3000/api/users/register`
3. API Gateway receives request and logs it
4. API Gateway proxies to User Service
5. Response comes back through the chain

Check each step in the logs to find where it's failing.

