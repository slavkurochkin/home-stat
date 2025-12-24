import { Outlet, useNavigate, useLocation } from 'react-router-dom';
import {
  AppBar,
  Toolbar,
  Typography,
  Button,
  Container,
  Box,
  Drawer,
  List,
  ListItem,
  ListItemButton,
  ListItemIcon,
  ListItemText,
  IconButton,
  useTheme,
  useMediaQuery,
  Badge,
  Alert,
  Collapse,
} from '@mui/material';
import MenuIcon from '@mui/icons-material/Menu';
import DashboardIcon from '@mui/icons-material/Dashboard';
import ReceiptIcon from '@mui/icons-material/Receipt';
import AnalyticsIcon from '@mui/icons-material/Analytics';
import NotificationsIcon from '@mui/icons-material/Notifications';
import LogoutIcon from '@mui/icons-material/Logout';
import WarningIcon from '@mui/icons-material/Warning';
import CloseIcon from '@mui/icons-material/Close';
import { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import api from '../services/api';

const drawerWidth = 240;

const getMenuItems = (unreadCount) => [
  { text: 'Dashboard', icon: <DashboardIcon />, path: '/dashboard' },
  { text: 'Bills', icon: <ReceiptIcon />, path: '/bills' },
  { text: 'Analytics', icon: <AnalyticsIcon />, path: '/analytics' },
  { 
    text: 'Alerts', 
    icon: (
      <Badge badgeContent={unreadCount} color="error">
        <NotificationsIcon />
      </Badge>
    ), 
    path: '/alerts' 
  },
];

export default function Layout() {
  const [mobileOpen, setMobileOpen] = useState(false);
  const [unreadCount, setUnreadCount] = useState(0);
  const [urgentAlerts, setUrgentAlerts] = useState([]);
  const [showBanner, setShowBanner] = useState(true);
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down('md'));
  const navigate = useNavigate();
  const location = useLocation();
  const { user, logout } = useAuth();

  // Check for promotions and unread notifications on mount and periodically
  useEffect(() => {
    const checkNotifications = async () => {
      try {
        // Check promotions first
        await api.post('/notifications/check-promotions');
        
        // Get unread count and urgent notifications
        const response = await api.get('/notifications/notifications', { params: { limit: 10 } });
        setUnreadCount(response.data.unread_count || 0);
        
        // Find urgent/warning notifications that are unread
        const urgent = response.data.notifications.filter(
          n => !n.is_read && (n.notification_type === 'warning' || n.notification_type === 'alert')
        );
        setUrgentAlerts(urgent);
      } catch (err) {
        console.log('Notification check:', err.message);
      }
    };

    checkNotifications();
    
    // Check every 5 minutes
    const interval = setInterval(checkNotifications, 5 * 60 * 1000);
    return () => clearInterval(interval);
  }, []);

  const handleDrawerToggle = () => {
    setMobileOpen(!mobileOpen);
  };

  const handleDismissBanner = async () => {
    setShowBanner(false);
    // Mark urgent alerts as read
    for (const alert of urgentAlerts) {
      try {
        await api.put(`/notifications/notifications/${alert.id}/read`);
      } catch (err) {
        console.log('Failed to mark as read:', err.message);
      }
    }
    setUrgentAlerts([]);
    setUnreadCount(prev => Math.max(0, prev - urgentAlerts.length));
  };

  const handleNavigation = (path) => {
    navigate(path);
    if (isMobile) {
      setMobileOpen(false);
    }
  };

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  const menuItems = getMenuItems(unreadCount);

  const drawer = (
    <Box>
      <Toolbar>
        <Typography variant="h6" noWrap component="div">
          Utility Manager
        </Typography>
      </Toolbar>
      <List>
        {menuItems.map((item) => (
          <ListItem key={item.text} disablePadding>
            <ListItemButton
              selected={location.pathname === item.path}
              onClick={() => handleNavigation(item.path)}
            >
              <ListItemIcon>{item.icon}</ListItemIcon>
              <ListItemText primary={item.text} />
            </ListItemButton>
          </ListItem>
        ))}
        <ListItem disablePadding>
          <ListItemButton onClick={handleLogout}>
            <ListItemIcon>
              <LogoutIcon />
            </ListItemIcon>
            <ListItemText primary="Logout" />
          </ListItemButton>
        </ListItem>
      </List>
    </Box>
  );

  return (
    <Box sx={{ display: 'flex' }}>
      <AppBar
        position="fixed"
        sx={{
          width: { md: `calc(100% - ${drawerWidth}px)` },
          ml: { md: `${drawerWidth}px` },
        }}
      >
        <Toolbar>
          <IconButton
            color="inherit"
            aria-label="open drawer"
            edge="start"
            onClick={handleDrawerToggle}
            sx={{ mr: 2, display: { md: 'none' } }}
          >
            <MenuIcon />
          </IconButton>
          <Typography variant="h6" noWrap component="div" sx={{ flexGrow: 1 }}>
            {user?.full_name || 'User'}
          </Typography>
        </Toolbar>
      </AppBar>
      <Box
        component="nav"
        sx={{ width: { md: drawerWidth }, flexShrink: { md: 0 } }}
      >
        <Drawer
          variant="temporary"
          open={mobileOpen}
          onClose={handleDrawerToggle}
          ModalProps={{
            keepMounted: true,
          }}
          sx={{
            display: { xs: 'block', md: 'none' },
            '& .MuiDrawer-paper': { boxSizing: 'border-box', width: drawerWidth },
          }}
        >
          {drawer}
        </Drawer>
        <Drawer
          variant="permanent"
          sx={{
            display: { xs: 'none', md: 'block' },
            '& .MuiDrawer-paper': { boxSizing: 'border-box', width: drawerWidth },
          }}
          open
        >
          {drawer}
        </Drawer>
      </Box>
      <Box
        component="main"
        sx={{
          flexGrow: 1,
          p: 3,
          width: { md: `calc(100% - ${drawerWidth}px)` },
        }}
      >
        <Toolbar />
        
        {/* Urgent Alert Banner */}
        <Collapse in={showBanner && urgentAlerts.length > 0}>
          <Alert
            severity="warning"
            icon={<WarningIcon />}
            sx={{
              mb: 2,
              bgcolor: 'warning.main',
              color: 'warning.contrastText',
              '& .MuiAlert-icon': { color: 'warning.contrastText' },
              '& .MuiAlert-action': { color: 'warning.contrastText' },
              cursor: 'pointer',
              fontWeight: 'bold',
            }}
            action={
              <IconButton
                color="inherit"
                size="small"
                onClick={(e) => {
                  e.stopPropagation();
                  handleDismissBanner();
                }}
              >
                <CloseIcon fontSize="small" />
              </IconButton>
            }
            onClick={() => navigate('/alerts')}
          >
            {urgentAlerts.length === 1 
              ? urgentAlerts[0].message
              : `You have ${urgentAlerts.length} urgent notifications - click to view`
            }
          </Alert>
        </Collapse>

        <Container maxWidth="lg">
          <Outlet />
        </Container>
      </Box>
    </Box>
  );
}

