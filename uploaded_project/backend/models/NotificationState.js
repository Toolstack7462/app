const mongoose = require('mongoose');

const notificationStateSchema = new mongoose.Schema({
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
  type: {
    type: String,
    enum: ['EXPIRY_3D'],
    required: true
  },
  dismissedUntil: {
    type: Date
  },
  dismissed: {
    type: Boolean,
    default: false
  }
}, {
  timestamps: true
});

// Unique compound index
notificationStateSchema.index({ clientId: 1, assignmentId: 1, type: 1 }, { unique: true });

module.exports = mongoose.model('NotificationState', notificationStateSchema);
