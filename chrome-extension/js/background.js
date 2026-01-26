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
    
    // Execute login strategies
    const context = { tabId, url };
    const result = await strategyEngine.execute(config, context);
    
    console.log('[Background] Strategy execution result:', result);
    
    // If successful and needs reload, reload the tab
    if (result.success && result.needsReload) {
      await chrome.tabs.reload(tabId);
    }
    
    // Log tool opened
    try {
      await apiRequest(`/tools/${tool.id}/opened`, { method: 'POST' });
    } catch (e) {
      console.warn('[Background] Failed to log tool opened:', e);
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
  
  // Pre-execute strategies that don't need a tab (cookies)
  const preResult = await strategyEngine.preExecute(config);
  
  console.log('[Background] Pre-execute result:', preResult);
  
  // Open the tab
  const tab = await chrome.tabs.create({ url: tool.targetUrl, active: true });
  
  // Wait for tab to load
  await waitForTabLoad(tab.id);
  
  // If cookies were set, reload to apply them
  if (preResult.success && preResult.needsReload) {
    await chrome.tabs.reload(tab.id);
    await waitForTabLoad(tab.id);
  }
  
  // Execute remaining strategies that need a tab
  const context = { tabId: tab.id, url: tool.targetUrl };
  const skipStrategies = preResult.preExecuted || [];
  
  const postResult = await strategyEngine.postExecute(config, context, skipStrategies);
  
  console.log('[Background] Post-execute result:', postResult);
  
  // Final reload if needed
  if (postResult.success && postResult.needsReload) {
    await chrome.tabs.reload(tab.id);
  }
  
  // Log tool opened
  try {
    await apiRequest(`/tools/${toolId}/opened`, { method: 'POST' });
  } catch (e) {
    console.warn('[Background] Failed to log tool opened:', e);
  }
  
  return {
    success: preResult.success || postResult.success,
    preResult,
    postResult,
    tabId: tab.id
  };
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
