import React, { useEffect, useState } from 'react';
import { CheckCircle2, Star } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { getMyProductReview, saveMyProductReview } from '../services/apiClient';
import { useReviews } from '../context/ReviewContext';

const ProductReviewForm = ({ productId, productName }) => {
  const { user } = useAuth();
  const { refreshReviews } = useReviews();
  const navigate = useNavigate();
  const [eligibility, setEligibility] = useState(null);
  const [form, setForm] = useState({ rating: 0, title: '', comment: '' });
  const [hoveredRating, setHoveredRating] = useState(0);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');

  useEffect(() => {
    let active = true;
    setEligibility(null);
    setMessage('');
    setError('');
    if (!user || !productId) return () => { active = false; };
    getMyProductReview(productId).then((result) => {
      if (!active) return;
      setEligibility(result);
      if (result.review) setForm({
        rating: Number(result.review.rating) || 0,
        title: result.review.title || '',
        comment: result.review.comment || '',
      });
    }).catch((requestError) => {
      if (active) setError(requestError.message);
    });
    return () => { active = false; };
  }, [productId, user]);

  const submitReview = async (event) => {
    event.preventDefault();
    setError('');
    setMessage('');
    if (!form.rating) return setError('Please choose a star rating.');
    setBusy(true);
    try {
      const result = await saveMyProductReview({ productId, ...form });
      setEligibility((current) => ({ ...current, review: result.review }));
      setMessage('Thank you. Your verified-purchase review is now visible.');
      await refreshReviews();
    } catch (requestError) {
      setError(requestError.message);
    } finally {
      setBusy(false);
    }
  };

  if (!user) return (
    <section className="product-review-form" id="write-review">
      <h2>Review this product</h2>
      <p>Purchased {productName}? Sign in with the account used for your order to leave a verified review.</p>
      <button type="button" className="review-primary-button" onClick={() => navigate('/account', { state: { from: `/product/${productId}#write-review` } })}>Sign in to review</button>
    </section>
  );

  if (eligibility && !eligibility.eligible) return (
    <section className="product-review-form" id="write-review">
      <h2>Review this product</h2>
      <p>Reviews are available after this product has been purchased using your signed-in account.</p>
    </section>
  );

  return (
    <section className="product-review-form" id="write-review">
      <p className="review-form-eyebrow">VERIFIED PURCHASE REVIEW</p>
      <h2>{eligibility?.review ? 'Update your review' : 'How was your purchase?'}</h2>
      <form onSubmit={submitReview}>
        <fieldset className="review-stars-field">
          <legend>Overall rating</legend>
          <div className="review-star-buttons" onMouseLeave={() => setHoveredRating(0)}>
            {[1, 2, 3, 4, 5].map((rating) => (
              <button key={rating} type="button" aria-label={`${rating} star${rating === 1 ? '' : 's'}`} onMouseEnter={() => setHoveredRating(rating)} onFocus={() => setHoveredRating(rating)} onBlur={() => setHoveredRating(0)} onClick={() => setForm((current) => ({ ...current, rating }))}>
                <Star size={30} fill={rating <= (hoveredRating || form.rating) ? 'currentColor' : 'none'} />
              </button>
            ))}
          </div>
        </fieldset>
        <label>Review title<input value={form.title} onChange={(event) => setForm((current) => ({ ...current, title: event.target.value }))} maxLength="160" placeholder="Summarise your experience" /></label>
        <label>Your review<textarea value={form.comment} onChange={(event) => setForm((current) => ({ ...current, comment: event.target.value }))} minLength="10" maxLength="1500" rows="5" required placeholder="Tell other customers about quality, fit and your experience" /></label>
        {error && <p className="review-form-error" role="alert">{error}</p>}
        {message && <p className="review-form-success" role="status"><CheckCircle2 size={17} /> {message}</p>}
        <button className="review-primary-button" disabled={busy || eligibility === null}>{busy ? 'Saving…' : eligibility?.review ? 'Update review' : 'Submit review'}</button>
      </form>
    </section>
  );
};

export default ProductReviewForm;
