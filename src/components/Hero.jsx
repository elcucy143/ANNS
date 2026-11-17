import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import './Hero.css';
import heroBanner1 from '../assets/hero-banner1.webp';
import heroBanner2 from '../assets/hero-banner2.webp';
import { getHomepageBanners } from '../services/apiClient';
import { mediaImageVariant } from '../utils/imageUrl';

const fallbackSlides = [
    { id: 'default-1', image: heroBanner1, alt: 'ANNS featured collection', link: '/womens-wear' },
    { id: 'default-2', image: heroBanner2, alt: 'ANNS latest styles', link: '/womens-wear' },
];

const Hero = () => {
    const [currentSlide, setCurrentSlide] = useState(0);
    const [slides, setSlides] = useState([]);

    useEffect(() => {
        let active = true;
        getHomepageBanners()
            .then((result) => {
                const published = Array.isArray(result?.slides) ? result.slides.filter((slide) => slide.active !== false && slide.image) : [];
                if (active) setSlides(published.length ? published : fallbackSlides);
            })
            .catch(() => { if (active) setSlides(fallbackSlides); });
        return () => { active = false; };
    }, []);

    useEffect(() => {
        if (slides.length < 2) return undefined;
        const interval = setInterval(() => {
            setCurrentSlide((prev) => (prev + 1) % slides.length);
        }, 8000);
        return () => clearInterval(interval);
    }, [slides.length]);

    const activeSlide = currentSlide < slides.length ? currentSlide : 0;
    const slide = slides[activeSlide] || slides[0] || null;

    return (
        <section className="hero" aria-label={slide?.alt || 'Loading ANNS featured collection'}>
            {slide && <img
                className="hero-image"
                src={mediaImageVariant(slide.image)}
                srcSet={slide.image?.startsWith('/api/media-image?') ? `${mediaImageVariant(slide.image, 'hero-mobile-v1')} 900w, ${mediaImageVariant(slide.image)} 1800w` : undefined}
                sizes="100vw"
                alt=""
                aria-hidden="true"
                loading="eager"
                decoding="async"
                fetchPriority="high"
            />}
            <div className="hero-content">
                {/* 
                <h1>Elevate Your Style</h1>
                <p>Discover the latest trends in fashion and luxury.</p> 
                */}
                {slide && <Link to={slide.link || '/womens-wear'} className="btn">Shop Collection</Link>}
            </div>
            {slides.length > 1 && <div className="carousel-dots">
                {slides.map((item, index) => (
                    <button
                        type="button"
                        key={item.id || index}
                        className={`dot ${activeSlide === index ? 'active' : ''}`}
                        onClick={() => setCurrentSlide(index)}
                        aria-label={`Show banner ${index + 1}`}
                        aria-current={activeSlide === index ? 'true' : undefined}
                    />
                ))}
            </div>}
        </section>
    );
};

export default Hero;
