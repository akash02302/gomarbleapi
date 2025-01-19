const reviewController = require('../controllers/reviewController');

function setupRoutes(app) {
    // Health check endpoint
    app.get('/health', (req, res) => {
        res.json({ 
            status: 'ok',
            timestamp: new Date().toISOString(),
            endpoints: {
                health: '/health',
                reviews: '/api/reviews?page=<url>'
            }
        });
    });

    // Reviews endpoint
    app.get('/api/reviews', reviewController.getReviews);
}

module.exports = { setupRoutes }; 