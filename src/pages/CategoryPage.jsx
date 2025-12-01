
import React from 'react';
import { useParams } from 'react-router-dom';
import ProductCard from '../components/ProductCard';
import './CategoryPage.css';

import productsData from '../assets/json/products.json';

import Breadcrumbs from '../components/Breadcrumbs';

const CategoryPage = ({ title }) => {
    const { category } = useParams();
    const displayTitle = title || category?.replace('-', ' ');

    // Helper to map display title to JSON key
    const getCategoryKey = (title) => {
        if (title === "Women's Wear") return "Womens Wear";
        if (title === "Men's Wear") return "Mens Wear";
        return title;
    };

    const categoryKey = getCategoryKey(displayTitle);
    const products = productsData[categoryKey] || [];

    const breadcrumbItems = [
        { label: displayTitle, path: `/${displayTitle.toLowerCase().replace(/ /g, '-')}` }
    ];

    return (
        <div className="category-page container">
            <Breadcrumbs items={breadcrumbItems} />
            <header className="category-header">
                <h1 className="section-title">{displayTitle}</h1>
                <p>Explore our latest collection of {displayTitle}.</p>
            </header>

            <div className="product-grid">
                {products.length > 0 ? (
                    <>
                        {displayTitle === "Women's Wear" && <h2 className="subsection-title">New arrivals coming soon to Women's Wear!</h2>}
                        <div className="products-list">
                            {products.map(product => (
                                <ProductCard key={product.id} product={product} />
                            ))}
                        </div>
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

