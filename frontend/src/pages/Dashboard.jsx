import { useEffect, useState } from 'react';
import {
  Typography,
  Grid,
  Card,
  CardContent,
  Box,
  CircularProgress,
  Alert,
  List,
  ListItem,
  ListItemText,
  ListItemIcon,
  Chip,
  Button,
} from '@mui/material';
import WarningAmberIcon from '@mui/icons-material/WarningAmber';
import NotificationsActiveIcon from '@mui/icons-material/NotificationsActive';
import api from '../services/api';
import { format, parse } from 'date-fns';
import { useNavigate } from 'react-router-dom';

// Safe date formatter to handle timezone issues
const formatDate = (dateStr) => {
  if (!dateStr) return '-';
  try {
    const date = dateStr.includes('T') 
      ? new Date(dateStr) 
      : new Date(dateStr + 'T12:00:00');
    return format(date, 'MMM dd, yyyy');
  } catch {
    return dateStr;
  }
};

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

export default function Dashboard() {
  const [summary, setSummary] = useState(null);
  const [recentBills, setRecentBills] = useState([]);
  const [notifications, setNotifications] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const navigate = useNavigate();

  useEffect(() => {
    fetchDashboardData();
  }, []);

  const fetchDashboardData = async () => {
    try {
      setLoading(true);
      
      // Get current month's data
      const now = new Date();
      const currentMonthStart = new Date(now.getFullYear(), now.getMonth(), 1);
      const currentMonthEnd = new Date(now.getFullYear(), now.getMonth() + 1, 0);
      
      // 3 years ago
      const threeYearsAgo = new Date(now.getFullYear() - 3, now.getMonth(), 1);

      const [currentMonthRes, allTimeRes, trendsRes, billsRes, notificationsRes] = await Promise.all([
        // Current month summary
        api.get('/analytics/cost-summary', {
          params: {
            start_date: currentMonthStart.toISOString().split('T')[0],
            end_date: currentMonthEnd.toISOString().split('T')[0],
          },
        }),
        // All-time summary for true average monthly calculation
        api.get('/analytics/cost-summary'),
        // Monthly trends for past 3 years to find high/low months
        api.get('/analytics/cost-trends', {
          params: {
            start_date: threeYearsAgo.toISOString().split('T')[0],
            end_date: currentMonthEnd.toISOString().split('T')[0],
            group_by: 'month',
          },
        }),
        api.get('/utilities/bills', { params: { limit: 5 } }),
        // Get unread notifications
        api.get('/notifications/notifications', { params: { limit: 5, is_read: 'false' } }),
      ]);

      // Set unread notifications
      setNotifications(notificationsRes.data.notifications || []);

      // Calculate true average monthly from all-time data
      const allTimeData = allTimeRes.data;
      let trueAverageMonthly = 0;
      if (allTimeData.period?.start_date && allTimeData.period?.end_date) {
        const start = new Date(allTimeData.period.start_date);
        const end = new Date(allTimeData.period.end_date);
        const monthsDiff = (end.getFullYear() - start.getFullYear()) * 12 + (end.getMonth() - start.getMonth()) + 1;
        trueAverageMonthly = monthsDiff > 0 ? allTimeData.total_cost / monthsDiff : allTimeData.total_cost;
      }

      // Aggregate monthly totals (sum all utility types per month)
      const monthlyTotals = {};
      trendsRes.data.data.forEach(item => {
        if (!monthlyTotals[item.period]) {
          monthlyTotals[item.period] = 0;
        }
        monthlyTotals[item.period] += item.total_cost;
      });

      // Find highest and lowest months
      const months = Object.entries(monthlyTotals).map(([period, total]) => ({ period, total }));
      let highestMonth = null;
      let lowestMonth = null;
      
      if (months.length > 0) {
        highestMonth = months.reduce((max, m) => m.total > max.total ? m : max, months[0]);
        lowestMonth = months.reduce((min, m) => m.total < min.total ? m : min, months[0]);
      }

      setSummary({
        ...currentMonthRes.data,
        average_monthly: trueAverageMonthly,
        highest_month: highestMonth,
        lowest_month: lowestMonth,
      });
      setRecentBills(billsRes.data.bills);
    } catch (err) {
      setError(err.response?.data?.error?.message || 'Failed to load dashboard data');
    } finally {
      setLoading(false);
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

  return (
    <Box>
      <Typography variant="h4" gutterBottom>
        Dashboard
      </Typography>

      {/* Notifications Section */}
      {notifications.length > 0 && (
        <Card 
          sx={{ 
            mb: 3, 
            bgcolor: 'warning.light',
            border: '2px solid',
            borderColor: 'warning.main',
          }}
        >
          <CardContent>
            <Box display="flex" alignItems="center" justifyContent="space-between" mb={1}>
              <Box display="flex" alignItems="center" gap={1}>
                <NotificationsActiveIcon color="warning" />
                <Typography variant="h6" color="warning.dark">
                  Notifications ({notifications.length})
                </Typography>
              </Box>
              <Button 
                size="small" 
                variant="outlined" 
                color="warning"
                onClick={() => navigate('/alerts')}
              >
                View All
              </Button>
            </Box>
            <List dense sx={{ py: 0 }}>
              {notifications.map((notification) => (
                <ListItem 
                  key={notification.id}
                  sx={{ 
                    bgcolor: 'white', 
                    borderRadius: 1, 
                    mb: 0.5,
                    border: '1px solid',
                    borderColor: notification.notification_type === 'warning' ? 'warning.main' : 'grey.300',
                  }}
                >
                  <ListItemIcon sx={{ minWidth: 36 }}>
                    <WarningAmberIcon color="warning" />
                  </ListItemIcon>
                  <ListItemText
                    primary={
                      <Typography fontWeight="bold" color="warning.dark">
                        {notification.title}
                      </Typography>
                    }
                    secondary={notification.message}
                  />
                  <Chip 
                    label="New" 
                    color="warning" 
                    size="small" 
                  />
                </ListItem>
              ))}
            </List>
          </CardContent>
        </Card>
      )}

      <Grid container spacing={3} sx={{ mt: 2 }}>
        {/* Top row: This Month + vs Average */}
        <Grid item xs={12} sm={6}>
          <Card>
            <CardContent>
              <Typography color="textSecondary" gutterBottom>
                This Month
              </Typography>
              <Typography variant="h4">
                ${summary?.total_cost?.toFixed(2) || '0.00'}
              </Typography>
              <Typography variant="body2" color="textSecondary">
                {summary?.bill_count || 0} bill{summary?.bill_count !== 1 ? 's' : ''}
              </Typography>
            </CardContent>
          </Card>
        </Grid>
        <Grid item xs={12} sm={6}>
          <Card sx={{ 
            bgcolor: summary?.total_cost > summary?.average_monthly ? 'error.main' : 'success.main',
            color: 'white',
            height: '100%',
          }}>
            <CardContent>
              <Typography gutterBottom sx={{ opacity: 0.9 }}>
                vs Average
              </Typography>
              <Typography variant="h4">
                {summary?.average_monthly > 0 
                  ? (summary?.total_cost > summary?.average_monthly ? '+' : '') + 
                    ((summary?.total_cost - summary?.average_monthly) / summary?.average_monthly * 100).toFixed(0) + '%'
                  : 'N/A'}
              </Typography>
              <Typography variant="body2" sx={{ opacity: 0.9 }}>
                {summary?.total_cost > summary?.average_monthly ? 'Above average' : 'Below average'}
              </Typography>
            </CardContent>
          </Card>
        </Grid>

        {/* Bottom row: Monthly Average, Highest, Lowest */}
        <Grid item xs={12} sm={4}>
          <Card>
            <CardContent>
              <Typography color="textSecondary" gutterBottom>
                Monthly Average
              </Typography>
              <Typography variant="h4">
                ${summary?.average_monthly?.toFixed(2) || '0.00'}
              </Typography>
              <Typography variant="body2" color="textSecondary">
                Based on all bills
              </Typography>
            </CardContent>
          </Card>
        </Grid>
        <Grid item xs={12} sm={4}>
          <Card>
            <CardContent>
              <Typography color="textSecondary" gutterBottom>
                Highest Month
              </Typography>
              {summary?.highest_month ? (
                <>
                  <Typography variant="h4" color="error.main">
                    ${summary.highest_month.total.toFixed(2)}
                  </Typography>
                  <Typography variant="body2" color="textSecondary">
                    {formatPeriod(summary.highest_month.period)}
                  </Typography>
                </>
              ) : (
                <Typography variant="h4">N/A</Typography>
              )}
            </CardContent>
          </Card>
        </Grid>
        <Grid item xs={12} sm={4}>
          <Card>
            <CardContent>
              <Typography color="textSecondary" gutterBottom>
                Lowest Month
              </Typography>
              {summary?.lowest_month ? (
                <>
                  <Typography variant="h4" color="success.main">
                    ${summary.lowest_month.total.toFixed(2)}
                  </Typography>
                  <Typography variant="body2" color="textSecondary">
                    {formatPeriod(summary.lowest_month.period)}
                  </Typography>
                </>
              ) : (
                <Typography variant="h4">N/A</Typography>
              )}
            </CardContent>
          </Card>
        </Grid>
        <Grid item xs={12}>
          <Card>
            <CardContent>
              <Typography variant="h6" gutterBottom>
                Recent Bills
              </Typography>
              {recentBills.length === 0 ? (
                <Typography color="textSecondary">No bills yet</Typography>
              ) : (
                <Box>
                  {recentBills.map((bill) => (
                    <Box
                      key={bill.id}
                      sx={{
                        display: 'flex',
                        justifyContent: 'space-between',
                        py: 1,
                        borderBottom: '1px solid #eee',
                      }}
                    >
                      <Box>
                        <Typography variant="body1">{bill.utility_type_name}</Typography>
                        <Typography variant="body2" color="textSecondary">
                          {formatDate(bill.bill_date)}
                        </Typography>
                      </Box>
                      <Typography variant="h6">${parseFloat(bill.amount).toFixed(2)}</Typography>
                    </Box>
                  ))}
                </Box>
              )}
            </CardContent>
          </Card>
        </Grid>
      </Grid>
    </Box>
  );
}

