const express = require('express');
const router = express.Router();
const Tool = require('../../models/Tool');
const ToolAssignment = require('../../models/ToolAssignment');
const ActivityLog = require('../../models/ActivityLog');
const DeviceBinding = require('../../models/DeviceBinding');
const { requireAuth, requireRole } = require('../../middleware/auth');
const { decryptCookies } = require('../../utils/encryption');

// Apply auth middleware
router.use(requireAuth);
router.use(requireRole('CLIENT'));

// GET /api/client/tools - Get assigned tools for client
router.get('/', async (req, res) => {
  try {
    const { search, category } = req.query;
    
    // Update expired assignments
    await ToolAssignment.updateExpiredAssignments();
    
    // Get valid assignments
    const assignments = await ToolAssignment.find({
      clientId: req.userId,
      status: 'active'
    }).populate('toolId');
    
    // Filter valid assignments based on dates
    const now = new Date();
    const validAssignments = assignments.filter(assignment => {
      if (!assignment.toolId || assignment.toolId.status !== 'active') return false;
      if (assignment.startDate && assignment.startDate > now) return false;
      if (assignment.endDate && assignment.endDate < now) return false;
      return true;
    });
    
    let tools = validAssignments.map(assignment => ({
      ...assignment.toolId.toObject(),
      cookiesEncrypted: undefined,
      assignmentId: assignment._id,
      startDate: assignment.startDate,
      endDate: assignment.endDate,
      durationDays: assignment.durationDays
    }));
    
    // Apply filters
    if (search) {
      tools = tools.filter(tool => 
        tool.name.toLowerCase().includes(search.toLowerCase()) ||
        tool.description?.toLowerCase().includes(search.toLowerCase())
      );
    }
    
    if (category) {
      tools = tools.filter(tool => tool.category === category);
    }
    
    res.json({ tools });
  } catch (error) {
    console.error('Get client tools error:', error);
    res.status(500).json({ error: 'Failed to fetch tools' });
  }
});

// GET /api/client/tools/:toolId - Get specific tool details
router.get('/:toolId', async (req, res) => {
  try {
    // Verify assignment
    const assignment = await ToolAssignment.findOne({
      clientId: req.userId,
      toolId: req.params.toolId,
      status: 'active'
    }).populate('toolId');
    
    if (!assignment) {
      return res.status(403).json({ error: 'Access denied. Tool not assigned to you.' });
    }
    
    // Check if tool is valid
    if (!assignment.toolId || assignment.toolId.status !== 'active') {
      return res.status(403).json({ error: 'Tool is not available' });
    }
    
    // Check date restrictions
    const now = new Date();
    if (assignment.startDate && assignment.startDate > now) {
      return res.status(403).json({ error: 'Tool access has not started yet' });
    }
    if (assignment.endDate && assignment.endDate < now) {
      return res.status(403).json({ error: 'Tool access has expired' });
    }
    
    const tool = {
      ...assignment.toolId.toObject(),
      cookiesEncrypted: undefined,
      assignmentId: assignment._id,
      startDate: assignment.startDate,
      endDate: assignment.endDate,
      durationDays: assignment.durationDays
    };
    
    res.json({ tool });
  } catch (error) {
    console.error('Get tool details error:', error);
    res.status(500).json({ error: 'Failed to fetch tool details' });
  }
});

// POST /api/client/tools/:toolId/cookies - Get decrypted cookies
router.post('/:toolId/cookies', async (req, res) => {
  try {
    const { deviceId } = req.body;
    
    if (!deviceId) {
      return res.status(400).json({ error: 'Device ID required' });
    }
    
    // Verify device matches if policy enabled
    const user = await require('../../models/User').findById(req.userId);
    if (user.devicePolicy.enabled) {
      const isValid = await DeviceBinding.verifyDevice(req.userId, deviceId);
      if (!isValid) {
        return res.status(403).json({ error: 'Device mismatch. Please use your registered device.' });
      }
    }
    
    // Verify assignment
    const assignment = await ToolAssignment.findOne({
      clientId: req.userId,
      toolId: req.params.toolId,
      status: 'active'
    }).populate('toolId');
    
    if (!assignment || !assignment.isValid()) {
      return res.status(403).json({ error: 'Access denied' });
    }
    
    const tool = assignment.toolId;
    
    if (!tool.cookiesEncrypted) {
      return res.json({ cookies: null });
    }
    
    // Decrypt cookies
    const cookiesJson = decryptCookies(tool.cookiesEncrypted);
    
    await ActivityLog.log('CLIENT', req.userId, 'COOKIES_REQUESTED', {
      toolId: tool._id,
      toolName: tool.name
    });
    
    res.json({ cookies: cookiesJson });
  } catch (error) {
    console.error('Get cookies error:', error);
    res.status(500).json({ error: 'Failed to fetch cookies' });
  }
});

module.exports = router;
