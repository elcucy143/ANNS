import React from 'react';
import { Quote, Star } from 'lucide-react';
import { useReviews } from '../context/ReviewContext';
import './ReviewsSection.css';

const Stars = ({ rating }) => (
    <span className="testimonial-stars" role="img" aria-label={`${rating} out of 5 stars`}>
        {[1, 2, 3, 4, 5].map((value) => (
            <Star key={value} size={16} fill={value <= rating ? 'currentColor' : 'none'} />
        ))}
    </span>
);

const ReviewCard = ({ review }) => (
    <article className={`testimonial-card ${review.image ? 'with-image' : ''}`}>
        {review.image && <img src={review.image} alt={`Review shared by ${review.reviewerName}`} loading="lazy" />}
        <div className="testimonial-copy">
            <Quote className="testimonial-quote" size={28} />
            <Stars rating={Number(review.rating) || 5} />
            {review.title && <h3>{review.title}</h3>}
            <p>“{review.comment}”</p>
            <footer>
                <span className="testimonial-avatar">{review.reviewerName?.charAt(0)?.toUpperCase() || 'A'}</span>
                <div><strong>{review.reviewerName}</strong><small>{review.verifiedPurchase ? 'Verified purchase' : 'Verified customer testimonial'}{review.reviewDate ? ` · ${new Date(`${review.reviewDate}T00:00:00`).toLocaleDateString('en-IN', { month: 'short', year: 'numeric' })}` : ''}</small></div>
            </footer>
        </div>
    </article>
);

const ReviewsSection = ({ featured = false, productId = '', title = 'What our customers say' }) => {
    const { reviews, loading } = useReviews();
    const visibleReviews = reviews
        .filter((review) => (productId ? review.productId === productId : (featured ? review.featured : true)))
        .slice(0, featured ? 8 : 12);
    const slidingReviews = featured && visibleReviews.length
        ? Array.from(
            { length: Math.max(visibleReviews.length, 4) },
            (_, index) => visibleReviews[index % visibleReviews.length],
        )
        : visibleReviews;

    if (!loading && !visibleReviews.length && !featured) return null;

    return (
        <section id="customer-reviews" className="testimonials-section" aria-labelledby="testimonials-title">
            <div className="container">
                <div className="testimonials-heading">
                    <p>REAL CUSTOMER STORIES</p>
                    <h2 id="testimonials-title">{title}</h2>
                    <span>Testimonials shared directly with A.S. Trends &amp; Gifts.</span>
                </div>
                {loading ? <div className="testimonials-loading">Loading customer reviews…</div> : !visibleReviews.length ? (
                    <div className="testimonials-empty">
                        <span className="testimonials-empty-stars" aria-hidden="true">★★★★★</span>
                        <h3>Customer stories are coming soon</h3>
                        <p>Real experiences shared by our customers will appear here.</p>
                    </div>
                ) : featured ? (
                    <div className="testimonials-marquee" role="region" aria-label="Sliding customer reviews">
                        <div className="testimonials-track">
                            <div className="testimonials-group">
                                {slidingReviews.map((review, index) => (
                                    <ReviewCard review={review} key={`review-a-${review.id}-${index}`} />
                                ))}
                            </div>
                            <div className="testimonials-group testimonials-clone" aria-hidden="true">
                                {slidingReviews.map((review, index) => (
                                    <ReviewCard review={review} key={`review-b-${review.id}-${index}`} />
                                ))}
                            </div>
                        </div>
                    </div>
                ) : (
                    <div className="testimonials-grid">
                        {visibleReviews.map((review) => <ReviewCard review={review} key={review.id} />)}
                    </div>
                )}
            </div>
        </section>
    );
};

export default ReviewsSection;
