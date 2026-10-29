import React, { useEffect, useMemo, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import ProductCard from '../components/ProductCard';
import './SearchResults.css';
import { useProductCatalog } from '../context/ProductCatalogContext';
import { searchProducts } from '../utils/productSearch';

const PAGE_SIZE = 24;

const SearchResults = () => {
    const [searchParams] = useSearchParams();
    const query = searchParams.get('q') || '';
    const { products: catalogProducts } = useProductCatalog();
    const [page, setPage] = useState(1);
    const results = useMemo(() => query ? searchProducts(catalogProducts, query) : [], [query, catalogProducts]);
    const pageCount = Math.max(1, Math.ceil(results.length / PAGE_SIZE));
    const visibleResults = results.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);
    useEffect(() => { queueMicrotask(() => setPage(1)); }, [query]);

    return (
        <div className="search-results-page container">
            <h1 className="search-title">
                {query ? `Search Results for "${query}"` : 'Search'}
            </h1>
            {results.length > 0 && <p className="search-summary">{results.length.toLocaleString('en-IN')} matching product{results.length === 1 ? '' : 's'} · best matches shown first</p>}

            {results.length > 0 ? (
                <div className="product-grid">
                    {visibleResults.map(product => (
                        <ProductCard key={product.id} product={product} />
                    ))}
                </div>
            ) : (
                <div className="no-results">
                    <p>No products found matching your search.</p>
                    <small>Try a product code, category, colour, or a shorter spelling.</small>
                </div>
            )}
            {pageCount > 1 && <nav className="search-pagination" aria-label="Search result pages">
                <button type="button" disabled={page === 1} onClick={() => setPage((current) => Math.max(1, current - 1))}>Previous</button>
                {Array.from({ length: pageCount }, (_, index) => index + 1).filter((number) => number === 1 || number === pageCount || Math.abs(number - page) <= 2).map((number, index, numbers) => <React.Fragment key={number}>{index > 0 && number - numbers[index - 1] > 1 && <span>…</span>}<button type="button" className={number === page ? 'active' : ''} aria-current={number === page ? 'page' : undefined} onClick={() => setPage(number)}>{number}</button></React.Fragment>)}
                <button type="button" disabled={page === pageCount} onClick={() => setPage((current) => Math.min(pageCount, current + 1))}>Next</button>
            </nav>}
        </div>
    );
};

export default SearchResults;
