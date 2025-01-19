const express = require('express');
const cors = require('cors');
const { GoogleGenerativeAI } = require('@google/generative-ai');
const puppeteer = require('puppeteer');
require('dotenv').config();

const app = express();
const port = process.env.PORT || 5000;

// Add CORS middleware
app.use(cors({
  origin: '*',  // For testing only - make more restrictive in production
  methods: ['GET', 'POST'],
  allowedHeaders: ['Content-Type']
}));

app.use(express.json());

// Initialize Gemini
const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);

// Add error handling middleware
app.use((err, req, res, next) => {
  console.error('Error:', err.stack);
  res.status(500).json({ error: 'Something went wrong!' });
});

// Add a test endpoint
app.get('/api/test', (req, res) => {
  res.json({ message: 'API is working!' });
});

// Changed to GET method with query parameter
app.get('/api/reviews', async (req, res) => {
    try {
        const url = req.query.page;
        
        if (!url) {
            return res.status(400).json({ error: 'URL parameter is required' });
        }

        res.writeHead(200, {
            'Content-Type': 'application/json',
            'Transfer-Encoding': 'chunked'
        });

        const sendUpdate = (status) => {
            res.write(JSON.stringify({ status }) + '\n');
        };

        sendUpdate('Launching browser...');
        const browser = await puppeteer.launch({
            headless: "new",
            args: ['--no-sandbox', '--disable-setuid-sandbox']
        });
        
        const page = await browser.newPage();
        
        try {
            sendUpdate('Navigating to page...');
            await page.goto(url, { 
                waitUntil: 'networkidle0',
                timeout: 30000 
            });

            // Wait for dynamic content
            await page.waitForTimeout(2000);

            sendUpdate('Analyzing page structure...');
            const pageStructure = await analyzePageStructure(page);
            
            sendUpdate('Identifying review elements...');
            const selectors = await identifySelectors(page, pageStructure);
            
            sendUpdate('Extracting reviews...');
            const reviews = await extractPageReviews(page, selectors);
            
            sendUpdate('Processing extracted data...');
            const response = {
                status: 'complete',
                reviews_count: reviews.length,
                reviews: reviews.map(review => ({
                    title: review.title || "Review",
                    body: review.text || review.content || review.description || "",
                    rating: parseRating(review.rating),
                    reviewer: review.author || review.reviewer || "Anonymous"
                }))
            };

            res.write(JSON.stringify(response));
            res.end();
        } finally {
            await browser.close();
        }
    } catch (error) {
        console.error('Error:', error);
        res.write(JSON.stringify({ status: 'error', error: error.message }));
        res.end();
    }
});

async function analyzePageStructure(page) {
    return await page.evaluate(() => {
        const structure = {
            hasReviewContainer: false,
            possibleReviewContainers: [],
            ratingTypes: [],
            reviewTextTypes: []
        };

        // Find possible review containers
        const elements = document.querySelectorAll('*');
        elements.forEach(el => {
            const text = el.textContent.toLowerCase();
            if (
                (text.includes('review') || text.includes('rating')) &&
                el.children.length > 0 &&
                !el.matches('script, style, meta')
            ) {
                structure.possibleReviewContainers.push({
                    tag: el.tagName.toLowerCase(),
                    classes: Array.from(el.classList),
                    id: el.id,
                    childCount: el.children.length
                });
            }

            // Identify rating patterns
            if (
                text.match(/[0-5](\s)?\/(\s)?5/) ||
                text.match(/★+/) ||
                text.match(/\d(\s)?stars?/i)
            ) {
                structure.ratingTypes.push({
                    element: el.tagName.toLowerCase(),
                    pattern: text.trim()
                });
            }
        });

        return structure;
    });
}

async function identifySelectors(page, pageStructure) {
    const model = genAI.getGenerativeModel({ model: "gemini-pro" });
    
    const prompt = `
        Analyze this page structure and identify the most likely CSS selectors for reviews.
        Page Structure: ${JSON.stringify(pageStructure)}
        
        Consider these common patterns:
        1. Review containers often have class names containing: review, comment, feedback
        2. Ratings might be stars (★), numbers (4/5), or text (4 out of 5)
        3. Review text might be in <p>, <div>, or <span> elements
        4. Author names often appear near reviews in <span>, <strong>, or dedicated classes
        
        Return a JSON object with these selectors:
        {
            "reviewContainer": "main selector for review container",
            "reviewTitle": "selector for review title",
            "reviewText": "selector for review content",
            "rating": "selector for rating",
            "reviewerName": "selector for reviewer name"
        }
    `;

    const result = await model.generateContent(prompt);
    const response = await result.response;
    return JSON.parse(response.text());
}

async function extractPageReviews(page, selectors) {
    return await page.evaluate((sel) => {
        const reviews = [];
        const reviewElements = document.querySelectorAll(sel.reviewContainer);

        reviewElements.forEach(element => {
            // Try multiple possible text content locations
            const textContent = 
                element.querySelector(sel.reviewText)?.textContent?.trim() ||
                element.querySelector('p')?.textContent?.trim() ||
                Array.from(element.querySelectorAll('p'))
                    .map(p => p.textContent.trim())
                    .join(' ');

            // Try multiple rating formats
            const ratingElement = element.querySelector(sel.rating);
            const ratingText = ratingElement?.textContent?.trim();
            const rating = 
                ratingText?.match(/(\d+(\.\d+)?)\s*\/\s*5/)?.[1] ||
                (ratingText?.match(/★/g) || []).length ||
                ratingText?.match(/\d+/)?.[0] ||
                '5';

            reviews.push({
                title: element.querySelector(sel.reviewTitle)?.textContent?.trim(),
                text: textContent,
                rating: rating,
                author: element.querySelector(sel.reviewerName)?.textContent?.trim()
            });
        });

        return reviews.filter(review => review.text && review.text.length > 0);
    }, selectors);
}

function parseRating(ratingStr) {
    if (!ratingStr) return 5;
    
    // Handle star symbols
    if (ratingStr.includes('★')) {
        return (ratingStr.match(/★/g) || []).length;
    }
    
    // Handle fractional ratings
    const fractionMatch = ratingStr.match(/(\d+(\.\d+)?)\s*\/\s*5/);
    if (fractionMatch) {
        return Math.round(parseFloat(fractionMatch[1]));
    }
    
    // Handle numeric ratings
    const numericRating = parseInt(ratingStr);
    if (!isNaN(numericRating)) {
        return numericRating > 5 ? 5 : numericRating;
    }
    
    return 5;
}

// Add this at the top of your server.js
process.on('unhandledRejection', (reason, promise) => {
    console.error('Unhandled Rejection at:', promise, 'reason:', reason);
});

// Add this after your dotenv config
console.log('Environment Check:', {
    port: process.env.PORT,
    hasGeminiKey: !!process.env.GEMINI_API_KEY
});

app.listen(port, () => {
  console.log(`Server running on port ${port}`);
}); 