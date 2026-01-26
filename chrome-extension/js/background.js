/**
 * Background Service Worker for ToolStack Extension
 * Central controller for auto-login, strategy execution, and credential management
 */

import { getStrategyEngine } from './strategies/StrategyEngine.js';
import { createToolConfig, TIMEOUTS } from './config/toolConfigs.js';

// Constants
const SYNC_INTERVAL_MINUTES = 15;
const ALARM_NAME = 'toolstack-sync';

// State
let strategyEngine = null;
let activeLogins = new Map(); // Track active login processes
let toolCredentialsCache = new Map(); // Cache credentials
let domainToolMap = new Map(); // Map domains to tools

// ============================================================================
// STORAGE UTILITIES
// ============================================================================

async function getStorage(keys) {
  return new Promise(resolve => chrome.storage.local.get(keys, resolve));
}

async function setStorage(data) {
  return new Promise(resolve => chrome.storage.local.set(data, resolve));
}

async function removeStorage(keys) {
  return new Promise(resolve => chrome.storage.local.remove(keys, resolve));
}

// ============================================================================
// API UTILITIES
// ============================================================================

async function apiRequest(endpoint, options = {}) {
  const data = await getStorage(['apiUrl', 'extensionToken']);
  
  if (!data.apiUrl || !data.extensionToken) {
    throw new Error('Not authenticated');
  }
  
  const url = `${data.apiUrl}/api/crm/extension${endpoint}`;
  const headers = {
    'Content-Type': 'application/json',
    'Authorization': `ExtToken ${data.extensionToken}`,
    'X-Extension-Version': chrome.runtime.getManifest().version,
    ...options.headers
  };
  
  const response = await fetch(url, { ...options, headers });
  const result = await response.json();
  
  if (!response.ok) {
    throw new Error(result.error || 'Request failed');
  }
  
  return result;
}

// ============================================================================
// INITIALIZATION
// ============================================================================

async function initialize() {
  console.log('[Background] Initializing ToolStack Extension');
  
  // Initialize strategy engine
  strategyEngine = getStrategyEngine();
  
  // Load cached data
  await loadCachedData();
  
  // Setup sync alarm
  await setupSyncAlarm();
  
  // Load token configs
  await loadTokenConfigs();
  
  console.log('[Background] Initialization complete');
}

async function loadCachedData() {
  const data = await getStorage(['tools', 'domainToolMap']);
  
  if (data.tools) {
    // Build domain to tool map
    for (const tool of data.tools) {
      if (tool.domain) {
        domainToolMap.set(tool.domain, tool);
      }
      // Also map by targetUrl hostname
      try {
        const hostname = new URL(tool.targetUrl).hostname;
        domainToolMap.set(hostname, tool);
      } catch (e) {
        // Invalid URL
      }
    }
  }
}

// ============================================================================
// SYNC & UPDATES
// ============================================================================

async function setupSyncAlarm() {
  await chrome.alarms.clear(ALARM_NAME);
  
  chrome.alarms.create(ALARM_NAME, {
    delayInMinutes: 1,
    periodInMinutes: SYNC_INTERVAL_MINUTES
  });
  
  console.log(`[Background] Sync alarm set for every ${SYNC_INTERVAL_MINUTES} minutes`);
}

async function checkForUpdates() {
  try {
    const stored = await getStorage(['toolVersions', 'extensionToken']);
    
    if (!stored.extensionToken) {
      console.log('[Background] Not authenticated, skipping sync');
      return;
    }
    
    const result = await apiRequest('/tools/versions');
    const newVersions = result.versions;
    const oldVersions = stored.toolVersions || {};
    
    // Check for updates
    const updates = [];
    for (const [toolId, info] of Object.entries(newVersions)) {
      const oldVersion = oldVersions[toolId]?.version || oldVersions[toolId] || 0;
      if (info.version > oldVersion) {
        updates.push(toolId);
        // Clear cached credentials for updated tools
        toolCredentialsCache.delete(toolId);
      }
    }
    
    if (updates.length > 0) {
      console.log('[Background] Updates available for tools:', updates);
      chrome.action.setBadgeText({ text: String(updates.length) });
      chrome.action.setBadgeBackgroundColor({ color: '#f97316' });
      await setStorage({ toolVersions: newVersions });
    } else {
      chrome.action.setBadgeText({ text: '' });
    }
    
    await setStorage({ lastSync: new Date().toISOString() });
    
  } catch (error) {
    console.error('[Background] Sync check failed:', error);
    
    if (error.message.includes('token') || error.message.includes('401')) {
      chrome.action.setBadgeText({ text: '!' });
      chrome.action.setBadgeBackgroundColor({ color: '#ef4444' });
    }
  }
}

// ============================================================================
// AUTO-LOGIN CONTROLLER
// ============================================================================

/**
 * Handle login required notification from content script
 * IMPORTANT: When user navigates to a tool URL and gets redirected to login,
 * we should do the login invisibly and redirect them to the dashboard.
 */
async function handleLoginRequired(data, sender) {
  const { hostname, url } = data;
  const tabId = sender.tab?.id;
  
  console.log(`[Background] Login required for ${hostname}`, { tabId, url });
  
  // Check if we're already processing login for this tab
  if (activeLogins.has(tabId)) {
    console.log('[Background] Login already in progress for tab', tabId);
    return;
  }
  
  // Find tool for this domain
  const tool = domainToolMap.get(hostname);
  
  if (!tool) {
    console.log(`[Background] No tool found for domain: ${hostname}`);
    return;
  }
  
  // Mark login as active
  activeLogins.set(tabId, { tool, startTime: Date.now() });
  
  try {
    // Get credentials
    const credentials = await getToolCredentials(tool.id);
    
    if (!credentials) {
      console.log(`[Background] No credentials for tool: ${tool.name}`);
      return;
    }
    
    // Create tool config
    const config = createToolConfig(tool, credentials);
    const postLoginUrl = tool.targetUrl;
    
    // For COOKIE credentials: Inject cookies and reload
    if (credentials.type === 'cookies' && config.cookies?.length > 0) {
      console.log('[Background] Injecting cookies into current tab');
      await injectCookies(postLoginUrl, config.cookies);
      await chrome.tabs.update(tabId, { url: postLoginUrl });
      return;
    }
    
    // For FORM credentials: Fill and submit in current tab
    // (User is already on login page, so just fill it quickly)
    if (credentials.type === 'form' || config.formData?.username) {
      console.log('[Background] Auto-filling login form');
      
      // Fill the form that's already visible
      const fillResult = await fillAndSubmitForm(tabId, config);
      console.log('[Background] Form auto-fill result:', fillResult);
      
      // Form will submit and navigate automatically
      return;
    }
    
    // For TOKEN/STORAGE credentials: Inject and reload
    if (credentials.type === 'token' || credentials.type === 'localStorage' || credentials.type === 'sessionStorage') {
      const storageData = config.storage?.data || {};
      if (config.tokenValue) {
        storageData.token = config.tokenValue;
        storageData.access_token = config.tokenValue;
      }
      
      if (Object.keys(storageData).length > 0) {
        await injectStorage(tabId, credentials.type === 'sessionStorage' ? 'sessionStorage' : 'localStorage', storageData);
        await chrome.tabs.reload(tabId);
      }
      return;
    }
    
  } catch (error) {
    console.error('[Background] Auto-login failed:', error);
  } finally {
    // Clear active login
    activeLogins.delete(tabId);
  }
}

/**
 * Get credentials for a tool (with caching)
 */
async function getToolCredentials(toolId) {
  // Check cache
  if (toolCredentialsCache.has(toolId)) {
    const cached = toolCredentialsCache.get(toolId);
    if (Date.now() - cached.timestamp < 5 * 60 * 1000) { // 5 min cache
      return cached.credentials;
    }
  }
  
  try {
    const result = await apiRequest(`/tools/${toolId}/credentials`);
    
    if (result.credentials) {
      toolCredentialsCache.set(toolId, {
        credentials: result.credentials,
        timestamp: Date.now()
      });
    }
    
    return result.credentials;
  } catch (error) {
    console.error('[Background] Failed to fetch credentials:', error);
    return null;
  }
}

// ============================================================================
// ONE-CLICK LOGIN (from popup)
// ============================================================================

/**
 * Execute one-click login for a tool
 * INVISIBLE LOGIN: User should NEVER see login page
 * Flow: Do everything in background → only show final destination
 */
async function executeOneClickLogin(toolId, tool) {
  console.log(`[Background] One-click login for tool: ${tool.name}`);
  
  // Get credentials
  const credentials = await getToolCredentials(toolId);
  
  if (!credentials) {
    return { success: false, error: 'No credentials available' };
  }
  
  // Create tool config
  const config = createToolConfig(tool, credentials);
  
  const loginUrl = credentials.loginUrl || tool.loginUrl || tool.targetUrl;
  const postLoginUrl = tool.targetUrl;
  
  console.log('[Background] URLs:', { loginUrl, postLoginUrl, credType: credentials.type });
  
  // =========================================================================
  // STEP 1: For ALL credential types, first inject cookies/tokens silently
  // =========================================================================
  if (credentials.type === 'cookies' && config.cookies?.length > 0) {
    console.log('[Background] Injecting cookies silently');
    const cookieResult = await injectCookies(postLoginUrl, config.cookies);
    console.log('[Background] Cookie injection result:', cookieResult);
    
    if (cookieResult.success) {
      // Cookies injected - open target URL, should go directly to dashboard
      const tab = await chrome.tabs.create({ url: postLoginUrl, active: true });
      await waitForTabLoad(tab.id);
      
      // Check if we ended up on login page anyway (cookies expired/invalid)
      const finalUrl = await getTabUrl(tab.id);
      const isStillLogin = /\/(login|signin|sign-in|auth)\b/i.test(finalUrl);
      
      if (!isStillLogin) {
        // Success - we're on the app, not login page
        logToolOpened(toolId);
        return { success: true, tabId: tab.id, method: 'cookies' };
      }
      // If still on login, fall through to form login
      console.log('[Background] Cookies didn\'t work, trying form login');
    }
  }
  
  // =========================================================================
  // STEP 2: For FORM credentials - do login in HIDDEN TAB
  // =========================================================================
  if (credentials.type === 'form' || config.formData?.username) {
    console.log('[Background] Executing INVISIBLE form login');
    
    const result = await executeInvisibleFormLogin(config, loginUrl, postLoginUrl);
    
    if (result.success) {
      // Login done invisibly - now open the final URL for user
      const finalUrl = result.redirectedTo || postLoginUrl;
      const tab = await chrome.tabs.create({ url: finalUrl, active: true });
      logToolOpened(toolId);
      return { success: true, tabId: tab.id, method: 'invisible_form', finalUrl };
    }
    
    // Form login failed
    console.log('[Background] Invisible form login failed:', result.error);
  }
  
  // =========================================================================
  // STEP 3: For token/storage credentials
  // =========================================================================
  if (credentials.type === 'token' || credentials.type === 'localStorage' || credentials.type === 'sessionStorage') {
    // Create hidden tab to inject storage, then redirect user
    const hiddenTab = await chrome.tabs.create({ url: postLoginUrl, active: false });
    await waitForTabLoad(hiddenTab.id);
    
    // Inject storage
    const storageData = config.storage?.data || {};
    if (config.tokenValue) {
      storageData.token = config.tokenValue;
      storageData.access_token = config.tokenValue;
    }
    
    if (Object.keys(storageData).length > 0) {
      await injectStorage(hiddenTab.id, credentials.type === 'sessionStorage' ? 'sessionStorage' : 'localStorage', storageData);
      await chrome.tabs.reload(hiddenTab.id);
      await waitForTabLoad(hiddenTab.id);
    }
    
    // Check final URL
    const finalUrl = await getTabUrl(hiddenTab.id);
    const isStillLogin = /\/(login|signin|sign-in|auth)\b/i.test(finalUrl);
    
    // Close hidden tab
    await chrome.tabs.remove(hiddenTab.id).catch(() => {});
    
    if (!isStillLogin) {
      // Success - open for user
      const tab = await chrome.tabs.create({ url: finalUrl, active: true });
      logToolOpened(toolId);
      return { success: true, tabId: tab.id, method: 'token' };
    }
  }
  
  // =========================================================================
  // FALLBACK: Just open the URL (for SSO, etc.)
  // =========================================================================
  const tab = await chrome.tabs.create({ url: postLoginUrl, active: true });
  logToolOpened(toolId);
  return { success: true, tabId: tab.id, method: 'fallback' };
}

/**
 * Execute form login completely invisibly in a hidden tab
 * Returns the final URL after successful login
 */
async function executeInvisibleFormLogin(config, loginUrl, postLoginUrl) {
  console.log('[Background] Starting invisible form login');
  
  // Create HIDDEN tab for login
  const hiddenTab = await chrome.tabs.create({
    url: loginUrl,
    active: false,  // HIDDEN - not shown to user
    pinned: false
  });
  
  const tabId = hiddenTab.id;
  
  try {
    // Wait for login page to load
    await waitForTabLoad(tabId, 15000);
    
    // Wait a bit for any JS frameworks to initialize
    await sleep(1000);
    
    // Check if we're already logged in (might have valid session)
    let currentUrl = await getTabUrl(tabId);
    if (!isLoginPageUrl(currentUrl)) {
      console.log('[Background] Already logged in!');
      await chrome.tabs.remove(tabId).catch(() => {});
      return { success: true, alreadyLoggedIn: true, redirectedTo: currentUrl };
    }
    
    // Fill and submit the form
    const fillResult = await fillAndSubmitForm(tabId, config);
    console.log('[Background] Form fill result:', fillResult);
    
    if (!fillResult.success) {
      await chrome.tabs.remove(tabId).catch(() => {});
      return { success: false, error: fillResult.error || 'Form fill failed' };
    }
    
    // Wait for navigation after form submit (login processing)
    await sleep(2000);
    
    // Poll for successful login (URL change away from login page)
    const maxWait = 20000;
    const startTime = Date.now();
    let finalUrl = loginUrl;
    
    while (Date.now() - startTime < maxWait) {
      try {
        currentUrl = await getTabUrl(tabId);
        
        // Check if we've left the login page
        if (!isLoginPageUrl(currentUrl)) {
          finalUrl = currentUrl;
          console.log('[Background] Login successful! Redirected to:', finalUrl);
          break;
        }
        
        // Check for login errors on page
        const hasError = await checkForLoginError(tabId);
        if (hasError) {
          console.log('[Background] Login error detected on page');
          await chrome.tabs.remove(tabId).catch(() => {});
          return { success: false, error: 'Login failed - invalid credentials' };
        }
        
      } catch (e) {
        // Tab might have navigated
      }
      
      await sleep(500);
    }
    
    // Close hidden tab
    await chrome.tabs.remove(tabId).catch(() => {});
    
    // Check if login was successful
    if (!isLoginPageUrl(finalUrl)) {
      return { success: true, redirectedTo: finalUrl };
    }
    
    return { success: false, error: 'Login timeout - still on login page' };
    
  } catch (error) {
    console.error('[Background] Invisible form login error:', error);
    await chrome.tabs.remove(tabId).catch(() => {});
    return { success: false, error: error.message };
  }
}

/**
 * Fill and submit login form in a tab
 */
async function fillAndSubmitForm(tabId, config) {
  const formData = config.formData;
  const selectors = config.selectors || {};
  
  if (!formData?.username || !formData?.password) {
    return { success: false, error: 'No credentials provided' };
  }
  
  try {
    const result = await chrome.scripting.executeScript({
      target: { tabId },
      func: (username, password, customSelectors) => {
        // Generic selectors for finding form elements
        const usernameSelectors = [
          customSelectors?.username,
          'input[type="email"]',
          'input[name="email"]',
          'input[name="username"]',
          'input[name="user"]',
          'input[id="email"]',
          'input[id="username"]',
          'input[autocomplete="email"]',
          'input[autocomplete="username"]',
          'input[placeholder*="email" i]',
          'input[placeholder*="username" i]'
        ].filter(Boolean);
        
        const passwordSelectors = [
          customSelectors?.password,
          'input[type="password"]',
          'input[name="password"]',
          'input[id="password"]',
          'input[autocomplete="current-password"]'
        ].filter(Boolean);
        
        const submitSelectors = [
          customSelectors?.submit,
          'button[type="submit"]',
          'input[type="submit"]',
          'button:contains("Sign in")',
          'button:contains("Log in")',
          'button:contains("Login")',
          'button:contains("Submit")',
          'button[class*="login"]',
          'button[class*="submit"]',
          'button[class*="signin"]',
          '[data-testid*="login"]',
          '[data-testid*="submit"]'
        ].filter(Boolean);
        
        // Find element helper
        const findElement = (selectorList) => {
          for (const selector of selectorList) {
            if (!selector) continue;
            try {
              // Handle :contains pseudo-selector
              if (selector.includes(':contains(')) {
                const match = selector.match(/(.+):contains\(["']?(.+?)["']?\)/);
                if (match) {
                  const baseSelector = match[1];
                  const text = match[2];
                  const elements = document.querySelectorAll(baseSelector);
                  for (const el of elements) {
                    if (el.textContent.toLowerCase().includes(text.toLowerCase())) {
                      return el;
                    }
                  }
                }
                continue;
              }
              
              const el = document.querySelector(selector);
              if (el && el.offsetParent !== null) {
                return el;
              }
            } catch (e) {}
          }
          return null;
        };
        
        // Set input value with proper events
        const setInputValue = (input, value) => {
          input.focus();
          input.value = '';
          
          // Use native setter for React
          const nativeSetter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value')?.set;
          if (nativeSetter) {
            nativeSetter.call(input, value);
          } else {
            input.value = value;
          }
          
          input.dispatchEvent(new Event('input', { bubbles: true }));
          input.dispatchEvent(new Event('change', { bubbles: true }));
          input.dispatchEvent(new KeyboardEvent('keyup', { bubbles: true }));
        };
        
        // Find and fill fields
        const usernameField = findElement(usernameSelectors);
        const passwordField = findElement(passwordSelectors);
        
        if (!usernameField) {
          return { success: false, error: 'Username field not found' };
        }
        if (!passwordField) {
          return { success: false, error: 'Password field not found' };
        }
        
        // Fill fields
        setInputValue(usernameField, username);
        setInputValue(passwordField, password);
        
        // Find and click submit
        setTimeout(() => {
          const submitBtn = findElement(submitSelectors);
          if (submitBtn) {
            submitBtn.click();
          } else {
            // Try form submit
            const form = usernameField.closest('form') || passwordField.closest('form');
            if (form) {
              form.submit();
            }
          }
        }, 500);
        
        return { success: true, filled: true };
      },
      args: [formData.username, formData.password, selectors]
    });
    
    return result[0]?.result || { success: false, error: 'Script execution failed' };
    
  } catch (error) {
    return { success: false, error: error.message };
  }
}

/**
 * Check if current URL is a login page
 */
function isLoginPageUrl(url) {
  if (!url) return true;
  return /\/(login|signin|sign-in|auth|authenticate|session\/new)\b/i.test(url);
}

/**
 * Check for login error messages on page
 */
async function checkForLoginError(tabId) {
  try {
    const result = await chrome.scripting.executeScript({
      target: { tabId },
      func: () => {
        const errorSelectors = [
          '.error', '.error-message', '.alert-danger', '.alert-error',
          '[class*="error"]', '[class*="invalid"]', '[role="alert"]',
          '[data-testid*="error"]'
        ];
        
        for (const selector of errorSelectors) {
          const el = document.querySelector(selector);
          if (el && el.offsetParent !== null && el.textContent.trim().length > 0) {
            const text = el.textContent.toLowerCase();
            if (text.includes('invalid') || text.includes('incorrect') || 
                text.includes('wrong') || text.includes('failed')) {
              return true;
            }
          }
        }
        return false;
      }
    });
    
    return result[0]?.result || false;
  } catch (e) {
    return false;
  }
}

/**
 * Get current URL of a tab
 */
async function getTabUrl(tabId) {
  try {
    const tab = await chrome.tabs.get(tabId);
    return tab.url || '';
  } catch (e) {
    return '';
  }
}

/**
 * Log tool opened
 */
async function logToolOpened(toolId) {
  try {
    await apiRequest(`/tools/${toolId}/opened`, { method: 'POST' });
  } catch (e) {
    console.warn('[Background] Failed to log tool opened:', e);
  }
}

/**
 * Sleep helper
 */
function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

/**
 * Wait for tab to finish loading
 */
function waitForTabLoad(tabId, timeout = 30000) {
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

// ============================================================================
// COOKIE INJECTION
// ============================================================================

async function injectCookies(targetUrl, cookies) {
  if (!Array.isArray(cookies) || cookies.length === 0) {
    return { success: false, error: 'No cookies provided' };
  }
  
  const targetDomain = extractDomain(targetUrl);
  const isHttps = targetUrl.startsWith('https');
  
  let setCount = 0;
  let failedCount = 0;
  const failures = [];
  
  for (const cookie of cookies) {
    try {
      let cookieDomain = cookie.domain || targetDomain;
      const secure = cookie.secure === true || (cookie.secure !== false && isHttps);
      
      let sameSite = (cookie.sameSite || 'lax').toLowerCase();
      if (sameSite === 'no_restriction' || sameSite === 'none') {
        sameSite = 'no_restriction';
      } else if (sameSite === 'strict') {
        sameSite = 'strict';
      } else {
        sameSite = 'lax';
      }
      
      const finalSecure = sameSite === 'no_restriction' ? true : secure;
      const protocol = finalSecure ? 'https' : 'http';
      const cleanDomain = cookieDomain.startsWith('.') ? cookieDomain.substring(1) : cookieDomain;
      const cookieUrl = `${protocol}://${cleanDomain}/`;
      
      const cookieDetails = {
        url: cookieUrl,
        name: cookie.name,
        value: cookie.value,
        path: cookie.path || '/',
        secure: finalSecure,
        httpOnly: cookie.httpOnly === true,
        sameSite: sameSite
      };
      
      if (cookieDomain.startsWith('.')) {
        cookieDetails.domain = cookieDomain;
      }
      
      if (cookie.expirationDate) {
        cookieDetails.expirationDate = cookie.expirationDate;
      } else if (cookie.expires) {
        const expiresDate = new Date(cookie.expires);
        if (!isNaN(expiresDate.getTime())) {
          cookieDetails.expirationDate = expiresDate.getTime() / 1000;
        }
      } else {
        cookieDetails.expirationDate = Math.floor(Date.now() / 1000) + (30 * 24 * 60 * 60);
      }
      
      const result = await chrome.cookies.set(cookieDetails);
      if (result) {
        setCount++;
      } else {
        throw new Error('Cookie set returned null');
      }
    } catch (error) {
      failedCount++;
      failures.push({ name: cookie.name, error: error.message });
    }
  }
  
  return {
    success: failedCount === 0,
    set: setCount,
    failed: failedCount,
    failures
  };
}

// ============================================================================
// STORAGE INJECTION
// ============================================================================

async function injectStorage(tabId, storageType, data) {
  return chrome.scripting.executeScript({
    target: { tabId },
    func: (storageData, type) => {
      const storage = type === 'sessionStorage' ? sessionStorage : localStorage;
      let setCount = 0;
      const errors = [];
      
      for (const [key, value] of Object.entries(storageData)) {
        try {
          const valueStr = typeof value === 'string' ? value : JSON.stringify(value);
          storage.setItem(key, valueStr);
          setCount++;
        } catch (e) {
          errors.push({ key, error: e.message });
        }
      }
      
      return { success: setCount > 0, set: setCount, errors };
    },
    args: [data, storageType]
  }).then(results => results[0]?.result || { success: false });
}

// ============================================================================
// TOKEN CONFIGURATION
// ============================================================================

let tokenDomains = new Map();

async function loadTokenConfigs() {
  const data = await getStorage(null);
  tokenDomains.clear();
  
  for (const [key, value] of Object.entries(data)) {
    if (key.startsWith('token_') || key.startsWith('jwt_')) {
      const domain = key.replace(/^(token_|jwt_)/, '');
      tokenDomains.set(domain, value);
    }
  }
  
  console.log('[Background] Loaded token configs for domains:', Array.from(tokenDomains.keys()));
}

chrome.storage.onChanged.addListener((changes, namespace) => {
  if (namespace === 'local') {
    for (const [key, { newValue }] of Object.entries(changes)) {
      if (key.startsWith('token_') || key.startsWith('jwt_')) {
        const domain = key.replace(/^(token_|jwt_)/, '');
        if (newValue) {
          tokenDomains.set(domain, newValue);
        } else {
          tokenDomains.delete(domain);
        }
      }
    }
  }
});

// ============================================================================
// UTILITIES
// ============================================================================

function extractDomain(url) {
  try {
    return new URL(url).hostname;
  } catch (e) {
    return url;
  }
}

function getBaseDomain(hostname) {
  const parts = hostname.split('.');
  if (parts.length <= 2) return hostname;
  const commonMultiPartTLDs = ['co.uk', 'com.au', 'co.nz', 'co.in', 'com.br'];
  const lastTwo = parts.slice(-2).join('.');
  if (commonMultiPartTLDs.includes(lastTwo)) {
    return parts.slice(-3).join('.');
  }
  return parts.slice(-2).join('.');
}

// ============================================================================
// EVENT LISTENERS
// ============================================================================

// Alarm listener
chrome.alarms.onAlarm.addListener((alarm) => {
  if (alarm.name === ALARM_NAME) {
    console.log('[Background] Running scheduled sync check');
    checkForUpdates();
  }
});

// Install/Update listener
chrome.runtime.onInstalled.addListener((details) => {
  console.log('[Background] Extension installed/updated:', details.reason);
  initialize();
});

// Startup listener
chrome.runtime.onStartup.addListener(() => {
  console.log('[Background] Browser started');
  initialize();
});

// Message listener
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  console.log('[Background] Message received:', message.type, { from: sender.tab?.id || 'popup' });
  
  // Handle messages from content script
  if (message.source === 'content') {
    switch (message.type) {
      case 'LOGIN_REQUIRED':
        handleLoginRequired(message.data, sender);
        sendResponse({ received: true });
        break;
        
      case 'LOGIN_STATE':
        // Store login state for the domain
        if (message.hostname) {
          setStorage({ [`loginState_${message.hostname}`]: message.data });
        }
        sendResponse({ received: true });
        break;
        
      default:
        sendResponse({ error: 'Unknown content message type' });
    }
    return;
  }
  
  // Handle messages from popup
  switch (message.type) {
    case 'CHECK_UPDATES':
      checkForUpdates().then(() => sendResponse({ success: true }));
      return true;
      
    case 'CLEAR_BADGE':
      chrome.action.setBadgeText({ text: '' });
      sendResponse({ success: true });
      break;
      
    case 'GET_SYNC_STATUS':
      getStorage(['lastSync', 'toolVersions']).then(data => sendResponse(data));
      return true;
      
    case 'ONE_CLICK_LOGIN':
      executeOneClickLogin(message.toolId, message.tool)
        .then(result => sendResponse(result))
        .catch(error => sendResponse({ success: false, error: error.message }));
      return true;
      
    case 'INJECT_COOKIES':
      injectCookies(message.targetUrl, message.cookies)
        .then(result => sendResponse(result))
        .catch(error => sendResponse({ success: false, error: error.message }));
      return true;
      
    case 'INJECT_STORAGE':
      injectStorage(message.tabId, message.storageType, message.data)
        .then(result => sendResponse(result))
        .catch(error => sendResponse({ success: false, error: error.message }));
      return true;
      
    case 'GET_TOOL_FOR_DOMAIN':
      const tool = domainToolMap.get(message.hostname);
      sendResponse({ tool: tool || null });
      break;
      
    case 'REFRESH_DOMAIN_MAP':
      loadCachedData().then(() => sendResponse({ success: true }));
      return true;
      
    case 'GET_STRATEGY_ENGINE_STATUS':
      sendResponse({
        initialized: !!strategyEngine,
        activeLogins: Array.from(activeLogins.keys()),
        cachedCredentials: Array.from(toolCredentialsCache.keys())
      });
      break;
      
    default:
      sendResponse({ error: 'Unknown message type' });
  }
});

// Tab update listener - detect navigation to tool domains and inject content script
chrome.tabs.onUpdated.addListener(async (tabId, changeInfo, tab) => {
  if (changeInfo.status === 'complete' && tab.url) {
    try {
      const hostname = new URL(tab.url).hostname;
      const tool = domainToolMap.get(hostname);
      
      if (tool) {
        console.log(`[Background] Tab navigated to tool domain: ${hostname}`);
        
        // Inject content script dynamically
        await injectContentScript(tabId, tab.url);
      }
    } catch (e) {
      // Invalid URL or injection failed
      console.log('[Background] Tab update handler error:', e.message);
    }
  }
});

/**
 * Inject content script into a tab
 */
async function injectContentScript(tabId, url) {
  try {
    // Check if we have permission for this URL
    const hasPermission = await chrome.permissions.contains({
      origins: [url]
    });
    
    if (!hasPermission) {
      console.log(`[Background] No permission to inject content script into: ${url}`);
      return false;
    }
    
    // Check if content script is already injected
    try {
      const results = await chrome.scripting.executeScript({
        target: { tabId },
        func: () => window.__TOOLSTACK_CONTENT_INJECTED__
      });
      
      if (results[0]?.result === true) {
        console.log('[Background] Content script already injected');
        return true;
      }
    } catch (e) {
      // Script not injected yet
    }
    
    // Inject the content script
    await chrome.scripting.executeScript({
      target: { tabId },
      files: ['js/content.js']
    });
    
    // Mark as injected
    await chrome.scripting.executeScript({
      target: { tabId },
      func: () => { window.__TOOLSTACK_CONTENT_INJECTED__ = true; }
    });
    
    console.log(`[Background] Content script injected into tab ${tabId}`);
    return true;
  } catch (error) {
    console.error('[Background] Content script injection failed:', error);
    return false;
  }
}

// Initialize on script load
initialize();
console.log('[Background] ToolStack Extension background worker loaded');
