require('dotenv').config();
const express = require('express');
const cors = require('cors');
const { Pool } = require('pg');
const Joi = require('joi');

const app = express();
const PORT = process.env.PORT || 3002;

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

// Authentication middleware (extracts user from JWT token passed by gateway)
const authenticateToken = (req, res, next) => {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];

  if (!token) {
    return res.status(401).json({ error: { code: 'UNAUTHORIZED', message: 'Access token required' } });
  }

  // In a real implementation, the gateway would validate and pass user info
  // For now, we'll extract from header (gateway should set x-user-id)
  const userId = req.headers['x-user-id'];
  if (!userId) {
    return res.status(401).json({ error: { code: 'UNAUTHORIZED', message: 'User information required' } });
  }

  req.user = { userId };
  next();
};

// Validation schemas
const utilityTypeSchema = Joi.object({
  name: Joi.string().min(1).max(255).required(),
  description: Joi.string().allow('', null).optional(),
  unit_of_measurement: Joi.string().allow('', null).max(50).optional(),
});

const billSchema = Joi.object({
  utility_type_id: Joi.string().uuid().required(),
  amount: Joi.number().positive().precision(2).required(),
  bill_date: Joi.date().required(),
  due_date: Joi.date().allow(null).optional(),
  usage_amount: Joi.number().positive().precision(2).allow(null).optional(),
  notes: Joi.string().allow('', null).optional(),
  household_id: Joi.string().uuid().allow(null).optional(),
});

const recurringBillSchema = Joi.object({
  utility_type_id: Joi.string().uuid().required(),
  amount: Joi.number().positive().precision(2).required(),
  day_of_month: Joi.number().integer().min(1).max(28).required(),
  notes: Joi.string().allow('', null).optional(),
  is_active: Joi.boolean().optional(),
});

// Routes

// Health check
app.get('/health', async (req, res) => {
  try {
    await pool.query('SELECT 1');
    res.json({ status: 'healthy', service: 'utility-service' });
  } catch (error) {
    res.status(503).json({ status: 'unhealthy', service: 'utility-service', error: error.message });
  }
});

// Get utility types (system + user's custom types)
app.get('/types', authenticateToken, async (req, res) => {
  try {
    const result = await pool.query(
      `SELECT id, name, description, unit_of_measurement, is_system_type, created_at
       FROM utility_types
       WHERE user_id IS NULL OR user_id = $1
       ORDER BY is_system_type DESC, name ASC`,
      [req.user.userId]
    );

    res.json(result.rows);
  } catch (error) {
    console.error('Get utility types error:', error);
    res.status(500).json({ error: { code: 'INTERNAL_ERROR', message: 'Failed to get utility types' } });
  }
});

// Create custom utility type
app.post('/types', authenticateToken, async (req, res) => {
  try {
    const { error, value } = utilityTypeSchema.validate(req.body);
    if (error) {
      return res.status(400).json({ error: { code: 'VALIDATION_ERROR', message: error.details[0].message } });
    }

    const { name, description, unit_of_measurement } = value;

    // Check if user already has a utility type with this name
    const existing = await pool.query(
      'SELECT id FROM utility_types WHERE user_id = $1 AND LOWER(name) = LOWER($2)',
      [req.user.userId, name]
    );

    if (existing.rows.length > 0) {
      return res.status(409).json({ error: { code: 'DUPLICATE_NAME', message: 'Utility type with this name already exists' } });
    }

    const result = await pool.query(
      'INSERT INTO utility_types (user_id, name, description, unit_of_measurement) VALUES ($1, $2, $3, $4) RETURNING id, name, description, unit_of_measurement, is_system_type, created_at',
      [req.user.userId, name, description || null, unit_of_measurement || null]
    );

    res.status(201).json(result.rows[0]);
  } catch (error) {
    console.error('Create utility type error:', error);
    res.status(500).json({ error: { code: 'INTERNAL_ERROR', message: 'Failed to create utility type' } });
  }
});

// Update utility type
app.put('/types/:id', authenticateToken, async (req, res) => {
  try {
    const utilityTypeId = req.params.id;
    const { error, value } = utilityTypeSchema.validate(req.body);
    if (error) {
      return res.status(400).json({ error: { code: 'VALIDATION_ERROR', message: error.details[0].message } });
    }

    // Check if utility type exists and belongs to user (or is system type)
    const existing = await pool.query('SELECT user_id, is_system_type FROM utility_types WHERE id = $1', [utilityTypeId]);

    if (existing.rows.length === 0) {
      return res.status(404).json({ error: { code: 'NOT_FOUND', message: 'Utility type not found' } });
    }

    if (existing.rows[0].is_system_type) {
      return res.status(403).json({ error: { code: 'FORBIDDEN', message: 'Cannot modify system utility types' } });
    }

    if (existing.rows[0].user_id !== req.user.userId) {
      return res.status(403).json({ error: { code: 'FORBIDDEN', message: 'Not authorized to modify this utility type' } });
    }

    // Check for duplicate name
    if (value.name) {
      const duplicate = await pool.query(
        'SELECT id FROM utility_types WHERE user_id = $1 AND LOWER(name) = LOWER($2) AND id != $3',
        [req.user.userId, value.name, utilityTypeId]
      );

      if (duplicate.rows.length > 0) {
        return res.status(409).json({ error: { code: 'DUPLICATE_NAME', message: 'Utility type with this name already exists' } });
      }
    }

    const updates = [];
    const values = [];
    let paramCount = 1;

    if (value.name) {
      updates.push(`name = $${paramCount}`);
      values.push(value.name);
      paramCount++;
    }

    if (value.description !== undefined) {
      updates.push(`description = $${paramCount}`);
      values.push(value.description || null);
      paramCount++;
    }

    if (value.unit_of_measurement !== undefined) {
      updates.push(`unit_of_measurement = $${paramCount}`);
      values.push(value.unit_of_measurement || null);
      paramCount++;
    }

    if (updates.length === 0) {
      return res.status(400).json({ error: { code: 'NO_UPDATES', message: 'No valid fields to update' } });
    }

    values.push(utilityTypeId);
    const query = `UPDATE utility_types SET ${updates.join(', ')}, updated_at = CURRENT_TIMESTAMP WHERE id = $${paramCount} RETURNING id, name, description, unit_of_measurement, is_system_type, updated_at`;

    const result = await pool.query(query, values);
    res.json(result.rows[0]);
  } catch (error) {
    console.error('Update utility type error:', error);
    res.status(500).json({ error: { code: 'INTERNAL_ERROR', message: 'Failed to update utility type' } });
  }
});

// Delete utility type
app.delete('/types/:id', authenticateToken, async (req, res) => {
  try {
    const utilityTypeId = req.params.id;

    // Check if utility type exists and belongs to user
    const existing = await pool.query('SELECT user_id, is_system_type FROM utility_types WHERE id = $1', [utilityTypeId]);

    if (existing.rows.length === 0) {
      return res.status(404).json({ error: { code: 'NOT_FOUND', message: 'Utility type not found' } });
    }

    if (existing.rows[0].is_system_type) {
      return res.status(403).json({ error: { code: 'FORBIDDEN', message: 'Cannot delete system utility types' } });
    }

    if (existing.rows[0].user_id !== req.user.userId) {
      return res.status(403).json({ error: { code: 'FORBIDDEN', message: 'Not authorized to delete this utility type' } });
    }

    // Check if there are bills associated with this utility type
    const billsCheck = await pool.query('SELECT id FROM bills WHERE utility_type_id = $1 LIMIT 1', [utilityTypeId]);
    if (billsCheck.rows.length > 0) {
      return res.status(409).json({
        error: { code: 'HAS_BILLS', message: 'Cannot delete utility type that has associated bills' },
      });
    }

    await pool.query('DELETE FROM utility_types WHERE id = $1', [utilityTypeId]);
    res.json({ success: true });
  } catch (error) {
    console.error('Delete utility type error:', error);
    res.status(500).json({ error: { code: 'INTERNAL_ERROR', message: 'Failed to delete utility type' } });
  }
});

// Get bills
app.get('/bills', authenticateToken, async (req, res) => {
  try {
    const { utility_type_id, start_date, end_date, page = 1, limit = 20 } = req.query;
    const offset = (parseInt(page) - 1) * parseInt(limit);

    let query = 'SELECT b.*, ut.name as utility_type_name FROM bills b INNER JOIN utility_types ut ON b.utility_type_id = ut.id WHERE b.user_id = $1';
    const values = [req.user.userId];
    let paramCount = 2;

    if (utility_type_id) {
      query += ` AND b.utility_type_id = $${paramCount}`;
      values.push(utility_type_id);
      paramCount++;
    }

    if (start_date) {
      query += ` AND b.bill_date >= $${paramCount}`;
      values.push(start_date);
      paramCount++;
    }

    if (end_date) {
      query += ` AND b.bill_date <= $${paramCount}`;
      values.push(end_date);
      paramCount++;
    }

    // Get total count
    const countQuery = query.replace('SELECT b.*, ut.name as utility_type_name', 'SELECT COUNT(*)');
    const countResult = await pool.query(countQuery, values);
    const total = parseInt(countResult.rows[0].count);

    // Get paginated results
    query += ` ORDER BY b.bill_date DESC, b.created_at DESC LIMIT $${paramCount} OFFSET $${paramCount + 1}`;
    values.push(parseInt(limit), offset);

    const result = await pool.query(query, values);

    res.json({
      bills: result.rows,
      total,
      page: parseInt(page),
      limit: parseInt(limit),
    });
  } catch (error) {
    console.error('Get bills error:', error);
    res.status(500).json({ error: { code: 'INTERNAL_ERROR', message: 'Failed to get bills' } });
  }
});

// Get single bill
app.get('/bills/:id', authenticateToken, async (req, res) => {
  try {
    const billId = req.params.id;

    const result = await pool.query(
      `SELECT b.*, ut.name as utility_type_name 
       FROM bills b 
       INNER JOIN utility_types ut ON b.utility_type_id = ut.id 
       WHERE b.id = $1 AND b.user_id = $2`,
      [billId, req.user.userId]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: { code: 'NOT_FOUND', message: 'Bill not found' } });
    }

    res.json(result.rows[0]);
  } catch (error) {
    console.error('Get bill error:', error);
    res.status(500).json({ error: { code: 'INTERNAL_ERROR', message: 'Failed to get bill' } });
  }
});

// Create bill
app.post('/bills', authenticateToken, async (req, res) => {
  try {
    const { error, value } = billSchema.validate(req.body);
    if (error) {
      return res.status(400).json({ error: { code: 'VALIDATION_ERROR', message: error.details[0].message } });
    }

    // Verify utility type exists and is accessible
    const utilityTypeCheck = await pool.query(
      'SELECT id FROM utility_types WHERE id = $1 AND (user_id IS NULL OR user_id = $2)',
      [value.utility_type_id, req.user.userId]
    );

    if (utilityTypeCheck.rows.length === 0) {
      return res.status(404).json({ error: { code: 'UTILITY_TYPE_NOT_FOUND', message: 'Utility type not found' } });
    }

    // Verify household if provided
    if (value.household_id) {
      const householdCheck = await pool.query(
        'SELECT id FROM household_members WHERE household_id = $1 AND user_id = $2',
        [value.household_id, req.user.userId]
      );

      if (householdCheck.rows.length === 0) {
        return res.status(403).json({ error: { code: 'FORBIDDEN', message: 'Not a member of this household' } });
      }
    }

    const result = await pool.query(
      `INSERT INTO bills (user_id, household_id, utility_type_id, amount, bill_date, due_date, usage_amount, notes)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
       RETURNING id, user_id, household_id, utility_type_id, amount, bill_date, due_date, usage_amount, notes, created_at`,
      [
        req.user.userId,
        value.household_id || null,
        value.utility_type_id,
        value.amount,
        value.bill_date,
        value.due_date || null,
        value.usage_amount || null,
        value.notes || null,
      ]
    );

    // Trigger threshold check (notify notification service)
    // This would typically be done via message queue, but for now we'll make it async
    setImmediate(() => {
      // In production, this would be a message queue or HTTP call to notification service
      console.log('Bill created, should check thresholds for bill:', result.rows[0].id);
    });

    res.status(201).json(result.rows[0]);
  } catch (error) {
    console.error('Create bill error:', error);
    res.status(500).json({ error: { code: 'INTERNAL_ERROR', message: 'Failed to create bill' } });
  }
});

// Update bill
app.put('/bills/:id', authenticateToken, async (req, res) => {
  try {
    const billId = req.params.id;
    const { error, value } = billSchema.validate(req.body, { abortEarly: false });
    if (error) {
      return res.status(400).json({ error: { code: 'VALIDATION_ERROR', message: error.details[0].message } });
    }

    // Check if bill exists and belongs to user
    const existing = await pool.query('SELECT user_id FROM bills WHERE id = $1', [billId]);
    if (existing.rows.length === 0) {
      return res.status(404).json({ error: { code: 'NOT_FOUND', message: 'Bill not found' } });
    }

    if (existing.rows[0].user_id !== req.user.userId) {
      return res.status(403).json({ error: { code: 'FORBIDDEN', message: 'Not authorized to update this bill' } });
    }

    // Verify utility type if being changed
    if (value.utility_type_id) {
      const utilityTypeCheck = await pool.query(
        'SELECT id FROM utility_types WHERE id = $1 AND (user_id IS NULL OR user_id = $2)',
        [value.utility_type_id, req.user.userId]
      );

      if (utilityTypeCheck.rows.length === 0) {
        return res.status(404).json({ error: { code: 'UTILITY_TYPE_NOT_FOUND', message: 'Utility type not found' } });
      }
    }

    const updates = [];
    const values = [];
    let paramCount = 1;

    if (value.utility_type_id) {
      updates.push(`utility_type_id = $${paramCount}`);
      values.push(value.utility_type_id);
      paramCount++;
    }

    if (value.amount !== undefined) {
      updates.push(`amount = $${paramCount}`);
      values.push(value.amount);
      paramCount++;
    }

    if (value.bill_date) {
      updates.push(`bill_date = $${paramCount}`);
      values.push(value.bill_date);
      paramCount++;
    }

    if (value.due_date !== undefined) {
      updates.push(`due_date = $${paramCount}`);
      values.push(value.due_date);
      paramCount++;
    }

    if (value.usage_amount !== undefined) {
      updates.push(`usage_amount = $${paramCount}`);
      values.push(value.usage_amount);
      paramCount++;
    }

    if (value.notes !== undefined) {
      updates.push(`notes = $${paramCount}`);
      values.push(value.notes);
      paramCount++;
    }

    if (updates.length === 0) {
      return res.status(400).json({ error: { code: 'NO_UPDATES', message: 'No valid fields to update' } });
    }

    values.push(billId);
    const query = `UPDATE bills SET ${updates.join(', ')}, updated_at = CURRENT_TIMESTAMP WHERE id = $${paramCount} RETURNING *`;

    const result = await pool.query(query, values);
    res.json(result.rows[0]);
  } catch (error) {
    console.error('Update bill error:', error);
    res.status(500).json({ error: { code: 'INTERNAL_ERROR', message: 'Failed to update bill' } });
  }
});

// Delete bill
app.delete('/bills/:id', authenticateToken, async (req, res) => {
  try {
    const billId = req.params.id;

    // Check if bill exists and belongs to user
    const existing = await pool.query('SELECT user_id FROM bills WHERE id = $1', [billId]);
    if (existing.rows.length === 0) {
      return res.status(404).json({ error: { code: 'NOT_FOUND', message: 'Bill not found' } });
    }

    if (existing.rows[0].user_id !== req.user.userId) {
      return res.status(403).json({ error: { code: 'FORBIDDEN', message: 'Not authorized to delete this bill' } });
    }

    await pool.query('DELETE FROM bills WHERE id = $1', [billId]);
    res.json({ success: true });
  } catch (error) {
    console.error('Delete bill error:', error);
    res.status(500).json({ error: { code: 'INTERNAL_ERROR', message: 'Failed to delete bill' } });
  }
});

// ============ RECURRING BILLS ============

// Get recurring bills
app.get('/recurring', authenticateToken, async (req, res) => {
  try {
    const result = await pool.query(
      `SELECT rb.*, ut.name as utility_type_name 
       FROM recurring_bills rb 
       INNER JOIN utility_types ut ON rb.utility_type_id = ut.id 
       WHERE rb.user_id = $1 
       ORDER BY rb.day_of_month ASC`,
      [req.user.userId]
    );
    res.json(result.rows);
  } catch (error) {
    console.error('Get recurring bills error:', error);
    res.status(500).json({ error: { code: 'INTERNAL_ERROR', message: 'Failed to get recurring bills' } });
  }
});

// Create recurring bill
app.post('/recurring', authenticateToken, async (req, res) => {
  try {
    const { error, value } = recurringBillSchema.validate(req.body);
    if (error) {
      return res.status(400).json({ error: { code: 'VALIDATION_ERROR', message: error.details[0].message } });
    }

    // Verify utility type exists and is accessible
    const utilityTypeCheck = await pool.query(
      'SELECT id FROM utility_types WHERE id = $1 AND (user_id IS NULL OR user_id = $2)',
      [value.utility_type_id, req.user.userId]
    );

    if (utilityTypeCheck.rows.length === 0) {
      return res.status(404).json({ error: { code: 'UTILITY_TYPE_NOT_FOUND', message: 'Utility type not found' } });
    }

    const result = await pool.query(
      `INSERT INTO recurring_bills (user_id, utility_type_id, amount, day_of_month, notes) 
       VALUES ($1, $2, $3, $4, $5) 
       RETURNING *`,
      [req.user.userId, value.utility_type_id, value.amount, value.day_of_month, value.notes || null]
    );

    res.status(201).json(result.rows[0]);
  } catch (error) {
    console.error('Create recurring bill error:', error);
    res.status(500).json({ error: { code: 'INTERNAL_ERROR', message: 'Failed to create recurring bill' } });
  }
});

// Update recurring bill
app.put('/recurring/:id', authenticateToken, async (req, res) => {
  try {
    const recurringId = req.params.id;
    const { error, value } = recurringBillSchema.validate(req.body);
    if (error) {
      return res.status(400).json({ error: { code: 'VALIDATION_ERROR', message: error.details[0].message } });
    }

    // Check if recurring bill exists and belongs to user
    const existing = await pool.query('SELECT user_id FROM recurring_bills WHERE id = $1', [recurringId]);
    if (existing.rows.length === 0) {
      return res.status(404).json({ error: { code: 'NOT_FOUND', message: 'Recurring bill not found' } });
    }

    if (existing.rows[0].user_id !== req.user.userId) {
      return res.status(403).json({ error: { code: 'FORBIDDEN', message: 'Not authorized' } });
    }

    const result = await pool.query(
      `UPDATE recurring_bills 
       SET utility_type_id = $1, amount = $2, day_of_month = $3, notes = $4, is_active = $5, updated_at = CURRENT_TIMESTAMP 
       WHERE id = $6 
       RETURNING *`,
      [value.utility_type_id, value.amount, value.day_of_month, value.notes || null, value.is_active !== false, recurringId]
    );

    res.json(result.rows[0]);
  } catch (error) {
    console.error('Update recurring bill error:', error);
    res.status(500).json({ error: { code: 'INTERNAL_ERROR', message: 'Failed to update recurring bill' } });
  }
});

// Delete recurring bill
app.delete('/recurring/:id', authenticateToken, async (req, res) => {
  try {
    const recurringId = req.params.id;

    const existing = await pool.query('SELECT user_id FROM recurring_bills WHERE id = $1', [recurringId]);
    if (existing.rows.length === 0) {
      return res.status(404).json({ error: { code: 'NOT_FOUND', message: 'Recurring bill not found' } });
    }

    if (existing.rows[0].user_id !== req.user.userId) {
      return res.status(403).json({ error: { code: 'FORBIDDEN', message: 'Not authorized' } });
    }

    await pool.query('DELETE FROM recurring_bills WHERE id = $1', [recurringId]);
    res.json({ success: true });
  } catch (error) {
    console.error('Delete recurring bill error:', error);
    res.status(500).json({ error: { code: 'INTERNAL_ERROR', message: 'Failed to delete recurring bill' } });
  }
});

// Process recurring bills - creates bills for current month if not already created
app.post('/recurring/process', authenticateToken, async (req, res) => {
  try {
    const now = new Date();
    const currentMonth = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
    const currentDay = now.getDate();

    // Get active recurring bills that haven't been generated for this month
    const recurringBills = await pool.query(
      `SELECT rb.*, ut.name as utility_type_name 
       FROM recurring_bills rb 
       INNER JOIN utility_types ut ON rb.utility_type_id = ut.id 
       WHERE rb.user_id = $1 
         AND rb.is_active = true 
         AND (rb.last_generated_month IS NULL OR rb.last_generated_month < $2)
         AND rb.day_of_month <= $3`,
      [req.user.userId, currentMonth, currentDay]
    );

    const createdBills = [];

    for (const recurring of recurringBills.rows) {
      // Create the bill date string directly to avoid timezone issues
      const billDateStr = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(recurring.day_of_month).padStart(2, '0')}`;
      
      const billResult = await pool.query(
        `INSERT INTO bills (user_id, utility_type_id, amount, bill_date, notes) 
         VALUES ($1, $2, $3, $4, $5) 
         RETURNING *`,
        [
          req.user.userId, 
          recurring.utility_type_id, 
          recurring.amount, 
          billDateStr,
          recurring.notes ? `[Auto] ${recurring.notes}` : '[Auto] Recurring bill'
        ]
      );

      // Update last_generated_month
      await pool.query(
        'UPDATE recurring_bills SET last_generated_month = $1 WHERE id = $2',
        [currentMonth, recurring.id]
      );

      createdBills.push({
        recurring_id: recurring.id,
        bill_id: billResult.rows[0].id,
        utility_type_name: recurring.utility_type_name,
        amount: recurring.amount,
      });
    }

    res.json({ 
      processed: createdBills.length, 
      created_bills: createdBills,
      current_month: currentMonth,
    });
  } catch (error) {
    console.error('Process recurring bills error:', error);
    res.status(500).json({ error: { code: 'INTERNAL_ERROR', message: 'Failed to process recurring bills' } });
  }
});

// Error handling middleware
app.use((err, req, res, next) => {
  console.error('Unhandled error:', err);
  res.status(500).json({ error: { code: 'INTERNAL_ERROR', message: 'Internal server error' } });
});

// Start server
app.listen(PORT, () => {
  console.log(`Utility service running on port ${PORT}`);
  console.log(`Database URL: ${process.env.DATABASE_URL ? 'Set' : 'NOT SET - REQUIRED!'}`);
});

// Handle uncaught errors
process.on('uncaughtException', (err) => {
  console.error('Uncaught Exception:', err);
  process.exit(1);
});

process.on('unhandledRejection', (reason, promise) => {
  console.error('Unhandled Rejection at:', promise, 'reason:', reason);
});

