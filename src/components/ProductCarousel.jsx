
import React from 'react';
import { Link } from 'react-router-dom';
import './ProductCarousel.css';

import productsData from '../assets/json/products.json';

import images from '../assets/images';

// Flatten products from all categories and filter those marked as featured
const getFeaturedProducts = () => {
    let featuredProducts = [];
    Object.values(productsData).forEach(categoryProducts => {
        const filtered = categoryProducts.filter(p => p.featured === "yes");
        featuredProducts = [...featuredProducts, ...filtered];
    });
    return featuredProducts;
};

const ProductCarousel = ({ products: inputProducts, title = "Featured Collection" }) => {
    // Use input products if provided, otherwise fetch default featured products
    const products = inputProducts || getFeaturedProducts();

    return (
        <section className="product-carousel-section">
            <div className="container">
                <h2 className="section-title">{title}</h2>
                <div className="carousel-container">
                    <div className="carousel-track">
                        {products.map((product) => {
                            const filename = product.image ? product.image.split('/').pop() : '';
                            return (
                                <div key={product.id} className="carousel-card">
                                    <Link to={`/product/${product.id}`} className="carousel-product-link">
                                        <div className="product-image">
                                            <img src={images[filename] || product.image} alt={product.name} />
                                            <button
                                                className="add-to-cart-btn"
                                                onClick={(e) => {
                                                    e.preventDefault();
                                                    // Add to cart logic can be added here later
                                                }}
                                            >
                                                Add to Cart
                                            </button>
                                        </div>
                                        <div className="product-info">
                                            <h3>{product.name}</h3>
                                            <span className="price">₹{product.price}</span>
                                        </div>
                                    </Link>
                                </div>
                            );
                        })}
                    </div>
                </div>
            </div>
        </section>
    );
};

export default ProductCarousel;
