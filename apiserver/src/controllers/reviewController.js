const reviewScraperService = require('../services/reviewScraper');
const { logger } = require('../utils/logger');

class ReviewController {
    async getReviews(req, res) {
        try {
            const { page: url } = req.query;

            if (!url) {
                return res.status(400).json({
                    error: 'Missing URL',
                    message: 'Please provide a product URL using the page parameter'
                });
            }

            try {
                new URL(url);
            } catch (e) {
                return res.status(400).json({
                    error: 'Invalid URL',
                    message: 'Please provide a valid URL'
                });
            }

            const scrapedReviews = await reviewScraperService.scrapeReviews(url);

            // Format reviews to match the exact specification
            const formattedReviews = scrapedReviews.map(review => ({
                title: review.title || "Review Title",
                body: review.body || "Review body text",
                rating: typeof review.rating === 'number' ? review.rating : 5,
                reviewer: review.reviewer || "Reviewer Name"
            }));

            // Return response in the exact format specified
            return res.json({
                reviews_count: formattedReviews.length,
                reviews: formattedReviews
            });

        } catch (error) {
            logger.error('Review scraping failed:', error);
            return res.status(500).json({
                error: 'Failed to fetch reviews',
                message: 'Unable to scrape reviews from the provided URL'
            });
        }
    }
}

module.exports = new ReviewController(); 