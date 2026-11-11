import { useEffect, useMemo, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Clock3, Heart, ShoppingBag, Sparkles } from 'lucide-react';
import images from '../assets/images';
import { mediaImageVariant, productImageSrcSet, productImageVariant, recoverProductImage } from '../utils/imageUrl';
import { useCart } from '../context/CartContext';
import { useProductCatalog } from '../context/ProductCatalogContext';
import { getFlashSale } from '../services/apiClient';
import { useShoppingHistory } from '../context/ShoppingHistoryContext';
import './FlashSaleSection.css';
import { getMinimumSizePrice } from '../utils/productOptions';

const money = (value) => Number(value || 0).toLocaleString('en-IN', { maximumFractionDigits: 2 });
const HOMEPAGE_SALE_PRODUCT_LIMIT = 4;
const HOMEPAGE_SALE_ROTATION_MS = 8000;

const FlashSaleSection = () => {
    const [sale, setSale] = useState(null);
    const [previewOffset, setPreviewOffset] = useState(0);
    const { products } = useProductCatalog();
    const { addToCart } = useCart();
    const { wishlistIds, toggleWishlist } = useShoppingHistory();
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
        if (!sale) return [];
        const configuredPrices = new Map((sale.items || []).map((item) => [String(item.productId), Number(item.salePrice)]));
        // Include both explicitly selected Flash Sale items and products whose
        // bulk upload already contains a valid discounted price. This mirrors
        // the full Flash Sale page and prevents the homepage from rotating only
        // the small manually configured subset.
        return products.map((product) => {
            const configuredPrice = configuredPrices.get(String(product.id));
            const originalPrice = Number(product.originalPrice || product.regularPrice || String(product.price).replace(/[^0-9.]/g, ''));
            const catalogPrice = Number(product.price);
            const hasCatalogDiscount = product.discounted === true && Number.isFinite(catalogPrice) && catalogPrice > 0 && catalogPrice < originalPrice;
            const hasConfiguredDiscount = Number.isFinite(configuredPrice) && configuredPrice > 0 && configuredPrice < originalPrice;
            if (!Number.isFinite(originalPrice) || (!hasCatalogDiscount && !hasConfiguredDiscount)) return null;
            const effectivePrice = hasConfiguredDiscount ? Math.min(catalogPrice || originalPrice, configuredPrice) : catalogPrice;
            return { ...product, originalPrice, price: effectivePrice, discountPercent: Math.round((1 - effectivePrice / originalPrice) * 100), flashSale: hasConfiguredDiscount, discounted: true };
        }).filter(Boolean);
    }, [products, sale]);

    useEffect(() => {
        if (saleProducts.length <= HOMEPAGE_SALE_PRODUCT_LIMIT) return undefined;
        const interval = window.setInterval(() => {
            setPreviewOffset((current) => (current + HOMEPAGE_SALE_PRODUCT_LIMIT) % saleProducts.length);
        }, HOMEPAGE_SALE_ROTATION_MS);
        return () => window.clearInterval(interval);
    }, [saleProducts]);

    if (!sale || !saleProducts.length) return null;

    const endLabel = sale.endsAt
        ? new Date(sale.endsAt).toLocaleString('en-IN', { day: 'numeric', month: 'short', hour: 'numeric', minute: '2-digit' })
        : '';
    const previewProducts = Array.from(
        { length: Math.min(HOMEPAGE_SALE_PRODUCT_LIMIT, saleProducts.length) },
        (_, index) => saleProducts[(previewOffset + index) % saleProducts.length],
    );

    return (
        <section className="flash-sale-section" aria-labelledby="flash-sale-title">
            <div className="container">
                <header className={`flash-sale-header ${sale.bannerImage ? 'with-banner' : ''}`} style={sale.bannerImage ? { backgroundImage: `linear-gradient(90deg, rgba(35,22,17,.92), rgba(35,22,17,.48)), url("${mediaImageVariant(sale.bannerImage)}")` } : undefined}>
                    <div>
                        <span className="flash-sale-badge"><Sparkles size={15} /> {sale.badge}</span>
                        <h2 id="flash-sale-title">{sale.title}</h2>
                        {sale.subtitle && <p>{sale.subtitle}</p>}
                    </div>
                    {endLabel && <span className="flash-sale-ends"><Clock3 size={17} /> Ends {endLabel}</span>}
                </header>
                <div className="flash-sale-grid" aria-live="polite">
                    {previewProducts.map((product) => {
                        const filename = product.image ? product.image.split('/').pop() : '';
                        const saved = wishlistIds.includes(String(product.id));
                        const minimumSizePrice = getMinimumSizePrice(product);
                        return (
                            <article className="flash-sale-card" key={product.id}>
                                <Link to={`/product/${product.id}`} className="flash-sale-product-link">
                                    <div className={`flash-sale-image ${/jewel/i.test(String(product.category || '')) ? 'show-complete-image' : ''}`}>
                                        <button type="button" className={`flash-wishlist-btn ${saved ? 'saved' : ''}`} aria-label={saved ? `Remove ${product.name} from wishlist` : `Save ${product.name} to wishlist`} onClick={(event) => { event.preventDefault(); event.stopPropagation(); toggleWishlist(product.id); }}><Heart size={18} fill={saved ? 'currentColor' : 'none'} /></button>
                                        <img
                                            src={images[filename] || productImageVariant(product.image, 'card')}
                                            srcSet={images[filename] ? undefined : productImageSrcSet(product.image)}
                                            sizes="(max-width: 600px) 72vw, (max-width: 900px) 44vw, 280px"
                                            alt={product.name}
                                            loading="lazy"
                                            decoding="async"
                                            onError={recoverProductImage}
                                        />
                                        <span>{product.discountPercent}% OFF</span>
                                    </div>
                                    <div className="flash-sale-copy">
                                        <small>{product.id}</small>
                                        <h3>{product.name}</h3>
                                        <div className="flash-sale-prices"><strong>₹{money(product.price)}</strong><del>₹{money(product.originalPrice)}</del></div>
                                        <span className="flash-sale-saving">You save ₹{money(product.originalPrice - product.price)}</span>
                                    </div>
                                </Link>
                                <button type="button" onClick={() => { if (minimumSizePrice > 0) navigate(`/product/${product.id}`); else { addToCart(product); navigate('/cart'); } }}><ShoppingBag size={17} /> {minimumSizePrice > 0 ? 'Choose size' : 'Add to cart'}</button>
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
