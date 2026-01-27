const mongoose = require('mongoose');

const credentialAccessLogSchema = new mongoose.Schema({
  clientId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  toolId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Tool'
  },
  extensionTokenId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'ExtensionToken'
  },
  action: {
    type: String,
    enum: [
      'CREDENTIALS_FETCHED', 
      'TOOL_OPENED', 
      'VERSION_CHECK', 
      'SYNC_TRIGGERED',
      // New login attempt tracking actions
      'LOGIN_STARTED',
      'LOGIN_SUCCESS',
      'LOGIN_FAILED',
      'LOGIN_MFA_REQUIRED',
      'LOGIN_MANUAL_REQUIRED'
    ],
    required: true
  },
  credentialVersion: {
    type: Number
  },
  // Login attempt details
  loginAttempt: {
    method: {
      type: String,
      enum: ['session', 'form', 'sso', 'cookies', 'token', 'storage', null]
    },
    duration: Number,        // Time to complete in ms
    attempts: Number,        // Number of retry attempts
    finalUrl: String,        // URL after login attempt
    mfaDetected: Boolean,
    multiStepDetected: Boolean
  },
  deviceInfo: {
    userAgent: String,
    ip: String,
    extensionVersion: String,
    browser: String,
    os: String
  },
  success: {
    type: Boolean,
    default: true
  },
  errorMessage: {
    type: String
  },
  errorCode: {
    type: String  // Structured error codes for analytics
  }
}, {
  timestamps: true
});

// TTL - auto delete after 90 days
credentialAccessLogSchema.index({ createdAt: 1 }, { expireAfterSeconds: 90 * 24 * 60 * 60 });
credentialAccessLogSchema.index({ clientId: 1, createdAt: -1 });
credentialAccessLogSchema.index({ toolId: 1, createdAt: -1 });

// Static method to log access
credentialAccessLogSchema.statics.log = async function(data) {
  try {
    const log = new this(data);
    await log.save();
    return log;
  } catch (error) {
    console.error('Failed to log credential access:', error);
  }
};

// Get login statistics for a tool
credentialAccessLogSchema.statics.getToolLoginStats = async function(toolId, days = 30) {
  const startDate = new Date();
  startDate.setDate(startDate.getDate() - days);
  
  const stats = await this.aggregate([
    {
      $match: {
        toolId: new mongoose.Types.ObjectId(toolId),
        action: { $in: ['LOGIN_SUCCESS', 'LOGIN_FAILED', 'LOGIN_MFA_REQUIRED'] },
        createdAt: { $gte: startDate }
      }
    },
    {
      $group: {
        _id: '$action',
        count: { $sum: 1 },
        avgDuration: { $avg: '$loginAttempt.duration' }
      }
    }
  ]);
  
  return {
    total: stats.reduce((sum, s) => sum + s.count, 0),
    success: stats.find(s => s._id === 'LOGIN_SUCCESS')?.count || 0,
    failed: stats.find(s => s._id === 'LOGIN_FAILED')?.count || 0,
    mfaRequired: stats.find(s => s._id === 'LOGIN_MFA_REQUIRED')?.count || 0,
    avgDuration: stats.find(s => s._id === 'LOGIN_SUCCESS')?.avgDuration || null
  };
};

// Get client login history
credentialAccessLogSchema.statics.getClientLoginHistory = async function(clientId, limit = 50) {
  return this.find({
    clientId,
    action: { $in: ['LOGIN_SUCCESS', 'LOGIN_FAILED', 'LOGIN_MFA_REQUIRED', 'LOGIN_MANUAL_REQUIRED'] }
  })
  .populate('toolId', 'name domain')
  .sort({ createdAt: -1 })
  .limit(limit)
  .lean();
};

module.exports = mongoose.model('CredentialAccessLog', credentialAccessLogSchema);
