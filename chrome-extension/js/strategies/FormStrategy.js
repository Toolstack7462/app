/**
 * Form Strategy
 * Handles form-based auto-fill and submit authentication
 * 
 * INVISIBLE LOGIN: Login happens in a hidden background tab.
 * Client lands DIRECTLY on postLoginUrl after successful auth.
 */
import { BaseStrategy } from './BaseStrategy.js';
import { GENERIC_FORM_SELECTORS } from '../config/toolConfigs.js';

export class FormStrategy extends BaseStrategy {
  constructor() {
    super('Form');
  }
  
  /**
   * Check if this strategy can handle the config
   */
  canHandle(config) {
    return config.formData && 
           config.formData.username && 
           config.formData.password;
  }
  
  /**
   * Execute INVISIBLE form login in a background tab
   * Client's active tab goes directly to postLoginUrl/targetUrl
   */
  async execute(config, context) {
    this.log('Executing INVISIBLE form login', { 
      domain: config.domain,
      loginUrl: config.loginUrl,
      targetUrl: config.targetUrl
    });
    
    const loginUrl = config.loginUrl || config.targetUrl;
    const postLoginUrl = config.targetUrl;
    const selectors = this.mergeSelectors(config.selectors);
    const successCheck = config.successCheck || {};
    
    try {
      // Step 1: Check if already logged in by testing targetUrl
      const isLoggedIn = await this.checkAlreadyLoggedIn(postLoginUrl, successCheck);
      if (isLoggedIn) {
        this.log('Already logged in, skipping form login');
        return {
          success: true,
          strategy: this.name,
          alreadyLoggedIn: true,
          redirectTo: postLoginUrl,
          needsReload: false
        };
      }
      
      // Step 2: Create a HIDDEN background tab for login
      const hiddenTab = await this.createHiddenTab(loginUrl);
      
      if (!hiddenTab) {
        throw new Error('Failed to create hidden tab for login');
      }
      
      this.log('Created hidden tab for login', { tabId: hiddenTab.id });
      
      // Step 3: Wait for login page to load
      await this.waitForTabLoad(hiddenTab.id, 10000);
      
      // Step 4: Execute form fill in hidden tab
      const fillResult = await this.executeFormFill(hiddenTab.id, {
        username: config.formData.username,
        password: config.formData.password,
        selectors,
        autoSubmit: config.options?.autoSubmit !== false,
        rememberMe: config.options?.rememberMe !== false
      });
      
      if (!fillResult.success) {
        await chrome.tabs.remove(hiddenTab.id).catch(() => {});
        return {
          success: false,
          strategy: this.name,
          error: fillResult.error || 'Form fill failed in hidden tab',
          details: fillResult
        };
      }
      
      // Step 5: Wait for successful login (navigation or success check)
      const loginSuccess = await this.waitForLoginSuccess(hiddenTab.id, successCheck, postLoginUrl, 15000);
      
      // Step 6: Close hidden tab
      await chrome.tabs.remove(hiddenTab.id).catch(() => {});
      
      if (loginSuccess) {
        this.log('Login successful in hidden tab');
        return {
          success: true,
          strategy: this.name,
          redirectTo: postLoginUrl,
          needsReload: false,
          invisible: true
        };
      } else {
        return {
          success: false,
          strategy: this.name,
          error: 'Login did not complete successfully'
        };
      }
    } catch (error) {
      this.logError('Invisible form login failed', error);
      return {
        success: false,
        strategy: this.name,
        error: error.message
      };
    }
  }
  
  /**
   * Check if user is already logged in
   */
  async checkAlreadyLoggedIn(targetUrl, successCheck) {
    try {
      // Create a temporary hidden tab to check login status
      const checkTab = await chrome.tabs.create({
        url: targetUrl,
        active: false,
        pinned: false
      });
      
      // Minimize by moving to background window if possible
      try {
        await chrome.windows.update(checkTab.windowId, { focused: false });
      } catch (e) {
        // Ignore - not critical
      }
      
      await this.waitForTabLoad(checkTab.id, 8000);
      
      // Check if we're on a login page or the actual target
      const result = await chrome.scripting.executeScript({
        target: { tabId: checkTab.id },
        func: (checks) => {
          const url = window.location.href;
          
          // If redirected to login page, not logged in
          if (/\/(login|signin|sign-in|auth)\b/i.test(url)) {
            return { loggedIn: false, reason: 'redirected_to_login' };
          }
          
          // Check URL excludes (e.g., /login should NOT be in URL if logged in)
          if (checks.urlExcludes && url.includes(checks.urlExcludes)) {
            return { loggedIn: false, reason: 'url_excludes_match' };
          }
          
          // Check URL includes
          if (checks.urlIncludes && !url.includes(checks.urlIncludes)) {
            return { loggedIn: false, reason: 'url_includes_not_match' };
          }
          
          // Check element exists (logged-in indicator)
          if (checks.elementExists) {
            const el = document.querySelector(checks.elementExists);
            if (!el || el.offsetParent === null) {
              return { loggedIn: false, reason: 'element_not_found' };
            }
          }
          
          // Check element NOT exists (login form should not exist)
          if (checks.elementNotExists) {
            const el = document.querySelector(checks.elementNotExists);
            if (el && el.offsetParent !== null) {
              return { loggedIn: false, reason: 'login_element_exists' };
            }
          }
          
          // Check for password field (indicates login page)
          const hasPasswordField = document.querySelector('input[type="password"]');
          if (hasPasswordField && hasPasswordField.offsetParent !== null) {
            return { loggedIn: false, reason: 'password_field_visible' };
          }
          
          return { loggedIn: true };
        },
        args: [successCheck]
      });
      
      await chrome.tabs.remove(checkTab.id).catch(() => {});
      
      return result[0]?.result?.loggedIn || false;
    } catch (error) {
      this.logError('Check already logged in failed', error);
      return false;
    }
  }
  
  /**
   * Create a hidden tab for invisible login
   */
  async createHiddenTab(url) {
    try {
      const tab = await chrome.tabs.create({
        url: url,
        active: false,  // NOT active - hidden from user
        pinned: false
      });
      
      return tab;
    } catch (error) {
      this.logError('Failed to create hidden tab', error);
      return null;
    }
  }
  
  /**
   * Execute form fill in a specific tab
   */
  async executeFormFill(tabId, options) {
    try {
      const results = await chrome.scripting.executeScript({
        target: { tabId },
        func: this.formFillScript,
        args: [options]
      });
      
      return results[0]?.result || { success: false, error: 'No result' };
    } catch (error) {
      return { success: false, error: error.message };
    }
  }
  
  /**
   * Wait for login success after form submit
   */
  async waitForLoginSuccess(tabId, successCheck, targetUrl, timeout = 15000) {
    const startTime = Date.now();
    
    while (Date.now() - startTime < timeout) {
      try {
        const tab = await chrome.tabs.get(tabId);
        const currentUrl = tab.url || '';
        
        // Check if navigated away from login page
        const isStillOnLogin = /\/(login|signin|sign-in|auth)\b/i.test(currentUrl);
        
        // Check success conditions
        if (!isStillOnLogin) {
          // Verify with success check if provided
          if (successCheck.urlIncludes && !currentUrl.includes(successCheck.urlIncludes)) {
            // URL check failed, continue waiting
          } else if (successCheck.urlExcludes && currentUrl.includes(successCheck.urlExcludes)) {
            // Still on excluded URL, continue waiting
          } else {
            // Success!
            return true;
          }
        }
        
        // If reached target URL, success
        if (targetUrl && currentUrl.includes(new URL(targetUrl).hostname)) {
          if (!isStillOnLogin) {
            return true;
          }
        }
        
      } catch (error) {
        // Tab might have been closed or navigated
        if (error.message.includes('No tab with id')) {
          return false;
        }
      }
      
      await new Promise(resolve => setTimeout(resolve, 500));
    }
    
    return false;
  }
  
  /**
   * Wait for tab to finish loading
   */
  waitForTabLoad(tabId, timeout = 10000) {
    return new Promise((resolve, reject) => {
      const startTime = Date.now();
      
      const checkTab = async () => {
        try {
          const tab = await chrome.tabs.get(tabId);
          
          if (tab.status === 'complete') {
            resolve(tab);
          } else if (Date.now() - startTime > timeout) {
            resolve(tab); // Resolve anyway after timeout
          } else {
            setTimeout(checkTab, 100);
          }
        } catch (error) {
          reject(error);
        }
      };
      
      checkTab();
    });
  }
  
  /**
   * Merge custom selectors with generic fallbacks
   */
  mergeSelectors(customSelectors = {}) {
    return {
      username: [
        ...(customSelectors.username ? [customSelectors.username] : []),
        ...GENERIC_FORM_SELECTORS.username
      ],
      password: [
        ...(customSelectors.password ? [customSelectors.password] : []),
        ...GENERIC_FORM_SELECTORS.password
      ],
      submit: [
        ...(customSelectors.submit ? [customSelectors.submit] : []),
        ...GENERIC_FORM_SELECTORS.submit
      ],
      rememberMe: [
        ...(customSelectors.rememberMe ? [customSelectors.rememberMe] : []),
        ...GENERIC_FORM_SELECTORS.rememberMe
      ]
    };
  }
  
  /**
   * Form fill script (runs in page context)
   */
  formFillScript(options) {
    const { username, password, selectors, autoSubmit, rememberMe } = options;
    
    const result = {
      success: false,
      usernameField: null,
      passwordField: null,
      submitButton: null,
      submitted: false,
      errors: []
    };
    
    // Helper to find element by selector list
    const findElement = (selectorList) => {
      for (const selector of selectorList) {
        try {
          // Handle :contains pseudo-selector
          if (selector.includes(':contains(')) {
            const match = selector.match(/(.+):contains\(["'](.+)["']\)/);
            if (match) {
              const baseSelector = match[1];
              const text = match[2];
              const elements = document.querySelectorAll(baseSelector);
              for (const el of elements) {
                if (el.textContent.includes(text)) {
                  return el;
                }
              }
            }
            continue;
          }
          
          const el = document.querySelector(selector);
          if (el && el.offsetParent !== null) { // Check if visible
            return el;
          }
        } catch (e) {
          // Invalid selector, continue
        }
      }
      return null;
    };
    
    // Helper to set input value with proper events
    const setInputValue = (input, value) => {
      // Focus the input
      input.focus();
      
      // Clear existing value
      input.value = '';
      
      // Set new value
      input.value = value;
      
      // Dispatch events that frameworks listen for
      input.dispatchEvent(new Event('input', { bubbles: true }));
      input.dispatchEvent(new Event('change', { bubbles: true }));
      
      // For React controlled inputs
      const nativeInputValueSetter = Object.getOwnPropertyDescriptor(
        window.HTMLInputElement.prototype, 'value'
      ).set;
      nativeInputValueSetter.call(input, value);
      input.dispatchEvent(new Event('input', { bubbles: true }));
    };
    
    // Find username field
    const usernameField = findElement(selectors.username);
    if (!usernameField) {
      result.errors.push('Username field not found');
    } else {
      result.usernameField = usernameField.name || usernameField.id || 'found';
      try {
        setInputValue(usernameField, username);
      } catch (e) {
        result.errors.push(`Failed to set username: ${e.message}`);
      }
    }
    
    // Find password field
    const passwordField = findElement(selectors.password);
    if (!passwordField) {
      result.errors.push('Password field not found');
    } else {
      result.passwordField = passwordField.name || passwordField.id || 'found';
      try {
        setInputValue(passwordField, password);
      } catch (e) {
        result.errors.push(`Failed to set password: ${e.message}`);
      }
    }
    
    // Handle remember me checkbox
    if (rememberMe) {
      const rememberMeCheckbox = findElement(selectors.rememberMe);
      if (rememberMeCheckbox && !rememberMeCheckbox.checked) {
        rememberMeCheckbox.click();
      }
    }
    
    // Find and click submit button
    if (autoSubmit && usernameField && passwordField) {
      // Small delay to allow frameworks to process input
      setTimeout(() => {
        const submitButton = findElement(selectors.submit);
        if (submitButton) {
          result.submitButton = submitButton.textContent?.trim() || 'found';
          submitButton.click();
          result.submitted = true;
        } else {
          // Try submitting the form directly
          const form = usernameField.closest('form') || passwordField.closest('form');
          if (form) {
            form.submit();
            result.submitted = true;
            result.submitButton = 'form.submit()';
          } else {
            result.errors.push('Submit button/form not found');
          }
        }
      }, 100);
    }
    
    result.success = usernameField && passwordField && result.errors.length === 0;
    
    return result;
  }
  
  /**
   * Detect if current page is a login page
   */
  async detectLoginPage(tabId) {
    try {
      const results = await chrome.scripting.executeScript({
        target: { tabId },
        func: () => {
          // Check URL patterns
          const url = window.location.href.toLowerCase();
          const loginUrlPatterns = [
            /\/login/i, /\/signin/i, /\/sign-in/i, /\/auth/i,
            /\/authenticate/i, /\/session\/new/i
          ];
          const isLoginUrl = loginUrlPatterns.some(p => p.test(url));
          
          // Check for password field
          const hasPasswordField = !!document.querySelector('input[type="password"]');
          
          // Check for login form indicators
          const formIndicators = [
            'form[action*="login"]', 'form[action*="signin"]',
            'form[id*="login"]', 'form[class*="login"]',
            '#login-form', '.login-form'
          ];
          const hasLoginForm = formIndicators.some(s => document.querySelector(s));
          
          return {
            isLoginPage: isLoginUrl || (hasPasswordField && (hasLoginForm || isLoginUrl)),
            hasPasswordField,
            hasLoginForm,
            url
          };
        }
      });
      
      return results[0]?.result || { isLoginPage: false };
    } catch (error) {
      this.logError('Login page detection failed', error);
      return { isLoginPage: false, error: error.message };
    }
  }
  
  /**
   * Wait for login form to appear (for SPAs)
   */
  async waitForLoginForm(tabId, timeout = 5000) {
    const startTime = Date.now();
    
    while (Date.now() - startTime < timeout) {
      const detection = await this.detectLoginPage(tabId);
      if (detection.hasPasswordField) {
        return detection;
      }
      await new Promise(resolve => setTimeout(resolve, 500));
    }
    
    return { isLoginPage: false, timeout: true };
  }
}

export default FormStrategy;
