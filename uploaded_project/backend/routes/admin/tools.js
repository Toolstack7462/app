const express = require('express');
const router = express.Router();
const Tool = require('../../models/Tool');
const ToolAssignment = require('../../models/ToolAssignment');
const ActivityLog = require('../../models/ActivityLog');
const { requireAuth, requireRole } = require('../../middleware/auth');
const { encryptCookies, validateCookiesJson } = require('../../utils/encryption');

// Apply auth middleware to all routes
router.use(requireAuth);
router.use(requireRole('ADMIN'));

// GET /api/admin/tools - List all tools
router.get('/', async (req, res) => {
  try {
    const { search, category, status } = req.query;
    const query = {};
    
    if (search) {
      query.$or = [
        { name: { $regex: search, $options: 'i' } },
        { description: { $regex: search, $options: 'i' } },
        { targetUrl: { $regex: search, $options: 'i' } }
      ];
    }
    
    if (category) query.category = category;
    if (status) query.status = status;
    
    const tools = await Tool.find(query)
      .select('-cookiesEncrypted') // Don't return encrypted cookies by default
      .sort({ createdAt: -1 });
    
    // Get assignment counts
    const toolsWithCounts = await Promise.all(
      tools.map(async (tool) => {
        const assignmentCount = await ToolAssignment.countDocuments({ toolId: tool._id });
        return {
          ...tool.toObject(),
          assignmentCount
        };
      })
    );
    
    res.json({ tools: toolsWithCounts });
  } catch (error) {
    console.error('Get tools error:', error);
    res.status(500).json({ error: 'Failed to fetch tools' });
  }
});

// GET /api/admin/tools/:id - Get single tool
router.get('/:id', async (req, res) => {
  try {
    const tool = await Tool.findById(req.params.id).select('-cookiesEncrypted');
    
    if (!tool) {
      return res.status(404).json({ error: 'Tool not found' });
    }
    
    const assignmentCount = await ToolAssignment.countDocuments({ toolId: tool._id });
    
    res.json({ 
      tool: { 
        ...tool.toObject(), 
        assignmentCount 
      } 
    });
  } catch (error) {
    console.error('Get tool error:', error);
    res.status(500).json({ error: 'Failed to fetch tool' });
  }
});

// POST /api/admin/tools - Create tool
router.post('/', async (req, res) => {
  try {
    const { name, description, targetUrl, category, status, cookiesJson, fileMeta } = req.body;
    
    if (!name || !targetUrl) {
      return res.status(400).json({ error: 'Name and target URL are required' });
    }
    
    // Validate cookies JSON if provided
    if (cookiesJson) {
      if (!validateCookiesJson(cookiesJson)) {
        return res.status(400).json({ error: 'Invalid cookies JSON format' });
      }
    }
    
    // Encrypt cookies
    let cookiesEncrypted = null;
    if (cookiesJson) {
      cookiesEncrypted = encryptCookies(cookiesJson);
    }
    
    const tool = await Tool.create({
      name,
      description,
      targetUrl,
      category: category || 'Other',
      status: status || 'active',
      cookiesEncrypted,
      fileMeta,
      createdBy: req.userId
    });
    
    await ActivityLog.log('ADMIN', req.userId, 'TOOL_CREATED', {
      toolId: tool._id,
      toolName: tool.name
    });
    
    res.status(201).json({ 
      success: true, 
      tool: { ...tool.toObject(), cookiesEncrypted: undefined } 
    });
  } catch (error) {
    console.error('Create tool error:', error);
    res.status(500).json({ error: 'Failed to create tool' });
  }
});

// PUT /api/admin/tools/:id - Update tool
router.put('/:id', async (req, res) => {
  try {
    const { name, description, targetUrl, category, status, cookiesJson, fileMeta } = req.body;
    
    const tool = await Tool.findById(req.params.id);
    if (!tool) {
      return res.status(404).json({ error: 'Tool not found' });
    }
    
    if (name) tool.name = name;
    if (description !== undefined) tool.description = description;
    if (targetUrl) tool.targetUrl = targetUrl;
    if (category) tool.category = category;
    if (status) tool.status = status;
    if (fileMeta !== undefined) tool.fileMeta = fileMeta;
    
    // Handle cookies update
    if (cookiesJson !== undefined) {
      if (cookiesJson === null || cookiesJson === '') {
        tool.cookiesEncrypted = null;
      } else {
        if (!validateCookiesJson(cookiesJson)) {
          return res.status(400).json({ error: 'Invalid cookies JSON format' });
        }
        tool.cookiesEncrypted = encryptCookies(cookiesJson);
      }
    }
    
    await tool.save();
    
    await ActivityLog.log('ADMIN', req.userId, 'TOOL_UPDATED', {
      toolId: tool._id,
      toolName: tool.name
    });
    
    res.json({ 
      success: true, 
      tool: { ...tool.toObject(), cookiesEncrypted: undefined } 
    });
  } catch (error) {
    console.error('Update tool error:', error);
    res.status(500).json({ error: 'Failed to update tool' });
  }
});

// DELETE /api/admin/tools/:id - Delete tool
router.delete('/:id', async (req, res) => {
  try {
    const tool = await Tool.findById(req.params.id);
    if (!tool) {
      return res.status(404).json({ error: 'Tool not found' });
    }
    
    // Delete all assignments
    await ToolAssignment.deleteMany({ toolId: tool._id });
    
    await ActivityLog.log('ADMIN', req.userId, 'TOOL_DELETED', {
      toolId: tool._id,
      toolName: tool.name
    });
    
    await tool.deleteOne();
    
    res.json({ success: true });
  } catch (error) {
    console.error('Delete tool error:', error);
    res.status(500).json({ error: 'Failed to delete tool' });
  }
});

// PATCH /api/admin/tools/:id/status - Toggle status
router.patch('/:id/status', async (req, res) => {
  try {
    const tool = await Tool.findById(req.params.id);
    if (!tool) {
      return res.status(404).json({ error: 'Tool not found' });
    }
    
    tool.status = tool.status === 'active' ? 'inactive' : 'active';
    await tool.save();
    
    await ActivityLog.log('ADMIN', req.userId, 'TOOL_STATUS_CHANGED', {
      toolId: tool._id,
      toolName: tool.name,
      newStatus: tool.status
    });
    
    res.json({ success: true, tool: { ...tool.toObject(), cookiesEncrypted: undefined } });
  } catch (error) {
    console.error('Toggle status error:', error);
    res.status(500).json({ error: 'Failed to toggle status' });
  }
});

module.exports = router;
