import React, { useState, useEffect } from 'react';
import productsData from '../assets/json/products.json';
import categoriesData from '../assets/json/categories.json';
import './ProductManager.css';

const ProductManager = () => {
    const [products, setProducts] = useState(productsData);
    const [selectedCategory, setSelectedCategory] = useState(Object.keys(productsData)[0]);
    const [selectedProductId, setSelectedProductId] = useState('new');
    const [formData, setFormData] = useState(getInitialFormData());
    const [notification, setNotification] = useState('');

    function getInitialFormData() {
        return {
            id: '',
            name: '',
            description: '',
            available: '',
            price: '',
            discount: '',
            image: '',
            otherImages: [],
            color: '',
            sizes: [],
            subcategory: [],
            stock: '',
            similarProducts: [],
            reviews: [],
            shipping: [],
            featured: 'no',
            campaign: []
        };
    }

    useEffect(() => {
        if (selectedProductId === 'new') {
            setFormData(getInitialFormData());
        } else {
            const product = products[selectedCategory].find(p => p.id === selectedProductId);
            if (product) {
                // Normalize data types to ensure arrays are arrays
                setFormData({
                    ...product,
                    sizes: Array.isArray(product.sizes) ? product.sizes : [],
                    otherImages: Array.isArray(product.otherImages) ? product.otherImages : [],
                    subcategory: Array.isArray(product.subcategory) ? product.subcategory : [],
                    similarProducts: Array.isArray(product.similarProducts) ? product.similarProducts : [],
                    reviews: Array.isArray(product.reviews) ? product.reviews : [],
                    shipping: Array.isArray(product.shipping) ? product.shipping : [],
                    campaign: Array.isArray(product.campaign) ? product.campaign : []
                });
            }
        }
    }, [selectedProductId, selectedCategory, products]);

    const handleInputChange = (e) => {
        const { name, value } = e.target;
        setFormData(prev => ({
            ...prev,
            [name]: value
        }));
    };

    const handleArrayChange = (e, field) => {
        const value = e.target.value.split(',').map(item => item.trim());
        setFormData(prev => ({
            ...prev,
            [field]: value
        }));
    };

    const getSubcategories = () => {
        // Map product category keys to categories.json names if needed
        const categoryMap = {
            "Womens Wear": "Women's Wear"
        };
        const searchName = categoryMap[selectedCategory] || selectedCategory;
        const category = categoriesData.categories.find(c => c.name === searchName);
        return category ? category.subCategories : [];
    };

    const handleSubmit = (e) => {
        e.preventDefault();

        const updatedProducts = { ...products };
        const categoryProducts = [...updatedProducts[selectedCategory]];

        if (selectedProductId === 'new') {
            // Create new
            const newId = formData.id || `${selectedCategory.substring(0, 2).toLowerCase()}${Date.now()}`;
            const newProduct = { ...formData, id: newId };
            categoryProducts.push(newProduct);
            setNotification(`Product ${newProduct.name} created!`);
        } else {
            // Update existing
            const index = categoryProducts.findIndex(p => p.id === selectedProductId);
            if (index !== -1) {
                categoryProducts[index] = { ...formData };
                setNotification(`Product ${formData.name} updated!`);
            }
        }

        updatedProducts[selectedCategory] = categoryProducts;
        setProducts(updatedProducts);

        // In a real app, we would send this to a backend. 
        // Here we'll just log it and maybe offer a download.
        console.log('Updated Data:', updatedProducts);
    };

    const downloadJson = () => {
        const dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify(products, null, 2));
        const downloadAnchorNode = document.createElement('a');
        downloadAnchorNode.setAttribute("href", dataStr);
        downloadAnchorNode.setAttribute("download", "products.json");
        document.body.appendChild(downloadAnchorNode);
        downloadAnchorNode.click();
        downloadAnchorNode.remove();
    };

    return (
        <div className="product-manager container">
            <h1>Product Manager</h1>

            {notification && <div className="notification">{notification}</div>}

            <div className="controls">
                <div className="control-group">
                    <label>Category:</label>
                    <select
                        value={selectedCategory}
                        onChange={(e) => {
                            setSelectedCategory(e.target.value);
                            setSelectedProductId('new');
                        }}
                    >
                        {Object.keys(products).map(cat => (
                            <option key={cat} value={cat}>{cat}</option>
                        ))}
                    </select>
                </div>

                <div className="control-group">
                    <label>Product:</label>
                    <select
                        value={selectedProductId}
                        onChange={(e) => setSelectedProductId(e.target.value)}
                    >
                        <option value="new">+ Create New Product</option>
                        {products[selectedCategory].map(p => (
                            <option key={p.id} value={p.id}>{p.name} ({p.id})</option>
                        ))}
                    </select>
                </div>
            </div>

            <form onSubmit={handleSubmit} className="product-form">
                <div className="form-row">
                    <div className="form-group">
                        <label>ID:</label>
                        <input
                            type="text"
                            name="id"
                            value={formData.id}
                            onChange={handleInputChange}
                            placeholder="Auto-generated if empty"
                            disabled={selectedProductId !== 'new'}
                        />
                    </div>
                    <div className="form-group">
                        <label>Name:</label>
                        <input
                            type="text"
                            name="name"
                            value={formData.name}
                            onChange={handleInputChange}
                            required
                        />
                    </div>
                </div>

                <div className="form-group">
                    <label>Description:</label>
                    <textarea
                        name="description"
                        value={formData.description}
                        onChange={handleInputChange}
                        rows="3"
                    />
                </div>

                <div className="form-group">
                    <label>Available (e.g., In Stock):</label>
                    <input
                        type="text"
                        name="available"
                        value={formData.available}
                        onChange={handleInputChange}
                    />
                </div>

                <div className="form-row">
                    <div className="form-group">
                        <label>Price:</label>
                        <input
                            type="text"
                            name="price"
                            value={formData.price}
                            onChange={handleInputChange}
                            required
                        />
                    </div>
                    <div className="form-group">
                        <label>Discount:</label>
                        <input
                            type="text"
                            name="discount"
                            value={formData.discount}
                            onChange={handleInputChange}
                        />
                    </div>
                </div>

                <div className="form-group">
                    <label>Image URL:</label>
                    <input
                        type="text"
                        name="image"
                        value={formData.image}
                        onChange={handleInputChange}
                    />
                </div>

                <div className="form-group">
                    <label>Other Images (comma separated URLs):</label>
                    <textarea
                        name="otherImages"
                        value={formData.otherImages?.join(', ') || ''}
                        onChange={(e) => handleArrayChange(e, 'otherImages')}
                        rows="2"
                    />
                </div>

                <div className="form-row">
                    <div className="form-group">
                        <label>Color:</label>
                        <input
                            type="text"
                            name="color"
                            value={formData.color}
                            onChange={handleInputChange}
                        />
                    </div>
                    <div className="form-group">
                        <label>Sizes (comma separated):</label>
                        <input
                            type="text"
                            name="sizes"
                            value={formData.sizes?.join(', ') || ''}
                            onChange={(e) => handleArrayChange(e, 'sizes')}
                        />
                    </div>
                </div>

                <div className="form-group">
                    <label>Subcategory:</label>
                    <div className="subcategory-options">
                        {getSubcategories().length > 0 ? (
                            <select
                                multiple
                                value={formData.subcategory}
                                onChange={(e) => {
                                    const options = [...e.target.selectedOptions];
                                    const values = options.map(option => option.value);
                                    setFormData(prev => ({ ...prev, subcategory: values }));
                                }}
                                style={{ height: '100px' }}
                            >
                                {getSubcategories().map(sub => (
                                    <option key={sub} value={sub}>{sub}</option>
                                ))}
                            </select>
                        ) : (
                            <input
                                type="text"
                                placeholder="No predefined subcategories. Type manually (comma separated)"
                                value={formData.subcategory?.join(', ') || ''}
                                onChange={(e) => handleArrayChange(e, 'subcategory')}
                            />
                        )}
                        <small>Hold Ctrl/Cmd to select multiple</small>
                    </div>
                </div>

                <div className="form-row">
                    <div className="form-group">
                        <label>Stock:</label>
                        <input
                            type="text"
                            name="stock"
                            value={formData.stock}
                            onChange={handleInputChange}
                        />
                    </div>
                    <div className="form-group">
                        <label>Featured:</label>
                        <select name="featured" value={formData.featured} onChange={handleInputChange}>
                            <option value="yes">Yes</option>
                            <option value="no">No</option>
                        </select>
                    </div>
                </div>

                <div className="form-group">
                    <label>Campaign (comma separated):</label>
                    <input
                        type="text"
                        name="campaign"
                        value={formData.campaign?.join(', ') || ''}
                        onChange={(e) => handleArrayChange(e, 'campaign')}
                        placeholder="e.g., Pan India Shipping, Easy Returns"
                    />
                </div>

                <div className="form-group">
                    <label>Shipping Info (comma separated):</label>
                    <input
                        type="text"
                        name="shipping"
                        value={formData.shipping?.join(', ') || ''}
                        onChange={(e) => handleArrayChange(e, 'shipping')}
                    />
                </div>

                <div className="form-group">
                    <label>Reviews (IDs comma separated):</label>
                    <input
                        type="text"
                        name="reviews"
                        value={formData.reviews?.join(', ') || ''}
                        onChange={(e) => handleArrayChange(e, 'reviews')}
                    />
                </div>

                <div className="form-group">
                    <label>Similar Products (IDs comma separated):</label>
                    <input
                        type="text"
                        name="similarProducts"
                        value={formData.similarProducts?.join(', ') || ''}
                        onChange={(e) => handleArrayChange(e, 'similarProducts')}
                    />
                </div>

                <div className="form-actions">
                    <button type="submit" className="btn-save">Save Changes</button>
                    <button type="button" onClick={downloadJson} className="btn-export">Export JSON</button>
                </div>
            </form>
        </div>
    );
};

export default ProductManager;
