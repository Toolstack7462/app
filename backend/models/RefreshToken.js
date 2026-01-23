const mongoose = require('mongoose');

const refreshTokenSchema = new mongoose.Schema({
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  token: {
    type: String,
    required: true,
    unique: true
  },
  expiresAt: {
    type: Date,
    required: true
  },
  createdByIp: {
    type: String
  },
  revokedAt: {
    type: Date
  },
  revokedByIp: {
    type: String
  },
  replacedByToken: {
    type: String
  }
}, {
  timestamps: true
});

// Index for cleanup
refreshTokenSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });
refreshTokenSchema.index({ userId: 1 });
refreshTokenSchema.index({ token: 1 });

// Check if token is active
refreshTokenSchema.virtual('isActive').get(function() {
  return !this.revokedAt && this.expiresAt > new Date();
});

// Static method to revoke token
refreshTokenSchema.statics.revokeToken = async function(token, ipAddress) {
  const refreshToken = await this.findOne({ token });
  if (!refreshToken || !refreshToken.isActive) return null;
  
  refreshToken.revokedAt = new Date();
  refreshToken.revokedByIp = ipAddress;
  await refreshToken.save();
  
  return refreshToken;
};

module.exports = mongoose.model('RefreshToken', refreshTokenSchema);
