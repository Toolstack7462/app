import { Storage, ApiClient } from './api.js';

// Initialize API client
const api = new ApiClient();

// State
let tools = [];
let profile = null;
let toolVersions = {};
let grantedPermissions = new Set();

// DOM Elements
const loginView = document.getElementById('login-view');
const mainView = document.getElementById('main-view');
const profileView = document.getElementById('profile-view');
const loginForm = document.getElementById('login-form');
const loginError = document.getElementById('login-error');
const loginBtn = document.getElementById('login-btn');
const showConfigBtn = document.getElementById('show-config-btn');
const configSection = document.getElementById('config-section');
const apiUrlInput = document.getElementById('api-url');
const saveConfigBtn = document.getElementById('save-config-btn');
const searchInput = document.getElementById('search-input');
const toolsList = document.getElementById('tools-list');
const noTools = document.getElementById('no-tools');
const loading = document.getElementById('loading');
const syncBtn = document.getElementById('sync-btn');
const profileBtn = document.getElementById('profile-btn');
const backBtn = document.getElementById('back-btn');
const logoutBtn = document.getElementById('logout-btn');
const syncText = document.getElementById('sync-text');
const profileName = document.getElementById('profile-name');
const profileEmail = document.getElementById('profile-email');
const toolsCount = document.getElementById('tools-count');
const tokenExpires = document.getElementById('token-expires');
const permissionModal = document.getElementById('permission-modal');
const permissionDomain = document.getElementById('permission-domain');
const cancelPermission = document.getElementById('cancel-permission');
const grantPermission = document.getElementById('grant-permission');

// Current tool for permission request
let currentPermissionTool = null;

// Initialize
async function init() {
  await api.init();
  
  // Load stored data
  const data = await Storage.get(['extensionToken', 'apiUrl', 'tools', 'lastSync', 'toolVersions']);
  
  if (data.apiUrl) {
    apiUrlInput.value = data.apiUrl;
  }
  
  if (data.tools) {
    tools = data.tools;
    toolVersions = data.toolVersions || {};
  }
  
  // Check if logged in
  if (data.extensionToken) {
    api.setToken(data.extensionToken);
    showMainView();
    await refreshTools();
  } else {
    showLoginView();
  }
  
  // Update sync text
  if (data.lastSync) {
    updateSyncText(new Date(data.lastSync));
  }
  
  // Check granted permissions
  await updateGrantedPermissions();
}

// View management
function showLoginView() {
  loginView.classList.remove('hidden');
  mainView.classList.add('hidden');
  profileView.classList.add('hidden');
}

function showMainView() {
  loginView.classList.add('hidden');
  mainView.classList.remove('hidden');
  profileView.classList.add('hidden');
  renderTools();
}

function showProfileView() {
  loginView.classList.add('hidden');
  mainView.classList.add('hidden');
  profileView.classList.remove('hidden');
  loadProfile();
}

// Login
loginForm.addEventListener('submit', async (e) => {
  e.preventDefault();
  
  const email = document.getElementById('email').value.trim();
  const password = document.getElementById('password').value;
  
  if (!api.baseUrl) {
    showError('Please configure the API URL first');
    return;
  }
  
  loginBtn.disabled = true;
  hideError();
  
  try {
    const result = await api.login(email, password);
    
    // Store token
    await Storage.set({
      extensionToken: result.token,
      tokenExpiresAt: result.expiresAt,
      userEmail: result.user.email,
      userName: result.user.name || result.user.email
    });
    
    api.setToken(result.token);
    showMainView();
    await refreshTools();
  } catch (error) {
    showError(error.message || 'Login failed');
  } finally {
    loginBtn.disabled = false;
  }
});

// Logout
logoutBtn.addEventListener('click', async () => {
  try {
    await api.logout();
  } catch (e) {
    // Ignore logout errors
  }
  
  await Storage.clear();
  api.setToken(null);
  tools = [];
  showLoginView();
});

// Config toggle
showConfigBtn.addEventListener('click', () => {
  configSection.classList.toggle('hidden');
});

// Save config
saveConfigBtn.addEventListener('click', async () => {
  const url = apiUrlInput.value.trim().replace(/\/$/, '');
  if (!url) {
    showError('Please enter a valid API URL');
    return;
  }
  
  await Storage.set({ apiUrl: url });
  api.setBaseUrl(url);
  configSection.classList.add('hidden');
});

// Sync
syncBtn.addEventListener('click', async () => {
  syncBtn.classList.add('syncing');
  await refreshTools();
  syncBtn.classList.remove('syncing');
});

// Profile
profileBtn.addEventListener('click', showProfileView);
backBtn.addEventListener('click', showMainView);

// Search
searchInput.addEventListener('input', (e) => {
  renderTools(e.target.value);
});

// Tools
async function refreshTools() {
  loading.classList.remove('hidden');
  toolsList.classList.add('hidden');
  noTools.classList.add('hidden');
  
  try {
    const result = await api.getTools();
    tools = result.tools || [];
    
    // Update versions
    toolVersions = {};
    tools.forEach(tool => {
      toolVersions[tool.id] = tool.credentialVersion;
    });
    
    // Store
    await Storage.set({
      tools,
      toolVersions,
      lastSync: new Date().toISOString()
    });
    
    updateSyncText(new Date());
    await updateGrantedPermissions();
    renderTools();
  } catch (error) {
    console.error('Failed to refresh tools:', error);
    if (error.message.includes('token') || error.message.includes('401')) {
      await Storage.clear();
      showLoginView();
      return;
    }
    renderTools(); // Show cached tools
  } finally {
    loading.classList.add('hidden');
    toolsList.classList.remove('hidden');
  }
}

function renderTools(search = '') {
  const filteredTools = tools.filter(tool => 
    tool.name.toLowerCase().includes(search.toLowerCase()) ||
    (tool.domain && tool.domain.toLowerCase().includes(search.toLowerCase()))
  );
  
  if (filteredTools.length === 0) {
    toolsList.innerHTML = '';
    noTools.classList.remove('hidden');
    return;
  }
  
  noTools.classList.add('hidden');
  
  toolsList.innerHTML = filteredTools.map(tool => {
    const hasPermission = grantedPermissions.has(tool.domain) || !tool.domain;
    const status = getToolStatus(tool, hasPermission);
    
    return `
      <div class="tool-card ${!hasPermission ? 'needs-permission' : ''}" 
           data-tool-id="${tool.id}" 
           data-domain="${tool.domain || ''}">
        <div class="tool-icon">${tool.name.charAt(0).toUpperCase()}</div>
        <div class="tool-info">
          <div class="tool-name">${escapeHtml(tool.name)}</div>
          <div class="tool-domain">${escapeHtml(tool.domain || tool.targetUrl)}</div>
        </div>
        <div class="tool-status">
          <span class="status-badge ${status.class}">${status.text}</span>
          ${hasPermission 
            ? `<button class="tool-action open-btn" data-tool-id="${tool.id}">Open</button>`
            : `<button class="tool-action grant-btn" data-tool-id="${tool.id}" data-domain="${tool.domain}">Grant</button>`
          }
        </div>
      </div>
    `;
  }).join('');
  
  // Add click handlers
  toolsList.querySelectorAll('.open-btn').forEach(btn => {
    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      openTool(btn.dataset.toolId);
    });
  });
  
  toolsList.querySelectorAll('.grant-btn').forEach(btn => {
    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      requestPermission(btn.dataset.toolId, btn.dataset.domain);
    });
  });
  
  toolsList.querySelectorAll('.tool-card').forEach(card => {
    card.addEventListener('click', () => {
      const hasPermission = grantedPermissions.has(card.dataset.domain) || !card.dataset.domain;
      if (hasPermission) {
        openTool(card.dataset.toolId);
      } else {
        requestPermission(card.dataset.toolId, card.dataset.domain);
      }
    });
  });
}

function getToolStatus(tool, hasPermission) {
  if (!hasPermission) {
    return { class: 'permission-needed', text: 'Grant Access' };
  }
  
  if (tool.assignment?.endDate) {
    const endDate = new Date(tool.assignment.endDate);
    if (endDate < new Date()) {
      return { class: 'expired', text: 'Expired' };
    }
    
    const daysLeft = Math.ceil((endDate - new Date()) / (1000 * 60 * 60 * 24));
    if (daysLeft <= 7) {
      return { class: 'update-available', text: `${daysLeft}d left` };
    }
  }
  
  if (!tool.hasCredentials) {
    return { class: 'update-available', text: 'No credentials' };
  }
  
  return { class: 'up-to-date', text: 'Ready' };
}

// ============================================================================
// ENHANCED COOKIE/CREDENTIAL INJECTION SYSTEM
// ============================================================================

/**
 * Extract domain from URL supporting subdomains
 */
function extractDomain(url) {
  try {
    const urlObj = new URL(url);
    return urlObj.hostname;
  } catch (e) {
    return url;
  }
}

/**
 * Get the base domain (e.g., example.com from sub.example.com)
 */
function getBaseDomain(hostname) {
  const parts = hostname.split('.');
  if (parts.length <= 2) return hostname;
  // Handle common TLDs like .co.uk, .com.au
  const commonMultiPartTLDs = ['co.uk', 'com.au', 'co.nz', 'co.in', 'com.br'];
  const lastTwo = parts.slice(-2).join('.');
  if (commonMultiPartTLDs.includes(lastTwo)) {
    return parts.slice(-3).join('.');
  }
  return parts.slice(-2).join('.');
}

/**
 * Build the correct cookie URL based on domain and secure flag
 */
function buildCookieUrl(domain, secure = true) {
  const protocol = secure ? 'https' : 'http';
  // Remove leading dot for URL construction
  const cleanDomain = domain.startsWith('.') ? domain.substring(1) : domain;
  return `${protocol}://${cleanDomain}/`;
}

/**
 * Apply cookies with proper domain handling and verification
 * @returns {Object} Result with success status and details
 */
async function applyCookiesEnhanced(targetUrl, cookies) {
  if (!Array.isArray(cookies) || cookies.length === 0) {
    return { success: false, error: 'No cookies provided', set: 0, failed: 0, failures: [] };
  }
  
  const targetDomain = extractDomain(targetUrl);
  const baseDomain = getBaseDomain(targetDomain);
  const isHttps = targetUrl.startsWith('https');
  
  console.log(`[CookieInjector] Target URL: ${targetUrl}`);
  console.log(`[CookieInjector] Target domain: ${targetDomain}, Base domain: ${baseDomain}`);
  console.log(`[CookieInjector] Cookies to set: ${cookies.length}`);
  
  let setCount = 0;
  let failedCount = 0;
  const failures = [];
  
  for (const cookie of cookies) {
    try {
      // Determine the cookie domain
      let cookieDomain = cookie.domain || targetDomain;
      
      // Handle subdomain cookies - if cookie domain starts with dot, it's for all subdomains
      if (cookieDomain.startsWith('.')) {
        // Subdomain cookie - use as-is
      } else if (!cookieDomain.includes(targetDomain) && !targetDomain.includes(cookieDomain)) {
        // Domain mismatch - try to use a compatible domain
        console.warn(`[CookieInjector] Domain mismatch: cookie=${cookieDomain}, target=${targetDomain}`);
        cookieDomain = targetDomain;
      }
      
      // Determine secure flag
      const secure = cookie.secure === true || (cookie.secure !== false && isHttps);
      
      // Handle SameSite attribute
      let sameSite = (cookie.sameSite || 'lax').toLowerCase();
      // Normalize SameSite value
      if (sameSite === 'no_restriction' || sameSite === 'none') {
        sameSite = 'no_restriction';
      } else if (sameSite === 'strict') {
        sameSite = 'strict';
      } else {
        sameSite = 'lax';
      }
      
      // If SameSite=None, cookie must be Secure
      const finalSecure = sameSite === 'no_restriction' ? true : secure;
      
      // Build cookie URL
      const cookieUrl = buildCookieUrl(cookieDomain, finalSecure);
      
      const cookieDetails = {
        url: cookieUrl,
        name: cookie.name,
        value: cookie.value,
        path: cookie.path || '/',
        secure: finalSecure,
        httpOnly: cookie.httpOnly === true,
        sameSite: sameSite
      };
      
      // Only set domain if it's a subdomain cookie (starts with dot)
      if (cookieDomain.startsWith('.')) {
        cookieDetails.domain = cookieDomain;
      }
      
      // Handle expiration
      if (cookie.expirationDate) {
        cookieDetails.expirationDate = cookie.expirationDate;
      } else if (cookie.expires) {
        // Convert expires string to timestamp
        const expiresDate = new Date(cookie.expires);
        if (!isNaN(expiresDate.getTime())) {
          cookieDetails.expirationDate = expiresDate.getTime() / 1000;
        }
      } else {
        // Set expiration to 30 days from now if not specified
        cookieDetails.expirationDate = Math.floor(Date.now() / 1000) + (30 * 24 * 60 * 60);
      }
      
      console.log(`[CookieInjector] Setting cookie: ${cookie.name}`, cookieDetails);
      
      const result = await chrome.cookies.set(cookieDetails);
      
      if (result) {
        setCount++;
        console.log(`[CookieInjector] ✓ Cookie set: ${cookie.name}`);
      } else {
        throw new Error('chrome.cookies.set returned null');
      }
    } catch (error) {
      failedCount++;
      const failureReason = diagnoseCookieFailure(cookie, targetUrl, error);
      failures.push({ name: cookie.name, reason: failureReason, error: error.message });
      console.error(`[CookieInjector] ✗ Failed to set cookie: ${cookie.name}`, failureReason);
    }
  }
  
  // Verify cookies were set
  const verification = await verifyCookies(targetUrl, cookies);
  
  return {
    success: setCount > 0 && failedCount === 0,
    partial: setCount > 0 && failedCount > 0,
    set: setCount,
    failed: failedCount,
    failures,
    verification
  };
}

/**
 * Diagnose why a cookie failed to set
 */
function diagnoseCookieFailure(cookie, targetUrl, error) {
  const isHttps = targetUrl.startsWith('https');
  const targetDomain = extractDomain(targetUrl);
  const cookieDomain = cookie.domain || targetDomain;
  
  // Check for Secure flag issues
  if (cookie.secure && !isHttps) {
    return 'SECURE_FLAG_REQUIRES_HTTPS: Cookie has Secure flag but target URL is HTTP';
  }
  
  // Check for SameSite=None without Secure
  if ((cookie.sameSite || '').toLowerCase() === 'none' && !cookie.secure) {
    return 'SAMESITE_NONE_REQUIRES_SECURE: SameSite=None cookies must have Secure flag';
  }
  
  // Check for domain mismatch
  if (cookieDomain && !targetDomain.endsWith(cookieDomain.replace(/^\./, ''))) {
    return `DOMAIN_MISMATCH: Cookie domain "${cookieDomain}" does not match target "${targetDomain}"`;
  }
  
  // Check for invalid path
  if (cookie.path && !cookie.path.startsWith('/')) {
    return `INVALID_PATH: Cookie path must start with "/" (got "${cookie.path}")`;
  }
  
  return `UNKNOWN_ERROR: ${error.message}`;
}

/**
 * Verify that cookies were actually set by reading them back
 */
async function verifyCookies(targetUrl, expectedCookies) {
  const targetDomain = extractDomain(targetUrl);
  
  try {
    // Get all cookies for this domain
    const actualCookies = await chrome.cookies.getAll({ domain: targetDomain });
    
    // Also check with leading dot for subdomain cookies
    const subdomainCookies = await chrome.cookies.getAll({ domain: `.${getBaseDomain(targetDomain)}` });
    
    const allCookies = [...actualCookies, ...subdomainCookies];
    const actualNames = new Set(allCookies.map(c => c.name));
    
    const verified = [];
    const missing = [];
    
    for (const expected of expectedCookies) {
      if (actualNames.has(expected.name)) {
        verified.push(expected.name);
      } else {
        missing.push(expected.name);
      }
    }
    
    return {
      success: missing.length === 0,
      verified,
      missing,
      totalFound: allCookies.length,
      cookieNames: Array.from(actualNames)
    };
  } catch (error) {
    return {
      success: false,
      error: error.message,
      verified: [],
      missing: expectedCookies.map(c => c.name)
    };
  }
}

/**
 * Apply localStorage/sessionStorage credentials via content script
 */
async function applyStorageCredentials(tabId, storageData, storageType = 'localStorage') {
  return new Promise((resolve, reject) => {
    chrome.scripting.executeScript({
      target: { tabId },
      func: (data, type) => {
        const storage = type === 'sessionStorage' ? sessionStorage : localStorage;
        let setCount = 0;
        const errors = [];
        
        for (const [key, value] of Object.entries(data)) {
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
      args: [storageData, storageType]
    }).then(results => {
      resolve(results[0]?.result || { success: false, error: 'No result from content script' });
    }).catch(reject);
  });
}

/**
 * Open tool with proper credential injection workflow:
 * 1. Apply credentials FIRST
 * 2. Open tab
 * 3. Wait for tab to load
 * 4. Reload to apply cookies
 * 5. Verify and report status
 */
async function openTool(toolId) {
  const tool = tools.find(t => t.id === toolId);
  if (!tool) {
    alert('Tool not found');
    return;
  }
  
  // Show loading state
  const openBtn = document.querySelector(`[data-tool-id="${toolId}"].open-btn`);
  if (openBtn) {
    openBtn.textContent = 'Loading...';
    openBtn.disabled = true;
  }
  
  try {
    // Fetch credentials from API
    const result = await api.getCredentials(toolId);
    
    if (!result.credentials) {
      // No credentials, just open the tool
      chrome.tabs.create({ url: tool.targetUrl });
      await api.logToolOpened(toolId);
      return;
    }
    
    const credentials = result.credentials;
    const targetUrl = tool.targetUrl;
    
    console.log(`[ToolOpen] Opening tool: ${tool.name}, credential type: ${credentials.type}`);
    
    // Handle different credential types
    if (credentials.type === 'cookies') {
      // STEP 1: Apply cookies BEFORE opening tab
      console.log('[ToolOpen] Step 1: Applying cookies before opening tab...');
      const cookieResult = await applyCookiesEnhanced(targetUrl, credentials.data);
      
      console.log('[ToolOpen] Cookie injection result:', cookieResult);
      
      // STEP 2: Open the tab
      console.log('[ToolOpen] Step 2: Opening tab...');
      const tab = await chrome.tabs.create({ url: targetUrl, active: true });
      
      // STEP 3: Wait for tab to load, then reload to ensure cookies are applied
      console.log('[ToolOpen] Step 3: Waiting for tab to load...');
      await waitForTabLoad(tab.id);
      
      // STEP 4: Reload the tab to ensure cookies are sent with requests
      console.log('[ToolOpen] Step 4: Reloading tab to apply cookies...');
      await chrome.tabs.reload(tab.id);
      await waitForTabLoad(tab.id);
      
      // STEP 5: Verify and show result
      if (!cookieResult.success && !cookieResult.partial) {
        showCredentialError('cookies', cookieResult);
      } else if (cookieResult.partial) {
        showCredentialWarning('cookies', cookieResult);
      } else {
        console.log('[ToolOpen] ✓ All cookies applied successfully');
      }
      
    } else if (credentials.type === 'localStorage' || credentials.type === 'sessionStorage') {
      // For storage credentials, we need to open the tab first, then inject
      console.log(`[ToolOpen] Applying ${credentials.type} credentials...`);
      
      // STEP 1: Open the tab
      const tab = await chrome.tabs.create({ url: targetUrl, active: true });
      
      // STEP 2: Wait for initial load
      await waitForTabLoad(tab.id);
      
      // STEP 3: Inject storage credentials
      const storageResult = await applyStorageCredentials(
        tab.id, 
        credentials.data, 
        credentials.type
      );
      
      console.log(`[ToolOpen] ${credentials.type} injection result:`, storageResult);
      
      // STEP 4: Reload to apply
      await chrome.tabs.reload(tab.id);
      
      if (!storageResult.success) {
        showStorageInstructions(credentials.type, credentials.data);
      }
      
    } else if (credentials.type === 'token') {
      // Token credentials - store for background script to inject in headers
      const domain = extractDomain(targetUrl);
      await Storage.set({
        [`token_${domain}`]: credentials.data
      });
      
      // Open the tool
      chrome.tabs.create({ url: targetUrl });
      
    } else {
      // Unknown credential type - just open the tool
      console.warn('[ToolOpen] Unknown credential type:', credentials.type);
      chrome.tabs.create({ url: targetUrl });
    }
    
    // Log tool opened
    await api.logToolOpened(toolId);
    
  } catch (error) {
    console.error('[ToolOpen] Failed to open tool:', error);
    alert('Failed to load credentials: ' + error.message);
  } finally {
    // Reset button state
    if (openBtn) {
      openBtn.textContent = 'Open';
      openBtn.disabled = false;
    }
  }
}

/**
 * Wait for a tab to finish loading
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

/**
 * Show error details for failed cookie injection
 */
function showCredentialError(type, result) {
  let message = `Failed to apply ${type}.\n\n`;
  
  if (result.failures && result.failures.length > 0) {
    message += 'Failure reasons:\n';
    result.failures.forEach(f => {
      message += `• ${f.name}: ${f.reason}\n`;
    });
  }
  
  if (result.verification && result.verification.missing.length > 0) {
    message += `\nMissing cookies: ${result.verification.missing.join(', ')}`;
  }
  
  message += '\n\nPlease check that the cookies are valid and try again.';
  
  alert(message);
}

/**
 * Show warning for partially successful cookie injection
 */
function showCredentialWarning(type, result) {
  let message = `Partially applied ${type}: ${result.set} set, ${result.failed} failed.\n\n`;
  
  if (result.failures && result.failures.length > 0) {
    message += 'Failed items:\n';
    result.failures.slice(0, 5).forEach(f => {
      message += `• ${f.name}: ${f.reason}\n`;
    });
    if (result.failures.length > 5) {
      message += `... and ${result.failures.length - 5} more\n`;
    }
  }
  
  message += '\nSome functionality may not work correctly.';
  
  alert(message);
}

/**
 * Show instructions for manual storage credential setup
 */
function showStorageInstructions(storageType, data) {
  const keys = Object.keys(data);
  let message = `Could not automatically set ${storageType}.\n\n`;
  message += 'Please manually add these values using browser DevTools:\n\n';
  message += `1. Open DevTools (F12)\n`;
  message += `2. Go to Application tab\n`;
  message += `3. Find "${storageType}" in the sidebar\n`;
  message += `4. Add these key-value pairs:\n\n`;
  
  keys.slice(0, 5).forEach(key => {
    const value = typeof data[key] === 'string' ? data[key] : JSON.stringify(data[key]);
    const displayValue = value.length > 50 ? value.substring(0, 50) + '...' : value;
    message += `   ${key}: ${displayValue}\n`;
  });
  
  if (keys.length > 5) {
    message += `   ... and ${keys.length - 5} more keys`;
  }
  
  alert(message);
}

// Permission handling
async function updateGrantedPermissions() {
  const permissions = await chrome.permissions.getAll();
  grantedPermissions = new Set();
  
  if (permissions.origins) {
    permissions.origins.forEach(origin => {
      try {
        const url = new URL(origin.replace('/*', ''));
        grantedPermissions.add(url.hostname);
      } catch (e) {
        // Ignore invalid URLs
      }
    });
  }
}

function requestPermission(toolId, domain) {
  currentPermissionTool = { toolId, domain };
  permissionDomain.querySelector('strong').textContent = domain;
  permissionModal.classList.remove('hidden');
}

cancelPermission.addEventListener('click', () => {
  permissionModal.classList.add('hidden');
  currentPermissionTool = null;
});

grantPermission.addEventListener('click', async () => {
  if (!currentPermissionTool) return;
  
  const { toolId, domain } = currentPermissionTool;
  
  try {
    const granted = await chrome.permissions.request({
      origins: [`https://${domain}/*`, `http://${domain}/*`]
    });
    
    if (granted) {
      grantedPermissions.add(domain);
      renderTools(searchInput.value);
      
      // Automatically open the tool after permission granted
      await openTool(toolId);
    }
  } catch (error) {
    console.error('Permission request failed:', error);
  }
  
  permissionModal.classList.add('hidden');
  currentPermissionTool = null;
});

// Profile
async function loadProfile() {
  try {
    const result = await api.getProfile();
    profile = result.user;
    
    profileName.textContent = result.user.name || result.user.email;
    profileEmail.textContent = result.user.email;
    toolsCount.textContent = tools.length;
    
    if (result.token?.expiresAt) {
      const expiresAt = new Date(result.token.expiresAt);
      const daysLeft = Math.ceil((expiresAt - new Date()) / (1000 * 60 * 60 * 24));
      tokenExpires.textContent = `${daysLeft}d`;
    }
  } catch (error) {
    console.error('Failed to load profile:', error);
    profileName.textContent = 'Error loading profile';
  }
}

// Helpers
function showError(message) {
  loginError.textContent = message;
  loginError.classList.remove('hidden');
}

function hideError() {
  loginError.classList.add('hidden');
}

function updateSyncText(date) {
  const now = new Date();
  const diff = now - date;
  
  if (diff < 60000) {
    syncText.textContent = 'Last synced: Just now';
  } else if (diff < 3600000) {
    const mins = Math.floor(diff / 60000);
    syncText.textContent = `Last synced: ${mins}m ago`;
  } else if (diff < 86400000) {
    const hours = Math.floor(diff / 3600000);
    syncText.textContent = `Last synced: ${hours}h ago`;
  } else {
    syncText.textContent = `Last synced: ${date.toLocaleDateString()}`;
  }
}

function escapeHtml(text) {
  const div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
}

// Initialize on load
init();
