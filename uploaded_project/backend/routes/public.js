const express = require('express');
const router = express.Router();
const User = require('../models/User');
const ActivityLog = require('../models/ActivityLog');

// POST /api/crm/public/register - Public client registration
router.post('/register', async (req, res) => {
  try {
    const { fullName, email, password } = req.body;
    
    // Validation
    if (!fullName || !email || !password) {
      return res.status(400).json({ error: 'Full name, email, and password are required' });
    }
    
    if (password.length < 6) {
      return res.status(400).json({ error: 'Password must be at least 6 characters' });
    }
    
    // Check for existing user
    const existingUser = await User.findOne({ email });
    if (existingUser) {
      return res.status(400).json({ error: 'An account with this email already exists' });
    }
    
    // Create new client
    const client = await User.create({
      fullName,
      email,
      passwordHash: password, // Will be hashed by the pre-save hook
      role: 'CLIENT',
      status: 'active',
      devicePolicy: {
        enabled: true,
        maxDevices: 1
      }
    });
    
    // Log the registration
    await ActivityLog.log('SYSTEM', null, 'CLIENT_REGISTERED', { 
      clientId: client._id.toString(),
      clientEmail: email 
    });
    
    res.status(201).json({
      success: true,
      message: 'Account created successfully. You can now login.',
      client: {
        _id: client._id,
        fullName: client.fullName,
        email: client.email,
        status: client.status
      }
    });
  } catch (error) {
    console.error('Registration error:', error);
    res.status(500).json({ error: 'Registration failed. Please try again.' });
  }
});

module.exports = router;
