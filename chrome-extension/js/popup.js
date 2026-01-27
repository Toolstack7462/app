/**
 * Popup Script v2.1 for ToolStack Extension
 * 
 * Enhanced with:
 * - Improved error messages for users
 * - Debug mode toggle
 * - Login status indicators
 * - Retry UI for failed logins
 */

import { Storage, ApiClient } from './api.js';

// Initialize API client
const api = new ApiClient();

// State
let tools = [];
let profile = null;
let toolVersions = {};
let grantedPermissions = new Set();
let loginInProgress = new Map();
let debugMode = false;

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
  const data = await Storage.get(['extensionToken', 'apiUrl', 'tools', 'lastSync', 'toolVersions', 'debugMode']);
  
  if (data.apiUrl) {
    apiUrlInput.value = data.apiUrl;
  }
  
  if (data.tools) {
    tools = data.tools;
    toolVersions = data.toolVersions || {};
  }
  
  debugMode = data.debugMode || false;
  
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
  
  // Setup debug mode UI if exists
  setupDebugUI();
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
    const loginState = loginInProgress.get(tool.id);
    const isLoading = loginState?.status === 'loading';
    const hasError = loginState?.status === 'error';
    const needsManualAction = loginState?.status === 'manual';
    
    return `
      <div class="tool-card ${!hasPermission ? 'needs-permission' : ''} ${hasError ? 'has-error' : ''}" 
           data-tool-id="${tool.id}" 
           data-domain="${tool.domain || ''}">
        <div class="tool-icon">${tool.name.charAt(0).toUpperCase()}</div>
        <div class="tool-info">
          <div class="tool-name">${escapeHtml(tool.name)}</div>
          <div class="tool-domain">${escapeHtml(tool.domain || tool.targetUrl)}</div>
          ${hasError ? `<div class="tool-error">${escapeHtml(loginState.error)}</div>` : ''}
          ${needsManualAction ? `<div class="tool-manual">${escapeHtml(loginState.reason)}</div>` : ''}
        </div>
        <div class="tool-status">
          <span class="status-badge ${status.class}">${status.text}</span>
          ${hasPermission 
            ? `<button class="tool-action open-btn ${isLoading ? 'loading' : ''}" 
                       data-tool-id="${tool.id}" 
                       ${isLoading ? 'disabled' : ''}>
                ${isLoading ? '<span class="btn-spinner"></span>' : (hasError ? 'Retry' : 'Open')}
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
  
  const loginState = loginInProgress.get(tool.id);
  if (loginState?.status === 'error') {
    return { class: 'error', text: 'Failed' };
  }
  if (loginState?.status === 'manual') {
    return { class: 'manual', text: 'Action Needed' };
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
  if (loginInProgress.get(toolId)?.status === 'loading') {
    return;
  }
  
  // Mark as in progress
  loginInProgress.set(toolId, { status: 'loading' });
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
      loginInProgress.delete(toolId);
      showToast(`Logged in to ${tool.name}`, 'success');
    } else if (result.requiresManualAction) {
      loginInProgress.set(toolId, { 
        status: 'manual', 
        reason: result.manualActionReason || 'Manual action required'
      });
      showToast(result.manualActionReason || 'Please complete login manually', 'info');
    } else if (result.error || result.actionableError) {
      loginInProgress.set(toolId, { 
        status: 'error', 
        error: result.actionableError || result.error || 'Login failed'
      });
      showToast(result.actionableError || result.error || 'Login failed', 'error');
    } else {
      loginInProgress.delete(toolId);
      showToast(`Opening ${tool.name}...`, 'info');
    }
    
  } catch (error) {
    console.error('[Popup] One-click login error:', error);
    loginInProgress.set(toolId, { status: 'error', error: error.message });
    showToast(`Login failed: ${error.message}`, 'error');
  }
  
  renderTools(searchInput.value);
  
  // Clear error state after 10 seconds
  setTimeout(() => {
    const state = loginInProgress.get(toolId);
    if (state?.status === 'error' || state?.status === 'manual') {
      loginInProgress.delete(toolId);
      renderTools(searchInput.value);
    }
  }, 10000);
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
// DEBUG MODE UI
// ============================================================================

function setupDebugUI() {
  // Check if debug section exists, if not create it
  let debugSection = document.getElementById('debug-section');
  
  if (!debugSection) {
    // Add debug toggle to profile view if it exists
    const profileActions = document.querySelector('.profile-actions');
    if (profileActions) {
      const debugToggle = document.createElement('div');
      debugToggle.className = 'debug-toggle';
      debugToggle.innerHTML = `
        <label class="toggle-label">
          <input type="checkbox" id="debug-mode-toggle" ${debugMode ? 'checked' : ''}>
          <span class="toggle-text">Debug Mode</span>
        </label>
      `;
      profileActions.insertBefore(debugToggle, profileActions.firstChild);
      
      const toggle = document.getElementById('debug-mode-toggle');
      if (toggle) {
        toggle.addEventListener('change', async (e) => {
          debugMode = e.target.checked;
          await Storage.set({ debugMode });
          
          // Notify background
          chrome.runtime.sendMessage({ 
            type: debugMode ? 'ENABLE_DEBUG_MODE' : 'DISABLE_DEBUG_MODE'
          });
          
          showToast(debugMode ? 'Debug mode enabled' : 'Debug mode disabled', 'info');
        });
      }
    }
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
  }, 4000);
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
