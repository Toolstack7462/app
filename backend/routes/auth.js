const express = require('express');
const router = express.Router();
const User = require('../models/User');
const RefreshToken = require('../models/RefreshToken');
const DeviceBinding = require('../models/DeviceBinding');
const ActivityLog = require('../models/ActivityLog');
const { 
  generateTokenPair, 
  verifyRefreshToken, 
  requireAuth,
  getClientIp 
} = require('../middleware/authEnhanced');
const { validate, schemas } = require('../middleware/validation');
const { authLimiter, registerLimiter } = require('../middleware/rateLimiter');

// POST /api/crm/auth/admin/login - Admin login (NO RATE LIMITING for admins)
router.post('/admin/login', validate(schemas.adminLogin), async (req, res) => {
  try {
    const { email, password } = req.body;
    const ipAddress = getClientIp(req);
    
    // Find admin user
    const admin = await User.findOne({ 
      email, 
      role: { $in: ['SUPER_ADMIN', 'ADMIN', 'SUPPORT'] }
    });
    
    if (!admin) {
      await ActivityLog.log('SYSTEM', null, 'ADMIN_LOGIN_FAILED', { 
        email, 
        reason: 'User not found',
        ipAddress 
      });
      return res.status(401).json({ error: 'Invalid email or password' });
    }
    
    // Verify password
    const isValid = await admin.comparePassword(password);
    if (!isValid) {
      await ActivityLog.log('ADMIN', admin._id, 'ADMIN_LOGIN_FAILED', { 
        email,
        reason: 'Invalid password',
        ipAddress 
      });
      return res.status(401).json({ error: 'Invalid email or password' });
    }
    
    // Check if account is disabled
    if (admin.status === 'disabled') {
      await ActivityLog.log('ADMIN', admin._id, 'ADMIN_LOGIN_BLOCKED', { 
        reason: 'Account disabled',
        ipAddress 
      });
      return res.status(403).json({ error: 'Your account has been disabled' });
    }
    
    // Update last login
    admin.lastLoginAt = new Date();
    admin.lastLoginIp = ipAddress;
    await admin.save();
    
    // Generate token pair
    const { accessToken, refreshToken } = await generateTokenPair(admin, ipAddress);
    
    await ActivityLog.log('ADMIN', admin._id, 'ADMIN_LOGIN', { ipAddress });
    
    // Set cookies
    res.cookie('accessToken', accessToken, {
      httpOnly: true,
      maxAge: 15 * 60 * 1000, // 15 minutes
      sameSite: 'strict',
      secure: process.env.NODE_ENV === 'production'
    });
    
    res.cookie('refreshToken', refreshToken, {
      httpOnly: true,
      maxAge: 7 * 24 * 60 * 60 * 1000, // 7 days
      sameSite: 'strict',
      secure: process.env.NODE_ENV === 'production'
    });
    
    res.json({
      success: true,
      user: admin.toJSON(),
      accessToken,
      refreshToken
    });
  } catch (error) {
    console.error('Admin login error:', error);
    res.status(500).json({ error: 'Login failed' });
  }
});

// POST /api/crm/auth/client/login - Client login (RATE LIMITED for security)
router.post('/client/login', authLimiter, validate(schemas.clientLogin), async (req, res) => {
  try {
    const { email, password, deviceId } = req.body;
    const ipAddress = getClientIp(req);
    
    // Find client
    const client = await User.findOne({ email, role: 'CLIENT' });
    if (!client) {
      await ActivityLog.log('SYSTEM', null, 'CLIENT_LOGIN_FAILED', { 
        email,
        reason: 'User not found',
        ipAddress 
      });
      return res.status(401).json({ error: 'Invalid email or password' });
    }
    
    // Verify password
    const isValid = await client.comparePassword(password);
    if (!isValid) {
      await ActivityLog.log('CLIENT', client._id, 'CLIENT_LOGIN_FAILED', { 
        email,
        reason: 'Invalid password',
        ipAddress 
      });
      return res.status(401).json({ error: 'Invalid email or password' });
    }
    
    // Check if disabled
    if (client.status === 'disabled') {
      await ActivityLog.log('CLIENT', client._id, 'CLIENT_LOGIN_BLOCKED', { 
        reason: 'Account disabled',
        ipAddress 
      });
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
        
        await ActivityLog.log('CLIENT', client._id, 'DEVICE_BOUND', { 
          deviceId: deviceIdHash.substring(0, 10) + '...',
          ipAddress 
        });
      } else if (existingBinding.deviceIdHash !== deviceIdHash) {
        // Device mismatch
        await ActivityLog.log('CLIENT', client._id, 'LOGIN_BLOCKED_DEVICE', { 
          attemptedDevice: deviceIdHash.substring(0, 10) + '...',
          ipAddress 
        });
        return res.status(403).json({ 
          error: 'This account is locked to another device. Please contact admin to reset device access.',
          code: 'DEVICE_MISMATCH'
        });
      } else {
        // Update last seen
        existingBinding.lastSeenAt = new Date();
        await existingBinding.save();
      }
    }
    
    // Update last login
    client.lastLoginAt = new Date();
    client.lastLoginIp = ipAddress;
    await client.save();
    
    // Generate token pair
    const { accessToken, refreshToken } = await generateTokenPair(client, ipAddress);
    
    await ActivityLog.log('CLIENT', client._id, 'CLIENT_LOGIN', { ipAddress });
    
    // Set cookies
    res.cookie('accessToken', accessToken, {
      httpOnly: true,
      maxAge: 15 * 60 * 1000, // 15 minutes
      sameSite: 'strict',
      secure: process.env.NODE_ENV === 'production'
    });
    
    res.cookie('refreshToken', refreshToken, {
      httpOnly: true,
      maxAge: 7 * 24 * 60 * 60 * 1000, // 7 days
      sameSite: 'strict',
      secure: process.env.NODE_ENV === 'production'
    });
    
    res.json({
      success: true,
      user: client.toJSON(),
      accessToken,
      refreshToken
    });
  } catch (error) {
    console.error('Client login error:', error);
    res.status(500).json({ error: 'Login failed' });
  }
});

// POST /api/crm/auth/refresh - Refresh access token
router.post('/refresh', validate(schemas.refreshToken), async (req, res) => {
  try {
    const { refreshToken: token } = req.body;
    const ipAddress = getClientIp(req);
    
    // Verify refresh token JWT
    const decoded = verifyRefreshToken(token);
    if (!decoded) {
      return res.status(401).json({ error: 'Invalid refresh token' });
    }
    
    // Check if refresh token exists in database and is active
    const refreshToken = await RefreshToken.findOne({ token });
    if (!refreshToken || !refreshToken.isActive) {
      return res.status(401).json({ error: 'Refresh token is invalid or expired' });
    }
    
    // Get user
    const user = await User.findById(decoded.userId);
    if (!user || user.status === 'disabled') {
      return res.status(401).json({ error: 'User not found or disabled' });
    }
    
    // Generate new token pair
    const newTokens = await generateTokenPair(user, ipAddress);
    
    // Revoke old refresh token
    refreshToken.revokedAt = new Date();
    refreshToken.revokedByIp = ipAddress;
    refreshToken.replacedByToken = newTokens.refreshToken;
    await refreshToken.save();
    
    await ActivityLog.log(user.role, user._id, 'TOKEN_REFRESHED', { ipAddress });
    
    // Set new cookies
    res.cookie('accessToken', newTokens.accessToken, {
      httpOnly: true,
      maxAge: 15 * 60 * 1000,
      sameSite: 'strict',
      secure: process.env.NODE_ENV === 'production'
    });
    
    res.cookie('refreshToken', newTokens.refreshToken, {
      httpOnly: true,
      maxAge: 7 * 24 * 60 * 60 * 1000,
      sameSite: 'strict',
      secure: process.env.NODE_ENV === 'production'
    });
    
    res.json({
      success: true,
      accessToken: newTokens.accessToken,
      refreshToken: newTokens.refreshToken
    });
  } catch (error) {
    console.error('Token refresh error:', error);
    res.status(500).json({ error: 'Failed to refresh token' });
  }
});

// POST /api/crm/auth/logout - Logout
router.post('/logout', requireAuth, async (req, res) => {
  try {
    const refreshToken = req.cookies.refreshToken || req.body.refreshToken;
    const ipAddress = getClientIp(req);
    
    // Revoke refresh token if provided
    if (refreshToken) {
      await RefreshToken.revokeToken(refreshToken, ipAddress);
    }
    
    await ActivityLog.log(req.userRole, req.userId, 'LOGOUT', { ipAddress });
    
    // Clear cookies
    res.clearCookie('accessToken');
    res.clearCookie('refreshToken');
    
    res.json({ success: true });
  } catch (error) {
    console.error('Logout error:', error);
    res.status(500).json({ error: 'Logout failed' });
  }
});

// GET /api/crm/auth/me - Get current user
router.get('/me', requireAuth, async (req, res) => {
  try {
    res.json({ 
      success: true,
      user: req.user.toJSON() 
    });
  } catch (error) {
    console.error('Get user error:', error);
    res.status(500).json({ error: 'Failed to get user' });
  }
});

// POST /api/crm/auth/register - Public client registration (optional)
router.post('/register', registerLimiter, validate(schemas.register), async (req, res) => {
  try {
    const { fullName, email, password } = req.body;
    const ipAddress = getClientIp(req);
    
    // Check for existing user
    const existingUser = await User.findOne({ email });
    if (existingUser) {
      return res.status(400).json({ error: 'An account with this email already exists' });
    }
    
    // Create new client
    const client = await User.create({
      fullName,
      email,
      passwordHash: password,
      role: 'CLIENT',
      status: 'active',
      devicePolicy: {
        enabled: true,
        maxDevices: 1
      }
    });
    
    await ActivityLog.log('SYSTEM', null, 'CLIENT_REGISTERED', { 
      clientId: client._id.toString(),
      clientEmail: email,
      ipAddress
    });
    
    res.status(201).json({
      success: true,
      message: 'Account created successfully. You can now login.',
      user: client.toJSON()
    });
  } catch (error) {
    console.error('Registration error:', error);
    res.status(500).json({ error: 'Registration failed. Please try again.' });
  }
});

module.exports = router;
