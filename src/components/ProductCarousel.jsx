
import React from 'react';
import { Link, useNavigate } from 'react-router-dom';
import './ProductCarousel.css';

import images from '../assets/images';
import { useProductCatalog } from '../context/ProductCatalogContext';
import { useCart } from '../context/CartContext';
import { productImageSrcSet, productImageVariant, recoverProductImage } from '../utils/imageUrl';

// Flatten products from all categories and filter those marked as featured
const ProductCarousel = ({ products: inputProducts, title = "Featured Collection" }) => {
    const { products: catalogProducts } = useProductCatalog();
    const { addToCart } = useCart();
    const navigate = useNavigate();
    const products = inputProducts || catalogProducts.filter((product) => product.featured === 'yes').slice(0, 6);

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
                                            <img
                                                src={images[filename] || productImageVariant(product.image, 'card')}
                                                srcSet={images[filename] ? undefined : productImageSrcSet(product.image)}
                                                sizes="(max-width: 600px) 72vw, (max-width: 1000px) 38vw, 280px"
                                                alt={product.name}
                                                loading="lazy"
                                                decoding="async"
                                                onError={recoverProductImage}
                                            />
                                            <button
                                                className="add-to-cart-btn"
                                                onClick={(e) => {
                                                    e.preventDefault();
                                                    e.stopPropagation();
                                                    addToCart(product);
                                                    navigate('/cart');
                                                }}
                                            >
                                                Add to Cart
                                            </button>
                                        </div>
                                        <div className="product-info">
                                            <h3>{product.name}</h3>
                                            <span className="price">₹{product.price}</span>
                                            {product.originalPrice > product.price && <><del className="original-price">₹{product.originalPrice}</del><span className="discount-label">{product.discountPercent}% OFF</span></>}
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
