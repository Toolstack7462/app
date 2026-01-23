import api from './api';

export const authService = {
  // Admin login
  adminLogin: async (email, password) => {
    const response = await api.post('/auth/admin/login', { email, password });
    if (response.data.token) {
      localStorage.setItem('crm_token', response.data.token);
      localStorage.setItem('crm_user', JSON.stringify(response.data.user));
    }
    return response.data;
  },

  // Client login
  clientLogin: async (email, password, deviceId) => {
    const response = await api.post('/auth/client/login', { email, password, deviceId });
    if (response.data.token) {
      localStorage.setItem('crm_token', response.data.token);
      localStorage.setItem('crm_user', JSON.stringify(response.data.user));
    }
    return response.data;
  },

  // Logout
  logout: async () => {
    try {
      await api.post('/auth/logout');
    } catch (error) {
      console.error('Logout error:', error);
    } finally {
      localStorage.removeItem('crm_token');
      localStorage.removeItem('crm_user');
    }
  },

  // Get current user
  getCurrentUser: () => {
    const user = localStorage.getItem('crm_user');
    return user ? JSON.parse(user) : null;
  },

  // Check if authenticated
  isAuthenticated: () => {
    return !!localStorage.getItem('crm_token');
  },

  // Get device ID
  getDeviceId: () => {
    let deviceId = localStorage.getItem('device_id');
    if (!deviceId) {
      deviceId = 'device_' + Math.random().toString(36).substring(2) + Date.now().toString(36);
      localStorage.setItem('device_id', deviceId);
    }
    return deviceId;
  }
};
