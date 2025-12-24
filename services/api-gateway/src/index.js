require('dotenv').config();
const express = require('express');
const cors = require('cors');
const { createProxyMiddleware } = require('http-proxy-middleware');
const jwt = require('jsonwebtoken');

const app = express();
const PORT = process.env.PORT || 3000;

// CORS configuration
const corsOptions = {
  origin: ['http://localhost:5173', 'http://localhost:3000'],
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization'],
};

app.use(cors(corsOptions));
app.use(express.json());

// Request logging middleware
app.use((req, res, next) => {
  console.log(`${new Date().toISOString()} - ${req.method} ${req.path}`);
  next();
});

// Service URLs
const USER_SERVICE_URL = process.env.USER_SERVICE_URL || 'http://user-service:3001';
const UTILITY_SERVICE_URL = process.env.UTILITY_SERVICE_URL || 'http://utility-service:3002';
const ANALYTICS_SERVICE_URL = process.env.ANALYTICS_SERVICE_URL || 'http://analytics-service:3003';
const NOTIFICATION_SERVICE_URL = process.env.NOTIFICATION_SERVICE_URL || 'http://notification-service:3004';

// Authentication middleware
const authenticateToken = (req, res, next) => {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];

  if (!token) {
    return res.status(401).json({ error: { code: 'UNAUTHORIZED', message: 'Access token required' } });
  }

  const jwtSecret = process.env.JWT_SECRET;
  if (!jwtSecret) {
    console.error('JWT_SECRET is not set! Authentication will fail.');
    return res.status(500).json({ error: { code: 'CONFIGURATION_ERROR', message: 'Server configuration error' } });
  }

  try {
    const decoded = jwt.verify(token, jwtSecret);
    req.user = decoded;
    next();
  } catch (error) {
    console.error('JWT verification error:', error.message);
    return res.status(403).json({ error: { code: 'FORBIDDEN', message: 'Invalid or expired token' } });
  }
};

// Proxy configuration function
const createProxy = (target, requiresAuth = true, pathRewritePattern = null) => {
  // pathRewritePattern should be a regex string that matches the prefix to remove
  // The replacement is always empty string, so '/api/users/register' -> '/register'
  const pathRewrite = pathRewritePattern 
    ? { [pathRewritePattern]: '' }
    : { '^/api': '' }; // Default: remove /api prefix
  
  return createProxyMiddleware({
    target,
    changeOrigin: true,
    pathRewrite,
    timeout: 30000, // 30 second timeout
    proxyTimeout: 30000,
    onProxyReq: (proxyReq, req, res) => {
      console.log(`Proxying ${req.method} ${req.path} to ${target}`);
      
      // Add user ID to headers for authenticated requests
      if (requiresAuth && req.user) {
        proxyReq.setHeader('x-user-id', req.user.userId);
        // Forward the authorization header
        if (req.headers['authorization']) {
          proxyReq.setHeader('authorization', req.headers['authorization']);
        }
      }
      
      // Fix: Re-stream the body that was consumed by express.json()
      if (req.body && Object.keys(req.body).length > 0) {
        const bodyData = JSON.stringify(req.body);
        // Update headers
        proxyReq.setHeader('Content-Type', 'application/json');
        proxyReq.setHeader('Content-Length', Buffer.byteLength(bodyData));
        // Write body to proxy request
        proxyReq.write(bodyData);
      }
    },
    onProxyRes: (proxyRes, req, res) => {
      console.log(`Response from ${target}: ${proxyRes.statusCode} for ${req.method} ${req.path}`);
    },
    onError: (err, req, res) => {
      console.error('Proxy error:', err.message);
      console.error('Error code:', err.code);
      console.error('Error target:', target);
      if (!res.headersSent) {
        res.status(503).json({
          error: {
            code: 'SERVICE_UNAVAILABLE',
            message: `Service is temporarily unavailable: ${err.message}`,
          },
        });
      }
    },
  });
};

// Health check
app.get('/health', (req, res) => {
  res.json({ status: 'healthy', service: 'api-gateway' });
});

// Test endpoint to verify gateway is working
app.get('/test', (req, res) => {
  res.json({ message: 'API Gateway is working', timestamp: new Date().toISOString() });
});

// Public routes (no authentication required)
// These need to come before the general /api/users route
const registerProxy = createProxy(USER_SERVICE_URL, false, '^/api/users');
const loginProxy = createProxy(USER_SERVICE_URL, false, '^/api/users');

app.post('/api/users/register', (req, res, next) => {
  console.log('Register route hit, proxying to:', USER_SERVICE_URL);
  console.log('Request body:', JSON.stringify(req.body));
  
  // Set a timeout for the proxy request
  const timeout = setTimeout(() => {
    if (!res.headersSent) {
      console.error('Proxy request timeout for /api/users/register');
      res.status(504).json({
        error: {
          code: 'GATEWAY_TIMEOUT',
          message: 'Request to user service timed out',
        },
      });
    }
  }, 25000); // 25 second timeout (less than axios 30s)
  
  // Clear timeout on response
  const originalEnd = res.end;
  res.end = function(...args) {
    clearTimeout(timeout);
    originalEnd.apply(this, args);
  };
  
  registerProxy(req, res, next);
});

app.post('/api/users/login', (req, res, next) => {
  console.log('Login route hit, proxying to:', USER_SERVICE_URL);
  loginProxy(req, res, next);
});

// Protected routes (authentication required)
// Path rewrite patterns remove the /api/service prefix so /api/utilities/bills becomes /bills
app.use('/api/users', authenticateToken, createProxy(USER_SERVICE_URL, true, '^/api/users'));
app.use('/api/utilities', authenticateToken, createProxy(UTILITY_SERVICE_URL, true, '^/api/utilities'));
app.use('/api/analytics', authenticateToken, createProxy(ANALYTICS_SERVICE_URL, true, '^/api/analytics'));
app.use('/api/notifications', authenticateToken, createProxy(NOTIFICATION_SERVICE_URL, true, '^/api/notifications'));

// Error handling middleware
app.use((err, req, res, next) => {
  console.error('Gateway error:', err);
  res.status(500).json({
    error: {
      code: 'INTERNAL_ERROR',
      message: 'Internal server error',
    },
  });
});

// 404 handler
app.use((req, res) => {
  res.status(404).json({
    error: {
      code: 'NOT_FOUND',
      message: 'Route not found',
    },
  });
});

// Test service connectivity on startup
const http = require('http');
const testService = (url, name) => {
  const testUrl = url.replace(':3001', ':3001/health').replace(':3002', ':3002/health').replace(':3003', ':3003/health').replace(':3004', ':3004/health');
  http.get(testUrl, (res) => {
    console.log(`${name} health check: ${res.statusCode}`);
  }).on('error', (err) => {
    console.error(`${name} health check failed:`, err.message);
  });
};

// Start server
app.listen(PORT, () => {
  console.log(`API Gateway running on port ${PORT}`);
  console.log(`User Service: ${USER_SERVICE_URL}`);
  console.log(`Utility Service: ${UTILITY_SERVICE_URL}`);
  console.log(`Analytics Service: ${ANALYTICS_SERVICE_URL}`);
  console.log(`Notification Service: ${NOTIFICATION_SERVICE_URL}`);
  console.log(`JWT Secret: ${process.env.JWT_SECRET ? 'Set' : 'NOT SET - REQUIRED!'}`);
  
  // Test connectivity (non-blocking)
  setTimeout(() => {
    testService(USER_SERVICE_URL, 'User Service');
    testService(UTILITY_SERVICE_URL, 'Utility Service');
    testService(ANALYTICS_SERVICE_URL, 'Analytics Service');
    testService(NOTIFICATION_SERVICE_URL, 'Notification Service');
  }, 2000);
});

// Handle uncaught errors
process.on('uncaughtException', (err) => {
  console.error('Uncaught Exception:', err);
  process.exit(1);
});

process.on('unhandledRejection', (reason, promise) => {
  console.error('Unhandled Rejection at:', promise, 'reason:', reason);
});

