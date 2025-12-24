import { useEffect, useState } from 'react';
import {
  Typography,
  Button,
  Box,
  Card,
  CardContent,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  TextField,
  MenuItem,
  Switch,
  FormControlLabel,
  Alert,
  CircularProgress,
  IconButton,
  List,
  ListItem,
  ListItemText,
  Chip,
  Grid,
  Divider,
} from '@mui/material';
import AddIcon from '@mui/icons-material/Add';
import DeleteIcon from '@mui/icons-material/Delete';
import api from '../services/api';

export default function Alerts() {
  const [alerts, setAlerts] = useState([]);
  const [notifications, setNotifications] = useState([]);
  const [utilityTypes, setUtilityTypes] = useState([]);
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [formData, setFormData] = useState({
    alert_type: '',
    utility_type_id: '',
    configuration: {},
  });

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    try {
      setLoading(true);
      const [alertsRes, notificationsRes, typesRes] = await Promise.all([
        api.get('/notifications/alerts'),
        api.get('/notifications/notifications', { params: { limit: 20 } }),
        api.get('/utilities/types'),
      ]);
      setAlerts(alertsRes.data);
      setNotifications(notificationsRes.data.notifications);
      setUtilityTypes(typesRes.data);
      
      // Check for promotion end dates
      try {
        await api.post('/notifications/check-promotions');
        // Refresh notifications after checking promotions
        const updatedNotifications = await api.get('/notifications/notifications', { params: { limit: 20 } });
        setNotifications(updatedNotifications.data.notifications);
      } catch (promoErr) {
        console.log('Promotion check:', promoErr.message);
      }
    } catch (err) {
      setError(err.response?.data?.error?.message || 'Failed to load data');
    } finally {
      setLoading(false);
    }
  };

  // Helper to format alert details for display
  const getAlertDetails = (alert) => {
    const config = typeof alert.configuration === 'string' 
      ? JSON.parse(alert.configuration) 
      : alert.configuration;
    
    if (alert.alert_type === 'promotion_end') {
      const endDate = config.end_date ? new Date(config.end_date).toLocaleDateString() : 'N/A';
      return `${config.promotion_name || 'Promotion'} - ${config.utility_name || 'Service'} (Ends: ${endDate})`;
    }
    
    if (alert.utility_type_id) {
      return utilityTypes.find((t) => t.id === alert.utility_type_id)?.name || 'Unknown';
    }
    
    return 'All Utilities';
  };

  const handleOpen = () => {
    setFormData({
      alert_type: '',
      utility_type_id: '',
      configuration: {},
    });
    setOpen(true);
  };

  const handleClose = () => {
    setOpen(false);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      setError('');
      
      // Prepare data - don't send utility_type_id if empty or for promotion alerts
      const submitData = {
        alert_type: formData.alert_type,
        configuration: formData.configuration,
      };
      
      // Only include utility_type_id if it has a value and not a promotion alert
      if (formData.utility_type_id && formData.alert_type !== 'promotion_end') {
        submitData.utility_type_id = formData.utility_type_id;
      }
      
      await api.post('/notifications/alerts', submitData);
      handleClose();
      fetchData();
    } catch (err) {
      setError(err.response?.data?.error?.message || 'Failed to create alert');
    }
  };

  const handleDelete = async (id) => {
    if (window.confirm('Are you sure you want to delete this alert?')) {
      try {
        await api.delete(`/notifications/alerts/${id}`);
        fetchData();
      } catch (err) {
        setError(err.response?.data?.error?.message || 'Failed to delete alert');
      }
    }
  };

  const handleToggleActive = async (alert) => {
    try {
      await api.put(`/notifications/alerts/${alert.id}`, {
        is_active: !alert.is_active,
      });
      fetchData();
    } catch (err) {
      setError(err.response?.data?.error?.message || 'Failed to update alert');
    }
  };

  const handleMarkRead = async (id) => {
    try {
      await api.put(`/notifications/notifications/${id}/read`);
      fetchData();
    } catch (err) {
      console.error('Failed to mark notification as read:', err);
    }
  };

  if (loading) {
    return (
      <Box display="flex" justifyContent="center" p={4}>
        <CircularProgress />
      </Box>
    );
  }

  const getConfigurationFields = () => {
    if (formData.alert_type === 'bill_reminder') {
      return (
        <>
          <TextField
            fullWidth
            label="Days Before Due Date"
            type="number"
            value={formData.configuration.days_before || ''}
            onChange={(e) =>
              setFormData({
                ...formData,
                configuration: { ...formData.configuration, days_before: e.target.value },
              })
            }
            margin="normal"
            required
          />
        </>
      );
    } else if (formData.alert_type === 'usage_threshold' || formData.alert_type === 'cost_threshold') {
      return (
        <>
          <TextField
            fullWidth
            label="Threshold Value"
            type="number"
            step="0.01"
            value={formData.configuration.threshold || ''}
            onChange={(e) =>
              setFormData({
                ...formData,
                configuration: { ...formData.configuration, threshold: e.target.value },
              })
            }
            margin="normal"
            required
          />
          <TextField
            fullWidth
            select
            label="Comparison"
            value={formData.configuration.comparison || 'greater_than'}
            onChange={(e) =>
              setFormData({
                ...formData,
                configuration: { ...formData.configuration, comparison: e.target.value },
              })
            }
            margin="normal"
          >
            <MenuItem value="greater_than">Greater Than</MenuItem>
            <MenuItem value="less_than">Less Than</MenuItem>
            <MenuItem value="equals">Equals</MenuItem>
          </TextField>
        </>
      );
    } else if (formData.alert_type === 'promotion_end') {
      return (
        <>
          <TextField
            fullWidth
            label="Promotion Name"
            value={formData.configuration.promotion_name || ''}
            onChange={(e) =>
              setFormData({
                ...formData,
                configuration: { ...formData.configuration, promotion_name: e.target.value },
              })
            }
            margin="normal"
            required
            placeholder="e.g., 50% off first 6 months"
          />
          <TextField
            fullWidth
            label="Service/Utility Name"
            value={formData.configuration.utility_name || ''}
            onChange={(e) =>
              setFormData({
                ...formData,
                configuration: { ...formData.configuration, utility_name: e.target.value },
              })
            }
            margin="normal"
            required
            placeholder="e.g., Internet, Gas, Electric"
          />
          <TextField
            fullWidth
            label="Promotion End Date"
            type="date"
            value={formData.configuration.end_date || ''}
            onChange={(e) =>
              setFormData({
                ...formData,
                configuration: { ...formData.configuration, end_date: e.target.value },
              })
            }
            margin="normal"
            required
            InputLabelProps={{ shrink: true }}
          />
          <TextField
            fullWidth
            label="Days Before to Notify"
            type="number"
            value={formData.configuration.days_before || '7'}
            onChange={(e) =>
              setFormData({
                ...formData,
                configuration: { ...formData.configuration, days_before: e.target.value },
              })
            }
            margin="normal"
            helperText="How many days before the end date to start receiving notifications"
          />
        </>
      );
    }
    return null;
  };

  return (
    <Box>
      <Box display="flex" justifyContent="space-between" alignItems="center" mb={3}>
        <Typography variant="h4">Alerts & Notifications</Typography>
        <Button variant="contained" startIcon={<AddIcon />} onClick={handleOpen}>
          Create Alert
        </Button>
      </Box>

      {error && (
        <Alert severity="error" sx={{ mb: 2 }} onClose={() => setError('')}>
          {error}
        </Alert>
      )}

      <Grid container spacing={3}>
        <Grid item xs={12} md={6}>
          <Card>
            <CardContent>
              <Typography variant="h6" gutterBottom>
                Active Alerts
              </Typography>
              {alerts.length === 0 ? (
                <Typography color="textSecondary">No alerts configured</Typography>
              ) : (
                <List>
                  {alerts.map((alert) => (
                    <ListItem
                      key={alert.id}
                      secondaryAction={
                        <Box>
                          <FormControlLabel
                            control={
                              <Switch
                                checked={alert.is_active}
                                onChange={() => handleToggleActive(alert)}
                              />
                            }
                            label="Active"
                          />
                          <IconButton edge="end" onClick={() => handleDelete(alert.id)}>
                            <DeleteIcon />
                          </IconButton>
                        </Box>
                      }
                    >
                      <ListItemText
                        primary={
                          <Box display="flex" alignItems="center" gap={1}>
                            {alert.alert_type.replace(/_/g, ' ').toUpperCase()}
                            {alert.alert_type === 'promotion_end' && (
                              <Chip size="small" label="Promo" color="warning" />
                            )}
                          </Box>
                        }
                        secondary={getAlertDetails(alert)}
                      />
                    </ListItem>
                  ))}
                </List>
              )}
            </CardContent>
          </Card>
        </Grid>

        <Grid item xs={12} md={6}>
          <Card>
            <CardContent>
              <Typography variant="h6" gutterBottom>
                Recent Notifications
              </Typography>
              {notifications.length === 0 ? (
                <Typography color="textSecondary">No notifications</Typography>
              ) : (
                <List>
                  {notifications.map((notification) => {
                    const isWarning = notification.notification_type === 'warning';
                    const isAlert = notification.notification_type === 'alert';
                    const isUrgent = isWarning || isAlert;
                    
                    return (
                      <ListItem
                        key={notification.id}
                        onClick={() => !notification.is_read && handleMarkRead(notification.id)}
                        sx={{
                          cursor: notification.is_read ? 'default' : 'pointer',
                          backgroundColor: notification.is_read 
                            ? 'transparent' 
                            : isUrgent 
                              ? 'warning.lighter'
                              : 'action.hover',
                          borderLeft: isUrgent && !notification.is_read ? '4px solid' : 'none',
                          borderLeftColor: isWarning ? 'warning.main' : isAlert ? 'error.main' : 'transparent',
                          mb: 0.5,
                          borderRadius: 1,
                        }}
                      >
                        <ListItemText
                          primary={
                            <Box display="flex" alignItems="center" gap={1}>
                              <Typography 
                                component="span" 
                                fontWeight={notification.is_read ? 'normal' : 'bold'}
                                color={isUrgent && !notification.is_read ? 'warning.dark' : 'inherit'}
                              >
                                {notification.title}
                              </Typography>
                            </Box>
                          }
                          secondary={
                            <Typography 
                              variant="body2" 
                              color={isUrgent && !notification.is_read ? 'text.primary' : 'text.secondary'}
                            >
                              {notification.message}
                            </Typography>
                          }
                        />
                        {!notification.is_read && (
                          <Chip 
                            label={isUrgent ? "Urgent" : "New"} 
                            color={isUrgent ? "warning" : "primary"} 
                            size="small" 
                          />
                        )}
                      </ListItem>
                    );
                  })}
                </List>
              )}
            </CardContent>
          </Card>
        </Grid>
      </Grid>

      <Dialog open={open} onClose={handleClose} maxWidth="sm" fullWidth>
        <form onSubmit={handleSubmit}>
          <DialogTitle>Create Alert</DialogTitle>
          <DialogContent>
            <TextField
              select
              fullWidth
              label="Alert Type"
              value={formData.alert_type}
              onChange={(e) => setFormData({ ...formData, alert_type: e.target.value, configuration: {} })}
              margin="normal"
              required
            >
              <MenuItem value="bill_reminder">Bill Reminder</MenuItem>
              <MenuItem value="usage_threshold">Usage Threshold</MenuItem>
              <MenuItem value="cost_threshold">Cost Threshold</MenuItem>
              <MenuItem value="promotion_end">Promotion End Date</MenuItem>
            </TextField>
            {formData.alert_type !== 'promotion_end' && (
              <TextField
                select
                fullWidth
                label="Utility Type (Optional)"
                value={formData.utility_type_id}
                onChange={(e) => setFormData({ ...formData, utility_type_id: e.target.value })}
                margin="normal"
              >
                <MenuItem value="">All Utilities</MenuItem>
                {utilityTypes.map((type) => (
                  <MenuItem key={type.id} value={type.id}>
                    {type.name}
                  </MenuItem>
                ))}
              </TextField>
            )}
            {getConfigurationFields()}
          </DialogContent>
          <DialogActions>
            <Button onClick={handleClose}>Cancel</Button>
            <Button type="submit" variant="contained">
              Create
            </Button>
          </DialogActions>
        </form>
      </Dialog>
    </Box>
  );
}

