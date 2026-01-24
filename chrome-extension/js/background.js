// Background service worker for ToolStack Extension
// Handles auto-sync, credential updates, and request interception

const SYNC_INTERVAL_MINUTES = 15;
const ALARM_NAME = 'toolstack-sync';

// Storage utilities
async function getStorage(keys) {
  return new Promise(resolve => chrome.storage.local.get(keys, resolve));
}

async function setStorage(data) {
  return new Promise(resolve => chrome.storage.local.set(data, resolve));
}

// API request helper
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

// Check for tool version updates
async function checkForUpdates() {
  try {
    const stored = await getStorage(['toolVersions', 'extensionToken']);
    
    if (!stored.extensionToken) {
      console.log('Not authenticated, skipping sync');
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
      }
    }
    
    if (updates.length > 0) {
      console.log('Updates available for tools:', updates);
      
      // Notify user via badge
      chrome.action.setBadgeText({ text: String(updates.length) });
      chrome.action.setBadgeBackgroundColor({ color: '#f97316' });
      
      // Store new versions
      await setStorage({ toolVersions: newVersions });
    } else {
      // Clear badge
      chrome.action.setBadgeText({ text: '' });
    }
    
    // Update last sync time
    await setStorage({ lastSync: new Date().toISOString() });
    
  } catch (error) {
    console.error('Sync check failed:', error);
    
    // If token expired, clear badge
    if (error.message.includes('token') || error.message.includes('401')) {
      chrome.action.setBadgeText({ text: '!' });
      chrome.action.setBadgeBackgroundColor({ color: '#ef4444' });
    }
  }
}

// Set up periodic sync alarm
async function setupSyncAlarm() {
  // Clear existing alarm
  await chrome.alarms.clear(ALARM_NAME);
  
  // Create new alarm
  chrome.alarms.create(ALARM_NAME, {
    delayInMinutes: 1, // First check after 1 minute
    periodInMinutes: SYNC_INTERVAL_MINUTES
  });
  
  console.log(`Sync alarm set for every ${SYNC_INTERVAL_MINUTES} minutes`);
}

// Listen for alarm
chrome.alarms.onAlarm.addListener((alarm) => {
  if (alarm.name === ALARM_NAME) {
    console.log('Running scheduled sync check');
    checkForUpdates();
  }
});

// Listen for extension install/update
chrome.runtime.onInstalled.addListener((details) => {
  console.log('Extension installed/updated:', details.reason);
  setupSyncAlarm();
  
  if (details.reason === 'install') {
    // Open options or welcome page on install
    console.log('Extension installed for the first time');
  }
});

// Listen for browser startup
chrome.runtime.onStartup.addListener(() => {
  console.log('Browser started, setting up sync');
  setupSyncAlarm();
});

// Listen for messages from popup
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.type === 'CHECK_UPDATES') {
    checkForUpdates().then(() => sendResponse({ success: true }));
    return true; // Keep channel open for async response
  }
  
  if (message.type === 'CLEAR_BADGE') {
    chrome.action.setBadgeText({ text: '' });
    sendResponse({ success: true });
  }
  
  if (message.type === 'GET_SYNC_STATUS') {
    getStorage(['lastSync', 'toolVersions']).then(data => {
      sendResponse(data);
    });
    return true;
  }
  
  // Handle cookie injection from popup
  if (message.type === 'INJECT_COOKIES') {
    injectCookies(message.targetUrl, message.cookies)
      .then(result => sendResponse(result))
      .catch(error => sendResponse({ success: false, error: error.message }));
    return true;
  }
  
  // Handle storage injection
  if (message.type === 'INJECT_STORAGE') {
    injectStorage(message.tabId, message.storageType, message.data)
      .then(result => sendResponse(result))
      .catch(error => sendResponse({ success: false, error: error.message }));
    return true;
  }
});

// ============================================================================
// COOKIE INJECTION HELPERS
// ============================================================================

/**
 * Extract domain from URL
 */
function extractDomain(url) {
  try {
    return new URL(url).hostname;
  } catch (e) {
    return url;
  }
}

/**
 * Get base domain for subdomain cookies
 */
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

/**
 * Inject cookies for a target URL
 */
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

/**
 * Inject localStorage/sessionStorage via content script
 */
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
// REQUEST INTERCEPTION FOR TOKEN INJECTION
// ============================================================================

// Track domains that need token injection
let tokenDomains = new Map();

// Load token configurations on startup
async function loadTokenConfigs() {
  const data = await getStorage(null);
  tokenDomains.clear();
  
  for (const [key, value] of Object.entries(data)) {
    if (key.startsWith('token_')) {
      const domain = key.replace('token_', '');
      tokenDomains.set(domain, value);
    }
  }
  
  console.log('Loaded token configs for domains:', Array.from(tokenDomains.keys()));
}

// Listen for storage changes to update token configs
chrome.storage.onChanged.addListener((changes, namespace) => {
  if (namespace === 'local') {
    for (const [key, { newValue, oldValue }] of Object.entries(changes)) {
      if (key.startsWith('token_')) {
        const domain = key.replace('token_', '');
        if (newValue) {
          tokenDomains.set(domain, newValue);
        } else {
          tokenDomains.delete(domain);
        }
      }
    }
  }
});

// Note: declarativeNetRequest would be better for MV3, but for simplicity
// we store tokens and let content scripts handle injection when needed

// Initialize on load
setupSyncAlarm();
loadTokenConfigs();
console.log('ToolStack Extension background worker initialized');
