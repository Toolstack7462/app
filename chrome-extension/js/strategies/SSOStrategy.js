/**
 * SSO Strategy
 * Handles one-click SSO/OAuth authentication flows
 * 
 * Flow:
 * 1. Open authStartUrl
 * 2. Detect OAuth provider button and click (if autoClick)
 * 3. Wait for redirect to postLoginUrl
 * 4. Verify success using successCheck rules
 */
import { BaseStrategy } from './BaseStrategy.js';
import { TIMEOUTS } from '../config/toolConfigs.js';

export class SSOStrategy extends BaseStrategy {
  constructor() {
    super('SSO');
    
    // Common SSO/OAuth provider button selectors
    this.providerSelectors = {
      google: [
        '[data-provider="google"]',
        'button[class*="google"]',
        'a[href*="google.com/o/oauth"]',
        '[aria-label*="Google"]',
        '.google-login',
        '#google-signin',
        'button:has(svg[data-icon="google"])'
      ],
      microsoft: [
        '[data-provider="microsoft"]',
        'button[class*="microsoft"]',
        'a[href*="microsoft"]',
        '[aria-label*="Microsoft"]',
        '.microsoft-login'
      ],
      github: [
        '[data-provider="github"]',
        'button[class*="github"]',
        'a[href*="github.com/login/oauth"]',
        '[aria-label*="GitHub"]',
        '.github-login'
      ],
      okta: [
        '[data-provider="okta"]',
        'button[class*="okta"]',
        'a[href*="okta"]',
        '.okta-login'
      ],
      auth0: [
        '[data-provider="auth0"]',
        'a[href*="auth0.com"]',
        '.auth0-login'
      ],
      azure: [
        '[data-provider="azure"]',
        'a[href*="login.microsoftonline.com"]',
        '.azure-login'
      ],
      saml: [
        '[data-provider="sso"]',
        '[data-provider="saml"]',
        'button[class*="sso"]',
        'a[href*="sso"]',
        '.sso-login',
        'button[class*="enterprise"]',
        'a[href*="saml"]'
      ]
    };
  }
  
  /**
   * Check if this strategy can handle the config
   */
  canHandle(config) {
    return config.ssoConfig && config.ssoConfig.authStartUrl;
  }
  
  /**
   * Execute SSO authentication flow
   */
  async execute(config, context) {
    this.log('Executing SSO strategy', { 
      domain: config.domain,
      authStartUrl: config.ssoConfig?.authStartUrl,
      postLoginUrl: config.ssoConfig?.postLoginUrl
    });
    
    const ssoConfig = config.ssoConfig || config.oauth;
    
    if (!ssoConfig) {
      return { success: false, strategy: this.name, error: 'No SSO configuration' };
    }
    
    // If we have pre-authenticated session data, inject it
    if (ssoConfig.sessionData) {
      return this.injectSessionData(config, context);
    }
    
    // If we have pre-authenticated tokens, inject them
    if (ssoConfig.tokens) {
      return this.injectTokens(config, context);
    }
    
    // One-click flow: redirect to auth URL and monitor for success
    if (ssoConfig.authStartUrl) {
      return this.executeOneClickFlow(config, context);
    }
    
    return { success: false, strategy: this.name, error: 'No valid SSO configuration' };
  }
  
  /**
   * Execute one-click SSO flow
   */
  async executeOneClickFlow(config, context) {
    const ssoConfig = config.ssoConfig;
    const tabId = context.tabId;
    
    if (!tabId) {
      return { success: false, strategy: this.name, error: 'No tab ID for SSO flow' };
    }
    
    this.log('Starting one-click SSO flow');
    
    try {
      // Navigate to auth start URL
      await chrome.tabs.update(tabId, { url: ssoConfig.authStartUrl });
      
      // Wait for page to load
      await this.waitForTabLoad(tabId);
      
      // If autoClick is enabled and we have a provider, try to click the button
      if (ssoConfig.autoClick && ssoConfig.provider) {
        await this.clickProviderButton(tabId, ssoConfig.provider, ssoConfig.buttonSelector);
      }
      
      // Monitor for redirect to postLoginUrl
      const success = await this.monitorForSuccess(tabId, ssoConfig, config.successCheck);
      
      return {
        success,
        strategy: this.name,
        type: 'one_click_flow',
        needsReload: false // SSO flow handles navigation
      };
    } catch (error) {
      this.logError('One-click SSO flow failed', error);
      return { success: false, strategy: this.name, error: error.message };
    }
  }
  
  /**
   * Click provider button on login page
   */
  async clickProviderButton(tabId, provider, customSelector) {
    const selectors = customSelector 
      ? [customSelector]
      : (this.providerSelectors[provider] || []);
    
    if (selectors.length === 0) {
      this.log(`No selectors for provider: ${provider}`);
      return false;
    }
    
    try {
      const results = await chrome.scripting.executeScript({
        target: { tabId },
        func: (selectorList) => {
          for (const selector of selectorList) {
            try {
              const button = document.querySelector(selector);
              if (button && button.offsetParent !== null) {
                button.click();
                return { success: true, selector, clicked: true };
              }
            } catch (e) {
              // Invalid selector, continue
            }
          }
          return { success: false, error: 'No provider button found' };
        },
        args: [selectors]
      });
      
      const result = results[0]?.result;
      if (result?.clicked) {
        this.log(`Clicked provider button: ${result.selector}`);
      }
      return result?.success || false;
    } catch (error) {
      this.logError('Failed to click provider button', error);
      return false;
    }
  }
  
  /**
   * Monitor for successful SSO completion
   */
  async monitorForSuccess(tabId, ssoConfig, successCheck) {
    const startTime = Date.now();
    const timeout = TIMEOUTS.ssoCallback || 30000;
    const postLoginUrl = ssoConfig.postLoginUrl;
    
    while (Date.now() - startTime < timeout) {
      try {
        const tab = await chrome.tabs.get(tabId);
        const currentUrl = tab.url;
        
        // Check if redirected to post-login URL
        if (postLoginUrl && currentUrl.includes(postLoginUrl)) {
          this.log('Detected redirect to post-login URL');
          return true;
        }
        
        // Check success rules
        if (successCheck) {
          const isSuccess = await this.checkSuccess(tabId, successCheck);
          if (isSuccess) {
            this.log('Success check passed');
            return true;
          }
        }
        
        // Check if we're no longer on login/auth pages
        const isLoginPage = /\/(login|signin|auth|oauth)/i.test(currentUrl);
        if (!isLoginPage && currentUrl !== ssoConfig.authStartUrl) {
          this.log('No longer on login page, assuming success');
          return true;
        }
        
      } catch (error) {
        // Tab might have been closed or navigated
        if (error.message.includes('No tab with id')) {
          return false;
        }
      }
      
      await new Promise(resolve => setTimeout(resolve, 500));
    }
    
    this.log('SSO flow timed out');
    return false;
  }
  
  /**
   * Check success conditions
   */
  async checkSuccess(tabId, successCheck) {
    if (!successCheck || Object.keys(successCheck).length === 0) {
      return false;
    }
    
    try {
      const results = await chrome.scripting.executeScript({
        target: { tabId },
        func: (checks) => {
          const url = window.location.href;
          
          // URL checks
          if (checks.urlIncludes && !url.includes(checks.urlIncludes)) {
            return false;
          }
          if (checks.urlExcludes && url.includes(checks.urlExcludes)) {
            return false;
          }
          if (checks.urlPattern) {
            const regex = new RegExp(checks.urlPattern);
            if (!regex.test(url)) return false;
          }
          
          // Element checks
          if (checks.elementExists) {
            const el = document.querySelector(checks.elementExists);
            if (!el || el.offsetParent === null) return false;
          }
          if (checks.elementNotExists) {
            const el = document.querySelector(checks.elementNotExists);
            if (el && el.offsetParent !== null) return false;
          }
          
          // Storage checks
          if (checks.storageKeys) {
            for (const key of checks.storageKeys) {
              if (!localStorage.getItem(key)) return false;
            }
          }
          
          return true;
        },
        args: [successCheck]
      });
      
      return results[0]?.result || false;
    } catch (error) {
      return false;
    }
  }
  
  /**
   * Inject pre-authenticated session data (cookies + storage)
   */
  async injectSessionData(config, context) {
    const sessionData = config.ssoConfig?.sessionData || config.oauth?.sessionData;
    
    if (!sessionData) {
      return { success: false, strategy: this.name, error: 'No session data' };
    }
    
    const results = { cookies: null, storage: null };
    
    // Inject cookies
    if (sessionData.cookies && sessionData.cookies.length > 0) {
      results.cookies = await this.injectCookies(config.targetUrl, sessionData.cookies);
    }
    
    // Inject storage
    if (sessionData.storage && context.tabId) {
      results.storage = await this.injectStorage(
        context.tabId,
        sessionData.storage,
        sessionData.storageType || 'localStorage'
      );
    }
    
    const success = (results.cookies?.success || !sessionData.cookies) &&
                    (results.storage?.success || !sessionData.storage);
    
    return {
      success,
      strategy: this.name,
      type: 'session_bootstrap',
      results,
      needsReload: success
    };
  }
  
  /**
   * Inject pre-authenticated tokens
   */
  async injectTokens(config, context) {
    if (!context.tabId) {
      return { success: false, strategy: this.name, error: 'No tab ID' };
    }
    
    const tokens = config.ssoConfig?.tokens || config.oauth?.tokens;
    
    if (!tokens) {
      return { success: false, strategy: this.name, error: 'No tokens' };
    }
    
    try {
      await chrome.scripting.executeScript({
        target: { tabId: context.tabId },
        func: (tokenData) => {
          if (tokenData.accessToken) {
            localStorage.setItem('access_token', tokenData.accessToken);
            localStorage.setItem('token', tokenData.accessToken);
          }
          if (tokenData.refreshToken) {
            localStorage.setItem('refresh_token', tokenData.refreshToken);
          }
          if (tokenData.idToken) {
            localStorage.setItem('id_token', tokenData.idToken);
          }
          if (tokenData.expiresAt) {
            localStorage.setItem('token_expires_at', String(tokenData.expiresAt));
          }
          localStorage.setItem('auth', JSON.stringify(tokenData));
        },
        args: [tokens]
      });
      
      return {
        success: true,
        strategy: this.name,
        type: 'token_injection',
        needsReload: true
      };
    } catch (error) {
      return { success: false, strategy: this.name, error: error.message };
    }
  }
  
  /**
   * Inject cookies
   */
  async injectCookies(targetUrl, cookies) {
    const domain = new URL(targetUrl).hostname;
    const isHttps = targetUrl.startsWith('https');
    let setCount = 0;
    
    for (const cookie of cookies) {
      try {
        const protocol = isHttps ? 'https' : 'http';
        const cleanDomain = cookie.domain?.startsWith('.') 
          ? cookie.domain.substring(1) 
          : (cookie.domain || domain);
        
        await chrome.cookies.set({
          url: `${protocol}://${cleanDomain}/`,
          name: cookie.name,
          value: cookie.value,
          domain: cookie.domain,
          path: cookie.path || '/',
          secure: cookie.secure !== false,
          httpOnly: cookie.httpOnly || false,
          sameSite: cookie.sameSite || 'lax',
          expirationDate: cookie.expirationDate || (Date.now() / 1000 + 86400 * 30)
        });
        setCount++;
      } catch (e) {
        this.logError(`Failed to set cookie: ${cookie.name}`, e);
      }
    }
    
    return { success: setCount > 0, set: setCount, total: cookies.length };
  }
  
  /**
   * Inject storage data
   */
  async injectStorage(tabId, data, storageType) {
    try {
      const results = await chrome.scripting.executeScript({
        target: { tabId },
        func: (storageData, type) => {
          const storage = type === 'sessionStorage' ? sessionStorage : localStorage;
          let setCount = 0;
          for (const [key, value] of Object.entries(storageData)) {
            storage.setItem(key, typeof value === 'string' ? value : JSON.stringify(value));
            setCount++;
          }
          return { success: true, set: setCount };
        },
        args: [data, storageType]
      });
      return results[0]?.result || { success: false };
    } catch (e) {
      return { success: false, error: e.message };
    }
  }
  
  /**
   * Wait for tab to finish loading
   */
  waitForTabLoad(tabId, timeout = 10000) {
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
   * Detect available SSO providers on page
   */
  async detectProviders(tabId) {
    try {
      const results = await chrome.scripting.executeScript({
        target: { tabId },
        func: (providers) => {
          const found = [];
          
          for (const [name, selectors] of Object.entries(providers)) {
            for (const selector of selectors) {
              try {
                const el = document.querySelector(selector);
                if (el && el.offsetParent !== null) {
                  found.push({
                    provider: name,
                    selector,
                    text: el.textContent?.trim()
                  });
                  break;
                }
              } catch (e) {
                // Invalid selector
              }
            }
          }
          
          return found;
        },
        args: [this.providerSelectors]
      });
      
      return results[0]?.result || [];
    } catch (error) {
      return [];
    }
  }
}

export default SSOStrategy;
