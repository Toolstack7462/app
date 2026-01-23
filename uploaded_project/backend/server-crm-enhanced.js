const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const cookieParser = require('cookie-parser');
const dotenv = require('dotenv');
const path = require('path');

// Load environment variables FIRST
dotenv.config({ path: path.join(__dirname, '.env') });

const app = express();

// Middleware
app.use(cors({
  origin: process.env.FRONTEND_URL || 'http://localhost:3000',
  credentials: true
}));
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));
app.use(cookieParser());

// MongoDB connection
const MONGO_URL = process.env.MONGO_URL || 'mongodb://localhost:27017';
const DB_NAME = process.env.DB_NAME || 'toolstack_crm';
const FULL_MONGO_URL = `${MONGO_URL}/${DB_NAME}`;

mongoose.connect(FULL_MONGO_URL)
.then(() => console.log(`✅ CRM MongoDB connected to ${DB_NAME}`))
.catch(err => {
  console.error('❌ MongoDB connection error:', err);
  process.exit(1);
});

// Import enhanced routes
const authRoutes = require('./routes/authEnhanced');
const publicRoutes = require('./routes/public');

// Admin routes - Enhanced with security
const adminToolsRoutes = require('./routes/admin/toolsEnhanced');
const adminClientsRoutes = require('./routes/admin/clientsEnhanced');
const adminAssignmentsRoutes = require('./routes/admin/assignments');
const adminActivityRoutes = require('./routes/admin/activity');

// Client routes
const clientToolsRoutes = require('./routes/client/tools');
const clientAssignmentsRoutes = require('./routes/client/assignments');
const clientNotificationsRoutes = require('./routes/client/notifications');

// Apply rate limiting to API
const { apiLimiter } = require('./middleware/rateLimiter');
app.use('/api/crm', apiLimiter);

// Mount routes - All CRM routes under /api/crm prefix
app.use('/api/crm/auth', authRoutes);
app.use('/api/crm/public', publicRoutes);

// Admin routes
app.use('/api/crm/admin/tools', adminToolsRoutes);
app.use('/api/crm/admin/clients', adminClientsRoutes);
app.use('/api/crm/admin/assignments', adminAssignmentsRoutes);
app.use('/api/crm/admin/activity', adminActivityRoutes);

// Client routes
app.use('/api/crm/client/tools', clientToolsRoutes);
app.use('/api/crm/client/assignments', clientAssignmentsRoutes);
app.use('/api/crm/client/notifications', clientNotificationsRoutes);

// Health check
app.get('/api/crm/health', (req, res) => {
  res.json({ 
    status: 'ok', 
    service: 'ToolStack CRM',
    version: '2.0.0',
    mongodb: mongoose.connection.readyState === 1 ? 'connected' : 'disconnected',
    environment: process.env.NODE_ENV || 'development'
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
