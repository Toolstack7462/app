import axios from 'axios';

// ============================================================================
// UNIVERSAL API CONFIGURATION - ENVIRONMENT AGNOSTIC
// ============================================================================
// This configuration works regardless of how Emergent changes subdomains/ports
// Priority order for API base URL:
// 1. Use same-origin relative path (most reliable for proxied setups)
// 2. Fall back to REACT_APP_BACKEND_URL env variable if explicitly set
// 3. Fall back to window.location.origin (current domain)
// ============================================================================

/**
 * Determines the API base URL dynamically
 * For Emergent deployments, always uses relative paths which work with any subdomain
 */
function getApiBaseUrl() {
  // Check if we have an explicitly configured backend URL that's different from current origin
  const envBackendUrl = process.env.REACT_APP_BACKEND_URL;
  
  // If env variable is set and it's a different origin, use it (useful for local dev)
  if (envBackendUrl) {
    try {
      const envOrigin = new URL(envBackendUrl).origin;
      const currentOrigin = window.location.origin;
      
      // If they're different (e.g., local dev pointing to remote), use the env URL
      if (envOrigin !== currentOrigin && !envBackendUrl.includes('localhost')) {
        console.log('[API] Using configured backend URL:', envBackendUrl);
        return `${envBackendUrl}/api/crm`;
      }
    } catch (e) {
      // Invalid URL in env, ignore and use relative
    }
  }
  
  // Default: Use relative URL (same-origin) - works with any Emergent preview URL
  // This is the most reliable approach for dynamic deployments
  console.log('[API] Using same-origin relative path: /api/crm');
  return '/api/crm';
}

// Get the base URL
const API_BASE_URL = getApiBaseUrl();

// Create axios instance
const api = axios.create({
  baseURL: API_BASE_URL,
  headers: {
    'Content-Type': 'application/json'
  },
  withCredentials: true // Important for cookies/sessions
});

// ============================================================================
// REQUEST INTERCEPTOR
// ============================================================================
api.interceptors.request.use(
  (config) => {
    // Add auth token if available
    const token = localStorage.getItem('crm_token');
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    
    // Log request in development
    if (process.env.NODE_ENV === 'development') {
      console.log(`[API] ${config.method?.toUpperCase()} ${config.baseURL}${config.url}`);
    }
    
    return config;
  },
  (error) => {
    return Promise.reject(error);
  }
);

// ============================================================================
// RESPONSE INTERCEPTOR - Auto token refresh & error handling
// ============================================================================
api.interceptors.response.use(
  (response) => response,
  async (error) => {
    const originalRequest = error.config;
    
    // Check if error is 401 and we haven't retried yet
    if (error.response?.status === 401 && !originalRequest._retry) {
      // Check for TOKEN_VERSION_MISMATCH - force logout
      if (error.response?.data?.code === 'TOKEN_VERSION_MISMATCH') {
        handleSessionInvalidation('session_invalidated');
        return Promise.reject(error);
      }
      
      originalRequest._retry = true;
      
      try {
        // Try to refresh token
        const refreshToken = localStorage.getItem('crm_refresh_token');
        if (!refreshToken) {
          throw new Error('No refresh token');
        }
        
        // Use the same base URL for refresh
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
        handleSessionInvalidation('session_expired');
        return Promise.reject(refreshError);
      }
    }
    
    return Promise.reject(error);
  }
);

/**
 * Handle session invalidation - clear tokens and redirect to appropriate login
 * IMPORTANT: Client routes should NEVER redirect to admin login
 */
function handleSessionInvalidation(reason) {
  localStorage.removeItem('crm_token');
  localStorage.removeItem('crm_refresh_token');
  const user = JSON.parse(localStorage.getItem('crm_user') || '{}');
  localStorage.removeItem('crm_user');
  
  // Determine correct login page based on current path AND user role
  const currentPath = window.location.pathname;
  const isClientPath = currentPath.startsWith('/client');
  
  // RULE: If on client path OR user is CLIENT, always go to client login
  // This ensures clients NEVER see admin login
  if (isClientPath || user.role === 'CLIENT') {
    window.location.href = `/client/login?message=${reason}`;
  } else {
    // Only admins on admin paths go to admin login
    window.location.href = `/admin/login?message=${reason}`;
  }
}

// ============================================================================
// UTILITY EXPORTS
// ============================================================================

/**
 * Get the current API base URL (useful for debugging)
 */
export function getBaseUrl() {
  return API_BASE_URL;
}

/**
 * Check API health
 */
export async function checkApiHealth() {
  try {
    const response = await api.get('/health');
    return { ok: true, data: response.data };
  } catch (error) {
    return { ok: false, error: error.message };
  }
}

export default api;
