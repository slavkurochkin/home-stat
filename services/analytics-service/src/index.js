require('dotenv').config();
const express = require('express');
const cors = require('cors');
const { Pool } = require('pg');

const app = express();
const PORT = process.env.PORT || 3003;

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

// Routes

// Health check
app.get('/health', async (req, res) => {
  try {
    await pool.query('SELECT 1');
    res.json({ status: 'healthy', service: 'analytics-service' });
  } catch (error) {
    res.status(503).json({ status: 'unhealthy', service: 'analytics-service', error: error.message });
  }
});

// Cost summary
app.get('/cost-summary', authenticateToken, async (req, res) => {
  try {
    const { start_date, end_date, utility_type_id } = req.query;
    const userId = req.user.userId;

    let query = `
      SELECT 
        COALESCE(SUM(b.amount), 0) as total_cost,
        COUNT(*) as bill_count,
        b.utility_type_id,
        ut.name as utility_type_name
      FROM bills b
      INNER JOIN utility_types ut ON b.utility_type_id = ut.id
      WHERE b.user_id = $1
    `;
    const values = [userId];
    let paramCount = 2;

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

    if (utility_type_id) {
      query += ` AND b.utility_type_id = $${paramCount}`;
      values.push(utility_type_id);
      paramCount++;
    }

    query += ' GROUP BY b.utility_type_id, ut.name';

    const result = await pool.query(query, values);

    const totalCost = result.rows.reduce((sum, row) => sum + parseFloat(row.total_cost), 0);
    const billCount = result.rows.reduce((sum, row) => sum + parseInt(row.bill_count), 0);
    const averageMonthly = billCount > 0 ? totalCost / billCount : 0;

    // Calculate period
    let periodQuery = 'SELECT MIN(bill_date) as start_date, MAX(bill_date) as end_date FROM bills WHERE user_id = $1';
    const periodValues = [userId];
    if (start_date) {
      periodQuery += ' AND bill_date >= $2';
      periodValues.push(start_date);
    }
    if (end_date) {
      periodQuery += ` AND bill_date <= $${periodValues.length + 1}`;
      periodValues.push(end_date);
    }

    const periodResult = await pool.query(periodQuery, periodValues);
    const period = periodResult.rows[0] || { start_date: null, end_date: null };

    res.json({
      total_cost: parseFloat(totalCost.toFixed(2)),
      average_monthly: parseFloat(averageMonthly.toFixed(2)),
      bill_count: billCount,
      by_utility_type: result.rows.map((row) => ({
        utility_type_id: row.utility_type_id,
        utility_type_name: row.utility_type_name,
        total: parseFloat(row.total_cost),
        bill_count: parseInt(row.bill_count),
        average: parseFloat((parseFloat(row.total_cost) / parseInt(row.bill_count)).toFixed(2)),
      })),
      period,
    });
  } catch (error) {
    console.error('Cost summary error:', error);
    res.status(500).json({ error: { code: 'INTERNAL_ERROR', message: 'Failed to get cost summary' } });
  }
});

// Cost trends
app.get('/cost-trends', authenticateToken, async (req, res) => {
  try {
    const { start_date, end_date, utility_type_id, group_by = 'month' } = req.query;
    const userId = req.user.userId;

    if (!start_date || !end_date) {
      return res.status(400).json({ error: { code: 'VALIDATION_ERROR', message: 'start_date and end_date are required' } });
    }

    let dateFormat;
    switch (group_by) {
      case 'month':
        dateFormat = "TO_CHAR(bill_date, 'YYYY-MM')";
        break;
      case 'quarter':
        dateFormat = "TO_CHAR(bill_date, 'YYYY') || '-Q' || TO_CHAR(bill_date, 'Q')";
        break;
      case 'year':
        dateFormat = "TO_CHAR(bill_date, 'YYYY')";
        break;
      default:
        dateFormat = "TO_CHAR(bill_date, 'YYYY-MM')";
    }

    let query = `
      SELECT 
        ${dateFormat} as period,
        COALESCE(SUM(amount), 0) as total_cost,
        utility_type_id,
        ut.name as utility_type_name
      FROM bills b
      INNER JOIN utility_types ut ON b.utility_type_id = ut.id
      WHERE b.user_id = $1 AND b.bill_date >= $2 AND b.bill_date <= $3
    `;
    const values = [userId, start_date, end_date];
    let paramCount = 4;

    if (utility_type_id) {
      query += ` AND b.utility_type_id = $${paramCount}`;
      values.push(utility_type_id);
      paramCount++;
    }

    query += ` GROUP BY ${dateFormat}, b.utility_type_id, ut.name ORDER BY period ASC, utility_type_name ASC`;

    const result = await pool.query(query, values);

    res.json({
      data: result.rows.map((row) => ({
        period: row.period,
        total_cost: parseFloat(row.total_cost),
        utility_type_id: row.utility_type_id,
        utility_type_name: row.utility_type_name,
      })),
      period: { start_date, end_date },
      group_by,
    });
  } catch (error) {
    console.error('Cost trends error:', error);
    res.status(500).json({ error: { code: 'INTERNAL_ERROR', message: 'Failed to get cost trends' } });
  }
});

// Usage trends
app.get('/usage-trends', authenticateToken, async (req, res) => {
  try {
    const { start_date, end_date, utility_type_id, group_by = 'month' } = req.query;
    const userId = req.user.userId;

    if (!start_date || !end_date) {
      return res.status(400).json({ error: { code: 'VALIDATION_ERROR', message: 'start_date and end_date are required' } });
    }

    let dateFormat;
    switch (group_by) {
      case 'month':
        dateFormat = "TO_CHAR(bill_date, 'YYYY-MM')";
        break;
      case 'quarter':
        dateFormat = "TO_CHAR(bill_date, 'YYYY') || '-Q' || TO_CHAR(bill_date, 'Q')";
        break;
      case 'year':
        dateFormat = "TO_CHAR(bill_date, 'YYYY')";
        break;
      default:
        dateFormat = "TO_CHAR(bill_date, 'YYYY-MM')";
    }

    let query = `
      SELECT 
        ${dateFormat} as period,
        COALESCE(SUM(usage_amount), 0) as total_usage,
        b.utility_type_id,
        ut.name as utility_type_name,
        ut.unit_of_measurement
      FROM bills b
      INNER JOIN utility_types ut ON b.utility_type_id = ut.id
      WHERE b.user_id = $1 AND b.bill_date >= $2 AND b.bill_date <= $3 AND b.usage_amount IS NOT NULL
    `;
    const values = [userId, start_date, end_date];
    let paramCount = 4;

    if (utility_type_id) {
      query += ` AND b.utility_type_id = $${paramCount}`;
      values.push(utility_type_id);
      paramCount++;
    }

    query += ` GROUP BY ${dateFormat}, b.utility_type_id, ut.name, ut.unit_of_measurement ORDER BY period ASC, utility_type_name ASC`;

    const result = await pool.query(query, values);

    res.json({
      data: result.rows.map((row) => ({
        period: row.period,
        total_usage: parseFloat(row.total_usage),
        utility_type_id: row.utility_type_id,
        utility_type_name: row.utility_type_name,
        unit_of_measurement: row.unit_of_measurement,
      })),
      period: { start_date, end_date },
      group_by,
    });
  } catch (error) {
    console.error('Usage trends error:', error);
    res.status(500).json({ error: { code: 'INTERNAL_ERROR', message: 'Failed to get usage trends' } });
  }
});

// Comparison
app.get('/comparison', authenticateToken, async (req, res) => {
  try {
    const { period1_start, period1_end, period2_start, period2_end, utility_type_id } = req.query;
    const userId = req.user.userId;

    if (!period1_start || !period1_end || !period2_start || !period2_end) {
      return res.status(400).json({
        error: { code: 'VALIDATION_ERROR', message: 'All period dates are required' },
      });
    }

    let query = `
      SELECT 
        COALESCE(SUM(amount), 0) as total_cost,
        COALESCE(SUM(usage_amount), 0) as total_usage,
        COUNT(*) as bill_count
      FROM bills
      WHERE user_id = $1 AND bill_date >= $2 AND bill_date <= $3
    `;
    const values = [userId, period1_start, period1_end];
    let paramCount = 4;

    if (utility_type_id) {
      query += ` AND utility_type_id = $${paramCount}`;
      values.push(utility_type_id);
      paramCount++;
    }

    const period1Result = await pool.query(query, values);

    // Period 2
    const period2Values = [userId, period2_start, period2_end];
    let period2ParamCount = 4;
    if (utility_type_id) {
      period2Values.push(utility_type_id);
    }
    const period2Result = await pool.query(query.replace('$2', '$2').replace('$3', '$3'), period2Values);

    const period1 = {
      total_cost: parseFloat(period1Result.rows[0].total_cost),
      total_usage: parseFloat(period1Result.rows[0].total_usage || 0),
      bill_count: parseInt(period1Result.rows[0].bill_count),
      average: period1Result.rows[0].bill_count > 0 ? parseFloat((parseFloat(period1Result.rows[0].total_cost) / parseInt(period1Result.rows[0].bill_count)).toFixed(2)) : 0,
    };

    const period2 = {
      total_cost: parseFloat(period2Result.rows[0].total_cost),
      total_usage: parseFloat(period2Result.rows[0].total_usage || 0),
      bill_count: parseInt(period2Result.rows[0].bill_count),
      average: period2Result.rows[0].bill_count > 0 ? parseFloat((parseFloat(period2Result.rows[0].total_cost) / parseInt(period2Result.rows[0].bill_count)).toFixed(2)) : 0,
    };

    const costChange = period1.total_cost > 0 ? ((period2.total_cost - period1.total_cost) / period1.total_cost) * 100 : 0;
    const usageChange = period1.total_usage > 0 ? ((period2.total_usage - period1.total_usage) / period1.total_usage) * 100 : 0;

    res.json({
      period1: {
        ...period1,
        dates: { start: period1_start, end: period1_end },
      },
      period2: {
        ...period2,
        dates: { start: period2_start, end: period2_end },
      },
      change: {
        cost_change_percent: parseFloat(costChange.toFixed(2)),
        usage_change_percent: parseFloat(usageChange.toFixed(2)),
      },
    });
  } catch (error) {
    console.error('Comparison error:', error);
    res.status(500).json({ error: { code: 'INTERNAL_ERROR', message: 'Failed to get comparison' } });
  }
});

// Forecast
app.get('/forecast', authenticateToken, async (req, res) => {
  try {
    const { utility_type_id, months_ahead = 3 } = req.query;
    const userId = req.user.userId;

    // Get historical data (last 12 months)
    const endDate = new Date();
    const startDate = new Date();
    startDate.setMonth(startDate.getMonth() - 12);

    let query = `
      SELECT 
        TO_CHAR(bill_date, 'YYYY-MM') as month,
        AVG(amount) as avg_amount,
        COUNT(*) as bill_count
      FROM bills
      WHERE user_id = $1 AND bill_date >= $2 AND bill_date <= $3
    `;
    const values = [userId, startDate.toISOString().split('T')[0], endDate.toISOString().split('T')[0]];
    let paramCount = 4;

    if (utility_type_id) {
      query += ` AND utility_type_id = $${paramCount}`;
      values.push(utility_type_id);
      paramCount++;
    }

    query += ' GROUP BY TO_CHAR(bill_date, \'YYYY-MM\') ORDER BY month ASC';

    const result = await pool.query(query, values);

    if (result.rows.length === 0) {
      return res.json({ forecasts: [], message: 'Insufficient data for forecasting' });
    }

    // Calculate average monthly cost
    const avgMonthlyCost = result.rows.reduce((sum, row) => sum + parseFloat(row.avg_amount), 0) / result.rows.length;

    // Generate forecasts
    const forecasts = [];
    const currentDate = new Date();
    for (let i = 1; i <= parseInt(months_ahead); i++) {
      const forecastDate = new Date(currentDate);
      forecastDate.setMonth(forecastDate.getMonth() + i);
      forecasts.push({
        month: forecastDate.toISOString().split('T')[0].substring(0, 7),
        predicted_cost: parseFloat(avgMonthlyCost.toFixed(2)),
        confidence_level: result.rows.length >= 6 ? 'high' : result.rows.length >= 3 ? 'medium' : 'low',
      });
    }

    res.json({ forecasts });
  } catch (error) {
    console.error('Forecast error:', error);
    res.status(500).json({ error: { code: 'INTERNAL_ERROR', message: 'Failed to get forecast' } });
  }
});

// Error handling middleware
app.use((err, req, res, next) => {
  console.error('Unhandled error:', err);
  res.status(500).json({ error: { code: 'INTERNAL_ERROR', message: 'Internal server error' } });
});

// Start server
app.listen(PORT, () => {
  console.log(`Analytics service running on port ${PORT}`);
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

