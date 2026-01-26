/**
 * Form Strategy
 * Handles form-based auto-fill and submit authentication
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
   * Execute form auto-fill and submit
   */
  async execute(config, context) {
    if (!context.tabId) {
      return {
        success: false,
        strategy: this.name,
        error: 'No tab ID provided - form fill requires an open tab'
      };
    }
    
    this.log('Executing form auto-fill', { tabId: context.tabId, domain: config.domain });
    
    // Merge custom selectors with generic ones
    const selectors = this.mergeSelectors(config.selectors);
    
    try {
      // Execute form fill script in page context
      const results = await chrome.scripting.executeScript({
        target: { tabId: context.tabId },
        func: this.formFillScript,
        args: [{
          username: config.formData.username,
          password: config.formData.password,
          selectors,
          autoSubmit: config.options?.autoSubmit !== false,
          rememberMe: config.options?.rememberMe !== false
        }]
      });
      
      const result = results[0]?.result;
      
      if (!result) {
        throw new Error('No result from content script');
      }
      
      this.log('Form fill result', result);
      
      return {
        success: result.success,
        strategy: this.name,
        ...result,
        needsReload: false // Form submit handles navigation
      };
    } catch (error) {
      this.logError('Form fill failed', error);
      
      return {
        success: false,
        strategy: this.name,
        error: error.message
      };
    }
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
