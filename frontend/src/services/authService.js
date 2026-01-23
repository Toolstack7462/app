import api from './api';

class AuthService {
  async adminLogin(email, password) {
    const response = await api.post('/auth/admin/login', { email, password });
    
    if (response.data.success) {
      const { user, accessToken, refreshToken } = response.data;
      localStorage.setItem('crm_token', accessToken);
      localStorage.setItem('crm_refresh_token', refreshToken);
      localStorage.setItem('crm_user', JSON.stringify(user));
      return user;
    }
    
    throw new Error(response.data.error || 'Login failed');
  }
  
  async clientLogin(email, password, deviceId) {
    const response = await api.post('/auth/client/login', { 
      email, 
      password, 
      deviceId 
    });
    
    if (response.data.success) {
      const { user, accessToken, refreshToken } = response.data;
      localStorage.setItem('crm_token', accessToken);
      localStorage.setItem('crm_refresh_token', refreshToken);
      localStorage.setItem('crm_user', JSON.stringify(user));
      return user;
    }
    
    throw new Error(response.data.error || 'Login failed');
  }
  
  async logout() {
    try {
      const refreshToken = localStorage.getItem('crm_refresh_token');
      await api.post('/auth/logout', { refreshToken });
    } catch (error) {
      console.error('Logout error:', error);
    } finally {
      localStorage.removeItem('crm_token');
      localStorage.removeItem('crm_refresh_token');
      localStorage.removeItem('crm_user');
    }
  }
  
  async refreshToken() {
    const refreshToken = localStorage.getItem('crm_refresh_token');
    if (!refreshToken) {
      throw new Error('No refresh token');
    }
    
    const response = await api.post('/auth/refresh', { refreshToken });
    
    if (response.data.success) {
      const { accessToken, refreshToken: newRefreshToken } = response.data;
      localStorage.setItem('crm_token', accessToken);
      if (newRefreshToken) {
        localStorage.setItem('crm_refresh_token', newRefreshToken);
      }
      return accessToken;
    }
    
    throw new Error('Token refresh failed');
  }
  
  getCurrentUser() {
    try {
      const userStr = localStorage.getItem('crm_user');
      return userStr ? JSON.parse(userStr) : null;
    } catch (error) {
      return null;
    }
  }
  
  isAuthenticated() {
    return !!localStorage.getItem('crm_token');
  }
  
  getToken() {
    return localStorage.getItem('crm_token');
  }
  
  // Generate device ID (browser fingerprint)
  generateDeviceId() {
    // Simple device fingerprint - in production, use a library like fingerprintjs
    const userAgent = navigator.userAgent;
    const screenResolution = `${screen.width}x${screen.height}`;
    const timezone = Intl.DateTimeFormat().resolvedOptions().timeZone;
    const language = navigator.language;
    const platform = navigator.platform;
    
    const fingerprint = `${userAgent}-${screenResolution}-${timezone}-${language}-${platform}`;
    
    // Hash the fingerprint
    return this.simpleHash(fingerprint);
  }
  
  // Simple hash function
  simpleHash(str) {
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
      const char = str.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash;
    }
    return Math.abs(hash).toString(36);
  }
  
  // Store device ID in localStorage
  getOrCreateDeviceId() {
    let deviceId = localStorage.getItem('device_id');
    if (!deviceId) {
      deviceId = this.generateDeviceId();
      localStorage.setItem('device_id', deviceId);
    }
    return deviceId;
  }
}

export const authService = new AuthService();
