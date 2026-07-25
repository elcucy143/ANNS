import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import './Hero.css';
import heroBanner1 from '../assets/hero-banner1.jpg';
import heroBanner2 from '../assets/hero-banner2.jpg';

const Hero = () => {
    const [currentSlide, setCurrentSlide] = useState(0);
    const images = [heroBanner1, heroBanner2];

    useEffect(() => {
        const interval = setInterval(() => {
            setCurrentSlide((prev) => (prev + 1) % images.length);
        }, 5000);
        return () => clearInterval(interval);
    }, [images.length]);

    return (
        <section className="hero" style={{ backgroundImage: `linear-gradient(rgba(0, 0, 0, 0.3), rgba(0, 0, 0, 0.3)), url(${images[currentSlide]})` }}>
            <div className="hero-content">
                {/* 
                <h1>Elevate Your Style</h1>
                <p>Discover the latest trends in fashion and luxury.</p> 
                */}
                <Link to="/womens-wear" className="btn">Shop Collection</Link>
            </div>
            <div className="carousel-dots">
                {images.map((_, index) => (
                    <span
                        key={index}
                        className={`dot ${currentSlide === index ? 'active' : ''}`}
                        onClick={() => setCurrentSlide(index)}
                    ></span>
                ))}
            </div>
        </section>
    );
};

export default Hero;
