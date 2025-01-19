Project Title: Review Scraper API

## Table of Contents
- [Solution Approach](#solution-approach)
- [System Architecture](#system-architecture)
- [Instructions to Run the Project](#instructions-to-run-the-project)
- [API Usage Examples](#api-usage-examples)
- [Sample Responses](#sample-responses)

## Solution Approach

The Review Scraper API is designed to fetch product reviews from various e-commerce websites. The solution involves the following key components:

1. **Web Scraping**: The API utilizes web scraping techniques to extract reviews from specified product URLs. Libraries such as `axios` for HTTP requests and `cheerio` for parsing HTML are employed.

2. **Express Framework**: The API is built using the Express framework, which allows for easy routing and middleware integration.

3. **Data Handling**: The scraped data is structured into a JSON format, making it easy to consume by clients.

4. **Error Handling**: The API includes robust error handling to manage invalid URLs, missing parameters, and server errors.

## System Architecture

Architecture Diagram-> ./SystemDiagram/architecture_diagram.png
Workflow Diagram-> ./SystemDiagram/workflow_diagram.png

### Workflow
1. The client sends a GET request to the `/reviews` endpoint with a product URL as a query parameter.
2. The server processes the request, scrapes the specified URL, and extracts the reviews.
3. The server responds with the reviews in JSON format or an error message if applicable.

## Instructions to Run the Project

To run the Review Scraper API locally, follow these steps:

1. **Clone the Repository**:
   git clone https://github.com/akash02302/reviewScrapperApi.git
   cd reviewScrapperApi

2. **Install Dependencies**:
   Make sure you have Node.js installed. Then, run:
   npm install

3. **Start the Server**:
   node server.js
   The server will start on "http://localhost:3000".

4. **Access the API**:
   You can now access the API at "http://localhost:3000/reviews?page=<url>".

## API Usage Examples

### Fetch Reviews

To fetch reviews for a product, send a GET request to the `/reviews` endpoint with the product URL as a query parameter.

**Request**(Using window + R -> cmd):
curl "http://localhost:3000/reviews?page=https://example.com/product"

## Sample Responses

### Successful Response
If the request is successful, you will receive a response similar to the following:

json
{
"reviews_count": 5,
"reviews": [
{
"title": "Great Product!",
"body": "I really enjoyed using this product.",
"rating": 5,
"reviewer": "John Doe"
},
{
"title": "Not what I expected",
"body": "The product did not meet my expectations.",
"rating": 2,
"reviewer": "Jane Smith"
}
]
}

### Error Response: Missing URL
If the `page` parameter is missing, the response will be:

json
{
"error": "Missing required parameter: page",
"message": "Please provide a valid product URL"
}

### Error Response: Invalid URL
If the provided URL is invalid, the response will be:

json
{
"error": "Invalid URL format",
"message": "Please provide a valid URL"
}

### Error Response: Server Error
If there is an error during the scraping process, the response will be:

json
{
"error": "Failed to fetch reviews",
"message": "Error details here"
}

## Conclusion

This README provides a comprehensive overview of the Review Scraper API, including its architecture, usage, and examples. For further questions or contributions, please refer to the project's GitHub repository or contact the project maintainer.