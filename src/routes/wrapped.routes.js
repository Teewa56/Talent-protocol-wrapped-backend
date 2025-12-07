const express = require('express');
const router = express.Router();
const wrappedController = require('../controllers/wrapped.controller');
const { apiLimiter, scraperLimiter } = require('../middleware/ratelimiter.middleware');

// Health check route
router.get('/health', wrappedController.healthCheck);

// Get wrapped data for a user (applies both rate limiters)
router.get('/wrapped/:baseName', apiLimiter, scraperLimiter, wrappedController.getWrappedData);

module.exports = router;