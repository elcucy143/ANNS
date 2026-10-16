import React from 'react';
import Hero from '../components/Hero';
import ProductCarousel from '../components/ProductCarousel';
import CampaignCarousel from '../components/CampaignCarousel';
import ReviewsSection from '../components/ReviewsSection';
import FlashSaleSection from '../components/FlashSaleSection';

const Home = () => {
    return (
        <div className="home-page">
            <Hero />
            <CampaignCarousel />
            <FlashSaleSection />
            <ProductCarousel />
            <ReviewsSection featured title="Loved by our customers" />
        </div>
    );
};

export default Home;
