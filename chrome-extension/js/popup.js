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

// Open tool
async function openTool(toolId) {
  const tool = tools.find(t => t.id === toolId);
  if (!tool) return;
  
  try {
    // Fetch credentials
    const result = await api.getCredentials(toolId);
    
    if (result.credentials) {
      // Apply credentials based on type
      await applyCredentials(result.tool, result.credentials);
    }
    
    // Log tool opened
    await api.logToolOpened(toolId);
    
    // Open tool in new tab
    chrome.tabs.create({ url: tool.targetUrl });
  } catch (error) {
    console.error('Failed to open tool:', error);
    alert('Failed to load credentials: ' + error.message);
  }
}

// Apply credentials
async function applyCredentials(tool, credentials) {
  if (!credentials || !credentials.type) return;
  
  const domain = credentials.domain || tool.domain;
  if (!domain) return;
  
  switch (credentials.type) {
    case 'cookies':
      await applyCookies(domain, credentials.data);
      break;
    case 'token':
      // Token injection will be handled by background script
      await Storage.set({
        [`token_${domain}`]: credentials.data
      });
      break;
    case 'localStorage':
      // LocalStorage will be set via content script
      await Storage.set({
        [`localStorage_${domain}`]: credentials.data
      });
      break;
  }
}

// Apply cookies using Chrome cookies API
async function applyCookies(domain, cookies) {
  if (!Array.isArray(cookies)) return;
  
  for (const cookie of cookies) {
    try {
      const cookieDetails = {
        url: `https://${domain}`,
        name: cookie.name,
        value: cookie.value,
        domain: cookie.domain || domain,
        path: cookie.path || '/',
        secure: cookie.secure !== false,
        httpOnly: cookie.httpOnly || false,
        sameSite: cookie.sameSite || 'lax'
      };
      
      if (cookie.expirationDate) {
        cookieDetails.expirationDate = cookie.expirationDate;
      }
      
      await chrome.cookies.set(cookieDetails);
    } catch (error) {
      console.error('Failed to set cookie:', cookie.name, error);
    }
  }
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
