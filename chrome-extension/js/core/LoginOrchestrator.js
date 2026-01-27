/**
 * Login Orchestrator - Unified Login Flow Controller
 * 
 * This is the BRAIN of the auto-login system.
 * It manages the entire login lifecycle with:
 * - Pre-login success detection (already logged in?)
 * - Ordered strategy execution with fallbacks
 * - Robust retry logic with exponential backoff
 * - MFA detection and user notification
 * - Comprehensive diagnostics without exposing secrets
 * 
 * Flow:
 * 1. Check if already logged in → success → done
 * 2. Try session injection (cookies/storage/token) → check success
 * 3. Try form login (if configured) → check success
 * 4. Try SSO (if configured) → check success
 * 5. If all fail → return actionable error
 */

import { Logger } from './Logger.js';
import { SuccessDetector } from './SuccessDetector.js';

// Orchestrator configuration
const ORCHESTRATOR_CONFIG = {
  maxRetries: 3,
  retryDelayMs: 1000,
  backoffMultiplier: 1.5,
  maxRetryDelay: 8000,
  successCheckDelayMs: 1500,
  pageLoadTimeoutMs: 15000,
  formFillDelayMs: 500,
  postSubmitWaitMs: 3000
};

// Login method priorities (order of execution)
const METHOD_PRIORITY = [
  'session',    // Cookies + Storage injection (fastest, invisible)
  'form',       // Form fill and submit
  'sso'         // SSO/OAuth redirect flow
];

/**
 * Login Orchestrator Class
 */
export class LoginOrchestrator {
  constructor() {
    this.logger = new Logger('Orchestrator');
    this.successDetector = new SuccessDetector();
    this.activeFlows = new Map();
    this.flowResults = new Map();
  }

  /**
   * Execute one-click login for a tool
   * This is the main entry point
   * 
   * @param {Object} tool - Tool configuration
   * @param {Object} credentials - Credentials from API
   * @param {Object} options - Additional options
   * @returns {Promise<Object>} Login result
   */
  async executeLogin(tool, credentials, options = {}) {
    const flowId = `${tool.id}_${Date.now()}`;
    
    this.logger.info('Starting login flow', { 
      flowId, 
      tool: tool.name, 
      credentialType: credentials?.type,
      targetUrl: tool.targetUrl 
    });

    // Track active flow
    this.activeFlows.set(flowId, {
      tool,
      credentials,
      startTime: Date.now(),
      status: 'starting'
    });

    const result = {
      success: false,
      flowId,
      tool: tool.name,
      method: null,
      attempts: 0,
      errors: [],
      finalUrl: null,
      tabId: null,
      requiresManualAction: false,
      manualActionReason: null
    };

    try {
      // STEP 1: Check if already logged in
      this.logger.debug('Step 1: Checking if already logged in');
      const alreadyLoggedIn = await this.checkAlreadyLoggedIn(tool, credentials);
      
      if (alreadyLoggedIn.success) {
        this.logger.info('Already logged in, opening target URL');
        const tab = await chrome.tabs.create({ url: tool.targetUrl, active: true });
        
        result.success = true;
        result.method = 'already_logged_in';
        result.tabId = tab.id;
        result.finalUrl = tool.targetUrl;
        
        this.completeFlow(flowId, result);
        return result;
      }

      // STEP 2: Build execution plan based on credentials
      const executionPlan = this.buildExecutionPlan(tool, credentials);
      this.logger.debug('Execution plan', { methods: executionPlan.map(m => m.method) });

      // STEP 3: Execute methods in order with retry
      for (const step of executionPlan) {
        this.updateFlowStatus(flowId, `executing_${step.method}`);
        
        const stepResult = await this.executeWithRetry(
          () => this.executeMethod(step, tool, credentials),
          step.method,
          options.maxRetries || ORCHESTRATOR_CONFIG.maxRetries
        );

        result.attempts += stepResult.attempts;

        if (stepResult.success) {
          result.success = true;
          result.method = step.method;
          result.tabId = stepResult.tabId;
          result.finalUrl = stepResult.finalUrl;
          
          this.logger.info('Login successful', { method: step.method });
          break;
        }

        if (stepResult.requiresManualAction) {
          result.requiresManualAction = true;
          result.manualActionReason = stepResult.manualActionReason;
          result.tabId = stepResult.tabId;
          
          this.logger.warn('Manual action required', { reason: stepResult.manualActionReason });
          break;
        }

        if (stepResult.error) {
          result.errors.push({
            method: step.method,
            error: stepResult.error,
            attempts: stepResult.attempts
          });
        }
      }

      // STEP 4: If all methods failed, provide actionable error
      if (!result.success && !result.requiresManualAction) {
        result.error = this.buildActionableError(result.errors, tool);
        this.logger.error('All login methods failed', { errors: result.errors });
      }

    } catch (error) {
      this.logger.error('Orchestrator error', { error: error.message });
      result.error = `Login failed: ${error.message}`;
      result.errors.push({ method: 'orchestrator', error: error.message });
    }

    this.completeFlow(flowId, result);
    return result;
  }

  /**
   * Build execution plan based on credentials type
   */
  buildExecutionPlan(tool, credentials) {
    const plan = [];
    const credType = credentials?.type;

    // Always try session injection first if we have cookies or tokens
    if (this.hasSessionData(credentials)) {
      plan.push({
        method: 'session',
        priority: 1,
        data: this.extractSessionData(credentials)
      });
    }

    // Add form login if credentials are form type
    if (credType === 'form' && credentials.payload?.username && credentials.payload?.password) {
      plan.push({
        method: 'form',
        priority: 2,
        data: {
          username: credentials.payload.username,
          password: credentials.payload.password,
          loginUrl: credentials.payload.loginUrl || credentials.loginUrl || tool.loginUrl || tool.targetUrl,
          selectors: credentials.selectors || {}
        }
      });
    }

    // Add SSO if configured
    if (credType === 'sso' && credentials.payload?.authStartUrl) {
      plan.push({
        method: 'sso',
        priority: 3,
        data: {
          authStartUrl: credentials.payload.authStartUrl,
          postLoginUrl: credentials.payload.postLoginUrl || tool.targetUrl,
          provider: credentials.payload.provider,
          autoClick: credentials.payload.autoClick,
          buttonSelector: credentials.payload.buttonSelector
        }
      });
    }

    // Sort by priority
    plan.sort((a, b) => a.priority - b.priority);

    return plan;
  }

  /**
   * Check if credentials contain session data
   */
  hasSessionData(credentials) {
    if (!credentials) return false;
    
    const type = credentials.type;
    const payload = credentials.payload;

    return (
      type === 'cookies' ||
      type === 'token' ||
      type === 'localStorage' ||
      type === 'sessionStorage' ||
      (payload?.cookies && payload.cookies.length > 0) ||
      (payload?.value) || // token value
      (type === 'sso' && payload?.sessionData) ||
      (type === 'headers' && payload?.cookies)
    );
  }

  /**
   * Extract session data from credentials
   */
  extractSessionData(credentials) {
    const data = {
      cookies: [],
      localStorage: {},
      sessionStorage: {},
      token: null
    };

    const type = credentials.type;
    const payload = credentials.payload;

    switch (type) {
      case 'cookies':
        data.cookies = Array.isArray(payload) ? payload : (payload?.cookies || []);
        break;

      case 'token':
        data.token = payload?.value;
        data.localStorage = {
          token: payload?.value,
          access_token: payload?.value,
          auth_token: payload?.value
        };
        break;

      case 'localStorage':
        data.localStorage = payload || {};
        break;

      case 'sessionStorage':
        data.sessionStorage = payload || {};
        break;

      case 'sso':
        if (payload?.sessionData) {
          data.cookies = payload.sessionData.cookies || [];
          data.localStorage = payload.sessionData.localStorage || {};
        }
        if (payload?.tokens?.accessToken) {
          data.localStorage.access_token = payload.tokens.accessToken;
          data.localStorage.token = payload.tokens.accessToken;
        }
        break;

      case 'headers':
        if (payload?.cookies) {
          data.cookies = payload.cookies;
        }
        if (payload?.value) {
          data.localStorage.auth_token = payload.value;
        }
        break;
    }

    return data;
  }

  /**
   * Execute a login method with retry logic
   */
  async executeWithRetry(fn, methodName, maxRetries) {
    let attempts = 0;
    let lastError = null;
    let delay = ORCHESTRATOR_CONFIG.retryDelayMs;

    while (attempts < maxRetries) {
      attempts++;
      this.logger.debug(`Attempt ${attempts}/${maxRetries} for ${methodName}`);

      try {
        const result = await fn();
        result.attempts = attempts;

        if (result.success || result.requiresManualAction || result.skipRetry) {
          return result;
        }

        lastError = result.error;
      } catch (error) {
        lastError = error.message;
        this.logger.warn(`${methodName} attempt ${attempts} failed`, { error: lastError });
      }

      // Wait before retry with exponential backoff
      if (attempts < maxRetries) {
        this.logger.debug(`Retrying in ${delay}ms`);
        await this.sleep(delay);
        delay = Math.min(delay * ORCHESTRATOR_CONFIG.backoffMultiplier, ORCHESTRATOR_CONFIG.maxRetryDelay);
      }
    }

    return {
      success: false,
      error: lastError || 'Max retries exceeded',
      attempts
    };
  }

  /**
   * Execute a specific login method
   */
  async executeMethod(step, tool, credentials) {
    switch (step.method) {
      case 'session':
        return this.executeSessionInjection(step.data, tool, credentials);
      case 'form':
        return this.executeFormLogin(step.data, tool, credentials);
      case 'sso':
        return this.executeSSOLogin(step.data, tool, credentials);
      default:
        return { success: false, error: `Unknown method: ${step.method}` };
    }
  }

  /**
   * Execute session injection (cookies + storage)
   */
  async executeSessionInjection(data, tool, credentials) {
    this.logger.info('Executing session injection');

    const results = {
      cookies: { success: false, count: 0 },
      localStorage: { success: false, count: 0 },
      sessionStorage: { success: false, count: 0 }
    };

    // Inject cookies BEFORE opening any tab
    if (data.cookies && data.cookies.length > 0) {
      this.logger.debug('Injecting cookies', { count: data.cookies.length });
      results.cookies = await this.injectCookies(tool.targetUrl, data.cookies);
    }

    // Open hidden tab for storage injection
    let hiddenTab = null;
    const hasStorageData = Object.keys(data.localStorage).length > 0 || 
                          Object.keys(data.sessionStorage).length > 0;

    if (hasStorageData) {
      hiddenTab = await this.createHiddenTab(tool.targetUrl);
      
      if (hiddenTab) {
        await this.waitForTabLoad(hiddenTab.id);

        // Inject localStorage
        if (Object.keys(data.localStorage).length > 0) {
          this.logger.debug('Injecting localStorage', { keys: Object.keys(data.localStorage).length });
          results.localStorage = await this.injectStorage(hiddenTab.id, 'localStorage', data.localStorage);
        }

        // Inject sessionStorage
        if (Object.keys(data.sessionStorage).length > 0) {
          this.logger.debug('Injecting sessionStorage', { keys: Object.keys(data.sessionStorage).length });
          results.sessionStorage = await this.injectStorage(hiddenTab.id, 'sessionStorage', data.sessionStorage);
        }

        // Reload to apply storage
        await chrome.tabs.reload(hiddenTab.id);
        await this.waitForTabLoad(hiddenTab.id);
      }
    }

    // Check if injection was successful
    const anySuccess = results.cookies.success || results.localStorage.success || results.sessionStorage.success;

    if (!anySuccess) {
      if (hiddenTab) {
        await chrome.tabs.remove(hiddenTab.id).catch(() => {});
      }
      return { success: false, error: 'Session injection failed' };
    }

    // Verify login success
    const checkTabId = hiddenTab?.id;
    let success = false;
    let finalUrl = tool.targetUrl;

    if (checkTabId) {
      // Wait a bit for session to take effect
      await this.sleep(ORCHESTRATOR_CONFIG.successCheckDelayMs);

      // Check if we're logged in
      const loginCheck = await this.successDetector.checkLoginSuccess(
        checkTabId, 
        tool, 
        credentials?.successCheck
      );

      success = loginCheck.success;
      finalUrl = loginCheck.currentUrl || finalUrl;

      if (success) {
        // Make tab visible and active
        await chrome.tabs.update(checkTabId, { active: true });
        return {
          success: true,
          tabId: checkTabId,
          finalUrl,
          method: 'session'
        };
      } else {
        // Close hidden tab, session didn't work
        await chrome.tabs.remove(checkTabId).catch(() => {});
      }
    } else if (results.cookies.success) {
      // Only cookies were injected, open new tab to verify
      const verifyTab = await chrome.tabs.create({ url: tool.targetUrl, active: false });
      await this.waitForTabLoad(verifyTab.id);
      await this.sleep(ORCHESTRATOR_CONFIG.successCheckDelayMs);

      const loginCheck = await this.successDetector.checkLoginSuccess(
        verifyTab.id, 
        tool, 
        credentials?.successCheck
      );

      if (loginCheck.success) {
        await chrome.tabs.update(verifyTab.id, { active: true });
        return {
          success: true,
          tabId: verifyTab.id,
          finalUrl: loginCheck.currentUrl || tool.targetUrl,
          method: 'session'
        };
      } else {
        await chrome.tabs.remove(verifyTab.id).catch(() => {});
      }
    }

    return { success: false, error: 'Session injection did not result in logged-in state' };
  }

  /**
   * Execute form login
   */
  async executeFormLogin(data, tool, credentials) {
    this.logger.info('Executing form login', { loginUrl: data.loginUrl });

    // Create hidden tab for login
    const hiddenTab = await this.createHiddenTab(data.loginUrl);
    if (!hiddenTab) {
      return { success: false, error: 'Failed to create login tab' };
    }

    try {
      // Wait for page and form to load
      await this.waitForTabLoad(hiddenTab.id);
      await this.sleep(ORCHESTRATOR_CONFIG.formFillDelayMs);

      // Wait for login form to appear (handles SPA rendering)
      const formReady = await this.waitForLoginForm(hiddenTab.id, 8000);
      
      if (!formReady.hasForm) {
        // Check if we're already logged in
        const alreadyIn = await this.successDetector.checkLoginSuccess(
          hiddenTab.id, tool, credentials?.successCheck
        );
        
        if (alreadyIn.success) {
          await chrome.tabs.update(hiddenTab.id, { active: true });
          return {
            success: true,
            tabId: hiddenTab.id,
            finalUrl: alreadyIn.currentUrl,
            method: 'form',
            note: 'Already logged in'
          };
        }
        
        await chrome.tabs.remove(hiddenTab.id).catch(() => {});
        return { success: false, error: 'Login form not found' };
      }

      // Check for MFA/2FA field
      if (formReady.hasMFA) {
        await chrome.tabs.update(hiddenTab.id, { active: true });
        return {
          success: false,
          requiresManualAction: true,
          manualActionReason: 'MFA/2FA detected - please complete authentication manually',
          tabId: hiddenTab.id,
          skipRetry: true
        };
      }

      // Execute form fill (handles multi-step if needed)
      const fillResult = await this.executeFormFill(hiddenTab.id, data, credentials?.selectors);

      if (!fillResult.success) {
        await chrome.tabs.remove(hiddenTab.id).catch(() => {});
        return { success: false, error: fillResult.error || 'Form fill failed' };
      }

      // Wait for login to process
      await this.sleep(ORCHESTRATOR_CONFIG.postSubmitWaitMs);

      // Monitor for success or error
      const loginResult = await this.monitorLoginResult(
        hiddenTab.id, 
        tool, 
        credentials?.successCheck,
        15000
      );

      if (loginResult.success) {
        await chrome.tabs.update(hiddenTab.id, { active: true });
        return {
          success: true,
          tabId: hiddenTab.id,
          finalUrl: loginResult.currentUrl,
          method: 'form'
        };
      }

      if (loginResult.hasMFA) {
        await chrome.tabs.update(hiddenTab.id, { active: true });
        return {
          success: false,
          requiresManualAction: true,
          manualActionReason: 'MFA/2FA required - please complete authentication',
          tabId: hiddenTab.id,
          skipRetry: true
        };
      }

      if (loginResult.hasError) {
        await chrome.tabs.remove(hiddenTab.id).catch(() => {});
        return { 
          success: false, 
          error: loginResult.errorMessage || 'Login failed - invalid credentials?'
        };
      }

      await chrome.tabs.remove(hiddenTab.id).catch(() => {});
      return { success: false, error: 'Login did not complete successfully' };

    } catch (error) {
      await chrome.tabs.remove(hiddenTab.id).catch(() => {});
      throw error;
    }
  }

  /**
   * Execute SSO login
   */
  async executeSSOLogin(data, tool, credentials) {
    this.logger.info('Executing SSO login', { 
      provider: data.provider,
      authStartUrl: data.authStartUrl 
    });

    // Create visible tab for SSO (user may need to interact)
    const ssoTab = await chrome.tabs.create({ 
      url: data.authStartUrl, 
      active: true  // SSO often needs user visibility
    });

    try {
      await this.waitForTabLoad(ssoTab.id);
      await this.sleep(1000);

      // Try to click provider button if autoClick is enabled
      if (data.autoClick && data.provider) {
        const clickResult = await this.clickSSOProvider(ssoTab.id, data.provider, data.buttonSelector);
        if (clickResult.clicked) {
          this.logger.debug('Clicked SSO provider button');
        }
      }

      // Check for account chooser
      const accountChooser = await this.detectAccountChooser(ssoTab.id);
      if (accountChooser.detected) {
        return {
          success: false,
          requiresManualAction: true,
          manualActionReason: 'Account selection required - please choose an account',
          tabId: ssoTab.id,
          skipRetry: true
        };
      }

      // Monitor for redirect to post-login URL
      const ssoResult = await this.monitorSSOCompletion(
        ssoTab.id,
        data.postLoginUrl,
        tool,
        credentials?.successCheck,
        30000
      );

      if (ssoResult.success) {
        return {
          success: true,
          tabId: ssoTab.id,
          finalUrl: ssoResult.currentUrl,
          method: 'sso'
        };
      }

      if (ssoResult.requiresManualAction) {
        return {
          success: false,
          requiresManualAction: true,
          manualActionReason: ssoResult.reason || 'SSO requires manual completion',
          tabId: ssoTab.id,
          skipRetry: true
        };
      }

      // SSO failed
      await chrome.tabs.remove(ssoTab.id).catch(() => {});
      return { success: false, error: ssoResult.error || 'SSO authentication failed' };

    } catch (error) {
      await chrome.tabs.remove(ssoTab.id).catch(() => {});
      throw error;
    }
  }

  /**
   * Check if already logged in by testing the target URL
   */
  async checkAlreadyLoggedIn(tool, credentials) {
    try {
      const hiddenTab = await this.createHiddenTab(tool.targetUrl);
      if (!hiddenTab) {
        return { success: false };
      }

      await this.waitForTabLoad(hiddenTab.id);
      await this.sleep(1000);

      const result = await this.successDetector.checkLoginSuccess(
        hiddenTab.id,
        tool,
        credentials?.successCheck
      );

      await chrome.tabs.remove(hiddenTab.id).catch(() => {});

      return result;
    } catch (error) {
      this.logger.warn('Already logged in check failed', { error: error.message });
      return { success: false };
    }
  }

  /**
   * Inject cookies with proper normalization
   */
  async injectCookies(targetUrl, cookies) {
    if (!cookies || cookies.length === 0) {
      return { success: false, count: 0 };
    }

    const domain = new URL(targetUrl).hostname;
    const isHttps = targetUrl.startsWith('https');
    let successCount = 0;
    const errors = [];

    for (const cookie of cookies) {
      try {
        // Normalize cookie domain
        let cookieDomain = cookie.domain || domain;
        
        // Ensure leading dot for subdomain cookies
        if (cookieDomain && !cookieDomain.startsWith('.') && cookieDomain !== domain) {
          cookieDomain = '.' + cookieDomain;
        }

        // Normalize sameSite
        let sameSite = (cookie.sameSite || 'lax').toLowerCase();
        if (sameSite === 'none' || sameSite === 'no_restriction') {
          sameSite = 'no_restriction';
        } else if (sameSite === 'strict') {
          sameSite = 'strict';
        } else {
          sameSite = 'lax';
        }

        // SameSite=None requires Secure
        const secure = sameSite === 'no_restriction' ? true : (cookie.secure !== false && isHttps);

        // Build cookie URL
        const protocol = secure ? 'https' : 'http';
        const cleanDomain = cookieDomain.startsWith('.') ? cookieDomain.substring(1) : cookieDomain;
        const cookieUrl = `${protocol}://${cleanDomain}${cookie.path || '/'}`;

        const cookieDetails = {
          url: cookieUrl,
          name: cookie.name,
          value: cookie.value,
          path: cookie.path || '/',
          secure,
          httpOnly: cookie.httpOnly === true,
          sameSite
        };

        // Set domain for subdomain cookies
        if (cookieDomain.startsWith('.')) {
          cookieDetails.domain = cookieDomain;
        }

        // Handle expiration
        if (cookie.expirationDate) {
          cookieDetails.expirationDate = cookie.expirationDate;
        } else if (cookie.expires) {
          const expiresDate = new Date(cookie.expires);
          if (!isNaN(expiresDate.getTime())) {
            cookieDetails.expirationDate = expiresDate.getTime() / 1000;
          }
        } else {
          // Default: 30 days
          cookieDetails.expirationDate = Math.floor(Date.now() / 1000) + (30 * 24 * 60 * 60);
        }

        const result = await chrome.cookies.set(cookieDetails);
        if (result) {
          successCount++;
        }
      } catch (error) {
        errors.push({ name: cookie.name, error: error.message });
      }
    }

    this.logger.debug('Cookie injection result', { 
      success: successCount, 
      total: cookies.length, 
      errors: errors.length 
    });

    return {
      success: successCount > 0,
      count: successCount,
      total: cookies.length,
      errors
    };
  }

  /**
   * Inject storage data into a tab
   */
  async injectStorage(tabId, storageType, data) {
    if (!data || Object.keys(data).length === 0) {
      return { success: false, count: 0 };
    }

    try {
      const results = await chrome.scripting.executeScript({
        target: { tabId },
        func: (storageData, type) => {
          const storage = type === 'sessionStorage' ? sessionStorage : localStorage;
          let count = 0;
          const errors = [];

          for (const [key, value] of Object.entries(storageData)) {
            try {
              const valueStr = typeof value === 'string' ? value : JSON.stringify(value);
              storage.setItem(key, valueStr);
              count++;
            } catch (e) {
              errors.push({ key, error: e.message });
            }
          }

          return { success: count > 0, count, errors };
        },
        args: [data, storageType]
      });

      return results[0]?.result || { success: false, count: 0 };
    } catch (error) {
      this.logger.warn('Storage injection failed', { error: error.message });
      return { success: false, count: 0, error: error.message };
    }
  }

  /**
   * Wait for login form to appear (handles SPA)
   */
  async waitForLoginForm(tabId, timeout = 8000) {
    const startTime = Date.now();

    while (Date.now() - startTime < timeout) {
      try {
        const results = await chrome.scripting.executeScript({
          target: { tabId },
          func: () => {
            // Check main document
            const checkDocument = (doc) => {
              const passwordField = doc.querySelector('input[type="password"]');
              const hasPassword = passwordField && passwordField.offsetParent !== null;

              // Check for MFA fields
              const mfaSelectors = [
                'input[name*="otp"]', 'input[name*="code"]', 'input[name*="2fa"]',
                'input[name*="totp"]', 'input[name*="mfa"]', 'input[id*="otp"]',
                'input[placeholder*="code" i]', 'input[placeholder*="authenticator" i]',
                '[class*="mfa"]', '[class*="two-factor"]', '[class*="2fa"]'
              ];
              const hasMFA = mfaSelectors.some(s => {
                const el = doc.querySelector(s);
                return el && el.offsetParent !== null;
              });

              return { hasPassword, hasMFA };
            };

            // Check main document
            let result = checkDocument(document);

            // Check same-origin iframes
            if (!result.hasPassword) {
              const iframes = document.querySelectorAll('iframe');
              for (const iframe of iframes) {
                try {
                  if (iframe.contentDocument) {
                    const iframeResult = checkDocument(iframe.contentDocument);
                    if (iframeResult.hasPassword) {
                      result = { ...iframeResult, inIframe: true };
                      break;
                    }
                  }
                } catch (e) {
                  // Cross-origin iframe, skip
                }
              }
            }

            return {
              hasForm: result.hasPassword,
              hasMFA: result.hasMFA,
              inIframe: result.inIframe || false
            };
          }
        });

        const result = results[0]?.result;
        if (result?.hasForm || result?.hasMFA) {
          return result;
        }
      } catch (error) {
        // Tab might have navigated
      }

      await this.sleep(300);
    }

    return { hasForm: false, hasMFA: false };
  }

  /**
   * Execute form fill with multi-step support
   */
  async executeFormFill(tabId, data, customSelectors = {}) {
    try {
      const results = await chrome.scripting.executeScript({
        target: { tabId },
        func: this.formFillScript,
        args: [data.username, data.password, customSelectors]
      });

      return results[0]?.result || { success: false, error: 'No result' };
    } catch (error) {
      return { success: false, error: error.message };
    }
  }

  /**
   * Form fill script (injected into page)
   * Handles single-step and multi-step login forms
   */
  formFillScript(username, password, customSelectors) {
    const result = {
      success: false,
      steps: [],
      error: null
    };

    // Selector lists
    const usernameSelectors = [
      customSelectors?.username,
      'input[type="email"]', 'input[name="email"]', 'input[id="email"]',
      'input[name="username"]', 'input[id="username"]', 'input[name="login"]',
      'input[autocomplete="email"]', 'input[autocomplete="username"]',
      'input[placeholder*="email" i]', 'input[placeholder*="username" i]',
      'input[name="identifier"]', 'input[name="account"]'
    ].filter(Boolean);

    const passwordSelectors = [
      customSelectors?.password,
      'input[type="password"]', 'input[name="password"]', 'input[id="password"]',
      'input[autocomplete="current-password"]'
    ].filter(Boolean);

    const submitSelectors = [
      customSelectors?.submit,
      'button[type="submit"]', 'input[type="submit"]',
      'button[class*="login" i]', 'button[class*="signin" i]', 'button[class*="submit" i]',
      'button[id*="login" i]', 'button[id*="signin" i]',
      '[role="button"][class*="login" i]', '[role="button"][class*="submit" i]'
    ].filter(Boolean);

    const nextButtonSelectors = [
      'button[class*="next" i]', 'button[id*="next" i]',
      'button:not([type="submit"])[class*="continue" i]',
      'input[type="button"][value*="next" i]',
      'input[type="button"][value*="continue" i]'
    ];

    // Helper: Find visible element
    const findElement = (selectorList, doc = document) => {
      for (const selector of selectorList) {
        if (!selector) continue;
        try {
          // Check main document
          let el = doc.querySelector(selector);
          if (el && el.offsetParent !== null) return { el, inIframe: false };

          // Check iframes
          const iframes = doc.querySelectorAll('iframe');
          for (const iframe of iframes) {
            try {
              if (iframe.contentDocument) {
                el = iframe.contentDocument.querySelector(selector);
                if (el && el.offsetParent !== null) {
                  return { el, inIframe: true, iframe };
                }
              }
            } catch (e) {}
          }
        } catch (e) {}
      }
      return { el: null };
    };

    // Helper: Set input value with events
    const setInputValue = (input, value) => {
      input.focus();
      input.value = '';

      // Native setter for React
      const nativeSetter = Object.getOwnPropertyDescriptor(
        window.HTMLInputElement.prototype, 'value'
      )?.set;

      if (nativeSetter) {
        nativeSetter.call(input, value);
      } else {
        input.value = value;
      }

      // Dispatch events
      input.dispatchEvent(new Event('input', { bubbles: true }));
      input.dispatchEvent(new Event('change', { bubbles: true }));
      input.dispatchEvent(new KeyboardEvent('keyup', { bubbles: true, key: 'a' }));
    };

    // Helper: Click element
    const clickElement = (el) => {
      el.focus();
      el.click();
      el.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    };

    // STEP 1: Find and fill username
    const usernameField = findElement(usernameSelectors);
    if (!usernameField.el) {
      result.error = 'Username field not found';
      return result;
    }

    setInputValue(usernameField.el, username);
    result.steps.push({ field: 'username', success: true });

    // STEP 2: Check if password field is visible (single-step) or need to click next (multi-step)
    const passwordField = findElement(passwordSelectors);

    if (passwordField.el) {
      // Single-step login
      setInputValue(passwordField.el, password);
      result.steps.push({ field: 'password', success: true });

      // Click submit
      setTimeout(() => {
        const submitBtn = findElement(submitSelectors);
        if (submitBtn.el) {
          clickElement(submitBtn.el);
          result.steps.push({ action: 'submit', success: true });
        } else {
          // Try form submit
          const form = usernameField.el.closest('form') || passwordField.el.closest('form');
          if (form) {
            form.submit();
            result.steps.push({ action: 'form_submit', success: true });
          }
        }
      }, 200);

      result.success = true;
      result.multiStep = false;

    } else {
      // Multi-step login - click next/continue first
      const nextBtn = findElement(nextButtonSelectors);
      const submitBtn = findElement(submitSelectors);
      const clickTarget = nextBtn.el || submitBtn.el;

      if (clickTarget) {
        clickElement(clickTarget);
        result.steps.push({ action: 'next_click', success: true });
        result.multiStep = true;
        result.needsPasswordStep = true;

        // Schedule password fill after next button processes
        setTimeout(() => {
          const pwdField = findElement(passwordSelectors);
          if (pwdField.el) {
            setInputValue(pwdField.el, password);

            setTimeout(() => {
              const finalSubmit = findElement(submitSelectors);
              if (finalSubmit.el) {
                clickElement(finalSubmit.el);
              } else {
                const form = pwdField.el.closest('form');
                if (form) form.submit();
              }
            }, 200);
          }
        }, 1500);

        result.success = true;
      } else {
        result.error = 'No submit or next button found';
      }
    }

    return result;
  }

  /**
   * Monitor login result after form submission
   */
  async monitorLoginResult(tabId, tool, successCheck, timeout = 15000) {
    const startTime = Date.now();

    while (Date.now() - startTime < timeout) {
      try {
        // Check success
        const check = await this.successDetector.checkLoginSuccess(tabId, tool, successCheck);
        if (check.success) {
          return check;
        }

        // Check for MFA
        const mfaCheck = await this.checkForMFA(tabId);
        if (mfaCheck.hasMFA) {
          return { success: false, hasMFA: true };
        }

        // Check for error messages
        const errorCheck = await this.checkForLoginError(tabId);
        if (errorCheck.hasError) {
          return { 
            success: false, 
            hasError: true, 
            errorMessage: errorCheck.message 
          };
        }

      } catch (error) {
        // Tab might have navigated
      }

      await this.sleep(500);
    }

    return { success: false, error: 'Login timeout' };
  }

  /**
   * Check for MFA/2FA on page
   */
  async checkForMFA(tabId) {
    try {
      const results = await chrome.scripting.executeScript({
        target: { tabId },
        func: () => {
          const mfaIndicators = [
            'input[name*="otp"]', 'input[name*="code"]', 'input[name*="2fa"]',
            'input[name*="totp"]', 'input[name*="mfa"]', 'input[id*="otp"]',
            'input[placeholder*="code" i]', 'input[placeholder*="authenticator" i]',
            '[class*="mfa"]', '[class*="two-factor"]', '[class*="2fa"]',
            '[class*="verification"]', '[class*="verify-code"]'
          ];

          const textIndicators = [
            'verification code', 'authenticator', '2-step', 'two-factor',
            'enter code', 'security code', 'one-time'
          ];

          // Check for MFA form elements
          for (const selector of mfaIndicators) {
            const el = document.querySelector(selector);
            if (el && el.offsetParent !== null) {
              return { hasMFA: true, type: 'form_element' };
            }
          }

          // Check page text
          const bodyText = document.body.innerText.toLowerCase();
          for (const text of textIndicators) {
            if (bodyText.includes(text)) {
              return { hasMFA: true, type: 'text_indicator' };
            }
          }

          return { hasMFA: false };
        }
      });

      return results[0]?.result || { hasMFA: false };
    } catch (error) {
      return { hasMFA: false };
    }
  }

  /**
   * Check for login error messages
   */
  async checkForLoginError(tabId) {
    try {
      const results = await chrome.scripting.executeScript({
        target: { tabId },
        func: () => {
          const errorSelectors = [
            '.error', '.error-message', '.alert-danger', '.alert-error',
            '[class*="error"]', '[class*="invalid"]', '[role="alert"]',
            '[data-testid*="error"]', '.form-error', '.login-error'
          ];

          const errorTexts = [
            'invalid', 'incorrect', 'wrong', 'failed', 'error',
            'does not match', 'not found', 'try again'
          ];

          for (const selector of errorSelectors) {
            try {
              const el = document.querySelector(selector);
              if (el && el.offsetParent !== null && el.textContent.trim().length > 0) {
                const text = el.textContent.toLowerCase();
                if (errorTexts.some(t => text.includes(t))) {
                  return { hasError: true, message: el.textContent.trim() };
                }
              }
            } catch (e) {}
          }

          return { hasError: false };
        }
      });

      return results[0]?.result || { hasError: false };
    } catch (error) {
      return { hasError: false };
    }
  }

  /**
   * Click SSO provider button
   */
  async clickSSOProvider(tabId, provider, customSelector) {
    const providerSelectors = {
      google: [
        '[data-provider="google"]', 'button[class*="google"]',
        'a[href*="google.com/o/oauth"]', '[aria-label*="Google"]',
        '.google-login', '#google-signin'
      ],
      microsoft: [
        '[data-provider="microsoft"]', 'button[class*="microsoft"]',
        'a[href*="microsoft"]', '[aria-label*="Microsoft"]'
      ],
      github: [
        '[data-provider="github"]', 'button[class*="github"]',
        'a[href*="github.com/login/oauth"]', '[aria-label*="GitHub"]'
      ],
      okta: [
        '[data-provider="okta"]', 'button[class*="okta"]', 'a[href*="okta"]'
      ],
      saml: [
        '[data-provider="sso"]', '[data-provider="saml"]',
        'button[class*="sso"]', 'a[href*="sso"]', '.sso-login'
      ]
    };

    const selectors = customSelector 
      ? [customSelector]
      : (providerSelectors[provider] || []);

    try {
      const results = await chrome.scripting.executeScript({
        target: { tabId },
        func: (selectorList) => {
          for (const selector of selectorList) {
            try {
              const btn = document.querySelector(selector);
              if (btn && btn.offsetParent !== null) {
                btn.click();
                return { clicked: true, selector };
              }
            } catch (e) {}
          }
          return { clicked: false };
        },
        args: [selectors]
      });

      return results[0]?.result || { clicked: false };
    } catch (error) {
      return { clicked: false, error: error.message };
    }
  }

  /**
   * Detect account chooser page
   */
  async detectAccountChooser(tabId) {
    try {
      const results = await chrome.scripting.executeScript({
        target: { tabId },
        func: () => {
          const url = window.location.href.toLowerCase();
          const bodyText = document.body.innerText.toLowerCase();

          // URL indicators
          const urlIndicators = [
            'accountchooser', 'account_chooser', 'select_account',
            'selectaccount', 'pick_account'
          ];

          // Text indicators
          const textIndicators = [
            'choose an account', 'select an account', 'pick an account',
            'which account', 'sign in with', 'use another account'
          ];

          // Check URL
          if (urlIndicators.some(i => url.includes(i))) {
            return { detected: true, type: 'url' };
          }

          // Check text
          if (textIndicators.some(i => bodyText.includes(i))) {
            return { detected: true, type: 'text' };
          }

          // Check for multiple account list
          const accountSelectors = [
            '[data-identifier]', '[data-email]', '.account-list',
            '.picker-list', '[class*="account-chooser"]'
          ];
          for (const selector of accountSelectors) {
            const elements = document.querySelectorAll(selector);
            if (elements.length > 1) {
              return { detected: true, type: 'account_list' };
            }
          }

          return { detected: false };
        }
      });

      return results[0]?.result || { detected: false };
    } catch (error) {
      return { detected: false };
    }
  }

  /**
   * Monitor SSO completion
   */
  async monitorSSOCompletion(tabId, postLoginUrl, tool, successCheck, timeout = 30000) {
    const startTime = Date.now();

    while (Date.now() - startTime < timeout) {
      try {
        const tab = await chrome.tabs.get(tabId);
        const currentUrl = tab.url;

        // Check if redirected to post-login URL
        if (postLoginUrl && currentUrl.includes(postLoginUrl)) {
          return { success: true, currentUrl };
        }

        // Check success conditions
        const check = await this.successDetector.checkLoginSuccess(tabId, tool, successCheck);
        if (check.success) {
          return check;
        }

        // Check for account chooser
        const accountChooser = await this.detectAccountChooser(tabId);
        if (accountChooser.detected) {
          return {
            success: false,
            requiresManualAction: true,
            reason: 'Account selection required'
          };
        }

        // Check if no longer on auth pages
        const isAuthPage = /\/(login|signin|auth|oauth|sso)/i.test(currentUrl);
        if (!isAuthPage) {
          // Verify with success detector
          const finalCheck = await this.successDetector.checkLoginSuccess(tabId, tool, successCheck);
          if (finalCheck.success || !finalCheck.isLoginPage) {
            return { success: true, currentUrl };
          }
        }

      } catch (error) {
        if (error.message.includes('No tab with id')) {
          return { success: false, error: 'Tab was closed' };
        }
      }

      await this.sleep(500);
    }

    return { success: false, error: 'SSO timeout' };
  }

  /**
   * Create a hidden tab
   */
  async createHiddenTab(url) {
    try {
      const tab = await chrome.tabs.create({
        url,
        active: false,
        pinned: false
      });
      return tab;
    } catch (error) {
      this.logger.warn('Failed to create hidden tab', { error: error.message });
      return null;
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
            resolve(tab); // Resolve anyway after timeout
          } else {
            setTimeout(checkTab, 100);
          }
        });
      };

      checkTab();
    });
  }

  /**
   * Build actionable error message
   */
  buildActionableError(errors, tool) {
    if (errors.length === 0) {
      return 'Login failed - unknown error';
    }

    const lastError = errors[errors.length - 1];
    const errorMessages = {
      'Form fill failed': 'Could not find login form. The login page structure may have changed.',
      'Login form not found': 'Login form not detected. Try updating the tool configuration.',
      'Session injection failed': 'Session data could not be applied. Credentials may be expired.',
      'SSO authentication failed': 'SSO login did not complete. Please try logging in manually.'
    };

    for (const [key, message] of Object.entries(errorMessages)) {
      if (lastError.error?.includes(key)) {
        return message;
      }
    }

    return `Login failed: ${lastError.error}. Please try again or contact support.`;
  }

  /**
   * Update flow status
   */
  updateFlowStatus(flowId, status) {
    const flow = this.activeFlows.get(flowId);
    if (flow) {
      flow.status = status;
    }
  }

  /**
   * Complete flow and store result
   */
  completeFlow(flowId, result) {
    const flow = this.activeFlows.get(flowId);
    if (flow) {
      flow.status = 'completed';
      flow.endTime = Date.now();
      flow.duration = flow.endTime - flow.startTime;
      flow.result = result;
    }

    this.flowResults.set(flowId, {
      ...result,
      duration: flow?.duration
    });

    this.activeFlows.delete(flowId);
  }

  /**
   * Sleep utility
   */
  sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  /**
   * Get flow status
   */
  getFlowStatus(flowId) {
    return this.activeFlows.get(flowId) || this.flowResults.get(flowId);
  }
}

// Singleton instance
let orchestratorInstance = null;

export function getOrchestrator() {
  if (!orchestratorInstance) {
    orchestratorInstance = new LoginOrchestrator();
  }
  return orchestratorInstance;
}

export default LoginOrchestrator;
