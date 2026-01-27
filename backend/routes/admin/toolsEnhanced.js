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
      'credentials', 'comboAuth' // New unified credentials and combo auth fields
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

module.exports = router;
