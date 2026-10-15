import React from 'react';
import { Quote, Star } from 'lucide-react';
import { useReviews } from '../context/ReviewContext';
import './ReviewsSection.css';

const Stars = ({ rating }) => (
    <span className="testimonial-stars" aria-label={`${rating} out of 5 stars`}>
        {[1, 2, 3, 4, 5].map((value) => (
            <Star key={value} size={16} fill={value <= rating ? 'currentColor' : 'none'} />
        ))}
    </span>
);

const ReviewsSection = ({ featured = false, productId = '', title = 'What our customers say' }) => {
    const { reviews, loading } = useReviews();
    const visibleReviews = reviews
        .filter((review) => (productId ? review.productId === productId : (featured ? review.featured : true)))
        .slice(0, featured ? 8 : 12);

    if (!loading && !visibleReviews.length) return null;

    return (
        <section id="customer-reviews" className="testimonials-section" aria-labelledby="testimonials-title">
            <div className="container">
                <div className="testimonials-heading">
                    <p>REAL CUSTOMER STORIES</p>
                    <h2 id="testimonials-title">{title}</h2>
                    <span>Testimonials shared directly with A.S. Trends &amp; Gifts.</span>
                </div>
                {loading ? <div className="testimonials-loading">Loading customer reviews…</div> : (
                    <div className="testimonials-grid">
                        {visibleReviews.map((review) => (
                            <article className={`testimonial-card ${review.image ? 'with-image' : ''}`} key={review.id}>
                                {review.image && <img src={review.image} alt={`Review shared by ${review.reviewerName}`} loading="lazy" />}
                                <div className="testimonial-copy">
                                    <Quote className="testimonial-quote" size={28} />
                                    <Stars rating={Number(review.rating) || 5} />
                                    {review.title && <h3>{review.title}</h3>}
                                    <p>“{review.comment}”</p>
                                    <footer>
                                        <span className="testimonial-avatar">{review.reviewerName?.charAt(0)?.toUpperCase() || 'A'}</span>
                                        <div><strong>{review.reviewerName}</strong><small>Verified customer testimonial{review.reviewDate ? ` · ${new Date(`${review.reviewDate}T00:00:00`).toLocaleDateString('en-IN', { month: 'short', year: 'numeric' })}` : ''}</small></div>
                                    </footer>
                                </div>
                            </article>
                        ))}
                    </div>
                )}
            </div>
        </section>
    );
};

export default ReviewsSection;
