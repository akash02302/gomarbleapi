const { logger } = require('../utils/logger');

function errorHandler(err, req, res, next) {
    logger.error('Global error handler:', err);

    // Handle specific error types
    if (err.message.includes('Navigation timeout')) {
        return res.status(504).json({
            error: 'Gateway Timeout',
            message: 'The page took too long to load. Please try again later.',
            details: process.env.NODE_ENV === 'development' ? err.message : undefined
        });
    }

    if (err.message.includes('net::ERR_CONNECTION_REFUSED')) {
        return res.status(503).json({
            error: 'Service Unavailable',
            message: 'Could not connect to the target website. Please try again later.',
            details: process.env.NODE_ENV === 'development' ? err.message : undefined
        });
    }

    // Default error response
    res.status(err.status || 500).json({
        error: 'Internal Server Error',
        message: err.message || 'An unexpected error occurred',
        ...(process.env.NODE_ENV === 'development' && { stack: err.stack })
    });
}

module.exports = { errorHandler }; 