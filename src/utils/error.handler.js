const errorHandler = (err, req, res, next) => {
    console.error('Error:', err);

    const statusCode = err.statusCode || 500;
    const message = err.message || 'Internal Server Error';

    res.status(statusCode).json({
        success: false,
        error: {
        message,
        ...(process.env.NODE_ENV === 'development' && { stack: err.stack })
        }
    });
};

// Not found handler
const notFoundHandler = (req, res, next) => {
    res.status(404).json({
        success: false,
        error: {
        message: 'Route not found'
        }
    });
};

module.exports = { errorHandler, notFoundHandler };