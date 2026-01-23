import axios from 'axios';

// Use the main backend URL with /api/crm prefix for CRM routes
const API_BASE_URL = `${process.env.REACT_APP_BACKEND_URL}/api/crm`;

const api = axios.create({
  baseURL: API_BASE_URL,
  headers: {
    'Content-Type': 'application/json'
  },
  withCredentials: true // Important for cookies
});

// Request interceptor to add auth token
api.interceptors.request.use(
  (config) => {
    const token = localStorage.getItem('crm_token');
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  },
  (error) => {
    return Promise.reject(error);
  }
);

// Response interceptor for error handling and token refresh
api.interceptors.response.use(
  (response) => response,
  async (error) => {
    const originalRequest = error.config;
    
    // Check if error is 401 and we haven't retried yet
    if (error.response?.status === 401 && !originalRequest._retry) {
      // Check for TOKEN_VERSION_MISMATCH - force logout
      if (error.response?.data?.code === 'TOKEN_VERSION_MISMATCH') {
        localStorage.removeItem('crm_token');
        localStorage.removeItem('crm_refresh_token');
        const user = JSON.parse(localStorage.getItem('crm_user') || '{}');
        localStorage.removeItem('crm_user');
        
        // Redirect based on role stored before clearing
        if (user.role === 'CLIENT') {
          window.location.href = '/client/login?message=session_invalidated';
        } else {
          window.location.href = '/admin/login?message=session_invalidated';
        }
        return Promise.reject(error);
      }
      
      originalRequest._retry = true;
      
      try {
        // Try to refresh token
        const refreshToken = localStorage.getItem('crm_refresh_token');
        if (!refreshToken) {
          throw new Error('No refresh token');
        }
        
        const response = await axios.post(
          `${API_BASE_URL}/auth/refresh`,
          { refreshToken },
          { withCredentials: true }
        );
        
        const { accessToken, refreshToken: newRefreshToken } = response.data;
        
        // Update tokens
        localStorage.setItem('crm_token', accessToken);
        if (newRefreshToken) {
          localStorage.setItem('crm_refresh_token', newRefreshToken);
        }
        
        // Retry original request with new token
        originalRequest.headers.Authorization = `Bearer ${accessToken}`;
        return api(originalRequest);
      } catch (refreshError) {
        // Refresh failed - clear tokens and redirect to login
        localStorage.removeItem('crm_token');
        localStorage.removeItem('crm_refresh_token');
        const user = JSON.parse(localStorage.getItem('crm_user') || '{}');
        localStorage.removeItem('crm_user');
        
        // Redirect based on role
        if (user.role === 'CLIENT') {
          window.location.href = '/client/login?message=session_expired';
        } else {
          window.location.href = '/admin/login?message=session_expired';
        }
        
        return Promise.reject(refreshError);
      }
    }
    
    return Promise.reject(error);
  }
);

export default api;