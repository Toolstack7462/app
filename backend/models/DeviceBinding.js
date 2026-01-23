const mongoose = require('mongoose');
const crypto = require('crypto');

const deviceBindingSchema = new mongoose.Schema({
  clientId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  deviceIdHash: {
    type: String,
    required: true
  },
  userAgent: {
    type: String
  },
  lastSeenAt: {
    type: Date,
    default: Date.now
  }
}, {
  timestamps: true
});

// Index
deviceBindingSchema.index({ clientId: 1 });
deviceBindingSchema.index({ deviceIdHash: 1 });

// Static method to hash device ID
deviceBindingSchema.statics.hashDeviceId = function(deviceId) {
  return crypto.createHash('sha256').update(deviceId).digest('hex');
};

// Static method to verify device binding
deviceBindingSchema.statics.verifyDevice = async function(clientId, deviceId) {
  const deviceIdHash = this.hashDeviceId(deviceId);
  const binding = await this.findOne({ clientId, deviceIdHash });
  return !!binding;
};

module.exports = mongoose.model('DeviceBinding', deviceBindingSchema);
