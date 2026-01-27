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

module.exports = mongoose.model('CredentialAccessLog', credentialAccessLogSchema);
