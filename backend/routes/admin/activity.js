const express = require('express');
const router = express.Router();
const ActivityLog = require('../../models/ActivityLog');
const { requireAuth, requireRole } = require('../../middleware/auth');

// Apply auth middleware - accept all admin roles
router.use(requireAuth);
router.use((req, res, next) => {
  const adminRoles = ['SUPER_ADMIN', 'ADMIN', 'SUPPORT'];
  if (!adminRoles.includes(req.user.role)) {
    return res.status(403).json({ error: 'Insufficient permissions' });
  }
  next();
});

// GET /api/admin/activity - Get activity logs
router.get('/', async (req, res) => {
  try {
    const { limit = 50, skip = 0, action, actorRole } = req.query;
    
    const query = {};
    if (action) query.action = action;
    if (actorRole) query.actorRole = actorRole;
    
    const activities = await ActivityLog.find(query)
      .populate('actorId', 'fullName email role')
      .sort({ createdAt: -1 })
      .limit(parseInt(limit))
      .skip(parseInt(skip));
    
    const total = await ActivityLog.countDocuments(query);
    
    res.json({ 
      activities,
      total,
      limit: parseInt(limit),
      skip: parseInt(skip)
    });
  } catch (error) {
    console.error('Get activity logs error:', error);
    res.status(500).json({ error: 'Failed to fetch activity logs' });
  }
});

module.exports = router;
