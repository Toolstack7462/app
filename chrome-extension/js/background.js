// Background service worker for ToolStack Extension
// Handles auto-sync and credential updates

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
});

// Handle web requests for token injection (if needed)
// This is for tools that need bearer tokens in headers
chrome.webRequest?.onBeforeSendHeaders?.addListener(
  async (details) => {
    // Get stored tokens
    const url = new URL(details.url);
    const domain = url.hostname;
    
    const data = await getStorage([`token_${domain}`]);
    const tokenConfig = data[`token_${domain}`];
    
    if (tokenConfig) {
      const headerName = tokenConfig.header || 'Authorization';
      const headerValue = (tokenConfig.prefix || 'Bearer ') + tokenConfig.value;
      
      // Check if header already exists
      const existingHeader = details.requestHeaders.find(
        h => h.name.toLowerCase() === headerName.toLowerCase()
      );
      
      if (!existingHeader) {
        details.requestHeaders.push({
          name: headerName,
          value: headerValue
        });
      }
    }
    
    return { requestHeaders: details.requestHeaders };
  },
  { urls: ['<all_urls>'] },
  ['blocking', 'requestHeaders']
);

// Initialize on load
setupSyncAlarm();
console.log('ToolStack Extension background worker initialized');
