import React from 'react';
import Hero from '../components/Hero';
import ProductCarousel from '../components/ProductCarousel';
import CampaignCarousel from '../components/CampaignCarousel';
import ReviewsSection from '../components/ReviewsSection';
import FlashSaleSection from '../components/FlashSaleSection';
import InstagramReelsSection from '../components/InstagramReelsSection';
import { useProductCatalog } from '../context/ProductCatalogContext';
import { useShoppingHistory } from '../context/ShoppingHistoryContext';

const Home = () => {
    const { products } = useProductCatalog();
    const { recentIds } = useShoppingHistory();
    const recentlyViewed = recentIds.map((id) => products.find((product) => String(product.id) === id)).filter(Boolean);
    return (
        <div className="home-page">
            <Hero />
            <CampaignCarousel />
            <FlashSaleSection />
            <ProductCarousel />
            {recentlyViewed.length > 0 && <ProductCarousel products={recentlyViewed} title="Recently viewed" />}
            <InstagramReelsSection />
            <ReviewsSection featured title="Loved by our customers" />
        </div>
    );
};

export default Home;
