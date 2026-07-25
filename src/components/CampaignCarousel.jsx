import React, { useState, useEffect } from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import './CampaignCarousel.css';
import cmpWw from '../assets/cmp-ww.jpg';
import cmpJw from '../assets/cmp-jw.jpg';
import cmpGf from '../assets/cmp-gf.jpg';

/*
const campaigns = [
    {
        id: 1,
        title: 'New Arrivals',
        description: 'Explore the latest trends in ethnic wear',
        image: 'https://images.unsplash.com/photo-1610030469983-98e550d6193c?ixlib=rb-4.0.3&auto=format&fit=crop&w=1200&q=80',
        link: '/womens-wear'
    },
    {
        id: 2,
        title: 'Festive Specials',
        description: 'Celebrate in style with our festive collection',
        image: 'https://images.unsplash.com/photo-1583391733958-e02376e885d5?ixlib=rb-4.0.3&auto=format&fit=crop&w=1200&q=80',
        link: '/sale'
    },
    {
        id: 3,
        title: 'Kids Collection',
        description: 'Adorable outfits for your little ones',
        image: 'https://images.unsplash.com/photo-1518831959646-742c3a14ebf7?ixlib=rb-4.0.3&auto=format&fit=crop&w=1200&q=80',
        link: '/gifts'
    }
];
*/

const campaigns = [
    {
        id: 1,
        title: 'Women\'s Wear',
        description: 'Shop our Women’s Wear collection featuring designer dresses, ethnic wear, Indo-western outfits, and everyday essentials crafted for comfort and style.',
        image: cmpWw,
        link: '/womens-wear'
    },
    {
        id: 2,
        title: 'Jewellery Collection',
        description: 'Browse our latest traditional and modern jewellery collection. Find handcrafted earrings, designer necklaces, and premium accessories perfect for every occasion.',
        image: cmpJw,
        link: '/sale'
    },
    {
        id: 3,
        title: 'Finely crafted Gift Collection',
        description: 'Discover our finely crafted gift collection, designed to inspire joy and celebrate every special moment.',
        image: cmpGf,
        link: '/gifts'
    }
];

const CampaignCarousel = () => {
    const [currentIndex, setCurrentIndex] = useState(0);

    useEffect(() => {
        const interval = setInterval(() => {
            setCurrentIndex((prev) => (prev + 1) % campaigns.length);
        }, 300000); // 5 minutes

        return () => clearInterval(interval);
    }, []);

    const nextSlide = () => {
        setCurrentIndex((prev) => (prev + 1) % campaigns.length);
    };

    const prevSlide = () => {
        setCurrentIndex((prev) => (prev - 1 + campaigns.length) % campaigns.length);
    };

    return (
        <section className="campaign-carousel">
            <div className="container">
                <div className="carousel-wrapper">
                    <button className="carousel-btn prev" onClick={prevSlide}>
                        <ChevronLeft size={32} />
                    </button>

                    <div className="campaign-slide">
                        {campaigns.map((campaign, index) => (
                            <div
                                key={campaign.id}
                                className={`campaign-card ${index === currentIndex ? 'active' : ''}`}
                            >
                                <div className="campaign-image">
                                    <img src={campaign.image} alt={campaign.title} />
                                </div>
                                <div className="campaign-content">
                                    <h3>{campaign.title}</h3>
                                    <p>{campaign.description}</p>
                                    <a href={campaign.link} className="btn">Shop Now</a>
                                </div>
                            </div>
                        ))}
                    </div>

                    <button className="carousel-btn next" onClick={nextSlide}>
                        <ChevronRight size={32} />
                    </button>
                </div>

                <div className="carousel-indicators">
                    {campaigns.map((_, index) => (
                        <button
                            key={index}
                            className={`indicator ${index === currentIndex ? 'active' : ''}`}
                            onClick={() => setCurrentIndex(index)}
                        />
                    ))}
                </div>
            </div>
        </section>
    );
};

export default CampaignCarousel;
