const express = require('express');
const cors = require('cors');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../.env') });

const authRoutes   = require('./routes/auth');
const userRoutes   = require('./routes/user');
const resumeRoutes = require('./routes/resume');
const chatRoutes   = require('./routes/chat');
const interviewRoutes = require('./routes/interview');
const initDB       = require('./initDB');

const app = express();
const PORT = process.env.PORT || 5000;

// Middleware
app.use(cors({ origin: '*' }));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Serve static frontend files
app.use(express.static(path.join(__dirname, '../client')));

// Serve uploaded files
app.use('/uploads', express.static(path.join(__dirname, '../uploads')));

// API Routes
app.use('/api/auth',   authRoutes);
app.use('/api/user',   userRoutes);
app.use('/api/resume', resumeRoutes);
app.use('/api/chat',   chatRoutes);
app.use('/api/interview', interviewRoutes);

// Fallback: serve index.html for any non-API path not already matched
app.use((req, res, next) => {
  if (!req.path.startsWith('/api')) {
    return res.sendFile(path.join(__dirname, '../client/index.html'));
  }
  next();
});

app.listen(PORT, async () => {
  await initDB();
  console.log(`\n🚀 AI Mock Interview Platform running at: http://localhost:${PORT}\n`);
});
