const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');

const userSchema = new mongoose.Schema({
  role: {
    type: String,
    enum: ['SUPER_ADMIN', 'ADMIN', 'SUPPORT', 'CLIENT'],
    required: true
  },
  fullName: {
    type: String,
    required: true
  },
  email: {
    type: String,
    required: true,
    unique: true,
    lowercase: true,
    trim: true
  },
  passwordHash: {
    type: String,
    required: true
  },
  status: {
    type: String,
    enum: ['active', 'disabled'],
    default: 'active'
  },
  tokenVersion: {
    type: Number,
    default: 0
  },
  devicePolicy: {
    enabled: {
      type: Boolean,
      default: true
    },
    maxDevices: {
      type: Number,
      default: 1
    }
  },
  expirySettings: {
    warningDays: {
      type: Number,
      default: 3
    }
  },
  notes: String,
  lastLoginAt: Date,
  lastLoginIp: String
}, {
  timestamps: true
});

// Hash password before saving
userSchema.pre('save', async function() {
  if (!this.isModified('passwordHash')) return;
  
  const salt = await bcrypt.genSalt(10);
  this.passwordHash = await bcrypt.hash(this.passwordHash, salt);
});

// Method to compare password
userSchema.methods.comparePassword = async function(candidatePassword) {
  return bcrypt.compare(candidatePassword, this.passwordHash);
};

// Method to increment token version (force logout)
userSchema.methods.forceLogout = async function() {
  this.tokenVersion += 1;
  await this.save();
  return this.tokenVersion;
};

// Check if user has admin privileges
userSchema.methods.isAdmin = function() {
  return ['SUPER_ADMIN', 'ADMIN'].includes(this.role);
};

// Remove password from JSON response
userSchema.methods.toJSON = function() {
  const obj = this.toObject();
  delete obj.passwordHash;
  delete obj.tokenVersion;
  return obj;
};

module.exports = mongoose.model('User', userSchema);
