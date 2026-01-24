const mongoose = require('mongoose');

const credentialAccessLogSchema = new mongoose.Schema({
  clientId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  toolId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Tool',
    required: true
  },
  extensionTokenId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'ExtensionToken'
  },
  action: {
    type: String,
    enum: ['CREDENTIALS_FETCHED', 'TOOL_OPENED', 'VERSION_CHECK', 'SYNC_TRIGGERED'],
    required: true
  },
  credentialVersion: {
    type: Number
  },
  deviceInfo: {
    userAgent: String,
    ip: String,
    extensionVersion: String
  },
  success: {
    type: Boolean,
    default: true
  },
  errorMessage: {
    type: String
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
