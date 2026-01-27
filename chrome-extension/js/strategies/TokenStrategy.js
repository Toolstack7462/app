/**
 * Token/Storage Injection Strategy v2.1
 * 
 * Handles:
 * - localStorage injection
 * - sessionStorage injection
 * - Bearer token injection
 * 
 * Enhanced with:
 * - Proper injection timing (before navigation)
 * - Reload coordination
 * - Better error handling
 */

import BaseStrategy from './BaseStrategy.js';

class TokenStrategy extends BaseStrategy {
  constructor() {
    super('token');
    this.reloadAfterInjection = true;
    this.injectionDelay = 300;
  }

  /**
   * Execute token/storage injection strategy
   */
  async execute(credentials, tool, tabId) {
    this.log('info', 'Executing token injection', { tool: tool.name });

    const result = {
      success: false,
      method: 'token',
      tabId,
      error: null,
      localStorage: { set: 0, failed: 0 },
      sessionStorage: { set: 0, failed: 0 }
    };

    try {
      // Extract storage data from credentials
      const storageData = this.extractStorageData(credentials);
      
      if (!storageData.hasData) {
        result.error = 'No storage data to inject';
        return result;
      }

      // Create or use existing tab
      let targetTab;
      if (tabId) {
        await chrome.tabs.update(tabId, { url: tool.targetUrl, active: false });
        targetTab = await chrome.tabs.get(tabId);
      } else {
        targetTab = await chrome.tabs.create({ url: tool.targetUrl, active: false });
      }

      // Wait for page to load (needed to access storage)
      await this.waitForTabLoad(targetTab.id);
      await this.sleep(this.injectionDelay);

      // Inject localStorage
      if (Object.keys(storageData.localStorage).length > 0) {
        this.log('debug', 'Injecting localStorage', { 
          keys: Object.keys(storageData.localStorage).length 
        });
        
        const localResult = await this.injectStorage(
          targetTab.id, 
          'localStorage', 
          storageData.localStorage
        );
        result.localStorage = localResult;
      }

      // Inject sessionStorage
      if (Object.keys(storageData.sessionStorage).length > 0) {
        this.log('debug', 'Injecting sessionStorage', { 
          keys: Object.keys(storageData.sessionStorage).length 
        });
        
        const sessionResult = await this.injectStorage(
          targetTab.id, 
          'sessionStorage', 
          storageData.sessionStorage
        );
        result.sessionStorage = sessionResult;
      }

      // Check if any injection succeeded
      const anySuccess = result.localStorage.set > 0 || result.sessionStorage.set > 0;
      
      if (!anySuccess) {
        result.error = 'All storage injections failed';
        await chrome.tabs.remove(targetTab.id).catch(() => {});
        return result;
      }

      // Reload to apply injected storage
      if (this.reloadAfterInjection) {
        await chrome.tabs.reload(targetTab.id);
        await this.waitForTabLoad(targetTab.id);
      }

      result.success = true;
      result.tabId = targetTab.id;

    } catch (error) {
      this.log('error', 'Token injection error', { error: error.message });
      result.error = error.message;
    }

    return result;
  }

  /**
   * Extract storage data from various credential formats
   */
  extractStorageData(credentials) {
    const result = {
      hasData: false,
      localStorage: {},
      sessionStorage: {}
    };

    const type = credentials?.type;
    const payload = credentials?.payload;

    if (!payload) return result;

    switch (type) {
      case 'token':
        // Token credentials - store in localStorage with common keys
        if (payload.value) {
          result.localStorage = {
            token: payload.value,
            access_token: payload.value,
            auth_token: payload.value
          };
          
          // Add custom key if specified
          if (payload.key) {
            result.localStorage[payload.key] = payload.value;
          }
          
          result.hasData = true;
        }
        break;

      case 'localStorage':
        // Direct localStorage data
        if (typeof payload === 'object') {
          result.localStorage = payload;
          result.hasData = Object.keys(payload).length > 0;
        }
        break;

      case 'sessionStorage':
        // Direct sessionStorage data
        if (typeof payload === 'object') {
          result.sessionStorage = payload;
          result.hasData = Object.keys(payload).length > 0;
        }
        break;

      case 'sso':
        // SSO with tokens
        if (payload.tokens?.accessToken) {
          result.localStorage = {
            access_token: payload.tokens.accessToken,
            token: payload.tokens.accessToken
          };
          
          if (payload.tokens.idToken) {
            result.localStorage.id_token = payload.tokens.idToken;
          }
          
          if (payload.tokens.refreshToken) {
            result.localStorage.refresh_token = payload.tokens.refreshToken;
          }
          
          result.hasData = true;
        }
        
        // SSO with session data
        if (payload.sessionData?.localStorage) {
          result.localStorage = { ...result.localStorage, ...payload.sessionData.localStorage };
          result.hasData = true;
        }
        if (payload.sessionData?.sessionStorage) {
          result.sessionStorage = { ...result.sessionStorage, ...payload.sessionData.sessionStorage };
          result.hasData = true;
        }
        break;

      case 'headers':
        // Headers with bearer token
        if (payload.value) {
          result.localStorage = {
            auth_token: payload.value,
            bearer_token: payload.value
          };
          result.hasData = true;
        }
        break;

      default:
        // Try to extract from generic payload
        if (payload.localStorage && typeof payload.localStorage === 'object') {
          result.localStorage = payload.localStorage;
          result.hasData = true;
        }
        if (payload.sessionStorage && typeof payload.sessionStorage === 'object') {
          result.sessionStorage = payload.sessionStorage;
          result.hasData = true;
        }
        if (payload.token || payload.value) {
          result.localStorage = {
            token: payload.token || payload.value,
            access_token: payload.token || payload.value
          };
          result.hasData = true;
        }
    }

    return result;
  }

  /**
   * Inject data into storage
   */
  async injectStorage(tabId, storageType, data) {
    const result = {
      set: 0,
      failed: 0,
      errors: []
    };

    try {
      const scriptResults = await chrome.scripting.executeScript({
        target: { tabId },
        func: (storageData, type) => {
          const storage = type === 'sessionStorage' ? sessionStorage : localStorage;
          const result = { set: 0, failed: 0, errors: [] };

          for (const [key, value] of Object.entries(storageData)) {
            try {
              // Convert non-string values to JSON
              const valueStr = typeof value === 'string' ? value : JSON.stringify(value);
              storage.setItem(key, valueStr);
              
              // Verify
              if (storage.getItem(key) === valueStr) {
                result.set++;
              } else {
                throw new Error('Value mismatch after set');
              }
            } catch (e) {
              result.failed++;
              result.errors.push({ key, error: e.message });
            }
          }

          return result;
        },
        args: [data, storageType]
      });

      return scriptResults[0]?.result || result;
    } catch (error) {
      result.failed = Object.keys(data).length;
      result.errors.push({ type: storageType, error: error.message });
      return result;
    }
  }

  /**
   * Validate token credentials
   */
  async validate(credentials, tool) {
    const storageData = this.extractStorageData(credentials);
    
    if (!storageData.hasData) {
      return { valid: false, error: 'No storage data found in credentials' };
    }

    const totalKeys = Object.keys(storageData.localStorage).length + 
                      Object.keys(storageData.sessionStorage).length;

    if (totalKeys === 0) {
      return { valid: false, error: 'Storage data is empty' };
    }

    return { valid: true };
  }

  /**
   * Clear storage for a tab
   */
  async clearStorage(tabId, storageType = 'both') {
    try {
      await chrome.scripting.executeScript({
        target: { tabId },
        func: (type) => {
          if (type === 'localStorage' || type === 'both') {
            localStorage.clear();
          }
          if (type === 'sessionStorage' || type === 'both') {
            sessionStorage.clear();
          }
          return { success: true };
        },
        args: [storageType]
      });

      return { success: true };
    } catch (error) {
      return { success: false, error: error.message };
    }
  }

  /**
   * Get storage data from a tab
   */
  async getStorage(tabId) {
    try {
      const results = await chrome.scripting.executeScript({
        target: { tabId },
        func: () => {
          const localData = {};
          const sessionData = {};

          for (let i = 0; i < localStorage.length; i++) {
            const key = localStorage.key(i);
            localData[key] = localStorage.getItem(key);
          }

          for (let i = 0; i < sessionStorage.length; i++) {
            const key = sessionStorage.key(i);
            sessionData[key] = sessionStorage.getItem(key);
          }

          return { localStorage: localData, sessionStorage: sessionData };
        }
      });

      return results[0]?.result || { localStorage: {}, sessionStorage: {} };
    } catch (error) {
      return { localStorage: {}, sessionStorage: {}, error: error.message };
    }
  }

  /**
   * Wait for tab to load
   */
  waitForTabLoad(tabId, timeout = 15000) {
    return new Promise((resolve, reject) => {
      const startTime = Date.now();

      const checkTab = () => {
        chrome.tabs.get(tabId, (tab) => {
          if (chrome.runtime.lastError) {
            reject(new Error(chrome.runtime.lastError.message));
            return;
          }

          if (tab.status === 'complete') {
            resolve(tab);
          } else if (Date.now() - startTime > timeout) {
            resolve(tab);
          } else {
            setTimeout(checkTab, 100);
          }
        });
      };

      checkTab();
    });
  }

  /**
   * Sleep utility
   */
  sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}

export default TokenStrategy;
