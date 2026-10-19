import { useEffect, useMemo, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Clock3, ShoppingBag, Sparkles } from 'lucide-react';
import images from '../assets/images';
import { useCart } from '../context/CartContext';
import { useProductCatalog } from '../context/ProductCatalogContext';
import { getFlashSale } from '../services/apiClient';
import './FlashSaleSection.css';

const money = (value) => Number(value || 0).toLocaleString('en-IN', { maximumFractionDigits: 2 });
const HOMEPAGE_SALE_PRODUCT_LIMIT = 4;

const FlashSaleSection = () => {
    const [sale, setSale] = useState(null);
    const { products } = useProductCatalog();
    const { addToCart } = useCart();
    const navigate = useNavigate();

    useEffect(() => {
        let active = true;
        const loadSale = async () => {
            try {
                const result = await getFlashSale();
                if (active) setSale(result || null);
            } catch {
                if (active) setSale(null);
            }
        };
        void loadSale();
        const interval = window.setInterval(loadSale, 30000);
        return () => { active = false; window.clearInterval(interval); };
    }, []);

    const saleProducts = useMemo(() => {
        if (!sale?.items?.length) return [];
        const catalog = new Map(products.map((product) => [String(product.id), product]));
        return sale.items.map((item) => {
            const product = catalog.get(String(item.productId));
            if (!product) return null;
            const originalPrice = Number(String(product.price).replace(/[^0-9.]/g, ''));
            const salePrice = Number(item.salePrice);
            if (!Number.isFinite(originalPrice) || !Number.isFinite(salePrice) || salePrice >= originalPrice) return null;
            return { ...product, originalPrice, price: salePrice, discountPercent: Math.round((1 - salePrice / originalPrice) * 100) };
        }).filter(Boolean);
    }, [products, sale]);

    if (!sale || !saleProducts.length) return null;

    const endLabel = sale.endsAt
        ? new Date(sale.endsAt).toLocaleString('en-IN', { day: 'numeric', month: 'short', hour: 'numeric', minute: '2-digit' })
        : '';
    const previewProducts = saleProducts.slice(0, HOMEPAGE_SALE_PRODUCT_LIMIT);

    return (
        <section className="flash-sale-section" aria-labelledby="flash-sale-title">
            <div className="container">
                <header className={`flash-sale-header ${sale.bannerImage ? 'with-banner' : ''}`} style={sale.bannerImage ? { backgroundImage: `linear-gradient(90deg, rgba(35,22,17,.92), rgba(35,22,17,.48)), url("${sale.bannerImage}")` } : undefined}>
                    <div>
                        <span className="flash-sale-badge"><Sparkles size={15} /> {sale.badge}</span>
                        <h2 id="flash-sale-title">{sale.title}</h2>
                        {sale.subtitle && <p>{sale.subtitle}</p>}
                    </div>
                    {endLabel && <span className="flash-sale-ends"><Clock3 size={17} /> Ends {endLabel}</span>}
                </header>
                <div className="flash-sale-grid">
                    {previewProducts.map((product) => {
                        const filename = product.image ? product.image.split('/').pop() : '';
                        return (
                            <article className="flash-sale-card" key={product.id}>
                                <Link to={`/product/${product.id}`} className="flash-sale-product-link">
                                    <div className="flash-sale-image">
                                        <img src={images[filename] || product.image} alt={product.name} loading="lazy" decoding="async" />
                                        <span>{product.discountPercent}% OFF</span>
                                    </div>
                                    <div className="flash-sale-copy">
                                        <small>{product.id}</small>
                                        <h3>{product.name}</h3>
                                        <div className="flash-sale-prices"><strong>₹{money(product.price)}</strong><del>₹{money(product.originalPrice)}</del></div>
                                        <span className="flash-sale-saving">You save ₹{money(product.originalPrice - product.price)}</span>
                                    </div>
                                </Link>
                                <button type="button" onClick={() => { addToCart(product); navigate('/cart'); }}><ShoppingBag size={17} /> Add to cart</button>
                            </article>
                        );
                    })}
                </div>
                <div className="flash-sale-view-all">
                    <Link to="/flash-sale">View all {saleProducts.length} Flash Sale products</Link>
                </div>
            </div>
        </section>
    );
};

export default FlashSaleSection;
