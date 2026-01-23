const express = require('express');
const router = express.Router();
const User = require('../models/User');
const DeviceBinding = require('../models/DeviceBinding');
const ActivityLog = require('../models/ActivityLog');
const { generateToken } = require('../middleware/auth');

// Admin credentials (hardcoded for simplicity - in production use env)
const ADMIN_CREDENTIALS = {
  email: 'admin@toolstack.com',
  password: 'admin123'
};

// POST /api/auth/admin/login
router.post('/admin/login', async (req, res) => {
  try {
    const { email, password } = req.body;
    
    if (email === ADMIN_CREDENTIALS.email && password === ADMIN_CREDENTIALS.password) {
      // Find or create admin user
      let admin = await User.findOne({ email, role: 'ADMIN' });
      
      if (!admin) {
        admin = await User.create({
          email,
          passwordHash: password,
          fullName: 'Admin',
          role: 'ADMIN'
        });
      }
      
      const token = generateToken(admin._id, admin.role);
      
      await ActivityLog.log('ADMIN', admin._id, 'ADMIN_LOGIN');
      
      res.cookie('token', token, {
        httpOnly: true,
        maxAge: 7 * 24 * 60 * 60 * 1000, // 7 days
        sameSite: 'strict'
      });
      
      res.json({
        success: true,
        user: admin,
        token
      });
    } else {
      res.status(401).json({ error: 'Invalid credentials' });
    }
  } catch (error) {
    console.error('Admin login error:', error);
    res.status(500).json({ error: 'Login failed' });
  }
});

// POST /api/auth/client/login
router.post('/client/login', async (req, res) => {
  try {
    const { email, password, deviceId } = req.body;
    
    if (!email || !password) {
      return res.status(400).json({ error: 'Email and password required' });
    }
    
    if (!deviceId) {
      return res.status(400).json({ error: 'Device ID required' });
    }
    
    // Find client
    const client = await User.findOne({ email, role: 'CLIENT' });
    if (!client) {
      return res.status(401).json({ error: 'Invalid email or password' });
    }
    
    // Verify password
    const isValid = await client.comparePassword(password);
    if (!isValid) {
      return res.status(401).json({ error: 'Invalid email or password' });
    }
    
    // Check if disabled
    if (client.status === 'disabled') {
      await ActivityLog.log('CLIENT', client._id, 'LOGIN_BLOCKED_DISABLED');
      return res.status(403).json({ error: 'Your account has been disabled. Please contact support.' });
    }
    
    // Device binding check
    if (client.devicePolicy.enabled) {
      const deviceIdHash = DeviceBinding.hashDeviceId(deviceId);
      const existingBinding = await DeviceBinding.findOne({ clientId: client._id });
      
      if (!existingBinding) {
        // First login - create binding
        await DeviceBinding.create({
          clientId: client._id,
          deviceIdHash,
          userAgent: req.headers['user-agent']
        });
      } else if (existingBinding.deviceIdHash !== deviceIdHash) {
        // Device mismatch
        await ActivityLog.log('CLIENT', client._id, 'LOGIN_BLOCKED_DEVICE', { attemptedDeviceId: deviceId });
        return res.status(403).json({ 
          error: 'This account is locked to another device. Please contact admin to reset device access.' 
        });
      } else {
        // Update last seen
        existingBinding.lastSeenAt = new Date();
        await existingBinding.save();
      }
    }
    
    const token = generateToken(client._id, client.role);
    
    await ActivityLog.log('CLIENT', client._id, 'CLIENT_LOGIN');
    
    res.cookie('token', token, {
      httpOnly: true,
      maxAge: 7 * 24 * 60 * 60 * 1000,
      sameSite: 'strict'
    });
    
    res.json({
      success: true,
      user: client,
      token
    });
  } catch (error) {
    console.error('Client login error:', error);
    res.status(500).json({ error: 'Login failed' });
  }
});

// POST /api/auth/logout
router.post('/logout', (req, res) => {
  res.clearCookie('token');
  res.json({ success: true });
});

// GET /api/auth/me
router.get('/me', async (req, res) => {
  try {
    const token = req.cookies.token || (req.headers.authorization && req.headers.authorization.split(' ')[1]);
    
    if (!token) {
      return res.status(401).json({ error: 'Not authenticated' });
    }
    
    const { verifyToken } = require('../middleware/auth');
    const decoded = verifyToken(token);
    
    if (!decoded) {
      return res.status(401).json({ error: 'Invalid token' });
    }
    
    const user = await User.findById(decoded.userId).select('-passwordHash');
    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }
    
    res.json({ user });
  } catch (error) {
    console.error('Get user error:', error);
    res.status(500).json({ error: 'Failed to get user' });
  }
});

module.exports = router;
