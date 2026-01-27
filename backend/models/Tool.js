const mongoose = require('mongoose');

/**
 * Unified Credential Schema
 * Supports: form, sso, headers, cookies, token, localStorage, sessionStorage, none
 * 
 * Structure:
 * {
 *   type: "form" | "sso" | "headers" | "cookies" | "token" | "localStorage" | "sessionStorage" | "none",
 *   payload: { ... type-specific data ... },
 *   selectors: { ... CSS selectors for form elements ... },
 *   successCheck: { ... validation after login ... }
 * }
 */

/**
 * Combo Auth Schema - Allows both SSO and Form in one tool
 */
const comboAuthSchema = new mongoose.Schema({
  // Enable combo auth mode
  enabled: { type: Boolean, default: false },
  
  // Primary strategy to try first
  primary: { 
    type: String, 
    enum: ['sso', 'form'], 
    default: 'sso' 
  },
  
  // Whether to try fallback strategy if primary fails
  fallbackEnabled: { type: Boolean, default: true },
  
  // Only trigger auto-login when ?auto=1 in URL
  triggerOnAuto: { type: Boolean, default: true },
  
  // Form login configuration (when combo auth is enabled)
  formConfig: {
    username: String,
    password: String, // Will be encrypted
    loginUrl: String,
    multiStep: { type: Boolean, default: false },
    rememberMe: { type: Boolean, default: true },
    submitDelay: { type: Number, default: 800 }
  },
  
  // SSO configuration (when combo auth is enabled)
  ssoConfig: {
    authStartUrl: String,
    postLoginUrl: String,
    provider: String,
    buttonSelector: String,
    autoClick: { type: Boolean, default: true }
  }
}, { _id: false });

const credentialSchema = new mongoose.Schema({
  // Credential type
  type: {
    type: String,
    enum: ['form', 'sso', 'headers', 'cookies', 'token', 'localStorage', 'sessionStorage', 'none'],
    required: true
  },
  
  // Type-specific payload (encrypted JSON string)
  // Form: { username, password, loginUrl?, multiStep?, rememberMe? }
  // SSO: { authStartUrl, postLoginUrl, provider?, buttonSelector?, autoClick?, flowType? }
  // Headers: { headers: [{name, value, prefix?}] }
  // Cookies: Array of cookie objects
  // Token: { value, storageKey?, injectToStorage? }
  // localStorage/sessionStorage: { key: value }
  payloadEncrypted: {
    type: String
  },
  
  // CSS selectors for form-based login
  selectors: {
    username: String,      // CSS selector for username/email field
    password: String,      // CSS selector for password field
    submit: String,        // CSS selector for submit button
    next: String,          // CSS selector for "next" button (multi-step)
    rememberMe: String,    // CSS selector for "remember me" checkbox
    twoFactor: String,     // CSS selector for 2FA input
    errorMessage: String,  // CSS selector to detect login errors
    ssoButton: String      // CSS selector for SSO provider button
  },
  
  // Success validation after login attempt
  successCheck: {
    // URL-based checks
    urlIncludes: String,         // URL should include this string after login
    urlExcludes: String,         // URL should NOT include this (e.g., /login)
    urlPattern: String,          // Regex pattern for URL
    
    // Cookie-based checks
    cookieNames: [String],       // These cookies should exist after login
    cookieValues: mongoose.Schema.Types.Mixed, // { cookieName: expectedValue }
    
    // DOM-based checks
    elementExists: String,       // CSS selector that should exist when logged in
    elementNotExists: String,    // CSS selector that should NOT exist (e.g., login form)
    
    // Storage-based checks
    storageKeys: [String],       // localStorage keys that should exist
    
    // Custom validation (JSON string of rules)
    customRules: String
  },
  
  // Form login specific options
  formOptions: {
    multiStep: { type: Boolean, default: false },      // Email first, then password
    rememberMe: { type: Boolean, default: true },      // Check "remember me" if available
    clearFieldsFirst: { type: Boolean, default: true }, // Clear fields before filling
    submitDelay: { type: Number, default: 200 }        // Delay before submit (ms)
  },
  
  // SSO specific options
  ssoOptions: {
    provider: String,                    // google, microsoft, github, okta, saml, auth0
    flowType: { type: String, default: 'redirect', enum: ['redirect', 'popup', 'iframe'] },
    autoClickProvider: { type: Boolean, default: true },
    waitForAccountChooser: { type: Boolean, default: true },
    accountHint: String                  // Pre-fill email in account chooser
  },
  
  // MFA handling options
  mfaOptions: {
    detectMFA: { type: Boolean, default: true },
    mfaSelectors: [String],              // Additional MFA detection selectors
    action: { type: String, default: 'notify', enum: ['notify', 'wait', 'skip'] }
  },
  
  // Legacy support for header-based auth
  tokenHeader: {
    type: String,
    default: 'Authorization'
  },
  tokenPrefix: {
    type: String,
    default: 'Bearer '
  }
}, { _id: false });

const toolSchema = new mongoose.Schema({
  name: {
    type: String,
    required: true,
    trim: true
  },
  description: {
    type: String,
    trim: true
  },
  targetUrl: {
    type: String,
    required: true
  },
  // Login URL (if different from targetUrl)
  loginUrl: {
    type: String
  },
  // Domain extracted from targetUrl for extension permissions
  domain: {
    type: String,
    index: true
  },
  category: {
    type: String,
    enum: ['AI', 'Academic', 'SEO', 'Productivity', 'Graphics & SEO', 'Text Humanizers', 'Career-Oriented', 'Miscellaneous', 'Other'],
    default: 'Other'
  },
  status: {
    type: String,
    enum: ['active', 'inactive'],
    default: 'active'
  },
  fileMeta: {
    name: String,
    size: Number,
    type: String
  },
  
  // ========== UNIFIED CREDENTIAL SYSTEM ==========
  // New unified credentials field
  credentials: credentialSchema,
  
  // ========== LEGACY FIELDS (for backward compatibility) ==========
  // Will be migrated to unified format
  credentialType: {
    type: String,
    enum: ['form', 'sso', 'headers', 'cookies', 'token', 'localStorage', 'sessionStorage', 'none'],
    default: 'cookies'
  },
  // Encrypted credentials storage (legacy)
  cookiesEncrypted: {
    type: String // AES-256-GCM encrypted JSON for cookies
  },
  tokenEncrypted: {
    type: String // AES-256-GCM encrypted token/header value
  },
  tokenHeader: {
    type: String, // Header name for token injection (e.g., 'Authorization')
    default: 'Authorization'
  },
  tokenPrefix: {
    type: String, // Prefix for token (e.g., 'Bearer ')
    default: 'Bearer '
  },
  localStorageEncrypted: {
    type: String // AES-256-GCM encrypted localStorage data
  },
  // ========== END LEGACY FIELDS ==========
  
  // Credential versioning for extension sync
  credentialVersion: {
    type: Number,
    default: 1
  },
  credentialUpdatedAt: {
    type: Date,
    default: Date.now
  },
  // ========== COMBO AUTH ==========
  // Allows configuring both SSO and Form login in one tool
  comboAuth: comboAuthSchema,
  
  // Extension-specific settings
  extensionSettings: {
    requirePermission: { type: Boolean, default: true },
    autoInject: { type: Boolean, default: true },
    injectOnPageLoad: { type: Boolean, default: true },
    clearExistingCookies: { type: Boolean, default: false },
    reloadAfterLogin: { type: Boolean, default: true },
    waitForNavigation: { type: Boolean, default: true },
    spaMode: { type: Boolean, default: false },
    retryAttempts: { type: Number, default: 2 },
    retryDelayMs: { type: Number, default: 1000 },
    // Hidden mode settings
    hiddenModeEnabled: { type: Boolean, default: true },
    hiddenModeTimeout: { type: Number, default: 60000 }, // 60 seconds
    // Auto-start settings (when ?auto=1)
    autoStartEnabled: { type: Boolean, default: true },
    autoStartDelay: { type: Number, default: 800 }, // delay before auto-fill
    maxAutoAttempts: { type: Number, default: 2 },
    notes: String
  },
  createdBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  }
}, {
  timestamps: true
});

// Index for search
toolSchema.index({ name: 'text', description: 'text' });
toolSchema.index({ category: 1, status: 1 });
toolSchema.index({ credentialVersion: 1 });

// Pre-save hook to extract domain and bump version
toolSchema.pre('save', async function() {
  // Extract domain from targetUrl
  if (this.isModified('targetUrl') && this.targetUrl) {
    try {
      const url = new URL(this.targetUrl);
      this.domain = url.hostname;
    } catch (e) {
      // Keep existing domain if URL is invalid
    }
  }
  
  // Also extract domain from loginUrl if provided
  if (this.isModified('loginUrl') && this.loginUrl && !this.domain) {
    try {
      const url = new URL(this.loginUrl);
      this.domain = url.hostname;
    } catch (e) {
      // Ignore
    }
  }
  
  // Bump credential version when credentials change
  if (this.isModified('cookiesEncrypted') || 
      this.isModified('tokenEncrypted') || 
      this.isModified('localStorageEncrypted') ||
      this.isModified('credentials')) {
    this.credentialVersion = (this.credentialVersion || 0) + 1;
    this.credentialUpdatedAt = new Date();
  }
});

// Method to check if credentials are available
toolSchema.methods.hasCredentials = function() {
  // Check unified credentials
  if (this.credentials && this.credentials.type && this.credentials.type !== 'none') {
    return !!(this.credentials.payloadEncrypted);
  }
  // Check legacy credentials
  return !!(this.cookiesEncrypted || this.tokenEncrypted || this.localStorageEncrypted);
};

// Method to get unified credential format (for API response)
toolSchema.methods.getUnifiedCredentialType = function() {
  if (this.credentials && this.credentials.type) {
    return this.credentials.type;
  }
  return this.credentialType || 'none';
};

// Static method to get all unique domains (for extension permissions)
toolSchema.statics.getUniqueDomains = async function() {
  const tools = await this.find({ status: 'active', domain: { $exists: true, $ne: null } })
    .select('domain')
    .lean();
  return [...new Set(tools.map(t => t.domain))];
};

module.exports = mongoose.model('Tool', toolSchema);
