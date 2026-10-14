import React, { useMemo } from 'react';
import { useSearchParams } from 'react-router-dom';
import ProductCard from '../components/ProductCard';
import './SearchResults.css';
import { useProductCatalog } from '../context/ProductCatalogContext';

const SearchResults = () => {
    const [searchParams] = useSearchParams();
    const query = searchParams.get('q') || '';
    const { products: catalogProducts } = useProductCatalog();
    const results = useMemo(() => {
        if (!query) return [];

        const lowerQuery = query.toLowerCase();
        return catalogProducts.filter(product =>
            product.name.toLowerCase().includes(lowerQuery) ||
            product.description.toLowerCase().includes(lowerQuery) ||
            (product.category && product.category.toLowerCase().includes(lowerQuery))
        );
    }, [query, catalogProducts]);

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
