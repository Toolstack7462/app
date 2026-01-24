const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const cookieParser = require('cookie-parser');
const dotenv = require('dotenv');
const path = require('path');

// Load environment variables FIRST
dotenv.config({ path: path.join(__dirname, '.env') });

const app = express();

// ============================================================================
// DYNAMIC CORS CONFIGURATION - SUPPORTS URL CHANGES
// ============================================================================
const corsOptions = {
  origin: function (origin, callback) {
    // Allow requests with no origin (mobile apps, curl, postman)
    if (!origin) return callback(null, true);
    
    // List of allowed origins/patterns
    const allowedPatterns = [
      /^https:\/\/.*\.preview\.emergentagent\.com$/,  // All preview subdomains
      /^https:\/\/.*\.emergentagent\.com$/,           // All emergentagent subdomains
      /^http:\/\/localhost:\d+$/,                      // Local development
      /^http:\/\/127\.0\.0\.1:\d+$/                    // Local development
    ];
    
    // Check if origin matches any pattern
    const isAllowed = allowedPatterns.some(pattern => pattern.test(origin));
    
    if (isAllowed) {
      console.log(`✅ CORS: Allowed origin: ${origin}`);
      callback(null, true);
    } else {
      console.warn(`⚠️  CORS: Blocked origin: ${origin}`);
      callback(new Error('Not allowed by CORS'));
    }
  },
  credentials: true
};

app.use(cors(corsOptions));
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));
app.use(cookieParser());

// ============================================================================
// PERSISTENT DATABASE CONNECTION WITH DETAILED LOGGING
// ============================================================================
const MONGO_URL = process.env.MONGO_URL || 'mongodb://localhost:27017';
const DB_NAME = process.env.DB_NAME || 'toolstack_crm';
const FULL_MONGO_URL = `${MONGO_URL}/${DB_NAME}`;

console.log('\n' + '='.repeat(70));
console.log('🔌 MONGODB CONNECTION DETAILS');
console.log('='.repeat(70));
console.log(`Host: ${MONGO_URL}`);
console.log(`Database: ${DB_NAME}`);
console.log(`Full URL: ${FULL_MONGO_URL}`);
console.log('='.repeat(70) + '\n');

mongoose.connect(FULL_MONGO_URL, {
  serverSelectionTimeoutMS: 5000,
  socketTimeoutMS: 45000,
})
.then(async () => {
  console.log(`✅ MongoDB connected successfully!`);
  console.log(`   - Host: ${mongoose.connection.host}`);
  console.log(`   - Database: ${mongoose.connection.db.databaseName}`);
  console.log(`   - Connection State: ${mongoose.connection.readyState === 1 ? 'Connected' : 'Not Connected'}`);
  
  // Bootstrap admin on first startup
  await bootstrapAdmin();
})
.catch(err => {
  console.error('❌ MongoDB connection FAILED:', err.message);
  console.error('   Please check your MONGO_URL and DB_NAME in .env file');
  process.exit(1);
});

// ============================================================================
// ADMIN BOOTSTRAP - AUTO-CREATE ADMIN IF NONE EXISTS
// ============================================================================
async function bootstrapAdmin() {
  try {
    const User = require('./models/User');
    
    // Check if any admin exists
    const adminCount = await User.countDocuments({ 
      role: { $in: ['SUPER_ADMIN', 'ADMIN'] } 
    });
    
    if (adminCount === 0) {
      console.log('\n⚠️  No admin accounts found in database!');
      console.log('📝 Creating default admin account...\n');
      
      const adminEmail = process.env.INITIAL_ADMIN_EMAIL || 'admin@toolstack.com';
      const adminPassword = process.env.INITIAL_ADMIN_PASSWORD || 'Admin123!Secure';
      const adminName = process.env.INITIAL_ADMIN_NAME || 'Super Admin';
      
      const admin = await User.create({
        email: adminEmail.toLowerCase().trim(),
        fullName: adminName,
        passwordHash: adminPassword,
        role: 'SUPER_ADMIN',
        status: 'active',
        devicePolicy: {
          enabled: false,
          maxDevices: 10
        }
      });
      
      console.log('✅ Default admin created successfully!');
      console.log(`   - Email: ${admin.email}`);
      console.log(`   - Name: ${admin.fullName}`);
      console.log(`   - Role: ${admin.role}`);
      console.log(`   - ID: ${admin._id}`);
      console.log(`   - Password: ${adminPassword}\n`);
      console.log('⚠️  IMPORTANT: Change the default password after first login!\n');
    } else {
      console.log(`✅ Admin accounts verified: ${adminCount} admin(s) exist in database\n`);
    }
    
    // Also check for client test account
    const clientCount = await User.countDocuments({ role: 'CLIENT' });
    console.log(`📊 Database Status: ${adminCount} admin(s), ${clientCount} client(s)\n`);
    
  } catch (error) {
    console.error('❌ Bootstrap error:', error.message);
    // Don't exit - let server continue even if bootstrap fails
  }
}

// Import enhanced routes
const authRoutes = require('./routes/authEnhanced');
const publicRoutes = require('./routes/public');

// Admin routes - Enhanced with security
const adminToolsRoutes = require('./routes/admin/toolsEnhanced');
const adminClientsRoutes = require('./routes/admin/clientsEnhanced');
const adminAssignmentsRoutes = require('./routes/admin/assignments');
const adminActivityRoutes = require('./routes/admin/activity');
const adminBlogRoutes = require('./routes/admin/blog');
const adminContactsRoutes = require('./routes/admin/contacts');

// Client routes
const clientToolsRoutes = require('./routes/client/tools');
const clientAssignmentsRoutes = require('./routes/client/assignmentsEnhanced');
const clientNotificationsRoutes = require('./routes/client/notifications');
const clientProfileRoutes = require('./routes/client/profile');

// Mount routes - All CRM routes under /api/crm prefix
app.use('/api/crm/auth', authRoutes);
app.use('/api/crm/public', publicRoutes);

// Admin routes
app.use('/api/crm/admin/tools', adminToolsRoutes);
app.use('/api/crm/admin/clients', adminClientsRoutes);
app.use('/api/crm/admin/assignments', adminAssignmentsRoutes);
app.use('/api/crm/admin/activity', adminActivityRoutes);
app.use('/api/crm/admin/blog', adminBlogRoutes);
app.use('/api/crm/admin/contacts', adminContactsRoutes);

// Client routes
app.use('/api/crm/client/tools', clientToolsRoutes);
app.use('/api/crm/client/assignments', clientAssignmentsRoutes);
app.use('/api/crm/client/notifications', clientNotificationsRoutes);
app.use('/api/crm/client', clientProfileRoutes);

// Health check
app.get('/api/crm/health', (req, res) => {
  const dbState = mongoose.connection.readyState;
  const dbStateMap = {
    0: 'disconnected',
    1: 'connected',
    2: 'connecting',
    3: 'disconnecting'
  };
  
  res.json({ 
    status: 'ok', 
    service: 'ToolStack CRM',
    version: '2.0.0',
    mongodb: {
      state: dbStateMap[dbState] || 'unknown',
      host: mongoose.connection.host || 'N/A',
      database: mongoose.connection.db ? mongoose.connection.db.databaseName : 'N/A'
    },
    environment: process.env.NODE_ENV || 'development',
    timestamp: new Date().toISOString()
  });
});

// Error handling middleware
app.use((err, req, res, next) => {
  console.error('Error:', err);
  
  // Joi validation error
  if (err.name === 'ValidationError') {
    return res.status(400).json({
      error: 'Validation failed',
      details: err.details
    });
  }
  
  // Mongoose validation error
  if (err.name === 'MongoError' || err.name === 'MongooseError') {
    return res.status(500).json({
      error: 'Database error'
    });
  }
  
  res.status(err.status || 500).json({
    error: err.message || 'Internal server error'
  });
});

// 404 handler
app.use((req, res) => {
  res.status(404).json({ error: 'Route not found' });
});

const PORT = process.env.CRM_PORT || 8002;

app.listen(PORT, '0.0.0.0', () => {
  console.log(`\n${'='.repeat(60)}`);
  console.log('🚀 ToolStack CRM API Server');
  console.log(`${'='.repeat(60)}`);
  console.log(`📡 Running on: http://localhost:${PORT}`);
  console.log(`📊 Environment: ${process.env.NODE_ENV || 'development'}`);
  console.log(`🗄️  Database: ${DB_NAME}`);
  console.log(`${'='.repeat(60)}\n`);
});

// Graceful shutdown
process.on('SIGINT', async () => {
  console.log('\n⚠️  Shutting down gracefully...');
  await mongoose.connection.close();
  process.exit(0);
});

module.exports = app;
