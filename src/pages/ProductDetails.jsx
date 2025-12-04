import React, { useState } from 'react';
import { useParams } from 'react-router-dom';
import { Star, Truck, RefreshCw, Clock, Minus, Plus } from 'lucide-react';
import { useCart } from '../context/CartContext';
import './ProductDetails.css';

import productsData from '../assets/json/products.json';

import Breadcrumbs from '../components/Breadcrumbs';

import images from '../assets/images';

const ProductDetails = () => {
    const { id } = useParams();
    const { addToCart } = useCart();
    const [quantity, setQuantity] = useState(1);
    const [selectedSize, setSelectedSize] = useState('M');
    const [selectedColor, setSelectedColor] = useState('Red');
    const [selectedImage, setSelectedImage] = useState(null);

    // Reset selected image when product changes
    React.useEffect(() => {
        setSelectedImage(null);
    }, [id]);

    // Find product by ID across all categories and get category name
    const findProductAndCategory = (id) => {
        for (const category in productsData) {
            const found = productsData[category].find(p => p.id === id);
            if (found) return { product: found, category };
        }
        return { product: null, category: null };
    };

    const { product: productData, category } = findProductAndCategory(id);

    if (!productData) {
        return <div className="container" style={{ padding: '100px', textAlign: 'center' }}>Product not found</div>;
    }

    // Adapt JSON data to component state structure if needed, or use directly
    const product = {
        ...productData,
        images: [productData.image, ...(productData.otherImages || [])],
        rating: 4.5, // Default if not in JSON
        reviews: productData.reviews?.length || 0
    };

    const breadcrumbItems = [
        { label: category, path: `/${category.toLowerCase().replace(/ /g, '-')}` },
        { label: product.name, path: '#' }
    ];

    const handleQuantityChange = (type) => {
        if (type === 'increment') {
            setQuantity(prev => prev + 1);
        } else if (type === 'decrement' && quantity > 1) {
            setQuantity(prev => prev - 1);
        }
    };

    const handleAddToCart = () => {
        addToCart(product, quantity, selectedSize, selectedColor);
    };

    const getImageSrc = (path) => {
        if (!path) return '';
        const filename = path.split('/').pop();
        return images[filename] || path;
    };

    return (
        <div className="product-details-page container">
            <Breadcrumbs items={breadcrumbItems} />
            <div className="product-details-grid">
                {/* Image Gallery */}
                <div className="product-gallery">
                    <div
                        className="main-image"
                        onMouseMove={(e) => {
                            const { left, top, width, height } = e.currentTarget.getBoundingClientRect();
                            const x = ((e.clientX - left) / width) * 100;
                            const y = ((e.clientY - top) / height) * 100;
                            e.currentTarget.style.setProperty('--x', `${x}%`);
                            e.currentTarget.style.setProperty('--y', `${y}%`);
                        }}
                    >
                        <img src={getImageSrc(selectedImage || product.images[0])} alt={product.name} />
                    </div>
                    <div className="thumbnail-list">
                        {product.images.map((img, index) => (
                            <img
                                key={index}
                                src={getImageSrc(img)}
                                alt={`View ${index + 1}`}
                                className={`thumbnail ${selectedImage === img || (!selectedImage && index === 0) ? 'active' : ''}`}
                                onClick={() => setSelectedImage(img)}
                            />
                        ))}
                    </div>
                </div>

                {/* Product Info */}
                <div className="product-info-section">
                    <h1 className="product-title">{product.name}</h1>
                    <div className="product-rating">
                        <div className="stars">
                            {[...Array(5)].map((_, i) => (
                                <Star key={i} size={16} fill={i < Math.floor(product.rating) ? "#FFD700" : "none"} color="#FFD700" />
                            ))}
                        </div>
                        <a href="#" className="review-link">({product.reviews} Reviews)</a>
                    </div>
                    <p className="product-price">{product.price}</p>
                    <p className="product-description">{product.description}</p>

                    {/* Colors */}
                    <div className="product-option">
                        <h3>Color: {selectedColor}</h3>
                        <div className="color-options">
                            {/* JSON has single color string, adapting to array for UI consistency or just showing one */}
                            {[product.color || 'Red'].map(color => (
                                <button
                                    key={color}
                                    className={`color-btn ${selectedColor === color ? 'selected' : ''}`}
                                    style={{ backgroundColor: color.toLowerCase() }}
                                    onClick={() => setSelectedColor(color)}
                                    aria-label={color}
                                />
                            ))}
                        </div>
                    </div>

                    {/* Sizes */}
                    <div className="product-option">
                        <h3>Size: {selectedSize}</h3>
                        <div className="size-options">
                            {product.sizes.map(size => (
                                <button
                                    key={size}
                                    className={`size-btn ${selectedSize === size ? 'selected' : ''}`}
                                    onClick={() => setSelectedSize(size)}
                                >
                                    {size}
                                </button>
                            ))}
                        </div>
                    </div>

                    {/* Quantity & Add to Cart */}
                    <div className="action-buttons">
                        <div className="quantity-selector">
                            <button onClick={() => handleQuantityChange('decrement')}><Minus size={16} /></button>
                            <span>{quantity}</span>
                            <button onClick={() => handleQuantityChange('increment')}><Plus size={16} /></button>
                        </div>
                        <button className="add-to-cart-primary" onClick={handleAddToCart}>Add to Cart</button>
                    </div>

                    {/* Shipping Info */}
                    <div className="shipping-info">
                        <div className="shipping-item">
                            <Truck size={20} />
                            <span>Pan India Shipping</span>
                        </div>
                        <div className="shipping-item">
                            <Clock size={20} />
                            <span>Shipped in 3-5 days</span>
                        </div>
                        <div className="shipping-item">
                            <RefreshCw size={20} />
                            <span>Easy Returns</span>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default ProductDetails;
