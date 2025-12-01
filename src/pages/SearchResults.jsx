import React, { useEffect, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import ProductCard from '../components/ProductCard';
import productsData from '../assets/json/products.json';
import './SearchResults.css';

const SearchResults = () => {
    const [searchParams] = useSearchParams();
    const query = searchParams.get('q') || '';
    const [results, setResults] = useState([]);

    useEffect(() => {
        if (!query) {
            setResults([]);
            return;
        }

        const lowerQuery = query.toLowerCase();
        const allProducts = [];

        // Flatten products from all categories
        Object.values(productsData).forEach(categoryProducts => {
            allProducts.push(...categoryProducts);
        });

        const filtered = allProducts.filter(product =>
            product.name.toLowerCase().includes(lowerQuery) ||
            product.description.toLowerCase().includes(lowerQuery) ||
            (product.category && product.category.toLowerCase().includes(lowerQuery))
        );

        setResults(filtered);
    }, [query]);

    return (
        <div className="search-results-page container">
            <h1 className="search-title">
                {query ? `Search Results for "${query}"` : 'Search'}
            </h1>

            {results.length > 0 ? (
                <div className="product-grid">
                    {results.map(product => (
                        <ProductCard key={product.id} product={product} />
                    ))}
                </div>
            ) : (
                <div className="no-results">
                    <p>No products found matching your search.</p>
                </div>
            )}
        </div>
    );
};

export default SearchResults;
