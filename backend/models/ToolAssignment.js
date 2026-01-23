const mongoose = require('mongoose');

const toolAssignmentSchema = new mongoose.Schema({
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
  assignedAt: {
    type: Date,
    default: Date.now
  },
  startDate: {
    type: Date
  },
  endDate: {
    type: Date
  },
  durationDays: {
    type: Number
  },
  status: {
    type: String,
    enum: ['active', 'paused', 'expired'],
    default: 'active'
  },
  notes: {
    type: String
  },
  createdBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  }
}, {
  timestamps: true
});

// Unique compound index
toolAssignmentSchema.index({ clientId: 1, toolId: 1 }, { unique: true });
toolAssignmentSchema.index({ clientId: 1 });
toolAssignmentSchema.index({ toolId: 1 });
toolAssignmentSchema.index({ endDate: 1 });
toolAssignmentSchema.index({ status: 1 });

// Method to check if assignment is valid
toolAssignmentSchema.methods.isValid = function() {
  if (this.status !== 'active') return false;
  
  const now = new Date();
  if (this.startDate && this.startDate > now) return false;
  if (this.endDate && this.endDate < now) return false;
  
  return true;
};

// Static method to check and update expired assignments
toolAssignmentSchema.statics.updateExpiredAssignments = async function() {
  const now = new Date();
  await this.updateMany(
    {
      status: 'active',
      endDate: { $lt: now }
    },
    {
      $set: { status: 'expired' }
    }
  );
};

module.exports = mongoose.model('ToolAssignment', toolAssignmentSchema);
