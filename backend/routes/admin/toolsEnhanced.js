const express = require('express');
const router = express.Router();
const Tool = require('../../models/Tool');
const ToolAssignment = require('../../models/ToolAssignment');
const ActivityLog = require('../../models/ActivityLog');
const { requireAuth, requireAdmin, getClientIp } = require('../../middleware/authEnhanced');
const { validate, schemas } = require('../../middleware/validation');
const { normalizeStringInputs } = require('../../middleware/normalize');

// Apply auth middleware
router.use(requireAuth);
router.use(requireAdmin);

// GET /api/crm/admin/tools - List tools with pagination
router.get('/', async (req, res) => {
  try {
    const { 
      search, 
      category, 
      status,
      page = 1,
      limit = 20,
      sortBy = 'createdAt',
      sortOrder = 'desc'
    } = req.query;
    
    const query = {};
    
    // Search filter
    if (search) {
      query.$or = [
        { name: { $regex: search, $options: 'i' } },
        { description: { $regex: search, $options: 'i' } }
      ];
    }
    
    if (category) query.category = category;
    if (status) query.status = status;
    
    // Pagination
    const skip = (parseInt(page) - 1) * parseInt(limit);
    const sort = { [sortBy]: sortOrder === 'desc' ? -1 : 1 };
    
    const [tools, totalCount] = await Promise.all([
      Tool.find(query)
        .sort(sort)
        .skip(skip)
        .limit(parseInt(limit))
        .populate('createdBy', 'fullName email'),
      Tool.countDocuments(query)
    ]);
    
    // Enrich with assignment count
    const toolsWithData = await Promise.all(
      tools.map(async (tool) => {
        const assignmentCount = await ToolAssignment.countDocuments({ 
          toolId: tool._id,
          status: 'active'
        });
        
        return {
          ...tool.toObject(),
          assignmentCount
        };
      })
    );
    
    res.json({
      success: true,
      tools: toolsWithData,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        totalCount,
        totalPages: Math.ceil(totalCount / parseInt(limit)),
        hasMore: skip + tools.length < totalCount
      }
    });
  } catch (error) {
    console.error('Get tools error:', error);
    res.status(500).json({ error: 'Failed to fetch tools' });
  }
});

// GET /api/crm/admin/tools/stats - Get tool statistics
router.get('/stats', async (req, res) => {
  try {
    const [totalTools, activeTools, inactiveTools, toolsByCategory] = await Promise.all([
      Tool.countDocuments(),
      Tool.countDocuments({ status: 'active' }),
      Tool.countDocuments({ status: 'inactive' }),
      Tool.aggregate([
        { $group: { _id: '$category', count: { $sum: 1 } } },
        { $sort: { count: -1 } }
      ])
    ]);
    
    res.json({
      success: true,
      stats: {
        totalTools,
        activeTools,
        inactiveTools,
        byCategory: toolsByCategory
      }
    });
  } catch (error) {
    console.error('Get tool stats error:', error);
    res.status(500).json({ error: 'Failed to fetch statistics' });
  }
});

// GET /api/crm/admin/tools/:id - Get single tool
router.get('/:id', async (req, res) => {
  try {
    const tool = await Tool.findById(req.params.id)
      .populate('createdBy', 'fullName email');
    
    if (!tool) {
      return res.status(404).json({ error: 'Tool not found' });
    }
    
    // Get assignments for this tool
    const assignments = await ToolAssignment.find({ toolId: tool._id })
      .populate('clientId', 'fullName email status')
      .sort({ createdAt: -1 })
      .limit(10);
    
    res.json({
      success: true,
      tool: tool.toObject(),
      recentAssignments: assignments
    });
  } catch (error) {
    console.error('Get tool error:', error);
    res.status(500).json({ error: 'Failed to fetch tool' });
  }
});

// POST /api/crm/admin/tools - Create tool
router.post('/', normalizeStringInputs, validate(schemas.createTool), async (req, res) => {
  try {
    const toolData = {
      ...req.body,
      createdBy: req.userId
    };
    
    const tool = await Tool.create(toolData);
    const ipAddress = getClientIp(req);
    
    await ActivityLog.log('ADMIN', req.userId, 'TOOL_CREATED', {
      toolId: tool._id,
      toolName: tool.name,
      category: tool.category,
      ipAddress
    });
    
    res.status(201).json({
      success: true,
      tool: tool.toObject(),
      message: 'Tool created successfully'
    });
  } catch (error) {
    console.error('Create tool error:', error);
    
    // Provide detailed error for validation issues
    if (error.name === 'ValidationError') {
      const errors = Object.values(error.errors).map(err => err.message);
      return res.status(400).json({ 
        error: 'Validation failed',
        details: errors 
      });
    }
    
    res.status(500).json({ error: 'Failed to create tool' });
  }
});

// PUT /api/crm/admin/tools/:id - Update tool
router.put('/:id', normalizeStringInputs, validate(schemas.updateTool), async (req, res) => {
  try {
    const tool = await Tool.findById(req.params.id);
    
    if (!tool) {
      return res.status(404).json({ error: 'Tool not found' });
    }
    
    // Track changes
    const changes = {};
    const allowedUpdates = [
      'name', 'description', 'targetUrl', 'loginUrl', 'category', 'status', 
      'cookiesEncrypted', 'tokenEncrypted', 'tokenHeader', 'tokenPrefix',
      'localStorageEncrypted', 'credentialType', 'extensionSettings', 'fileMeta',
      'credentials', 'comboAuth', 'sessionBundle' // New unified credentials, combo auth, and session bundle fields
    ];
    
    allowedUpdates.forEach(field => {
      if (req.body[field] !== undefined && req.body[field] !== tool[field]) {
        // Mask encrypted/sensitive fields in change log
        const isSensitive = field.includes('Encrypted') || field === 'credentials';
        changes[field] = { 
          from: isSensitive ? '[encrypted]' : tool[field], 
          to: isSensitive ? '[encrypted]' : req.body[field] 
        };
        tool[field] = req.body[field];
      }
    });
    
    await tool.save();
    const ipAddress = getClientIp(req);
    
    await ActivityLog.log('ADMIN', req.userId, 'TOOL_UPDATED', {
      toolId: tool._id,
      toolName: tool.name,
      changes,
      ipAddress
    });
    
    res.json({
      success: true,
      tool: tool.toObject(),
      message: 'Tool updated successfully'
    });
  } catch (error) {
    console.error('Update tool error:', error);
    res.status(500).json({ error: 'Failed to update tool' });
  }
});

// DELETE /api/crm/admin/tools/:id - Delete tool
router.delete('/:id', async (req, res) => {
  try {
    const tool = await Tool.findById(req.params.id);
    
    if (!tool) {
      return res.status(404).json({ error: 'Tool not found' });
    }
    
    // Check if tool has active assignments
    const activeAssignments = await ToolAssignment.countDocuments({
      toolId: tool._id,
      status: 'active'
    });
    
    if (activeAssignments > 0) {
      return res.status(400).json({ 
        error: `Cannot delete tool. It has ${activeAssignments} active assignment(s). Please remove assignments first.`
      });
    }
    
    // Delete all assignments
    await ToolAssignment.deleteMany({ toolId: tool._id });
    
    const ipAddress = getClientIp(req);
    
    await ActivityLog.log('ADMIN', req.userId, 'TOOL_DELETED', {
      toolId: tool._id,
      toolName: tool.name,
      ipAddress
    });
    
    await tool.deleteOne();
    
    res.json({
      success: true,
      message: 'Tool deleted successfully'
    });
  } catch (error) {
    console.error('Delete tool error:', error);
    res.status(500).json({ error: 'Failed to delete tool' });
  }
});

// POST /api/crm/admin/tools/:id/session-bundle - Save/Update Session Bundle
// Unified endpoint to save cookies + localStorage + sessionStorage as one bundle
router.post('/:id/session-bundle', async (req, res) => {
  try {
    const { encryptCookies } = require('../../utils/encryption');
    
    const tool = await Tool.findById(req.params.id);
    
    if (!tool) {
      return res.status(404).json({ error: 'Tool not found' });
    }
    
    const { cookies, localStorage, sessionStorage } = req.body;
    
    // Initialize session bundle if not exists
    if (!tool.sessionBundle) {
      tool.sessionBundle = {
        version: 0,
        updatedAt: new Date()
      };
    }
    
    // Encrypt and save each component if provided
    if (cookies !== undefined) {
      if (cookies && (Array.isArray(cookies) ? cookies.length > 0 : Object.keys(cookies).length > 0)) {
        tool.sessionBundle.cookiesEncrypted = encryptCookies(JSON.stringify(cookies));
      } else {
        tool.sessionBundle.cookiesEncrypted = null;
      }
    }
    
    if (localStorage !== undefined) {
      if (localStorage && Object.keys(localStorage).length > 0) {
        tool.sessionBundle.localStorageEncrypted = encryptCookies(JSON.stringify(localStorage));
      } else {
        tool.sessionBundle.localStorageEncrypted = null;
      }
    }
    
    if (sessionStorage !== undefined) {
      if (sessionStorage && Object.keys(sessionStorage).length > 0) {
        tool.sessionBundle.sessionStorageEncrypted = encryptCookies(JSON.stringify(sessionStorage));
      } else {
        tool.sessionBundle.sessionStorageEncrypted = null;
      }
    }
    
    // Version and timestamp are updated by pre-save hook
    tool.sessionBundle.updatedBy = req.userId;
    
    // Manually trigger version bump since we're modifying nested fields
    tool.sessionBundle.version = (tool.sessionBundle.version || 0) + 1;
    tool.sessionBundle.updatedAt = new Date();
    tool.credentialVersion = (tool.credentialVersion || 0) + 1;
    tool.credentialUpdatedAt = new Date();
    
    await tool.save();
    
    const ipAddress = getClientIp(req);
    
    await ActivityLog.log('ADMIN', req.userId, 'TOOL_SESSION_BUNDLE_UPDATED', {
      toolId: tool._id,
      toolName: tool.name,
      bundleVersion: tool.sessionBundle.version,
      hasCookies: !!tool.sessionBundle.cookiesEncrypted,
      hasLocalStorage: !!tool.sessionBundle.localStorageEncrypted,
      hasSessionStorage: !!tool.sessionBundle.sessionStorageEncrypted,
      ipAddress
    });
    
    res.json({
      success: true,
      message: 'Session bundle saved successfully',
      sessionBundle: {
        version: tool.sessionBundle.version,
        updatedAt: tool.sessionBundle.updatedAt,
        hasCookies: !!tool.sessionBundle.cookiesEncrypted,
        hasLocalStorage: !!tool.sessionBundle.localStorageEncrypted,
        hasSessionStorage: !!tool.sessionBundle.sessionStorageEncrypted
      }
    });
  } catch (error) {
    console.error('Save session bundle error:', error);
    res.status(500).json({ error: 'Failed to save session bundle' });
  }
});

// GET /api/crm/admin/tools/:id/session-bundle - Get Session Bundle (decrypted for admin)
router.get('/:id/session-bundle', async (req, res) => {
  try {
    const { decryptCookies } = require('../../utils/encryption');
    
    const tool = await Tool.findById(req.params.id);
    
    if (!tool) {
      return res.status(404).json({ error: 'Tool not found' });
    }
    
    const sessionBundle = {
      version: tool.sessionBundle?.version || 0,
      updatedAt: tool.sessionBundle?.updatedAt,
      cookies: null,
      localStorage: null,
      sessionStorage: null
    };
    
    // Decrypt session bundle components
    if (tool.sessionBundle?.cookiesEncrypted) {
      try {
        const cookiesJson = decryptCookies(tool.sessionBundle.cookiesEncrypted);
        sessionBundle.cookies = JSON.parse(cookiesJson);
      } catch (e) {
        console.error('Failed to decrypt cookies:', e);
      }
    }
    
    if (tool.sessionBundle?.localStorageEncrypted) {
      try {
        const localStorageJson = decryptCookies(tool.sessionBundle.localStorageEncrypted);
        sessionBundle.localStorage = JSON.parse(localStorageJson);
      } catch (e) {
        console.error('Failed to decrypt localStorage:', e);
      }
    }
    
    if (tool.sessionBundle?.sessionStorageEncrypted) {
      try {
        const sessionStorageJson = decryptCookies(tool.sessionBundle.sessionStorageEncrypted);
        sessionBundle.sessionStorage = JSON.parse(sessionStorageJson);
      } catch (e) {
        console.error('Failed to decrypt sessionStorage:', e);
      }
    }
    
    res.json({
      success: true,
      sessionBundle
    });
  } catch (error) {
    console.error('Get session bundle error:', error);
    res.status(500).json({ error: 'Failed to get session bundle' });
  }
});

module.exports = router;
