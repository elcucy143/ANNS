import { Heart, ShoppingBag } from 'lucide-react';
import { Link } from 'react-router-dom';
import ProductCard from '../components/ProductCard';
import { useProductCatalog } from '../context/ProductCatalogContext';
import { useShoppingHistory } from '../context/ShoppingHistoryContext';
import './Wishlist.css';

const Wishlist = () => {
  const { products, loading } = useProductCatalog();
  const { wishlistIds, wishlistReady } = useShoppingHistory();
  const productMap = new Map(products.map((product) => [String(product.id), product]));
  const savedProducts = wishlistIds.map((id) => productMap.get(String(id))).filter(Boolean);

  return <main className="wishlist-page container">
    <header className="wishlist-header"><p>YOUR FAVOURITES</p><h1>My Wishlist</h1><span>{savedProducts.length} saved {savedProducts.length === 1 ? 'item' : 'items'}</span></header>
    {(loading || !wishlistReady) && <div className="wishlist-state">Loading your saved items…</div>}
    {!loading && wishlistReady && savedProducts.length > 0 && <div className="wishlist-grid">{savedProducts.map((product, index) => <ProductCard key={product.id} product={product} priority={index < 4} />)}</div>}
    {!loading && wishlistReady && savedProducts.length === 0 && <section className="wishlist-empty"><Heart size={42} /><h2>Your wishlist is ready for something special</h2><p>Tap the heart on any product to save it here for later.</p><Link to="/womens-wear"><ShoppingBag size={17} /> Explore products</Link></section>}
  </main>;
};

export default Wishlist;
