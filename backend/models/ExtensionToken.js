const mongoose = require('mongoose');
const crypto = require('crypto');

const extensionTokenSchema = new mongoose.Schema({
  clientId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  token: {
    type: String,
    required: true,
    unique: true
  },
  tokenHash: {
    type: String,
    required: true,
    index: true
  },
  name: {
    type: String,
    default: 'Chrome Extension'
  },
  expiresAt: {
    type: Date,
    required: true
  },
  lastUsedAt: {
    type: Date
  },
  isRevoked: {
    type: Boolean,
    default: false
  },
  deviceInfo: {
    userAgent: String,
    ip: String
  }
}, {
  timestamps: true
});

// Index for cleanup
extensionTokenSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });
extensionTokenSchema.index({ clientId: 1, isRevoked: 1 });

// Generate secure token
extensionTokenSchema.statics.generateToken = function() {
  return crypto.randomBytes(32).toString('hex');
};

// Hash token for storage
extensionTokenSchema.statics.hashToken = function(token) {
  return crypto.createHash('sha256').update(token).digest('hex');
};

// Create new extension token for client
extensionTokenSchema.statics.createForClient = async function(clientId, expiresInDays = 30, deviceInfo = {}) {
  const token = this.generateToken();
  const tokenHash = this.hashToken(token);
  
  const extensionToken = new this({
    clientId,
    token: token.substring(0, 8) + '...' + token.substring(token.length - 4), // Store partial for display
    tokenHash,
    expiresAt: new Date(Date.now() + expiresInDays * 24 * 60 * 60 * 1000),
    deviceInfo
  });
  
  await extensionToken.save();
  
  return {
    id: extensionToken._id,
    token, // Return full token only once
    expiresAt: extensionToken.expiresAt
  };
};

// Verify token and return client info
extensionTokenSchema.statics.verifyToken = async function(token) {
  const tokenHash = this.hashToken(token);
  
  const extensionToken = await this.findOne({
    tokenHash,
    isRevoked: false,
    expiresAt: { $gt: new Date() }
  }).populate('clientId', 'email name status');
  
  if (!extensionToken) {
    return null;
  }
  
  // Update last used
  extensionToken.lastUsedAt = new Date();
  await extensionToken.save();
  
  return {
    tokenId: extensionToken._id,
    clientId: extensionToken.clientId._id,
    client: extensionToken.clientId,
    expiresAt: extensionToken.expiresAt
  };
};

// Revoke token
extensionTokenSchema.methods.revoke = async function() {
  this.isRevoked = true;
  await this.save();
};

module.exports = mongoose.model('ExtensionToken', extensionTokenSchema);
