const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const morgan = require('morgan');
const config = require('./config');
const wrappedRoutes = require('./routes/wrapped.routes');
const { errorHandler, notFoundHandler } = require('./utils/error.handler');

const app = express();

// Middleware
app.use(helmet()); // Security headers
app.use(cors(config.cors)); // CORS
app.use(express.json()); // Parse JSON bodies
app.use(express.urlencoded({ extended: true })); // Parse URL-encoded bodies
app.use(morgan('dev')); // Logging

// Routes
app.use('/api', wrappedRoutes);

// Error handlers (must be last)
app.use(notFoundHandler);
app.use(errorHandler);

module.exports = app;