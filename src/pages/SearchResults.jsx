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

        const terms = query.toLowerCase().trim().split(/\s+/).filter(Boolean);
        return catalogProducts.filter((product) => {
            const searchable = [
                product.id, product.name, product.description, product.category,
                product.color, ...(Array.isArray(product.subcategory) ? product.subcategory : []),
            ].filter(Boolean).join(' ').toLowerCase();
            return terms.every((term) => searchable.includes(term));
        });
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
