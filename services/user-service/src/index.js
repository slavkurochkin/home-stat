require('dotenv').config();
const express = require('express');
const cors = require('cors');
const { Pool } = require('pg');
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const Joi = require('joi');

const app = express();
const PORT = process.env.PORT || 3001;

// Middleware
app.use(cors());
app.use(express.json());

// Database connection
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  max: 20,
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 10000,
});

// Handle pool errors
pool.on('error', (err) => {
  console.error('Unexpected error on idle client', err);
});

// Test connection on startup
pool.query('SELECT NOW()')
  .then(() => {
    console.log('Database pool created successfully');
  })
  .catch((err) => {
    console.error('Failed to create database pool:', err.message);
    console.error('DATABASE_URL:', process.env.DATABASE_URL || 'NOT SET');
  });


// Validation schemas
const registerSchema = Joi.object({
  email: Joi.string().email().required(),
  password: Joi.string().min(8).pattern(new RegExp('^(?=.*[a-zA-Z])(?=.*[0-9])')).required(),
  full_name: Joi.string().min(1).required(),
});

const loginSchema = Joi.object({
  email: Joi.string().email().required(),
  password: Joi.string().required(),
});

const updateProfileSchema = Joi.object({
  full_name: Joi.string().min(1).optional(),
  email: Joi.string().email().optional(),
  password: Joi.string().min(8).pattern(new RegExp('^(?=.*[a-zA-Z])(?=.*[0-9])')).optional(),
  current_password: Joi.string().when('password', {
    is: Joi.exist(),
    then: Joi.required(),
  }),
});

// Authentication middleware
const authenticateToken = (req, res, next) => {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];

  if (!token) {
    return res.status(401).json({ error: { code: 'UNAUTHORIZED', message: 'Access token required' } });
  }

  jwt.verify(token, process.env.JWT_SECRET, (err, user) => {
    if (err) {
      return res.status(403).json({ error: { code: 'FORBIDDEN', message: 'Invalid or expired token' } });
    }
    req.user = user;
    next();
  });
};

// Routes

// Health check
app.get('/health', async (req, res) => {
  try {
    await pool.query('SELECT 1');
    res.json({ status: 'healthy', service: 'user-service' });
  } catch (error) {
    res.status(503).json({ status: 'unhealthy', service: 'user-service', error: error.message });
  }
});

// Register
app.post('/register', async (req, res) => {
  try {
    console.log('Register request received:', { email: req.body.email, hasPassword: !!req.body.password });
    const { error, value } = registerSchema.validate(req.body);
    if (error) {
      console.log('Validation error:', error.details[0].message);
      return res.status(400).json({ error: { code: 'VALIDATION_ERROR', message: error.details[0].message } });
    }

    const { email, password, full_name } = value;
    console.log('Processing registration for:', email);

    // Check if user exists
    const existingUser = await pool.query('SELECT id FROM users WHERE email = $1', [email]);
    if (existingUser.rows.length > 0) {
      return res.status(409).json({ error: { code: 'USER_EXISTS', message: 'User with this email already exists' } });
    }

    // Hash password
    const passwordHash = await bcrypt.hash(password, 10);

    // Create user
    const result = await pool.query(
      'INSERT INTO users (email, password_hash, full_name) VALUES ($1, $2, $3) RETURNING id, email, full_name, created_at',
      [email, passwordHash, full_name]
    );

    const user = result.rows[0];

    // Generate token
    const token = jwt.sign({ userId: user.id, email: user.email }, process.env.JWT_SECRET, {
      expiresIn: process.env.JWT_EXPIRES_IN || '24h',
    });

    res.status(201).json({
      user: {
        id: user.id,
        email: user.email,
        full_name: user.full_name,
      },
      token,
    });
  } catch (error) {
    console.error('Registration error:', error);
    res.status(500).json({ error: { code: 'INTERNAL_ERROR', message: 'Failed to register user' } });
  }
});

// Login
app.post('/login', async (req, res) => {
  try {
    const { error, value } = loginSchema.validate(req.body);
    if (error) {
      return res.status(400).json({ error: { code: 'VALIDATION_ERROR', message: error.details[0].message } });
    }

    const { email, password } = value;

    // Find user
    const result = await pool.query('SELECT id, email, password_hash, full_name, is_active FROM users WHERE email = $1', [
      email,
    ]);

    if (result.rows.length === 0) {
      return res.status(401).json({ error: { code: 'INVALID_CREDENTIALS', message: 'Invalid email or password' } });
    }

    const user = result.rows[0];

    if (!user.is_active) {
      return res.status(403).json({ error: { code: 'ACCOUNT_INACTIVE', message: 'Account is inactive' } });
    }

    // Verify password
    const validPassword = await bcrypt.compare(password, user.password_hash);
    if (!validPassword) {
      return res.status(401).json({ error: { code: 'INVALID_CREDENTIALS', message: 'Invalid email or password' } });
    }

    // Generate token
    const token = jwt.sign({ userId: user.id, email: user.email }, process.env.JWT_SECRET, {
      expiresIn: process.env.JWT_EXPIRES_IN || '24h',
    });

    res.json({
      user: {
        id: user.id,
        email: user.email,
        full_name: user.full_name,
      },
      token,
    });
  } catch (error) {
    console.error('Login error:', error);
    res.status(500).json({ error: { code: 'INTERNAL_ERROR', message: 'Failed to login' } });
  }
});

// Get profile
app.get('/profile', authenticateToken, async (req, res) => {
  try {
    const result = await pool.query(
      'SELECT id, email, full_name, created_at FROM users WHERE id = $1',
      [req.user.userId]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: { code: 'USER_NOT_FOUND', message: 'User not found' } });
    }

    res.json(result.rows[0]);
  } catch (error) {
    console.error('Get profile error:', error);
    res.status(500).json({ error: { code: 'INTERNAL_ERROR', message: 'Failed to get profile' } });
  }
});

// Update profile
app.put('/profile', authenticateToken, async (req, res) => {
  try {
    const { error, value } = updateProfileSchema.validate(req.body);
    if (error) {
      return res.status(400).json({ error: { code: 'VALIDATION_ERROR', message: error.details[0].message } });
    }

    const updates = [];
    const values = [];
    let paramCount = 1;

    // Get current user
    const userResult = await pool.query('SELECT password_hash FROM users WHERE id = $1', [req.user.userId]);
    if (userResult.rows.length === 0) {
      return res.status(404).json({ error: { code: 'USER_NOT_FOUND', message: 'User not found' } });
    }

    // If password is being changed, verify current password
    if (value.password) {
      const validPassword = await bcrypt.compare(value.current_password, userResult.rows[0].password_hash);
      if (!validPassword) {
        return res.status(401).json({ error: { code: 'INVALID_PASSWORD', message: 'Current password is incorrect' } });
      }
      const passwordHash = await bcrypt.hash(value.password, 10);
      updates.push(`password_hash = $${paramCount}`);
      values.push(passwordHash);
      paramCount++;
    }

    if (value.full_name) {
      updates.push(`full_name = $${paramCount}`);
      values.push(value.full_name);
      paramCount++;
    }

    if (value.email) {
      // Check if email is already taken
      const emailCheck = await pool.query('SELECT id FROM users WHERE email = $1 AND id != $2', [
        value.email,
        req.user.userId,
      ]);
      if (emailCheck.rows.length > 0) {
        return res.status(409).json({ error: { code: 'EMAIL_EXISTS', message: 'Email already in use' } });
      }
      updates.push(`email = $${paramCount}`);
      values.push(value.email);
      paramCount++;
    }

    if (updates.length === 0) {
      return res.status(400).json({ error: { code: 'NO_UPDATES', message: 'No valid fields to update' } });
    }

    values.push(req.user.userId);
    const query = `UPDATE users SET ${updates.join(', ')}, updated_at = CURRENT_TIMESTAMP WHERE id = $${paramCount} RETURNING id, email, full_name, updated_at`;

    const result = await pool.query(query, values);
    res.json(result.rows[0]);
  } catch (error) {
    console.error('Update profile error:', error);
    res.status(500).json({ error: { code: 'INTERNAL_ERROR', message: 'Failed to update profile' } });
  }
});

// Create household
app.post('/households', authenticateToken, async (req, res) => {
  try {
    const { name } = req.body;
    if (!name || name.trim().length === 0) {
      return res.status(400).json({ error: { code: 'VALIDATION_ERROR', message: 'Household name is required' } });
    }

    const result = await pool.query(
      'INSERT INTO households (name, created_by) VALUES ($1, $2) RETURNING id, name, created_at',
      [name.trim(), req.user.userId]
    );

    // Add creator as owner
    await pool.query('INSERT INTO household_members (household_id, user_id, role) VALUES ($1, $2, $3)', [
      result.rows[0].id,
      req.user.userId,
      'owner',
    ]);

    res.status(201).json(result.rows[0]);
  } catch (error) {
    console.error('Create household error:', error);
    res.status(500).json({ error: { code: 'INTERNAL_ERROR', message: 'Failed to create household' } });
  }
});

// Get user's households
app.get('/households', authenticateToken, async (req, res) => {
  try {
    const result = await pool.query(
      `SELECT h.id, h.name, h.created_at,
              json_agg(json_build_object('id', hm.id, 'user_id', u.id, 'email', u.email, 'full_name', u.full_name, 'role', hm.role)) as members
       FROM households h
       INNER JOIN household_members hm ON h.id = hm.household_id
       INNER JOIN users u ON hm.user_id = u.id
       WHERE h.id IN (SELECT household_id FROM household_members WHERE user_id = $1)
       GROUP BY h.id, h.name, h.created_at`,
      [req.user.userId]
    );

    res.json(result.rows);
  } catch (error) {
    console.error('Get households error:', error);
    res.status(500).json({ error: { code: 'INTERNAL_ERROR', message: 'Failed to get households' } });
  }
});

// Add member to household
app.post('/households/:id/members', authenticateToken, async (req, res) => {
  try {
    const householdId = req.params.id;
    const { email } = req.body;

    if (!email) {
      return res.status(400).json({ error: { code: 'VALIDATION_ERROR', message: 'Email is required' } });
    }

    // Check if user has permission (must be owner or member)
    const householdCheck = await pool.query(
      'SELECT role FROM household_members WHERE household_id = $1 AND user_id = $2',
      [householdId, req.user.userId]
    );

    if (householdCheck.rows.length === 0) {
      return res.status(403).json({ error: { code: 'FORBIDDEN', message: 'Not a member of this household' } });
    }

    // Find user by email
    const userResult = await pool.query('SELECT id FROM users WHERE email = $1', [email]);
    if (userResult.rows.length === 0) {
      return res.status(404).json({ error: { code: 'USER_NOT_FOUND', message: 'User not found' } });
    }

    const newMemberId = userResult.rows[0].id;

    // Check if already a member
    const memberCheck = await pool.query(
      'SELECT id FROM household_members WHERE household_id = $1 AND user_id = $2',
      [householdId, newMemberId]
    );

    if (memberCheck.rows.length > 0) {
      return res.status(409).json({ error: { code: 'MEMBER_EXISTS', message: 'User is already a member' } });
    }

    // Add member
    const result = await pool.query(
      'INSERT INTO household_members (household_id, user_id, role) VALUES ($1, $2, $3) RETURNING id, household_id, user_id, role',
      [householdId, newMemberId, 'member']
    );

    res.status(201).json(result.rows[0]);
  } catch (error) {
    console.error('Add member error:', error);
    res.status(500).json({ error: { code: 'INTERNAL_ERROR', message: 'Failed to add member' } });
  }
});

// Error handling middleware
app.use((err, req, res, next) => {
  console.error('Unhandled error:', err);
  res.status(500).json({ error: { code: 'INTERNAL_ERROR', message: 'Internal server error' } });
});

// Start server
app.listen(PORT, async () => {
  console.log(`User service running on port ${PORT}`);
  console.log(`Database URL: ${process.env.DATABASE_URL ? 'Set' : 'NOT SET - REQUIRED!'}`);
  console.log(`JWT Secret: ${process.env.JWT_SECRET ? 'Set' : 'NOT SET - REQUIRED!'}`);
  
  // Test database connection (non-blocking)
  setTimeout(async () => {
    try {
      const result = await pool.query('SELECT NOW()');
      console.log('Database connection test successful:', result.rows[0]);
    } catch (err) {
      console.error('Database connection test failed:', err.message);
      console.error('This is non-fatal - service will continue but database operations may fail');
    }
  }, 1000);
});

// Handle uncaught errors
process.on('uncaughtException', (err) => {
  console.error('Uncaught Exception:', err);
  process.exit(1);
});

process.on('unhandledRejection', (reason, promise) => {
  console.error('Unhandled Rejection at:', promise, 'reason:', reason);
});

