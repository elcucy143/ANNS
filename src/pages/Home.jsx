import React from 'react';
import Hero from '../components/Hero';
import ProductCarousel from '../components/ProductCarousel';
import CampaignCarousel from '../components/CampaignCarousel';

const Home = () => {
    return (
        <div className="home-page">
            <Hero />
            <CampaignCarousel />
            <ProductCarousel />
        </div>
    );
};

export default Home;
