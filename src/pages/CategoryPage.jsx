import React, { useEffect, useState, useMemo } from 'react';
import { useParams, useSearchParams } from 'react-router-dom';
import { Filter, ChevronDown, X } from 'lucide-react';
import ProductCard from '../components/ProductCard';
import './CategoryPage.css';

import productsData from '../assets/json/products.json';
import Breadcrumbs from '../components/Breadcrumbs';

const CategoryPage = ({ title }) => {
    const { category } = useParams();
    const [searchParams] = useSearchParams();
    const subcategoryFilter = searchParams.get('subcategory');

    const displayTitle = title || category?.replace('-', ' ');

    // Filter and Sort states
    const [isFilterOpen, setIsFilterOpen] = useState(false);
    const [sortBy, setSortBy] = useState('featured');
    const [filters, setFilters] = useState({
        availability: 'all',
        maxPrice: 10000,
        colors: [],
        sizes: []
    });

    // Helper to map display title to JSON key
    const getCategoryKey = (title) => {
        if (title === "Women's Wear") return "Womens Wear";
        if (title === "Men's Wear") return "Mens Wear";
        return title;
    };

    const categoryKey = getCategoryKey(displayTitle);
    const categoryProducts = useMemo(() => productsData[categoryKey] || [], [categoryKey]);

    // Derive available options from category products
    const filterOptions = useMemo(() => {
        const colors = new Set();
        const sizes = new Set();
        let maxP = 0;

        categoryProducts.forEach(p => {
            if (p.color) colors.add(p.color);
            if (p.sizes) p.sizes.forEach(s => sizes.add(s));
            const price = parseFloat(p.price?.toString().replace(/[^0-9.]/g, '') || 0);
            if (price > maxP) maxP = price;
        });

        return {
            colors: Array.from(colors).sort(),
            sizes: Array.from(sizes).sort(),
            maxPrice: Math.ceil(maxP)
        };
    }, [categoryProducts]);

    // Initialize maxPrice filter when category changes
    useEffect(() => {
        setFilters(prev => ({ ...prev, maxPrice: filterOptions.maxPrice }));
    }, [filterOptions.maxPrice]);

    // Filtering and Sorting Logic
    const products = useMemo(() => {
        let result = [...categoryProducts];

        // 1. Subcategory filter (from URL)
        if (subcategoryFilter) {
            result = result.filter(product => {
                if (Array.isArray(product.subcategory)) {
                    return product.subcategory.includes(subcategoryFilter);
                }
                return product.subcategory === subcategoryFilter;
            });
        }

        // 2. Availability filter
        if (filters.availability !== 'all') {
            result = result.filter(p =>
                filters.availability === 'in-stock' ? p.available === 'In Stock' : p.available !== 'In Stock'
            );
        }

        // 3. Price filter
        result = result.filter(p => {
            const price = parseFloat(p.price?.toString().replace(/[^0-9.]/g, '') || 0);
            return price <= filters.maxPrice;
        });

        // 4. Color filter
        if (filters.colors.length > 0) {
            result = result.filter(p => filters.colors.includes(p.color));
        }

        // 5. Size filter
        if (filters.sizes.length > 0) {
            result = result.filter(p => p.sizes && p.sizes.some(s => filters.sizes.includes(s)));
        }

        // 6. Sorting
        switch (sortBy) {
            case 'best-selling':
                // Mocking best selling by using stock or id for now
                result.sort((a, b) => (b.stock || 0) - (a.stock || 0));
                break;
            case 'a-z':
                result.sort((a, b) => a.name.localeCompare(b.name));
                break;
            case 'z-a':
                result.sort((a, b) => b.name.localeCompare(a.name));
                break;
            case 'price-low':
                result.sort((a, b) => {
                    const pa = parseFloat(a.price?.toString().replace(/[^0-9.]/g, '') || 0);
                    const pb = parseFloat(b.price?.toString().replace(/[^0-9.]/g, '') || 0);
                    return pa - pb;
                });
                break;
            case 'price-high':
                result.sort((a, b) => {
                    const pa = parseFloat(a.price?.toString().replace(/[^0-9.]/g, '') || 0);
                    const pb = parseFloat(b.price?.toString().replace(/[^0-9.]/g, '') || 0);
                    return pb - pa;
                });
                break;
            default: // featured
                break;
        }

        return result;
    }, [categoryProducts, subcategoryFilter, filters, sortBy]);

    const handleFilterChange = (type, value) => {
        setFilters(prev => {
            if (type === 'colors' || type === 'sizes') {
                const current = prev[type];
                const updated = current.includes(value)
                    ? current.filter(v => v !== value)
                    : [...current, value];
                return { ...prev, [type]: updated };
            }
            return { ...prev, [type]: value };
        });
    };

    const breadcrumbItems = [
        { label: displayTitle, path: `/${displayTitle.toLowerCase().replace(/ /g, '-')}` }
    ];

    useEffect(() => {
        const observerOptions = { threshold: 0.1 };
        const observer = new IntersectionObserver((entries) => {
            entries.forEach(entry => {
                if (entry.isIntersecting) {
                    entry.target.classList.add('reveal');
                }
            });
        }, observerOptions);

        const cards = document.querySelectorAll('.product-card');
        cards.forEach(card => observer.observe(card));

        return () => cards.forEach(card => observer.unobserve(card));
    }, [products]);

    return (
        <div className="category-page container">
            <Breadcrumbs items={breadcrumbItems} />
            <header className="category-header">
                <h1 className="section-title">{displayTitle}</h1>
                <p>{displayTitle === "Women's Wear"
                    ? "Discover our latest Women’s Wear collection—where modern trends meet timeless elegance."
                    : `Explore our latest collection of ${displayTitle}.`}
                </p>
            </header>

            <div className="controls-bar">
                <button className="filter-toggle-btn" onClick={() => setIsFilterOpen(!isFilterOpen)}>
                    <Filter size={20} /> Filter {(filters.colors.length + filters.sizes.length) > 0 && `(${filters.colors.length + filters.sizes.length})`}
                </button>

                <div className="sort-container">
                    <label htmlFor="sort-by">Sort by: </label>
                    <select id="sort-by" value={sortBy} onChange={(e) => setSortBy(e.target.value)}>
                        <option value="featured">Featured</option>
                        <option value="best-selling">Best selling</option>
                        <option value="a-z">Alphabetically, A-Z</option>
                        <option value="z-a">Alphabetically, Z-A</option>
                        <option value="price-low">Price, low to high</option>
                        <option value="price-high">Price, high to low</option>
                    </select>
                </div>
            </div>

            <div className="category-content">
                <div
                    className={`filter-overlay ${isFilterOpen ? 'visible' : ''}`}
                    onClick={() => setIsFilterOpen(false)}
                ></div>
                <aside className={`filter-sidebar ${isFilterOpen ? 'open' : ''}`}>
                    <div className="filter-header">
                        <h3>Filters</h3>
                        <button className="close-filters" onClick={() => setIsFilterOpen(false)}><X size={20} /></button>
                    </div>

                    <div className="filter-group">
                        <h4>Availability</h4>
                        <div className="filter-options">
                            <label><input type="radio" name="avail" checked={filters.availability === 'all'} onChange={() => handleFilterChange('availability', 'all')} /> All</label>
                            <label><input type="radio" name="avail" checked={filters.availability === 'in-stock'} onChange={() => handleFilterChange('availability', 'in-stock')} /> In Stock</label>
                            <label><input type="radio" name="avail" checked={filters.availability === 'out-of-stock'} onChange={() => handleFilterChange('availability', 'out-of-stock')} /> Out of Stock</label>
                        </div>
                    </div>

                    <div className="filter-group">
                        <h4>Price (Up to ₹{filters.maxPrice})</h4>
                        <input
                            type="range"
                            min="0"
                            max={filterOptions.maxPrice}
                            value={filters.maxPrice}
                            onChange={(e) => handleFilterChange('maxPrice', parseInt(e.target.value))}
                        />
                    </div>

                    {filterOptions.colors.length > 0 && (
                        <div className="filter-group">
                            <h4>Color</h4>
                            <div className="filter-grid">
                                {filterOptions.colors.map(color => (
                                    <label key={color} className={`filter-chip ${filters.colors.includes(color) ? 'active' : ''}`}>
                                        <input type="checkbox" checked={filters.colors.includes(color)} onChange={() => handleFilterChange('colors', color)} />
                                        {color}
                                    </label>
                                ))}
                            </div>
                        </div>
                    )}

                    {filterOptions.sizes.length > 0 && (
                        <div className="filter-group">
                            <h4>Size</h4>
                            <div className="filter-grid">
                                {filterOptions.sizes.map(size => (
                                    <label key={size} className={`filter-chip ${filters.sizes.includes(size) ? 'active' : ''}`}>
                                        <input type="checkbox" checked={filters.sizes.includes(size)} onChange={() => handleFilterChange('sizes', size)} />
                                        {size}
                                    </label>
                                ))}
                            </div>
                        </div>
                    )}
                </aside>

                <div className="products-container">
                    <div className="products-list">
                        {products.length > 0 ? (
                            products.map(product => (
                                <ProductCard key={product.id} product={product} />
                            ))
                        ) : (
                            <div className="empty-state">
                                <p>No products match your filters.</p>
                            </div>
                        )}
                    </div>
                </div>
            </div>
        </div>
    );
};

export default CategoryPage;

