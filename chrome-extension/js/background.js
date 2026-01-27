/**
 * Background Service Worker for ToolStack Extension v2.1
 * 
 * Enhanced with:
 * - Login Orchestrator for unified login flow
 * - Robust retry logic with exponential backoff
 * - MFA detection and user notification
 * - Comprehensive diagnostics without exposing secrets
 * - Debug mode toggle
 */

import { getOrchestrator } from './core/LoginOrchestrator.js';
import { Logger, enableDebugMode, disableDebugMode, isDebugModeEnabled, getLogHistory, exportLogs } from './core/Logger.js';
import { createToolConfig, TIMEOUTS } from './config/toolConfigs.js';

// Initialize logger
const logger = new Logger('Background');

// Constants
const SYNC_INTERVAL_MINUTES = 15;
const ALARM_NAME = 'toolstack-sync';

// State
let orchestrator = null;
let activeLogins = new Map();
let toolCredentialsCache = new Map();
let domainToolMap = new Map();

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
  
  logger.debug('API Request', { endpoint, method: options.method || 'GET' });
  
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
  logger.info('Initializing ToolStack Extension v2.1');
  
  // Initialize orchestrator
  orchestrator = getOrchestrator();
  
  // Load cached data
  await loadCachedData();
  
  // Setup sync alarm
  await setupSyncAlarm();
  
  // Load token configs
  await loadTokenConfigs();
  
  logger.info('Initialization complete');
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
    logger.debug('Loaded tool mappings', { count: domainToolMap.size });
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
  
  logger.debug(`Sync alarm set for every ${SYNC_INTERVAL_MINUTES} minutes`);
}

async function checkForUpdates() {
  try {
    const stored = await getStorage(['toolVersions', 'extensionToken']);
    
    if (!stored.extensionToken) {
      logger.debug('Not authenticated, skipping sync');
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
      logger.info('Updates available', { count: updates.length });
      chrome.action.setBadgeText({ text: String(updates.length) });
      chrome.action.setBadgeBackgroundColor({ color: '#f97316' });
      await setStorage({ toolVersions: newVersions });
    } else {
      chrome.action.setBadgeText({ text: '' });
    }
    
    await setStorage({ lastSync: new Date().toISOString() });
    
  } catch (error) {
    logger.error('Sync check failed', { error: error.message });
    
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
 */
async function handleLoginRequired(data, sender) {
  const { hostname, url } = data;
  const tabId = sender.tab?.id;
  
  logger.info('Login required detected', { hostname, tabId });
  
  // Check if we're already processing login for this tab
  if (activeLogins.has(tabId)) {
    logger.debug('Login already in progress for tab', { tabId });
    return;
  }
  
  // Find tool for this domain
  const tool = domainToolMap.get(hostname);
  
  if (!tool) {
    logger.debug('No tool found for domain', { hostname });
    return;
  }
  
  // Mark login as active
  activeLogins.set(tabId, { tool, startTime: Date.now() });
  
  try {
    // Get credentials
    const credentials = await getToolCredentials(tool.id);
    
    if (!credentials) {
      logger.warn('No credentials for tool', { tool: tool.name });
      return;
    }
    
    // Use orchestrator for login
    const result = await orchestrator.executeLogin(tool, credentials, {
      tabId,
      currentUrl: url
    });
    
    logger.info('Auto-login result', { 
      tool: tool.name, 
      success: result.success, 
      method: result.method 
    });
    
  } catch (error) {
    logger.error('Auto-login failed', { error: error.message });
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
      logger.debug('Using cached credentials', { toolId });
      return cached.credentials;
    }
  }
  
  try {
    logger.debug('Fetching credentials from API', { toolId });
    const result = await apiRequest(`/tools/${toolId}/credentials`);
    
    if (result.credentials) {
      toolCredentialsCache.set(toolId, {
        credentials: result.credentials,
        timestamp: Date.now()
      });
    }
    
    return result.credentials;
  } catch (error) {
    logger.error('Failed to fetch credentials', { error: error.message });
    return null;
  }
}

// ============================================================================
// ONE-CLICK LOGIN (from popup)
// ============================================================================

/**
 * Execute one-click login for a tool using the orchestrator
 */
async function executeOneClickLogin(toolId, tool) {
  logger.info('One-click login started', { tool: tool.name, toolId });
  
  try {
    // Get credentials
    const credentials = await getToolCredentials(toolId);
    
    if (!credentials) {
      return { 
        success: false, 
        error: 'No credentials available for this tool',
        actionableError: 'Credentials not found. Please contact your administrator to configure access.'
      };
    }
    
    // Execute login via orchestrator
    const result = await orchestrator.executeLogin(tool, credentials);
    
    // Log tool opened if successful
    if (result.success) {
      await logToolOpened(toolId);
    }
    
    logger.info('One-click login completed', {
      tool: tool.name,
      success: result.success,
      method: result.method,
      requiresManualAction: result.requiresManualAction
    });
    
    return result;
    
  } catch (error) {
    logger.error('One-click login error', { error: error.message });
    return { 
      success: false, 
      error: error.message,
      actionableError: 'Login failed unexpectedly. Please try again or contact support.'
    };
  }
}

/**
 * Log tool opened
 */
async function logToolOpened(toolId) {
  try {
    await apiRequest(`/tools/${toolId}/opened`, { method: 'POST' });
    logger.debug('Tool opened logged', { toolId });
  } catch (e) {
    logger.warn('Failed to log tool opened', { error: e.message });
  }
}

// ============================================================================
// COOKIE INJECTION (Direct method for backward compatibility)
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
  
  logger.debug('Injecting cookies', { count: cookies.length, domain: targetDomain });
  
  for (const cookie of cookies) {
    try {
      // Normalize cookie domain
      let cookieDomain = cookie.domain || targetDomain;
      
      // Ensure leading dot for subdomain cookies
      if (cookieDomain && !cookieDomain.startsWith('.') && cookieDomain !== targetDomain) {
        cookieDomain = '.' + cookieDomain;
      }
      
      const secure = cookie.secure === true || (cookie.secure !== false && isHttps);
      
      // Normalize sameSite
      let sameSite = (cookie.sameSite || 'lax').toLowerCase();
      if (sameSite === 'no_restriction' || sameSite === 'none') {
        sameSite = 'no_restriction';
      } else if (sameSite === 'strict') {
        sameSite = 'strict';
      } else {
        sameSite = 'lax';
      }
      
      // SameSite=None requires Secure
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
        setCount++;
      } else {
        throw new Error('Cookie set returned null');
      }
    } catch (error) {
      failedCount++;
      failures.push({ name: cookie.name, error: error.message });
    }
  }
  
  logger.debug('Cookie injection complete', { set: setCount, failed: failedCount });
  
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
  logger.debug('Injecting storage', { tabId, storageType, keyCount: Object.keys(data).length });
  
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
  
  logger.debug('Loaded token configs', { count: tokenDomains.size });
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

function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

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
          resolve(tab);
        } else {
          setTimeout(checkTab, 100);
        }
      });
    };
    
    checkTab();
  });
}

// ============================================================================
// EVENT LISTENERS
// ============================================================================

// Alarm listener
chrome.alarms.onAlarm.addListener((alarm) => {
  if (alarm.name === ALARM_NAME) {
    logger.debug('Running scheduled sync check');
    checkForUpdates();
  }
});

// Install/Update listener
chrome.runtime.onInstalled.addListener((details) => {
  logger.info('Extension installed/updated', { reason: details.reason });
  initialize();
});

// Startup listener
chrome.runtime.onStartup.addListener(() => {
  logger.info('Browser started');
  initialize();
});

// Message listener
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  logger.debug('Message received', { type: message.type, from: sender.tab?.id || 'popup' });
  
  // Handle messages from content script
  if (message.source === 'content') {
    switch (message.type) {
      case 'LOGIN_REQUIRED':
        handleLoginRequired(message.data, sender);
        sendResponse({ received: true });
        break;
        
      case 'LOGIN_STATE':
        if (message.hostname) {
          setStorage({ [`loginState_${message.hostname}`]: message.data });
        }
        sendResponse({ received: true });
        break;
        
      case 'LOGIN_CANCELLED':
        // Cancel any active login for this tab
        const tabId = sender.tab?.id;
        if (tabId && activeLogins.has(tabId)) {
          const flow = activeLogins.get(tabId);
          logger.info('Login cancelled by user', { tool: flow.tool?.name, tabId });
          activeLogins.delete(tabId);
          // Cancel in orchestrator if there's an active flow
          if (orchestrator && flow.flowId) {
            orchestrator.cancelFlow(flow.flowId);
          }
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
      // Check if options are provided (for hidden mode, auto mode, etc.)
      if (message.options && (message.options.hidden || message.options.auto)) {
        executeOneClickLoginWithOptions(message.toolId, message.tool, message.options)
          .then(result => sendResponse(result))
          .catch(error => sendResponse({ success: false, error: error.message }));
      } else {
        executeOneClickLogin(message.toolId, message.tool)
          .then(result => sendResponse(result))
          .catch(error => sendResponse({ success: false, error: error.message }));
      }
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
        initialized: !!orchestrator,
        activeLogins: Array.from(activeLogins.keys()),
        cachedCredentials: Array.from(toolCredentialsCache.keys())
      });
      break;
      
    // Debug mode controls
    case 'ENABLE_DEBUG_MODE':
      enableDebugMode();
      sendResponse({ success: true, debugMode: true });
      break;
      
    case 'DISABLE_DEBUG_MODE':
      disableDebugMode();
      sendResponse({ success: true, debugMode: false });
      break;
      
    case 'GET_DEBUG_MODE':
      sendResponse({ debugMode: isDebugModeEnabled() });
      break;
      
    case 'GET_LOGS':
      const logs = getLogHistory(message.filter || {});
      sendResponse({ logs });
      break;
      
    case 'EXPORT_LOGS':
      const exported = exportLogs();
      sendResponse({ exported });
      break;
      
    default:
      sendResponse({ error: 'Unknown message type' });
  }
});

// Tab update listener - detect navigation to tool domains
chrome.tabs.onUpdated.addListener(async (tabId, changeInfo, tab) => {
  if (changeInfo.status === 'complete' && tab.url) {
    try {
      const urlObj = new URL(tab.url);
      const hostname = urlObj.hostname;
      const tool = domainToolMap.get(hostname);
      
      if (tool) {
        logger.debug('Tab navigated to tool domain', { hostname, tabId });
        
        // Check for auto-start and hidden mode params
        const autoParam = urlObj.searchParams.get('auto');
        const hiddenParam = urlObj.searchParams.get('hidden');
        const isAutoMode = autoParam === '1' || autoParam === 'true';
        const isHiddenMode = hiddenParam === '1' || hiddenParam === 'true';
        
        // Check if this is a login page
        const isLoginPage = /\/(login|signin|auth|sso)/i.test(urlObj.pathname) || 
                           urlObj.pathname.includes('login') ||
                           tab.url.includes(tool.loginUrl || '');
        
        logger.debug('Page analysis', { isAutoMode, isHiddenMode, isLoginPage });
        
        // Handle auto-start mode with ?auto=1
        if (isAutoMode && isLoginPage) {
          logger.info('Auto-start mode triggered', { tool: tool.name, hidden: isHiddenMode });
          
          // Check if tool has auto-start enabled
          const autoStartEnabled = tool.extensionSettings?.autoStartEnabled !== false;
          const comboTriggerOnAuto = !tool.comboAuth?.enabled || tool.comboAuth?.triggerOnAuto !== false;
          
          if (autoStartEnabled && comboTriggerOnAuto) {
            // Execute auto-login
            handleAutoStartLogin(tabId, tab, tool, { auto: true, hidden: isHiddenMode });
          }
        } else {
          // Inject content script dynamically for regular flow
          await injectContentScript(tabId, tab.url);
        }
      }
    } catch (e) {
      // Invalid URL or injection failed
      logger.warn('Tab update handler error', { error: e.message });
    }
  }
});

/**
 * Handle auto-start login when ?auto=1 is detected
 */
async function handleAutoStartLogin(tabId, tab, tool, options = {}) {
  const { auto, hidden, sourceTabId } = options;
  
  // Check if we're already processing login for this tab
  if (activeLogins.has(tabId)) {
    logger.debug('Login already in progress for tab', { tabId });
    return;
  }
  
  // Mark login as active
  activeLogins.set(tabId, { tool, startTime: Date.now(), autoMode: true });
  
  try {
    // Get credentials
    const credentials = await getToolCredentials(tool.id);
    
    if (!credentials) {
      logger.warn('No credentials for auto-start', { tool: tool.name });
      activeLogins.delete(tabId);
      return;
    }
    
    // Small delay to let page render
    await sleep(500);
    
    // Execute login via orchestrator
    const result = await orchestrator.executeLogin(tool, credentials, {
      auto: true,
      hidden: hidden || false,
      sourceTabId: sourceTabId || null
    });
    
    logger.info('Auto-start login result', { 
      tool: tool.name, 
      success: result.success, 
      method: result.method,
      requiresManualAction: result.requiresManualAction
    });
    
    // Log tool opened if successful
    if (result.success) {
      await logToolOpened(tool.id);
    }
    
  } catch (error) {
    logger.error('Auto-start login failed', { error: error.message });
  } finally {
    // Clear active login
    activeLogins.delete(tabId);
  }
}

/**
 * Execute one-click login with hidden mode support
 */
async function executeOneClickLoginWithOptions(toolId, tool, options = {}) {
  logger.info('One-click login with options', { tool: tool.name, toolId, options });
  
  try {
    // Get credentials
    const credentials = await getToolCredentials(toolId);
    
    if (!credentials) {
      return { 
        success: false, 
        error: 'No credentials available for this tool',
        actionableError: 'Credentials not found. Please contact your administrator to configure access.'
      };
    }
    
    // Get current tab if hidden mode requested
    let sourceTabId = null;
    if (options.hidden) {
      const [activeTab] = await chrome.tabs.query({ active: true, currentWindow: true });
      sourceTabId = activeTab?.id;
    }
    
    // Execute login via orchestrator
    const result = await orchestrator.executeLogin(tool, credentials, {
      auto: options.auto || false,
      hidden: options.hidden || false,
      sourceTabId
    });
    
    // Log tool opened if successful
    if (result.success) {
      await logToolOpened(toolId);
    }
    
    logger.info('One-click login completed', {
      tool: tool.name,
      success: result.success,
      method: result.method,
      requiresManualAction: result.requiresManualAction
    });
    
    return result;
    
  } catch (error) {
    logger.error('One-click login error', { error: error.message });
    return { 
      success: false, 
      error: error.message,
      actionableError: 'Login failed unexpectedly. Please try again or contact support.'
    };
  }
}

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
      logger.debug('No permission to inject', { url: url.substring(0, 50) });
      return false;
    }
    
    // Check if content script is already injected
    try {
      const results = await chrome.scripting.executeScript({
        target: { tabId },
        func: () => window.__TOOLSTACK_CONTENT_INJECTED__
      });
      
      if (results[0]?.result === true) {
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
    
    logger.debug('Content script injected', { tabId });
    return true;
  } catch (error) {
    logger.warn('Content script injection failed', { error: error.message });
    return false;
  }
}

// Initialize on script load
initialize();
logger.info('ToolStack Extension v2.1 background worker loaded');
