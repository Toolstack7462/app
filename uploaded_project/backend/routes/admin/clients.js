const express = require('express');
const router = express.Router();
const User = require('../../models/User');
const ToolAssignment = require('../../models/ToolAssignment');
const DeviceBinding = require('../../models/DeviceBinding');
const ActivityLog = require('../../models/ActivityLog');
const { requireAuth, requireRole } = require('../../middleware/auth');

// Apply auth middleware
router.use(requireAuth);
router.use(requireRole('ADMIN'));

// GET /api/admin/clients - List clients with search
router.get('/', async (req, res) => {
  try {
    const { search, status, deviceLocked } = req.query;
    const query = { role: 'CLIENT' };
    
    if (search) {
      query.$or = [
        { fullName: { $regex: search, $options: 'i' } },
        { email: { $regex: search, $options: 'i' } }
      ];
    }
    
    if (status) query.status = status;
    
    let clients = await User.find(query)
      .select('-passwordHash')
      .sort({ createdAt: -1 });
    
    // Get assignment counts and device bindings
    const clientsWithData = await Promise.all(
      clients.map(async (client) => {
        const assignmentCount = await ToolAssignment.countDocuments({ 
          clientId: client._id,
          status: 'active'
        });
        
        const deviceBinding = await DeviceBinding.findOne({ clientId: client._id });
        const isDeviceLocked = !!deviceBinding && client.devicePolicy.enabled;
        
        return {
          ...client.toObject(),
          assignmentCount,
          isDeviceLocked
        };
      })
    );
    
    // Filter by device locked if specified
    let filteredClients = clientsWithData;
    if (deviceLocked === 'true') {
      filteredClients = clientsWithData.filter(c => c.isDeviceLocked);
    } else if (deviceLocked === 'false') {
      filteredClients = clientsWithData.filter(c => !c.isDeviceLocked);
    }
    
    res.json({ clients: filteredClients });
  } catch (error) {
    console.error('Get clients error:', error);
    res.status(500).json({ error: 'Failed to fetch clients' });
  }
});

// GET /api/admin/clients/:id - Get single client with assignments
router.get('/:id', async (req, res) => {
  try {
    const client = await User.findById(req.params.id).select('-passwordHash');
    
    if (!client || client.role !== 'CLIENT') {
      return res.status(404).json({ error: 'Client not found' });
    }
    
    const assignments = await ToolAssignment.find({ clientId: client._id })
      .populate('toolId', 'name category status targetUrl')
      .sort({ createdAt: -1 });
    
    const deviceBinding = await DeviceBinding.findOne({ clientId: client._id });
    
    res.json({ 
      client: client.toObject(),
      assignments,
      deviceBinding
    });
  } catch (error) {
    console.error('Get client error:', error);
    res.status(500).json({ error: 'Failed to fetch client' });
  }
});

// POST /api/admin/clients - Create client
router.post('/', async (req, res) => {
  try {
    const { fullName, email, password, status, devicePolicyEnabled, notes } = req.body;
    
    if (!fullName || !email || !password) {
      return res.status(400).json({ error: 'Full name, email, and password are required' });
    }
    
    // Check if email already exists
    const existing = await User.findOne({ email });
    if (existing) {
      return res.status(400).json({ error: 'Email already exists' });
    }
    
    const client = await User.create({
      fullName,
      email,
      passwordHash: password,
      role: 'CLIENT',
      status: status || 'active',
      devicePolicy: {
        enabled: devicePolicyEnabled !== false,
        maxDevices: 1
      },
      notes
    });
    
    await ActivityLog.log('ADMIN', req.userId, 'CLIENT_CREATED', {
      clientId: client._id,
      clientEmail: client.email
    });
    
    res.status(201).json({ 
      success: true, 
      client
    });
  } catch (error) {
    console.error('Create client error:', error);
    res.status(500).json({ error: 'Failed to create client' });
  }
});

// PUT /api/admin/clients/:id - Update client
router.put('/:id', async (req, res) => {
  try {
    const { fullName, email, password, status, devicePolicyEnabled, notes } = req.body;
    
    const client = await User.findById(req.params.id);
    if (!client || client.role !== 'CLIENT') {
      return res.status(404).json({ error: 'Client not found' });
    }
    
    if (fullName) client.fullName = fullName;
    if (email) {
      // Check email uniqueness
      const existing = await User.findOne({ email, _id: { $ne: client._id } });
      if (existing) {
        return res.status(400).json({ error: 'Email already exists' });
      }
      client.email = email;
    }
    if (password) client.passwordHash = password;
    if (status) client.status = status;
    if (devicePolicyEnabled !== undefined) {
      client.devicePolicy.enabled = devicePolicyEnabled;
    }
    if (notes !== undefined) client.notes = notes;
    
    await client.save();
    
    await ActivityLog.log('ADMIN', req.userId, 'CLIENT_UPDATED', {
      clientId: client._id,
      clientEmail: client.email
    });
    
    res.json({ 
      success: true, 
      client
    });
  } catch (error) {
    console.error('Update client error:', error);
    res.status(500).json({ error: 'Failed to update client' });
  }
});

// POST /api/admin/clients/:id/device-reset - Reset device binding
router.post('/:id/device-reset', async (req, res) => {
  try {
    const client = await User.findById(req.params.id);
    if (!client || client.role !== 'CLIENT') {
      return res.status(404).json({ error: 'Client not found' });
    }
    
    await DeviceBinding.deleteMany({ clientId: client._id });
    
    await ActivityLog.log('ADMIN', req.userId, 'DEVICE_RESET', {
      clientId: client._id,
      clientEmail: client.email
    });
    
    res.json({ success: true });
  } catch (error) {
    console.error('Device reset error:', error);
    res.status(500).json({ error: 'Failed to reset device' });
  }
});

// DELETE /api/admin/clients/:id - Delete client
router.delete('/:id', async (req, res) => {
  try {
    const client = await User.findById(req.params.id);
    if (!client || client.role !== 'CLIENT') {
      return res.status(404).json({ error: 'Client not found' });
    }
    
    // Delete all related data
    await ToolAssignment.deleteMany({ clientId: client._id });
    await DeviceBinding.deleteMany({ clientId: client._id });
    
    await ActivityLog.log('ADMIN', req.userId, 'CLIENT_DELETED', {
      clientId: client._id,
      clientEmail: client.email
    });
    
    await client.deleteOne();
    
    res.json({ success: true });
  } catch (error) {
    console.error('Delete client error:', error);
    res.status(500).json({ error: 'Failed to delete client' });
  }
});

module.exports = router;
