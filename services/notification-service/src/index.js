require('dotenv').config();
const express = require('express');
const cors = require('cors');
const { Pool } = require('pg');
const Joi = require('joi');

const app = express();
const PORT = process.env.PORT || 3004;

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

// Authentication middleware
const authenticateToken = (req, res, next) => {
  const userId = req.headers['x-user-id'];
  if (!userId) {
    return res.status(401).json({ error: { code: 'UNAUTHORIZED', message: 'User information required' } });
  }
  req.user = { userId };
  next();
};

// Validation schemas
const alertSchema = Joi.object({
  alert_type: Joi.string().valid('bill_reminder', 'usage_threshold', 'cost_threshold', 'promotion_end').required(),
  utility_type_id: Joi.string().uuid().allow(null).optional(),
  configuration: Joi.object().required(),
});

// Routes

// Health check
app.get('/health', async (req, res) => {
  try {
    await pool.query('SELECT 1');
    res.json({ status: 'healthy', service: 'notification-service' });
  } catch (error) {
    res.status(503).json({ status: 'unhealthy', service: 'notification-service', error: error.message });
  }
});

// Get alerts
app.get('/alerts', authenticateToken, async (req, res) => {
  try {
    const { is_active } = req.query;
    let query = 'SELECT * FROM alerts WHERE user_id = $1';
    const values = [req.user.userId];
    let paramCount = 2;

    if (is_active !== undefined) {
      query += ` AND is_active = $${paramCount}`;
      values.push(is_active === 'true');
      paramCount++;
    }

    query += ' ORDER BY created_at DESC';

    const result = await pool.query(query, values);
    res.json(result.rows);
  } catch (error) {
    console.error('Get alerts error:', error);
    res.status(500).json({ error: { code: 'INTERNAL_ERROR', message: 'Failed to get alerts' } });
  }
});

// Create alert
app.post('/alerts', authenticateToken, async (req, res) => {
  try {
    const { error, value } = alertSchema.validate(req.body);
    if (error) {
      return res.status(400).json({ error: { code: 'VALIDATION_ERROR', message: error.details[0].message } });
    }

    const { alert_type, utility_type_id, configuration } = value;

    // Validate utility type if provided
    if (utility_type_id) {
      const utilityCheck = await pool.query(
        'SELECT id FROM utility_types WHERE id = $1 AND (user_id IS NULL OR user_id = $2)',
        [utility_type_id, req.user.userId]
      );

      if (utilityCheck.rows.length === 0) {
        return res.status(404).json({ error: { code: 'UTILITY_TYPE_NOT_FOUND', message: 'Utility type not found' } });
      }
    }

    const result = await pool.query(
      'INSERT INTO alerts (user_id, alert_type, utility_type_id, configuration) VALUES ($1, $2, $3, $4) RETURNING *',
      [req.user.userId, alert_type, utility_type_id || null, JSON.stringify(configuration)]
    );

    res.status(201).json(result.rows[0]);
  } catch (error) {
    console.error('Create alert error:', error);
    res.status(500).json({ error: { code: 'INTERNAL_ERROR', message: 'Failed to create alert' } });
  }
});

// Update alert
app.put('/alerts/:id', authenticateToken, async (req, res) => {
  try {
    const alertId = req.params.id;
    const { configuration, is_active } = req.body;

    // Check if alert exists and belongs to user
    const existing = await pool.query('SELECT user_id FROM alerts WHERE id = $1', [alertId]);
    if (existing.rows.length === 0) {
      return res.status(404).json({ error: { code: 'NOT_FOUND', message: 'Alert not found' } });
    }

    if (existing.rows[0].user_id !== req.user.userId) {
      return res.status(403).json({ error: { code: 'FORBIDDEN', message: 'Not authorized to update this alert' } });
    }

    const updates = [];
    const values = [];
    let paramCount = 1;

    if (configuration !== undefined) {
      updates.push(`configuration = $${paramCount}`);
      values.push(JSON.stringify(configuration));
      paramCount++;
    }

    if (is_active !== undefined) {
      updates.push(`is_active = $${paramCount}`);
      values.push(is_active);
      paramCount++;
    }

    if (updates.length === 0) {
      return res.status(400).json({ error: { code: 'NO_UPDATES', message: 'No valid fields to update' } });
    }

    values.push(alertId);
    const query = `UPDATE alerts SET ${updates.join(', ')}, updated_at = CURRENT_TIMESTAMP WHERE id = $${paramCount} RETURNING *`;

    const result = await pool.query(query, values);
    res.json(result.rows[0]);
  } catch (error) {
    console.error('Update alert error:', error);
    res.status(500).json({ error: { code: 'INTERNAL_ERROR', message: 'Failed to update alert' } });
  }
});

// Delete alert
app.delete('/alerts/:id', authenticateToken, async (req, res) => {
  try {
    const alertId = req.params.id;

    // Check if alert exists and belongs to user
    const existing = await pool.query('SELECT user_id FROM alerts WHERE id = $1', [alertId]);
    if (existing.rows.length === 0) {
      return res.status(404).json({ error: { code: 'NOT_FOUND', message: 'Alert not found' } });
    }

    if (existing.rows[0].user_id !== req.user.userId) {
      return res.status(403).json({ error: { code: 'FORBIDDEN', message: 'Not authorized to delete this alert' } });
    }

    await pool.query('DELETE FROM alerts WHERE id = $1', [alertId]);
    res.json({ success: true });
  } catch (error) {
    console.error('Delete alert error:', error);
    res.status(500).json({ error: { code: 'INTERNAL_ERROR', message: 'Failed to delete alert' } });
  }
});

// Get notifications
app.get('/notifications', authenticateToken, async (req, res) => {
  try {
    const { is_read, limit = 50, offset = 0 } = req.query;

    let query = 'SELECT * FROM notifications WHERE user_id = $1';
    const values = [req.user.userId];
    let paramCount = 2;

    if (is_read !== undefined) {
      query += ` AND is_read = $${paramCount}`;
      values.push(is_read === 'true');
      paramCount++;
    }

    // Get total count
    const countQuery = query.replace('SELECT *', 'SELECT COUNT(*)');
    const countResult = await pool.query(countQuery, values);
    const total = parseInt(countResult.rows[0].count);

    // Get unread count
    const unreadResult = await pool.query(
      'SELECT COUNT(*) FROM notifications WHERE user_id = $1 AND is_read = false',
      [req.user.userId]
    );
    const unreadCount = parseInt(unreadResult.rows[0].count);

    query += ' ORDER BY created_at DESC LIMIT $' + paramCount + ' OFFSET $' + (paramCount + 1);
    values.push(parseInt(limit), parseInt(offset));

    const result = await pool.query(query, values);

    res.json({
      notifications: result.rows,
      total,
      unread_count: unreadCount,
    });
  } catch (error) {
    console.error('Get notifications error:', error);
    res.status(500).json({ error: { code: 'INTERNAL_ERROR', message: 'Failed to get notifications' } });
  }
});

// Mark notification as read
app.put('/notifications/:id/read', authenticateToken, async (req, res) => {
  try {
    const notificationId = req.params.id;

    // Check if notification exists and belongs to user
    const existing = await pool.query('SELECT user_id FROM notifications WHERE id = $1', [notificationId]);
    if (existing.rows.length === 0) {
      return res.status(404).json({ error: { code: 'NOT_FOUND', message: 'Notification not found' } });
    }

    if (existing.rows[0].user_id !== req.user.userId) {
      return res.status(403).json({ error: { code: 'FORBIDDEN', message: 'Not authorized' } });
    }

    const result = await pool.query(
      'UPDATE notifications SET is_read = true WHERE id = $1 RETURNING id, is_read',
      [notificationId]
    );

    res.json(result.rows[0]);
  } catch (error) {
    console.error('Mark notification read error:', error);
    res.status(500).json({ error: { code: 'INTERNAL_ERROR', message: 'Failed to mark notification as read' } });
  }
});

// Check thresholds (called when a bill is created)
app.post('/check-thresholds', authenticateToken, async (req, res) => {
  try {
    const { bill_id } = req.body;
    if (!bill_id) {
      return res.status(400).json({ error: { code: 'VALIDATION_ERROR', message: 'bill_id is required' } });
    }

    // Get the bill
    const billResult = await pool.query(
      'SELECT b.*, ut.name as utility_type_name FROM bills b INNER JOIN utility_types ut ON b.utility_type_id = ut.id WHERE b.id = $1 AND b.user_id = $2',
      [bill_id, req.user.userId]
    );

    if (billResult.rows.length === 0) {
      return res.status(404).json({ error: { code: 'BILL_NOT_FOUND', message: 'Bill not found' } });
    }

    const bill = billResult.rows[0];

    // Get active alerts for this user and utility type
    const alertsResult = await pool.query(
      'SELECT * FROM alerts WHERE user_id = $1 AND is_active = true AND (utility_type_id = $2 OR utility_type_id IS NULL)',
      [req.user.userId, bill.utility_type_id]
    );

    const triggeredAlerts = [];

    for (const alert of alertsResult.rows) {
      const config = typeof alert.configuration === 'string' ? JSON.parse(alert.configuration) : alert.configuration;
      let shouldTrigger = false;
      let notificationTitle = '';
      let notificationMessage = '';

      switch (alert.alert_type) {
        case 'usage_threshold':
          if (bill.usage_amount && config.threshold) {
            const threshold = parseFloat(config.threshold);
            const usage = parseFloat(bill.usage_amount);
            const comparison = config.comparison || 'greater_than';

            if (
              (comparison === 'greater_than' && usage > threshold) ||
              (comparison === 'less_than' && usage < threshold) ||
              (comparison === 'equals' && usage === threshold)
            ) {
              shouldTrigger = true;
              notificationTitle = 'Usage Threshold Alert';
              notificationMessage = `Your ${bill.utility_type_name} usage (${usage} ${config.unit || ''}) has ${comparison === 'greater_than' ? 'exceeded' : comparison === 'less_than' ? 'fallen below' : 'reached'} the threshold of ${threshold} ${config.unit || ''}.`;
            }
          }
          break;

        case 'cost_threshold':
          if (bill.amount && config.threshold) {
            const threshold = parseFloat(config.threshold);
            const cost = parseFloat(bill.amount);
            const comparison = config.comparison || 'greater_than';

            if (
              (comparison === 'greater_than' && cost > threshold) ||
              (comparison === 'less_than' && cost < threshold) ||
              (comparison === 'equals' && cost === threshold)
            ) {
              shouldTrigger = true;
              notificationTitle = 'Cost Threshold Alert';
              notificationMessage = `Your ${bill.utility_type_name} bill ($${cost.toFixed(2)}) has ${comparison === 'greater_than' ? 'exceeded' : comparison === 'less_than' ? 'fallen below' : 'reached'} the threshold of $${threshold.toFixed(2)}.`;
            }
          }
          break;
      }

      if (shouldTrigger) {
        // Create notification
        await pool.query(
          'INSERT INTO notifications (user_id, alert_id, title, message, notification_type) VALUES ($1, $2, $3, $4, $5)',
          [req.user.userId, alert.id, notificationTitle, notificationMessage, 'alert']
        );

        // Update last_triggered
        await pool.query('UPDATE alerts SET last_triggered = CURRENT_TIMESTAMP WHERE id = $1', [alert.id]);

        triggeredAlerts.push({
          alert_id: alert.id,
          alert_type: alert.alert_type,
          notification_title: notificationTitle,
        });
      }
    }

    res.json({ triggered_alerts: triggeredAlerts });
  } catch (error) {
    console.error('Check thresholds error:', error);
    res.status(500).json({ error: { code: 'INTERNAL_ERROR', message: 'Failed to check thresholds' } });
  }
});

// Check promotion end dates (called periodically or on app load)
app.post('/check-promotions', authenticateToken, async (req, res) => {
  try {
    // Get active promotion_end alerts for this user
    const alertsResult = await pool.query(
      "SELECT * FROM alerts WHERE user_id = $1 AND is_active = true AND alert_type = 'promotion_end'",
      [req.user.userId]
    );

    const triggeredAlerts = [];
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    for (const alert of alertsResult.rows) {
      const config = typeof alert.configuration === 'string' ? JSON.parse(alert.configuration) : alert.configuration;
      
      if (!config.end_date) continue;

      const endDate = new Date(config.end_date);
      endDate.setHours(0, 0, 0, 0);
      
      const daysUntilEnd = Math.ceil((endDate - today) / (1000 * 60 * 60 * 24));
      const daysBefore = parseInt(config.days_before) || 7;

      // Check if we should trigger (within the notification window and not already triggered today)
      if (daysUntilEnd <= daysBefore && daysUntilEnd >= 0) {
        // Check if already notified today
        const lastTriggered = alert.last_triggered ? new Date(alert.last_triggered) : null;
        const alreadyNotifiedToday = lastTriggered && 
          lastTriggered.toDateString() === today.toDateString();

        if (!alreadyNotifiedToday) {
          const promotionName = config.promotion_name || 'Your promotion';
          const utilityName = config.utility_name || 'utility';
          
          let notificationMessage;
          if (daysUntilEnd === 0) {
            notificationMessage = `${promotionName} for ${utilityName} ends TODAY! Make sure to review your options.`;
          } else if (daysUntilEnd === 1) {
            notificationMessage = `${promotionName} for ${utilityName} ends TOMORROW! Time to review your options.`;
          } else {
            notificationMessage = `${promotionName} for ${utilityName} ends in ${daysUntilEnd} days (${endDate.toLocaleDateString()}). Consider reviewing your options.`;
          }

          // Create notification
          await pool.query(
            'INSERT INTO notifications (user_id, alert_id, title, message, notification_type) VALUES ($1, $2, $3, $4, $5)',
            [req.user.userId, alert.id, 'Promotion Ending Soon', notificationMessage, 'warning']
          );

          // Update last_triggered
          await pool.query('UPDATE alerts SET last_triggered = CURRENT_TIMESTAMP WHERE id = $1', [alert.id]);

          triggeredAlerts.push({
            alert_id: alert.id,
            promotion_name: promotionName,
            days_until_end: daysUntilEnd,
          });

          // Auto-deactivate if promotion has ended
          if (daysUntilEnd <= 0) {
            await pool.query('UPDATE alerts SET is_active = false WHERE id = $1', [alert.id]);
          }
        }
      }
    }

    res.json({ triggered_alerts: triggeredAlerts });
  } catch (error) {
    console.error('Check promotions error:', error);
    res.status(500).json({ error: { code: 'INTERNAL_ERROR', message: 'Failed to check promotions' } });
  }
});

// Error handling middleware
app.use((err, req, res, next) => {
  console.error('Unhandled error:', err);
  res.status(500).json({ error: { code: 'INTERNAL_ERROR', message: 'Internal server error' } });
});

// Start server
app.listen(PORT, () => {
  console.log(`Notification service running on port ${PORT}`);
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

