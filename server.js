const express = require('express');
const cors = require('cors');
const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();

// Import routes and middleware
const auditRoutes = require('./src/routes/auditRoutes');
const leadRoutes = require('./src/routes/leadRoutes');
const errorHandler = require('./src/middleware/errorHandler');
const apiLimiter = require('./src/middleware/rateLimiter').apiLimiter;

const app = express();
const port = process.env.PORT || 5000;

// Standard Middleware
app.use(cors());
app.use(express.json());

// Apply Rate Limiting to API routes
app.use('/api/', apiLimiter);

const ws = require('ws');

// Initialize Supabase Client (Optional)
const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_ANON_KEY;
const supabase = (supabaseUrl && supabaseKey) ? createClient(supabaseUrl, supabaseKey, {
  auth: {
    persistSession: false
  },
  realtime: {
    transport: ws
  }
}) : null;

// Attach Supabase to request if needed in controllers
app.use((req, res, next) => {
  req.supabase = supabase;
  next();
});


// Routes
app.use('/api/audit', auditRoutes);
app.use('/api/leads', leadRoutes);

// Test Route
app.get('/', (req, res) => {
  res.send('SaaS Audit Backend API is running...');
});

// Error Handling Middleware (must be last)
app.use(errorHandler);

app.listen(port, () => {
  console.log(`Backend server running on http://localhost:${port}`);
});

