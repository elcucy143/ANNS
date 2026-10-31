import { Link, useNavigate } from 'react-router-dom';
import { useCart } from '../context/CartContext';
import './ProductCard.css';

import images from '../assets/images';
import { productImageSrcSet, productImageVariant, recoverProductImage } from '../utils/imageUrl';
import { Heart } from 'lucide-react';
import { useShoppingHistory } from '../context/ShoppingHistoryContext';

const ProductCard = ({ product, priority = false }) => {
    const { addToCart } = useCart();
    const { wishlistIds, toggleWishlist } = useShoppingHistory();
    const navigate = useNavigate();

    const handleAddToCart = (event) => {
        event.preventDefault();
        event.stopPropagation();
        addToCart(product);
        navigate('/cart');
    };

    const filename = product.image ? product.image.split('/').pop() : '';
    const saved = wishlistIds.includes(String(product.id));

    return (
        <div className="product-card">
            <Link to={`/product/${product.id}`} className="product-link">
                <div className={`product-image ${/jewel/i.test(String(product.category || '')) ? 'show-complete-image' : ''}`}>
                    <button type="button" className={`product-wishlist-btn ${saved ? 'saved' : ''}`} aria-label={saved ? `Remove ${product.name} from wishlist` : `Save ${product.name} to wishlist`} onClick={(event) => { event.preventDefault(); event.stopPropagation(); toggleWishlist(product.id); }}><Heart size={18} fill={saved ? 'currentColor' : 'none'} /></button>
                    {product.originalPrice > product.price && <span className="product-sale-badge">{product.flashSale ? 'FLASH SALE' : 'SALE'} · {product.discountPercent}% OFF</span>}
                    {product.buyOneGetOne && <span className={`product-bogo-badge ${product.originalPrice > product.price ? 'below-sale' : ''}`}>BUY 1 GET 1</span>}
                    <img
                        src={images[filename] || productImageVariant(product.image, 'card')}
                        srcSet={images[filename] ? undefined : productImageSrcSet(product.image)}
                        sizes="(max-width: 540px) 46vw, (max-width: 900px) 31vw, 280px"
                        alt={product.name}
                        loading={priority ? 'eager' : 'lazy'}
                        fetchPriority={priority ? 'high' : 'auto'}
                        decoding="async"
                        onError={recoverProductImage}
                    />
                    <button className="add-to-cart-btn" onClick={handleAddToCart}>Add to Cart</button>
                </div>
                <div className="product-info">
                    <h3>{product.name}</h3>
                    <span className="price">₹{product.price}</span>
                    {product.originalPrice > product.price && <><del className="original-price">₹{product.originalPrice}</del><span className="discount-label">{product.discountPercent}% OFF</span></>}
                </div>
            </Link>
        </div>
    );
};

export default ProductCard;
