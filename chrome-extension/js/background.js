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
    const stored = await getStorage(['toolVersions', 'sessionBundleVersions', 'extensionToken']);
    
    if (!stored.extensionToken) {
      logger.debug('Not authenticated, skipping sync');
      return;
    }
    
    const result = await apiRequest('/tools');
    const tools = result.tools || [];
    const oldVersions = stored.toolVersions || {};
    const oldBundleVersions = stored.sessionBundleVersions || {};
    
    // Build new versions map
    const newVersions = {};
    const newBundleVersions = {};
    const credentialUpdates = [];
    const sessionBundleUpdates = [];
    
    for (const tool of tools) {
      const toolId = tool.id;
      
      // Track credential versions
      newVersions[toolId] = {
        version: tool.credentialVersion || 1,
        updatedAt: tool.credentialUpdatedAt
      };
      
      // Track session bundle versions
      if (tool.sessionBundle) {
        newBundleVersions[toolId] = {
          version: tool.sessionBundle.version || 1,
          updatedAt: tool.sessionBundle.updatedAt,
          hasCookies: tool.sessionBundle.hasCookies,
          hasLocalStorage: tool.sessionBundle.hasLocalStorage,
          hasSessionStorage: tool.sessionBundle.hasSessionStorage
        };
      }
      
      // Check for credential updates
      const oldVersion = oldVersions[toolId]?.version || oldVersions[toolId] || 0;
      if (newVersions[toolId].version > oldVersion) {
        credentialUpdates.push({ toolId, name: tool.name });
        // Clear cached credentials for updated tools
        toolCredentialsCache.delete(toolId);
      }
      
      // Check for session bundle updates
      const oldBundleVersion = oldBundleVersions[toolId]?.version || 0;
      if (newBundleVersions[toolId]?.version > oldBundleVersion) {
        sessionBundleUpdates.push({ 
          toolId, 
          name: tool.name,
          oldVersion: oldBundleVersion,
          newVersion: newBundleVersions[toolId].version
        });
        logger.info('Session bundle updated by admin', {
          tool: tool.name,
          oldVersion: oldBundleVersion,
          newVersion: newBundleVersions[toolId].version
        });
      }
    }
    
    // Combine all updates
    const totalUpdates = credentialUpdates.length + sessionBundleUpdates.length;
    
    if (totalUpdates > 0) {
      logger.info('Updates available', { 
        credentials: credentialUpdates.length,
        sessionBundles: sessionBundleUpdates.length
      });
      
      // Show badge for updates
      chrome.action.setBadgeText({ text: String(totalUpdates) });
      chrome.action.setBadgeBackgroundColor({ color: '#22c55e' }); // Green for session updates
      
      // Store updated versions
      await setStorage({ 
        toolVersions: newVersions,
        sessionBundleVersions: newBundleVersions,
        tools: tools // Cache full tool list
      });
      
      // Notify about session bundle updates (important for user)
      if (sessionBundleUpdates.length > 0) {
        const toolNames = sessionBundleUpdates.map(u => u.name).join(', ');
        chrome.notifications.create({
          type: 'basic',
          iconUrl: 'icons/icon128.png',
          title: 'Session Data Updated',
          message: `Admin updated session data for: ${toolNames}. Changes will apply automatically on next login.`
        });
      }
    } else {
      chrome.action.setBadgeText({ text: '' });
    }
    
    // Update cached tool mappings
    await loadCachedData();
    
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
    // Get credentials (includes session bundle)
    const credentialData = await getToolCredentials(tool.id);
    
    if (!credentialData || !credentialData.credentials) {
      logger.warn('No credentials for tool', { tool: tool.name });
      return;
    }
    
    // Use orchestrator for login with session bundle
    const result = await orchestrator.executeLogin(tool, credentialData.credentials, {
      tabId,
      currentUrl: url,
      sessionBundle: credentialData.sessionBundle,
      toolInfo: credentialData.tool
    });
    
    logger.info('Auto-login result', { 
      tool: tool.name, 
      success: result.success, 
      method: result.method,
      sessionBundleApplied: !!credentialData.sessionBundle
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
    
    // Cache credentials and session bundle together
    const cacheData = {
      credentials: result.credentials,
      sessionBundle: result.sessionBundle || null,
      tool: result.tool || null,
      timestamp: Date.now()
    };
    
    if (result.credentials) {
      toolCredentialsCache.set(toolId, cacheData);
    }
    
    // Return full result for session bundle access
    return cacheData;
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
    // Get credentials (includes session bundle)
    const credentialData = await getToolCredentials(toolId);
    
    if (!credentialData || !credentialData.credentials) {
      return { 
        success: false, 
        error: 'No credentials available for this tool',
        actionableError: 'Credentials not found. Please contact your administrator to configure access.'
      };
    }
    
    // Execute login via orchestrator with session bundle
    const result = await orchestrator.executeLogin(tool, credentialData.credentials, {
      sessionBundle: credentialData.sessionBundle,
      toolInfo: credentialData.tool
    });
    
    // Log tool opened if successful
    if (result.success) {
      await logToolOpened(toolId);
    }
    
    logger.info('One-click login completed', {
      tool: tool.name,
      success: result.success,
      method: result.method,
      requiresManualAction: result.requiresManualAction,
      sessionBundleApplied: !!credentialData.sessionBundle
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
 * This runs on the EXISTING tab - no need to create a new one
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
    
    // For auto-start on existing tab, we directly fill and submit the form
    // This is different from one-click login which opens a new tab
    const loginResult = await executeAutoLoginOnExistingTab(tabId, tool, credentials);
    
    logger.info('Auto-start login result', { 
      tool: tool.name, 
      success: loginResult.success, 
      method: loginResult.method,
      requiresManualAction: loginResult.requiresManualAction
    });
    
    // Log tool opened if successful
    if (loginResult.success) {
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
 * Execute auto-login on an EXISTING tab (user already on login page with ?auto=1)
 * This fills the form and submits it directly - no new tab creation
 */
async function executeAutoLoginOnExistingTab(tabId, tool, credentials) {
  const credType = credentials?.type;
  
  logger.info('Executing auto-login on existing tab', { tabId, credType });
  
  // Inject "Logging in..." overlay
  try {
    await chrome.scripting.executeScript({
      target: { tabId },
      func: (toolName) => {
        const existing = document.getElementById('toolstack-login-overlay');
        if (existing) existing.remove();

        const overlay = document.createElement('div');
        overlay.id = 'toolstack-login-overlay';
        overlay.innerHTML = `
          <div style="
            position: fixed;
            top: 20px;
            right: 20px;
            z-index: 999999;
            background: linear-gradient(135deg, #1a1a2e 0%, #16213e 100%);
            border: 1px solid rgba(255, 140, 0, 0.3);
            border-radius: 12px;
            padding: 16px 24px;
            box-shadow: 0 8px 32px rgba(0, 0, 0, 0.4);
            display: flex;
            align-items: center;
            gap: 12px;
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
          ">
            <div style="
              width: 24px;
              height: 24px;
              border: 3px solid rgba(255, 140, 0, 0.3);
              border-top-color: #ff8c00;
              border-radius: 50%;
              animation: toolstack-spin 1s linear infinite;
            "></div>
            <div>
              <div style="color: white; font-weight: 600; font-size: 14px;">Logging in to ${toolName}...</div>
              <div style="color: rgba(255,255,255,0.6); font-size: 12px; margin-top: 2px;">Please wait</div>
            </div>
            <button id="toolstack-cancel-login" style="
              margin-left: 16px;
              background: transparent;
              border: 1px solid rgba(255,255,255,0.3);
              color: rgba(255,255,255,0.8);
              padding: 6px 12px;
              border-radius: 6px;
              cursor: pointer;
              font-size: 12px;
            ">Cancel</button>
          </div>
          <style>@keyframes toolstack-spin { to { transform: rotate(360deg); } }</style>
        `;
        document.body.appendChild(overlay);
      },
      args: [tool.name]
    });
  } catch (e) {
    logger.warn('Failed to inject overlay', { error: e.message });
  }
  
  // Extract credentials for form fill
  let username = null;
  let password = null;
  let multiStep = false;
  let autoSubmit = true;
  
  // Check combo auth first
  if (tool.comboAuth?.enabled && tool.comboAuth?.formConfig) {
    username = tool.comboAuth.formConfig.username;
    password = tool.comboAuth.formConfig.password;
    multiStep = tool.comboAuth.formConfig.multiStep || false;
    autoSubmit = tool.comboAuth.formConfig.autoSubmit !== false;
  } else if (credType === 'form' && credentials.payload) {
    username = credentials.payload.username;
    password = credentials.payload.password;
    multiStep = credentials.formOptions?.multiStep || credentials.payload?.multiStep || false;
    autoSubmit = credentials.formOptions?.autoSubmit !== false;
  }
  
  if (!username || !password) {
    removeOverlay(tabId);
    return { success: false, error: 'No form credentials configured' };
  }
  
  // Auto-fill delay
  const autoStartDelay = tool.extensionSettings?.autoStartDelay || 800;
  await sleep(autoStartDelay);
  
  // Execute form fill with auto-submit
  try {
    const fillResult = await chrome.scripting.executeScript({
      target: { tabId },
      func: formFillAndSubmitScript,
      args: [username, password, credentials.selectors || {}, multiStep, autoSubmit]
    });
    
    const result = fillResult[0]?.result;
    
    if (!result?.success) {
      removeOverlay(tabId);
      return { success: false, error: result?.error || 'Form fill failed' };
    }
    
    // Wait for form submission to process
    await sleep(3000);
    
    // Check for success (navigated away from login page)
    const successCheck = await checkLoginSuccessOnTab(tabId, tool, credentials.successCheck);
    
    removeOverlay(tabId);
    
    if (successCheck.success) {
      return { success: true, method: 'form_auto', finalUrl: successCheck.currentUrl };
    }
    
    // Check for MFA
    const mfaCheck = await checkForMFAOnTab(tabId);
    if (mfaCheck.hasMFA) {
      return { 
        success: false, 
        requiresManualAction: true, 
        manualActionReason: 'MFA/2FA detected - please complete manually',
        tabId 
      };
    }
    
    return { success: false, error: 'Login did not complete successfully' };
    
  } catch (error) {
    removeOverlay(tabId);
    return { success: false, error: error.message };
  }
}

/**
 * Remove login overlay from tab
 */
async function removeOverlay(tabId) {
  try {
    await chrome.scripting.executeScript({
      target: { tabId },
      func: () => {
        const overlay = document.getElementById('toolstack-login-overlay');
        if (overlay) overlay.remove();
      }
    });
  } catch (e) {}
}

/**
 * Form fill and submit script - injected into page
 * Matches SSO auto-click behavior: fills form and auto-submits
 */
function formFillAndSubmitScript(username, password, customSelectors, multiStep, autoSubmit) {
  const result = { success: false, steps: [], error: null, autoSubmitted: false };
  
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
    '[role="button"][class*="login" i]', '[role="button"][class*="submit" i]',
    'form button:not([type="button"])'
  ].filter(Boolean);

  const nextButtonSelectors = [
    customSelectors?.next,
    'button[class*="next" i]', 'button[id*="next" i]',
    'button:not([type="submit"])[class*="continue" i]',
    'input[type="button"][value*="next" i]'
  ].filter(Boolean);

  // Helper: Find visible element
  const findElement = (selectorList) => {
    for (const selector of selectorList) {
      if (!selector) continue;
      try {
        const el = document.querySelector(selector);
        if (el && el.offsetParent !== null) return el;
        
        // Check iframes
        const iframes = document.querySelectorAll('iframe');
        for (const iframe of iframes) {
          try {
            if (iframe.contentDocument) {
              const iframeEl = iframe.contentDocument.querySelector(selector);
              if (iframeEl && iframeEl.offsetParent !== null) return iframeEl;
            }
          } catch (e) {}
        }
      } catch (e) {}
    }
    return null;
  };

  // Helper: Set input value (React/Vue compatible)
  const setInputValue = (input, value) => {
    input.focus();
    input.value = '';
    
    const nativeSetter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value')?.set;
    if (nativeSetter) {
      nativeSetter.call(input, value);
    } else {
      input.value = value;
    }
    
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

  // Helper: Submit form properly
  const submitForm = (formOrButton) => {
    const form = formOrButton.closest ? formOrButton.closest('form') : formOrButton;
    if (form && typeof form.requestSubmit === 'function') {
      try {
        form.requestSubmit();
        return true;
      } catch (e) {}
    }
    if (formOrButton.click) {
      formOrButton.click();
      return true;
    }
    return false;
  };

  // Helper: Press Enter
  const pressEnter = (el) => {
    el.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', code: 'Enter', keyCode: 13, bubbles: true }));
    el.dispatchEvent(new KeyboardEvent('keyup', { key: 'Enter', code: 'Enter', keyCode: 13, bubbles: true }));
  };

  // STEP 1: Find and fill username
  const usernameField = findElement(usernameSelectors);
  if (!usernameField) {
    result.error = 'Username field not found';
    return result;
  }

  setInputValue(usernameField, username);
  result.steps.push({ field: 'username', success: true });

  // STEP 2: Check for password field
  const passwordField = findElement(passwordSelectors);

  if (passwordField) {
    // Single-step login: fill password and submit
    setInputValue(passwordField, password);
    result.steps.push({ field: 'password', success: true });

    if (autoSubmit) {
      // Small delay before submit (like SSO auto-click)
      setTimeout(() => {
        const submitBtn = findElement(submitSelectors);
        if (submitBtn) {
          submitForm(submitBtn);
          result.steps.push({ action: 'submit', success: true });
        } else {
          pressEnter(passwordField);
          result.steps.push({ action: 'enter_key', success: true });
        }
        result.autoSubmitted = true;
      }, 300);
    }

    result.success = true;
    result.multiStep = false;

  } else if (multiStep) {
    // Multi-step login: click next, wait, then fill password
    const nextBtn = findElement(nextButtonSelectors) || findElement(submitSelectors);
    
    if (nextBtn) {
      clickElement(nextBtn);
      result.steps.push({ action: 'next_click', success: true });
      result.multiStep = true;

      // Schedule password fill after page transition
      setTimeout(() => {
        const pwdField = findElement(passwordSelectors);
        if (pwdField) {
          setInputValue(pwdField, password);
          
          if (autoSubmit) {
            setTimeout(() => {
              const finalSubmit = findElement(submitSelectors);
              if (finalSubmit) {
                submitForm(finalSubmit);
              } else {
                pressEnter(pwdField);
              }
            }, 300);
          }
        }
      }, 1500);

      result.success = true;
    } else {
      result.error = 'Next/submit button not found for multi-step';
    }
  } else {
    // No password field visible, try pressing Enter on username
    if (autoSubmit) {
      pressEnter(usernameField);
      result.steps.push({ action: 'enter_on_username', success: true });
    }
    result.success = true;
  }

  return result;
}

/**
 * Check login success on tab
 */
async function checkLoginSuccessOnTab(tabId, tool, successCheck) {
  try {
    const tab = await chrome.tabs.get(tabId);
    const currentUrl = tab.url || '';
    
    // Check if navigated away from login page
    const isStillOnLogin = /\/(login|signin|auth)/i.test(currentUrl);
    
    // Check success indicators
    if (successCheck?.urlIncludes && currentUrl.includes(successCheck.urlIncludes)) {
      return { success: true, currentUrl };
    }
    
    if (successCheck?.urlExcludes && currentUrl.includes(successCheck.urlExcludes)) {
      return { success: false, currentUrl };
    }
    
    // If navigated to dashboard/home, consider success
    if (!isStillOnLogin && (currentUrl.includes('dashboard') || currentUrl.includes('home') || currentUrl === tool.targetUrl)) {
      return { success: true, currentUrl };
    }
    
    // Check for logged-in elements
    const results = await chrome.scripting.executeScript({
      target: { tabId },
      func: (elementSelector) => {
        if (elementSelector) {
          const el = document.querySelector(elementSelector);
          if (el && el.offsetParent !== null) return { hasElement: true };
        }
        
        // Check common logged-in indicators
        const indicators = [
          '[class*="logout"]', '[class*="signout"]', 'a[href*="logout"]',
          '[class*="user-menu"]', '[class*="avatar"]', '[class*="profile"]'
        ];
        for (const sel of indicators) {
          const el = document.querySelector(sel);
          if (el && el.offsetParent !== null) return { hasElement: true };
        }
        return { hasElement: false };
      },
      args: [successCheck?.elementExists]
    });
    
    if (results[0]?.result?.hasElement) {
      return { success: true, currentUrl };
    }
    
    return { success: !isStillOnLogin, currentUrl };
  } catch (error) {
    return { success: false, error: error.message };
  }
}

/**
 * Check for MFA on tab
 */
async function checkForMFAOnTab(tabId) {
  try {
    const results = await chrome.scripting.executeScript({
      target: { tabId },
      func: () => {
        const mfaSelectors = [
          'input[name*="otp"]', 'input[name*="code"]', 'input[name*="2fa"]',
          'input[name*="totp"]', 'input[placeholder*="code" i]'
        ];
        for (const sel of mfaSelectors) {
          const el = document.querySelector(sel);
          if (el && el.offsetParent !== null) return { hasMFA: true };
        }
        
        const bodyText = document.body.innerText.toLowerCase();
        if (bodyText.includes('verification code') || bodyText.includes('authenticator') || 
            bodyText.includes('2-step') || bodyText.includes('two-factor')) {
          return { hasMFA: true };
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
