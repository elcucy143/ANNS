
import React, { useEffect } from 'react';
import { useParams, useSearchParams } from 'react-router-dom';
import ProductCard from '../components/ProductCard';
import './CategoryPage.css';

import productsData from '../assets/json/products.json';

import Breadcrumbs from '../components/Breadcrumbs';

const CategoryPage = ({ title }) => {
    const { category } = useParams();
    const [searchParams] = useSearchParams();
    const subcategoryFilter = searchParams.get('subcategory');

    const displayTitle = title || category?.replace('-', ' ');

    // Helper to map display title to JSON key
    const getCategoryKey = (title) => {
        if (title === "Women's Wear") return "Womens Wear";
        if (title === "Men's Wear") return "Mens Wear";
        return title;
    };

    const categoryKey = getCategoryKey(displayTitle);
    let products = productsData[categoryKey] || [];

    // Filter by subcategory if present
    if (subcategoryFilter) {
        products = products.filter(product => {
            if (Array.isArray(product.subcategory)) {
                return product.subcategory.includes(subcategoryFilter);
            }
            return product.subcategory === subcategoryFilter;
        });
    }

    const breadcrumbItems = [
        { label: displayTitle, path: `/${displayTitle.toLowerCase().replace(/ /g, '-')}` }
    ];

    useEffect(() => {
        const observerOptions = {
            threshold: 0.1
        };

        const observer = new IntersectionObserver((entries) => {
            entries.forEach(entry => {
                if (entry.isIntersecting) {
                    entry.target.classList.add('reveal');
                }
            });
        }, observerOptions);

        const cards = document.querySelectorAll('.product-card');
        cards.forEach(card => observer.observe(card));

        return () => {
            cards.forEach(card => observer.unobserve(card));
        };
    }, [products]); // Re-run when products list changes due to category or subcategory filter

    return (
        <div className="category-page container">
            <Breadcrumbs items={breadcrumbItems} />
            <header className="category-header">
                <h1 className="section-title">{displayTitle}</h1>
                {displayTitle === "Women's Wear" ? (
                    <p>Discover our latest Women’s Wear collection—where modern trends meet timeless elegance. From everyday essentials to standout styles, find pieces designed to elevate your wardrobe with confidence and comfort.</p>
                ) : (
                    <p>Explore our latest collection of {displayTitle}.</p>
                )}
            </header>

            <div className="products-list">
                {products.length > 0 ? (
                    <>
                        {products.map(product => (
                            <ProductCard key={product.id} product={product} />
                        ))}
                    </>
                ) : (
                    <div className="empty-state">
                        <p>New arrivals coming soon to {displayTitle}!</p>
                    </div>
                )}
            </div>
        </div>
    );
};

export default CategoryPage;

