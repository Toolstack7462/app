const mongoose = require('mongoose');

const toolSchema = new mongoose.Schema({
  name: {
    type: String,
    required: true,
    trim: true
  },
  description: {
    type: String,
    trim: true
  },
  targetUrl: {
    type: String,
    required: true
  },
  category: {
    type: String,
    enum: ['AI', 'Academic', 'SEO', 'Productivity', 'Graphics & SEO', 'Text Humanizers', 'Career-Oriented', 'Miscellaneous', 'Other'],
    default: 'Other'
  },
  status: {
    type: String,
    enum: ['active', 'inactive'],
    default: 'active'
  },
  fileMeta: {
    name: String,
    size: Number,
    type: String
  },
  cookiesEncrypted: {
    type: String // AES-256-GCM encrypted JSON
  },
  createdBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  }
}, {
  timestamps: true
});

// Index for search
toolSchema.index({ name: 'text', description: 'text' });
toolSchema.index({ category: 1, status: 1 });

module.exports = mongoose.model('Tool', toolSchema);
