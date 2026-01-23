import axios from 'axios';

// Use the main backend URL with /api/crm prefix for CRM routes
const API_BASE_URL = `${process.env.REACT_APP_BACKEND_URL}/api/crm`;

const api = axios.create({
  baseURL: API_BASE_URL,
  headers: {
    'Content-Type': 'application/json'
  }
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

// Response interceptor for error handling
api.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401) {
      // Unauthorized - clear token and redirect to login
      localStorage.removeItem('crm_token');
      localStorage.removeItem('crm_user');
      
      // Redirect based on role
      const role = JSON.parse(localStorage.getItem('crm_user') || '{}').role;
      if (role === 'CLIENT') {
        window.location.href = '/client/login';
      } else {
        window.location.href = '/admin/login';
      }
    }
    return Promise.reject(error);
  }
);

export default api;
