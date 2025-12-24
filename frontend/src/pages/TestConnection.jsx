import { useState } from 'react';
import { Button, Box, Typography, Paper, Alert } from '@mui/material';

export default function TestConnection() {
  const [results, setResults] = useState({});

  const testEndpoint = async (name, url) => {
    try {
      const start = Date.now();
      const response = await fetch(url, {
        method: 'GET',
        headers: { 'Content-Type': 'application/json' },
      });
      const data = await response.json();
      const duration = Date.now() - start;
      
      setResults(prev => ({
        ...prev,
        [name]: { success: true, status: response.status, data, duration },
      }));
    } catch (error) {
      setResults(prev => ({
        ...prev,
        [name]: { success: false, error: error.message },
      }));
    }
  };

  const testPost = async () => {
    try {
      const start = Date.now();
      const response = await fetch('http://localhost:3000/api/users/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: 'test@test.com',
          password: 'test1234',
          full_name: 'Test User',
        }),
      });
      const data = await response.json();
      const duration = Date.now() - start;
      
      setResults(prev => ({
        ...prev,
        post: { success: true, status: response.status, data, duration },
      }));
    } catch (error) {
      setResults(prev => ({
        ...prev,
        post: { success: false, error: error.message },
      }));
    }
  };

  return (
    <Box sx={{ p: 3 }}>
      <Typography variant="h4" gutterBottom>
        Connection Tests
      </Typography>
      
      <Box sx={{ display: 'flex', gap: 2, mb: 3, flexWrap: 'wrap' }}>
        <Button variant="contained" onClick={() => testEndpoint('health', 'http://localhost:3000/health')}>
          Test API Gateway Health
        </Button>
        <Button variant="contained" onClick={() => testEndpoint('test', 'http://localhost:3000/test')}>
          Test API Gateway Test Endpoint
        </Button>
        <Button variant="contained" onClick={testPost}>
          Test Register Endpoint
        </Button>
      </Box>

      {Object.entries(results).map(([name, result]) => (
        <Paper key={name} sx={{ p: 2, mb: 2 }}>
          <Typography variant="h6">{name}</Typography>
          {result.success ? (
            <Box>
              <Typography>Status: {result.status}</Typography>
              <Typography>Duration: {result.duration}ms</Typography>
              <pre>{JSON.stringify(result.data, null, 2)}</pre>
            </Box>
          ) : (
            <Alert severity="error">{result.error}</Alert>
          )}
        </Paper>
      ))}
    </Box>
  );
}

