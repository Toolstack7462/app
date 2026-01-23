const mongoose = require('mongoose');

const expiryDismissalSchema = new mongoose.Schema({
  clientId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  assignmentId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'ToolAssignment',
    required: true
  },
  dismissedAt: {
    type: Date,
    default: Date.now
  },
  dontShowAgain: {
    type: Boolean,
    default: false
  }
}, {
  timestamps: true
});

// Index for quick lookups
expiryDismissalSchema.index({ clientId: 1, assignmentId: 1 }, { unique: true });

module.exports = mongoose.model('ExpiryDismissal', expiryDismissalSchema);
