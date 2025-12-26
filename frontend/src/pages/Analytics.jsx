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
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  OutlinedInput,
  Checkbox,
  ListItemText,
  IconButton,
  Collapse,
} from '@mui/material';
import AddIcon from '@mui/icons-material/Add';
import ExpandMoreIcon from '@mui/icons-material/ExpandMore';
import ExpandLessIcon from '@mui/icons-material/ExpandLess';
import FilterListIcon from '@mui/icons-material/FilterList';
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

const COLORS = [
  '#3b82f6', // blue
  '#10b981', // emerald
  '#f59e0b', // amber
  '#ef4444', // red
  '#8b5cf6', // violet
  '#ec4899', // pink
  '#06b6d4', // cyan
  '#84cc16', // lime
  '#f97316', // orange
  '#6366f1', // indigo
  '#14b8a6', // teal
  '#a855f7', // purple
];

// Custom label for pie chart
const renderCustomLabel = ({ cx, cy, midAngle, innerRadius, outerRadius, percent, name, value }) => {
  if (percent < 0.05) return null; // Don't show labels for slices < 5%
  const RADIAN = Math.PI / 180;
  const radius = outerRadius + 25;
  const x = cx + radius * Math.cos(-midAngle * RADIAN);
  const y = cy + radius * Math.sin(-midAngle * RADIAN);
  
  return (
    <text
      x={x}
      y={y}
      fill="#374151"
      textAnchor={x > cx ? 'start' : 'end'}
      dominantBaseline="central"
      fontSize={12}
      fontWeight={500}
    >
      {`${(percent * 100).toFixed(0)}%`}
    </text>
  );
};

// Custom tooltip for pie chart
const CustomPieTooltip = ({ active, payload }) => {
  if (active && payload && payload.length) {
    const data = payload[0];
    return (
      <Box
        sx={{
          bgcolor: 'background.paper',
          p: 1.5,
          borderRadius: 1,
          boxShadow: 2,
          border: '1px solid',
          borderColor: 'divider',
        }}
      >
        <Typography variant="subtitle2" sx={{ color: data.payload.fill, fontWeight: 600 }}>
          {data.name}
        </Typography>
        <Typography variant="body2">
          ${data.value.toFixed(2)}
        </Typography>
        <Typography variant="caption" color="text.secondary">
          {((data.value / data.payload.totalCost) * 100).toFixed(1)}% of total
        </Typography>
      </Box>
    );
  }
  return null;
};

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

  // Monthly Breakdown filter/view state
  const [selectedUtilityTypes, setSelectedUtilityTypes] = useState([]);
  const [expandedRows, setExpandedRows] = useState({});
  const [breakdownViewMode, setBreakdownViewMode] = useState('table'); // 'table' or 'compact'

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
      // Initialize selected utility types to show all (or first 5 if more than 5)
      const types = summaryRes.data?.by_utility_type || [];
      if (selectedUtilityTypes.length === 0) {
        setSelectedUtilityTypes(types.slice(0, 5).map(t => t.utility_type_id));
      }
    } catch (err) {
      setError(err.response?.data?.error?.message || 'Failed to load analytics');
    } finally {
      setLoading(false);
    }
  };

  // Handle utility type filter change
  const handleUtilityTypeFilterChange = (event) => {
    const value = event.target.value;
    setSelectedUtilityTypes(typeof value === 'string' ? value.split(',') : value);
  };

  // Toggle row expansion for compact view
  const toggleRowExpansion = (period) => {
    setExpandedRows(prev => ({ ...prev, [period]: !prev[period] }));
  };

  // Get filtered utility types for display
  const getFilteredUtilityTypes = () => {
    if (!summary?.by_utility_type) return [];
    if (selectedUtilityTypes.length === 0) return summary.by_utility_type;
    return summary.by_utility_type.filter(t => selectedUtilityTypes.includes(t.utility_type_id));
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
              <ResponsiveContainer width="100%" height={340}>
                <PieChart>
                  <Pie
                    data={(summary?.by_utility_type || []).map(item => ({
                      ...item,
                      totalCost: summary?.total_cost || 0,
                    }))}
                    dataKey="total"
                    nameKey="utility_type_name"
                    cx="50%"
                    cy="45%"
                    innerRadius={60}
                    outerRadius={100}
                    paddingAngle={2}
                    label={renderCustomLabel}
                    labelLine={false}
                  >
                    {(summary?.by_utility_type || []).map((entry, index) => (
                      <Cell 
                        key={`cell-${index}`} 
                        fill={COLORS[index % COLORS.length]}
                        stroke="#fff"
                        strokeWidth={2}
                      />
                    ))}
                  </Pie>
                  <RechartsTooltip content={<CustomPieTooltip />} />
                  <Legend 
                    layout="horizontal"
                    align="center"
                    verticalAlign="bottom"
                    wrapperStyle={{ paddingTop: 20 }}
                    iconType="circle"
                    iconSize={10}
                    formatter={(value) => (
                      <span style={{ color: '#374151', fontSize: 12 }}>{value}</span>
                    )}
                  />
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
              {/* Header with title and controls */}
              <Box display="flex" justifyContent="space-between" alignItems="center" flexWrap="wrap" gap={2} mb={2}>
                <Typography variant="h6">
                  Monthly Breakdown
                </Typography>
                <Box display="flex" gap={2} alignItems="center" flexWrap="wrap">
                  {/* View mode toggle */}
                  <Box display="flex" gap={0.5}>
                    <Chip
                      label="Table"
                      size="small"
                      onClick={() => setBreakdownViewMode('table')}
                      color={breakdownViewMode === 'table' ? 'primary' : 'default'}
                      variant={breakdownViewMode === 'table' ? 'filled' : 'outlined'}
                      sx={{ cursor: 'pointer' }}
                    />
                    <Chip
                      label="Compact"
                      size="small"
                      onClick={() => setBreakdownViewMode('compact')}
                      color={breakdownViewMode === 'compact' ? 'primary' : 'default'}
                      variant={breakdownViewMode === 'compact' ? 'filled' : 'outlined'}
                      sx={{ cursor: 'pointer' }}
                    />
                  </Box>
                  
                  {/* Utility Type Filter */}
                  {summary?.by_utility_type?.length > 3 && (
                    <FormControl size="small" sx={{ minWidth: 200, maxWidth: 300 }}>
                      <InputLabel id="utility-type-filter-label">
                        <Box display="flex" alignItems="center" gap={0.5}>
                          <FilterListIcon sx={{ fontSize: 16 }} />
                          Show Types
                        </Box>
                      </InputLabel>
                      <Select
                        labelId="utility-type-filter-label"
                        multiple
                        value={selectedUtilityTypes}
                        onChange={handleUtilityTypeFilterChange}
                        input={<OutlinedInput label="Show Types ___" />}
                        renderValue={(selected) => 
                          `${selected.length} of ${summary?.by_utility_type?.length} types`
                        }
                        MenuProps={{
                          PaperProps: { style: { maxHeight: 300 } },
                        }}
                      >
                        <MenuItem 
                          onClick={(e) => {
                            e.preventDefault();
                            setSelectedUtilityTypes(summary?.by_utility_type?.map(t => t.utility_type_id) || []);
                          }}
                        >
                          <ListItemText primary="Select All" primaryTypographyProps={{ fontWeight: 'bold' }} />
                        </MenuItem>
                        <MenuItem 
                          onClick={(e) => {
                            e.preventDefault();
                            setSelectedUtilityTypes([]);
                          }}
                        >
                          <ListItemText primary="Clear All" primaryTypographyProps={{ fontWeight: 'bold' }} />
                        </MenuItem>
                        {summary?.by_utility_type?.map((type, index) => (
                          <MenuItem key={type.utility_type_id} value={type.utility_type_id}>
                            <Checkbox checked={selectedUtilityTypes.includes(type.utility_type_id)} />
                            <Box 
                              sx={{ 
                                width: 12, 
                                height: 12, 
                                borderRadius: '50%', 
                                bgcolor: COLORS[index % COLORS.length],
                                mr: 1,
                              }} 
                            />
                            <ListItemText primary={type.utility_type_name} />
                          </MenuItem>
                        ))}
                      </Select>
                    </FormControl>
                  )}
                </Box>
              </Box>

              {breakdownViewMode === 'table' ? (
                /* Table View - with horizontal scroll and sticky columns */
                <TableContainer 
                  component={Paper} 
                  variant="outlined"
                  sx={{ 
                    maxWidth: '100%',
                    overflowX: 'auto',
                    '& .sticky-left': {
                      position: 'sticky',
                      left: 0,
                      bgcolor: 'background.paper',
                      zIndex: 2,
                      borderRight: '2px solid',
                      borderColor: 'divider',
                    },
                    '& .sticky-right': {
                      position: 'sticky',
                      right: 0,
                      bgcolor: 'background.paper',
                      zIndex: 2,
                      borderLeft: '2px solid',
                      borderColor: 'divider',
                    },
                  }}
                >
                  <Table size="small" sx={{ minWidth: getFilteredUtilityTypes().length > 4 ? 800 : 'auto' }}>
                    <TableHead>
                      <TableRow sx={{ bgcolor: 'grey.100' }}>
                        <TableCell className="sticky-left" sx={{ bgcolor: 'grey.100' }}>
                          <strong>Month</strong>
                        </TableCell>
                        {getFilteredUtilityTypes().map((type, index) => {
                          const originalIndex = summary?.by_utility_type?.findIndex(t => t.utility_type_id === type.utility_type_id);
                          return (
                            <TableCell key={type.utility_type_id} align="right" sx={{ whiteSpace: 'nowrap' }}>
                              <Tooltip title={type.utility_type_name}>
                                <Chip 
                                  size="small" 
                                  label={type.utility_type_name.length > 10 
                                    ? type.utility_type_name.substring(0, 8) + '…' 
                                    : type.utility_type_name}
                                  sx={{ 
                                    bgcolor: COLORS[originalIndex % COLORS.length], 
                                    color: 'white',
                                    maxWidth: 100,
                                  }}
                                />
                              </Tooltip>
                            </TableCell>
                          );
                        })}
                        <TableCell className="sticky-right" align="right" sx={{ bgcolor: 'grey.100' }}>
                          <strong>Total</strong>
                        </TableCell>
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
                          const rowBgColor = isHighest ? 'error.lighter' : isLowest ? 'success.lighter' : 'inherit';
                          return (
                            <TableRow 
                              key={period}
                              sx={{ 
                                bgcolor: rowBgColor,
                                '&:hover': { bgcolor: 'action.hover' }
                              }}
                            >
                              <TableCell className="sticky-left" sx={{ bgcolor: rowBgColor }}>
                                <Box display="flex" alignItems="center" gap={0.5} flexWrap="wrap">
                                  {formatPeriod(period)}
                                  {isHighest && <Chip size="small" label="High" color="error" sx={{ height: 20, fontSize: '0.7rem' }} />}
                                  {isLowest && <Chip size="small" label="Low" color="success" sx={{ height: 20, fontSize: '0.7rem' }} />}
                                </Box>
                              </TableCell>
                              {getFilteredUtilityTypes().map((type) => {
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
                                    } : { whiteSpace: 'nowrap' }}
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
                              <TableCell className="sticky-right" align="right" sx={{ bgcolor: rowBgColor }}>
                                <strong>${monthTotal.toFixed(2)}</strong>
                              </TableCell>
                            </TableRow>
                          );
                        })}
                      {Object.keys(costByPeriod).length === 0 && (
                        <TableRow>
                          <TableCell colSpan={(getFilteredUtilityTypes().length || 0) + 2} align="center">
                            No data available for this period
                          </TableCell>
                        </TableRow>
                      )}
                    </TableBody>
                  </Table>
                </TableContainer>
              ) : (
                /* Compact View - expandable rows showing only total, with breakdown on expand */
                <Box>
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
                      const isExpanded = expandedRows[period];
                      
                      return (
                        <Paper 
                          key={period}
                          variant="outlined"
                          sx={{ 
                            mb: 1,
                            overflow: 'hidden',
                            bgcolor: isHighest ? 'error.lighter' : isLowest ? 'success.lighter' : 'background.paper',
                          }}
                        >
                          {/* Summary Row */}
                          <Box 
                            display="flex" 
                            alignItems="center" 
                            justifyContent="space-between"
                            sx={{ 
                              p: 1.5,
                              cursor: 'pointer',
                              '&:hover': { bgcolor: 'action.hover' },
                            }}
                            onClick={() => toggleRowExpansion(period)}
                          >
                            <Box display="flex" alignItems="center" gap={1}>
                              <IconButton size="small" sx={{ p: 0.5 }}>
                                {isExpanded ? <ExpandLessIcon /> : <ExpandMoreIcon />}
                              </IconButton>
                              <Typography fontWeight="medium">
                                {formatPeriod(period)}
                              </Typography>
                              {isHighest && <Chip size="small" label="Highest" color="error" />}
                              {isLowest && <Chip size="small" label="Lowest" color="success" />}
                            </Box>
                            <Typography variant="h6" fontWeight="bold">
                              ${monthTotal.toFixed(2)}
                            </Typography>
                          </Box>
                          
                          {/* Expanded Breakdown */}
                          <Collapse in={isExpanded}>
                            <Box sx={{ px: 2, pb: 2, pt: 1, borderTop: '1px solid', borderColor: 'divider' }}>
                              <Grid container spacing={1}>
                                {getFilteredUtilityTypes().map((type, index) => {
                                  const originalIndex = summary?.by_utility_type?.findIndex(t => t.utility_type_id === type.utility_type_id);
                                  const value = costByPeriod[period][type.utility_type_name];
                                  return (
                                    <Grid item xs={6} sm={4} md={3} key={type.utility_type_id}>
                                      <Box 
                                        sx={{ 
                                          display: 'flex', 
                                          alignItems: 'center',
                                          justifyContent: 'space-between',
                                          p: 1,
                                          borderRadius: 1,
                                          bgcolor: 'grey.50',
                                          cursor: !value ? 'pointer' : 'default',
                                          '&:hover': !value ? { bgcolor: 'primary.light' } : {},
                                        }}
                                        onClick={() => !value && handleQuickAdd(period, type)}
                                      >
                                        <Box display="flex" alignItems="center" gap={0.5}>
                                          <Box 
                                            sx={{ 
                                              width: 8, 
                                              height: 8, 
                                              borderRadius: '50%', 
                                              bgcolor: COLORS[originalIndex % COLORS.length],
                                            }} 
                                          />
                                          <Typography variant="body2" noWrap sx={{ maxWidth: 80 }}>
                                            {type.utility_type_name}
                                          </Typography>
                                        </Box>
                                        <Typography variant="body2" fontWeight="medium">
                                          {value ? `$${value.toFixed(2)}` : (
                                            <Box component="span" sx={{ color: 'text.disabled', display: 'flex', alignItems: 'center' }}>
                                              <AddIcon sx={{ fontSize: 14 }} />
                                            </Box>
                                          )}
                                        </Typography>
                                      </Box>
                                    </Grid>
                                  );
                                })}
                              </Grid>
                            </Box>
                          </Collapse>
                        </Paper>
                      );
                    })}
                  {Object.keys(costByPeriod).length === 0 && (
                    <Paper variant="outlined" sx={{ p: 3, textAlign: 'center' }}>
                      <Typography color="text.secondary">No data available for this period</Typography>
                    </Paper>
                  )}
                </Box>
              )}
              
              {/* Footer info */}
              {summary?.by_utility_type?.length > 3 && selectedUtilityTypes.length < summary.by_utility_type.length && (
                <Typography variant="caption" color="text.secondary" sx={{ mt: 1, display: 'block' }}>
                  Showing {selectedUtilityTypes.length} of {summary.by_utility_type.length} utility types. 
                  Use the filter to show more.
                </Typography>
              )}
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

