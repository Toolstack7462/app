const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const cookieParser = require('cookie-parser');
const dotenv = require('dotenv');
const path = require('path');

// Load environment variables
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
const DB_NAME = process.env.DB_NAME || 'test_database';
const FULL_MONGO_URL = `${MONGO_URL}/${DB_NAME}`;

mongoose.connect(FULL_MONGO_URL)
.then(() => console.log(`✅ CRM MongoDB connected to ${DB_NAME}`))
.catch(err => console.error('❌ MongoDB connection error:', err));

// Import routes
const authRoutes = require('./routes/auth');
const publicRoutes = require('./routes/public');
const adminToolsRoutes = require('./routes/admin/tools');
const adminClientsRoutes = require('./routes/admin/clients');
const adminAssignmentsRoutes = require('./routes/admin/assignments');
const adminActivityRoutes = require('./routes/admin/activity');
const clientToolsRoutes = require('./routes/client/tools');
const clientAssignmentsRoutes = require('./routes/client/assignments');
const clientNotificationsRoutes = require('./routes/client/notifications');

// Mount routes - All CRM routes under /api/crm prefix
app.use('/api/crm/auth', authRoutes);
app.use('/api/crm/public', publicRoutes);
app.use('/api/crm/admin/tools', adminToolsRoutes);
app.use('/api/crm/admin/clients', adminClientsRoutes);
app.use('/api/crm/admin/assignments', adminAssignmentsRoutes);
app.use('/api/crm/admin/activity', adminActivityRoutes);
app.use('/api/crm/client/tools', clientToolsRoutes);
app.use('/api/crm/client/assignments', clientAssignmentsRoutes);
app.use('/api/crm/client/notifications', clientNotificationsRoutes);

// Health check
app.get('/api/crm/health', (req, res) => {
  res.json({ 
    status: 'ok', 
    service: 'ToolStack CRM',
    mongodb: mongoose.connection.readyState === 1 ? 'connected' : 'disconnected'
  });
});

// Error handling middleware
app.use((err, req, res, next) => {
  console.error('Error:', err);
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
  console.log(`🚀 ToolStack CRM API running on port ${PORT}`);
});

module.exports = app;
