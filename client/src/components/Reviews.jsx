import React, { useState } from 'react';
import './Reviews.css';

const API_URL = process.env.REACT_APP_API_URL || 'http://localhost:5000';

const Reviews = () => {
  const [url, setUrl] = useState('');
  const [reviews, setReviews] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [status, setStatus] = useState('');
  const [progress, setProgress] = useState(0);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError(null);
    setReviews([]);
    setStatus('Starting extraction...');
    setProgress(0);

    try {
      const encodedUrl = encodeURIComponent(url);
      const response = await fetch(`${API_URL}/api/reviews?page=${encodedUrl}`);
      const reader = response.body.getReader();
      const decoder = new TextDecoder();

      while (true) {
        const { value, done } = await reader.read();
        if (done) break;

        const chunk = decoder.decode(value);
        const lines = chunk.split('\n').filter(line => line.trim());

        for (const line of lines) {
          const data = JSON.parse(line);

          if (data.status === 'complete') {
            setReviews(data.reviews);
            setStatus('Extraction complete!');
            setProgress(100);
          } else if (data.status === 'error') {
            throw new Error(data.error);
          } else {
            setStatus(data.status);
            // Update progress based on status
            switch (data.status) {
              case 'Launching browser...':
                setProgress(20);
                break;
              case 'Navigating to page...':
                setProgress(40);
                break;
              case 'Analyzing page structure...':
                setProgress(60);
                break;
              case 'Extracting reviews...':
                setProgress(80);
                break;
              case 'Processing extracted data...':
                setProgress(90);
                break;
              default:
                break;
            }
          }
        }
      }
    } catch (err) {
      console.error('Error details:', err);
      setError(err.message || 'Failed to fetch reviews');
      setStatus('Extraction failed');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="reviews-container">
      <h1>Product Review Extractor</h1>
      
      <form onSubmit={handleSubmit} className="url-form">
        <input
          type="url"
          value={url}
          onChange={(e) => setUrl(e.target.value)}
          placeholder="Enter product page URL"
          required
          className="url-input"
        />
        <button type="submit" disabled={loading} className="submit-button">
          {loading ? 'Extracting...' : 'Extract Reviews'}
        </button>
      </form>

      {error && <div className="error-message">{error}</div>}

      {loading && (
        <div className="extraction-status">
          <div className="progress-bar">
            <div 
              className="progress-fill" 
              style={{ width: `${progress}%` }}
            />
          </div>
          <div className="status-text">
            <div className="spinner"></div>
            <p>{status}</p>
          </div>
        </div>
      )}

      {reviews.length > 0 && (
        <div className="reviews-list">
          <h2>Found {reviews.length} reviews</h2>
          {reviews.map((review, index) => (
            <div key={index} className="review-card">
              <div className="review-header">
                <span className="reviewer">{review.reviewer}</span>
                <span className="rating">Rating: {review.rating}/5</span>
              </div>
              <h3 className="review-title">{review.title}</h3>
              <p className="review-text">{review.body}</p>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

export default Reviews; 