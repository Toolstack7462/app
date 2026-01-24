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
      tools.push({
        id: tool._id,
        name: tool.name,
        description: tool.description,
        targetUrl: tool.targetUrl,
        domain: tool.domain,
        category: tool.category,
        credentialType: tool.credentialType || 'cookies',
        credentialVersion: tool.credentialVersion || 1,
        credentialUpdatedAt: tool.credentialUpdatedAt,
        hasCredentials: tool.hasCredentials(),
        extensionSettings: tool.extensionSettings || {},
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
    
    // Prepare credentials based on type
    let credentials = null;
    const credentialType = tool.credentialType || 'cookies';
    
    try {
      if (credentialType === 'cookies' && tool.cookiesEncrypted) {
        const cookiesJson = decryptCookies(tool.cookiesEncrypted);
        credentials = {
          type: 'cookies',
          data: JSON.parse(cookiesJson),
          domain: tool.domain
        };
      } else if (credentialType === 'token' && tool.tokenEncrypted) {
        const tokenValue = decryptCookies(tool.tokenEncrypted);
        credentials = {
          type: 'token',
          data: {
            header: tool.tokenHeader || 'Authorization',
            prefix: tool.tokenPrefix || 'Bearer ',
            value: tokenValue
          },
          domain: tool.domain
        };
      } else if (credentialType === 'localStorage' && tool.localStorageEncrypted) {
        const storageJson = decryptCookies(tool.localStorageEncrypted);
        credentials = {
          type: 'localStorage',
          data: JSON.parse(storageJson),
          domain: tool.domain
        };
      }
    } catch (decryptError) {
      console.error('Credential decryption error:', decryptError);
      return res.status(500).json({ error: 'Failed to decrypt credentials' });
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
      credentialType
    });
    
    res.json({
      success: true,
      tool: {
        id: tool._id,
        name: tool.name,
        targetUrl: tool.targetUrl,
        domain: tool.domain,
        credentialVersion: tool.credentialVersion,
        extensionSettings: tool.extensionSettings || {}
      },
      credentials,
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
