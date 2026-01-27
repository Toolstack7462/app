const express = require('express');
const router = express.Router();
const User = require('../../models/User');
const Tool = require('../../models/Tool');
const ToolAssignment = require('../../models/ToolAssignment');
const ExtensionToken = require('../../models/ExtensionToken');
const CredentialAccessLog = require('../../models/CredentialAccessLog');
const ActivityLog = require('../../models/ActivityLog');
const { decryptCookies } = require('../../utils/encryption');
const bcrypt = require('bcryptjs');

// Middleware to verify extension token
const verifyExtensionToken = async (req, res, next) => {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('ExtToken ')) {
      return res.status(401).json({ error: 'Extension token required' });
    }
    
    const token = authHeader.substring(9); // Remove 'ExtToken '
    const tokenData = await ExtensionToken.verifyToken(token);
    
    if (!tokenData) {
      return res.status(401).json({ error: 'Invalid or expired extension token' });
    }
    
    if (tokenData.client.status === 'disabled') {
      return res.status(403).json({ error: 'Account is disabled' });
    }
    
    req.clientId = tokenData.clientId;
    req.client = tokenData.client;
    req.extensionTokenId = tokenData.tokenId;
    next();
  } catch (error) {
    console.error('Extension token verification error:', error);
    res.status(500).json({ error: 'Authentication failed' });
  }
};

// POST /api/crm/extension/auth - Authenticate and get extension token
router.post('/auth', async (req, res) => {
  try {
    const { email, password } = req.body;
    
    if (!email || !password) {
      return res.status(400).json({ error: 'Email and password are required' });
    }
    
    // Find client user
    const user = await User.findOne({ 
      email: email.toLowerCase().trim(),
      role: 'CLIENT'
    });
    
    if (!user) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }
    
    if (user.status === 'disabled') {
      return res.status(403).json({ error: 'Account is disabled' });
    }
    
    // Check if user has a password set
    if (!user.passwordHash) {
      return res.status(401).json({ error: 'Password not set. Please reset your password.' });
    }
    
    // Verify password using model method
    const isMatch = await user.comparePassword(password);
    if (!isMatch) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }
    
    // Create extension token (valid for 30 days)
    const tokenData = await ExtensionToken.createForClient(user._id, 30, {
      userAgent: req.headers['user-agent'],
      ip: req.ip
    });
    
    await ActivityLog.log('CLIENT', user._id, 'EXTENSION_AUTH', {
      action: 'Extension authenticated'
    });
    
    res.json({
      success: true,
      token: tokenData.token,
      expiresAt: tokenData.expiresAt,
      user: {
        id: user._id,
        email: user.email,
        name: user.name
      }
    });
  } catch (error) {
    console.error('Extension auth error:', error);
    res.status(500).json({ error: 'Authentication failed' });
  }
});

// POST /api/crm/extension/logout - Revoke extension token
router.post('/logout', verifyExtensionToken, async (req, res) => {
  try {
    const token = await ExtensionToken.findById(req.extensionTokenId);
    if (token) {
      await token.revoke();
    }
    
    await ActivityLog.log('CLIENT', req.clientId, 'EXTENSION_LOGOUT', {
      action: 'Extension logged out'
    });
    
    res.json({ success: true });
  } catch (error) {
    console.error('Extension logout error:', error);
    res.status(500).json({ error: 'Logout failed' });
  }
});

// GET /api/crm/extension/tools - Get assigned tools with versions
router.get('/tools', verifyExtensionToken, async (req, res) => {
  try {
    // Update expired assignments
    await ToolAssignment.updateExpiredAssignments();
    
    // Get valid assignments
    const assignments = await ToolAssignment.find({
      clientId: req.clientId,
      status: 'active'
    }).populate('toolId');
    
    const now = new Date();
    const tools = [];
    
    for (const assignment of assignments) {
      if (!assignment.toolId || assignment.toolId.status !== 'active') continue;
      if (assignment.startDate && assignment.startDate > now) continue;
      if (assignment.endDate && assignment.endDate < now) continue;
      
      const tool = assignment.toolId;
      
      // Build session bundle info (version only, not decrypted data)
      const sessionBundleInfo = tool.sessionBundle ? {
        version: tool.sessionBundle.version || 1,
        updatedAt: tool.sessionBundle.updatedAt,
        hasCookies: !!tool.sessionBundle.cookiesEncrypted,
        hasLocalStorage: !!tool.sessionBundle.localStorageEncrypted,
        hasSessionStorage: !!tool.sessionBundle.sessionStorageEncrypted
      } : null;
      
      // Build comboAuth config with new parallel mode settings
      const comboAuthConfig = tool.comboAuth ? {
        enabled: tool.comboAuth.enabled || false,
        runMode: tool.comboAuth.runMode || 'sequential',
        primaryType: tool.comboAuth.primaryType || 'sso',
        secondaryType: tool.comboAuth.secondaryType || 'form',
        fallbackEnabled: tool.comboAuth.fallbackEnabled ?? true,
        fallbackOnlyOnce: tool.comboAuth.fallbackOnlyOnce ?? true,
        skipIfLoggedIn: tool.comboAuth.skipIfLoggedIn ?? true,
        triggerOnAuto: tool.comboAuth.triggerOnAuto ?? true,
        parallelSettings: {
          prepSessionFirst: tool.comboAuth.parallelSettings?.prepSessionFirst ?? true,
          parallelTimeout: tool.comboAuth.parallelSettings?.parallelTimeout ?? 30000,
          commitLock: tool.comboAuth.parallelSettings?.commitLock ?? true,
          verifyAfterAuth: tool.comboAuth.parallelSettings?.verifyAfterAuth ?? true
        }
      } : { enabled: false };
      
      tools.push({
        id: tool._id,
        name: tool.name,
        description: tool.description,
        targetUrl: tool.targetUrl,
        loginUrl: tool.loginUrl,
        domain: tool.domain,
        category: tool.category,
        credentialType: tool.credentialType || 'cookies',
        credentialVersion: tool.credentialVersion || 1,
        credentialUpdatedAt: tool.credentialUpdatedAt,
        hasCredentials: tool.hasCredentials(),
        // Session Bundle info for version checking
        sessionBundle: sessionBundleInfo,
        // Combo Auth config with parallel mode support
        comboAuth: comboAuthConfig,
        extensionSettings: {
          ...tool.extensionSettings,
          // Ensure new settings have defaults
          hiddenModeEnabled: tool.extensionSettings?.hiddenModeEnabled ?? true,
          hiddenModeTimeout: tool.extensionSettings?.hiddenModeTimeout ?? 60000,
          autoStartEnabled: tool.extensionSettings?.autoStartEnabled ?? true,
          autoStartDelay: tool.extensionSettings?.autoStartDelay ?? 800,
          maxAutoAttempts: tool.extensionSettings?.maxAutoAttempts ?? 2
        },
        assignment: {
          id: assignment._id,
          startDate: assignment.startDate,
          endDate: assignment.endDate,
          status: assignment.status
        }
      });
    }
    
    // Log version check
    await CredentialAccessLog.log({
      clientId: req.clientId,
      toolId: null,
      extensionTokenId: req.extensionTokenId,
      action: 'VERSION_CHECK',
      deviceInfo: {
        userAgent: req.headers['user-agent'],
        ip: req.ip,
        extensionVersion: req.headers['x-extension-version']
      }
    });
    
    res.json({ 
      success: true,
      tools,
      syncedAt: new Date().toISOString()
    });
  } catch (error) {
    console.error('Get extension tools error:', error);
    res.status(500).json({ error: 'Failed to fetch tools' });
  }
});

// GET /api/crm/extension/tools/versions - Lightweight version check
router.get('/tools/versions', verifyExtensionToken, async (req, res) => {
  try {
    await ToolAssignment.updateExpiredAssignments();
    
    const assignments = await ToolAssignment.find({
      clientId: req.clientId,
      status: 'active'
    }).populate('toolId', '_id credentialVersion credentialUpdatedAt');
    
    const now = new Date();
    const versions = {};
    
    for (const assignment of assignments) {
      if (!assignment.toolId) continue;
      if (assignment.startDate && assignment.startDate > now) continue;
      if (assignment.endDate && assignment.endDate < now) continue;
      
      versions[assignment.toolId._id] = {
        version: assignment.toolId.credentialVersion || 1,
        updatedAt: assignment.toolId.credentialUpdatedAt
      };
    }
    
    res.json({ 
      success: true,
      versions,
      checkedAt: new Date().toISOString()
    });
  } catch (error) {
    console.error('Get versions error:', error);
    res.status(500).json({ error: 'Failed to fetch versions' });
  }
});

// GET /api/crm/extension/tools/:toolId/credentials - Get decrypted credentials
router.get('/tools/:toolId/credentials', verifyExtensionToken, async (req, res) => {
  try {
    const { toolId } = req.params;
    
    // Verify assignment
    const assignment = await ToolAssignment.findOne({
      clientId: req.clientId,
      toolId,
      status: 'active'
    }).populate('toolId');
    
    if (!assignment) {
      await CredentialAccessLog.log({
        clientId: req.clientId,
        toolId,
        extensionTokenId: req.extensionTokenId,
        action: 'CREDENTIALS_FETCHED',
        success: false,
        errorMessage: 'No assignment found',
        deviceInfo: {
          userAgent: req.headers['user-agent'],
          ip: req.ip,
          extensionVersion: req.headers['x-extension-version']
        }
      });
      return res.status(403).json({ error: 'Tool not assigned to you' });
    }
    
    if (!assignment.isValid()) {
      return res.status(403).json({ error: 'Assignment is not valid or has expired' });
    }
    
    const tool = assignment.toolId;
    
    if (!tool || tool.status !== 'active') {
      return res.status(404).json({ error: 'Tool not found or inactive' });
    }
    
    // Build unified credential response
    let credentials = null;
    
    try {
      // Check for new unified credentials first
      if (tool.credentials && tool.credentials.type && tool.credentials.payloadEncrypted) {
        const payloadJson = decryptCookies(tool.credentials.payloadEncrypted);
        const payload = JSON.parse(payloadJson);
        
        credentials = {
          type: tool.credentials.type,
          payload: payload,
          selectors: tool.credentials.selectors || {},
          successCheck: tool.credentials.successCheck || {},
          domain: tool.domain,
          loginUrl: tool.loginUrl || tool.targetUrl
        };
        
        // Add legacy header info if it's a headers/token type
        if (tool.credentials.type === 'headers' || tool.credentials.type === 'token') {
          credentials.tokenHeader = tool.credentials.tokenHeader || tool.tokenHeader || 'Authorization';
          credentials.tokenPrefix = tool.credentials.tokenPrefix || tool.tokenPrefix || 'Bearer ';
        }
      }
      // Fallback to legacy credentials
      else {
        const credentialType = tool.credentialType || 'cookies';
        
        if (credentialType === 'cookies' && tool.cookiesEncrypted) {
          const cookiesJson = decryptCookies(tool.cookiesEncrypted);
          credentials = {
            type: 'cookies',
            payload: JSON.parse(cookiesJson),
            selectors: {},
            successCheck: {},
            domain: tool.domain
          };
        } else if (credentialType === 'token' && tool.tokenEncrypted) {
          const tokenValue = decryptCookies(tool.tokenEncrypted);
          credentials = {
            type: 'token',
            payload: {
              value: tokenValue,
              header: tool.tokenHeader || 'Authorization',
              prefix: tool.tokenPrefix || 'Bearer '
            },
            selectors: {},
            successCheck: {},
            domain: tool.domain,
            tokenHeader: tool.tokenHeader || 'Authorization',
            tokenPrefix: tool.tokenPrefix || 'Bearer '
          };
        } else if ((credentialType === 'localStorage' || credentialType === 'sessionStorage') && tool.localStorageEncrypted) {
          const storageJson = decryptCookies(tool.localStorageEncrypted);
          credentials = {
            type: credentialType,
            payload: JSON.parse(storageJson),
            selectors: {},
            successCheck: {},
            domain: tool.domain
          };
        } else if (credentialType === 'form') {
          // Form login - check if we have form data in legacy or new format
          credentials = {
            type: 'form',
            payload: {},
            selectors: {},
            successCheck: {},
            domain: tool.domain,
            loginUrl: tool.loginUrl || tool.targetUrl
          };
        } else if (credentialType === 'sso') {
          // SSO login
          credentials = {
            type: 'sso',
            payload: {},
            selectors: {},
            successCheck: {},
            domain: tool.domain,
            loginUrl: tool.loginUrl || tool.targetUrl
          };
        }
      }
    } catch (decryptError) {
      console.error('Credential decryption error:', decryptError);
      return res.status(500).json({ error: 'Failed to decrypt credentials' });
    }
    
    // Decrypt session bundle if available
    let sessionBundle = null;
    if (tool.sessionBundle) {
      try {
        sessionBundle = {
          version: tool.sessionBundle.version || 1,
          updatedAt: tool.sessionBundle.updatedAt,
          cookies: null,
          localStorage: null,
          sessionStorage: null
        };
        
        if (tool.sessionBundle.cookiesEncrypted) {
          const cookiesJson = decryptCookies(tool.sessionBundle.cookiesEncrypted);
          sessionBundle.cookies = JSON.parse(cookiesJson);
        }
        if (tool.sessionBundle.localStorageEncrypted) {
          const localStorageJson = decryptCookies(tool.sessionBundle.localStorageEncrypted);
          sessionBundle.localStorage = JSON.parse(localStorageJson);
        }
        if (tool.sessionBundle.sessionStorageEncrypted) {
          const sessionStorageJson = decryptCookies(tool.sessionBundle.sessionStorageEncrypted);
          sessionBundle.sessionStorage = JSON.parse(sessionStorageJson);
        }
      } catch (bundleError) {
        console.error('Session bundle decryption error:', bundleError);
        // Continue without session bundle
      }
    }
    
    // Log successful access
    await CredentialAccessLog.log({
      clientId: req.clientId,
      toolId: tool._id,
      extensionTokenId: req.extensionTokenId,
      action: 'CREDENTIALS_FETCHED',
      credentialVersion: tool.credentialVersion,
      success: true,
      deviceInfo: {
        userAgent: req.headers['user-agent'],
        ip: req.ip,
        extensionVersion: req.headers['x-extension-version']
      }
    });
    
    await ActivityLog.log('CLIENT', req.clientId, 'EXTENSION_CREDENTIALS_FETCH', {
      toolId: tool._id,
      toolName: tool.name,
      credentialType: credentials?.type || 'none'
    });
    
    // Build combo auth config with parallel mode
    const comboAuthConfig = tool.comboAuth ? {
      enabled: tool.comboAuth.enabled || false,
      runMode: tool.comboAuth.runMode || 'sequential',
      primaryType: tool.comboAuth.primaryType || 'sso',
      secondaryType: tool.comboAuth.secondaryType || 'form',
      fallbackEnabled: tool.comboAuth.fallbackEnabled ?? true,
      fallbackOnlyOnce: tool.comboAuth.fallbackOnlyOnce ?? true,
      skipIfLoggedIn: tool.comboAuth.skipIfLoggedIn ?? true,
      triggerOnAuto: tool.comboAuth.triggerOnAuto ?? true,
      parallelSettings: {
        prepSessionFirst: tool.comboAuth.parallelSettings?.prepSessionFirst ?? true,
        parallelTimeout: tool.comboAuth.parallelSettings?.parallelTimeout ?? 30000,
        commitLock: tool.comboAuth.parallelSettings?.commitLock ?? true,
        verifyAfterAuth: tool.comboAuth.parallelSettings?.verifyAfterAuth ?? true
      },
      // Include form and SSO configs for combo auth
      formConfig: tool.comboAuth.formConfig || {},
      ssoConfig: tool.comboAuth.ssoConfig || {},
      cookiesConfig: tool.comboAuth.cookiesConfig || {},
      tokenConfig: tool.comboAuth.tokenConfig || {},
      localStorageConfig: tool.comboAuth.localStorageConfig || {},
      sessionStorageConfig: tool.comboAuth.sessionStorageConfig || {}
    } : { enabled: false };
    
    res.json({
      success: true,
      tool: {
        id: tool._id,
        name: tool.name,
        targetUrl: tool.targetUrl,
        loginUrl: tool.loginUrl || tool.targetUrl,
        domain: tool.domain,
        credentialVersion: tool.credentialVersion,
        // Include combo auth configuration with parallel mode
        comboAuth: comboAuthConfig,
        extensionSettings: {
          ...tool.extensionSettings,
          reloadAfterLogin: tool.extensionSettings?.reloadAfterLogin ?? true,
          waitForNavigation: tool.extensionSettings?.waitForNavigation ?? true,
          spaMode: tool.extensionSettings?.spaMode ?? false,
          retryAttempts: tool.extensionSettings?.retryAttempts ?? 2,
          retryDelayMs: tool.extensionSettings?.retryDelayMs ?? 1000,
          // New hidden mode and auto-start settings
          hiddenModeEnabled: tool.extensionSettings?.hiddenModeEnabled ?? true,
          hiddenModeTimeout: tool.extensionSettings?.hiddenModeTimeout ?? 60000,
          autoStartEnabled: tool.extensionSettings?.autoStartEnabled ?? true,
          autoStartDelay: tool.extensionSettings?.autoStartDelay ?? 800,
          maxAutoAttempts: tool.extensionSettings?.maxAutoAttempts ?? 2
        }
      },
      // Session bundle with decrypted data
      sessionBundle,
      credentials: {
        ...credentials,
        // Include additional options from the tool schema
        formOptions: tool.credentials?.formOptions || {
          multiStep: false,
          rememberMe: true,
          clearFieldsFirst: true,
          submitDelay: 200
        },
        ssoOptions: tool.credentials?.ssoOptions || {
          flowType: 'redirect',
          autoClickProvider: true,
          waitForAccountChooser: true
        },
        mfaOptions: tool.credentials?.mfaOptions || {
          detectMFA: true,
          action: 'notify'
        }
      },
      fetchedAt: new Date().toISOString()
    });
  } catch (error) {
    console.error('Get credentials error:', error);
    res.status(500).json({ error: 'Failed to fetch credentials' });
  }
});

// POST /api/crm/extension/tools/:toolId/opened - Log tool opened event
router.post('/tools/:toolId/opened', verifyExtensionToken, async (req, res) => {
  try {
    const { toolId } = req.params;
    
    await CredentialAccessLog.log({
      clientId: req.clientId,
      toolId,
      extensionTokenId: req.extensionTokenId,
      action: 'TOOL_OPENED',
      deviceInfo: {
        userAgent: req.headers['user-agent'],
        ip: req.ip,
        extensionVersion: req.headers['x-extension-version']
      }
    });
    
    res.json({ success: true });
  } catch (error) {
    console.error('Log tool opened error:', error);
    res.status(500).json({ error: 'Failed to log event' });
  }
});

// POST /api/crm/extension/tools/:toolId/login-attempt - Log login attempt result
router.post('/tools/:toolId/login-attempt', verifyExtensionToken, async (req, res) => {
  try {
    const { toolId } = req.params;
    const { 
      success, 
      method, 
      duration, 
      attempts, 
      finalUrl, 
      error,
      errorCode,
      mfaDetected,
      multiStepDetected,
      requiresManualAction
    } = req.body;
    
    // Determine action based on result
    let action = 'LOGIN_STARTED';
    if (success) {
      action = 'LOGIN_SUCCESS';
    } else if (mfaDetected) {
      action = 'LOGIN_MFA_REQUIRED';
    } else if (requiresManualAction) {
      action = 'LOGIN_MANUAL_REQUIRED';
    } else if (error) {
      action = 'LOGIN_FAILED';
    }
    
    await CredentialAccessLog.log({
      clientId: req.clientId,
      toolId,
      extensionTokenId: req.extensionTokenId,
      action,
      loginAttempt: {
        method,
        duration,
        attempts,
        finalUrl: finalUrl?.substring(0, 500), // Truncate long URLs
        mfaDetected,
        multiStepDetected
      },
      success: success || false,
      errorMessage: error?.substring(0, 500), // Don't store too long errors
      errorCode,
      deviceInfo: {
        userAgent: req.headers['user-agent'],
        ip: req.ip,
        extensionVersion: req.headers['x-extension-version'],
        browser: req.body.browser,
        os: req.body.os
      }
    });
    
    res.json({ success: true, logged: true });
  } catch (error) {
    console.error('Log login attempt error:', error);
    res.status(500).json({ error: 'Failed to log login attempt' });
  }
});

// GET /api/crm/extension/tools/:toolId/login-stats - Get login statistics for a tool
router.get('/tools/:toolId/login-stats', verifyExtensionToken, async (req, res) => {
  try {
    const { toolId } = req.params;
    const days = parseInt(req.query.days) || 30;
    
    const stats = await CredentialAccessLog.getToolLoginStats(toolId, days);
    
    res.json({
      success: true,
      stats,
      period: `${days} days`
    });
  } catch (error) {
    console.error('Get login stats error:', error);
    res.status(500).json({ error: 'Failed to fetch login stats' });
  }
});

// POST /api/crm/extension/debug-log - Submit debug logs from extension
router.post('/debug-log', verifyExtensionToken, async (req, res) => {
  try {
    const { logs, context } = req.body;
    
    // Only log in development or if explicitly enabled
    if (process.env.NODE_ENV === 'development' || process.env.ENABLE_EXTENSION_DEBUG_LOGS === 'true') {
      console.log(`[Extension Debug] Client: ${req.clientId}`, {
        context,
        logsCount: logs?.length || 0
      });
      
      // Could store in a separate collection if needed for analysis
    }
    
    res.json({ success: true, received: true });
  } catch (error) {
    console.error('Debug log error:', error);
    res.status(500).json({ error: 'Failed to process debug logs' });
  }
});

// GET /api/crm/extension/domains - Get list of all tool domains for permissions
router.get('/domains', verifyExtensionToken, async (req, res) => {
  try {
    // Get domains from client's assigned tools only
    const assignments = await ToolAssignment.find({
      clientId: req.clientId,
      status: 'active'
    }).populate('toolId', 'domain');
    
    const domains = [...new Set(
      assignments
        .filter(a => a.toolId && a.toolId.domain)
        .map(a => a.toolId.domain)
    )];
    
    res.json({ 
      success: true,
      domains 
    });
  } catch (error) {
    console.error('Get domains error:', error);
    res.status(500).json({ error: 'Failed to fetch domains' });
  }
});

// GET /api/crm/extension/profile - Get client profile
router.get('/profile', verifyExtensionToken, async (req, res) => {
  try {
    const user = await User.findById(req.clientId).select('email name company createdAt');
    
    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }
    
    // Get token info
    const token = await ExtensionToken.findById(req.extensionTokenId);
    
    res.json({
      success: true,
      user: {
        id: user._id,
        email: user.email,
        name: user.name,
        company: user.company
      },
      token: {
        expiresAt: token?.expiresAt,
        lastUsedAt: token?.lastUsedAt
      }
    });
  } catch (error) {
    console.error('Get profile error:', error);
    res.status(500).json({ error: 'Failed to fetch profile' });
  }
});

module.exports = router;
