const rateLimit = require('express-rate-limit');

// Rate limiter for API endpoints
const apiLimiter = rateLimit({
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: 100, // Limit each IP to 100 requests per windowMs
    message: 'Too many requests from this IP, please try again later.',
    standardHeaders: true,
    legacyHeaders: false,
});

// Stricter rate limiter for scraping operations (more resource-intensive)
const scraperLimiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    max: 30, // Lower limit for scraping
    message: 'Too many scraping requests, please try again later.',
    standardHeaders: true,
    legacyHeaders: false,
});

module.exports = { apiLimiter, scraperLimiter };