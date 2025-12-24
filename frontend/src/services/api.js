import axios from 'axios';

// TEMPORARY: Use direct connection to test if API Gateway works
// Change back to '/api' once Vite proxy is working
const api = axios.create({
  baseURL: import.meta.env.DEV ? 'http://localhost:3000/api' : '/api',
  headers: {
    'Content-Type': 'application/json',
  },
  timeout: 30000, // 30 second timeout
});

// Add token to requests if available
const token = localStorage.getItem('token');
if (token) {
  api.defaults.headers.common['Authorization'] = `Bearer ${token}`;
}

// Request interceptor for logging
api.interceptors.request.use(
  (config) => {
    const fullUrl = config.baseURL + config.url;
    console.log('API Request:', config.method?.toUpperCase(), fullUrl);
    console.log('Request config:', { baseURL: config.baseURL, url: config.url, fullUrl });
    return config;
  },
  (error) => {
    console.error('API Request Error:', error);
    return Promise.reject(error);
  }
);

// Response interceptor for logging
api.interceptors.response.use(
  (response) => {
    console.log('API Response:', response.status, response.config.url);
    return response;
  },
  (error) => {
    const fullUrl = error.config ? (error.config.baseURL + error.config.url) : 'unknown';
    console.error('API Response Error:', error.message);
    console.error('Error details:', {
      code: error.code,
      message: error.message,
      url: fullUrl,
      timeout: error.code === 'ECONNABORTED' ? 'Request timed out' : null,
    });
    if (error.code === 'ECONNREFUSED') {
      console.error('Connection refused - is the API Gateway running on port 3000?');
    }
    if (error.code === 'ECONNABORTED') {
      console.error('Request timed out - check if Vite proxy is working or API Gateway is responding');
    }
    return Promise.reject(error);
  }
);

export default api;

