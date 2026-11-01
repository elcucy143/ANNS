import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import './Hero.css';
import heroBanner1 from '../assets/hero-banner1.jpg';
import heroBanner2 from '../assets/hero-banner2.jpg';
import { getHomepageBanners } from '../services/apiClient';

const fallbackSlides = [
    { id: 'default-1', image: heroBanner1, alt: 'ANNS featured collection', link: '/womens-wear' },
    { id: 'default-2', image: heroBanner2, alt: 'ANNS latest styles', link: '/womens-wear' },
];

const Hero = () => {
    const [currentSlide, setCurrentSlide] = useState(0);
    const [slides, setSlides] = useState(fallbackSlides);

    useEffect(() => {
        let active = true;
        getHomepageBanners()
            .then((result) => {
                const published = Array.isArray(result?.slides) ? result.slides.filter((slide) => slide.active !== false && slide.image) : [];
                if (active && published.length) setSlides(published);
            })
            .catch(() => { /* Bundled banners remain available if the API is temporarily unavailable. */ });
        return () => { active = false; };
    }, []);

    useEffect(() => {
        if (slides.length < 2) return undefined;
        const interval = setInterval(() => {
            setCurrentSlide((prev) => (prev + 1) % slides.length);
        }, 5000);
        return () => clearInterval(interval);
    }, [slides.length]);

    const activeSlide = currentSlide < slides.length ? currentSlide : 0;
    const slide = slides[activeSlide] || slides[0] || fallbackSlides[0];

    return (
        <section className="hero" aria-label={slide.alt || 'ANNS featured collection'} style={{ backgroundImage: `linear-gradient(rgba(0, 0, 0, 0.3), rgba(0, 0, 0, 0.3)), url("${slide.image}")` }}>
            <div className="hero-content">
                {/* 
                <h1>Elevate Your Style</h1>
                <p>Discover the latest trends in fashion and luxury.</p> 
                */}
                <Link to={slide.link || '/womens-wear'} className="btn">Shop Collection</Link>
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
