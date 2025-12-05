import React from 'react';
import { Link } from 'react-router-dom';
import './Hero.css';

const Hero = () => {
    return (
        <section className="hero">
            <div className="hero-content">
                {/*
                <h1>Elevate Your Style</h1>
                <p>Discover the latest trends in fashion and luxury.</p>-->
                */}
                <Link to="/womens-wear" className="btn">Shop Collection</Link>
            </div>
        </section>
    );
};

export default Hero;
