import React, { useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { Star, Truck, RefreshCw, Clock, Minus, Plus, MessageCircle } from 'lucide-react';
import { useCart } from '../context/CartContext';
import './ProductDetails.css';

import Breadcrumbs from '../components/Breadcrumbs';

import images from '../assets/images';
import ProductCarousel from '../components/ProductCarousel';
import { useProductCatalog } from '../context/ProductCatalogContext';
import { normalizeSizeList } from '../utils/productOptions';
import { businessContact } from '../config/contact';
import { useReviews } from '../context/ReviewContext';
import ReviewsSection from '../components/ReviewsSection';

const ProductDetails = () => {
    const { id } = useParams();
    const navigate = useNavigate();
    const { addToCart } = useCart();
    const [quantity, setQuantity] = useState(1);
    const [selectedSize, setSelectedSize] = useState(null);
    const [selectedColor, setSelectedColor] = useState('Red');
    const [selectedImage, setSelectedImage] = useState(null);
    const [customization, setCustomization] = useState({ nameOrText: '', instructions: '' });
    const { products: catalogProducts, loading } = useProductCatalog();
    const { reviews } = useReviews();

    // Find product by ID across all categories and get category name
    const findProductAndCategory = (productId) => {
        const found = catalogProducts.find((product) => product.id === productId);
        return { product: found || null, category: found?.category || null };
    };

    const { product: productData, category } = findProductAndCategory(id);

    // Reset selected image and size when product changes
    React.useEffect(() => {
        setSelectedImage(null);
        const sizes = normalizeSizeList(productData?.sizes);
        if (sizes.length > 0) {
            setSelectedSize(sizes[0]);
        } else {
            setSelectedSize(null);
        }
    }, [id, productData]);

    if (loading) {
        return <div className="container" style={{ padding: '100px', textAlign: 'center' }}>Loading product…</div>;
    }

    if (!productData) {
        return <div className="container" style={{ padding: '100px', textAlign: 'center' }}>Product not found</div>;
    }

    // Adapt JSON data to component state structure if needed, or use directly
    const productReviews = reviews.filter((review) => review.productId === productData.id);
    const averageRating = productReviews.length
        ? productReviews.reduce((total, review) => total + Number(review.rating || 0), 0) / productReviews.length
        : 0;
    const product = {
        ...productData,
        images: [productData.image, ...(Array.isArray(productData.otherImages) ? productData.otherImages : [])].filter(Boolean),
        sizes: normalizeSizeList(productData.sizes),
        rating: averageRating,
        reviewCount: productReviews.length,
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
        navigate('/cart');
    };

    const openCustomizationChat = () => {
        const message = [
            'Hello A.S. Trends & Gifts, I would like to customise this gift:',
            `Product: ${product.name}`,
            `Product ID: ${product.id}`,
            customization.nameOrText && `Name/text: ${customization.nameOrText}`,
            customization.instructions && `Instructions: ${customization.instructions}`,
            'I will attach my reference photos in this WhatsApp chat.',
        ].filter(Boolean).join('\n');

        window.open(`https://wa.me/${businessContact.whatsappNumber}?text=${encodeURIComponent(message)}`, '_blank', 'noopener,noreferrer');
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
                        onMouseEnter={(e) => {
                            const { width, height } = e.currentTarget.getBoundingClientRect();
                            e.currentTarget.style.setProperty('--img-width', `${width}px`);
                            e.currentTarget.style.setProperty('--img-height', `${height}px`);
                        }}
                        onMouseMove={(e) => {
                            const { left, top, width, height } = e.currentTarget.getBoundingClientRect();
                            const x = e.clientX - left;
                            const y = e.clientY - top;

                            // Clamp lens position
                            const lensSize = 150; // Match CSS
                            let lensX = x - lensSize / 2;
                            let lensY = y - lensSize / 2;

                            if (lensX < 0) lensX = 0;
                            if (lensX > width - lensSize) lensX = width - lensSize;
                            if (lensY < 0) lensY = 0;
                            if (lensY > height - lensSize) lensY = height - lensSize;

                            e.currentTarget.style.setProperty('--lens-x', `${lensX}px`);
                            e.currentTarget.style.setProperty('--lens-y', `${lensY}px`);

                            // Calculate background position for zoom window
                            const bgX = (lensX / (width - lensSize)) * 100;
                            const bgY = (lensY / (height - lensSize)) * 100;
                            e.currentTarget.style.setProperty('--bg-x', `${bgX}%`);
                            e.currentTarget.style.setProperty('--bg-y', `${bgY}%`);
                        }}
                    >
                        <img src={getImageSrc(selectedImage || product.images[0])} alt={product.name} decoding="async" />
                        <div className="magnifier-lens"></div>
                        <div
                            className="zoom-window"
                            style={{
                                backgroundImage: `url(${getImageSrc(selectedImage || product.images[0])})`
                            }}
                        ></div>
                    </div>
                    <div className="thumbnail-list">
                        {product.images.map((img, index) => (
                            <img
                                key={index}
                                src={getImageSrc(img)}
                                alt={`View ${index + 1}`}
                                loading="lazy"
                                decoding="async"
                                className={`thumbnail ${selectedImage === img || (!selectedImage && index === 0) ? 'active' : ''}`}
                                onClick={() => setSelectedImage(img)}
                            />
                        ))}
                    </div>
                </div>

                {/* Product Info */}
                <div className="product-info-section">
                    <h1 className="product-title">{product.name}</h1>
                    {product.reviewCount > 0 && <div className="product-rating">
                        <div className="stars">
                            {[...Array(5)].map((_, i) => (
                                <Star key={i} size={16} fill={i < Math.round(product.rating) ? "#B97A42" : "none"} color="#B97A42" />
                            ))}
                        </div>
                        <a href="#customer-reviews" className="review-link">{product.rating.toFixed(1)} · {product.reviewCount} {product.reviewCount === 1 ? 'review' : 'reviews'}</a>
                    </div>}
                    <p className="product-price">₹{product.price}</p>
                    <p className="product-description">{product.description}</p>

                    {category === 'Gifts' && (
                        <section className="gift-customization" aria-labelledby="gift-customization-title">
                            <div className="gift-customization-heading">
                                <MessageCircle size={22} />
                                <div>
                                    <h2 id="gift-customization-title">Customise this gift</h2>
                                    <p>Add a name, message or special request. Final details and reference photos can be shared securely on WhatsApp.</p>
                                </div>
                            </div>
                            <label>
                                Name or text to add
                                <input
                                    type="text"
                                    maxLength="120"
                                    value={customization.nameOrText}
                                    onChange={(event) => setCustomization((current) => ({ ...current, nameOrText: event.target.value }))}
                                    placeholder="For example: Happy Birthday Ananya"
                                />
                            </label>
                            <label>
                                Customization instructions
                                <textarea
                                    rows="3"
                                    maxLength="500"
                                    value={customization.instructions}
                                    onChange={(event) => setCustomization((current) => ({ ...current, instructions: event.target.value }))}
                                    placeholder="Describe colours, placement, occasion or other requirements"
                                />
                            </label>
                            <button type="button" className="whatsapp-customize-btn" onClick={openCustomizationChat}>
                                <MessageCircle size={18} /> Continue on WhatsApp
                            </button>
                            <small>WhatsApp: {businessContact.whatsappDisplay}. Attach any photos after the chat opens. Customization availability and final price will be confirmed before processing.</small>
                        </section>
                    )}

                    {/* Colors */}
                    {product.color && (
                        <div className="product-option">
                            <h3>Color: {selectedColor}</h3>
                            <div className="color-options">
                                {/* JSON has single color string, adapting to array for UI consistency or just showing one */}
                                {[product.color].map(color => (
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
                    )}

                    {/* Sizes */}
                    {product.sizes.length > 0 && <div className="product-option">
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
                        <details className="size-guide"><summary>Size guide</summary><div><strong>Women's clothing guide (in inches)</strong><table><thead><tr><th>Size</th><th>Bust</th><th>Waist</th><th>Hip</th></tr></thead><tbody><tr><td>S</td><td>34–35</td><td>27–28</td><td>37–38</td></tr><tr><td>M</td><td>36–37</td><td>29–30</td><td>39–40</td></tr><tr><td>L</td><td>38–40</td><td>31–33</td><td>41–43</td></tr><tr><td>XL–4XL</td><td>Check product measurements</td><td>Check product measurements</td><td>Check product measurements</td></tr></tbody></table><small>Measurements can vary by style. Add exact measurements to the product description when available.</small></div></details>
                    </div>}

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


            {/* Similar Products Carousel */}
            {
                product.similarProducts && product.similarProducts.length > 0 && (() => {
                    // Resolve similar product IDs to actual product objects
                    const similarProductsList = product.similarProducts.map(id => {
                        const { product: p } = findProductAndCategory(id);
                        return p;
                    }).filter(Boolean); // Filter out any not found products

                    if (similarProductsList.length === 0) return null;

                    return (
                        <div className="similar-products-section">
                            <ProductCarousel products={similarProductsList} title="You May Also Like" />
                        </div>
                    );
                })()
            }
            <ReviewsSection productId={product.id} title={`Customer reviews for ${product.name}`} />
        </div >
    );
};

export default ProductDetails;
