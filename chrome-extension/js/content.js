/**
 * Content Script for Auto-Login
 * Runs inside web pages to detect login state and trigger auto-authentication
 */

// Configuration
const CONFIG = {
  checkInterval: 1000,
  maxChecks: 10,
  spaRouteDebounce: 500
};

// State
let isInitialized = false;
let currentUrl = window.location.href;
let loginCheckCount = 0;
let routeChangeTimer = null;

// Login page indicators
const LOGIN_INDICATORS = {
  urlPatterns: [
    /\/login/i, /\/signin/i, /\/sign-in/i, /\/auth/i,
    /\/authenticate/i, /\/session\/new/i, /\/account\/login/i,
    /\/user\/login/i, /oauth/i, /\/sso/i
  ],
  formSelectors: [
    'form[action*="login"]', 'form[action*="signin"]', 'form[action*="auth"]',
    'form[id*="login"]', 'form[id*="signin"]', 'form[class*="login"]',
    '#login-form', '#signin-form', '.login-form', '.signin-form'
  ],
  inputSelectors: [
    'input[type="password"]', 'input[name="password"]',
    'input[autocomplete="current-password"]'
  ]
};

// Logged-in indicators
const LOGGED_IN_INDICATORS = {
  selectors: [
    '[class*="logout"]', '[class*="signout"]', '[class*="sign-out"]',
    '[id*="logout"]', '[id*="signout"]', 'a[href*="logout"]',
    'button[class*="logout"]', '[class*="user-menu"]', '[class*="user-avatar"]',
    '[class*="profile-menu"]', '[class*="account-menu"]',
    '[data-testid*="user"]', '[data-testid*="avatar"]'
  ],
  storageKeys: [
    'token', 'auth_token', 'access_token', 'jwt', 'user', 'session', 'auth'
  ]
};

/**
 * Initialize content script
 */
function init() {
  if (isInitialized) return;
  isInitialized = true;
  
  console.log('[ToolStack Content] Initializing on', window.location.hostname);
  
  // Check login state on load
  checkAndTriggerLogin();
  
  // Setup SPA route change detection
  setupRouteChangeDetection();
  
  // Listen for messages from background
  setupMessageListener();
}

/**
 * Check if current page is a login page
 */
function isLoginPage() {
  const url = window.location.href.toLowerCase();
  
  // Check URL patterns
  const matchesUrl = LOGIN_INDICATORS.urlPatterns.some(pattern => pattern.test(url));
  
  // Check for login forms
  const hasLoginForm = LOGIN_INDICATORS.formSelectors.some(selector => {
    try {
      return document.querySelector(selector) !== null;
    } catch (e) {
      return false;
    }
  });
  
  // Check for password field
  const hasPasswordField = LOGIN_INDICATORS.inputSelectors.some(selector => {
    try {
      const el = document.querySelector(selector);
      return el && el.offsetParent !== null; // Visible
    } catch (e) {
      return false;
    }
  });
  
  return matchesUrl || (hasLoginForm && hasPasswordField) || (hasPasswordField && !isLoggedIn());
}

/**
 * Check if user is logged in
 */
function isLoggedIn() {
  // Check DOM for logged-in indicators
  const hasLoggedInElement = LOGGED_IN_INDICATORS.selectors.some(selector => {
    try {
      const el = document.querySelector(selector);
      return el && el.offsetParent !== null;
    } catch (e) {
      return false;
    }
  });
  
  // Check localStorage for auth tokens
  const hasStoredAuth = LOGGED_IN_INDICATORS.storageKeys.some(key => {
    try {
      const value = localStorage.getItem(key);
      return value && value.length > 0;
    } catch (e) {
      return false;
    }
  });
  
  return hasLoggedInElement || hasStoredAuth;
}

/**
 * Get current login state
 */
function getLoginState() {
  return {
    url: window.location.href,
    hostname: window.location.hostname,
    pathname: window.location.pathname,
    isLoginPage: isLoginPage(),
    isLoggedIn: isLoggedIn(),
    hasPasswordField: !!document.querySelector('input[type="password"]'),
    timestamp: Date.now()
  };
}

/**
 * Check login state and trigger auto-login if needed
 */
async function checkAndTriggerLogin() {
  const state = getLoginState();
  
  console.log('[ToolStack Content] Login state:', state);
  
  // If already logged in, no action needed
  if (state.isLoggedIn && !state.isLoginPage) {
    console.log('[ToolStack Content] Already logged in');
    notifyBackground('LOGIN_STATE', { ...state, action: 'already_logged_in' });
    return;
  }
  
  // If on login page and not logged in, trigger auto-login
  if (state.isLoginPage && !state.isLoggedIn) {
    console.log('[ToolStack Content] Login page detected, requesting credentials');
    notifyBackground('LOGIN_REQUIRED', state);
    return;
  }
  
  // If we have password field but not clearly on login page, wait and re-check
  if (state.hasPasswordField && loginCheckCount < CONFIG.maxChecks) {
    loginCheckCount++;
    setTimeout(() => checkAndTriggerLogin(), CONFIG.checkInterval);
  }
}

/**
 * Setup SPA route change detection
 */
function setupRouteChangeDetection() {
  // Monitor pushState and replaceState
  const originalPushState = history.pushState;
  const originalReplaceState = history.replaceState;
  
  history.pushState = function(...args) {
    originalPushState.apply(this, args);
    handleRouteChange('pushState');
  };
  
  history.replaceState = function(...args) {
    originalReplaceState.apply(this, args);
    handleRouteChange('replaceState');
  };
  
  // Monitor popstate
  window.addEventListener('popstate', () => handleRouteChange('popstate'));
  
  // Monitor hashchange
  window.addEventListener('hashchange', () => handleRouteChange('hashchange'));
  
  // Monitor DOM mutations for SPA content changes
  setupMutationObserver();
}

/**
 * Handle route change in SPA
 */
function handleRouteChange(source) {
  const newUrl = window.location.href;
  
  if (newUrl === currentUrl) return;
  
  console.log('[ToolStack Content] Route change detected:', source, newUrl);
  currentUrl = newUrl;
  loginCheckCount = 0;
  
  // Debounce to allow page to render
  clearTimeout(routeChangeTimer);
  routeChangeTimer = setTimeout(() => {
    checkAndTriggerLogin();
  }, CONFIG.spaRouteDebounce);
}

/**
 * Setup mutation observer for SPA content changes
 */
function setupMutationObserver() {
  const observer = new MutationObserver((mutations) => {
    // Check if a login form was added
    for (const mutation of mutations) {
      if (mutation.type === 'childList' && mutation.addedNodes.length > 0) {
        for (const node of mutation.addedNodes) {
          if (node.nodeType === Node.ELEMENT_NODE) {
            // Check if added node contains password field
            if (node.querySelector && node.querySelector('input[type="password"]')) {
              console.log('[ToolStack Content] Login form added to DOM');
              loginCheckCount = 0;
              checkAndTriggerLogin();
              return;
            }
          }
        }
      }
    }
  });
  
  // Start observing
  observer.observe(document.body, {
    childList: true,
    subtree: true
  });
}

/**
 * Setup message listener for background script communication
 */
function setupMessageListener() {
  chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    console.log('[ToolStack Content] Message received:', message.type);
    
    switch (message.type) {
      case 'GET_LOGIN_STATE':
        sendResponse(getLoginState());
        break;
        
      case 'FILL_FORM':
        fillLoginForm(message.data)
          .then(result => sendResponse(result))
          .catch(err => sendResponse({ success: false, error: err.message }));
        return true; // Keep channel open for async response
        
      case 'INJECT_STORAGE':
        injectStorage(message.data)
          .then(result => sendResponse(result))
          .catch(err => sendResponse({ success: false, error: err.message }));
        return true;
        
      case 'CHECK_LOGGED_IN':
        sendResponse({ isLoggedIn: isLoggedIn(), state: getLoginState() });
        break;
        
      case 'TRIGGER_LOGIN_CHECK':
        loginCheckCount = 0;
        checkAndTriggerLogin();
        sendResponse({ triggered: true });
        break;
        
      default:
        sendResponse({ error: 'Unknown message type' });
    }
  });
}

/**
 * Notify background script
 */
function notifyBackground(type, data) {
  try {
    chrome.runtime.sendMessage({
      type,
      data,
      source: 'content',
      url: window.location.href,
      hostname: window.location.hostname
    });
  } catch (e) {
    console.error('[ToolStack Content] Failed to notify background:', e);
  }
}

/**
 * Fill login form with credentials
 */
async function fillLoginForm(data) {
  const { username, password, selectors = {}, autoSubmit = true, rememberMe = true } = data;
  
  const result = {
    success: false,
    usernameField: null,
    passwordField: null,
    submitted: false,
    errors: []
  };
  
  // Generic selectors
  const usernameSelectors = [
    ...(selectors.username ? [selectors.username] : []),
    'input[name="email"]', 'input[type="email"]', 'input[id="email"]',
    'input[name="username"]', 'input[id="username"]', 'input[name="login"]',
    'input[autocomplete="email"]', 'input[autocomplete="username"]',
    'input[placeholder*="email" i]', 'input[placeholder*="username" i]'
  ];
  
  const passwordSelectors = [
    ...(selectors.password ? [selectors.password] : []),
    'input[type="password"]', 'input[name="password"]', 'input[id="password"]',
    'input[autocomplete="current-password"]'
  ];
  
  const submitSelectors = [
    ...(selectors.submit ? [selectors.submit] : []),
    'button[type="submit"]', 'input[type="submit"]',
    'button[class*="login"]', 'button[class*="signin"]',
    'button[id*="login"]', 'button[id*="signin"]'
  ];
  
  // Find and fill username
  const usernameField = findVisibleElement(usernameSelectors);
  if (usernameField) {
    result.usernameField = usernameField.name || usernameField.id || 'found';
    setInputValue(usernameField, username);
  } else {
    result.errors.push('Username field not found');
  }
  
  // Find and fill password
  const passwordField = findVisibleElement(passwordSelectors);
  if (passwordField) {
    result.passwordField = passwordField.name || passwordField.id || 'found';
    setInputValue(passwordField, password);
  } else {
    result.errors.push('Password field not found');
  }
  
  // Handle remember me
  if (rememberMe) {
    const rememberMeSelectors = [
      'input[type="checkbox"][name*="remember"]',
      'input[type="checkbox"][id*="remember"]'
    ];
    const checkbox = findVisibleElement(rememberMeSelectors);
    if (checkbox && !checkbox.checked) {
      checkbox.click();
    }
  }
  
  // Submit form
  if (autoSubmit && usernameField && passwordField) {
    await new Promise(resolve => setTimeout(resolve, 100)); // Allow framework to process
    
    const submitButton = findVisibleElement(submitSelectors);
    if (submitButton) {
      submitButton.click();
      result.submitted = true;
    } else {
      // Try form submit
      const form = usernameField.closest('form') || passwordField.closest('form');
      if (form) {
        form.submit();
        result.submitted = true;
      } else {
        result.errors.push('Submit button/form not found');
      }
    }
  }
  
  result.success = usernameField && passwordField && result.errors.length === 0;
  
  return result;
}

/**
 * Find visible element from selector list
 */
function findVisibleElement(selectors) {
  for (const selector of selectors) {
    try {
      const el = document.querySelector(selector);
      if (el && el.offsetParent !== null) {
        return el;
      }
    } catch (e) {
      // Invalid selector
    }
  }
  return null;
}

/**
 * Set input value with proper events (works with React, Vue, Angular)
 */
function setInputValue(input, value) {
  // Focus
  input.focus();
  
  // Clear
  input.value = '';
  
  // For React controlled inputs
  const nativeInputValueSetter = Object.getOwnPropertyDescriptor(
    window.HTMLInputElement.prototype, 'value'
  ).set;
  nativeInputValueSetter.call(input, value);
  
  // Dispatch events
  input.dispatchEvent(new Event('input', { bubbles: true }));
  input.dispatchEvent(new Event('change', { bubbles: true }));
  
  // Blur
  input.blur();
}

/**
 * Inject data into storage
 */
async function injectStorage(data) {
  const { storageType = 'localStorage', items } = data;
  const storage = storageType === 'sessionStorage' ? sessionStorage : localStorage;
  
  let setCount = 0;
  const errors = [];
  
  for (const [key, value] of Object.entries(items)) {
    try {
      const valueStr = typeof value === 'string' ? value : JSON.stringify(value);
      storage.setItem(key, valueStr);
      setCount++;
    } catch (e) {
      errors.push({ key, error: e.message });
    }
  }
  
  return {
    success: setCount > 0,
    set: setCount,
    total: Object.keys(items).length,
    errors
  };
}

// Initialize when DOM is ready
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', init);
} else {
  init();
}

// Also run on window load for late-loading SPAs
window.addEventListener('load', () => {
  setTimeout(() => {
    if (!isLoggedIn() && isLoginPage()) {
      checkAndTriggerLogin();
    }
  }, 1000);
});
