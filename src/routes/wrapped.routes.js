const express = require('express');
const router = express.Router();
const wrappedController = require('../controllers/wrapped.controller');
const { apiLimiter } = require('../middleware/ratelimiter.middleware');

// Health check route
router.get('/health', wrappedController.healthCheck);

// Get wrapped data for a user (only API limiter needed now)
router.get('/wrapped/:baseName', apiLimiter, wrappedController.getWrappedData);

module.exports = router;