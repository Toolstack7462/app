const mongoose = require('mongoose');

const activityLogSchema = new mongoose.Schema({
  actorRole: {
    type: String,
    enum: ['ADMIN', 'CLIENT', 'SYSTEM'],
    required: true
  },
  actorId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  },
  action: {
    type: String,
    required: true
  },
  meta: {
    type: mongoose.Schema.Types.Mixed
  }
}, {
  timestamps: true
});

// Index for queries
activityLogSchema.index({ createdAt: -1 });
activityLogSchema.index({ actorId: 1, createdAt: -1 });
activityLogSchema.index({ action: 1 });

// Static method to log activity
activityLogSchema.statics.log = async function(actorRole, actorId, action, meta = {}) {
  return this.create({
    actorRole,
    actorId,
    action,
    meta
  });
};

module.exports = mongoose.model('ActivityLog', activityLogSchema);
