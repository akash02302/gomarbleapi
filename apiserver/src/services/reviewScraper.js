const puppeteer = require('puppeteer');
const { GoogleGenerativeAI } = require('@google/generative-ai');
const { logger } = require('../utils/logger');

class ReviewScraperService {
    constructor() {
        this.genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
        this.model = this.genAI.getGenerativeModel({ model: "gemini-pro" });
        
        // Common review platforms and their selectors
        this.platformSelectors = {
            yotpo: {
                reviewContainer: '.yotpo-review',
                reviewTitle: '.yotpo-review-title',
                reviewText: '.content-review',
                rating: '.yotpo-stars',
                author: '.yotpo-user-name'
            },
            shopify: {
                reviewContainer: '.spr-review',
                reviewTitle: '.spr-review-header-title',
                reviewText: '.spr-review-content-body',
                rating: '.spr-starrating',
                author: '.spr-review-header-byline'
            },
            judgeme: {
                reviewContainer: '.jdgm-rev',
                reviewTitle: '.jdgm-rev__title',
                reviewText: '.jdgm-rev__body',
                rating: '.jdgm-rev__rating',
                author: '.jdgm-rev__author'
            },
            // Generic selectors as fallback
            generic: {
                reviewContainer: [
                    '.review',
                    '[data-review]',
                    '.review-item',
                    '.product-review',
                    '.customer-review'
                ],
                reviewTitle: [
                    '.review-title',
                    '.review-heading',
                    'h3',
                    '.title'
                ],
                reviewText: [
                    '.review-content',
                    '.review-text',
                    '.review-body',
                    'p'
                ],
                rating: [
                    '.rating',
                    '.stars',
                    '[data-rating]',
                    '.star-rating'
                ],
                author: [
                    '.reviewer',
                    '.author',
                    '.customer-name',
                    '.review-author'
                ]
            }
        };
    }

    async delay(ms) {
        return new Promise(resolve => setTimeout(resolve, ms));
    }

    async scrapeReviews(url, maxPages = 3) {
        let browser = null;
        let page = null;

        try {
            browser = await puppeteer.launch({
                headless: true,
                args: [
                    '--no-sandbox',
                    '--disable-setuid-sandbox',
                    '--disable-web-security',
                    '--disable-features=IsolateOrigins',
                    '--disable-site-isolation-trials',
                    '--disable-dev-shm-usage',
                    '--no-zygote',
                    '--single-process',
                    '--window-size=1920,1080'
                ],
                timeout: 60000
            });

            page = await browser.newPage();
            
            // Set longer timeouts
            await page.setDefaultNavigationTimeout(60000);
            await page.setDefaultTimeout(60000);

            // Block unnecessary resources
            await page.setRequestInterception(true);
            page.on('request', (req) => {
                const resourceType = req.resourceType();
                if (['image', 'stylesheet', 'font', 'media'].includes(resourceType)) {
                    req.abort();
                } else {
                    req.continue();
                }
            });

            // Set modern user agent
            await page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) Chrome/120.0.0.0 Safari/537.36');

            // Navigate with multiple strategies
            let loaded = false;
            const navigationStrategies = [
                { waitUntil: 'domcontentloaded', timeout: 30000 },
                { waitUntil: 'load', timeout: 45000 },
                { waitUntil: 'networkidle0', timeout: 60000 }
            ];

            for (const strategy of navigationStrategies) {
                if (loaded) break;
                try {
                    logger.info(`Trying navigation with strategy: ${strategy.waitUntil}`);
                    await page.goto(url, strategy);
                    loaded = true;
                } catch (e) {
                    logger.warn(`Navigation failed with ${strategy.waitUntil}:`, e.message);
                    await this.delay(2000);
                }
            }

            if (!loaded) {
                throw new Error('Failed to load page with all strategies');
            }

            // Wait and scroll for dynamic content
            await this.delay(3000);
            await this.scrollPage(page);

            // Find reviews using all available selectors
            const reviews = [];
            for (const [platform, selectors] of Object.entries(this.platformSelectors)) {
                const platformReviews = await this.extractReviewsWithSelectors(page, selectors, platform);
                if (platformReviews.length > 0) {
                    logger.info(`Found ${platformReviews.length} reviews using ${platform} selectors`);
                    reviews.push(...platformReviews);
                    break;
                }
            }

            // If no reviews found, try generic selectors with broader search
            if (reviews.length === 0) {
                logger.info('Trying generic selectors with broader search');
                const genericReviews = await this.extractGenericReviews(page);
                reviews.push(...genericReviews);
            }

            logger.info(`Total reviews found: ${reviews.length}`);
            return reviews;

        } catch (error) {
            logger.error('Error scraping reviews:', error);
            if (page) {
                await page.screenshot({ path: 'error-screenshot.png', fullPage: true });
            }
            throw error;
        } finally {
            if (browser) await browser.close();
        }
    }

    async scrollPage(page) {
        await page.evaluate(async () => {
            await new Promise((resolve) => {
                let totalHeight = 0;
                const distance = 100;
                const timer = setInterval(() => {
                    window.scrollBy(0, distance);
                    totalHeight += distance;
                    if (totalHeight >= document.body.scrollHeight) {
                        clearInterval(timer);
                        resolve();
                    }
                }, 100);
            });
        });
        await this.delay(2000);
    }

    async extractReviewsWithSelectors(page, selectors, platform) {
        return await page.evaluate((selectors) => {
            const getElements = (selector) => {
                if (Array.isArray(selector)) {
                    for (const s of selector) {
                        const elements = document.querySelectorAll(s);
                        if (elements.length > 0) return elements;
                    }
                    return [];
                }
                return document.querySelectorAll(selector);
            };

            const reviews = getElements(selectors.reviewContainer);
            return Array.from(reviews).map(review => {
                const getRating = (el) => {
                    const ratingEl = el.querySelector(selectors.rating);
                    if (!ratingEl) return 5;
                    
                    const score = ratingEl.getAttribute('data-rating') || 
                                ratingEl.getAttribute('data-score') || 
                                ratingEl.textContent;
                    
                    if (!score) return 5;
                    const num = parseInt(score.match(/\d+/)?.[0] || '0');
                    return Math.min(Math.max(Math.round(num / 2), 0), 5);
                };

                return {
                    title: review.querySelector(selectors.reviewTitle)?.textContent?.trim() || 'Product Review',
                    body: review.querySelector(selectors.reviewText)?.textContent?.trim() || '',
                    rating: getRating(review),
                    reviewer: review.querySelector(selectors.author)?.textContent?.trim() || 'Anonymous'
                };
            }).filter(r => r.body.length > 0);
        }, selectors);
    }

    async extractGenericReviews(page) {
        return await page.evaluate(() => {
            // Find any elements that might contain reviews
            const possibleReviews = document.querySelectorAll('*');
            const reviews = [];

            for (const element of possibleReviews) {
                const text = element.textContent.toLowerCase();
                if (text.includes('review') || text.includes('rating')) {
                    const reviewText = element.textContent.trim();
                    if (reviewText.length > 20) { // Minimum length for a review
                        reviews.push({
                            title: 'Product Review',
                            body: reviewText,
                            rating: 5,
                            reviewer: 'Anonymous'
                        });
                    }
                }
            }

            return reviews;
        });
    }
}

module.exports = new ReviewScraperService(); 