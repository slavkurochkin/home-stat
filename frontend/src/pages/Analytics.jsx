import { useEffect, useState } from 'react';
import {
  Typography,
  Box,
  Card,
  CardContent,
  Grid,
  TextField,
  Button,
  CircularProgress,
  Alert,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Paper,
  Chip,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  InputAdornment,
  Tooltip,
} from '@mui/material';
import AddIcon from '@mui/icons-material/Add';
import {
  LineChart,
  Line,
  BarChart,
  Bar,
  PieChart,
  Pie,
  Cell,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip as RechartsTooltip,
  Legend,
  ResponsiveContainer,
} from 'recharts';
import api from '../services/api';
import { format, subMonths, parse } from 'date-fns';

// Format "2025-12" to "Dec 2025"
const formatPeriod = (period) => {
  if (!period) return '';
  try {
    const date = parse(period, 'yyyy-MM', new Date());
    return format(date, 'MMM yyyy');
  } catch {
    return period;
  }
};

const COLORS = ['#0088FE', '#00C49F', '#FFBB28', '#FF8042', '#8884d8'];

export default function Analytics() {
  const [costTrends, setCostTrends] = useState([]);
  const [usageTrends, setUsageTrends] = useState([]);
  const [summary, setSummary] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [dateRange, setDateRange] = useState({
    start_date: format(subMonths(new Date(), 12), 'yyyy-MM-dd'),
    end_date: format(new Date(), 'yyyy-MM-dd'),
  });

  // Quick Add Bill state
  const [quickAddOpen, setQuickAddOpen] = useState(false);
  const [quickAddData, setQuickAddData] = useState({
    utility_type_id: '',
    utility_type_name: '',
    period: '',
    amount: '',
    notes: '',
  });
  const [quickAddError, setQuickAddError] = useState('');

  useEffect(() => {
    fetchAnalytics();
  }, []);

  const fetchAnalytics = async () => {
    try {
      setLoading(true);
      setError('');

      const [costTrendsRes, usageTrendsRes, summaryRes] = await Promise.all([
        api.get('/analytics/cost-trends', { params: dateRange }),
        api.get('/analytics/usage-trends', { params: dateRange }),
        api.get('/analytics/cost-summary', { params: dateRange }),
      ]);

      setCostTrends(costTrendsRes.data.data);
      setUsageTrends(usageTrendsRes.data.data);
      setSummary(summaryRes.data);
    } catch (err) {
      setError(err.response?.data?.error?.message || 'Failed to load analytics');
    } finally {
      setLoading(false);
    }
  };

  const handleDateChange = (field, value) => {
    setDateRange({ ...dateRange, [field]: value });
  };

  const handleApply = () => {
    fetchAnalytics();
  };

  // Quick Add Bill handlers
  const handleQuickAdd = (period, utilityType) => {
    // Parse the period to get middle of that month (15th to avoid timezone issues)
    const [year, month] = period.split('-');
    const billDate = `${year}-${month}-15`;
    
    setQuickAddData({
      utility_type_id: utilityType.utility_type_id,
      utility_type_name: utilityType.utility_type_name,
      period: period,
      bill_date: billDate,
      amount: '',
      notes: '',
    });
    setQuickAddError('');
    setQuickAddOpen(true);
  };

  const handleQuickAddClose = () => {
    setQuickAddOpen(false);
    setQuickAddError('');
  };

  const handleQuickAddSubmit = async (e) => {
    e.preventDefault();
    try {
      setQuickAddError('');
      await api.post('/utilities/bills', {
        utility_type_id: quickAddData.utility_type_id,
        amount: parseFloat(quickAddData.amount),
        bill_date: quickAddData.bill_date,
        notes: quickAddData.notes || null,
      });
      handleQuickAddClose();
      fetchAnalytics(); // Refresh data
    } catch (err) {
      setQuickAddError(err.response?.data?.error?.message || 'Failed to add bill');
    }
  };

  if (loading) {
    return (
      <Box display="flex" justifyContent="center" p={4}>
        <CircularProgress />
      </Box>
    );
  }

  if (error) {
    return <Alert severity="error">{error}</Alert>;
  }

  // Group cost trends by period for chart
  const costByPeriod = {};
  costTrends.forEach((item) => {
    if (!costByPeriod[item.period]) {
      costByPeriod[item.period] = {};
    }
    costByPeriod[item.period][item.utility_type_name] = item.total_cost;
  });

  const costChartData = Object.keys(costByPeriod).map((period) => ({
    period,
    ...costByPeriod[period],
  }));

  // Calculate true average monthly (total / number of months, not bills)
  const monthCount = Object.keys(costByPeriod).length;
  const trueAverageMonthly = monthCount > 0 ? (summary?.total_cost || 0) / monthCount : 0;

  return (
    <Box>
      <Typography variant="h4" gutterBottom>
        Analytics
      </Typography>

      <Card sx={{ mb: 3, p: 2 }}>
        <Grid container spacing={2} alignItems="center">
          <Grid item xs={12} sm={4}>
            <TextField
              fullWidth
              label="Start Date"
              type="date"
              value={dateRange.start_date}
              onChange={(e) => handleDateChange('start_date', e.target.value)}
              InputLabelProps={{ shrink: true }}
            />
          </Grid>
          <Grid item xs={12} sm={4}>
            <TextField
              fullWidth
              label="End Date"
              type="date"
              value={dateRange.end_date}
              onChange={(e) => handleDateChange('end_date', e.target.value)}
              InputLabelProps={{ shrink: true }}
            />
          </Grid>
          <Grid item xs={12} sm={4}>
            <Button variant="contained" fullWidth onClick={handleApply}>
              Apply
            </Button>
          </Grid>
        </Grid>
      </Card>

      <Grid container spacing={3}>
        <Grid item xs={12}>
          <Card>
            <CardContent>
              <Typography variant="h6" gutterBottom>
                Cost Trends
              </Typography>
              <ResponsiveContainer width="100%" height={300}>
                <LineChart data={costChartData}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="period" />
                  <YAxis />
                  <RechartsTooltip />
                  <Legend />
                  {summary?.by_utility_type?.map((type, index) => (
                    <Line
                      key={type.utility_type_id}
                      type="monotone"
                      dataKey={type.utility_type_name}
                      stroke={COLORS[index % COLORS.length]}
                    />
                  ))}
                </LineChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>
        </Grid>

        <Grid item xs={12} md={6}>
          <Card>
            <CardContent>
              <Typography variant="h6" gutterBottom>
                Cost Distribution
              </Typography>
              <ResponsiveContainer width="100%" height={300}>
                <PieChart>
                  <Pie
                    data={summary?.by_utility_type || []}
                    dataKey="total"
                    nameKey="utility_type_name"
                    cx="50%"
                    cy="50%"
                    outerRadius={80}
                    label
                  >
                    {(summary?.by_utility_type || []).map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                    ))}
                  </Pie>
                  <RechartsTooltip />
                  <Legend />
                </PieChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>
        </Grid>

        <Grid item xs={12} md={6}>
          <Card>
            <CardContent>
              <Typography variant="h6" gutterBottom>
                Summary Statistics
              </Typography>
              <Box sx={{ mt: 2 }}>
                <Typography variant="body1">
                  Total Cost: <strong>${summary?.total_cost?.toFixed(2) || '0.00'}</strong>
                </Typography>
                <Typography variant="body1" sx={{ mt: 1 }}>
                  Monthly Average: <strong>${trueAverageMonthly.toFixed(2)}</strong>
                  <Typography component="span" variant="body2" color="text.secondary" sx={{ ml: 1 }}>
                    ({monthCount} month{monthCount !== 1 ? 's' : ''})
                  </Typography>
                </Typography>
                <Typography variant="body1" sx={{ mt: 1 }}>
                  Total Bills: <strong>{summary?.bill_count || 0}</strong>
                </Typography>
              </Box>
            </CardContent>
          </Card>
        </Grid>

        {/* Monthly Breakdown Table */}
        <Grid item xs={12}>
          <Card>
            <CardContent>
              <Typography variant="h6" gutterBottom>
                Monthly Breakdown
              </Typography>
              <TableContainer component={Paper} variant="outlined">
                <Table size="small">
                  <TableHead>
                    <TableRow sx={{ bgcolor: 'grey.100' }}>
                      <TableCell><strong>Month</strong></TableCell>
                      {summary?.by_utility_type?.map((type, index) => (
                        <TableCell key={type.utility_type_id} align="right">
                          <Chip 
                            size="small" 
                            label={type.utility_type_name}
                            sx={{ bgcolor: COLORS[index % COLORS.length], color: 'white' }}
                          />
                        </TableCell>
                      ))}
                      <TableCell align="right"><strong>Total</strong></TableCell>
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {Object.keys(costByPeriod)
                      .sort()
                      .reverse()
                      .map((period) => {
                        const monthTotal = Object.values(costByPeriod[period]).reduce((sum, val) => sum + val, 0);
                        const isHighest = summary?.by_utility_type && monthTotal === Math.max(
                          ...Object.keys(costByPeriod).map(p => 
                            Object.values(costByPeriod[p]).reduce((sum, val) => sum + val, 0)
                          )
                        );
                        const isLowest = summary?.by_utility_type && monthTotal === Math.min(
                          ...Object.keys(costByPeriod).map(p => 
                            Object.values(costByPeriod[p]).reduce((sum, val) => sum + val, 0)
                          )
                        );
                        return (
                          <TableRow 
                            key={period}
                            sx={{ 
                              bgcolor: isHighest ? 'error.lighter' : isLowest ? 'success.lighter' : 'inherit',
                              '&:hover': { bgcolor: 'action.hover' }
                            }}
                          >
                            <TableCell>
                              {formatPeriod(period)}
                              {isHighest && <Chip size="small" label="Highest" color="error" sx={{ ml: 1 }} />}
                              {isLowest && <Chip size="small" label="Lowest" color="success" sx={{ ml: 1 }} />}
                            </TableCell>
                            {summary?.by_utility_type?.map((type) => {
                              const hasValue = costByPeriod[period][type.utility_type_name];
                              return (
                                <TableCell 
                                  key={type.utility_type_id} 
                                  align="right"
                                  onClick={!hasValue ? () => handleQuickAdd(period, type) : undefined}
                                  sx={!hasValue ? { 
                                    cursor: 'pointer',
                                    '&:hover': { 
                                      bgcolor: 'primary.light',
                                      color: 'primary.contrastText',
                                    },
                                  } : {}}
                                >
                                  {hasValue ? (
                                    `$${hasValue.toFixed(2)}`
                                  ) : (
                                    <Tooltip title={`Add ${type.utility_type_name} bill for ${formatPeriod(period)}`}>
                                      <Box 
                                        component="span" 
                                        sx={{ 
                                          display: 'inline-flex', 
                                          alignItems: 'center',
                                          color: 'text.disabled',
                                          '&:hover': { color: 'inherit' },
                                        }}
                                      >
                                        <AddIcon sx={{ fontSize: 16, mr: 0.5 }} />
                                        Add
                                      </Box>
                                    </Tooltip>
                                  )}
                                </TableCell>
                              );
                            })}
                            <TableCell align="right">
                              <strong>${monthTotal.toFixed(2)}</strong>
                            </TableCell>
                          </TableRow>
                        );
                      })}
                    {Object.keys(costByPeriod).length === 0 && (
                      <TableRow>
                        <TableCell colSpan={(summary?.by_utility_type?.length || 0) + 2} align="center">
                          No data available for this period
                        </TableCell>
                      </TableRow>
                    )}
                  </TableBody>
                </Table>
              </TableContainer>
            </CardContent>
          </Card>
        </Grid>
      </Grid>

      {/* Quick Add Bill Dialog */}
      <Dialog open={quickAddOpen} onClose={handleQuickAddClose} maxWidth="xs" fullWidth>
        <form onSubmit={handleQuickAddSubmit}>
          <DialogTitle>
            Add Bill for {formatPeriod(quickAddData.period)}
          </DialogTitle>
          <DialogContent>
            {quickAddError && (
              <Alert severity="error" sx={{ mb: 2 }} onClose={() => setQuickAddError('')}>
                {quickAddError}
              </Alert>
            )}
            <Typography variant="subtitle1" color="primary" sx={{ mb: 2 }}>
              {quickAddData.utility_type_name}
            </Typography>
            <TextField
              fullWidth
              label="Amount"
              type="number"
              step="0.01"
              value={quickAddData.amount}
              onChange={(e) => setQuickAddData({ ...quickAddData, amount: e.target.value })}
              margin="normal"
              required
              autoFocus
              InputProps={{
                startAdornment: <InputAdornment position="start">$</InputAdornment>,
              }}
            />
            <TextField
              fullWidth
              label="Notes (Optional)"
              value={quickAddData.notes}
              onChange={(e) => setQuickAddData({ ...quickAddData, notes: e.target.value })}
              margin="normal"
            />
          </DialogContent>
          <DialogActions>
            <Button onClick={handleQuickAddClose}>Cancel</Button>
            <Button type="submit" variant="contained">
              Add Bill
            </Button>
          </DialogActions>
        </form>
      </Dialog>
    </Box>
  );
}

