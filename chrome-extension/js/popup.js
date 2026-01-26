import { Storage, ApiClient } from './api.js';

// Initialize API client
const api = new ApiClient();

// State
let tools = [];
let profile = null;
let toolVersions = {};
let grantedPermissions = new Set();
let loginInProgress = new Map();

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

// ============================================================================
// INITIALIZATION
// ============================================================================

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
  
  // Notify background to refresh domain map
  chrome.runtime.sendMessage({ type: 'REFRESH_DOMAIN_MAP' });
}

// ============================================================================
// VIEW MANAGEMENT
// ============================================================================

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

// ============================================================================
// AUTHENTICATION
// ============================================================================

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

// ============================================================================
// CONFIGURATION
// ============================================================================

showConfigBtn.addEventListener('click', () => {
  configSection.classList.toggle('hidden');
});

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

// ============================================================================
// SYNC
// ============================================================================

syncBtn.addEventListener('click', async () => {
  syncBtn.classList.add('syncing');
  await refreshTools();
  syncBtn.classList.remove('syncing');
});

profileBtn.addEventListener('click', showProfileView);
backBtn.addEventListener('click', showMainView);

searchInput.addEventListener('input', (e) => {
  renderTools(e.target.value);
});

// ============================================================================
// TOOLS MANAGEMENT
// ============================================================================

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
    
    // Notify background to refresh domain map
    chrome.runtime.sendMessage({ type: 'REFRESH_DOMAIN_MAP' });
    
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
    const isLoading = loginInProgress.has(tool.id);
    
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
            ? `<button class="tool-action open-btn ${isLoading ? 'loading' : ''}" 
                       data-tool-id="${tool.id}" 
                       ${isLoading ? 'disabled' : ''}>
                ${isLoading ? '<span class="btn-spinner"></span>' : 'Open'}
              </button>`
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
      if (!btn.disabled) {
        oneClickLogin(btn.dataset.toolId);
      }
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
        oneClickLogin(card.dataset.toolId);
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
// ONE-CLICK LOGIN
// ============================================================================

async function oneClickLogin(toolId) {
  const tool = tools.find(t => t.id === toolId);
  if (!tool) {
    showToast('Tool not found', 'error');
    return;
  }
  
  // Check if already in progress
  if (loginInProgress.has(toolId)) {
    return;
  }
  
  // Mark as in progress
  loginInProgress.set(toolId, true);
  renderTools(searchInput.value);
  
  console.log(`[Popup] One-click login for: ${tool.name}`);
  
  try {
    // Send to background for execution
    const result = await new Promise((resolve, reject) => {
      chrome.runtime.sendMessage({
        type: 'ONE_CLICK_LOGIN',
        toolId,
        tool
      }, (response) => {
        if (chrome.runtime.lastError) {
          reject(new Error(chrome.runtime.lastError.message));
        } else {
          resolve(response);
        }
      });
    });
    
    console.log('[Popup] One-click login result:', result);
    
    if (result.success) {
      showToast(`Logged in to ${tool.name}`, 'success');
    } else if (result.error) {
      showToast(`Login failed: ${result.error}`, 'error');
    } else {
      // Partial success or strategies executed
      showToast(`Opening ${tool.name}...`, 'info');
    }
    
  } catch (error) {
    console.error('[Popup] One-click login error:', error);
    
    // Fallback: try traditional method
    await fallbackOpen(tool);
  } finally {
    loginInProgress.delete(toolId);
    renderTools(searchInput.value);
  }
}

/**
 * Fallback to traditional open method
 */
async function fallbackOpen(tool) {
  try {
    // Fetch credentials from API
    const result = await api.getCredentials(tool.id);
    
    if (!result.credentials) {
      // No credentials, just open the tool
      chrome.tabs.create({ url: tool.targetUrl });
      await api.logToolOpened(tool.id);
      return;
    }
    
    const credentials = result.credentials;
    const targetUrl = tool.targetUrl;
    
    console.log(`[Popup] Fallback open: ${tool.name}, credential type: ${credentials.type}`);
    
    // Handle different credential types
    if (credentials.type === 'cookies') {
      // Apply cookies before opening
      await new Promise((resolve, reject) => {
        chrome.runtime.sendMessage({
          type: 'INJECT_COOKIES',
          targetUrl,
          cookies: credentials.data
        }, (response) => {
          if (chrome.runtime.lastError) {
            reject(new Error(chrome.runtime.lastError.message));
          } else {
            resolve(response);
          }
        });
      });
      
      // Open and reload
      const tab = await chrome.tabs.create({ url: targetUrl, active: true });
      await waitForTabLoad(tab.id);
      await chrome.tabs.reload(tab.id);
      
    } else if (credentials.type === 'localStorage' || credentials.type === 'sessionStorage') {
      // Open tab first, then inject storage
      const tab = await chrome.tabs.create({ url: targetUrl, active: true });
      await waitForTabLoad(tab.id);
      
      await new Promise((resolve, reject) => {
        chrome.runtime.sendMessage({
          type: 'INJECT_STORAGE',
          tabId: tab.id,
          storageType: credentials.type,
          data: credentials.data
        }, (response) => {
          if (chrome.runtime.lastError) {
            reject(new Error(chrome.runtime.lastError.message));
          } else {
            resolve(response);
          }
        });
      });
      
      await chrome.tabs.reload(tab.id);
      
    } else {
      // Unknown type, just open
      chrome.tabs.create({ url: targetUrl });
    }
    
    // Log tool opened
    await api.logToolOpened(tool.id);
    
  } catch (error) {
    console.error('[Popup] Fallback open failed:', error);
    // Last resort: just open the URL
    chrome.tabs.create({ url: tool.targetUrl });
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
// PERMISSION HANDLING
// ============================================================================

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
      
      // Automatically trigger one-click login after permission granted
      await oneClickLogin(toolId);
    }
  } catch (error) {
    console.error('Permission request failed:', error);
  }
  
  permissionModal.classList.add('hidden');
  currentPermissionTool = null;
});

// ============================================================================
// PROFILE
// ============================================================================

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

// ============================================================================
// UTILITIES
// ============================================================================

function showError(message) {
  loginError.textContent = message;
  loginError.classList.remove('hidden');
}

function hideError() {
  loginError.classList.add('hidden');
}

function showToast(message, type = 'info') {
  // Create toast element if it doesn't exist
  let toast = document.getElementById('toast');
  if (!toast) {
    toast = document.createElement('div');
    toast.id = 'toast';
    document.body.appendChild(toast);
  }
  
  toast.textContent = message;
  toast.className = `toast toast-${type} show`;
  
  setTimeout(() => {
    toast.classList.remove('show');
  }, 3000);
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

// ============================================================================
// INITIALIZE
// ============================================================================

init();
