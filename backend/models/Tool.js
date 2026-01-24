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
  // Domain extracted from targetUrl for extension permissions
  domain: {
    type: String,
    index: true
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
  // Credential type: cookies, token, localStorage
  credentialType: {
    type: String,
    enum: ['cookies', 'token', 'localStorage', 'none'],
    default: 'cookies'
  },
  // Encrypted credentials storage
  cookiesEncrypted: {
    type: String // AES-256-GCM encrypted JSON for cookies
  },
  tokenEncrypted: {
    type: String // AES-256-GCM encrypted token/header value
  },
  tokenHeader: {
    type: String, // Header name for token injection (e.g., 'Authorization')
    default: 'Authorization'
  },
  tokenPrefix: {
    type: String, // Prefix for token (e.g., 'Bearer ')
    default: 'Bearer '
  },
  localStorageEncrypted: {
    type: String // AES-256-GCM encrypted localStorage data
  },
  // Credential versioning for extension sync
  credentialVersion: {
    type: Number,
    default: 1
  },
  credentialUpdatedAt: {
    type: Date,
    default: Date.now
  },
  // Extension-specific settings
  extensionSettings: {
    requirePermission: { type: Boolean, default: true },
    autoInject: { type: Boolean, default: true },
    injectOnPageLoad: { type: Boolean, default: true },
    clearExistingCookies: { type: Boolean, default: false },
    notes: String
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
toolSchema.index({ credentialVersion: 1 });

// Pre-save hook to extract domain and bump version
toolSchema.pre('save', function(next) {
  // Extract domain from targetUrl
  if (this.isModified('targetUrl') && this.targetUrl) {
    try {
      const url = new URL(this.targetUrl);
      this.domain = url.hostname;
    } catch (e) {
      // Keep existing domain if URL is invalid
    }
  }
  
  // Bump credential version when credentials change
  if (this.isModified('cookiesEncrypted') || 
      this.isModified('tokenEncrypted') || 
      this.isModified('localStorageEncrypted')) {
    this.credentialVersion = (this.credentialVersion || 0) + 1;
    this.credentialUpdatedAt = new Date();
  }
  
  next();
});

// Method to check if credentials are available
toolSchema.methods.hasCredentials = function() {
  return !!(this.cookiesEncrypted || this.tokenEncrypted || this.localStorageEncrypted);
};

// Static method to get all unique domains (for extension permissions)
toolSchema.statics.getUniqueDomains = async function() {
  const tools = await this.find({ status: 'active', domain: { $exists: true, $ne: null } })
    .select('domain')
    .lean();
  return [...new Set(tools.map(t => t.domain))];
};

module.exports = mongoose.model('Tool', toolSchema);
