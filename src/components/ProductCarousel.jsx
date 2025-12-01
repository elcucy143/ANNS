
import React from 'react';
import './ProductCarousel.css';

import productsData from '../assets/json/products.json';

// Flatten products from all categories and pick a few for the carousel
const getAllProducts = () => {
    let allProducts = [];
    Object.values(productsData).forEach(categoryProducts => {
        allProducts = [...allProducts, ...categoryProducts];
    });
    return allProducts.slice(0, 5); // Display first 5 products
};

const products = getAllProducts();

const ProductCarousel = () => {
    return (
        <section className="product-carousel-section">
            <div className="container">
                <h2 className="section-title">Featured Collection</h2>
                <div className="carousel-container">
                    <div className="carousel-track">
                        {products.map((product) => (
                            <div key={product.id} className="carousel-card">
                                <div className="product-image">
                                    <img src={product.image} alt={product.name} />
                                    <button className="add-to-cart-btn">Add to Cart</button>
                                </div>
                                <div className="product-info">
                                    <h3>{product.name}</h3>
                                    <span className="price">{product.price}</span>
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
            </div>
        </section>
    );
};

export default ProductCarousel;
