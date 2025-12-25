import { useEffect, useState } from 'react';
import {
  Typography,
  Button,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Paper,
  Box,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  TextField,
  MenuItem,
  IconButton,
  Alert,
  CircularProgress,
  Chip,
  Divider,
  List,
  ListItem,
  ListItemText,
  ListItemSecondaryAction,
  Tooltip,
  InputAdornment,
  FormControlLabel,
  Switch,
  Collapse,
} from '@mui/material';
import AddIcon from '@mui/icons-material/Add';
import EditIcon from '@mui/icons-material/Edit';
import DeleteIcon from '@mui/icons-material/Delete';
import SettingsIcon from '@mui/icons-material/Settings';
import RepeatIcon from '@mui/icons-material/Repeat';
import AutorenewIcon from '@mui/icons-material/Autorenew';
import FilterListIcon from '@mui/icons-material/FilterList';
import ClearIcon from '@mui/icons-material/Clear';
import CheckCircleIcon from '@mui/icons-material/CheckCircle';
import ScheduleIcon from '@mui/icons-material/Schedule';
import CreditScoreIcon from '@mui/icons-material/CreditScore';

// Payment status configuration
const PAYMENT_STATUSES = {
  need_payment: { label: 'Need Payment', color: 'warning', icon: ScheduleIcon },
  paid: { label: 'Paid', color: 'success', icon: CheckCircleIcon },
  auto_pay: { label: 'Auto Pay', color: 'info', icon: CreditScoreIcon },
};
import api from '../services/api';
import { format } from 'date-fns';

// Get today's date as YYYY-MM-DD string in local timezone
const getLocalDateString = () => {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, '0');
  const day = String(now.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
};

// Safe date formatter to handle timezone issues
const formatDate = (dateStr) => {
  if (!dateStr) return '-';
  try {
    // If it's already a plain date string (YYYY-MM-DD), parse it correctly
    if (/^\d{4}-\d{2}-\d{2}$/.test(dateStr)) {
      const [year, month, day] = dateStr.split('-');
      return format(new Date(year, month - 1, day), 'MMM dd, yyyy');
    }
    // Handle ISO strings by extracting just the date part
    if (dateStr.includes('T')) {
      const datePart = dateStr.split('T')[0];
      const [year, month, day] = datePart.split('-');
      return format(new Date(year, month - 1, day), 'MMM dd, yyyy');
    }
    return dateStr;
  } catch {
    return dateStr;
  }
};

export default function Bills() {
  const [bills, setBills] = useState([]);
  const [utilityTypes, setUtilityTypes] = useState([]);
  const [open, setOpen] = useState(false);
  const [editingBill, setEditingBill] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [formData, setFormData] = useState({
    utility_type_id: '',
    amount: '',
    bill_date: getLocalDateString(),
    due_date: '',
    usage_amount: '',
    payment_status: 'need_payment',
    notes: '',
    is_recurring: false,
    recurring_day: '1',
  });

  // Utility Types Management State
  const [typesDialogOpen, setTypesDialogOpen] = useState(false);
  const [typeFormOpen, setTypeFormOpen] = useState(false);
  const [editingType, setEditingType] = useState(null);
  const [typeFormData, setTypeFormData] = useState({
    name: '',
    description: '',
    unit_of_measurement: '',
  });
  const [typeError, setTypeError] = useState('');

  // Recurring Bills State
  const [recurringDialogOpen, setRecurringDialogOpen] = useState(false);
  const [recurringBills, setRecurringBills] = useState([]);
  const [recurringFormOpen, setRecurringFormOpen] = useState(false);
  const [editingRecurring, setEditingRecurring] = useState(null);
  const [recurringFormData, setRecurringFormData] = useState({
    utility_type_id: '',
    amount: '',
    day_of_month: '1',
    payment_status: 'need_payment',
    notes: '',
  });
  const [recurringError, setRecurringError] = useState('');

  // Filter State
  const [filterUtilityType, setFilterUtilityType] = useState('');

  // Filtered bills based on utility type selection
  const filteredBills = filterUtilityType
    ? bills.filter((bill) => bill.utility_type_id === filterUtilityType)
    : bills;

  useEffect(() => {
    fetchBills();
    fetchUtilityTypes();
    fetchRecurringBills();
    processRecurringBills();
  }, []);

  const fetchBills = async () => {
    try {
      setLoading(true);
      const response = await api.get('/utilities/bills');
      setBills(response.data.bills);
    } catch (err) {
      setError(err.response?.data?.error?.message || 'Failed to load bills');
    } finally {
      setLoading(false);
    }
  };

  const fetchUtilityTypes = async () => {
    try {
      const response = await api.get('/utilities/types');
      setUtilityTypes(response.data);
    } catch (err) {
      console.error('Failed to load utility types:', err);
    }
  };

  const fetchRecurringBills = async () => {
    try {
      const response = await api.get('/utilities/recurring');
      setRecurringBills(response.data);
    } catch (err) {
      console.error('Failed to load recurring bills:', err);
    }
  };

  const processRecurringBills = async () => {
    try {
      const response = await api.post('/utilities/recurring/process');
      if (response.data.processed > 0) {
        // Refresh bills if any were created
        fetchBills();
      }
    } catch (err) {
      console.error('Failed to process recurring bills:', err);
    }
  };

  // Extract date part from a date string (handles both YYYY-MM-DD and ISO formats)
  const extractDatePart = (dateStr) => {
    if (!dateStr) return '';
    // If it's an ISO string, extract just the date part
    if (dateStr.includes('T')) {
      return dateStr.split('T')[0];
    }
    return dateStr;
  };

  const handleOpen = (bill = null) => {
    if (bill) {
      setEditingBill(bill);
      setFormData({
        utility_type_id: bill.utility_type_id,
        amount: bill.amount,
        bill_date: extractDatePart(bill.bill_date),
        due_date: extractDatePart(bill.due_date) || '',
        usage_amount: bill.usage_amount || '',
        payment_status: bill.payment_status || 'need_payment',
        notes: bill.notes || '',
        is_recurring: false,
        recurring_day: '1',
      });
    } else {
      setEditingBill(null);
      setFormData({
        utility_type_id: '',
        amount: '',
        bill_date: getLocalDateString(),
        due_date: '',
        usage_amount: '',
        payment_status: 'need_payment',
        notes: '',
        is_recurring: false,
        recurring_day: new Date().getDate().toString(),
      });
    }
    setOpen(true);
  };

  const handleClose = () => {
    setOpen(false);
    setEditingBill(null);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      setError('');
      
      // Prepare bill data (exclude recurring fields)
      const billData = {
        utility_type_id: formData.utility_type_id,
        amount: formData.amount,
        bill_date: formData.bill_date,
        due_date: formData.due_date || null,
        usage_amount: formData.usage_amount || null,
        payment_status: formData.payment_status,
        notes: formData.notes,
      };
      
      if (editingBill) {
        await api.put(`/utilities/bills/${editingBill.id}`, billData);
      } else {
        await api.post('/utilities/bills', billData);
        
        // If recurring is checked, also create a recurring bill
        if (formData.is_recurring) {
          await api.post('/utilities/recurring', {
            utility_type_id: formData.utility_type_id,
            amount: parseFloat(formData.amount),
            day_of_month: parseInt(formData.recurring_day),
            notes: formData.notes || null,
          });
          fetchRecurringBills();
        }
      }
      handleClose();
      fetchBills();
    } catch (err) {
      setError(err.response?.data?.error?.message || 'Failed to save bill');
    }
  };

  const handleDelete = async (id) => {
    if (window.confirm('Are you sure you want to delete this bill?')) {
      try {
        await api.delete(`/utilities/bills/${id}`);
        fetchBills();
      } catch (err) {
        setError(err.response?.data?.error?.message || 'Failed to delete bill');
      }
    }
  };

  // Utility Types Management Functions
  const handleOpenTypesDialog = () => {
    setTypesDialogOpen(true);
    setTypeError('');
  };

  const handleCloseTypesDialog = () => {
    setTypesDialogOpen(false);
    setTypeFormOpen(false);
    setEditingType(null);
    setTypeError('');
  };

  const handleOpenTypeForm = (type = null) => {
    if (type) {
      setEditingType(type);
      setTypeFormData({
        name: type.name,
        description: type.description || '',
        unit_of_measurement: type.unit_of_measurement || '',
      });
    } else {
      setEditingType(null);
      setTypeFormData({
        name: '',
        description: '',
        unit_of_measurement: '',
      });
    }
    setTypeFormOpen(true);
    setTypeError('');
  };

  const handleCloseTypeForm = () => {
    setTypeFormOpen(false);
    setEditingType(null);
    setTypeFormData({
      name: '',
      description: '',
      unit_of_measurement: '',
    });
    setTypeError('');
  };

  const handleSubmitType = async (e) => {
    e.preventDefault();
    try {
      setTypeError('');
      if (editingType) {
        await api.put(`/utilities/types/${editingType.id}`, typeFormData);
      } else {
        await api.post('/utilities/types', typeFormData);
      }
      handleCloseTypeForm();
      fetchUtilityTypes();
    } catch (err) {
      setTypeError(err.response?.data?.error?.message || 'Failed to save utility type');
    }
  };

  const handleDeleteType = async (type) => {
    if (type.is_system_type) {
      setTypeError('Cannot delete system utility types');
      return;
    }
    if (window.confirm(`Are you sure you want to delete "${type.name}"? This cannot be undone.`)) {
      try {
        await api.delete(`/utilities/types/${type.id}`);
        fetchUtilityTypes();
        setTypeError('');
      } catch (err) {
        setTypeError(err.response?.data?.error?.message || 'Failed to delete utility type');
      }
    }
  };

  // Recurring Bills Handlers
  const handleOpenRecurringDialog = () => {
    setRecurringDialogOpen(true);
    setRecurringError('');
  };

  const handleCloseRecurringDialog = () => {
    setRecurringDialogOpen(false);
    setRecurringFormOpen(false);
    setEditingRecurring(null);
    setRecurringError('');
  };

  const handleOpenRecurringForm = (recurring = null) => {
    if (recurring) {
      setEditingRecurring(recurring);
      setRecurringFormData({
        utility_type_id: recurring.utility_type_id,
        amount: recurring.amount,
        day_of_month: recurring.day_of_month.toString(),
        payment_status: recurring.payment_status || 'need_payment',
        notes: recurring.notes || '',
      });
    } else {
      setEditingRecurring(null);
      setRecurringFormData({
        utility_type_id: '',
        amount: '',
        day_of_month: '1',
        payment_status: 'need_payment',
        notes: '',
      });
    }
    setRecurringFormOpen(true);
    setRecurringError('');
  };

  const handleCloseRecurringForm = () => {
    setRecurringFormOpen(false);
    setEditingRecurring(null);
    setRecurringFormData({
      utility_type_id: '',
      amount: '',
      day_of_month: '1',
      payment_status: 'need_payment',
      notes: '',
    });
    setRecurringError('');
  };

  const handleSubmitRecurring = async (e) => {
    e.preventDefault();
    try {
      setRecurringError('');
      const data = {
        ...recurringFormData,
        amount: parseFloat(recurringFormData.amount),
        day_of_month: parseInt(recurringFormData.day_of_month),
      };
      
      if (editingRecurring) {
        await api.put(`/utilities/recurring/${editingRecurring.id}`, data);
      } else {
        await api.post('/utilities/recurring', data);
      }
      handleCloseRecurringForm();
      fetchRecurringBills();
    } catch (err) {
      setRecurringError(err.response?.data?.error?.message || 'Failed to save recurring bill');
    }
  };

  const handleDeleteRecurring = async (recurring) => {
    if (window.confirm(`Are you sure you want to delete this recurring bill for ${recurring.utility_type_name}?`)) {
      try {
        await api.delete(`/utilities/recurring/${recurring.id}`);
        fetchRecurringBills();
        setRecurringError('');
      } catch (err) {
        setRecurringError(err.response?.data?.error?.message || 'Failed to delete recurring bill');
      }
    }
  };

  const handleToggleRecurring = async (recurring) => {
    try {
      await api.put(`/utilities/recurring/${recurring.id}`, {
        ...recurring,
        is_active: !recurring.is_active,
      });
      fetchRecurringBills();
    } catch (err) {
      setRecurringError(err.response?.data?.error?.message || 'Failed to update recurring bill');
    }
  };

  // Update bill payment status
  const handleStatusChange = async (billId, newStatus) => {
    try {
      await api.put(`/utilities/bills/${billId}/status`, { payment_status: newStatus });
      fetchBills();
    } catch (err) {
      setError(err.response?.data?.error?.message || 'Failed to update bill status');
    }
  };

  // Get next status in cycle: need_payment -> paid -> auto_pay -> need_payment
  const getNextStatus = (currentStatus) => {
    const statuses = ['need_payment', 'paid', 'auto_pay'];
    const currentIndex = statuses.indexOf(currentStatus || 'need_payment');
    return statuses[(currentIndex + 1) % statuses.length];
  };

  if (loading && bills.length === 0) {
    return (
      <Box display="flex" justifyContent="center" p={4}>
        <CircularProgress />
      </Box>
    );
  }

  return (
    <Box>
      <Box display="flex" justifyContent="space-between" alignItems="center" mb={3}>
        <Typography variant="h4">Bills</Typography>
        <Box display="flex" gap={2} alignItems="center">
          {recurringBills.length > 0 && (
            <Chip
              icon={<RepeatIcon />}
              label={`${recurringBills.filter(r => r.is_active).length} Recurring`}
              onClick={handleOpenRecurringDialog}
              color="primary"
              variant="outlined"
              sx={{ cursor: 'pointer' }}
            />
          )}
          <Button
            variant="outlined"
            startIcon={<SettingsIcon />}
            onClick={handleOpenTypesDialog}
          >
            Utility Types
          </Button>
          <Button variant="contained" startIcon={<AddIcon />} onClick={() => handleOpen()}>
            Add Bill
          </Button>
        </Box>
      </Box>

      {/* Filter by Utility Type */}
      <Box display="flex" alignItems="center" gap={2} mb={2}>
        <FilterListIcon color="action" />
        <TextField
          select
          size="small"
          label="Filter by Utility Type"
          value={filterUtilityType}
          onChange={(e) => setFilterUtilityType(e.target.value)}
          sx={{ minWidth: 220 }}
          InputProps={{
            endAdornment: filterUtilityType && (
              <InputAdornment position="end">
                <IconButton
                  size="small"
                  onClick={() => setFilterUtilityType('')}
                  edge="end"
                  sx={{ mr: 1 }}
                >
                  <ClearIcon fontSize="small" />
                </IconButton>
              </InputAdornment>
            ),
          }}
        >
          <MenuItem value="">
            <em>All Utility Types</em>
          </MenuItem>
          {utilityTypes.map((type) => (
            <MenuItem key={type.id} value={type.id}>
              {type.name}
            </MenuItem>
          ))}
        </TextField>
        {filterUtilityType && (
          <Chip
            label={`Showing ${filteredBills.length} of ${bills.length} bills`}
            size="small"
            color="primary"
            variant="outlined"
          />
        )}
      </Box>

      {error && (
        <Alert severity="error" sx={{ mb: 2 }} onClose={() => setError('')}>
          {error}
        </Alert>
      )}

      <TableContainer component={Paper}>
        <Table>
          <TableHead>
            <TableRow>
              <TableCell>Utility Type</TableCell>
              <TableCell>Amount</TableCell>
              <TableCell>Bill Date</TableCell>
              <TableCell>Due Date</TableCell>
              <TableCell>Usage</TableCell>
              <TableCell>Status</TableCell>
              <TableCell>Actions</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {filteredBills.length === 0 ? (
              <TableRow>
                <TableCell colSpan={7} align="center">
                  {filterUtilityType ? 'No bills found for this utility type' : 'No bills found'}
                </TableCell>
              </TableRow>
            ) : (
              filteredBills.map((bill) => {
                const status = bill.payment_status || 'need_payment';
                const statusConfig = PAYMENT_STATUSES[status];
                const StatusIcon = statusConfig.icon;
                return (
                  <TableRow key={bill.id}>
                    <TableCell>
                      <Box display="flex" alignItems="center" gap={1}>
                        {bill.utility_type_name}
                        {bill.notes?.includes('[Auto]') && (
                          <Chip 
                            icon={<RepeatIcon sx={{ fontSize: 14 }} />}
                            label="Recurring" 
                            size="small" 
                            color="primary"
                            variant="outlined"
                            sx={{ height: 20, '& .MuiChip-label': { px: 0.5, fontSize: '0.7rem' } }}
                          />
                        )}
                      </Box>
                    </TableCell>
                    <TableCell>${parseFloat(bill.amount).toFixed(2)}</TableCell>
                    <TableCell>{formatDate(bill.bill_date)}</TableCell>
                    <TableCell>{formatDate(bill.due_date)}</TableCell>
                    <TableCell>{bill.usage_amount || '-'}</TableCell>
                    <TableCell>
                      <Tooltip title="Click to change status">
                        <Chip
                          icon={<StatusIcon sx={{ fontSize: 16 }} />}
                          label={statusConfig.label}
                          color={statusConfig.color}
                          size="small"
                          onClick={() => handleStatusChange(bill.id, getNextStatus(status))}
                          sx={{ 
                            cursor: 'pointer',
                            '&:hover': { opacity: 0.85 },
                          }}
                        />
                      </Tooltip>
                    </TableCell>
                    <TableCell>
                      <IconButton size="small" onClick={() => handleOpen(bill)}>
                        <EditIcon />
                      </IconButton>
                      <IconButton size="small" onClick={() => handleDelete(bill.id)}>
                        <DeleteIcon />
                      </IconButton>
                    </TableCell>
                  </TableRow>
                );
              })
            )}
          </TableBody>
        </Table>
      </TableContainer>

      <Dialog open={open} onClose={handleClose} maxWidth="sm" fullWidth>
        <form onSubmit={handleSubmit}>
          <DialogTitle>{editingBill ? 'Edit Bill' : 'Add Bill'}</DialogTitle>
          <DialogContent>
            <TextField
              select
              fullWidth
              label="Utility Type"
              value={formData.utility_type_id}
              onChange={(e) => setFormData({ ...formData, utility_type_id: e.target.value })}
              margin="normal"
              required
            >
              {utilityTypes.map((type) => (
                <MenuItem key={type.id} value={type.id}>
                  {type.name}
                  {type.is_system_type && (
                    <Chip size="small" label="System" sx={{ ml: 1 }} />
                  )}
                </MenuItem>
              ))}
            </TextField>
            <TextField
              fullWidth
              label="Amount"
              type="number"
              step="0.01"
              value={formData.amount}
              onChange={(e) => setFormData({ ...formData, amount: e.target.value })}
              margin="normal"
              required
              InputProps={{
                startAdornment: <InputAdornment position="start">$</InputAdornment>,
              }}
            />
            <TextField
              fullWidth
              label="Bill Date"
              type="date"
              value={formData.bill_date}
              onChange={(e) => setFormData({ ...formData, bill_date: e.target.value })}
              margin="normal"
              required
              InputLabelProps={{ shrink: true }}
            />
            <TextField
              fullWidth
              label="Due Date"
              type="date"
              value={formData.due_date}
              onChange={(e) => setFormData({ ...formData, due_date: e.target.value })}
              margin="normal"
              InputLabelProps={{ shrink: true }}
            />
            <TextField
              fullWidth
              label="Usage Amount"
              type="number"
              step="0.01"
              value={formData.usage_amount}
              onChange={(e) => setFormData({ ...formData, usage_amount: e.target.value })}
              margin="normal"
            />
            <TextField
              select
              fullWidth
              label="Payment Status"
              value={formData.payment_status}
              onChange={(e) => setFormData({ ...formData, payment_status: e.target.value })}
              margin="normal"
            >
              {Object.entries(PAYMENT_STATUSES).map(([value, config]) => {
                const StatusIcon = config.icon;
                return (
                  <MenuItem key={value} value={value}>
                    <Box display="flex" alignItems="center" gap={1}>
                      <StatusIcon fontSize="small" color={config.color} />
                      {config.label}
                    </Box>
                  </MenuItem>
                );
              })}
            </TextField>
            <TextField
              fullWidth
              label="Notes"
              multiline
              rows={3}
              value={formData.notes}
              onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
              margin="normal"
            />
            
            {/* Recurring option - only show for new bills */}
            {!editingBill && (
              <Box sx={{ mt: 2, p: 2, bgcolor: 'grey.50', borderRadius: 1 }}>
                <FormControlLabel
                  control={
                    <Switch
                      checked={formData.is_recurring}
                      onChange={(e) => setFormData({ ...formData, is_recurring: e.target.checked })}
                      color="primary"
                    />
                  }
                  label={
                    <Box>
                      <Typography variant="body1">Make this a recurring bill</Typography>
                      <Typography variant="caption" color="text.secondary">
                        Automatically add this bill every month
                      </Typography>
                    </Box>
                  }
                />
                <Collapse in={formData.is_recurring}>
                  <TextField
                    select
                    fullWidth
                    label="Repeat on day"
                    value={formData.recurring_day}
                    onChange={(e) => setFormData({ ...formData, recurring_day: e.target.value })}
                    margin="normal"
                    size="small"
                    helperText="Bill will be created on this day each month"
                  >
                    {Array.from({ length: 28 }, (_, i) => i + 1).map((day) => (
                      <MenuItem key={day} value={day.toString()}>
                        {day}{day === 1 ? 'st' : day === 2 ? 'nd' : day === 3 ? 'rd' : 'th'} of each month
                      </MenuItem>
                    ))}
                  </TextField>
                </Collapse>
              </Box>
            )}
          </DialogContent>
          <DialogActions>
            <Button onClick={handleClose}>Cancel</Button>
            <Button type="submit" variant="contained">
              {editingBill ? 'Update' : 'Add'}
            </Button>
          </DialogActions>
        </form>
      </Dialog>

      {/* Utility Types Management Dialog */}
      <Dialog open={typesDialogOpen} onClose={handleCloseTypesDialog} maxWidth="sm" fullWidth>
        <DialogTitle>
          <Box display="flex" justifyContent="space-between" alignItems="center">
            <Typography variant="h6">Manage Utility Types</Typography>
            {!typeFormOpen && (
              <Button
                variant="contained"
                size="small"
                startIcon={<AddIcon />}
                onClick={() => handleOpenTypeForm()}
              >
                Add Type
              </Button>
            )}
          </Box>
        </DialogTitle>
        <DialogContent>
          {typeError && (
            <Alert severity="error" sx={{ mb: 2 }} onClose={() => setTypeError('')}>
              {typeError}
            </Alert>
          )}

          {typeFormOpen ? (
            <form onSubmit={handleSubmitType}>
              <Typography variant="subtitle1" sx={{ mb: 2, fontWeight: 500 }}>
                {editingType ? 'Edit Utility Type' : 'New Utility Type'}
              </Typography>
              <TextField
                fullWidth
                label="Name"
                value={typeFormData.name}
                onChange={(e) => setTypeFormData({ ...typeFormData, name: e.target.value })}
                margin="normal"
                required
                placeholder="e.g., Internet, Trash, Sewer"
              />
              <TextField
                fullWidth
                label="Description"
                value={typeFormData.description}
                onChange={(e) => setTypeFormData({ ...typeFormData, description: e.target.value })}
                margin="normal"
                placeholder="Optional description"
              />
              <TextField
                fullWidth
                label="Unit of Measurement"
                value={typeFormData.unit_of_measurement}
                onChange={(e) => setTypeFormData({ ...typeFormData, unit_of_measurement: e.target.value })}
                margin="normal"
                placeholder="e.g., GB, tons, units"
                helperText="Optional - used for tracking usage"
              />
              <Box display="flex" gap={1} justifyContent="flex-end" mt={2}>
                <Button onClick={handleCloseTypeForm}>Cancel</Button>
                <Button type="submit" variant="contained">
                  {editingType ? 'Update' : 'Create'}
                </Button>
              </Box>
            </form>
          ) : (
            <>
              <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
                System types cannot be modified. Custom types you create can be edited or deleted.
              </Typography>
              <List>
                {utilityTypes.map((type, index) => (
                  <Box key={type.id}>
                    {index > 0 && <Divider />}
                    <ListItem>
                      <ListItemText
                        primary={
                          <Box display="flex" alignItems="center" gap={1}>
                            {type.name}
                            {type.is_system_type ? (
                              <Chip size="small" label="System" color="default" />
                            ) : (
                              <Chip size="small" label="Custom" color="primary" />
                            )}
                          </Box>
                        }
                        secondary={
                          <Box component="span">
                            {type.description && <>{type.description}<br /></>}
                            {type.unit_of_measurement && (
                              <Typography variant="caption" color="text.secondary">
                                Unit: {type.unit_of_measurement}
                              </Typography>
                            )}
                          </Box>
                        }
                      />
                      <ListItemSecondaryAction>
                        {!type.is_system_type && (
                          <>
                            <Tooltip title="Edit">
                              <IconButton
                                edge="end"
                                onClick={() => handleOpenTypeForm(type)}
                                size="small"
                              >
                                <EditIcon />
                              </IconButton>
                            </Tooltip>
                            <Tooltip title="Delete">
                              <IconButton
                                edge="end"
                                onClick={() => handleDeleteType(type)}
                                size="small"
                                sx={{ ml: 1 }}
                              >
                                <DeleteIcon />
                              </IconButton>
                            </Tooltip>
                          </>
                        )}
                      </ListItemSecondaryAction>
                    </ListItem>
                  </Box>
                ))}
                {utilityTypes.length === 0 && (
                  <ListItem>
                    <ListItemText
                      primary="No utility types found"
                      secondary="Click 'Add Type' to create your first custom utility type"
                    />
                  </ListItem>
                )}
              </List>
            </>
          )}
        </DialogContent>
        <DialogActions>
          <Button onClick={handleCloseTypesDialog}>Close</Button>
        </DialogActions>
      </Dialog>

      {/* Recurring Bills Management Dialog */}
      <Dialog open={recurringDialogOpen} onClose={handleCloseRecurringDialog} maxWidth="sm" fullWidth>
        <DialogTitle>
          <Box display="flex" justifyContent="space-between" alignItems="center">
            <Box display="flex" alignItems="center" gap={1}>
              <AutorenewIcon color="primary" />
              <Typography variant="h6">Recurring Bills</Typography>
            </Box>
            {!recurringFormOpen && (
              <Button
                variant="contained"
                size="small"
                startIcon={<AddIcon />}
                onClick={() => handleOpenRecurringForm()}
              >
                Add Recurring
              </Button>
            )}
          </Box>
        </DialogTitle>
        <DialogContent>
          {recurringError && (
            <Alert severity="error" sx={{ mb: 2 }} onClose={() => setRecurringError('')}>
              {recurringError}
            </Alert>
          )}

          {recurringFormOpen ? (
            <form onSubmit={handleSubmitRecurring}>
              <Typography variant="subtitle1" sx={{ mb: 2, fontWeight: 500 }}>
                {editingRecurring ? 'Edit Recurring Bill' : 'New Recurring Bill'}
              </Typography>
              <TextField
                select
                fullWidth
                label="Utility Type"
                value={recurringFormData.utility_type_id}
                onChange={(e) => setRecurringFormData({ ...recurringFormData, utility_type_id: e.target.value })}
                margin="normal"
                required
              >
                {utilityTypes.map((type) => (
                  <MenuItem key={type.id} value={type.id}>
                    {type.name}
                  </MenuItem>
                ))}
              </TextField>
              <TextField
                fullWidth
                label="Amount"
                type="number"
                step="0.01"
                value={recurringFormData.amount}
                onChange={(e) => setRecurringFormData({ ...recurringFormData, amount: e.target.value })}
                margin="normal"
                required
                InputProps={{
                  startAdornment: <InputAdornment position="start">$</InputAdornment>,
                }}
              />
              <TextField
                select
                fullWidth
                label="Day of Month"
                value={recurringFormData.day_of_month}
                onChange={(e) => setRecurringFormData({ ...recurringFormData, day_of_month: e.target.value })}
                margin="normal"
                required
                helperText="Bill will be created on this day each month"
              >
                {Array.from({ length: 28 }, (_, i) => i + 1).map((day) => (
                  <MenuItem key={day} value={day.toString()}>
                    {day}{day === 1 ? 'st' : day === 2 ? 'nd' : day === 3 ? 'rd' : 'th'}
                  </MenuItem>
                ))}
              </TextField>
              <TextField
                select
                fullWidth
                label="Payment Status"
                value={recurringFormData.payment_status}
                onChange={(e) => setRecurringFormData({ ...recurringFormData, payment_status: e.target.value })}
                margin="normal"
                helperText="New bills will be created with this status"
              >
                {Object.entries(PAYMENT_STATUSES).map(([value, config]) => {
                  const StatusIcon = config.icon;
                  return (
                    <MenuItem key={value} value={value}>
                      <Box display="flex" alignItems="center" gap={1}>
                        <StatusIcon fontSize="small" color={config.color} />
                        {config.label}
                      </Box>
                    </MenuItem>
                  );
                })}
              </TextField>
              <TextField
                fullWidth
                label="Notes (Optional)"
                value={recurringFormData.notes}
                onChange={(e) => setRecurringFormData({ ...recurringFormData, notes: e.target.value })}
                margin="normal"
                placeholder="e.g., Phone bill, Netflix subscription"
              />
              <Box display="flex" gap={1} justifyContent="flex-end" mt={2}>
                <Button onClick={handleCloseRecurringForm}>Cancel</Button>
                <Button type="submit" variant="contained">
                  {editingRecurring ? 'Update' : 'Create'}
                </Button>
              </Box>
            </form>
          ) : (
            <>
              <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
                Recurring bills are automatically added at the beginning of each month.
              </Typography>
              {recurringBills.length === 0 ? (
                <Box textAlign="center" py={3}>
                  <AutorenewIcon sx={{ fontSize: 48, color: 'text.disabled', mb: 1 }} />
                  <Typography color="text.secondary">
                    No recurring bills set up yet
                  </Typography>
                  <Typography variant="body2" color="text.secondary">
                    Add a recurring bill for payments that stay the same each month
                  </Typography>
                </Box>
              ) : (
                <List>
                  {recurringBills.map((recurring, index) => (
                    <Box key={recurring.id}>
                      {index > 0 && <Divider />}
                      <ListItem
                        sx={{
                          opacity: recurring.is_active ? 1 : 0.5,
                        }}
                      >
                        <ListItemText
                          primary={
                            <Box display="flex" alignItems="center" gap={1} flexWrap="wrap">
                              <Typography fontWeight="medium">
                                {recurring.utility_type_name}
                              </Typography>
                              <Chip
                                size="small"
                                label={`$${parseFloat(recurring.amount).toFixed(2)}`}
                                color="primary"
                              />
                              {(() => {
                                const status = recurring.payment_status || 'need_payment';
                                const statusConfig = PAYMENT_STATUSES[status];
                                const StatusIcon = statusConfig.icon;
                                return (
                                  <Chip
                                    size="small"
                                    icon={<StatusIcon sx={{ fontSize: 14 }} />}
                                    label={statusConfig.label}
                                    color={statusConfig.color}
                                    variant="outlined"
                                  />
                                );
                              })()}
                              {!recurring.is_active && (
                                <Chip size="small" label="Paused" color="default" />
                              )}
                            </Box>
                          }
                          secondary={
                            <>
                              Every month on the {recurring.day_of_month}
                              {recurring.day_of_month === 1 ? 'st' : recurring.day_of_month === 2 ? 'nd' : recurring.day_of_month === 3 ? 'rd' : 'th'}
                              {recurring.notes && ` • ${recurring.notes}`}
                            </>
                          }
                        />
                        <ListItemSecondaryAction>
                          <Tooltip title={recurring.is_active ? "Pause" : "Resume"}>
                            <IconButton
                              edge="end"
                              onClick={() => handleToggleRecurring(recurring)}
                              size="small"
                              color={recurring.is_active ? "primary" : "default"}
                            >
                              <AutorenewIcon />
                            </IconButton>
                          </Tooltip>
                          <Tooltip title="Edit">
                            <IconButton
                              edge="end"
                              onClick={() => handleOpenRecurringForm(recurring)}
                              size="small"
                              sx={{ ml: 1 }}
                            >
                              <EditIcon />
                            </IconButton>
                          </Tooltip>
                          <Tooltip title="Delete">
                            <IconButton
                              edge="end"
                              onClick={() => handleDeleteRecurring(recurring)}
                              size="small"
                              sx={{ ml: 1 }}
                            >
                              <DeleteIcon />
                            </IconButton>
                          </Tooltip>
                        </ListItemSecondaryAction>
                      </ListItem>
                    </Box>
                  ))}
                </List>
              )}
            </>
          )}
        </DialogContent>
        <DialogActions>
          <Button onClick={handleCloseRecurringDialog}>Close</Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}

