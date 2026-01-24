// Storage utility for Chrome extension
const Storage = {
  async get(keys) {
    return new Promise((resolve) => {
      chrome.storage.local.get(keys, resolve);
    });
  },
  
  async set(data) {
    return new Promise((resolve) => {
      chrome.storage.local.set(data, resolve);
    });
  },
  
  async remove(keys) {
    return new Promise((resolve) => {
      chrome.storage.local.remove(keys, resolve);
    });
  },
  
  async clear() {
    return new Promise((resolve) => {
      chrome.storage.local.clear(resolve);
    });
  }
};

// API client for extension
class ApiClient {
  constructor() {
    this.baseUrl = null;
    this.token = null;
  }
  
  async init() {
    const data = await Storage.get(['apiUrl', 'extensionToken']);
    this.baseUrl = data.apiUrl || '';
    this.token = data.extensionToken || null;
    return this;
  }
  
  setToken(token) {
    this.token = token;
  }
  
  setBaseUrl(url) {
    this.baseUrl = url;
  }
  
  async request(endpoint, options = {}) {
    const url = `${this.baseUrl}/api/crm/extension${endpoint}`;
    const headers = {
      'Content-Type': 'application/json',
      'X-Extension-Version': chrome.runtime.getManifest().version,
      ...options.headers
    };
    
    if (this.token) {
      headers['Authorization'] = `ExtToken ${this.token}`;
    }
    
    try {
      const response = await fetch(url, {
        ...options,
        headers
      });
      
      const data = await response.json();
      
      if (!response.ok) {
        throw new Error(data.error || 'Request failed');
      }
      
      return data;
    } catch (error) {
      console.error('API request failed:', error);
      throw error;
    }
  }
  
  async login(email, password) {
    return this.request('/auth', {
      method: 'POST',
      body: JSON.stringify({ email, password })
    });
  }
  
  async logout() {
    return this.request('/logout', { method: 'POST' });
  }
  
  async getTools() {
    return this.request('/tools');
  }
  
  async getToolVersions() {
    return this.request('/tools/versions');
  }
  
  async getCredentials(toolId) {
    return this.request(`/tools/${toolId}/credentials`);
  }
  
  async logToolOpened(toolId) {
    return this.request(`/tools/${toolId}/opened`, { method: 'POST' });
  }
  
  async getProfile() {
    return this.request('/profile');
  }
  
  async getDomains() {
    return this.request('/domains');
  }
}

// Export for use in other files
export { Storage, ApiClient };
