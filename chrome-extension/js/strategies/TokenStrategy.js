/**
 * Token Strategy
 * Handles token-based authentication (localStorage, sessionStorage, JWT)
 */
import { BaseStrategy } from './BaseStrategy.js';

export class TokenStrategy extends BaseStrategy {
  constructor() {
    super('Token');
  }
  
  /**
   * Check if this strategy can handle the config
   */
  canHandle(config) {
    return config.storage && 
           config.storage.data && 
           Object.keys(config.storage.data).length > 0;
  }
  
  /**
   * Execute token/storage injection
   * This requires a tab to be open and the content script to inject
   */
  async execute(config, context) {
    if (!context.tabId) {
      return {
        success: false,
        strategy: this.name,
        error: 'No tab ID provided - token injection requires an open tab',
        needsTab: true
      };
    }
    
    const storageType = config.storage.type || 'localStorage';
    const data = config.storage.data;
    
    this.log(`Executing ${storageType} injection`, { 
      tabId: context.tabId, 
      keyCount: Object.keys(data).length 
    });
    
    try {
      // Inject storage via content script
      const results = await chrome.scripting.executeScript({
        target: { tabId: context.tabId },
        func: this.injectStorageScript,
        args: [data, storageType]
      });
      
      const result = results[0]?.result;
      
      if (!result) {
        throw new Error('No result from content script');
      }
      
      this.log(`${storageType} injection complete`, result);
      
      return {
        success: result.success,
        strategy: this.name,
        storageType,
        set: result.set,
        errors: result.errors,
        needsReload: result.success
      };
    } catch (error) {
      this.logError('Storage injection failed', error);
      
      return {
        success: false,
        strategy: this.name,
        error: error.message,
        storageType,
        fallback: this.getManualInstructions(storageType, data)
      };
    }
  }
  
  /**
   * Script to inject storage (runs in page context)
   */
  injectStorageScript(data, storageType) {
    const storage = storageType === 'sessionStorage' ? sessionStorage : localStorage;
    let setCount = 0;
    const errors = [];
    
    for (const [key, value] of Object.entries(data)) {
      try {
        const valueStr = typeof value === 'string' ? value : JSON.stringify(value);
        storage.setItem(key, valueStr);
        setCount++;
      } catch (e) {
        errors.push({ key, error: e.message });
      }
    }
    
    return {
      success: setCount > 0,
      set: setCount,
      total: Object.keys(data).length,
      errors
    };
  }
  
  /**
   * Inject JWT token with additional header configuration
   */
  async injectJWT(config, context) {
    const { token, headerName = 'Authorization', prefix = 'Bearer ' } = config.storage.data;
    
    // Store token configuration for request interception
    const domain = config.domain;
    await chrome.storage.local.set({
      [`jwt_${domain}`]: {
        token,
        headerName,
        prefix,
        expiresAt: config.storage.expiresAt
      }
    });
    
    // Also inject to localStorage if specified
    if (config.storage.injectToStorage !== false && context.tabId) {
      await chrome.scripting.executeScript({
        target: { tabId: context.tabId },
        func: (tokenData) => {
          // Store in common token locations
          localStorage.setItem('token', tokenData.token);
          localStorage.setItem('auth_token', tokenData.token);
          localStorage.setItem('access_token', tokenData.token);
          
          // Store full auth object if app expects it
          const authObj = {
            token: tokenData.token,
            expiresAt: tokenData.expiresAt
          };
          localStorage.setItem('auth', JSON.stringify(authObj));
        },
        args: [{ token, expiresAt: config.storage.expiresAt }]
      });
    }
    
    return {
      success: true,
      strategy: this.name,
      type: 'jwt',
      needsReload: true
    };
  }
  
  /**
   * Get manual instructions for fallback
   */
  getManualInstructions(storageType, data) {
    const keys = Object.keys(data);
    return {
      type: 'manual',
      steps: [
        'Open DevTools (F12)',
        'Go to Application tab',
        `Find "${storageType}" in the sidebar`,
        'Add the following key-value pairs:',
        ...keys.map(k => `  ${k}: ${typeof data[k] === 'string' ? data[k].substring(0, 50) : JSON.stringify(data[k]).substring(0, 50)}...`)
      ]
    };
  }
  
  /**
   * Verify token was set
   */
  async verify(config, context) {
    if (!context.tabId) return false;
    
    const storageType = config.storage.type || 'localStorage';
    const expectedKeys = Object.keys(config.storage.data);
    
    try {
      const results = await chrome.scripting.executeScript({
        target: { tabId: context.tabId },
        func: (keys, type) => {
          const storage = type === 'sessionStorage' ? sessionStorage : localStorage;
          const found = [];
          const missing = [];
          
          for (const key of keys) {
            if (storage.getItem(key) !== null) {
              found.push(key);
            } else {
              missing.push(key);
            }
          }
          
          return { found, missing, success: missing.length === 0 };
        },
        args: [expectedKeys, storageType]
      });
      
      return results[0]?.result?.success || false;
    } catch (error) {
      this.logError('Verification failed', error);
      return false;
    }
  }
}

export default TokenStrategy;
